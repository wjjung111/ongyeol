// 거래사례 「그밖의요인 선정」·「거래사례 선정」 — 새 건은 아무것도 선정되지 않고, 평가사가 고르면 그 사례의 시점수정치가 바로 칸에 들어간다.
// 사례를 지우면 선정이 같은 사례를 따라가고, 지운 사례가 선정돼 있었으면 해제된다.
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_pick_default.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':'text/javascript');fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  try{
    const ctx=await browser.newContext(),page=await ctx.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await ctx.route('**/*',r=>{const u=r.request().url();if((u.includes('arap_access.js')||u.includes('arap_user.js')))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
    await page.goto(base+'/토지건물.html',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.ArapTojiDocuments);
    const st=()=>page.evaluate(()=>({e:ETC.idx,g:GA.idx}));
    // 새 건: 선정 없음
    assert.deepEqual(await st(),{e:-1,g:-1},'새 건은 선정 없음');
    // 지가변동률 조회는 네트워크라 사례별 가짜 값으로 바꿔 둔다(거래일자로 구분)
    await page.evaluate(()=>{
      window.__calls=[];
      computeCaseTime=async function(c,type){__calls.push(c.loc);c.timeMeta={reg:'서울 종로구',use:'주거',from:'x',to:'y',factor:c.date==='2025.05.31'?'1.01111':'1.02222'};return {meta:c.timeMeta,cached:false};};
      document.getElementById('base_gijun').value='2026.09.01';
      TRADES=[{loc:'옥인동 47-307',price:'675,000,000',landArea:'82.6',date:'2025.05.31'},{loc:'옥인동 47-101',price:'630,000,000',landArea:'88.03',date:'2025.12.29'},{loc:'옥인동 1',price:'500,000,000',landArea:'80',date:'2025.12.29'}];
      showTab('gongsi');renderTrade();syncPick();syncGeorae();});
    const etc=i=>page.locator('input[name="pickTrade"]').nth(i),ga=i=>page.locator('input[name="pickTradeGa"]').nth(i);
    for(let i=0;i<3;i++){assert(!(await etc(i).isChecked())&&!(await ga(i).isChecked()),'라디오 모두 비어 있음 '+i);}
    assert.equal(await page.locator('#etcPick').inputValue(),'','드롭다운 선정 안 함');
    assert.equal(await page.evaluate(()=>__calls.length),0,'선정 전엔 시점수정 계산 안 함');
    // 그밖의요인 #1 선정 → eTime 바로 채움
    await etc(0).click();
    await page.waitForFunction(()=>document.getElementById('eTime').value==='1.01111');
    // 거래사례 #2 선정 → ga_time 바로 채움
    await ga(1).click();
    await page.waitForFunction(()=>document.getElementById('ga_time').value==='1.02222');
    assert.deepEqual(await st(),{e:0,g:1});
    // 4번째 사례를 더해 열 삭제(splice) 경로 확인: #1 지우면 그밖의요인 해제, 거래사례는 #2→#1로 따라감
    await page.evaluate(()=>{TRADES.push({loc:'옥인동 2',price:'1',landArea:'1',date:'2025.01.01'});renderTrade();delTrade(0);});
    assert.deepEqual(await st(),{e:-1,g:0},'지운 사례 선정 해제·뒤 사례 따라감');
    assert.equal(await page.evaluate(()=>TRADES[GA.idx].loc),'옥인동 47-101');
    // 새 평가서(clearForm)도 선정 없음
    await page.evaluate(()=>clearForm());
    assert.deepEqual(await st(),{e:-1,g:-1},'새 건 선정 없음');
    assert.deepEqual(errors,[]);
    console.log('PASS');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
