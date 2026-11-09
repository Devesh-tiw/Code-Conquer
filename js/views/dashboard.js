export function renderDashboard(root, data){
  const user = data?.user;
  const ladder = data?.ladder;
  const problems = data?.problems;
  const state = JSON.parse(localStorage.getItem('cc:v2:state')||'{}');
  const records = state.records || {};

  if (!user) {
    root.innerHTML = `<div class="card pad">No LeetCode data yet. Run the sync workflow or check data/user.json. Showing seed baseline.</div>`;
  }

  const ac = user?.submitStatsGlobal?.acSubmissionNum || [];
  const all = ac.find(x=>x.difficulty==='All')?.count ?? 107;
  const easy = ac.find(x=>x.difficulty==='Easy')?.count ?? 63;
  const med = ac.find(x=>x.difficulty==='Medium')?.count ?? 39;
  const hard = ac.find(x=>x.difficulty==='Hard')?.count ?? 5;
  const ranking = user?.profile?.ranking ?? 1625079;
  const streak = user?.userCalendar?.streak ?? 24;
  const active = user?.userCalendar?.totalActiveDays ?? 96;
  const synced = user?._syncedAtIST || user?._syncedAt || 'never';
  const stale = data?.meta?.userStale?.days ?? 0;

  const header = document.createElement('div');
  header.className = 'view-header';
  header.innerHTML = `
    <h2>Dashboard</h2>
    <p class="muted">Live LeetCode vs local progress. Data as of <b>${synced}</b> ${stale>3?'<span style="color:var(--danger)">(stale)</span>':''}</p>
  `;
  root.appendChild(header);

  // stats cards
  const stats = document.createElement('div');
  stats.className='stats-row';
  stats.innerHTML = `
    <div class="stat-card"><span class="stat-label">Total Solved</span><span class="stat-value">${all}</span><span class="stat-sub">Easy ${easy} • Med ${med} • Hard ${hard}</span></div>
    <div class="stat-card streak"><span class="stat-label">Streak</span><span class="stat-value">${streak} 🔥</span><span class="stat-sub">${active} active days</span></div>
    <div class="stat-card"><span class="stat-label">Ranking</span><span class="stat-value">${Number(ranking).toLocaleString()}</span><span class="stat-sub">LeetCode global</span></div>
  `;
  root.appendChild(stats);

  // per-stage progress
  if (ladder?.stages){
    const wrap = document.createElement('div');
    wrap.className='card pad';
    wrap.innerHTML = `<h3>Stage Progress (local)</h3><p class="muted small">From ladder.json × your local records</p>`;
    const list = document.createElement('div');
    list.className='stage-progress-list';
    for (const s of ladder.stages){
      const total = s.problems.length;
      const solved = s.problems.filter(p=> records[p.id]?.status==='solved').length;
      const attempted = s.problems.filter(p=> records[p.id]?.status==='attempted').length;
      const pct = Math.round(solved/total*100);
      const row = document.createElement('div');
      row.className='stage-row';
      row.innerHTML = `
        <div class="stage-row-head">
          <span class="stage-name">${s.title}</span>
          <span class="stage-count">${solved}/${total} • ${attempted} attempted</span>
        </div>
        <div class="progress-container"><div style="width:${pct}%"></div></div>
        <div class="stage-meta small muted">${pct}% solved • ${s.description}</div>
      `;
      list.appendChild(row);
    }
    wrap.appendChild(list);
    root.appendChild(wrap);
  }

  // calendar heatmap mini
  if (user?.userCalendar?.submissionCalendar) {
    try {
      const cal = JSON.parse(user.userCalendar.submissionCalendar);
      const calWrap = document.createElement('div');
      calWrap.className='card pad';
      const entries = Object.entries(cal).sort((a,b)=> Number(a[0])-Number(b[0])).slice(-20);
      calWrap.innerHTML = `<h3>Recent activity</h3><div class="cal-grid">${entries.map(([ts,c])=>{
        const d=new Date(Number(ts)*1000).toISOString().slice(0,10);
        const lvl = c>=4?4:c>=2?2:1;
        return `<div class="cal-cell lvl-${lvl}" title="${d}: ${c} subs"><span>${d.slice(5)}</span><b>${c}</b></div>`;
      }).join('')}</div><p class="muted small">Submission calendar (counts per day, last 20 days)</p>`;
      root.appendChild(calWrap);
    } catch {}
  }

  // total catalogue info
  if (problems) {
    const p = document.createElement('div');
    p.className='card pad small muted';
    p.innerHTML = `Catalogue: totalLength ${problems.totalLength ?? '?'} • stored ${problems.storedCount ?? problems.questions?.length ?? '?'} • LeetCode problemsetQuestionListV2 (paidOnly flagged)`;
    root.appendChild(p);
  }
}
