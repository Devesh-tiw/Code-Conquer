// game.js — Multi-user Domain game, browser-only, share-code link, no server
// Key: cc:v2:groups

const STORE_KEY = 'cc:v2:groups';
const GRID = 10; // 10x10 =100 tiles
const COLORS = ['#1D4ED8','#059669','#DC2626','#7C3AED','#EA580C','#0891B2','#DB2777','#65A30D'];

function loadGroups(){
  try{ const raw=localStorage.getItem(STORE_KEY); return raw? JSON.parse(raw): {groups:[]}; } catch{ return {groups:[]}; }
}
function saveGroups(g){ localStorage.setItem(STORE_KEY, JSON.stringify(g)); }

function uid(){ return Math.random().toString(36).slice(2,8).toUpperCase(); }

export function renderGame(root, data){
  const state = JSON.parse(localStorage.getItem('cc:v2:state')||'{}');
  const mySolved = Object.values(state.records||{}).filter(r=> r.status==='solved').length;
  const myName = state.username || 'You';

  // check share link import
  checkShareImport();

  const header = document.createElement('div');
  header.className='view-header';
  header.innerHTML = `
    <h2>🌐 Domain — Group Territory Game</h2>
    <p class="muted">Create a group, add friends. Each solved LeetCode = +1 tile. Biggest domain wins. <b>Browser-only</b> — groups live in localStorage, shared via code link. No server.</p>
    <div class="pill-row">
      <span class="pill">You: <b>${myName}</b> — ${mySolved} solved → ~${Math.min(100, mySolved)} tiles potential</span>
      <span class="pill">Grid: ${GRID}×${GRID} = ${GRID*GRID} tiles</span>
    </div>
  `;
  root.appendChild(header);

  const actions = document.createElement('div');
  actions.className='card pad';
  actions.innerHTML = `
    <h3 style="margin:0 0 8px">Groups</h3>
    <div class="controls-row">
      <input id="group-name" placeholder="Group name e.g., Hyd Grind Gang" style="flex:1;min-width:220px" />
      <button id="create-group" class="btn btn-primary">+ Create Group</button>
      <button id="join-group" class="btn btn-ghost">Join via code</button>
    </div>
    <p class="muted small" style="margin-top:8px">Create → add members → copy share link → friends open link to sync (base64 in URL, no server).</p>
    <div id="groups-list" style="margin-top:12px"></div>
  `;
  root.appendChild(actions);

  const groupsData = loadGroups();

  function renderGroups(){
    const list = document.getElementById('groups-list');
    if (!groupsData.groups.length) { list.innerHTML='<div class="muted small">No groups yet. Create one above.</div>'; return; }
    list.innerHTML = groupsData.groups.map(g=>{
      const sorted = [...g.members].sort((a,b)=> b.solved - a.solved);
      const totalSolved = sorted.reduce((s,m)=> s+m.solved,0) || 1;
      return `
        <div class="card" style="padding:12px;margin:8px 0;border-left:4px solid ${sorted[0]?.color || '#ddd'}">
          <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;align-items:center">
            <div><b>${g.name}</b> <span class="muted small">#${g.id} • ${g.members.length} members • ${totalSolved} solves pooled</span></div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <button class="btn btn-ghost btn-sm" data-add="${g.id}">+ Add member</button>
              <button class="btn btn-ghost btn-sm" data-share="${g.id}">Copy share link</button>
              <button class="btn btn-ghost btn-sm" data-del="${g.id}" style="color:var(--danger)">Delete</button>
            </div>
          </div>
          <div class="member-pills" style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
            ${sorted.map(m=> `
              <span class="pill" style="border-color:${m.color};background:${m.color}14">
                <span style="display:inline-block;width:10px;height:10px;background:${m.color};border-radius:99px;margin-right:6px"></span>
                <b>${m.name}</b> ${m.solved} solves → ${Math.round(m.solved/totalSolved*100)}% 
                <button data-rm="${g.id}:${m.id}" style="margin-left:6px;border:none;background:transparent;cursor:pointer;color:var(--danger)">×</button>
              </span>`).join('')}
          </div>
          <div style="margin-top:12px">
            <div class="domain-grid" id="grid-${g.id}"></div>
            <div class="leaderboard" style="margin-top:10px">
              ${sorted.map((m,i)=> `
                <div class="lb-row" style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--bg)">
                  <span style="width:18px;text-align:center;font-weight:700">${i===0?'👑':i+1}</span>
                  <span style="width:14px;height:14px;background:${m.color};border-radius:3px"></span>
                  <span style="flex:1"><b>${m.name}</b> <span class="muted small">${m.solved} solved</span></span>
                  <span class="pill" style="font-size:11px">${computeTiles(m.solved,totalSolved)} tiles • ${Math.round(m.solved/totalSolved*100)}%</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    }).join('');
    // render grids
    setTimeout(()=>{
      for (const g of groupsData.groups) renderGrid(g);
    },0);
  }

  function renderGrid(group){
    const el = document.getElementById(`grid-${group.id}`);
    if (!el) return;
    const total = group.members.reduce((s,m)=> s+m.solved,0) || 1;
    const totalTiles = GRID*GRID;
    // compute tiles per member
    const allocations = group.members.map(m=> ({m, tiles: computeTiles(m.solved, total)}));
    // adjust rounding to exactly 100
    let sum = allocations.reduce((s,a)=> s+a.tiles,0);
    // sort biggest gets remainder
    allocations.sort((a,b)=> b.tiles - a.tiles);
    let diff = totalTiles - sum;
    let idx=0;
    while(diff!==0){
      allocations[idx % allocations.length].tiles += diff>0?1:-1;
      diff += diff>0?-1:1;
      idx++;
    }
    // build flat tile array
    const tiles=[];
    for (const a of allocations) for(let i=0;i<a.tiles;i++) tiles.push(a.m.color);
    // shuffle? No, fill row-wise blocks for visual ownership
    // We'll distribute blocks: group tiles into chunks
    el.className='domain-grid';
    el.style.cssText='display:grid;grid-template-columns:repeat(10,1fr);gap:3px;margin-top:8px';
    el.innerHTML = tiles.map(c=> `<div style="aspect-ratio:1;border-radius:4px;background:${c};border:1px solid rgba(0,0,0,.08)"></div>`).join('');
    el.title = `${total} solves pooled → ${GRID*GRID} tiles`;
  }

  function computeTiles(solved, total){
    if (total===0) return 0;
    return Math.round(solved/total * GRID*GRID);
  }

  renderGroups();

  // handlers
  actions.querySelector('#create-group').addEventListener('click', ()=>{
    const name = document.getElementById('group-name').value.trim() || `Squad ${uid()}`;
    const gid = uid();
    const newGroup = { id: gid, name, createdAt: new Date().toISOString().slice(0,10), members: [
      { id: uid(), name: myName, solved: mySolved, color: COLORS[0] }
    ]};
    groupsData.groups.push(newGroup);
    saveGroups(groupsData);
    renderGroups();
    toast(`Group "${name}" created (#${gid})`);
  });

  actions.querySelector('#join-group').addEventListener('click', ()=>{
    const code = prompt('Paste share code or full link (e.g., #group=...):');
    if (!code) return;
    tryImportCode(code);
  });

  actions.addEventListener('click', e=>{
    const add = e.target.closest('[data-add]');
    const share = e.target.closest('[data-share]');
    const del = e.target.closest('[data-del]');
    const rm = e.target.closest('[data-rm]');
    if (add){
      const gid=add.dataset.add;
      const g=groupsData.groups.find(x=> x.id===gid);
      if (!g) return;
      const name = prompt('Member name:') || `Player ${g.members.length+1}`;
      const solvedStr = prompt(`Solved count for ${name} (your friend's LeetCode total):`, "20");
      const solved = Math.max(0, Number(solvedStr)||0);
      const color = COLORS[g.members.length % COLORS.length];
      g.members.push({id: uid(), name, solved, color});
      saveGroups(groupsData); renderGroups();
    }
    if (share){
      const gid=share.dataset.share;
      const g=groupsData.groups.find(x=> x.id===gid);
      if (!g) return;
      const code = btoa(encodeURIComponent(JSON.stringify(g)));
      const link = `${location.origin}${location.pathname}#game&share=${code}`;
      // also short code fallback
      navigator.clipboard?.writeText(link).then(()=> toast('Share link copied!')).catch(()=>{
        prompt('Copy this link:', link);
      });
    }
    if (del){
      if (!confirm('Delete group?')) return;
      const gid=del.dataset.del;
      groupsData.groups = groupsData.groups.filter(x=> x.id!==gid);
      saveGroups(groupsData); renderGroups();
    }
    if (rm){
      const [gid, mid] = rm.dataset.rm.split(':');
      const g=groupsData.groups.find(x=> x.id===gid);
      if (!g) return;
      g.members = g.members.filter(m=> m.id!==mid);
      saveGroups(groupsData); renderGroups();
    }
  });

  function checkShareImport(){
    const hash = location.hash;
    if (hash.includes('share=')) {
      const code = hash.split('share=')[1].split('&')[0];
      setTimeout(()=> {
        if (confirm('Share link detected — import this group?')) tryImportCode(code);
      }, 300);
    }
  }
  function tryImportCode(raw){
    try{
      let code = raw;
      if (code.includes('share=')) code = code.split('share=')[1].split('&')[0];
      const jsonStr = decodeURIComponent(atob(code));
      const g = JSON.parse(jsonStr);
      if (!g.id || !g.members) throw new Error('invalid');
      // upsert
      const existing = loadGroups();
      const idx = existing.groups.findIndex(x=> x.id===g.id);
      if (idx>=0) existing.groups[idx]=g; else existing.groups.push(g);
      saveGroups(existing);
      toast(`Group "${g.name}" imported!`);
      location.hash='#game';
      setTimeout(()=> location.reload(), 700);
    }catch(err){ alert('Invalid share code: '+err.message); }
  }

  // explain
  const expl = document.createElement('div');
  expl.className='card pad small muted';
  expl.style.marginTop='14px';
  expl.innerHTML = `
    <b>Rules:</b> 1 solve = 1 tile potential. Group pools solves; share = your solves / total × 100 tiles. Biggest domain 👑. Updates instantly as you mark solves in Today/Ladder — or edit member counts here.<br>
    <b>Sharing (serverless):</b> Copy share link → friend opens → auto-imports group into <code>localStorage cc:v2:groups</code>. Send on WhatsApp/Telegram. No database, no account.
  `;
  root.appendChild(expl);
}

function toast(msg){
  let t=document.getElementById('toast');
  if(!t){ t=document.createElement('div'); t.id='toast'; t.className='toast'; document.body.appendChild(t); }
  t.textContent=msg; t.classList.add('show'); setTimeout(()=> t.classList.remove('show'), 2400);
}
