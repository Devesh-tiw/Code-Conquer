import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, diffDays, r1Due, r2Due, isDue, overdueDays } from '../js/sr.js';

describe('sr — date math', ()=>{
  it('addDays handles month boundary', ()=>{
    assert.equal(addDays('2026-11-24', 10), '2026-12-04');
    assert.equal(addDays('2026-01-31', 1), '2026-02-01');
  });
  it('diffDays correct', ()=>{
    assert.equal(diffDays('2026-11-24','2026-12-04'),10);
    assert.equal(diffDays('2026-12-04','2026-11-24'),-10);
  });
  it('due boundaries at exactly +10 and +30 inclusive', ()=>{
    const rec = { status:'solved', solvedOn:'2026-11-01', r1Done:false, r2Done:false };
    assert.equal(r1Due(rec),'2026-11-11');
    assert.equal(r2Due(rec),'2026-12-01');
    // day before due -> not due
    assert.equal(isDue(rec,'2026-11-10'), false);
    // exactly on due -> due
    assert.equal(isDue(rec,'2026-11-11'), true);
    assert.equal(overdueDays(rec,'2026-11-11'),0);
    assert.equal(overdueDays(rec,'2026-11-13'),2);
    // after r1 done, r2 window
    rec.r1Done=true;
    assert.equal(isDue(rec,'2026-11-20'), false);
    assert.equal(isDue(rec,'2026-12-01'), true);
    assert.equal(isDue(rec,'2026-12-10'), true);
    // both done -> never due
    rec.r2Done=true;
    assert.equal(isDue(rec,'2027-01-01'), false);
  });

  it('overdue caps not applied here (capped in recommend)', ()=>{
    const rec={status:'solved', solvedOn:'2026-01-01', r1Done:false, r2Done:false};
    assert.equal(overdueDays(rec,'2026-03-01'), 49);
  });

  it('non-solved never due', ()=>{
    assert.equal(isDue({status:'attempted', solvedOn:'2026-11-01', r1Done:false},'2026-12-01'), false);
    assert.equal(isDue({status:'not_started'},'2026-12-01'), false);
  });
});
