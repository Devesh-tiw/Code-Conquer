import { getState, setRecord, setNotes } from '../store.js';

export function renderLadder(root, data){
  const ladder = data?.ladder;
  const state = getState();
  if (!ladder) { root.innerHTML='<div class="card pad">ladder.json missing</div>'; return; }

  const header = document.createElement('div');
  header.className='view-header';
  header.innerHTML = `
    <h2>Ladder — ${ladder.meta.total} problems, 12 stages</h2>
    <p class="muted">All problems in provided order. Filter by status/confidence. Tap to edit inline. Stage gate enforced in Today view — says so here too: <b>never recommend a later stage while earlier has unsolved</b>.</p>
    <div class="controls-row" style="margin-top:12px">
      <input id="ladder-search" placeholder="Search title, id, slug…" />
      <select id="filter-status" class="btn-ghost"><option value="all">All status</option><option value="not_started">Not started</option><option value="attempted">Attempted</option><option value="solved">Solved</option></select>
      <select id="filter-diff" class="btn-ghost"><option value="all">All difficulties</option><option>Easy</option><option>Medium</option><option>Hard</option></select>
    </div>
  `;
  root.appendChild(header);

  const container = document.createElement('div');
  container.id='ladder-container';
  root.appendChild(container);

  function render(){
    const q = (document.getElementById('ladder-search')?.value || '').toLowerCase();
    const fs = document.getElementById('filter-status')?.value || 'all';
    const fd = document.getElementById('filter-diff')?.value || 'all';
    container.innerHTML='';
    for (const stage of ladder.stages){
      const visibleProblems = stage.problems.filter(p=>{
        const rec = state.records[p.id];
        const status = rec?.status || 'not_started';
        if (fs!=='all' && status!==fs) return false;
        if (fd!=='all' && p.difficulty!==fd) return false;
        if (q && !(`${p.id} ${p.title} ${p.titleSlug}`.toLowerCase().includes(q))) return false;
        return true;
      });
      if (visibleProblems.length===0) continue;

      const section = document.createElement('div');
      section.className='topic-section';
      const solvedCount = stage.problems.filter(p=> state.records[p.id]?.status==='solved').length;
      section.innerHTML = `
        <div class="topic-head">
          <h3 class="topic-title">${stage.title}</h3>
          <span class="topic-count">${solvedCount}/${stage.problems.length}</span>
        </div>
        <p class="muted small" style="padding:0 20px 8px">${stage.description}</p>
        <div class="progress-container" style="margin:0 20px 12px"><div style="width:${Math.round(solvedCount/stage.problems.length*100)}%"></div></div>
      `;
      const list = document.createElement('div');
      list.className='problem-list';
      for (const p of visibleProblems){
        const rec = state.records[p.id] || { status:'not_started' };
        const row = document.createElement('div');
        row.className='problem-row';
        row.dataset.id=p.id;
        const confBadges = [1,2,3,4,5].map(n=>`<button class="conf-mini ${rec.confidence===n?'active':''}" data-c="${n}" data-id="${p.id}">${n}</button>`).join('');
        row.innerHTML = `
          <div class="pr-left">
            <span class="pr-id">#${p.id}</span>
            <span class="diff ${p.difficulty.toLowerCase()}">${p.difficulty}</span>
            <a href="https://leetcode.com/problems/${p.titleSlug}/" target="_blank" class="pr-title">${p.title}</a>
            <span class="pr-slug muted small">${p.titleSlug}</span>
          </div>
          <div class="pr-right">
            <select class="status-sel btn-ghost" data-id="${p.id}">
              <option value="not_started" ${rec.status==='not_started'?'selected':''}>Not started</option>
              <option value="attempted" ${rec.status==='attempted'?'selected':''}>Attempted</option>
              <option value="solved" ${rec.status==='solved'?'selected':''}>Solved</option>
            </select>
            <span class="conf-group">${confBadges}</span>
            <input class="notes-input" placeholder="notes…" value="${(rec.notes||'').replace(/"/g,'&quot;')}" data-id="${p.id}" />
            ${rec.solvedOn ? `<span class="solvedOn small muted">${rec.solvedOn} ${rec.r1Done?'R1✓':''} ${rec.r2Done?'R2✓':''}</span>` : ''}
          </div>
        `;
        list.appendChild(row);
      }
      section.appendChild(list);
      container.appendChild(section);
    }
    if (!container.children.length) container.innerHTML='<div class="card pad muted">No matches. Try clearing filters.</div>';
  }

  render();
  header.querySelector('#ladder-search')?.addEventListener('input', render);
  header.querySelector('#filter-status')?.addEventListener('change', render);
  header.querySelector('#filter-diff')?.addEventListener('change', render);

  container.addEventListener('change', e=>{
    const sel=e.target.closest('.status-sel');
    if (sel){
      const id=sel.dataset.id;
      const val=sel.value;
      if (val==='solved') {
        const conf = prompt('Confidence 1-5 for #'+id+'?', "3");
        const c = Math.max(1, Math.min(5, Number(conf)||3));
        const rec = state.records[id]||{};
        setRecord(id, { status:'solved', confidence:c, solvedOn: rec.solvedOn || new Date().toISOString().slice(0,10), r1Done: rec.r1Done||false, r2Done: rec.r2Done||false, attempts: (rec.attempts||0)+1 });
      } else {
        setRecord(id, { status: val });
      }
      render();
    }
  });
  container.addEventListener('click', e=>{
    const b=e.target.closest('.conf-mini');
    if (b){ import('../store.js').then(m=>{ m.setConfidence(b.dataset.id, Number(b.dataset.c)); render(); }); }
  });
  container.addEventListener('change', e=>{
    const inp=e.target.closest('.notes-input');
    if (inp){ setNotes(inp.dataset.id, inp.value); }
  });
}
