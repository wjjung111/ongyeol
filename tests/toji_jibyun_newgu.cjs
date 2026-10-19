// 토지건물 지가변동률 — ① 신설 구(화성시 만세구, 2026.02 신설) 신설 전 달은 상위 지역(화성시) 값으로 채움(KAIS 계산식과 같은 값)
// ② 사례 용도지역 「계획관리」가 「보전관리지역」으로 잡히던 것 고침 ③ 옛 오조회 시점수정치는 지우고 다시 계산
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_jibyun_newgu.cjs
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
  const ctx=await browser.newContext();const page=await ctx.newPage();const errs=[];
  page.on('pageerror',e=>errs.push(e.message));
  await ctx.route('**/*',r=>{const u=r.request().url();
    if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});
    if(u.startsWith(base))return r.continue();return r.abort();});
  await page.goto(base+'/토지건물.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.roneCumulative&&window.ARAP_JIBYUN_DATA);
  const r=await page.evaluate(async()=>{
    const F=ARAP_JIBYUN_DATA;jbState.latestYm=+F.latestYm;
    const g={y:2026,mo:1,d:1},e={y:2026,mo:10,d:19};
    return {
      plan:(await roneCumulative('경기 > 화성시 > 만세구','계획관리지역',g,e)).toFixed(5),
      prod:(await roneCumulative('경기 > 화성시 > 만세구','생산관리지역',g,e)).toFixed(5),
      pick:['계획관리','계획관리지역','생산관리','보전관리','관리지역','2종일주','자연녹지'].map(h=>F.uses[jbPickUse(F.uses,h)])
    };
  });
  console.log(r);
  assert.equal(r.plan,'1.01320');   // KAIS 「경기도 화성시 만세구 (26.01.01~26.10.19) (계획관리)」 ≒ 1.01320
  assert.equal(r.prod,'1.00639');   // 같은 화면 생산관리 0.639%
  assert.deepEqual(r.pick,['계획관리지역','계획관리지역','생산관리지역','보전관리지역','관리(통합)지역','주거지역','녹지지역']);
  // ③ 옛 오조회(계획관리 사례에 보전관리지역 값) → 표를 그릴 때 지운다
  const st=await page.evaluate(()=>{TRADES=[{loc:'팔탄면 율암리 35-3',use:'계획관리',date:'2026.09.03',timeMeta:{reg:'경기 화성시 만세구',use:'보전관리지역',from:'26.09.03',to:'26.10.19',factor:'1.00120'}},{use:'2종일주',timeMeta:{use:'주거지역',factor:'1.001'}},{}];
    ETC={type:'t',idx:-1};GA={idx:-1};renderTrade();return TRADES.map(c=>c.timeMeta?c.timeMeta.use:null);});
  assert.deepEqual(st,[null,'주거지역',null]);
  assert.deepEqual(errs,[]);
  console.log('✅ 모두 통과');
  await browser.close();server.close();
})().catch(e=>{console.error('❌',e);process.exit(1);});
