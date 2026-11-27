// 거래사례 대장 대조 연면적(2026-11-27) — 동 하나(가장 큰 동)가 아니라 총괄표제부 → 표제부(주건축물 합계)
// 예: 대구 동구 율암동 1103-1 — 총괄 1,139.18 / 공장A동 286.20·공장B동 286.20·사무동 566.78
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');
  fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true});const ctx=await browser.newContext();const page=await ctx.newPage();const errs=[];
  page.on('pageerror',e=>errs.push(e.message));page.on('dialog',d=>d.accept());
  await ctx.route('**/*',r=>{const u=r.request().url();if((u.includes('arap_access.js')||u.includes('arap_user.js')))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
  await page.goto(base+'/토지건물.html?mode=land',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.bldSummary&&window.renderTrade);
  const r=await page.evaluate(()=>{
    const T=[{dongNm:'공장A동',mainAtchGbCdNm:'주건축물',totArea:'286.2',strctCdNm:'일반철골구조',useAprDay:'20151120',mainPurpsCdNm:'공장'},
             {dongNm:'공장B동',mainAtchGbCdNm:'주건축물',totArea:'286.2',strctCdNm:'일반철골구조',useAprDay:'20151120',mainPurpsCdNm:'공장'},
             {dongNm:'사무동',mainAtchGbCdNm:'주건축물',totArea:'566.78',strctCdNm:'일반철골구조',useAprDay:'20151120',mainPurpsCdNm:'공장'}];
    const withRecap=bldSummary(T,[{totArea:'1139.18'}]);
    const noRecap=bldSummary(T,[]);
    const one=bldSummary([T[2]],null);
    // 363-18 — 총괄 393.89, 주1(209.88) 주구조 비어 있음, 주2(184.01) 경량철골구조 → 주구조는 주2에서
    const s18=bldSummary([{dongNm:'주1',mainAtchGbCdNm:'주건축물',totArea:'209.88',strctCdNm:'',etcStrct:'',useAprDay:'',mainPurpsCdNm:'제조업소'},
      {dongNm:'주2',mainAtchGbCdNm:'주건축물',totArea:'184.01',strctCdNm:'경량철골구조',etcStrct:'경량철골구조',useAprDay:'20140120',mainPurpsCdNm:'창고시설'}],[{totArea:'393.89'}]);
    // 화면: 붙여넣은 건물면적 1,139.18이면 대장과 같음(주황 표시 없음)
    TRADES=[{loc:'율암동 1103-1',bldA:'1139.18',_chk:{pnu:'x',addr:'',land:{},bld:withRecap}},{},{}];renderTrade();
    return {withRecap,noRecap,one,s18,diff:chkDiffs(TRADES[0]),loc:document.querySelector('#tblTrade .chk-ok,#tblTrade .chk-e').getAttribute('title')};});
  console.log(r);
  assert.equal(r.withRecap.tot,'1139.18');assert.equal(r.withRecap.totSrc,'총괄표제부');
  assert.equal(r.noRecap.tot,'1139.18');assert.equal(r.noRecap.totSrc,'표제부 3동 합계');
  assert.equal(r.one.tot,'566.78');assert.equal(r.one.totSrc,'표제부');
  assert.equal(r.withRecap.dong,'사무동');assert.equal(r.withRecap.appr,'2015.11.20');
  assert.equal(r.s18.strct,'경량철골구조');assert.equal(r.s18.appr,'2014.01.20');assert.equal(r.s18.tot,'393.89');assert.equal(r.s18.strctDong,'주2');
  assert.deepEqual(r.diff,[]);assert.match(r.loc,/연면적: 총괄표제부/);
  assert.deepEqual(errs,[]);console.log('✅ toji_case_bld_total 통과');
  await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1);});
