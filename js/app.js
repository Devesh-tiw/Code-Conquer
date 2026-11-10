// app.js — router, view mounting
import { loadAll } from './sync.js';
import { getState, subscribe } from './store.js';
import { renderToday } from './views/today.js';
import { renderDashboard } from './views/dashboard.js';
import { renderLadder } from './views/ladder.js';
import { renderAudit } from './views/audit.js';
import { renderLog } from './views/log.js';
import { renderSettings } from './views/settings.js';
import { renderCompanies } from './views/companies.js';
import { renderGame } from './views/game.js';

const VIEWS = {
  'today': renderToday,
  'dashboard': renderDashboard,
  'ladder': renderLadder,
  'companies': renderCompanies,
  'game': renderGame,
  'audit': renderAudit,
  'log': renderLog,
  'settings': renderSettings
};

let cache = null;

async function init(){
  cache = await loadAll();
  // also load companies if present
  try {
    const r = await fetch('./data/companies.json', {cache:'no-store'});
    if (r.ok) cache.companies = (await r.json()).companies || (await r.json());
  } catch {}
  window.__CC_DATA__ = cache;
  mount();
  window.addEventListener('hashchange', mount);
  subscribe(()=> mount());
  const footer = document.getElementById('footer-sync');
  if (footer && cache?.user?._syncedAt) {
    const d = cache.user._syncedAtIST || cache.user._syncedAt;
    const stale = cache.meta?.userStale?.days ?? Infinity;
    if (stale > 3) {
      footer.textContent = `Data as of ${d} — stale (${Math.floor(stale)}d old). Sync runs twice daily.`;
      footer.style.color = 'var(--warn)';
    } else {
      footer.textContent = `Last synced ${d} • Live LeetCode data via GitHub Actions`;
    }
  }
}

function mount(){
  const raw = location.hash.replace('#','') || 'today';
  const hash = raw.split('&')[0].toLowerCase(); // support #game&share=...
  const view = VIEWS[hash] ? hash : (raw.startsWith('game') ? 'game' : 'today');
  document.querySelectorAll('.nav-tab').forEach(a=>{
    a.classList.toggle('active', a.dataset.view===view);
  });
  const el = document.getElementById('app');
  if (!el) return;
  const fn = VIEWS[view];
  el.innerHTML = '';
  try { fn(el, cache); } catch(e){ el.innerHTML = `<div class="card" style="padding:20px;color:var(--danger)">View error: ${e.message}</div>`; console.error(e); }
}

document.addEventListener('DOMContentLoaded', init);
