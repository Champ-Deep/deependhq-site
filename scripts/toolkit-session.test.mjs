import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.window={Clerk:{session:{getToken:async()=> 'fixture-token'}}};
const {api}=await import('../toolkit-session.js');
test('settled failed and held runs keep their results and cost ledger visible',async()=>{
  for(const status of ['failed','held']){
    const result={id:'fixture-run',status,error:'Provider unavailable',results:[{icp_fit:'Unjudged'}],spent_micro:1000,held_micro:10000};
    globalThis.fetch=async()=>Response.json(result);
    assert.deepEqual(await api('run',{}),result);
    assert.deepEqual(await api('run_detail',{}),result);
  }
  globalThis.fetch=async()=>Response.json({error:'forbidden'},{status:403});
  await assert.rejects(()=>api('usage',{}),/forbidden/);
});
