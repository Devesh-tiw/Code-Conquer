// sr.js — Spaced repetition date math (pure, testable)
// All dates are ISO YYYY-MM-DD in IST (Asia/Kolkata) context, but we treat as UTC date-only to avoid TZ drift.
// r1Due = solvedOn +10 days, r2Due = solvedOn +30 days
// A record is due if (!r1Done && today >= r1Due) OR (r1Done && !r2Done && today >= r2Due)

export function toISODate(d) {
  // accepts Date or string "YYYY-MM-DD" or timestamp
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toISOString().slice(0,10);
}

export function addDays(iso, days) {
  // iso: "YYYY-MM-DD"
  const [y,m,dd] = iso.split('-').map(Number);
  const d = new Date(Date.UTC(y, m-1, dd));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0,10);
}

export function diffDays(aISO, bISO) {
  // b - a in days (positive if b is after a)
  const [ya,ma,da] = aISO.split('-').map(Number);
  const [yb,mb,db] = bISO.split('-').map(Number);
  const a = Date.UTC(ya, ma-1, da);
  const b = Date.UTC(yb, mb-1, db);
  return Math.round((b - a) / 86400000);
}

export function r1Due(record) {
  if (!record?.solvedOn) return null;
  return addDays(record.solvedOn, 10);
}
export function r2Due(record) {
  if (!record?.solvedOn) return null;
  return addDays(record.solvedOn, 30);
}

export function isDue(record, todayISO) {
  if (!record || record.status !== 'solved' || !record.solvedOn) return false;
  const r1 = r1Due(record);
  const r2 = r2Due(record);
  if (!record.r1Done) {
    return todayISO >= r1;
  } else if (record.r1Done && !record.r2Done) {
    return todayISO >= r2;
  }
  return false; // both done
}

export function overdueDays(record, todayISO) {
  if (!isDue(record, todayISO)) return 0;
  const target = !record.r1Done ? r1Due(record) : r2Due(record);
  const d = diffDays(target, todayISO);
  return Math.max(0, d);
}

export function dueStage(record) {
  if (!record.r1Done) return 1;
  if (!record.r2Done) return 2;
  return null;
}
