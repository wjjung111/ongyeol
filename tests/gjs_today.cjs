// 기준시가.html 평가기준일 = 열 때마다 오늘(한국시간)
// ① 저장된 지난 날짜(2026-11-16)를 되살리지 않음 ② 오전 9시 전(UTC로는 전날)에도 한국 날짜 ③ 고시연도도 그 날짜로
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/gjs_today.cjs
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
    // [UTC 시각, 기대 한국 날짜] — 2026-11-22 23:30Z = 한국 11-23 08:30
    for(const [utc,kst] of [['2026-11-22T23:30:00Z','2026-11-23'],['2026-11-23T05:00:00Z','2026-11-23']]){
      const ctx=await browser.newContext({timezoneId:'UTC'}),pg=await ctx.newPage(),errors=[];
      pg.on('pageerror',e=>errors.push(e.message));
      await ctx.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
      await pg.clock.setFixedTime(new Date(utc));
      await pg.addInitScript(()=>{try{localStorage.setItem('arap-user-name','wdw');
        localStorage.setItem('ongyeol-gijunsiga-v1',JSON.stringify({mode:'sj',rows:[],basis:{},f:{evalDate:'2026-11-16',noticeYear:'2025',qAddr:'경기도 양주시 은현면 선암리 230-3'}}));}catch(e){}});
      await pg.goto(base+'/기준시가.html',{waitUntil:'domcontentloaded'});
      assert.equal(await pg.inputValue('#qDate'),kst,'간편 계산 날짜 = 오늘('+utc+')');
      assert.equal(await pg.inputValue('#evalDate'),kst);
      assert.equal(await pg.inputValue('#noticeYear'),'2026','고시연도도 오늘 날짜로');
      assert.equal(await pg.inputValue('#qAddr'),'경기도 양주시 은현면 선암리 230-3','소재지는 저장값 그대로');
      // 공동주택가격 탭도 같은 날짜
      await pg.click('.ptabs button[data-pane="apt"]');
      assert.equal(await pg.inputValue('#aDate'),kst);
      assert.deepEqual(errors,[]);
      await ctx.close();
    }
    console.log('OK gjs_today');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error('❌',e);process.exit(1);});
