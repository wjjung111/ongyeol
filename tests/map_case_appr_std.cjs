// 거래사례 위치도(p9v3xk2m.html) — KAPA 평가사례 붙여넣기 · 표준지 입력/자동 채움 · 구역 배치
// 확인: KAPA 머리글째 붙이기 → 평가사례 표·탭 전환·지도 항목(주황, 「평가 #n」, 토지는 필지) ·
//       표준지 지번 추가 → 토지특성으로 용도지역·지목·면적·이용상황·도로·형상·지세·공시지가·연도 · 지도 항목(파랑, 「표준지 #n」) ·
//       KAIS 붙여넣기 「집합건물」 고르면 집건 표로 · 오른쪽 구역 ①②③ 순서
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n.slice(1));
  if(!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript':'text/html; charset=utf-8');res.end(fs.readFileSync(f));});
const json=o=>({contentType:'application/json',body:JSON.stringify(o)});
const KAPA='평가목적\t복사\t연도\t물건\t소재지\t지번(*)\t지번\t단가\t면적\t지목/건물용도\t용도지역/구조\t평가액/면적\t기준시점\t평가액(개별)\t감정평가총액\t(개별)공시연도\t(개별)공시지가\t(개별)지목\t(개별)이용상황\t(개별)용도지역\t(개별)도로교통\t형상\n'+
 '담보\t복사\t2026\t토지\t서울특별시 영등포구 여의도동\t17-2*\t17-26\t43,500,000\t793\t대\t일반상업\t43,500,000\t2026-04-23\t34,495,500,000\t40,432,096,500\t2026\t14,450,000\t대\t업무용\t일반상업\t중로한면\t세장형\n'+
 '담보\t복사\t2026\t집합건물\t서울특별시 영등포구 여의도동\t44-*\t\t59,900,000\t\t대\t일반상업\t59,900,000\t2026-01-29\t\t60,030,920,980\t\t\t\t\t\t\t';
const KAIS_JIP='소재지\t지번\t기타주소\t거래시점\t전용면적\t물건금액\n서울특별시 영등포구 여의도동\t44\t광장 1동 701호\t2026-05-01\t84.9\t1,500,000,000';
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL});
try{
  const page=await browser.newPage({viewport:{width:1500,height:1300}});
  page.on('pageerror',e=>{console.error('pageerror',e.message);process.exitCode=1;});
  await page.route(/unpkg\.com|dapi\.kakao|openstreetmap|xdworld/,r=>r.abort());
  await page.route(/api\.vworld\.kr\/req\/search/,r=>{const q=new URL(r.request().url()).searchParams.get('query');
    r.fulfill(json({response:{status:'OK',result:{items:/17-26$/.test(q)?[{id:'1156011000100170026',point:{x:'126.92',y:'37.53'},address:{parcel:'서울특별시 영등포구 여의도동 17-26'}}]:[]}}}));});
  await page.route(/getLandCharacteristics/,r=>r.fulfill(json({landCharacteristicss:{field:[
    {stdrYear:'2025',lastUpdtDt:'2025-05-30',lndcgrCodeNm:'대',lndpclAr:'793',ladUseSittnNm:'업무용',roadSideCodeNm:'중로한면',tpgrphFrmCodeNm:'세로장방',tpgrphHgCodeNm:'평지',pblntfPclnd:'13900000',prposArea1Nm:'일반상업지역',prposArea2Nm:'지정되지않음'},
    {stdrYear:'2026',lastUpdtDt:'2026-05-29',lndcgrCodeNm:'대',lndpclAr:'793',ladUseSittnNm:'업무용',roadSideCodeNm:'중로한면',tpgrphFrmCodeNm:'세로장방',tpgrphHgCodeNm:'평지',pblntfPclnd:'14450000',prposArea1Nm:'일반상업지역',prposArea2Nm:'지정되지않음'}]}})));
  await page.route(/api\.vworld\.kr\/req\/data|workers\.dev/,r=>r.fulfill(json({})));
  // 접속 기록: 이름이 없으면 게이트, 이름이 있으면 '거래사례 위치도' 페이지로 접속·동작 기록이 나간다
  const visits=[];
  await page.route(/script\.google\.com/,r=>{const q=new URL(r.request().url()).searchParams;visits.push({page:q.get('page'),user:q.get('user'),action:q.get('action'),detail:q.get('detail')});r.fulfill(json({ok:true}));});
  await page.route(/ipwho\.is|ipapi\.co/,r=>r.fulfill(json({success:true,ip:'1.2.3.4',country:'South Korea',region:'Seoul',city:'Seoul'})));
  await page.goto(base+'/p9v3xk2m.html');
  await page.evaluate(()=>localStorage.clear());await page.reload();
  assert.equal(await page.evaluate(()=>!!document.getElementById('arap-name-gate')),true,'이름 게이트');
  await page.waitForTimeout(200);assert.equal(visits.length,0,'이름 전엔 기록 없음');
  await page.evaluate(()=>localStorage.setItem('arap-user-name','테스트'));await page.reload();
  // 구역 순서
  const heads=await page.$$eval('#paneSide .sec-h',a=>a.map(x=>x.textContent.replace(/\s+/g,' ').trim().slice(0,6)));
  assert.deepEqual(heads.map(h=>h.slice(0,3)),['①본건','②사례','③표준']);
  const paste=(sel,text)=>page.$eval(sel,(el,t)=>{const dt=new DataTransfer();dt.setData('text',t);el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));},text);
  // KAPA 평가사례
  await paste('#pasteAppr',KAPA);
  let a=await page.evaluate(()=>DATA.appr.map(r=>({loc:r.loc,purp:r.purp,obj:r.obj,unit:r.unit,base:r.base,gongsi:r.gongsi,memo:r.memo||''})));
  assert.deepEqual(a[0],{loc:'서울특별시 영등포구 여의도동 17-26',purp:'담보',obj:'토지',unit:'43,500,000',base:'2026.04.23',gongsi:'14,450,000',memo:''});
  assert.equal(a[1].memo,'지번 일부 가림(*) — 위치 확인');
  assert.equal(await page.$eval('#tab-appr',e=>e.classList.contains('active')),true);
  assert.equal(await page.textContent('#cntAppr'),'2');
  let it=await page.evaluate(()=>mapItems().filter(x=>x.kind==='평가사례').map(x=>[x.label,x.color,x.poly,x.lines.join('|')]));
  assert.deepEqual(it[0],['평가 #1','#ea580c',true,'여의도동 17-26|담보|43,500,000 원/㎡|2026.04.23']);
  assert.equal(it[1][2],false);   // 집합건물 평가사례는 점
  // 표준지
  await page.fill('#addStd','여의도동 17-26');await page.click('#paneSide .sec:nth-of-type(3) .addloc .btn.pri');
  await page.waitForFunction(()=>/건 중/.test(document.getElementById('msgStd').textContent));
  const s=await page.evaluate(()=>{const r=DATA.std[0];return [r.use,r.jimok,r.area,r.cond,r.road,r.shape,r.slope,r.gongsi,r.gongsiYear];});
  assert.deepEqual(s,['일반상업지역','대','793','업무용','중로한면','세로장방','평지','14450000','2026']);
  assert.equal(await page.$eval('#tblStd tr:nth-child(2) td:nth-child(11) input',x=>x.value),'14,450,000');
  it=await page.evaluate(()=>mapItems().filter(x=>x.kind==='표준지').map(x=>[x.label,x.color,x.lines.join('|')]));
  assert.deepEqual(it,[['표준지 #1','#2563eb','여의도동 17-26|일반상업지역|업무용|14,450,000 원/㎡']]);
  // 못 찾는 표준지
  await page.fill('#addStd','없는동 1');await page.click('#paneSide .sec:nth-of-type(3) .addloc .btn.pri');
  await page.waitForFunction(()=>/못 찾음/.test(document.getElementById('msgStd').textContent));
  // KAIS 집합건물
  await page.click('.seg label:has-text("집합건물")');
  await paste('#pasteKais',KAIS_JIP);
  assert.equal(await page.evaluate(()=>DATA.jip.length),1);assert.equal(await page.$eval('#tab-jip',e=>e.classList.contains('active')),true);
  // 칩 목록에 네 종류
  const chips=await page.$$eval('#pickChips .chip label',a=>a.map(x=>x.textContent.split(/\s/)[0]));
  assert.ok(chips.includes('평가')&&chips.includes('표준지')&&chips.includes('집건'),chips.join(','));
  // 새로고침해도 유지(평가·표준지·KAIS 선택)
  await page.waitForTimeout(400);await page.reload();
  assert.deepEqual(await page.evaluate(()=>[DATA.appr.length,DATA.std.length,DATA.kaisMode]),[2,2,'jip']);
  await page.evaluate(()=>showTab('land'));
  await page.screenshot({path:process.env.SHOT||'/dev/null',clip:{x:1030,y:40,width:470,height:1260}}).catch(()=>{});
  await page.waitForTimeout(300);
  const acts=visits.map(v=>v.action);
  assert.ok(visits.every(v=>v.page==='거래사례 위치도'&&v.user==='테스트'),JSON.stringify(visits));
  for(const x of ['접속','KAPA 붙여넣기','표준지 추가','KAIS 붙여넣기'])assert.ok(acts.includes(x),x+' 기록 '+acts.join(','));
  assert.equal(visits.find(v=>v.action==='KAPA 붙여넣기').detail,'평가사례 2건');
  console.log('OK map_case_appr_std');
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);process.exit(1);});
