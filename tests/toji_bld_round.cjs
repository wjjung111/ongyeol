// 건물 적용단가 끝수 처리(단위·반올림/절사) — 기본 '그대로'는 종전 값, 고르면 적용단가·금액·합계가 따라 바뀌고 저장·복원된다.
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_bld_round.cjs
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
    // 800,000 × 4/45 = 71,111.11… (스크린샷 사례)
    await page.evaluate(()=>{document.getElementById('bt_useApr').value='1985.01.01';document.getElementById('base_gijun').value='2026.09.28';
      document.getElementById('bldBody').innerHTML='';addBldRow({구분:'주',층별:'1층',용도:'주택',연면적:'41.98'});
      window.BLD_STATE={0:{reCost:'800,000',life:'45'}};showTab('bld');renderBldCalc();});
    const apply=()=>page.evaluate(()=>BLD_RESULT.rows[0].apply);
    assert(Math.abs(await apply()-800000*4/45)<1e-6,'기본 = 그대로');
    await page.locator('#bld_rMode').selectOption('round');
    assert.equal(await apply(),71100,'자동(백원 단위에서) 반올림');
    assert.match(await page.textContent('#bld_rHint'),/반올림/);
    await page.locator('#bld_rUnit').selectOption('1000');
    assert.equal(await apply(),70000,'천원 단위에서 반올림');
    await page.locator('#bld_rUnit').selectOption('10');
    await page.locator('#bld_rMode').selectOption('floor');
    assert.equal(await apply(),71100,'십원 단위에서 절사');
    await page.locator('#bld_rUnit').selectOption('1');
    assert.equal(await apply(),71110,'원 단위에서 절사');
    assert.equal(await page.evaluate(()=>BLD_RESULT.total),71110*41.98);
    await page.evaluate(()=>doSave());
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.ArapTojiDocuments);
    await page.evaluate(()=>{showTab('bld');renderBldCalc();});
    assert.equal(await page.locator('#bld_rUnit').inputValue(),'1');
    assert.equal(await page.locator('#bld_rMode').inputValue(),'floor');
    assert.equal(await apply(),71110,'저장·복원');
    assert.deepEqual(errors,[]);
    console.log('PASS');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
