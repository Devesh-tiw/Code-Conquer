export async function renderCompanies(root, data){
  // load companies.json (not part of sync, but local)
  let comps = data?.companies;
  if (!comps) {
    try {
      const r = await fetch('./data/companies.json', {cache:'no-store'});
      if (r.ok) {
        const j = await r.json();
        comps = j.companies || j;
        data.companies = comps;
      }
    } catch {}
  }
  if (!comps || !comps.length) { root.innerHTML='<div class="card pad">Companies not loaded. Check data/companies.json</div>'; return; }

  const state = JSON.parse(localStorage.getItem('cc:v2:state')||'{}');
  const solvedCount = Object.values(state.records||{}).filter(r=>r.status==='solved').length;

  const header = document.createElement('div');
  header.className='view-header';
  header.innerHTML = `
    <h2>Companies — Levels & Direct Apply</h2>
    <p class="muted">Professional hiring desk. Pick a company → pick your level → see salary band, focus topics, linked stages, and <b>direct Apply link</b> (official careers). Your progress ${solvedCount}/152 frames eligibility.</p>
    <div class="controls-row" style="margin-top:10px">
      <input id="comp-search" placeholder="Search Google, Amazon, Flipkart… or SDE-1, Intern" />
      <select id="filter-level" class="btn-ghost"><option value="all">All levels</option><option>Intern</option><option>SDE-1</option><option>SDE-2</option><option>Senior</option></select>
    </div>
  `;
  root.appendChild(header);

  const wrap = document.createElement('div');
  wrap.className='companies-grid';
  root.appendChild(wrap);

  function render(){
    const q = (document.getElementById('comp-search')?.value||'').toLowerCase();
    const fl = document.getElementById('filter-level')?.value||'all';
    wrap.innerHTML='';
    for (const c of comps){
      // filter
      const matchesQ = !q || c.name.toLowerCase().includes(q) || c.levels.some(l=> l.level.toLowerCase().includes(q));
      if (!matchesQ) continue;
      const card = document.createElement('div');
      card.className='card company-card';
      card.innerHTML = `
        <div class="company-head">
          <div class="company-logo" style="background:${c.color}">${c.logo}</div>
          <div>
            <h3 class="company-name">${c.name}</h3>
            <div class="muted small">${c.hq} • ${c.tags.join(' • ')}</div>
          </div>
          <span class="pill">${c.levels.length} levels</span>
        </div>
        <p class="small" style="margin:8px 0 0;color:var(--ink-2)">${c.interview}</p>
        <div class="levels">
          ${c.levels.filter(l=> {
            if (fl==='all') return true;
            return l.level.toLowerCase().includes(fl.toLowerCase());
          }).map(l=> `
            <div class="level-row">
              <div class="level-left">
                <div class="level-title">${l.level} <span class="muted small">${l.yoe}</span></div>
                <div class="level-ctc">${l.ctc} • Deadline: ${l.deadline}</div>
                <div class="level-focus">Focus: ${l.focus.map(f=>`<span class="tag">${f}</span>`).join('')} <span class="muted small">→ ${l.stages.join(', ')}</span></div>
              </div>
              <div class="level-right">
                <a href="${l.applyUrl}" target="_blank" rel="noopener" class="btn btn-primary btn-sm">Apply ↗</a>
                <div class="small muted" style="margin-top:6px">${eligibility(l, solvedCount)}</div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
      wrap.appendChild(card);
    }
    if (!wrap.children.length) wrap.innerHTML='<div class="card pad muted">No company matches.</div>';
  }

  render();
  header.querySelector('#comp-search')?.addEventListener('input', render);
  header.querySelector('#filter-level')?.addEventListener('change', render);
}

function eligibility(level, solved){
  // simple heuristic: Intern 15+, SDE1 40+, SDE2 80+
  let need = 15;
  if (level.level.includes('SDE-2')|| level.level.includes('Senior')|| level.level.includes('E4')|| level.level.includes('P50')) need=80;
  else if (level.level.includes('SDE-1')|| level.level.includes('L3')|| level.level.includes('E3')) need=40;
  if (solved >= need) return `✓ Ready (${solved}/${need})`;
  return `Need ~${need - solved} more solves`;
}
