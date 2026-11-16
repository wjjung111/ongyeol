// 토지건물 지가변동률 — ① 신설 구(화성시 만세구, 2026.02 신설) 신설 전 달은 상위 지역(화성시) 값으로 채움(KAIS 계산식과 같은 값)
// ② 사례 용도지역 「계획관리」가 「보전관리지역」으로 잡히던 것 고침 ③ 옛 오조회 시점수정치는 지우고 다시 계산
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_jibyun_newgu.cjs
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
  // ①-가 KAIS 화면과 대조 — 입력 고정. KAIS 값은 2026-10-19(최신 공표월 2026.08) 화면이라, 그날 arap_jibyun_data.js에 있던 월별 변동률을 그대로 박아 둔다.
  //   arap_jibyun_data.js는 매일 자동갱신돼 2026-11-02에 2026.09(만세구 계획관리 0.102%)가 들어오면서, 같은 기간 값이 1.01320 → 1.01330으로 바뀌었다
  //   (9.1~10.19 미공표 추정 「1+0.099%×49/31」이 「(1+0.102%)×(1+0.102%×19/30)」로 대체). 계산이 틀린 게 아니라 자료가 늘어난 것.
  const PIN={latestYm:202608,months:['202601','202602','202603','202604','202605','202606','202607','202608'],
    rates:{'경기 > 화성시':{'계획관리지역':{202601:0.202,202602:0.198,202603:0.161,202604:0.231,202605:0.138,202606:0.087,202607:0.074,202608:0.117},
                          '생산관리지역':{202601:0.16,202602:0.074,202603:0.152,202604:0.117,202605:0.133,202606:0.032,202607:0.009,202608:0.013}},
           '경기 > 화성시 > 만세구':{'계획관리지역':{202602:0.191,202603:0.176,202604:0.235,202605:0.136,202606:0.066,202607:0.051,202608:0.099},
                          '생산관리지역':{202602:0.074,202603:0.148,202604:0.101,202605:0.13,202606:0.026,202607:-0.007,202608:0.002}}},cum:{}};
  const r=await page.evaluate(async PIN=>{
    const F=ARAP_JIBYUN_DATA,g={y:2026,mo:1,d:1},e={y:2026,mo:10,d:19},out={};
    window.ARAP_JIBYUN_DATA=PIN;jbState.latestYm=PIN.latestYm;
    try{
      out.plan=(await roneCumulative('경기 > 화성시 > 만세구','계획관리지역',g,e)).toFixed(5);
      out.prod=(await roneCumulative('경기 > 화성시 > 만세구','생산관리지역',g,e)).toFixed(5);
    }finally{window.ARAP_JIBYUN_DATA=F;}
    // ①-나 지금 파일 그대로 — 기대값은 아래에서 파일로부터 따로 계산해 대조
    jbState.latestYm=+F.latestYm;
    out.livePlan=(await roneCumulative('경기 > 화성시 > 만세구','계획관리지역',g,e)).toFixed(5);
    out.liveProd=(await roneCumulative('경기 > 화성시 > 만세구','생산관리지역',g,e)).toFixed(5);
    out.pick=['계획관리','계획관리지역','생산관리','보전관리','관리지역','2종일주','자연녹지'].map(h=>F.uses[jbPickUse(F.uses,h)]);
    return out;
  },PIN);
  console.log(r);
  assert.equal(r.plan,'1.01320');   // KAIS 「경기도 화성시 만세구 (26.01.01~26.10.19) (계획관리)」 ≒ 1.01320
  assert.equal(r.prod,'1.00639');   // 같은 화면 생산관리 0.639%
  // 지금 파일 기대값: 26.01~최신 공표월은 월별 곱(신설 전 1월은 상위 화성시 값 → 연도 누계 대신 월별 곱), 10월은 공표됐으면 19/31 일할,
  // 아니면 미공표 첫날~10.19를 마지막 공표월 변동률 × 일수/그 달 일수로 한 번
  const live=(()=>{const w={};new Function('window',fs.readFileSync(path.join(root,'arap_jibyun_data.js'),'utf8'))(w);
    const F=w.ARAP_JIBYUN_DATA,latest=+F.latestYm,days=(y,m)=>new Date(y,m,0).getDate();
    return use=>{const own=F.rates['경기 > 화성시 > 만세구'][use],par=F.rates['경기 > 화성시'][use];let f=1,last=null;
      for(let m=1;m<=10;m++){const ym=202600+m;
        if(ym>latest){const d=Math.round((new Date(2026,9,19)-new Date(2026,m-1,1))/864e5)+1;f*=1+last.r/100*d/days(2026,last.m);break;}
        const v=own[ym]!=null?own[ym]:par[ym];f*=m===10?1+v/100*19/31:1+v/100;last={r:v,m};}
      return f.toFixed(5);};})();
  assert.equal(r.livePlan,live('계획관리지역'),'지금 파일 계획관리');
  assert.equal(r.liveProd,live('생산관리지역'),'지금 파일 생산관리');
  assert.deepEqual(r.pick,['계획관리지역','계획관리지역','생산관리지역','보전관리지역','관리(통합)지역','주거지역','녹지지역']);
  // ③ 옛 오조회(계획관리 사례에 보전관리지역 값) → 표를 그릴 때 지운다
  const st=await page.evaluate(()=>{TRADES=[{loc:'팔탄면 율암리 35-3',use:'계획관리',date:'2026.09.03',timeMeta:{reg:'경기 화성시 만세구',use:'보전관리지역',from:'26.09.03',to:'26.10.19',factor:'1.00120'}},{use:'2종일주',timeMeta:{use:'주거지역',factor:'1.001'}},{}];
    ETC={type:'t',idx:-1};GA={idx:-1};renderTrade();return TRADES.map(c=>c.timeMeta?c.timeMeta.use:null);});
  assert.deepEqual(st,[null,'주거지역',null]);
  assert.deepEqual(errs,[]);
  console.log('✅ 모두 통과');
  await browser.close();server.close();
})().catch(e=>{console.error('❌',e);process.exit(1);});
