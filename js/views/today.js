import { recommend } from '../recommend.js';
import { getState, markSolved, markAttempted, markReviewDone } from '../store.js';

export function renderToday(root, data){
  const state = getState();
  const ladder = data?.ladder;
  if (!ladder) {
    root.innerHTML = `<div class="card pad">Ladder not loaded. Check data/ladder.json</div>`;
    return;
  }
  const todayISO = new Date().toISOString().slice(0,10);
  const result = recommend({ records: state.records, ladder, todayISO, settings: state.settings });

  // header
  const h = document.createElement('div');
  h.className = 'view-header';
  h.innerHTML = `
    <h2>Today — ${todayISO}</h2>
    <p class="muted">Your 4 tasks, explainable. Reviews first (${state.settings.reviewsPerDay}/day), then new (${state.settings.newPerDay}/day) from <b>${result.stats.currentStageTitle || '—'}</b>. Stage gate: never skip ahead.</p>
    <div class="pill-row">
      <span class="pill">Stage: <b>${result.stats.currentStage || '—'}</b> — ${result.stats.stageProgress.solved}/${result.stats.stageProgress.total} (${result.stats.stageProgress.percent}%)</span>
      <span class="pill ${result.stats.dueCount>8?'pill-danger':''}">Due reviews: <b>${result.stats.dueCount}</b></span>
      ${result.stats.driftDays!=null ? `<span class="pill">Drift: ${result.stats.driftDays}d</span>` : ''}
    </div>
  `;
  root.appendChild(h);

  // tasks
  const grid = document.createElement('div');
  grid.className = 'task-grid';
  if (result.tasks.length===0) {
    grid.innerHTML = `<div class="card pad muted">No tasks today. Great — clear reviews or start next stage. Check Ladder.</div>`;
  } else {
    for (const t of result.tasks) {
      const p = t.problem;
      const diffClass = (p?.difficulty || 'Medium').toLowerCase();
      const card = document.createElement('div');
      card.className = 'card task-card';
      const id = p?.id || t.problemId;
      const slug = p?.titleSlug || '';
      const link = slug ? `https://leetcode.com/problems/${slug}/` : `https://leetcode.com/problemset/?search=${encodeURIComponent(p?.title||id)}`;
      const typeBadge = t.type==='review' ? '<span class="badge badge-review">REVIEW</span>' : '<span class="badge badge-new">NEW</span>';
      card.innerHTML = `
        <div class="task-top">
          <div>
            ${typeBadge}
            <span class="task-id">#${id}</span>
            <span class="diff ${diffClass}">${p?.difficulty||''}</span>
          </div>
          <span class="stage-key">${t.stageKey}</span>
        </div>
        <h3 class="task-title"><a href="${link}" target="_blank" rel="noopener">${p?.title || 'Unknown Problem #' + id} ↗</a></h3>
        <p class="reason">${escapeHtml(t.reason)}</p>
        <div class="task-actions">
          <button class="btn btn-primary" data-act="solved" data-id="${id}">Solved</button>
          <button class="btn btn-ghost" data-act="attempted" data-id="${id}">Attempted</button>
          <button class="btn btn-ghost" data-act="skip" data-id="${id}">Skip</button>
          ${t.type==='review' ? `<button class="btn btn-ghost" data-act="rDone" data-id="${id}" title="Mark R1/R2 done">✓ Review done</button>` : ''}
        </div>
        <div class="conf-row" data-conf="${id}">
          <label>Confidence:</label>
          ${[1,2,3,4,5].map(n=>`<button class="conf ${state.records[id]?.confidence===n?'active':''}" data-confval="${n}" data-id="${id}">${n}</button>`).join('')}
        </div>
      `;
      grid.appendChild(card);
    }
  }
  root.appendChild(grid);

  // actions delegation
  grid.addEventListener('click', (e)=>{
    const btn = e.target.closest('button[data-act]');
    if (btn) {
      const id = btn.dataset.id;
      const act = btn.dataset.act;
      if (act==='solved') { showConfidencePrompt(id, (c)=>{ markSolved(id, c); }); }
      else if (act==='attempted') { markAttempted(id); toast(`Marked #${id} as attempted`); }
      else if (act==='skip') { toast(`Skipped #${id} — will resurface`); }
      else if (act==='rDone') { markReviewDone(id); toast(`Review marked done for #${id}`); }
    }
    const cbtn = e.target.closest('button[data-confval]');
    if (cbtn) {
      const id=cbtn.dataset.id; const v=Number(cbtn.dataset.confval);
      import('../store.js').then(m=>{ m.setConfidence(id,v); });
    }
  });

  // warnings
  if (result.warnings.length){
    const w = document.createElement('div');
    w.className='card pad warnings';
    w.innerHTML = `<h3>Warnings</h3>` + result.warnings.map(x=>`
      <div class="warn warn-${x.level}">
        <span class="warn-code">${x.code}</span>
        <span>${escapeHtml(x.message)}</span>
      </div>
    `).join('');
    root.appendChild(w);
  } else {
    const ok = document.createElement('div');
    ok.className='card pad';
    ok.innerHTML = `<div class="ok">No warnings. Keep the streak.</div>`;
    root.appendChild(ok);
  }

  // why explainability
  const exp = document.createElement('div');
  exp.className='card pad muted small';
  exp.innerHTML = `Explainability is the product. Each recommendation shows <i>why</i> — confidence, overdue days, notes. The <b>single most important rule</b>: never recommend a new problem from a later stage. Finish the stage you're in.`;
  root.appendChild(exp);
}

function escapeHtml(s){ return String(s).replace(/[&<>"]/g, c=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function toast(msg){
  let t=document.getElementById('toast');
  if(!t){ t=document.createElement('div'); t.id='toast'; t.className='toast'; document.body.appendChild(t); }
  t.textContent=msg; t.classList.add('show'); setTimeout(()=> t.classList.remove('show'), 2200);
}
function showConfidencePrompt(id, cb){
  const v = prompt(`Confidence for #${id}? (1 = can't re-derive, 5 = could teach it)`, "3");
  if (v===null) return;
  const n = Number(v);
  if (n>=1 && n<=5) { cb(n); toast(`Marked #${id} solved (conf ${n})`); } else { alert('Enter 1-5'); }
}
