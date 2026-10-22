// Capture real public product interfaces, never example data fabricated for the page.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
const browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
mkdirSync('images',{recursive:true});mkdirSync('docs/shots/editorial-v5',{recursive:true});
const sources=[];
try {
 for(const [name,url] of [['pdf','https://champdf.com'],['harbinger','https://champharbinger.vercel.app']]) {
  const page=await browser.newPage({viewport:{width:1000,height:600},colorScheme:'dark',deviceScaleFactor:1});
  const response=await page.goto(url,{waitUntil:'networkidle',timeout:60000});
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:`docs/shots/editorial-v5/product-${name}.png`});
  sources.push({name,url,status:response.status(),title:await page.title(),text:(await page.locator('body').innerText()).slice(0,3000)});
  await page.close();
 }
 for(const width of [375,1280]){
  const page=await browser.newPage({viewport:{width,height:900},colorScheme:'dark'});
  await page.goto('http://127.0.0.1:3295/',{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:`docs/shots/editorial-v5/wip-${width}.png`});await page.close();
 }
} finally {writeFileSync('docs/verification/editorial-v5/product-sources.json',JSON.stringify(sources,null,2));await browser.close();}
