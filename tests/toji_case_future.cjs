// 기준시점(작성일자)보다 늦은 사례 막기(2026-11-26) — 집건 dateAfterWarn과 같은 규칙
//  ① 거래일자·평가사례 기준시점이 본건 기준시점보다 뒤면 칸이 빨갛고 경고 줄이 뜬다
//  ② 그런 사례는 그 밖의 요인·거래사례비교법에 선정되지 않는다(알림)
//  ③ 시점수정 계산은 거절(사례시점 > 기준시점) — 옛 저장값 timeMeta도 지움
//  ④ 날짜를 고치면 경고가 바로 사라지고 선정된다
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_case_future.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');
  fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true});
  const ctx=await browser.newContext({viewport:{width:1700,height:1000}});const page=await ctx.newPage();const errs=[],dialogs=[];
  page.on('pageerror',e=>errs.push(e.message));
  page.on('dialog',d=>{dialogs.push(d.message());d.accept();});
  await ctx.route('**/*',r=>{const u=r.request().url();if((u.includes('arap_access.js')||u.includes('arap_user.js')))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
  await page.goto(base+'/토지건물.html?mode=land',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.renderLands&&window.calcGongsi);
  await page.evaluate(()=>{
    document.getElementById('base_gijun').value='2026.03.31';
    const tm={reg:'대구 동구',use:'주거',from:'26.11.20',to:'26.03.31',factor:'1.00000'};
    TRADES=[{loc:'율암동 10',use:'준주거',date:'2025.06.01',landA:'100',total:'100000000'},
            {loc:'율암동 11',use:'준주거',date:'2026.11.20',landA:'100',total:'100000000',timeMeta:tm},{}];
    APPRS=[{no:'a',loc:'율암동 1103-11',use:'준주거',unit:'1620000',base:'2025.05.01'},
           {no:'f',loc:'상매동 515-4',use:'준주거',unit:'1800000',base:'2026.11.20',timeMeta:tm},{}];
    ETC={type:'t',idx:-1,std:0};GA={idx:-1};
    renderTrade();renderAppr();syncPick();calcGongsi();
  });
  await page.evaluate(()=>{try{showTab('gongsi');}catch(e){}});
  const r1=await page.evaluate(()=>({
    tFut:[...document.querySelectorAll('#tblTrade td.dt-c')].map(td=>td.classList.contains('fut')),
    aFut:[...document.querySelectorAll('#tblAppr tr[data-i]')].map(tr=>tr.classList.contains('fut')),
    mt:document.getElementById('futTradeMsg').style.display, mtx:document.getElementById('futTradeMsg').textContent,
    ma:document.getElementById('futApprMsg').style.display}));
  console.log('①',r1);
  assert.deepEqual(r1.tFut,[false,true,false]);assert.deepEqual(r1.aFut,[false,true,false]);
  assert.equal(r1.mt,'');assert.equal(r1.ma,'');assert.match(r1.mtx,/거래사례 1건/);
  // ② 선정 막기
  const r2=await page.evaluate(()=>{pickEtc('a',1);const e1=ETC.idx;pickEtc('t',1);const e2=ETC.idx;pickGa(1);const g=GA.idx;
    pickEtc('a',0);const ok=ETC.type+ETC.idx;return {e1,e2,g,ok};});
  console.log('②',r2,dialogs.length);
  assert.equal(r2.e1,-1);assert.equal(r2.e2,-1);assert.equal(r2.g,-1);assert.equal(r2.ok,'a0');assert.equal(dialogs.length,3);
  // ③ 시점수정 거절
  const r3=await page.evaluate(async()=>{try{await computeCaseTime(APPRS[1],'a',null,false);return 'no-throw';}catch(e){return {m:e.message,f:!!e.future,meta:APPRS[1].timeMeta||null};}});
  console.log('③',r3);assert.equal(r3.f,true);assert.equal(r3.meta,null);
  if(process.env.TOJI_OUT)await page.screenshot({path:path.join(process.env.TOJI_OUT,'toji_case_future.png'),fullPage:false});
  if(process.env.TOJI_OUT)await page.locator('#gsApprCard').screenshot({path:path.join(process.env.TOJI_OUT,'toji_case_future_appr.png')});
  // ④ 날짜 고치면 풀림
  const inp=page.locator('#tblTrade td.dt-c[data-i="1"] input');await inp.fill('2026.01.10');
  const r4=await page.evaluate(()=>({fut:document.querySelector('#tblTrade td.dt-c[data-i="1"]').classList.contains('fut'),mt:document.getElementById('futTradeMsg').style.display,
    sel:(pickGa(1),GA.idx)}));
  console.log('④',r4);assert.equal(r4.fut,false);assert.equal(r4.mt,'none');assert.equal(r4.sel,1);
  // 기준시점을 늦추면 평가사례 경고도 풀림
  await page.evaluate(()=>{const el=document.getElementById('base_gijun');el.value='2026.12.01';el.dispatchEvent(new Event('input'));});
  const r5=await page.evaluate(()=>document.getElementById('futApprMsg').style.display);assert.equal(r5,'none');
  assert.deepEqual(errs,[]);
  console.log('✅ toji_case_future 통과');
  await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1);});
