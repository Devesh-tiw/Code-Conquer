// recommend.js — deterministic rules engine (pure functions, unit-testable)
// Spec §4 verbatim

import { isDue, overdueDays, r1Due, r2Due } from './sr.js';

/**
 * @param {Object} opts
 * @param {Object} opts.records - map id -> {status, confidence, solvedOn, r1Done, r2Done, attempts, notes}
 * @param {Object} opts.ladder - {stages:[{key,title,problems:[{id,title,titleSlug,difficulty}]}]}
 * @param {string} opts.todayISO - "YYYY-MM-DD"
 * @param {Object} opts.settings - {hoursPerWeek, newPerDay, reviewsPerDay}
 * @returns {{tasks:Array, warnings:Array, stats:Object}}
 */
export function recommend({ records, ladder, todayISO, settings }) {
  const newPerDay = settings?.newPerDay ?? 2;
  const reviewsPerDay = settings?.reviewsPerDay ?? 2;

  // --- Step 1 & 2: Build due queue and rank
  const due = [];
  for (const [pid, rec] of Object.entries(records || {})) {
    if (!isDue(rec, todayISO)) continue;
    const od = overdueDays(rec, todayISO);
    const capped = Math.min(od, 30);
    const score = (6 - (rec.confidence ?? 3)) * 10 + capped + (rec.attempts > 1 ? 5 : 0) + (rec.notes ? 3 : 0);
    const stageKey = findStageForProblem(ladder, pid);
    due.push({ problemId: pid, rec, score, overdueDays: od, stageKey });
  }
  // Rank: highest score first; tie-breaker: lower confidence, more overdue, attempts
  due.sort((a,b) => {
    if (b.score !== a.score) return b.score - a.score;
    if ((a.rec.confidence ?? 3) !== (b.rec.confidence ?? 3)) return (a.rec.confidence ?? 3) - (b.rec.confidence ?? 3);
    return b.overdueDays - a.overdueDays;
  });

  const dueCount = due.length;

  // --- Step 4: Stage gate
  const currentStage = findCurrentStage(ladder, records);
  const stageProgress = currentStage ? stageProgressOf(ladder, records, currentStage.key) : { solved:0, total:0 };

  // --- Step 3: Fill task slots
  const tasks = [];

  // reviews
  const reviewSlice = due.slice(0, reviewsPerDay);
  for (const d of reviewSlice) {
    const prob = findProblem(ladder, d.problemId);
    const stage = d.stageKey || currentStage?.key || '';
    tasks.push({
      type: 'review',
      problemId: d.problemId,
      stageKey: stage,
      problem: prob,
      reason: buildReason(d.rec, d.overdueDays, todayISO),
      score: d.score
    });
  }

  // new problems — current stage only, in ladder.json order, skipping not_started only
  if (currentStage && tasks.length < (reviewsPerDay + newPerDay)) {
    const needed = (reviewsPerDay + newPerDay) - tasks.length;
    // But spec: reviewsPerDay slots from due queue, then newPerDay from current stage only
    // So we should take min(needed, newPerDay) but also if due < reviewsPerDay, we still only take newPerDay new
    // Implement exactly: reviews slots = reviewsPerDay from due, new slots = newPerDay from current stage
    // If we have less due than reviewsPerDay, tasks will be shorter; we still add newPerDay
    // To match spec length 4: if due is 1, we still want 2 new -> total 3, but spec says length 4. Re-read: Fill task slots reviewsPerDay then newPerDay => always 4 unless not enough problems.
    // So we take newPerDay regardless of due shortage.
    const newNeeded = newPerDay;
    let added = 0;
    for (const p of currentStage.problems) {
      if (added >= newNeeded) break;
      const rec = records[p.id];
      const status = rec?.status || 'not_started';
      if (status !== 'not_started') continue;
      tasks.push({
        type: 'new',
        problemId: p.id,
        stageKey: currentStage.key,
        problem: p,
        reason: `Next in ${currentStage.title} — stage order. The stage gate says: finish this stage before moving on.`,
        score: 0
      });
      added++;
    }
    // If we already had reviewSlice shorter, we already pushed reviews, now we push newNeeded.
    // Edge: tasks may have reviews (0..2) + new (0..2) = up to 4. If due==0, tasks=2 new.
    // But spec example: empty state => first 2 problems of Stage 0 (so 2 tasks). To always show 4, we could backfill with reviews if due empty? No.
    // We will ensure tasks.length <=4, pad not needed.
  }

  // If due overflow > reviewsPerDay, tasks only contains top reviews; that's intentional — warnings will flag.

  // Ensure tasks length caps at 4 (2+2)
  const cappedTasks = tasks.slice(0, 4);

  // --- Step 5: Warnings
  const warnings = buildWarnings({ records, ladder, todayISO, dueCount, currentStage });

  // Stats
  const driftDays = computeDriftDays(records, todayISO);
  const streakDays = computeStreakDays(records);

  return {
    tasks: cappedTasks,
    warnings,
    stats: {
      currentStage: currentStage ? currentStage.key : null,
      currentStageTitle: currentStage ? currentStage.title : null,
      stageProgress,
      dueCount,
      driftDays,
      streakDays
    }
  };
}

