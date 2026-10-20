import test from 'node:test';
import assert from 'node:assert/strict';
import * as source from '../worker/index.js';
const worker = source.default;

test('toolkit CSP pins configured Clerk host and permits required billing/fraud hosts only',()=>{
  assert.equal(typeof source.toolkitCsp,'function');
  const csp=source.toolkitCsp({CLERK_JS_URL:'https://accounts.example.com/npm/@clerk/clerk-js@5/dist/clerk.browser.js'});
  assert.ok(csp.includes('https://accounts.example.com'));
  assert.ok(csp.includes('https://*.protect.clerk.com:*'));
  assert.ok(csp.includes('https://js.stripe.com'));
  assert.ok(csp.includes("worker-src 'self' blob:"));
  assert.ok(!csp.includes('https://openrouter.ai'));
  assert.ok(!source.toolkitCsp({CLERK_JS_URL:'https://evil.example.com/;script-src *'}).includes('evil.example.com'));
  assert.ok(!source.toolkitCsp({CLERK_JS_URL:'http://accounts.example.com/'}).includes('accounts.example.com'));
});

test('Worker routes the toolkit API before static assets',async()=>{
  const response=await worker.fetch(new Request('https://deependhq.com/api/toolkit/config'),{}, {waitUntil(){}});
  assert.equal(response.status,200);
  assert.equal((await response.json()).configured,false);
});

test('legacy unmetered paid endpoint is closed without provider dispatch',async()=>{
  const response=await worker.fetch(new Request('https://deependhq.com/api/decide',{method:'POST',body:'{}'}),{}, {waitUntil(){}});
  assert.equal(response.status,410);
});
