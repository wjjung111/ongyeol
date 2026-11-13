// 집합건물 앱 첫 화면 방식 검증(2026-11-13) — 처음 들어오면(북마크·새 탭) 단일 호수, 새로고침(F5)·같은 탭에서는 하던 방식 유지, ?mode=multi면 여러 호수
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/jiphap_default_mode.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true});
  try{
    const ctx=await browser.newContext({viewport:{width:1500,height:900}});
    await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});return u.startsWith(base)?r.continue():r.abort();});
    await ctx.addInitScript(()=>{if(!sessionStorage.getItem('__init')){sessionStorage.setItem('__init','1');localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-jiphap-mode','multi');}});   // 지난번엔 여러 호수로 끝냄
    const mode=p=>p.evaluate(()=>document.getElementById('root').style.display!=='none'?'single':'multi');
    const p1=await ctx.newPage();await p1.goto(base+'/s3r86w8a.html');await p1.locator('#root .jr-rail').waitFor();
    assert.equal(await mode(p1),'single','새로 들어오면 단일 호수(지난번 여러 호수였어도)');
    await p1.click('#btn-multi');assert.equal(await mode(p1),'multi');
    await p1.reload();await p1.locator('#root-multi .jr-rail').waitFor();await p1.waitForTimeout(300);
    assert.equal(await mode(p1),'multi','새로고침이면 하던 방식(여러 호수) 유지');
    await p1.goto(base+'/s3r86w8a.html');await p1.waitForTimeout(800);
    assert.equal(await mode(p1),'multi','같은 탭에서 다시 들어와도 유지');
    const p2=await ctx.newPage();await p2.goto(base+'/s3r86w8a.html');await p2.waitForTimeout(800);
    assert.equal(await mode(p2),'single','새 탭은 단일 호수');
    await p2.goto(base+'/s3r86w8a.html?mode=multi');await p2.waitForTimeout(800);
    assert.equal(await mode(p2),'multi','?mode=multi면 여러 호수');
    console.log('PASS');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
