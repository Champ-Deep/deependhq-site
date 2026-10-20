import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
const box={};vm.createContext(box);
if(existsSync(new URL('../toolkit-catalog.js',import.meta.url))) vm.runInContext(readFileSync(new URL('../toolkit-catalog.js',import.meta.url),'utf8'),box);
test('free tools do not imply a paid account and unstable previews are labelled',()=>{
  const result=box.deepToolkitCatalog([
    {title:'ChamPDF',category:'repo',site:'https://champdf.com'},
    {title:'Event Scout',category:'repo',status:'building',site:'https://event-scout-delta.vercel.app'},
    {title:'ChampOps',category:'tool',url:'#'},
    {title:'ChampGraph',category:'tool',url:'https://github.com/Champ-Deep/Graphiti-knowledge-graph'},
  ]);
  assert.equal(result.length,2);
  assert.equal(result[0].free,true);
  assert.equal(result[1].mode,'preview');
});

test('toolkit consolidates duplicates without making repo and placeholder links into runnable tools',()=>{
  assert.equal(typeof box.deepToolkitCatalog,'function');
  const result=box.deepToolkitCatalog([
    {title:'ChampBeam',category:'tool',site:'https://champbeam.com',url:'https://github.com/Champ-Deep/ChampBeam'},
    {title:'ChampUTM',category:'tool',url:'https://github.com/Champ-Deep/ChampUTM'},
    {title:'Lead Scorer',category:'tool',url:'/lead-scorer'},
    {title:'Draft',category:'tool',url:'#'},
    {title:'Source',category:'repo',url:'https://github.com/Champ-Deep/Source'},
    {title:'Internal',category:'repo',status:'internal',site:'https://internal.example.com'},
    {title:'Skill',category:'skill',url:'#'},
  ]);
  assert.equal(result.length,4);
  assert.equal(result[0].href,'https://champbeam.com');
  assert.equal(result[0].mode,'external');
  assert.equal(result[1].mode,'shared');
  assert.equal(result[2].href,null);
  assert.equal(result[3].mode,'source');
});