function findStageForProblem(ladder, pid) {
  if (!ladder?.stages) return null;
  for (const s of ladder.stages) {
    if (s.problems.some(p=> String(p.id)===String(pid))) return s.key;
  }
  return null;
}
function findProblem(ladder, pid) {
  if (!ladder?.stages) return null;
  for (const s of ladder.stages) { for (const p of s.problems) if (String(p.id)===String(pid)) return p; }
  return null;
}
function findCurrentStage(ladder, records) {
  if (!ladder?.stages) return null;
  for (const s of ladder.stages) {
    const hasUnsolved = s.problems.some(p=>{
      const r = records?.[p.id];
      return (r?.status || 'not_started') !== 'solved';
    });
    if (hasUnsolved) return s;
  }
  return ladder.stages[ladder.stages.length-1] || null;
}
function stageProgressOf(ladder, records, stageKey) {
  const s = ladder.stages.find(x=>x.key===stageKey);
  if (!s) return { solved:0, total:0, percent:0 };
  let solved=0;
  for (const p of s.problems) if (records?.[p.id]?.status==='solved') solved++;
  return { solved, total: s.problems.length, percent: Math.round(solved/s.problems.length*100) };
}

function buildReason(rec, overdueDays, todayISO) {
  const parts = [];
  if (rec.confidence != null) parts.push(`Confidence ${rec.confidence}/5`);
  if (overdueDays > 0) parts.push(`${overdueDays} day${overdueDays===1?'':'s'} overdue`);
  else parts.push(`due today`);
  if (!rec.r1Done) parts.push(`R1 (10-day review)`);
  else parts.push(`R2 (30-day review)`);
  if (rec.attempts > 1) parts.push(`${rec.attempts} attempts`);
  let s = parts.join(', ') + '.';
  if (rec.notes) s += ` You noted “${rec.notes}”.`;
  // Add due date context
  const dueDate = !rec.r1Done ? r1Due(rec) : r2Due(rec);
  if (dueDate) s += ` Due was ${dueDate}.`;
  return s;
}

function buildWarnings({ records, ladder, todayISO, dueCount, currentStage }) {
  const warnings = [];
  // DUE_OVERFLOW
  if (dueCount > 8) {
    warnings.push({ level:'danger', code:'DUE_OVERFLOW', message:`Stop new problems. Clear the queue first. ${dueCount} reviews due (limit 8).` });
  }
  // DRIFT
  const drift = computeDriftDays(records, todayISO);
  if (drift !== null && drift > 5) {
    warnings.push({ level:'warn', code:'DRIFT', message:`You've drifted ${drift} days — last solve was ${drift} days ago. Do one easy win today.` });
  }
  // CONFIDENCE_LOW
  const solvedEntries = Object.values(records||{}).filter(r=> r.status==='solved');
  if (solvedEntries.length >= 5) {
    const low = solvedEntries.filter(r=> (r.confidence ?? 3) <=2).length;
    if (low / solvedEntries.length > 0.4) {
      warnings.push({ level:'warn', code:'CONFIDENCE_LOW', message:`You're marking things solved you can't re-derive. Use the 25-minute rule. ${low}/${solvedEntries.length} with confidence ≤2.` });
    }
  }
  // NO_CONTEST
  // check log entries with contest:true in last 7 days
  let hasContest = false;
  try {
    const raw = localStorage.getItem('cc:v2:state');
    if (raw) {
      const parsed = JSON.parse(raw);
      const log = parsed.log || [];
      const today = new Date(todayISO);
      for (const e of log) {
        if (!e.week || !e.contest) continue;
        const wk = new Date(e.week);
        const diff = Math.round((today - wk)/86400000);
        if (diff >=0 && diff <7) { hasContest = true; break; }
      }
    }
  } catch {}
  if (!hasContest) {
    // Only warn if we have any log at all or if >7 days since start
    const anyRecords = Object.keys(records||{}).length>0;
    if (anyRecords) warnings.push({ level:'info', code:'NO_CONTEST', message:'No contest this week. Log one — consistency > intensity.' });
  }
  // STAGE_STALL
  if (currentStage) {
    const stallDays = computeStageStallDays(records, currentStage, todayISO);
    if (stallDays !== null && stallDays >= 10) {
      warnings.push({ level:'warn', code:'STAGE_STALL', message:`${currentStage.title} has stalled — no new solves in ${stallDays} days. Reduce newPerDay or clear reviews.` });
    }
  }
  return warnings;
}

function computeDriftDays(records, todayISO) {
  const solved = Object.values(records||{}).filter(r=> r.status==='solved' && r.solvedOn).map(r=>r.solvedOn).sort();
  if (solved.length===0) return null;
  const last = solved[solved.length-1];
  const [y1,m1,d1]= last.split('-').map(Number);
  const [y2,m2,d2]= todayISO.split('-').map(Number);
  const a = Date.UTC(y1,m1-1,d1);
  const b = Date.UTC(y2,m2-1,d2);
  return Math.round((b-a)/86400000);
}
function computeStreakDays(records) {
  // best-effort from solvedOn dates: count consecutive days with solves ending today or most recent
  return null; // LeetCode streak is authoritative; this is placeholder
}
function computeStageStallDays(records, stage, todayISO) {
  // days since last solved in this stage
  let latest = null;
  for (const p of stage.problems) {
    const r = records?.[p.id];
    if (r?.status==='solved' && r.solvedOn) {
      if (!latest || r.solvedOn > latest) latest = r.solvedOn;
    }
  }
  if (!latest) {
    // if stage never started, check overall drift? spec says current stage no new solves in 10 days => stall. If never solved, we could check earliest record? Simpler: if no solves in stage, compute from today minus stage start? We'll return null to avoid false positive.
    // Instead compute from earliest solvedOn overall? If none, null.
    return null;
  }
  const [y1,m1,d1]= latest.split('-').map(Number);
  const [y2,m2,d2]= todayISO.split('-').map(Number);
  const a = Date.UTC(y1,m1-1,d1);
  const b = Date.UTC(y2,m2-1,d2);
  return Math.round((b-a)/86400000);
}

// Export helpers for testing
export { findCurrentStage, stageProgressOf, buildReason, computeDriftDays };
