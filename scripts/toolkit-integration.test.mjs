import test from 'node:test';
import assert from 'node:assert/strict';
import {makeD1,setSetting,seedGrant,apiRequest,PK,SK,JWT_PUBLIC_PEM,svixHeaders,WEBHOOK_SECRET} from './toolkit-testkit.mjs';
let mode='ok',calls=[];
globalThis.fetch=async(url,init)=>{
  url=typeof url==='string'?url:url.url;
  calls.push(url);
  if(url.includes('api.clerk.com')) return Response.json({errors:[{code:'service_unavailable',message:'fixture outage'}]},{status:503});
  if(url.includes('treg.people.enrich')) return Response.json({output:{full_name:'Casey Example',title:'Director',company:'Example'}},{headers:{'X-Treg-Cost-Micro':'1000'}});
  if(url.includes('treg.people.email.verify')) {
    if(mode==='timeout') throw new Error('fixture timeout');
    return Response.json({output:{status:'valid',valid:true}},{headers:{'X-Treg-Cost-Micro':'3000'}});
  }
  if(url.includes('alpha/decisions')) return Response.json({answers:{r0_icp:{type:'choice',choice:'possible'},r0_c0:{type:'choice',choice:'k1'}},usage:{cost:0.0005}});
  throw new Error('Unexpected network call '+url);
};
const {handleToolkit}=await import('../worker/toolkit.js');
function setup(){
  const db=makeD1();
  setSetting(db,'global_daily_cap_micro',1000000);
  setSetting(db,'default_daily_credit_cap',1000);
  setSetting(db,'default_daily_row_cap',1000);
  seedGrant(db,'user_a',1000);
  return {TOOLKIT_DB:db,CLERK_PUBLISHABLE_KEY:PK,CLERK_SECRET_KEY:SK,CLERK_JWT_KEY:JWT_PUBLIC_PEM,TREG_API_KEY:'fixture',JEV_API_KEY:'fixture'};
}
const body=()=>({action:'run',tool_id:'lead-scorer',request_id:crypto.randomUUID(),list_name:'Integration fixture',rows:[{name:'Casey Example',email:'casey@example.com'}],icp:'Directors',enrich:true,verify_email:true,max_credits:26,custom:[{id:'c0',label:'Priority',instructions:'Classify fit',type:'category',criteria:['Low','High']}]});
test('public config fails closed without a backend secret or a safe Clerk URL',async()=>{
  for(const override of [{CLERK_SECRET_KEY:''},{CLERK_JS_URL:'http://example.com/clerk.js'}]) {
    const env={...setup(),CLERK_JS_URL:'https://clerk.example.com/clerk.js',...override};
    const data=await (await handleToolkit(new Request('https://deependhq.com/api/toolkit/config'),env)).json();
    assert.equal(data.configured,false);
  }
});
test('request body has a streamed size limit even without Content-Length',async()=>{
  const req=apiRequest({action:'usage',padding:'x'.repeat(70000)});
  assert.equal(req.headers.get('content-length'),null);
  const res=await handleToolkit(req,setup());
  assert.equal(res.status,413);
});
test('transient billing lookup failure asks Clerk to retry instead of acknowledging a lost grant',async()=>{
  const env={...setup(),CLERK_WEBHOOK_SIGNING_SECRET:WEBHOOK_SECRET};
  setSetting(env.TOOLKIT_DB,'paid_plan_id','plan_pro');setSetting(env.TOOLKIT_DB,'paid_allowance_credits',100);
  const body=JSON.stringify({type:'subscriptionItem.active',data:{id:'si_fixture',payer_id:'user_a'}});
  const req=new Request('https://deependhq.com/api/toolkit/webhook',{method:'POST',headers:svixHeaders(body),body});
  const res=await handleToolkit(req,env);
  assert.equal(res.status,503);
  assert.equal(env.TOOLKIT_DB.query("SELECT count(*) c FROM toolkit_events WHERE type='receipt'").results[0].c,0);
});

test('real provider module agrees with wallet and custom-column contract',async()=>{
  mode='ok';calls=[];
  const env=setup(),request=body();
  const r=await handleToolkit(apiRequest(request),env),data=await r.json();
  assert.equal(r.status,200);assert.equal(data.status,'completed');
  assert.equal(data.spent_micro,1000+3000+500);
  assert.equal(data.credits_used,Math.ceil(data.spent_micro/1000));
  assert.equal(data.results[0].custom.c0.column_label,'Priority');
  assert.equal(data.results[0].custom.c0.label,'High');
  assert.equal(data.results[0].email_status,'deliverable');
  assert.equal(calls.length,3);
});
test('timeout retains paid partial evidence and a cost hold without buying a Jev retry',async()=>{
  mode='timeout';calls=[];
  const r=await handleToolkit(apiRequest(body()),setup()),data=await r.json();
  assert.equal(r.status,200);assert.equal(data.status,'held');
  assert.equal(data.results.length,1);
  assert.equal(data.results[0].evidence.title,'Director');
  assert.equal(data.results[0].icp_fit,'Unjudged');
  assert.equal(data.results[0].email_status,'unknown');
  assert.equal(data.results[0].custom.c0.column_label,'Priority');
  assert.equal(data.results[0].custom.c0.label,'Unjudged');
  assert.equal(data.spent_micro,1000);assert.equal(data.held_micro,10000);
  assert.equal(calls.length,2);
});
