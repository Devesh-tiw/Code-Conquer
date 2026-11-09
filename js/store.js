// store.js — localStorage state, export/import, subscriptions
const KEY = 'cc:v2:state';
const VERSION = 2;

const DEFAULT_STATE = {
  version: VERSION,
  username: 'Devesht373',
  records: {}, // id -> {status, confidence, solvedOn, r1Done, r2Done, attempts, notes}
  settings: { hoursPerWeek: 4, newPerDay: 2, reviewsPerDay: 2 },
  log: [] // {week:"2026-11-23", new:3, reviews:2, contest:true, hours:5}
};

let _state = load();
const subs = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    // migration: if version mismatch, upgrade
    if (!parsed.version || parsed.version !== VERSION) {
      parsed.version = VERSION;
      parsed.settings = { ...DEFAULT_STATE.settings, ...(parsed.settings||{}) };
      parsed.records = parsed.records || {};
      parsed.log = parsed.log || [];
      saveRaw(parsed);
    }
    return { ...structuredClone(DEFAULT_STATE), ...parsed };
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}
function saveRaw(s){ localStorage.setItem(KEY, JSON.stringify(s)); }
function save(){
  saveRaw(_state);
  for (const fn of subs) try{ fn(_state); } catch{}
}
export function getState(){ return _state; }
export function subscribe(fn){ subs.add(fn); return ()=>subs.delete(fn); }

export function setUsername(u){ _state.username = u; save(); }
export function updateSettings(patch){ _state.settings = {..._state.settings, ...patch}; save(); }

export function getRecord(id){
  return _state.records[String(id)] || { status:'not_started' };
}
export function setRecord(id, patch){
  const sid = String(id);
  const prev = _state.records[sid] || { status:'not_started' };
  const next = { ...prev, ...patch };
  // normalize
  if (next.status === 'solved' && !next.solvedOn) next.solvedOn = todayISO();
  if (next.status !== 'solved') { /* keep solvedOn for history? leave */ }
  // attempts auto-increment on attempted/solved
  _state.records[sid] = next;
  save();
  return next;
}
export function markSolved(id, confidence=3){
  const sid = String(id);
  const prev = _state.records[sid] || {};
  const now = todayISO();
  const wasSolved = prev.status === 'solved';
  const next = {
    status:'solved',
    confidence: clamp(confidence,1,5),
    solvedOn: prev.solvedOn || now,
    r1Done: prev.r1Done || false,
    r2Done: prev.r2Done || false,
    attempts: (prev.attempts||0)+1,
    notes: prev.notes || ''
  };
  // if re-solving after due, mark review done
  // logic handled in Today view via markReviewDone; here just set
  _state.records[sid]=next; save();
}
export function markAttempted(id){
  const sid=String(id);
  const prev=_state.records[sid]||{};
  _state.records[sid]={ status:'attempted', confidence: prev.confidence||2, attempts:(prev.attempts||0)+1, notes: prev.notes||'', solvedOn: prev.solvedOn||null, r1Done: prev.r1Done||false, r2Done: prev.r2Done||false };
  save();
}
export function markReviewDone(id){
  const sid=String(id);
  const r=_state.records[sid];
  if (!r || r.status!=='solved') return;
  if (!r.r1Done) r.r1Done=true;
  else if (!r.r2Done) r.r2Done=true;
  save();
}
export function setNotes(id, notes){
  const sid=String(id);
  const prev=_state.records[sid]||{status:'not_started'};
  _state.records[sid]={...prev, notes};
  save();
}
export function setConfidence(id, c){
  const sid=String(id);
  const prev=_state.records[sid]||{};
  _state.records[sid]={...prev, confidence: clamp(c,1,5)};
  save();
}

export function exportJSON(){
  return JSON.stringify(_state, null, 2);
}
export function importJSON(text){
  const parsed = JSON.parse(text);
  if (!parsed.records) throw new Error('Invalid file: missing records');
  _state = { ...structuredClone(DEFAULT_STATE), ...parsed, version: VERSION };
  save();
}
export function reset(){
  _state = structuredClone(DEFAULT_STATE);
  save();
}

// log helpers
export function upsertLogWeek({week, newCount, reviews, contest, hours}){
  const idx=_state.log.findIndex(x=>x.week===week);
  const entry={week, new: newCount??0, reviews: reviews??0, contest: !!contest, hours: hours??0};
  if (idx>=0) _state.log[idx]={..._state.log[idx], ...entry};
  else _state.log.push(entry);
  _state.log.sort((a,b)=> a.week.localeCompare(b.week));
  save();
}

function todayISO(){
  // use IST date? We'll use local date ISO slice
  return new Date().toISOString().slice(0,10);
}
function clamp(v,min,max){ return Math.max(min, Math.min(max, Number(v)||min)); }

// expose for debugging
export const _KEY = KEY;
