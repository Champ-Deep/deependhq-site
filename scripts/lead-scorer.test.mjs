import test from 'node:test';
import assert from 'node:assert/strict';

const api = await import('../worker/lead-scorer.js').catch(() => ({}));
test('public run boundary rejects empty input before a provider can be called', () => {
  assert.equal(typeof api.validateLeadInput, 'function', 'input validation must exist');
  assert.throws(() => api.validateLeadInput({rows: []}), /rows/i);
});

const base = () => ({rows:[{name:'Test Person',email:'person@example.com',title:'Director',company:'Example'}],icp:'Technology directors',enrich:true,verify_email:true,custom:[]});
test('quote reserves provider ceilings in integers and charges no email lookup for blank emails', () => {
  assert.equal(typeof api.quoteLead,'function');
  const input=api.validateLeadInput(base());
  assert.equal(api.quoteLead(input).max_cost_micro,26000);
  assert.equal(api.quoteLead(input).max_credits,26);
  input.rows[0].email=''; input.enrich=false;
  assert.equal(api.quoteLead(input).max_cost_micro,10000);
  input.rows=Array.from({length:5},()=>({email:'a@example.com'})); input.enrich=true;
  assert.equal(api.quoteLead(input).max_cost_micro,90000);
});
test('email evidence comes from a bounded Treg call and Jev questions are batched once', async () => {
  assert.equal(typeof api.executeLead,'function');
  const input=api.validateLeadInput({...base(),enrich:false,custom:[{id:'c0',label:'Priority',type:'score',instructions:'Rate the supplied row',criteria:['Low','High']}]});
  const requests=[],charges=[];
  const fetcher=async(url,init)=>{
    requests.push({url,init,body:JSON.parse(init.body)});
    if(url.includes('treg.to')) return Response.json({output:{status:'valid',valid:true,checked:true},_treg:{served_by:'fixture-verifier'}},{headers:{'X-Treg-Cost-Micro':'1500','X-Treg-Call-Id':'fixture-call'}});
    return Response.json({answers:{r0_icp:{type:'choice',choice:'strong'},r0_c0:{type:'score',score:1,probabilities:{'0':0,'1':1}}},usage:{cost:0.00002}});
  };
  const results=await api.executeLead(input,{tregKey:'test-only',jevKey:'test-only',fetcher,call:async(meta,perform)=>{charges.push(meta);return perform();}});
  assert.equal(requests.length,2);
  assert.equal(requests[0].init.headers['X-Treg-Route-Max-Cost'],'0.01');
  assert.equal(requests[0].init.headers['X-Treg-Route-Waterfall'],'0');
  assert.equal(results[0].email_status,'deliverable');
  assert.equal(results[0].icp_fit,'Strong fit');
  assert.deepEqual(results[0].custom.c0,{column_label:'Priority',label:'High',index:1});
  assert.equal(charges[0].reserve_micro,10000);
  assert.equal(charges[1].provider,'jev');
});

test('malformed Jev answer types and inherited keys never become a score', async () => {
  const input=api.validateLeadInput({...base(),enrich:false,verify_email:false,custom:[{id:'c0',label:'Type',type:'category',instructions:'Categorize',criteria:['One','Two']}]});
  for(const choice of ['__proto__','strong']) {
    const results=await api.executeLead(input,{jevKey:'fixture',fetcher:async()=>Response.json({answers:{r0_icp:{type:'noul',choice},r0_c0:{type:'noul',choice:'k0'}},usage:{cost:0}}),call:async(_,f)=>f()});
    assert.equal(results[0].icp_fit,'Unjudged');
    assert.equal(results[0].custom.c0.label,'Unjudged');
  }
});

test('catch-all and missing costs cannot be reported as deliverable or free', async () => {
  for(const [output,expected] of [
    [{status:'accept_all',valid:true},'risky'],
    [{status:'unknown',valid:false},'unknown'],
    [{status:'valid',valid:true,checked:false},'not_checked'],
    [{status:'invalid',valid:false},'undeliverable'],
    [{status:'valid',valid:false},'unknown'],
    [null,'not_checked'],
  ]) {
    const input=api.validateLeadInput({...base(),enrich:false});
    const result=await api.executeLead(input,{tregKey:'fixture',jevKey:'fixture',fetcher:async url=>url.includes('treg.to')?Response.json({output},{headers:{'X-Treg-Cost-Micro':'0'}}):Response.json({answers:{},usage:{cost:0}}),call:async(_,f)=>f()});
    assert.equal(result[0].email_status,expected);
    assert.equal(result[0].icp_fit,'Unjudged');
  }
  let calls=0,record;
  await assert.rejects(()=>api.executeLead(api.validateLeadInput(base()),{tregKey:'fixture',jevKey:'fixture',fetcher:async()=>{calls++;throw new Error('timeout');},call:async(_,f)=>{record=await f();return record;}}),/reconciliation/);
  assert.equal(calls,1); assert.equal(record.cost_micro,null);
});

test('enrichment with a different identity is discarded and no hidden retry is bought', async () => {
  const input=api.validateLeadInput({...base(),verify_email:false});
  let requests=0,jevBody;
  const result=await api.executeLead(input,{tregKey:'fixture',jevKey:'fixture',fetcher:async(url,init)=>{
    requests++;
    if(url.includes('treg.to')) return Response.json({output:{name:'Another Person',title:'CEO',company:'Elsewhere'}},{headers:{'X-Treg-Cost-Micro':'600'}});
    jevBody=JSON.parse(init.body);return Response.json({answers:{},usage:{cost:0.00002}});
  },call:async(_,f)=>f()});
  assert.equal(requests,2); assert.equal(result[0].enrichment_status,'not_found');
  assert.deepEqual(jevBody.state.rows[0].evidence,{});
});

test('missing provider credentials cause zero dispatches', async () => {
  let calls=0;
  await assert.rejects(()=>api.executeLead(api.validateLeadInput(base()),{call:()=>{calls++;}}),/not configured/);
  assert.equal(calls,0);
});

test('input limits preserve arbitrary uploaded fields but reject hostile and unbounded values', () => {
  const body=base(); body.rows[0].region='Europe';
  assert.equal(api.validateLeadInput(body).rows[0].region,'Europe');
  for (const change of [
    b=>b.rows.push(...Array.from({length:5},()=>({name:'Another'}))),
    b=>b.rows[0].email='not an email',
    b=>b.rows[0].linkedin='http://localhost/admin',
    b=>b.rows[0].name={nested:'no'},
    b=>b.rows[0].company='x'.repeat(1001),
    b=>b.icp='x'.repeat(2001),
    b=>b.enrich='false',
    b=>b.custom=[{id:'__proto__',type:'score',label:'x',instructions:'x',criteria:['a','b']}],
    b=>b.custom=[{id:'c0',type:'category',label:'x',instructions:'x',criteria:['a','a']}],
  ]) {
    const input=base(); change(input); assert.throws(()=>api.validateLeadInput(input));
  }
});
