// 거래사례 표 「그밖의요인 선정」·「거래사례 선정」 라디오 — 한 번 더 누르면 해제, 다시 누르면 선정. 저장·복원, 오류 없음.
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_pick_toggle.cjs
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
    await page.evaluate(()=>{TRADES=[{loc:'옥인동 47-307',price:'675,000,000',landArea:'82.6',date:'2025.05.31'},{loc:'옥인동 47-101',price:'630,000,000',landArea:'88.03',date:'2025.12.29'}];
      ETC={type:'t',idx:1};GA={idx:0};showTab('gongsi');renderTrade();syncPick();syncGeorae();});
    const etc=i=>page.locator('input[name="pickTrade"]').nth(i),ga=i=>page.locator('input[name="pickTradeGa"]').nth(i);
    const st=()=>page.evaluate(()=>({e:ETC.idx,g:GA.idx}));
    await etc(1).click();
    assert.deepEqual(await st(),{e:-1,g:0},'그밖의요인 해제');
    assert(!(await etc(1).isChecked())&&!(await etc(0).isChecked()));
    assert.equal(await page.locator('#etcPick').inputValue(),'','드롭다운도 선정 안 함');
    await ga(0).click();
    assert.deepEqual(await st(),{e:-1,g:-1},'거래사례 해제');
    assert(!(await ga(0).isChecked()));
    await page.evaluate(()=>doSave());
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.ArapTojiDocuments);
    await page.evaluate(()=>showTab('gongsi'));
    assert.deepEqual(await st(),{e:-1,g:-1},'해제 상태 저장·복원');
    await etc(0).click();await ga(1).click();
    assert.deepEqual(await st(),{e:0,g:1},'다시 선정');
    assert(await etc(0).isChecked()&&await ga(1).isChecked());
    await ga(1).click();await ga(0).click();
    assert.deepEqual(await st(),{e:0,g:0},'해제 후 다른 사례 선정');
    assert.deepEqual(errors,[]);
    console.log('PASS');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
