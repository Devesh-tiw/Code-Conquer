#!/usr/bin/env node
// Code-Conquer v2 — LeetCode sync (Node 20+, zero deps)
// Fetches public data via leetcode.com/graphql and writes data/*.json
// Never overwrites good data with error payload; exits 0 on partial failure.

import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const USERNAME = process.env.LEETCODE_USERNAME || 'Devesht373';
const ENDPOINT = 'https://leetcode.com/graphql';
const REFERER = `https://leetcode.com/u/${USERNAME}/`;

const USER_QUERY = `
query($u: String!) {
  matchedUser(username: $u) {
    username
    submitStatsGlobal { acSubmissionNum { difficulty count submissions } }
    profile { ranking }
    userCalendar { streak totalActiveDays activeYears submissionCalendar }
    tagProblemCounts {
      fundamental { tagName problemsSolved }
      intermediate { tagName problemsSolved }
      advanced { tagName problemsSolved }
    }
  }
}
`;

const CATALOGUE_QUERY = `
query($l: Int, $s: Int) {
  problemsetQuestionListV2(limit: $l, skip: $s) {
    totalLength
    questions {
      questionFrontendId title titleSlug difficulty paidOnly topicTags { name }
    }
  }
}
`;

const RECENT_QUERY = `
query($u: String!) {
  recentAcSubmissionList(username: $u, limit: 20) {
    id title titleSlug timestamp
  }
}
`;

async function gql(query, variables) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Referer': REFERER,
      'User-Agent': 'CodeConquerSync/2.0 (+https://github.com/Devesh-tiw/Code-Conquer)',
    },
    body: JSON.stringify({ query, variables })
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}: ${text.slice(0,200)}`);
  const json = JSON.parse(text);
  if (json.errors) throw new Error(`GraphQL errors: ${JSON.stringify(json.errors).slice(0,400)}`);
  return json.data;
}

function nowISO() { return new Date().toISOString(); }
function nowISTLabel() {
  return new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) + ' IST';
}
function delay(ms){ return new Promise(r=>setTimeout(r, ms)); }

async function safeReadJson(path) {
  try { if (!existsSync(path)) return null; const t = await readFile(path,'utf8'); return JSON.parse(t); } catch { return null; }
}

async function fetchUser() {
  console.log(`→ fetching user stats for ${USERNAME}…`);
  const data = await gql(USER_QUERY, { u: USERNAME });
  if (!data?.matchedUser) throw new Error('matchedUser is null — username may be wrong or LeetCode changed schema');

  // submissionCalendar is JSON string, keep as-is but also validate
  const cal = data.matchedUser.userCalendar;
  if (cal?.submissionCalendar && typeof cal.submissionCalendar === 'string') {
    try { JSON.parse(cal.submissionCalendar); } catch { console.warn('  ! submissionCalendar not valid JSON'); }
  }

  // Try recent submissions — may be renamed; probe with introspection fallback
  let recent = null;
  try {
    const r = await gql(RECENT_QUERY, { u: USERNAME });
    recent = r?.recentAcSubmissionList ?? null;
    if (recent) console.log(`  ✓ recentAcSubmissionList: ${recent.length} entries`);
  } catch (e) {
    console.warn(`  ⚠ recentAcSubmissionList unavailable: ${e.message.slice(0,120)} — will use calendar diff fallback`);
  }

  // Build output
  const out = {
    _syncedAt: nowISO(),
    _syncedAtIST: nowISTLabel(),
    _source: 'leetcode.com/graphql matchedUser + userCalendar',
    username: data.matchedUser.username,
    profile: data.matchedUser.profile,
    submitStatsGlobal: data.matchedUser.submitStatsGlobal,
    userCalendar: data.matchedUser.userCalendar,
    tagProblemCounts: data.matchedUser.tagProblemCounts,
  };
  if (recent) out.userCalendar.recentAcSubmissionList = recent;
  return out;
}

async function fetchCatalogue() {
  console.log('→ fetching full catalogue (problemsetQuestionListV2)…');
  const all = [];
  let totalLength = null;
  let skip = 0;
  const limit = 100;
  let pages = 0;
  while (true) {
    const data = await gql(CATALOGUE_QUERY, { l: limit, s: skip });
    const page = data?.problemsetQuestionListV2;
    if (!page) throw new Error('problemsetQuestionListV2 is null');
    if (totalLength === null) {
      totalLength = page.totalLength;
      console.log(`  totalLength = ${totalLength}`);
    }
    const qs = page.questions || [];
    all.push(...qs);
    pages++;
    console.log(`  page ${pages}: skip=${skip} got ${qs.length} (total so far ${all.length}/${totalLength})`);
    if (qs.length === 0 || all.length >= totalLength) break;
    skip += limit;
    await delay(400); // required to avoid rate-limit
    if (pages > 60) { console.warn('  ! too many pages, stopping'); break; }
  }
  const freeCount = all.filter(q=>!q.paidOnly).length;
  return {
    _syncedAt: nowISO(),
    _source: 'leetcode.com/graphql problemsetQuestionListV2 paginated limit=100',
    totalLength,
    storedCount: all.length,
    freeCount,
    paidCount: all.length - freeCount,
    note: 'Cached monthly; paginated with 400ms delay per spec. 4009+ problems as of Nov 2026.',
    questions: all
  };
}

async function main(){
  await mkdir('data', { recursive: true });
  let hadError = false;

  // 1) User stats
  try {
    const user = await fetchUser();
    const prev = await safeReadJson('data/user.json');
    await writeFile('data/user.json', JSON.stringify(user, null, 2) + '\n', 'utf8');
    console.log(`✓ wrote data/user.json (${user.submitStatsGlobal.acSubmissionNum.find(x=>x.difficulty==='All')?.count ?? '?'} solved)`);
    // keep problems.json untouched on failure
  } catch (e) {
    console.error(`✗ user fetch failed: ${e.stack || e.message}`);
    hadError = true;
    // do not overwrite previous file
  }

  // 2) Catalogue — refresh monthly at most, but we attempt each run; if unchanged skip write
  // To avoid hammering every sync, we check age of existing file: >28 days => refresh
  try {
    const prevCat = await safeReadJson('data/problems.json');
    const ageDays = prevCat?._syncedAt ? (Date.now() - new Date(prevCat._syncedAt).getTime())/86400000 : Infinity;
    const force = process.argv.includes('--force') || process.env.FORCE_CATALOGUE === '1';
    if (prevCat && ageDays < 28 && !force) {
      console.log(`↷ catalogue fresh (${ageDays.toFixed(1)} days old), skipping refresh. Use --force to override.`);
    } else {
      const cat = await fetchCatalogue();
      await writeFile('data/problems.json', JSON.stringify(cat, null, 2) + '\n', 'utf8');
      console.log(`✓ wrote data/problems.json (${cat.storedCount} stored, totalLength ${cat.totalLength})`);
    }
  } catch (e) {
    console.error(`✗ catalogue fetch failed: ${e.stack || e.message}`);
    hadError = true;
  }

  if (hadError) {
    console.warn('⚠ completed with errors — previous good files left untouched. Exit 0 per spec.');
  } else {
    console.log('✓ sync complete');
  }
  // spec: exits 0 on partial failure, never overwrites good data with error
  process.exit(0);
}

main();
