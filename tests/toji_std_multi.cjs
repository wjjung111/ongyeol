// 토지건물 표준지 2개 이상 — ① 개별요인비교 표에서 필지별 비교표준지 고르기 ② 그 밖의 요인 비교표준지 고르기(다시 그려도·저장 뒤에도 유지, 사례마다 기억)
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_std_multi.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');
  fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
  const ctx=await browser.newContext({viewport:{width:1600,height:1000}});const page=await ctx.newPage();const errs=[];
  page.on('pageerror',e=>errs.push(e.message));page.on('dialog',d=>d.accept());
  await ctx.route('**/*',r=>{const u=r.request().url();
    if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});
    if(u.startsWith(base))return r.continue();return r.abort();});
  await page.goto(base+'/토지건물.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.renderGaebyeol&&window.etcStdIdx);
  await page.evaluate(()=>{
    LANDS=[{소재지:'화산리',지번:'664-73',면적:'380',stdIdx:0},{소재지:'화산리',지번:'664-75',면적:'960',stdIdx:0}];
    STDS=[{소재지:'화산리',지번:'364-7',공시지가:'276,400'},{소재지:'쌍송리',지번:'산 32',공시지가:'146,300'}];
    TRADES=[{loc:'율암리 134-1',total:'1000000000',landA:'1000',date:'2026.05.18'},{loc:'율암리 35-3',total:'500000000',landA:'1000',date:'2026.09.03'},{}];
    APPRS=[{no:'a',loc:'구장리 1',unit:'700,000',base:'2025.05.08'},{},{}];ETC={type:'t',idx:-1};GA={idx:-1};
    document.getElementById('base_gijun').value='2026.10.19';document.getElementById('base_gongsi').value='2026.01.01';
    renderStds();renderLands();renderTrade();renderAppr();syncPick();calcGongsi();showTab('land');
  });
  // ① 개별요인비교 표: 필지마다 비교표준지 드롭다운
  const picks=page.locator('#tblGaebyeol select.std-pick');
  assert.equal(await picks.count(),2);
  await picks.nth(1).selectOption('1');
  assert.deepEqual(await page.evaluate(()=>LANDS.map(L=>L.stdIdx||0)),[0,1]);
  assert.deepEqual(await page.evaluate(()=>GONGSI_RESULT.rows.map(r=>r.stdIdx)),[0,1]);
  assert.equal(await page.locator('#tblGaebyeol select.std-pick').nth(1).inputValue(),'1','다시 그려도 B');
  console.log('① 개별요인비교 표 필지별 표준지 OK');

  // ② 그 밖의 요인: 사례 #1 고르고 비교표준지 B
  await page.evaluate(()=>{pickEtc('t',0);});
  await page.evaluate(()=>{const s=document.getElementById('etcStd');s.value='1';s.dispatchEvent(new Event('change'));});
  let r=await page.evaluate(()=>({std:GONGSI_RESULT.etc.stdIdx,price:GONGSI_RESULT.etc.price,sel:document.getElementById('etcStd').value}));
  console.log('② 그밖의요인',r);
  assert.equal(r.std,1);assert.equal(r.price,146300);
  // 표준지 표를 다시 그려도(표준지 칸 입력) 선택 유지 — 예전엔 A로 돌아갔다
  await page.evaluate(()=>{renderStds();calcGongsi();});
  assert.equal(await page.evaluate(()=>[document.getElementById('etcStd').value,GONGSI_RESULT.etc.stdIdx].join()),'1,1');
  // 다른 사례로 바꾸면 B 유지(기억 없으면 그대로), A로 바꾼 뒤 사례 #1로 돌아오면 #1은 B를 기억
  await page.evaluate(()=>{pickEtc('t',1);});
  assert.equal(await page.evaluate(()=>etcStdIdx()),1);
  await page.evaluate(()=>{const s=document.getElementById('etcStd');s.value='0';s.dispatchEvent(new Event('change'));});
  await page.evaluate(()=>{pickEtc('t',0);});
  assert.equal(await page.evaluate(()=>etcStdIdx()),1,'사례 #1은 B 기억');
  await page.evaluate(()=>{pickEtc('t',1);});
  assert.equal(await page.evaluate(()=>etcStdIdx()),0,'사례 #2는 A 기억');
  // 평가사례도
  await page.evaluate(()=>{pickEtc('a',0);const s=document.getElementById('etcStd');s.value='1';s.dispatchEvent(new Event('change'));});
  assert.equal(await page.evaluate(()=>GONGSI_RESULT.etc.price),146300);
  console.log('② 사례마다 기억 OK');

  // ③ 저장·복원
  await page.evaluate(()=>{const o=JSON.parse(JSON.stringify(collect()));clearForm();applyForm(o);refreshAfterLoad();});
  r=await page.evaluate(()=>({std:etcStdIdx(),sel:document.getElementById('etcStd').value,lands:LANDS.map(L=>L.stdIdx||0)}));
  assert.equal(r.std,1);assert.equal(r.sel,'1');assert.deepEqual(r.lands,[0,1]);
  // ④ 표준지 A를 지우면 B를 가리키던 선택은 새 A(옛 B)를 가리킨다
  await page.evaluate(()=>delStd(0));
  r=await page.evaluate(()=>({std:etcStdIdx(),lands:LANDS.map(L=>L.stdIdx||0),price:GONGSI_RESULT.etc.price}));
  assert.equal(r.std,0);assert.deepEqual(r.lands,[0,0]);assert.equal(r.price,146300);
  assert.deepEqual(errs,[]);
  console.log('✅ 모두 통과');
  await browser.close();server.close();
})().catch(e=>{console.error('❌',e);process.exit(1);});
