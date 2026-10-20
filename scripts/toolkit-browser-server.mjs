// TEST-ONLY bridge: real toolkit API, real SQLite, real JWT verification.
// Browser Clerk and provider answers are explicit fixtures. No paid/network dispatch.
import http from 'node:http';
import {makeD1,setSetting,seedGrant,sessionToken,PK,SK,JWT_PUBLIC_PEM} from './toolkit-testkit.mjs';
const origin='http://127.0.0.1:3175';
const db=makeD1();
setSetting(db,'global_daily_cap_micro',1000000);
setSetting(db,'default_daily_credit_cap',1000);
setSetting(db,'default_daily_row_cap',1000);
seedGrant(db,'user_a',1000);
const env={TOOLKIT_DB:db,CLERK_PUBLISHABLE_KEY:PK,CLERK_SECRET_KEY:SK,CLERK_JWT_KEY:JWT_PUBLIC_PEM,CLERK_ADMIN_IDS:'user_a',TREG_API_KEY:'fixture',JEV_API_KEY:'fixture'};
let mode='ok';
const providerCalls=[];
globalThis.fetch=async(url,init)=>{
  url=typeof url==='string'?url:url.url;
  if(url.includes('api.clerk.com') && url.includes('/users/user_a')) return Response.json({object:'user',id:'user_a',email_addresses:[]});
  providerCalls.push(url);
  if(url.includes('treg.people.enrich')) return Response.json({output:{title:'Director',company:'Example'}},{headers:{'X-Treg-Cost-Micro':'1000'}});
  if(url.includes('treg.people.email.verify')) {
    if(mode==='timeout') throw new Error('fixture timeout');
    return Response.json({output:{status:'valid',valid:true}},{headers:{'X-Treg-Cost-Micro':'3000'}});
  }
  if(url.includes('alpha/decisions')) {
    const {questions}=JSON.parse(init.body);
    return Response.json({answers:Object.fromEntries(Object.keys(questions).map(k=>[k,{type:'choice',choice:k.endsWith('_icp')?'strong':'k1'}])),usage:{cost:0.0005}});
  }
  throw new Error('Forbidden unexpected network call: '+url);
};
const {handleToolkit}=await import('../worker/toolkit.js');
http.createServer(async(req,res)=>{
  try {
    if(req.url==='/fixture/reset' && req.method==='POST') {
      for(const table of ['toolkit_ops','toolkit_runs','toolkit_events','toolkit_accounts']) db.query('DELETE FROM '+table);
      seedGrant(db,'user_a',1000);mode='ok';providerCalls.length=0;res.end('ok');return;
    }
    if(req.url==='/fixture/token') {res.setHeader('content-type','application/json');res.end(JSON.stringify({token:sessionToken({azp:origin})}));return;}
    if(req.url==='/fixture/timeout') {mode='timeout';res.end('ok');return;}
    if(req.url==='/fixture/state') {res.setHeader('content-type','application/json');res.end(JSON.stringify({provider_calls:providerCalls,runs:db.query('SELECT * FROM toolkit_runs').results}));return;}
    if(req.url!=='/api/toolkit') {res.writeHead(404);res.end();return;}
    const parts=[];for await(const chunk of req) parts.push(chunk);
    const request=new Request(origin+req.url,{method:req.method,headers:req.headers,body:Buffer.concat(parts)});
    const result=await handleToolkit(request,env);
    res.writeHead(result.status,Object.fromEntries(result.headers));res.end(await result.text());
  } catch {res.writeHead(500);res.end('fixture_bridge_error');}
}).listen(3176,'127.0.0.1',()=>console.log('TEST ONLY: real API bridge listening on 3176'));
