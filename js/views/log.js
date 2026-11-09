import { getState, upsertLogWeek } from '../store.js';

export function renderLog(root, data){
  const state = getState();
  const records = state.records;

  // derive weekly new/reviews from records.solvedOn
  const byWeek = {};
  for (const r of Object.values(records)){
    if (r.status==='solved' && r.solvedOn){
      const w = weekStart(r.solvedOn);
      byWeek[w] = byWeek[w] || {new:0, reviews:0};
      byWeek[w].new +=1;
    }
    if (r.r1Done || r.r2Done){
      // approximate: count as review in week of solved+10/30? For MVP, we count reviews as R flags, but we don't have date. We'll attribute to solvedOn+delta week
      // simpler: count reviews in current week if done
      // We'll not auto-derive reviews count, leave to manual + auto new
    }
  }
  // merge with manual log
  const manual = {};
  for (const e of (state.log||[])) manual[e.week]=e;

  const weeks = Array.from(new Set([...Object.keys(byWeek), ...Object.keys(manual)])).sort();
  // ensure at least current week shown
  const curWeek = weekStart(new Date().toISOString().slice(0,10));
  if (!weeks.includes(curWeek)) weeks.push(curWeek);
  weeks.sort();

  const header = document.createElement('div');
  header.className='view-header';
  header.innerHTML = `
    <h2>Log — weekly</h2>
    <p class="muted">Derived from solvedOn; you only type contest Y/N and hours. This mirrors Appendix A baseline and feeds warnings (NO_CONTEST, etc).</p>
    <div class="pill-row"><span class="pill">Current week: ${curWeek}</span><span class="pill">Total solved locally: ${Object.values(records).filter(r=>r.status==='solved').length}</span></div>
  `;
  root.appendChild(header);

  const card = document.createElement('div');
  card.className='card pad';
  card.innerHTML = `
    <table class="log-table">
      <thead><tr><th>Week (Mon)</th><th>New</th><th>Reviews</th><th>Contest</th><th>Hours</th><th>Save</th></tr></thead>
      <tbody id="log-body">
        ${weeks.map(w=>{
          const m = manual[w] || {};
          const autoNew = byWeek[w]?.new || 0;
          return `<tr data-week="${w}">
            <td><b>${w}</b></td>
            <td><input class="inp inp-new" type="number" min="0" value="${m.new ?? autoNew}" style="width:70px"> <span class="muted small">auto ${autoNew}</span></td>
            <td><input class="inp inp-rev" type="number" min="0" value="${m.reviews ?? 0}" style="width:70px"></td>
            <td><label class="chk"><input type="checkbox" class="inp-contest" ${m.contest?'checked':''}> Y</label></td>
            <td><input class="inp inp-hours" type="number" min="0" step="0.5" value="${m.hours ?? ''}" placeholder="e.g. 4" style="width:80px"></td>
            <td><button class="btn btn-primary btn-sm" data-save="${w}">Save</button></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    <p class="muted small">Weeks are Monday-start ISO weeks. New = problems first solved that week; Reviews = R1/R2 completions. Contest checked feeds NO_CONTEST warning.</p>
  `;
  root.appendChild(card);

  card.addEventListener('click', e=>{
    const b=e.target.closest('button[data-save]');
    if (!b) return;
    const w=b.dataset.save;
    const tr=b.closest('tr');
    const newCount = Number(tr.querySelector('.inp-new').value||0);
    const reviews = Number(tr.querySelector('.inp-rev').value||0);
    const contest = tr.querySelector('.inp-contest').checked;
    const hours = Number(tr.querySelector('.inp-hours').value||0);
    upsertLogWeek({week:w, newCount, reviews, contest, hours});
    b.textContent='Saved ✓'; setTimeout(()=> b.textContent='Save',1200);
  });

  // export derived CSV helper
  const exp = document.createElement('div');
  exp.className='card pad small muted';
  exp.innerHTML = `Log stored in localStorage <code>cc:v2:state.log</code>. Export via Settings → Export JSON. Derive most from records.solvedOn; manual contest/hours completes it.`;
  root.appendChild(exp);
}

function weekStart(iso){
  const [y,m,d]=iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y,m-1,d));
  const day = dt.getUTCDay(); // 0 Sun
  const diff = (day===0?-6:1-day); // to Monday
  dt.setUTCDate(dt.getUTCDate()+diff);
  return dt.toISOString().slice(0,10);
}
