import * as session from './toolkit-session.js';
import {parseCsv,parseXlsx,guessMapping,chunk,toCsv,MAX_FILE_BYTES} from './toolkit-lib.js';
import {money,validateFileTable,quoteSummary,resultRows,scanText} from './toolkit-workbench-lib.js';
const $ = s => document.querySelector(s);
function el(tag, text, cls) { const n=document.createElement(tag); if(text!==undefined)n.textContent=text; if(cls)n.className=cls; return n; }
function button(text,fn,cls) { const n=el('button',text,cls);n.type='button';n.addEventListener('click',fn);return n; }
function field(label, control) { const n=el('label',label);control.setAttribute('aria-label',label);n.append(control);return n; }
function input(value='',type='text') { const n=el('input');n.type=type;n.value=value;return n; }
function select(options,value) { const n=el('select');for(const [v,t] of options)n.append(new Option(t,v));if(value!==undefined)n.value=value;return n; }
function table(headers,rows) {const wrap=el('div',undefined,'table-scroll');wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label','Scrollable data table');const t=el('table'),head=el('thead'),tr=el('tr');headers.forEach(h=>tr.append(el('th',h)));head.append(tr);t.append(head);const body=el('tbody');rows.forEach(row=>{const r=el('tr');row.forEach(v=>{const cell=el('td');cell.append(v instanceof Node?v:document.createTextNode(String(v??'')));r.append(cell);});body.append(r);});t.append(body);wrap.append(t);return wrap;}
function notice(root,text,bad=false){const n=el('p',text,'notice'+(bad?' bad':''));n.setAttribute('role',bad?'alert':'status');root.append(n);return n;}
const OP_LABEL={enrich:'Enrich',verify_email:'Verify email',classify:'Classify',verify:'Yes/no check'},ENGINE_LABEL={treg:'Treg: enrichment data',jev:'Jev: calibrated judge (default)',deepseek:'DeepSeek Flash: cheaper, for simple calls'};
const errorText=e=>e.data?.message||({provider_not_configured:'Setup needed. The selected provider is not configured. Nothing was sent to that provider.',insufficient_credits:'Your balance is too low. Ask an administrator for credits.',daily_credit_cap:'Daily spending allowance reached. Return after the UTC day resets.',global_daily_cap:'The shared daily budget is exhausted. Ask an administrator.'}[e.message]||e.message);
const apps=[['workbench','Data Workbench','M4 4h24v24H4z M4 12h24 M12 4v24'],['beam','ChampBeam','M4 16h24 M18 6l10 10-10 10'],['pdf','ChamPDF','M8 3h11l6 6v20H8z M18 3v8h7 M12 17h9 M12 22h9'],['account','Account','M21 10a5 5 0 1 1-10 0a5 5 0 1 1 10 0 M6 29v-5a10 10 0 0 1 20 0v5'],['scanner','Deep Scanner','M16 3l11 5v8c0 7-11 13-11 13S5 23 5 16V8z M11 16l4 4 7-9'],['admin','Admin','M4 8h24 M4 16h24 M4 24h24 M11 4v8 M21 12v8 M14 20v8']];
let usage=null,config=null,top=10,active=null,authEpoch=0;
const windows=new Map();
const launchers=new Map();
function icon(path){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 32 32');svg.setAttribute('aria-hidden','true');const p=document.createElementNS(svg.namespaceURI,'path');p.setAttribute('d',path);p.setAttribute('fill','none');p.setAttribute('stroke','currentColor');p.setAttribute('stroke-width','1.5');p.setAttribute('stroke-linejoin','round');svg.append(p);return svg;}
function setActive(id){active=id;for(const [key,w] of windows){w.node.dataset.focused=String(key===id);w.node.inert=innerWidth<=768&&key!==id;}if(id){const w=windows.get(id);w.node.hidden=false;w.node.style.zIndex=String(++top);w.node.dataset.focused='true';}for(const n of document.querySelectorAll('.menubar,.desktop-intro,#app-launcher'))n.inert=innerWidth<=768&&!!id;}
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(Math.max(lo,hi),v));
addEventListener('resize',()=>{setActive(active);if(innerWidth>768)for(const w of windows.values())if(w.node.style.left){const r=w.node.getBoundingClientRect();w.position(r.x,r.y);}});
function closeWindow(id){const w=windows.get(id);w?.cleanup?.();w?.node.remove();windows.delete(id);launchers.get(id).dataset.open='false';setActive([...windows].reverse().find(([,v])=>!v.node.hidden)?.[0]||null);launchers.get(id).focus();}
function openApp(id){
  if((id==='admin'||id==='scanner')&&!usage?.user.is_admin)return;
  if(windows.has(id)){setActive(id);windows.get(id).node.querySelector('button').focus();return;}
  const app=apps.find(a=>a[0]===id),node=el('section',undefined,'window');node.dataset.app=id;node.setAttribute('aria-label',app[1]);
  const header=el('div',undefined,'window-header'),title=el('h2',app[1],'window-title');header.append(title);
  const move=button('Move',()=>{move.focus();notice(body,'Use arrow keys on Move to reposition this window.');});move.setAttribute('aria-label','Move '+app[1]+' with arrow keys');
  function position(x,y){node.style.left=clamp(x,0,innerWidth-node.offsetWidth)+'px';node.style.top=clamp(y,64,innerHeight-node.offsetHeight)+'px';}
  move.addEventListener('keydown',e=>{const delta={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]}[e.key];if(delta&&innerWidth>768){e.preventDefault();const r=node.getBoundingClientRect();position(r.x+delta[0],r.y+delta[1]);}});
  header.append(move,button('−',()=>{node.hidden=true;setActive([...windows].reverse().find(([,v])=>!v.node.hidden)?.[0]||null);launchers.get(id).focus();}),button('×',()=>closeWindow(id)));
  header.children[2].setAttribute('aria-label','Minimize '+app[1]);header.children[3].setAttribute('aria-label','Close '+app[1]);
  const body=el('div',undefined,'window-body');node.append(header,body);$('#windows').append(node);
  const w={node,body,position};windows.set(id,w);setActive(id);launchers.get(id).dataset.open='true';
  node.addEventListener('pointerdown',()=>setActive(id));node.addEventListener('focusin',()=>setActive(id));
  let drag=null;header.addEventListener('pointerdown',e=>{if(e.target.closest('button')||innerWidth<=768)return;const r=node.getBoundingClientRect();drag=[e.clientX-r.x,e.clientY-r.y];header.setPointerCapture(e.pointerId);});header.addEventListener('pointermove',e=>{if(drag)position(e.clientX-drag[0],e.clientY-drag[1]);});header.addEventListener('pointerup',()=>drag=null);header.addEventListener('pointercancel',()=>drag=null);
  if(id==='workbench')workbench(w);
  if(id==='beam'||id==='pdf')embedded(w,id);
  if(id==='scanner')scanner(w);
  if(id==='account')account(w);
  if(id==='admin')admin(w);
  header.children[3].focus();
}
const desktopIcons=new Map();
for(const [id,name,path] of apps){const b=button('',()=>openApp(id));b.dataset.launch=id;b.dataset.open='false';const sym=el('span',undefined,'app-icon');sym.append(icon(path));b.append(sym,el('span',name));if(id==='admin'||id==='scanner')b.hidden=true;$('#app-launcher').append(b);launchers.set(id,b);
 const d=button('',()=>{for(const x of desktopIcons.values())x.dataset.selected=String(x===d);});d.dataset.desktop=id;d.dataset.selected='false';d.setAttribute('aria-label',name+'. Double click or press Enter to open');const ds=el('span',undefined,'app-icon');ds.append(icon(path));d.append(ds,el('span',name));d.hidden=b.hidden;d.addEventListener('dblclick',()=>openApp(id));d.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();openApp(id);}const step={ArrowUp:-1,ArrowLeft:-1,ArrowDown:1,ArrowRight:1}[e.key];if(step){e.preventDefault();const list=[...desktopIcons.values()].filter(x=>!x.hidden);list[(list.indexOf(d)+step+list.length)%list.length].focus();}});dragIcon(d);$('#desktop-icons').append(d);desktopIcons.set(id,d);}
