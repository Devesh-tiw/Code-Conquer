// Topic Audit — two columns: LeetCode says you solved X vs interview weights
const WEIGHTS = {
  "Array": 0.20,
  "Tree": 0.25, "Binary Tree": 0.25,
  "Graph": 0.20, "Breadth-First Search":0.20, "Depth-First Search":0.20,
  "Dynamic Programming": 0.15,
  "Linked List": 0.10,
  "Stack": 0.10, "Queue":0.10, "Monotonic Stack":0.10,
  "Heap (Priority Queue)":0.08, "Heap":0.08,
  "Binary Search":0.12,
  "Hash Table":0.15,
  "Sliding Window":0.10,
  "Two Pointers":0.10,
  "Backtracking":0.06,
  "Bit Manipulation":0.04,
  "Math":0.04,
  "Greedy":0.06,
  "Union Find":0.05,
  "Trie":0.04,
  "String":0.10,
  "Sorting":0.05,
  "Recursion":0.05
};

export function renderAudit(root, data){
  const user = data?.user;
  const tagCounts = user?.tagProblemCounts;
  if (!tagCounts) { root.innerHTML='<div class="card pad">No tagProblemCounts yet. Need first sync.</div>'; return; }

  // flatten
  const solvedByTag = {};
  for (const bucket of ['fundamental','intermediate','advanced']){
    for (const e of (tagCounts[bucket]||[])) solvedByTag[e.tagName] = e.problemsSolved;
  }

  const allTags = Array.from(new Set([...Object.keys(solvedByTag), ...Object.keys(WEIGHTS)])).sort((a,b)=> (WEIGHTS[b]||0)-(WEIGHTS[a]||0));

  const header = document.createElement('div');
  header.className='view-header';
  header.innerHTML = `
    <h2>Topic Audit</h2>
    <p class="muted">Left: LeetCode says you solved X (from <code>tagProblemCounts</code>). Right: interview weight (hardcoded Appendix B). Weights overlap intentionally.</p>
    <p class="muted small">Flags: <span class="flag flag-zero">ZERO</span> = you have 0 in a high-weight topic. <span class="flag flag-over">OVER_INVESTED</span> = high count in low-weight while high-weight is zero.</p>
  `;
  root.appendChild(header);

  const card = document.createElement('div');
  card.className='card pad';
  card.innerHTML = `
    <div class="audit-grid">
      <div class="audit-head">Topic</div><div class="audit-head">Solved (LeetCode)</div><div class="audit-head">Interview Weight</div><div class="audit-head">Flag</div>
      ${allTags.map(tag=>{
        const solved = solvedByTag[tag] ?? 0;
        const weight = WEIGHTS[tag] ?? 0;
        const wLabel = weight ? weight.toFixed(2) : '—';
        // determine flag
        let flag='';
        if (solved===0 && weight>=0.15) flag='<span class="flag flag-zero">ZERO</span>';
        else if (solved===0 && weight>=0.08) flag='<span class="flag flag-zero">ZERO</span>';
        // OVER_INVESTED: high count (>20) in low-weight (<0.06) while any high-weight zero exists
        const hasHighWeightZero = Object.entries(WEIGHTS).some(([k,w])=> w>=0.15 && (solvedByTag[k]||0)===0);
        if (flag==='' && solved>20 && weight<0.06 && hasHighWeightZero) flag='<span class="flag flag-over">OVER_INVESTED</span>';
        else if (flag==='' && solved>15 && weight===0.04 && hasHighWeightZero) flag='<span class="flag flag-over">OVER_INVESTED</span>';
        const bar = weight ? `<div class="mini-bar"><div style="width:${weight*400}%"></div></div>` : '';
        return `
          <div class="audit-cell">${tag}</div>
          <div class="audit-cell"><b>${solved}</b></div>
          <div class="audit-cell">${wLabel} ${bar}</div>
          <div class="audit-cell">${flag}</div>
        `;
      }).join('')}
    </div>
  `;
  root.appendChild(card);

  // summary insights
  const zeroHigh = Object.entries(WEIGHTS).filter(([k,w])=> w>=0.15 && (solvedByTag[k]||0)===0).map(([k])=>k);
  const insight = document.createElement('div');
  insight.className='card pad';
  insight.innerHTML = `
    <h3>Insights</h3>
    <ul class="small">
      ${zeroHigh.length ? `<li><b>Fix ZERO first:</b> ${zeroHigh.join(', ')} — these are ~${zeroHigh.length*20}% of Indian product-company loops but you have 0.</li>` : '<li>No high-weight ZERO topics. Good.</li>'}
      <li>Baseline 9 Nov 2026: 107 total (63E/39M/5H), Array 43 strong, Tree/Graph/Heap at 0 — that's the gap this audit was built to surface.</li>
      <li>Use Today view to pull from Tree/Graph stages — weights don't lie.</li>
    </ul>
  `;
  root.appendChild(insight);
}
