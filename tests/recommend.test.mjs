import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { recommend } from '../js/recommend.js';

// minimal ladder 2 stages for tests
const ladder = {
  stages: [
    { key:'s00', title:'Stage 0 — Foundations', description:'', problems:[
      {id:'1', title:'Two Sum', titleSlug:'two-sum', difficulty:'Easy'},
      {id:'2', title:'Add Two Numbers', titleSlug:'add-two-numbers', difficulty:'Medium'},
      {id:'3', title:'Longest Substring', titleSlug:'longest-substring-without-repeating-characters', difficulty:'Medium'},
    ]},
    { key:'s01', title:'Stage 1 — Two Pointers', description:'', problems:[
      {id:'11', title:'Container With Most Water', titleSlug:'container-with-most-water', difficulty:'Medium'},
      {id:'15', title:'3Sum', titleSlug:'3sum', difficulty:'Medium'},
    ]},
  ]
};

describe('recommend — spec', ()=>{
  it('empty state => first 2 of Stage 0', ()=>{
    const res = recommend({ records:{}, ladder, todayISO:'2026-11-10', settings:{newPerDay:2, reviewsPerDay:2}});
    assert.equal(res.tasks.length, 2);
    assert.equal(res.tasks[0].type, 'new');
    assert.equal(res.tasks[0].problemId, '1');
    assert.equal(res.tasks[1].problemId, '2');
    assert.equal(res.stats.currentStage, 's00');
  });

  it('stage gate never leaking', ()=>{
    const records = {
      '1': {status:'solved', confidence:4, solvedOn:'2026-11-01', r1Done:true, r2Done:true, attempts:1},
      '2': {status:'solved', confidence:4, solvedOn:'2026-11-02', r1Done:true, r2Done:true, attempts:1},
      // stage 0 still has one unsolved (id 3)
    };
    const res = recommend({ records, ladder, todayISO:'2026-11-10', settings:{newPerDay:2, reviewsPerDay:2}});
    // current stage still s00 because '3' not solved
    assert.equal(res.stats.currentStage, 's00');
    // new tasks must be from s00 only, not s01
    const newTasks = res.tasks.filter(t=> t.type==='new');
    assert.ok(newTasks.every(t=> t.stageKey==='s00'), 'should not leak to s01');
    assert.equal(newTasks[0].problemId, '3');
  });

  it('due queue exactly at +10 and +30 boundaries', ()=>{
    const records = {
      '206': {status:'solved', confidence:2, solvedOn:'2026-11-01', r1Done:false, r2Done:false, attempts:2, notes:'lost dummy-node'},
      '1':   {status:'solved', confidence:4, solvedOn:'2026-11-01', r1Done:false, r2Done:false, attempts:1},
    };
    // today = 2026-11-11 => both R1 due exactly
    const res = recommend({ records, ladder: {stages:[{key:'s00', title:'S0', description:'', problems:[{id:'206',title:'Reverse List',titleSlug:'reverse-linked-list',difficulty:'Easy'},{id:'1',title:'Two Sum',titleSlug:'two-sum',difficulty:'Easy'}]}]}, todayISO:'2026-11-11', settings:{newPerDay:2, reviewsPerDay:2}});
    assert.equal(res.stats.dueCount, 2);
    // lowest confidence first: 206 (conf2) before 1 (conf4)
    assert.equal(res.tasks[0].problemId, '206');
    assert.equal(res.tasks[1].problemId, '1');
    // reason includes notes
    assert.match(res.tasks[0].reason, /lost dummy-node/);
  });

  it('ranking order: confidence, overdue, attempts, notes', ()=>{
    const records = {
      'a': {status:'solved', confidence:1, solvedOn:'2026-10-01', r1Done:false, r2Done:false, attempts:1, notes:''}, // very overdue
      'b': {status:'solved', confidence:3, solvedOn:'2026-11-05', r1Done:false, r2Done:false, attempts:2, notes:'trick'},
      'c': {status:'solved', confidence:5, solvedOn:'2026-11-05', r1Done:false, r2Done:false, attempts:1},
    };
    const lad = {stages:[{key:'s00', title:'S0', description:'', problems:[{id:'x',title:'X',titleSlug:'x',difficulty:'Easy'}]}]};
    const res = recommend({ records, ladder: lad, todayISO:'2026-11-15', settings:{newPerDay:2, reviewsPerDay:2}});
    // a: (6-1)*10=50 + overdue 10 capped? Actually overdue from 2026-10-11 to 2026-11-15 = 35 capped 30 => 80, attempts0, notes0 =>80
    // b: (6-3)*10=30 + 0? Wait solved 2026-11-05 r1due 2026-11-15 => 0 overdue =>30+5+3=38
    // c: (6-5)*10=10 +0 =>10
    // so order a > b > c
    assert.equal(res.tasks[0].problemId, 'a');
    assert.equal(res.tasks[1].problemId, 'b');
  });

  it('warnings: DUE_OVERFLOW, DRIFT, CONFIDENCE_LOW, STAGE_STALL', ()=>{
    // build 9 due -> overflow
    const records = {};
    for(let i=0;i<9;i++) records[`id${i}`]={status:'solved', confidence:3, solvedOn:'2026-10-01', r1Done:false, r2Done:false, attempts:1};
    // drift
    const lad2 = ladder;
    global.localStorage = { getItem:()=> null }; // mock for NO_CONTEST check
    let res = recommend({ records, ladder: lad2, todayISO:'2026-11-15', settings:{newPerDay:2, reviewsPerDay:2}});
    assert.ok(res.warnings.some(w=> w.code==='DUE_OVERFLOW'), 'DUE_OVERFLOW');
    // drift: last solved 2026-10-01 to 2026-11-15 =45 days >5
    assert.ok(res.warnings.some(w=> w.code==='DRIFT'), 'DRIFT');

    // CONFIDENCE_LOW >40% with <=2
    const rec2 = {};
    for(let i=0;i<10;i++) rec2[`k${i}`] = {status:'solved', confidence: i<5?1:4, solvedOn:'2026-11-10', r1Done:false, r2Done:false, attempts:1};
    res = recommend({ records: rec2, ladder: lad2, todayISO:'2026-11-10', settings:{newPerDay:2, reviewsPerDay:2}});
    assert.ok(res.warnings.some(w=> w.code==='CONFIDENCE_LOW'));

    // STAGE_STALL — current stage no solves in 10 days
    const stallRecords = {
      '1': {status:'solved', confidence:4, solvedOn:'2026-10-01', r1Done:true, r2Done:true, attempts:1},
      // '2' and '3' unsolved, but stage stall should check last solved in stage
    };
    res = recommend({ records: stallRecords, ladder, todayISO:'2026-11-20', settings:{newPerDay:2, reviewsPerDay:2}});
    assert.ok(res.warnings.some(w=> w.code==='STAGE_STALL'));
  });

  it('warnings not firing when not applicable', ()=>{
    const records = { '1': {status:'solved', confidence:5, solvedOn:'2026-11-10', r1Done:false, r2Done:false, attempts:1}};
    global.localStorage = { getItem:()=> JSON.stringify({log:[{week:'2026-11-10', contest:true}]}) };
    const res = recommend({ records, ladder, todayISO:'2026-11-11', settings:{newPerDay:2, reviewsPerDay:2}});
    assert.equal(res.warnings.filter(w=> w.code==='DUE_OVERFLOW').length, 0);
  });

  it('3 solved records backdated 40 days, confidence1 — all due, lowest first', ()=>{
    const records = {
      '1': {status:'solved', confidence:1, solvedOn:'2026-10-01', r1Done:false, r2Done:false, attempts:1},
      '2': {status:'solved', confidence:2, solvedOn:'2026-10-01', r1Done:false, r2Done:false, attempts:1},
      '3': {status:'solved', confidence:3, solvedOn:'2026-10-01', r1Done:false, r2Done:false, attempts:1},
    };
    const lad = {stages:[{key:'s00',title:'S0',description:'', problems:[{id:'99',title:'New',titleSlug:'new',difficulty:'Easy'}]}]};
    const res = recommend({ records, ladder: lad, todayISO:'2026-11-15', settings:{newPerDay:2, reviewsPerDay:2}});
    assert.equal(res.stats.dueCount, 3);
    // lowest confidence ranked first (score higher)
    assert.equal(res.tasks[0].problemId, '1');
  });
});