// Icon positions are offsets from the icon's slot in the column, saved per signed-in user.
function iconKey(){return 'dh_toolkit_icons:'+(session.authState().userId||'guest');}
function loadIcons(){let saved={};try{saved=JSON.parse(localStorage.getItem(iconKey())||'{}');}catch{}for(const [id,d] of desktopIcons){const p=saved[id];d.style.translate=Array.isArray(p)?p[0]+'px '+p[1]+'px':'';}}
function saveIcons(){const out={};for(const [id,d] of desktopIcons){const [x=0,y=0]=d.style.translate.split(' ').map(v=>parseFloat(v)||0);if(x||y)out[id]=[x,y];}try{localStorage.setItem(iconKey(),JSON.stringify(out));}catch{}}
function dragIcon(d){let drag=null;
 d.addEventListener('pointerdown',e=>{if(innerWidth<=768||e.button!==0)return;const [tx=0,ty=0]=d.style.translate.split(' ').map(v=>parseFloat(v)||0),r=d.getBoundingClientRect();drag={sx:e.clientX,sy:e.clientY,tx,ty,left:r.left-tx,top:r.top-ty,w:r.width,h:r.height,moved:false};d.setPointerCapture(e.pointerId);});
 d.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.sx,dy=e.clientY-drag.sy;if(!drag.moved&&Math.hypot(dx,dy)<4)return;drag.moved=true;d.dataset.dragging='true';d.style.translate=clamp(drag.tx+dx,-drag.left,innerWidth-drag.w-drag.left)+'px '+clamp(drag.ty+dy,64-drag.top,innerHeight-drag.h-drag.top)+'px';});
 const end=()=>{if(drag?.moved)saveIcons();drag=null;delete d.dataset.dragging;};d.addEventListener('pointerup',end);d.addEventListener('pointercancel',end);
}
loadIcons();
// Drop zones light up under a file drag and keep the drop to themselves.
function dropTarget(zone,onFiles){zone.addEventListener('dragover',e=>{e.preventDefault();e.stopPropagation();delete $('#main').dataset.drop;zone.dataset.over='true';});zone.addEventListener('dragleave',e=>{if(!zone.contains(e.relatedTarget))zone.dataset.over='false';});zone.addEventListener('drop',e=>{e.preventDefault();e.stopPropagation();zone.dataset.over='false';onFiles(e.dataTransfer.files);});}
// A CSV or XLSX dropped anywhere else on the desktop opens Data Workbench with it loaded.
addEventListener('dragover',e=>{if(!e.dataTransfer?.types.includes('Files'))return;e.preventDefault();$('#main').dataset.drop='true';});
addEventListener('dragleave',e=>{if(!e.relatedTarget)delete $('#main').dataset.drop;});
addEventListener('drop',e=>{e.preventDefault();delete $('#main').dataset.drop;const f=e.dataTransfer?.files[0];if(!f)return;if(!/\.(csv|xlsx)$/i.test(f.name)){$('#session-status').textContent=f.name+' was not opened. Drop a CSV or XLSX to load it in Data Workbench.';return;}openApp('workbench');windows.get('workbench').upload(f);});
// 21st.dev 2572 cosine magnification, native buttons and no perpetual RAF loop.
$('#app-launcher').addEventListener('pointermove',e=>{if(innerWidth<=768||matchMedia('(prefers-reduced-motion: reduce)').matches)return;for(const b of launchers.values()){const r=b.getBoundingClientRect();const distance=Math.abs(e.clientX-r.x-r.width/2);b.style.setProperty('--scale',String(distance<120?1+.15*(1+Math.cos(distance/120*Math.PI)):1));}});
$('#app-launcher').addEventListener('pointerleave',()=>launchers.forEach(b=>b.style.removeProperty('--scale')));
function paintUsage(){
 const u=usage?.usage;
 $('#daily').textContent=u?money(Math.max(0,u.daily_credit_cap-u.credits_used-u.credits_held)*1000,'down')+' left today':'Allowance unavailable';
 $('#balance').textContent=u?money(u.credits_available*1000,'down')+' balance':'Balance unavailable';
 const recent=$('#recent-runs'),runs=[...(usage?.runs||[])].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)).slice(0,5);
 recent.replaceChildren(...(!usage?[el('li',session.authState().signedIn?'Runs unavailable. Refresh the connection.':'Sign in to see your recent runs.','empty')]:!runs.length?[el('li','No runs yet','empty')]:runs.map(r=>{const li=el('li');li.append(el('strong',r.list_name||r.tool_id),el('span',r.status+' / '+r.row_count+' '+(r.row_count===1?'row':'rows')+' / '+money(r.spent_micro)),el('small',age(r.created_at)));return li;})));
 $('#identity').textContent=usage?.user.email||'Your files stay here until you approve a run.';
 $('#menu-user').textContent=usage?.user.email||(session.authState().signedIn?'Signed in':'Signed out');
 for(const id of ['admin','scanner']){launchers.get(id).hidden=desktopIcons.get(id).hidden=!usage?.user.is_admin;if(!usage?.user.is_admin&&windows.has(id))closeWindow(id);}
}
async function refreshUsage(){const epoch=authEpoch;const next=await session.api('usage',{});if(epoch!==authEpoch)return;usage=next;paintUsage();}
async function connect(){
 const status=$('#session-status');status.className='loading';status.textContent='Connecting to your workspace...';
 try{config=await session.loadConfig(true);if(!config.configured)throw new Error('Setup needed. Secure sign-in and providers are not configured yet. You can explore the desktop.');await session.startClerk();await authChanged(session.authState());}
 catch(e){status.textContent=errorText(e);status.className='';}
}
async function authChanged(s){
 const epoch=++authEpoch;$('#signin-link').hidden=s.signedIn;$('#signout').hidden=!s.signedIn;
 loadIcons();if(!s.signedIn){usage=null;for(const id of [...windows.keys()])closeWindow(id);paintUsage();$('#session-status').textContent='Signed out. Sign in to access private runs and quotes.';$('#session-status').className='';return;}
 try{await refreshUsage();if(epoch!==authEpoch)return;$('#session-status').textContent=usage.usage.disabled?'Account disabled. Contact an administrator.':!usage.providers.treg&&!usage.providers.jev?'Setup needed. Providers are not configured yet.':usage.usage.daily_credit_cap===0?'No daily allowance enabled. Ask an administrator to set your limits.':'Workspace connected. Choose an app below.';}
 catch(e){$('#session-status').textContent=errorText(e);}
 $('#session-status').className='';
}
session.onAuthChange(authChanged);
$('#retry-session').addEventListener('click',connect);
$('#signout').addEventListener('click',()=>session.signOut().catch(e=>{$('#session-status').textContent=e.message;}));
function embedded(w,id){const url=id==='beam'?'https://www.champbeam.com':'https://champdf.com';notice(w.body,id==='beam'?'ChampBeam has its own sign-in. Some browsers block its session inside a frame.':'ChamPDF is free. If the embedded app does not load, open it in a new tab.');const a=el('a','Open in new tab');a.href=url;a.target='_blank';a.rel='noopener noreferrer';const frame=el('iframe');frame.src=url;frame.title=id==='beam'?'ChampBeam':'ChamPDF';frame.referrerPolicy='no-referrer';w.body.append(a,frame);}
function requireSignIn(body){if(!session.authState().signedIn){notice(body,config?.configured?'Sign in to load this private app.':'Setup needed. Sign-in is not configured yet.');const a=el('a','Go to sign in');a.href='/sign-in';body.append(a);return false;}return true;}
function scanner(w){
 const b=w.body;b.append(el('h3','Check before you share'),el('p','Browser-local scan of text files for possible secrets and sensitive text. Nothing is uploaded. Matching values are never displayed.'));
 const drop=el('div',undefined,'dropzone'),file=input('','file');file.multiple=true;file.accept='.txt,.md,.csv,.json,.yaml,.yml,.env,.js,.ts,.log';drop.append(field('Choose text files, or drop them here',file));b.append(drop);const output=el('div');b.append(output);
 async function scan(files){output.replaceChildren();for(const f of files){if(f.size>MAX_FILE_BYTES){notice(output,f.name+': exceeds 5 MiB.',true);continue;}const text=await f.text();if(text.includes('\u0000')){notice(output,f.name+': binary files are not supported.',true);continue;}const hits=scanText(text);output.append(el('h3',f.name));if(hits.length)output.append(table(['Line','Finding'],hits.map(x=>[x.line,x.type])));else notice(output,'No matching patterns found. This does not prove the file is safe. Review it before sharing.');} }
 file.addEventListener('change',()=>scan(file.files).catch(e=>notice(output,e.message,true)));dropTarget(drop,files=>scan(files).catch(err=>notice(output,err.message,true)));
}
function metrics(values){const n=el('div',undefined,'metrics');for(const [label,value] of values){const d=el('div',label);d.append(el('strong',value,'money'));n.append(d);}return n;}
function age(iso){const ms=Date.now()-Date.parse(iso);if(!Number.isFinite(ms))return 'Date unavailable';return Math.max(0,Math.floor(ms/86400000))+' days ago';}
function account(w){
 const b=w.body;if(!requireSignIn(b))return;
 const refresh=button('Refresh account',load);b.append(refresh);const content=el('div');b.append(content);
 async function load(){refresh.disabled=true;try{await refreshUsage();if(!w.node.isConnected)return;content.replaceChildren();const u=usage.usage;content.append(metrics([['Available balance',money(u.credits_available*1000,'down')],['Spent today',money(u.spent_micro)],['Held, not free',money(u.held_micro)]]));content.append(el('p','Daily spending cap: '+money(u.daily_credit_cap*1000)+'. Used allowance: '+money(u.credits_used*1000)+'. Resets at 00:00 UTC.'));
 const meter=el('progress');meter.max=u.daily_credit_cap||1;meter.value=u.credits_used+u.credits_held;meter.setAttribute('aria-label','Daily allowance used and held');content.append(meter,el('h3','Run history'));if(!usage.runs.length)notice(content,'No runs yet. Start in Data Workbench to get a quote.');else content.append(table(['Run','Status','Rows','Spent','Held','When'],usage.runs.map(r=>[r.list_name||r.tool_id,r.status,r.row_count,money(r.spent_micro),money(r.held_micro),age(r.created_at)])));}
 catch(e){notice(content,errorText(e),true);}finally{refresh.disabled=false;}}
 load();
}
function workbench(w){
 const root=w.body;root.append(el('h3','A better next row.'),el('p','Choose what each column needs. Approve the dollar quote. Review the evidence.'));
 const steps=el('ol',undefined,'steps');['Upload','Map','Operations','Quote','Results'].forEach((s,i)=>{const li=el('li',String(i+1).padStart(2,'0')+' / '+s);steps.append(li);});root.append(steps);
 const msg=el('div');msg.setAttribute('aria-live','polite');root.append(msg);const form=el('fieldset');form.style.border='0';form.style.padding='0';form.style.margin='0';form.style.minWidth='0';root.append(form);
 const drop=el('div',undefined,'dropzone'),file=input('','file');file.id='wb-file';file.accept='.csv,.xlsx';drop.append(field('Drop a CSV or XLSX, or choose a file',file),el('small','Up to 1,000 rows, 30 columns and 5 MiB. XLSX reads the first sheet; dates stay as serial numbers.'));form.append(drop);
 const mapping=el('div'),ops=el('div'),quoteBox=el('div');form.append(mapping,ops,quoteBox);const progress=el('div');progress.setAttribute('aria-live','polite');root.append(progress);const resultBox=el('div');root.append(resultBox);
 let source=null,columns=[],quotes=null,approved=null,busy=false,filename='',outputs=[],pending=null,closed=false,version=0;
 w.cleanup=()=>{closed=true;};
 const stage=n=>[...steps.children].forEach((s,i)=>i===n?s.setAttribute('aria-current','step'):s.removeAttribute('aria-current'));
 stage(0);
 function message(text,bad=false){msg.replaceChildren();notice(msg,text,bad);}
 function invalidate(){version++;quotes=null;approved=null;quoteBox.replaceChildren();}
 async function upload(f){
  if(!f||busy)return;invalidate();source=null;mapping.replaceChildren();ops.replaceChildren();resultBox.replaceChildren();progress.replaceChildren();outputs=[];
  try{if(!/\.(csv|xlsx)$/i.test(f.name))throw new Error('Choose a CSV or XLSX file. No file was uploaded.');if(f.size>MAX_FILE_BYTES)throw new Error('This file exceeds 5 MiB. Split it and try again.');const parsed=/\.xlsx$/i.test(f.name)?await parseXlsx(await f.arrayBuffer()):parseCsv(await f.text());source=validateFileTable(parsed);filename=f.name;message(source.rows.length+' rows read locally. Confirm the column mapping before continuing.');stage(1);renderMapping();}
  catch(e){message(e.message,true);stage(0);}
 }
 file.addEventListener('change',()=>upload(file.files[0]));dropTarget(drop,files=>upload(files[0]));w.upload=upload;
 function renderMapping(){
  const guessed=guessMapping(source.headers);mapping.append(el('h3','Confirm your columns'),el('p','Original column names are preserved. Map identity fields for enrichment; choose any column for classification.'));
  const grid=el('div',undefined,'form-grid');const maps={};for(const [key,label] of [['name','Person name'],['domain','Company domain']]){maps[key]=select([['','Not mapped'],...source.headers.map(h=>[h,h])],guessed[key]||'');grid.append(field(label,maps[key]));}mapping.append(grid,table(source.headers,source.rows.slice(0,3).map(r=>source.headers.map(h=>r[h]))));
  mapping.append(button('Confirm mapping',()=>{mapping.querySelectorAll('select,button').forEach(n=>n.disabled=true);columns=[];ops.replaceChildren();addOperation(maps);renderOperations(maps);stage(2);},'primary'));
 }
 function addOperation(maps){columns.push({column:source.headers[0],op:'classify',engine:'jev',instruction:'',categories:'',fields:['name','title','company'],name_column:maps.name.value,domain_column:maps.domain.value});}
 function renderOperations(maps){
  ops.replaceChildren();ops.append(el('h3','What should each column do?'));columns.forEach((spec,index)=>{
   const row=el('section',undefined,'operation');row.dataset.operation=index;const head=el('div',undefined,'op-head');head.append(el('h3','Operation '+(index+1)),button('Remove',()=>{columns.splice(index,1);invalidate();renderOperations(maps);}));row.append(head);const grid=el('div',undefined,'form-grid');
   const col=select(source.headers.map(h=>[h,h]),spec.column),op=select([['enrich','Enrich'],['verify_email','Verify email'],['classify','Classify'],['verify','Verify a yes/no question']],spec.op);
   col.addEventListener('change',()=>{spec.column=col.value;invalidate();});op.addEventListener('change',()=>{spec.op=op.value;spec.engine=['enrich','verify_email'].includes(spec.op)?'treg':'jev';invalidate();renderOperations(maps);});grid.append(field('Source column',col),field('Operation',op));
   if(['classify','verify'].includes(spec.op)){const engine=select([['jev',ENGINE_LABEL.jev],['deepseek',ENGINE_LABEL.deepseek]],spec.engine);engine.addEventListener('change',()=>{spec.engine=engine.value;invalidate();});grid.append(field('Engine',engine));const ins=el('textarea');ins.value=spec.instruction;ins.maxLength=1000;ins.addEventListener('input',()=>{spec.instruction=ins.value;invalidate();});grid.append(field(spec.op==='verify'?'Yes/no question':'Instructions for this column',ins));if(spec.op==='classify'){const cats=input(spec.categories);cats.placeholder='Technology, Healthcare, Other';cats.addEventListener('input',()=>{spec.categories=cats.value;invalidate();});grid.append(field('Categories, separated by commas',cats));}}
   else {grid.append(el('p','Engine: '+ENGINE_LABEL.treg+'. Uses provider verification, not a language-model guess.'));const fixed=el('textarea');fixed.value=spec.op==='enrich'?'Find the selected fields for this identity.':'Check this email address with the verification provider.';fixed.readOnly=true;grid.append(field('Provider instruction (fixed)',fixed));}
   row.append(grid);
   if(spec.op==='enrich'){row.append(el('p','Fields to add. Use an email, LinkedIn profile, or domain plus a mapped person name.'));const checks=el('div',undefined,'checks');for(const key of ['name','title','company']){const check=input('','checkbox');check.checked=spec.fields.includes(key);check.addEventListener('change',()=>{spec.fields=check.checked?[...spec.fields,key]:spec.fields.filter(k=>k!==key);invalidate();});const label=el('label',undefined,'check');label.append(check,el('span',key));checks.append(label);}row.append(checks);}
   ops.append(row);
  });
  const bar=el('div',undefined,'toolbar'),add=button('Add column operation',()=>{addOperation(maps);invalidate();renderOperations(maps);});add.disabled=columns.length>=8;bar.append(add,button('Get dollar quote',getQuote,'primary'));ops.append(bar);
 }
 function specs(){if(!columns.length)throw new Error('Add at least one column operation.');return columns.map(c=>{const spec={column:c.column,op:c.op,engine:c.engine};if(c.op==='enrich'){if(!c.fields.length)throw new Error('Choose at least one enrichment field.');spec.fields=c.fields;if(c.name_column)spec.name_column=c.name_column;if(c.domain_column)spec.domain_column=c.domain_column;}
 if(['classify','verify'].includes(c.op)){if(!c.instruction.trim())throw new Error('Write an instruction for each classification or yes/no operation.');spec.instruction=c.instruction.trim();if(c.op==='classify'){spec.categories=c.categories.split(',').map(x=>x.trim()).filter(Boolean);if(spec.categories.length<2||spec.categories.length>30||new Set(spec.categories.map(x=>x.toLowerCase())).size!==spec.categories.length)throw new Error('Choose 2 to 30 distinct categories.');}}return spec;});}
 async function getQuote(){
  if(!session.authState().signedIn){message('Sign in before requesting a quote. Your file is still local.',true);return;}
  try{const selected=specs(),batches=chunk(source.rows,100),v=version;busy=true;form.disabled=true;message('Getting per-column quotes. No providers are running.');const next=[];for(const rows of batches)next.push(await session.api('quote',{rows,columns:selected}));if(closed||v!==version)return;quotes=next;approved={batches,columns:selected};renderQuote();stage(3);message('Quote ready. Nothing runs until you approve.');}
  catch(e){message(errorText(e),true);}finally{busy=false;form.disabled=false;}
 }
 function renderQuote(){quoteBox.replaceChildren();const q=quoteSummary(quotes);quoteBox.append(el('h3','Your maximum cost'),table(['Column','Operation','Engine','Unique values','Blank or unusable rows (not billed)','Up to'],approved.columns.map((c,i)=>[c.column,OP_LABEL[c.op],ENGINE_LABEL[c.engine],quotes.reduce((s,x)=>s+x.columns[i].distinct_count,0),quotes.reduce((s,x)=>s+x.columns[i].skipped_rows,0),money(quotes.reduce((s,x)=>s+x.columns[i].max_cost_micro,0))])));
 quoteBox.append(metrics([['Total, up to',money(q.micro)],['Left today',money(q.allowance.remaining_daily_micro,'down')],['Balance',money(q.allowance.credits_available*1000,'down')]]));notice(quoteBox,(approved.batches.length===1?'1 batch of up to 100 rows.':approved.batches.length+' batches, run one after another, up to 100 rows each.')+' Duplicates are billed once within each batch. The quote is a reservation, not the final provider charge.');
 q.reasons.forEach(r=>notice(quoteBox,r,true));const run=button('Approve '+money(q.micro)+' and run',()=>runAll(),'primary');run.id='wb-run';run.disabled=q.reasons.length>0;quoteBox.append(run);run.scrollIntoView({block:'end'});
 }
 async function runAll(){
  if(busy||!approved)return;busy=true;form.disabled=true;outputs=[];resultBox.replaceChildren();progress.replaceChildren();stage(4);let stopped=false;
  try{for(let i=0;i<approved.batches.length;i++){
   if(closed||!session.authState().signedIn)break;
   const body={tool_id:'data-workbench',request_id:crypto.randomUUID(),list_name:filename,rows:approved.batches[i],columns:approved.columns,max_credits:quotes[i].max_credits};pending=body;
   const label=el('p','Batch '+(i+1)+' of '+approved.batches.length+': running provider steps...','loading'),ledger=el('ol',undefined,'progress-list');progress.append(label,ledger);
   let polling=false;
   const draw=r=>{ledger.replaceChildren(...(r.ledger||[]).map(l=>el('li',l.provider+' / '+l.endpoint+' : '+l.status+' / '+money(l.cost_micro??l.reserved_micro)+' '+(l.cost_micro==null?'reserved':'charged'))));};
   // Same payload and UUID read the existing run; the backend never dispatches it twice.
   const timer=setInterval(async()=>{if(polling||closed)return;polling=true;try{draw(await session.api('run',body));}catch{}finally{polling=false;}},2000);
   let result;try{result=await session.api('run',body);}finally{clearInterval(timer);}
   draw(result);pending=null;label.className='';label.textContent='Batch '+(i+1)+': '+result.status+'. Spent '+money(result.spent_micro)+', held '+money(result.held_micro)+'.';outputs.push(...resultRows(body.rows,body.columns,result.results));
   if(result.status!=='completed'){stopped=true;message('Run stopped: '+(result.error||result.status)+'. Finished results are retained. Held costs are not free.',true);break;}
  }
  if(!closed){renderResults();if(!stopped)message('Run finished. Review the flags before using the results.');await refreshUsage();}
  }catch(e){message(errorText(e)+' No further batches were started.',true);if(pending){const body=pending;progress.append(button('Check or retry the same request',async()=>{try{const r=await session.api('run',body);if(['new','running'].includes(r.status)){message('The original request is still running. Check again shortly.');return;}pending=null;outputs.push(...resultRows(body.rows,body.columns,r.results));renderResults();message('Original request: '+r.status+'. Spent '+money(r.spent_micro)+', held '+money(r.held_micro)+'. Remaining batches were not run.');await refreshUsage();}catch(err){message(errorText(err),true);}}));}renderResults();}
  finally{busy=false;form.disabled=false;approved=null;quoteBox.replaceChildren();}
 }
 function renderResults(){resultBox.replaceChildren();if(!outputs.length)return;resultBox.append(el('h3','Results with review flags'));resultBox.scrollIntoView({block:'start'});const headers=Object.keys(outputs[0]);resultBox.append(table(headers,outputs.map(r=>headers.map(h=>r[h]))));resultBox.append(button('Export CSV',()=>{const url=URL.createObjectURL(new Blob([toCsv(headers,outputs)],{type:'text/csv;charset=utf-8'})),a=el('a');a.href=url;a.download='workbench-results.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},'primary'));}
}
function admin(w){
 const b=w.body;if(!usage?.user.is_admin)return;let page=1,grantKey=null,grantPayload=null;
 b.append(el('h3','Workspace controls'),el('p','Money values are dollars. Daily user caps cannot exceed $1 in this interface. Zero disables the allowance.'));
 const msg=el('div');b.append(msg);const status=(text,bad=false)=>{msg.replaceChildren();notice(msg,text,bad);};
 const grant=el('form'),email=input('','email'),amount=input('','number'),reason=input();amount.min='.01';amount.max='100';amount.step='.01';email.required=true;amount.required=true;reason.required=true;reason.maxLength=200;const grid=el('div',undefined,'form-grid');grid.append(field('Grant to verified email',email),field('Amount in dollars',amount),field('Reason',reason));const submit=button('Grant credits',()=>{});submit.type='submit';grant.append(el('h3','Grant credits'),grid,submit);b.append(grant);
 grant.addEventListener('input',()=>{grantKey=null;grantPayload=null;});
 grant.addEventListener('submit',async e=>{e.preventDefault();submit.disabled=true;try{const credits=Math.round(Number(amount.value)*1000);if(!Number.isSafeInteger(credits)||credits<10||credits>100000)throw new Error('Enter $0.01 to $100.');grantKey??=crypto.randomUUID();grantPayload??={target_email:email.value.trim(),credits,reason:reason.value.trim(),idempotency_key:grantKey};const r=await session.api('admin_grant',grantPayload);await load();status((r.replayed?'Existing grant confirmed.':'Grant recorded.')+' Recipient balance: '+money(r.credits_available*1000,'down')+'.');grantKey=null;grantPayload=null;grant.reset();}catch(err){status(errorText(err)+'. Retry keeps the same grant key.',true);}finally{submit.disabled=false;}});
 const settings=el('div'),users=el('div');b.append(settings,users);const nav=el('div',undefined,'toolbar'),prev=button('Previous users',()=>{page--;load();}),next=button('Next users',()=>{page++;load();});nav.append(prev,next);b.append(nav);
 async function load(){try{const [global,list]=await Promise.all([session.api('admin_usage',{}),session.api('admin_users',{page})]);if(!w.node.isConnected)return;settings.replaceChildren();settings.append(el('h3','Default allowances'));const f=el('form'),g=el('div',undefined,'form-grid'),fields={};for(const [key,label,value,factor,max] of [['welcome_credits','Welcome credit grant ($)',global.global.welcome_credits,1000,100],['default_daily_credit_cap','Default daily user cap ($)',global.global.default_daily_credit_cap,1000,1],['global_daily_cap_micro','Shared daily provider cap ($)',global.global.daily_cap_micro,1e6,1000],['default_daily_row_cap','Default daily row cap',global.global.default_daily_row_cap,1,100000],['trial_pool_credits','Total welcome credit pool ($)',global.global.trial_pool_credits,1000,100000]]){const n=input(String(value/factor),'number');n.min='0';n.max=String(max);n.step=factor===1?'1':'.001';fields[key]={n,factor};g.append(field(label,n));}const save=button('Save default allowances',()=>{});save.type='submit';f.append(g,save);f.addEventListener('submit',async e=>{e.preventDefault();save.disabled=true;try{const body=Object.fromEntries(Object.entries(fields).map(([k,{n,factor}])=>[k,Math.round(Number(n.value)*factor)]));await session.api('admin_update',body);await load();status('Default allowances saved and read back.');}catch(err){status(errorText(err),true);}finally{save.disabled=false;}});settings.append(f);
 users.replaceChildren(el('h3','Users'));if(!list.users.length)notice(users,'No users on this page.');else users.append(table(['User','Balance / spent today','Daily cap ($)','Disabled','Action'],list.users.map(u=>{const cap=input(String(u.effective_daily_credit_cap/1000),'number');cap.min='0';cap.max='1';cap.step='.001';cap.setAttribute('aria-label','Daily dollar cap for '+(u.email||u.id));const disabled=input('','checkbox');disabled.checked=!!u.disabled;disabled.setAttribute('aria-label','Disable '+(u.email||u.id));const save=button('Save user',async()=>{if(!cap.reportValidity())return;save.disabled=true;try{await session.api('admin_update',{user_id:u.id,daily_credit_cap:Math.round(Number(cap.value)*1000),disabled:disabled.checked});await load();status('User settings saved and read back.');}catch(err){status(errorText(err),true);}finally{save.disabled=false;}});return [u.email||u.id,money(u.credits_available*1000,'down')+' / '+money(u.spent_micro_today),cap,disabled,save];})));prev.disabled=page<=1;next.disabled=!list.has_more;
 }catch(e){status(errorText(e),true);}}
 load();
}
connect();
