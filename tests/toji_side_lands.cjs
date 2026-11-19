// 토건 왼쪽 사이드바 「토지 정보」 — 본건 토지 표 순서대로 주소·개공·도로조건·용도지역·지목 (2026-11-19)
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_side_lands.cjs [스크린샷경로]
const assert=require('assert/strict'),path=require('path'),fs=require('fs'),http=require('http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.css')?'text/css':'text/javascript; charset=utf-8');fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true});
  try{
    const ctx=await browser.newContext({viewport:{width:1400,height:900}}),page=await ctx.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
    await ctx.route('**/*',r=>{const u=r.request().url();
      if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});return u.startsWith(base)?r.continue():r.abort();});
    await ctx.addInitScript(()=>{localStorage.setItem('arap-user-name','wdw');});
    await page.goto(base+'/'+encodeURI('토지건물.html'),{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>typeof renderSideLands==='function'&&typeof landChanged==='function');
    assert.equal((await page.textContent('#sd_lands')).trim(),'-','빈 평가서는 -');
    await page.evaluate(()=>{
      LANDS=[{소재지:'철산동',지번:'56-22',지목:'대',면적:'330',용도지역:'제2종일반주거지역',도로교통:'중로한면',공시지가:'5,120,000'},
             {소재지:'철산동',지번:'56-21',지목:'도',면적:'20',용도지역:'제2종일반주거지역',도로교통:'세로(가)',공시지가:'3100000'}];
      landChanged();});
    const items=await page.$$eval('#sd_lands .sl',els=>els.map(e=>e.innerText.replace(/\s+/g,' ').trim()));
    assert.deepEqual(items,['1철산동 56-22 개공 5,120,000원 중로한면 · 제2종일반주거지역 · 대','2철산동 56-21 개공 3,100,000원 세로(가) · 제2종일반주거지역 · 도']);
    // 표 순서 바꾸면 따라감
    await page.evaluate(()=>{LANDS.reverse();landChanged();});
    assert.match(await page.textContent('#sd_lands .sl:first-child'),/56-21/);
    // 다른 탭에서도 계속 보임
    await page.evaluate(()=>showTab('final'));
    assert.ok(await page.isVisible('#sd_lands'),'다른 탭에서도 보임');
    if(process.argv[2]){await page.evaluate(()=>showTab('daesang'));await page.screenshot({path:process.argv[2],clip:{x:0,y:0,width:700,height:900}});}
    assert.deepEqual(errors,[]);console.log('PASS');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
