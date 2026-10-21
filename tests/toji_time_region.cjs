// 사례 시점수정 지역 오조회(2026-10-21 사용자 제보) — 「장안면 사곡리 309-17」(화성시 만세구)이 '장안' 글자 때문에 수원시 장안구로 잡히던 문제
//  ① 지역 이름 바로 뒤에 면·읍·동·리가 붙으면 맞는 것으로 치지 않음 → 소재지만으로는 못 찾고(-1) 시군구 조회로 넘어감
//  ② 「장안구 정자동」처럼 진짜 구 이름이면 그대로 수원시 장안구
//  ③ 이미 수원시 장안구로 계산해 둔 사례는 다시 계산 대상(jbStaleReg), 화성시로 계산된 건 아님
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_time_region.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');
  fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  const page=await (await browser.newContext()).newPage();const errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.context().route('**/*',r=>{const u=r.request().url();if((u.includes('arap_access.js')||u.includes('arap_user.js')))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
  await page.goto(base+'/토지건물.html?mode=land',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.jbPickRegion&&window.jbStaleReg);
  const r=await page.evaluate(()=>{
    const regs=['경기 > 수원시','경기 > 수원시 > 장안구','경기 > 수원시 > 권선구','경기 > 화성시','경기 > 화성시 > 만세구','서울 > 강남구'];
    const pick=h=>{const i=jbPickRegion(regs,h);return i<0?null:regs[i];};
    return {loc:pick('장안면 사곡리 309-17'),sgg:pick('경기도 화성시 만세구 장안면 사곡리 309-17'),real:pick('수원시 장안구 정자동 100'),real2:pick('장안구 정자동 100'),
      stale:jbStaleReg({reg:'경기 수원시 장안구'},'장안면 사곡리 309-17'),ok:jbStaleReg({reg:'경기 화성시 만세구'},'장안면 사곡리 309-17'),
      okReal:jbStaleReg({reg:'경기 수원시 장안구'},'장안구 정자동 100')};
  });
  console.log(r);
  assert.equal(r.loc,null,'장안면은 수원시 장안구가 아님');
  assert.equal(r.sgg,'경기 > 화성시 > 만세구');
  assert.equal(r.real,'경기 > 수원시 > 장안구');assert.equal(r.real2,'경기 > 수원시 > 장안구');
  assert.equal(r.stale,true);assert.equal(r.ok,false);assert.equal(r.okReal,false);
  assert.deepEqual(errs,[]);
  console.log('\n✅ 사례 시점수정 지역 검증 통과');
  await browser.close();server.close();
})().catch(e=>{console.error('❌',e);process.exit(1);});
