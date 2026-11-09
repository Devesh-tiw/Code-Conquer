import { getState, updateSettings, setUsername, exportJSON, importJSON, reset } from '../store.js';

export function renderSettings(root, data){
  const state = getState();
  const synced = data?.user?._syncedAtIST || data?.user?._syncedAt || 'never';
  const userStats = data?.user;

  const wrap = document.createElement('div');
  wrap.className='view-header';
  wrap.innerHTML = `
    <h2>Settings</h2>
    <p class="muted">Personal tool for Devesh — one user, no auth. State lives in localStorage <code>cc:v2:state</code> with Export/Import as backup.</p>
  `;
  root.appendChild(wrap);

  const card = document.createElement('div');
  card.className='card pad';
  card.innerHTML = `
    <h3>Profile</h3>
    <div class="form-row">
      <label>LeetCode username</label>
      <input id="inp-user" value="${state.username}" placeholder="Devesht373" />
      <span class="muted small">Used for Referer header + display. Real fetch uses sync workflow.</span>
    </div>
    <h3 style="margin-top:18px">Study pace</h3>
    <div class="form-grid">
      <label>Hours / week <input id="inp-hours" type="number" min="1" max="40" value="${state.settings.hoursPerWeek}"></label>
      <label>New / day <input id="inp-new" type="number" min="0" max="5" value="${state.settings.newPerDay}"></label>
      <label>Reviews / day <input id="inp-rev" type="number" min="0" max="5" value="${state.settings.reviewsPerDay}"></label>
    </div>
    <p class="muted small">Recommendation engine: <code>recommend.js</code> is pure — score = (6-conf)*10 + overdue(capped30) + attempts>1?5:0 + notes?3:0. Stage gate is law: never leak to later stage.</p>
    <h3 style="margin-top:18px">Data & Backup</h3>
    <div class="btn-row">
      <button id="btn-export" class="btn btn-primary">Export JSON</button>
      <label class="btn btn-ghost" for="file-import" style="cursor:pointer">Import JSON</label><input id="file-import" type="file" accept=".json" style="display:none">
      <button id="btn-reset" class="btn btn-danger">Reset (wipe local)</button>
    </div>
    <p class="muted small">Last sync: <b>${synced}</b> ${userStats?`• ${userStats.submitStatsGlobal.acSubmissionNum.find(x=>x.difficulty==='All')?.count ?? '?'} solved` : ''}</p>
    <p><a href="https://github.com/Devesh-tiw/Code-Conquer/actions" target="_blank">Manual Sync Now → Actions → Run workflow</a> <span class="muted small">(sync.yml runs 03:00 & 15:00 UTC)</span></p>
    <div id="export-area" style="display:none;margin-top:12px"><textarea id="export-text" rows="10" style="width:100%;font-family:var(--font-mono);font-size:12px"></textarea></div>
  `;
  root.appendChild(card);

  // handlers
  card.querySelector('#inp-user').addEventListener('change', e=>{ setUsername(e.target.value.trim()||'Devesht373'); toast('Username saved'); });
  card.querySelector('#inp-hours').addEventListener('change', e=>{ updateSettings({hoursPerWeek: Number(e.target.value)||4}); toast('Saved'); });
  card.querySelector('#inp-new').addEventListener('change', e=>{ updateSettings({newPerDay: Number(e.target.value)||2}); toast('Saved'); });
  card.querySelector('#inp-rev').addEventListener('change', e=>{ updateSettings({reviewsPerDay: Number(e.target.value)||2}); toast('Saved'); });

  card.querySelector('#btn-export').addEventListener('click', ()=>{
    const t = exportJSON();
    const ta = card.querySelector('#export-text');
    const area = card.querySelector('#export-area');
    ta.value = t;
    area.style.display='block';
    navigator.clipboard?.writeText(t).then(()=> toast('Export JSON copied')).catch(()=> toast('Export ready below'));
    // also download
    const blob = new Blob([t], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `code-conquer-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  });
  card.querySelector('#file-import').addEventListener('change', async e=>{
    const f=e.target.files[0];
    if (!f) return;
    const text = await f.text();
    try { importJSON(text); toast('Import OK — reloading'); setTimeout(()=> location.reload(), 600); }
    catch(err){ alert('Import failed: '+err.message); }
  });
  card.querySelector('#btn-reset').addEventListener('click', ()=>{
    if (confirm('Reset all local progress? Export first!')) { reset(); toast('Reset done'); location.reload(); }
  });

  const info = document.createElement('div');
  info.className='card pad small muted';
  info.innerHTML = `
    <h3>How sync works (no CORS in browser)</h3>
    <p>LeetCode GraphQL has no CORS header. So the site never calls leetcode.com directly. A GitHub Actions cron fetches <code>matchedUser</code> + <code>problemsetQuestionListV2</code> (paginated 100, 400ms delay) and commits <code>data/user.json</code> + <code>data/problems.json</code>. The frontend reads local JSON with network-first cache. If sync is stale, you still have full functionality with a banner.</p>
    <p>No token/cookie in repo — public APIs only. Respect LeetCode ToS: metadata only, no solution scraping.</p>
  `;
  root.appendChild(info);
}

function toast(msg){
  let t=document.getElementById('toast');
  if(!t){ t=document.createElement('div'); t.id='toast'; t.className='toast'; document.body.appendChild(t); }
  t.textContent=msg; t.classList.add('show'); setTimeout(()=> t.classList.remove('show'), 2200);
}
