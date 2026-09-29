// 토지 개별요인 비교치 색 — 1 초과 파랑(fac-up)·1 미만 빨강(fac-dn)·1/빈칸 기본색.
// 공시지가기준법 개별요인(본건-표준지)·거래사례비교법 개별요인(본건-사례)·그 밖의 요인 개별요인(표준지-사례, 표준지 개별요인) 모두.
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_fac_color.cjs
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
    await page.evaluate(()=>{TRADES=[{loc:'옥인동 1',price:'500,000,000',landArea:'80',date:'2025.12.29'}];GA={idx:0};showTab('gongsi');renderTrade();syncPick();calcGongsi();calcGeorae();});
    const col=sel=>page.locator(sel).evaluate(el=>getComputedStyle(el).color);
    const BLUE='rgb(37, 99, 235)',RED='rgb(220, 38, 38)';
    const typeIn=async(loc,v)=>{await loc.click();await loc.fill(v);};
    // 공시지가기준법 개별요인 표(본건-표준지)
    const g=i=>page.locator('#tblGaebyeol input.fac').nth(i);
    await typeIn(g(0),'1.05');await typeIn(g(1),'0.95');
    assert.equal(await col('#tblGaebyeol input.fac >> nth=0'),BLUE,'표준지 우세 파랑');
    assert.equal(await col('#tblGaebyeol input.fac >> nth=1'),RED,'표준지 열세 빨강');
    assert.notEqual(await col('#tblGaebyeol input.fac >> nth=2'),BLUE);assert.notEqual(await col('#tblGaebyeol input.fac >> nth=2'),RED);
    // 계 = 1.05*0.95 = 0.998 → 빨강
    assert.equal(await page.locator('#tblGaebyeol td.calc-c.fac').first().evaluate(el=>el.classList.contains('fac-dn')),true,'계 열세');
    // 거래사례비교법 개별요인(본건-사례)
    await page.evaluate(()=>showTab('georae'));
    const ga=i=>page.locator('#tblGaFactors input.fac').nth(i);
    await typeIn(ga(2),'1.10');await typeIn(ga(3),'0.90');
    assert.equal(await col('#tblGaFactors input.fac >> nth=2'),BLUE);
    assert.equal(await col('#tblGaFactors input.fac >> nth=3'),RED);
    // 그 밖의 요인 개별요인·표준지 개별요인
    await page.evaluate(()=>{showTab('gongsi');document.getElementById('e_f1').value='1.20';document.getElementById('e_f2').value='0.80';document.getElementById('eInd2').value='1.03';document.getElementById('e_f3').value='';calcGongsi();});
    assert.equal(await col('#e_f1'),BLUE);assert.equal(await col('#e_f2'),RED);assert.equal(await col('#eInd2'),BLUE);
    assert.equal(await page.evaluate(()=>{const e=document.getElementById('e_f3');return e.classList.contains('fac-up')||e.classList.contains('fac-dn');}),false,'빈칸 무색');
    assert.equal(await page.evaluate(()=>document.getElementById('efSum').className.includes('fac-dn')),true,'1.2*0.8=0.96 열세');
    // 저장·복원 후에도 색 유지
    await page.evaluate(()=>doSave());
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.ArapTojiDocuments);
    await page.evaluate(()=>showTab('gongsi'));
    assert.equal(await col('#e_f1'),BLUE,'복원 후 파랑');
    assert.equal(await col('#tblGaebyeol input.fac >> nth=1'),RED,'복원 후 빨강');
    assert.deepEqual(errors,[]);
    console.log('PASS');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
