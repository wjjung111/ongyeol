// 토지건물 평가사례 표 — 기호·지목 칸은 좁게, 소재지는 지번까지 잘리지 않게(2026-11-16).
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_appr_colwidth.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'application/octet-stream');
  fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const opt=process.env.PLAYWRIGHT_CHANNEL?{headless:true,channel:process.env.PLAYWRIGHT_CHANNEL}:{headless:true};
  const browser=await chromium.launch(opt);
  // 공시지가기준법 2행(거래사례|평가사례) 배치에서 평가사례 표가 약 1,000px가 되는 화면 폭
  const ctx=await browser.newContext({viewport:{width:2500,height:1200}});const page=await ctx.newPage();const errs=[];
  page.on('pageerror',e=>errs.push(e.message));
  await ctx.route('**/*',r=>{const u=r.request().url();if((u.includes('arap_access.js')||u.includes('arap_user.js')))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
  await page.goto(base+'/토지건물.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.renderAppr);
  const r=await page.evaluate(()=>{
    showTab('gongsi');
    APPRS=[{no:'a',loc:'대야동 460-12',use:'1종일주',jimok:'대',cond:'주상용',road:'소로한면',unit:'4,060,000',base:'2026-03-30',purp:'법원경매'},
           {no:'b',loc:'대야동 457-3',use:'1주',jimok:'대',cond:'주상용',road:'소로한면',unit:'2,800,000',base:'2025-07-21',purp:'담보'},
           {no:'d',loc:'대야동 465-110',use:'1종일주',jimok:'대',cond:'주상용',road:'소로한면',unit:'4,050,000',base:'2025-04-09',purp:'법원경매'}];
    renderAppr();
    const t=document.getElementById('tblAppr'),w=s=>Math.round(t.querySelector(s).getBoundingClientRect().width);
    const locs=[...t.querySelectorAll('td.ac-loc input')].map(i=>({v:i.value,fit:i.scrollWidth<=i.clientWidth}));
    return {table:Math.round(t.getBoundingClientRect().width),no:w('th.ac-no'),jimok:w('th.ac-jimok'),loc:w('th.ac-loc'),use:w('th.ac-use'),locs,
            head:t.rows[0].cells.length,row:t.rows[1].cells.length};
  });
  console.log(r);
  assert.equal(r.head,r.row,'머리행과 데이터행 칸 수가 같다');
  assert.ok(r.no<=30&&r.jimok<=30,'기호·지목 칸은 30px 이하');
  assert.ok(r.loc>r.use,'소재지 칸이 용도지역 칸보다 넓다');
  r.locs.forEach(l=>assert.ok(l.fit,'소재지 지번까지 보임: '+l.v));
  if(errs.length){console.log('페이지 오류',errs);throw new Error('page errors');}
  console.log('✅ 모두 통과');
  await browser.close();server.close();
})().catch(e=>{console.error('❌',e);process.exit(1);});
