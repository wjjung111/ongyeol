// 토지건물 지가변동률 — 작성일자가 오늘보다 앞이면 그날까지 공표되지 않았던 달은 계산에서 빼고,
// 작성일 당시 마지막 공표월 변동률로 연장 적용한다(2026-11-26). 작성일이 비었으면 받아 둔 자료 전부(종전과 같음).
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_jibyun_writeday.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');
  fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
  const ctx=await browser.newContext();const page=await ctx.newPage();const errs=[];
  page.on('pageerror',e=>errs.push(e.message));
  await ctx.route('**/*',r=>{const u=r.request().url();
    if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});
    if(u.startsWith(base))return r.continue();return r.abort();});
  await page.goto(base+'/토지건물.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.roneCumulative&&window.ARAP_JIBYUN_DATA);
  // 자료 고정 — 2026.10월분까지 받아 둔 상태(공표일: 8월분 9/25, 9월분 10/28, 10월분 11/25)
  const R={202601:0.2,202602:0.1,202603:0.1,202604:0.1,202605:0.1,202606:0.1,202607:0.1,202608:0.15,202609:0.3,202610:0.128};
  const PIN={latestYm:202610,months:Object.keys(R),rates:{'경기 > 광주시':{'계획관리지역':R}},cum:{'경기 > 광주시':{'계획관리지역':{202608:0.955,202609:1.258,202610:1.388}}}};
  const r=await page.evaluate(async PIN=>{
    const F=ARAP_JIBYUN_DATA,g={y:2026,mo:1,d:1},e={y:2026,mo:10,d:8},out={},wd=document.getElementById('ov_writeDay');
    window.ARAP_JIBYUN_DATA=PIN;jbState.latestYm=PIN.latestYm;
    const run=async v=>{wd.value=v;return {cap:jbCapYm(),f:(await roneCumulative('경기 > 광주시','계획관리지역',g,e)).toFixed(5),note:jbCapNote(e)};};
    try{
      out.blank=await run('');              // 작성일 없음 → 전부
      out.oct08=await run('2026.10.08');    // 8월분까지 공표 → 9.1~10.8(38일)은 8월 변동률로 연장
      out.raw8=await run('20261008');       // 점 없이 8자리로 적어도 같음
      out.oct27=await run('2026.10.27');    // 9월분 공표 전날 → 여전히 8월분까지
      out.oct28=await run('2026.10.28');    // 9월분 공표 → 10.1~10.8(8일)은 9월 변동률로 연장
      out.nov25=await run('2026.11.25');    // 10월분 공표 → 전부
      out.future=await run('2099.01.01');   // 오늘 이후 → 전부
      // 계산해 둔 사례 값: 작성일을 당기면 다시 계산, 같은 작성일이면 저장된 값
      document.getElementById('base_gijun').value='2026.10.08';
      jbState.tbl=jbState.tbl||{id:'x'};jbState.regs=['경기 > 광주시'];jbState.uses=['계획관리지역'];
      const c={loc:'경기도 광주시 문형동 120-15',use:'계관',base:'2026.01.01'};
      wd.value='';const a=await computeCaseTime(c,'a',null,false);out.c1={f:a.meta.factor,use:a.meta.use,cached:a.cached};
      wd.value='2026.10.08';const b=await computeCaseTime(c,'a',null,false);out.c2={f:b.meta.factor,pub:b.meta.pub,cached:b.cached};
      const d=await computeCaseTime(c,'a',null,false);out.c3={f:d.meta.factor,cached:d.cached};
      // 한도를 안 적어 둔 옛 저장값 — 작성일 때문에 뒤 달을 빼야 하면 다시 계산
      c.timeMeta={reg:'경기 광주시',use:'계획관리지역',from:'26.01.01',to:'26.10.08',factor:'9.99999'};
      const o=await computeCaseTime(c,'a',null,false);out.c4={f:o.meta.factor,cached:o.cached};
      wd.value='';c.timeMeta={reg:'경기 광주시',use:'계획관리지역',from:'26.01.01',to:'26.10.08',factor:'9.99999'};
      const k=await computeCaseTime(c,'a',null,false);out.c5={f:k.meta.factor,cached:k.cached};   // 작성일 없으면 옛 값 그대로(자동 재계산 안 함)
    }finally{window.ARAP_JIBYUN_DATA=F;jbState.latestYm=+F.latestYm;wd.value='';}
    return out;
  },PIN);
  console.log(r);
  const all=((1+1.258/100)*(1+0.128/100*8/31)).toFixed(5);      // 1~9월 누계 × 10월 8/31
  const aug=((1+0.955/100)*(1+0.15/100*38/31)).toFixed(5);       // 1~8월 누계 × 8월 변동률 38/31
  const sep=((1+1.258/100)*(1+0.3/100*8/30)).toFixed(5);         // 1~9월 누계 × 9월 변동률 8/30
  assert.deepEqual([r.blank.cap,r.blank.f,r.blank.note],[202610,all,'']);
  assert.deepEqual([r.oct08.cap,r.oct08.f],[202608,aug]);
  assert.match(r.oct08.note,/2026\.08월 공표분까지/);
  assert.deepEqual([r.raw8.cap,r.raw8.f],[202608,aug]);
  assert.deepEqual([r.oct27.cap,r.oct27.f],[202608,aug]);
  assert.deepEqual([r.oct28.cap,r.oct28.f],[202609,sep]);
  assert.deepEqual([r.nov25.cap,r.nov25.f,r.nov25.note],[202610,all,'']);
  assert.deepEqual([r.future.cap,r.future.f],[202610,all]);
  assert.deepEqual(r.c1,{f:all,use:'계획관리지역',cached:false});   // 「계관」 → 계획관리지역
  assert.deepEqual(r.c2,{f:aug,pub:202608,cached:false});
  assert.deepEqual(r.c3,{f:aug,cached:true});
  assert.deepEqual(r.c4,{f:aug,cached:false});
  assert.deepEqual(r.c5,{f:'9.99999',cached:true});
  assert.deepEqual(errs,[]);
  console.log('✅ 모두 통과');
  await browser.close();server.close();
})().catch(e=>{console.error('❌',e);process.exit(1);});
