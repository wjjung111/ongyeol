// 토지건물 날짜칸(기준시점·현장조사일·작성일자·의뢰일) 달력 팝업 — 처음 누를 때 + 커서가 남은 칸을 다시 누를 때도 뜨는지
// (2026-11-22: 날짜 고른 뒤·Esc·직접 입력 후 같은 칸을 다시 누르면 달력이 안 뜨던 문제)
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/date_popup_reclick.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.css')?'text/css':'text/javascript');fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL});
  try{
    const ctx=await browser.newContext({viewport:{width:1400,height:900}});
    await ctx.route('**/*',r=>{const u=r.request().url();
      if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});
      if(u.startsWith(base))return r.continue();return r.abort();});
    await ctx.addInitScript(()=>{try{localStorage.setItem('arap-user-name','wdw');}catch(e){}});
    const pg=await ctx.newPage(),errors=[];pg.on('pageerror',e=>errors.push(e.message));
    await pg.goto(base+'/토지건물.html',{waitUntil:'load'});await pg.waitForSelector('#base_gijun');
    const has=()=>pg.evaluate(()=>!!document.querySelector('.arap-calpop'));
    for(const id of ['base_gijun','base_josa','ov_writeDay','ov_orderDay']){
      await pg.click('#'+id);assert.ok(await has(),id+': 처음 누르면 달력');
      await pg.click('.arap-calpop button[data-day]:nth-of-type(10)');
      assert.ok(!(await has()),id+': 날짜 고르면 닫힘');assert.match(await pg.inputValue('#'+id),/^\d{4}[./]\d{2}[./]\d{2}$/,id+': 날짜가 채워짐');
      await pg.click('#'+id);assert.ok(await has(),id+': 날짜 고른 뒤 같은 칸을 다시 누르면 달력');
      await pg.keyboard.press('Escape');assert.ok(!(await has()),id+': Esc로 닫힘');
      await pg.click('#'+id);assert.ok(await has(),id+': Esc 뒤 다시 누르면 달력');
      await pg.keyboard.press('Escape');
    }
    // 직접 입력 → Esc → 다시 클릭
    await pg.fill('#base_josa','');await pg.click('#base_josa');await pg.keyboard.type('20260731');
    assert.equal(await pg.inputValue('#base_josa'),'2026.07.31');
    await pg.keyboard.press('Escape');await pg.click('#base_josa');assert.ok(await has(),'직접 입력 후 다시 누르면 달력');
    // 달력이 떠 있을 때 칸을 또 눌러도 하나만
    await pg.click('#base_josa');assert.equal(await pg.evaluate(()=>document.querySelectorAll('.arap-calpop').length),1,'달력은 하나만');
    assert.deepEqual(errors,[]);
    console.log('date_popup_reclick OK');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
