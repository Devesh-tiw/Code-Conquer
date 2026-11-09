// sync.js — loads ./data/*.json with staleness handling, never blocks UI
export async function loadJSON(path) {
  try {
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.warn(`loadJSON ${path} failed:`, e.message);
    return null;
  }
}

export async function loadAll() {
  const [ladder, user, problems] = await Promise.all([
    loadJSON('./data/ladder.json'),
    loadJSON('./data/user.json'),
    loadJSON('./data/problems.json')
  ]);
  const now = Date.now();
  function staleness(j){ if (!j?._syncedAt) return { days: Infinity, label:'never' }; const d = (now - new Date(j._syncedAt).getTime())/86400000; return { days:d, label: j._syncedAtIST || j._syncedAt }; }
  return {
    ladder,
    user,
    problems,
    meta: {
      userStale: staleness(user),
      problemsStale: staleness(problems),
      ladderOk: !!ladder
    }
  };
}

export function formatStaleness(days){
  if (!isFinite(days)) return 'never synced';
  if (days < 1) return 'today';
  if (days < 2) return '1 day ago';
  return `${Math.floor(days)} days ago`;
}
