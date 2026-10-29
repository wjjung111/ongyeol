// 사례 시점수정 지역 오조회(2026-10-21 사용자 제보) — 「장안면 사곡리 309-17」(화성시 만세구)이 '장안' 글자 때문에 수원시 장안구로 잡히던 문제
//  ① 지역 이름 바로 뒤에 면·읍·동·리가 붙으면 맞는 것으로 치지 않음 → 소재지만으로는 못 찾고(-1) 시군구 조회로 넘어감
//  ② 「장안구 정자동」처럼 진짜 구 이름이면 그대로 수원시 장안구
//  ③ 이미 수원시 장안구로 계산해 둔 사례는 다시 계산 대상(jbStaleReg), 화성시로 계산된 건 아님
//  ⑤ 「우정읍 화산리」의 '정읍'이 전북 정읍시로 잡히던 것도 — 띄어쓰기 낱말 단위로만 일치
//  ⑥ 「화산리 1228」 시군구 조회가 강원 삼척시로 잡히던 것(2026-10-28) — 본건 시군구를 붙여 먼저 찾고, 다른 시·도 후보만 여럿이면 안 고름. 옛 오조회 sgg는 켤 때 다시
//  ⑦ 「서울특별시 중구」가 한 글자 구(중) 무시로 '서울 > 종로구'(목록 첫 서울)로 잡히던 것(2026-10-29) + 옛 값 다시 계산(staleRegSgg)
//  ④ 새로고침(켤 때)해도 자동으로 다시 계산 — 처음엔 건을 바꿔 열 때만 돌아서 F5로는 안 고쳐졌다(사용자 제보)
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_time_region.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');
  fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  const page=await (await browser.newContext()).newPage();const errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.context().route('**/*',r=>{const u=r.request().url();if((u.includes('arap_access.js')||u.includes('arap_user.js')))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();
    if(u.includes('/req/search')){const q=decodeURIComponent((u.match(/query=([^&]*)/)||[])[1]||'');
      const items=/화성시/.test(q)?['경기도 화성시 만세구 우정읍 화산리 1228']:['강원특별자치도 삼척시 근덕면 화산리 1228','전북특별자치도 고창군 화산리 1228'];
      return r.fulfill({contentType:'application/json',body:JSON.stringify({response:{result:{items:items.map(a=>({address:{parcel:a}}))}}})});}
    return r.abort();});
  await page.goto(base+'/토지건물.html?mode=land',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.jbPickRegion&&window.jbStaleReg);
  const r=await page.evaluate(()=>{
    const regs=['경기 > 수원시','경기 > 수원시 > 장안구','경기 > 수원시 > 권선구','경기 > 화성시','경기 > 화성시 > 만세구','서울 > 강남구','전북 > 정읍시','서울 > 중랑구'];
    const pick=h=>{const i=jbPickRegion(regs,h);return i<0?null:regs[i];};
    return {loc:pick('장안면 사곡리 309-17'),sgg:pick('경기도 화성시 만세구 장안면 사곡리 309-17'),real:pick('수원시 장안구 정자동 100'),real2:pick('장안구 정자동 100'),
      stale:jbStaleReg({reg:'경기 수원시 장안구'},'장안면 사곡리 309-17'),ok:jbStaleReg({reg:'경기 화성시 만세구'},'장안면 사곡리 309-17'),
      okReal:jbStaleReg({reg:'경기 수원시 장안구'},'장안구 정자동 100'),
      ujeong:pick('우정읍 화산리 45-20외'),ujeongStale:jbStaleReg({reg:'전북 정읍시'},'우정읍 화산리 45-20외'),
      jeongeup:pick('전북특별자치도 정읍시 수성동 1'),jung:pick('서울특별시 중랑구'),jungSub:pick('중랑구 상봉동 74-6')};
  });
  console.log(r);
  assert.equal(r.loc,null,'장안면은 수원시 장안구가 아님');
  assert.equal(r.sgg,'경기 > 화성시 > 만세구');
  assert.equal(r.real,'경기 > 수원시 > 장안구');assert.equal(r.real2,'경기 > 수원시 > 장안구');
  assert.equal(r.stale,true);assert.equal(r.ok,false);assert.equal(r.okReal,false);
  assert.equal(r.ujeong,null,'우정읍은 정읍시가 아님');assert.equal(r.ujeongStale,true);
  assert.equal(r.jeongeup,'전북 > 정읍시');assert.equal(r.jung,'서울 > 중랑구');assert.equal(r.jungSub,'서울 > 중랑구');
  // ⑥ 시군구 조회
  const six=await page.evaluate(async()=>{
    LANDS=[{fullAddr:'경기도 화성시 만세구 우정읍 화산리 664-75'}];
    const a=await caseSgg('화산리 1228'),c={sgg:'강원특별자치도 삼척시'},c2={sgg:'강원특별자치도 삼척시',sggV:2},c3={sgg:'경기도 화성시'};
    return {a,stale:staleSgg(c),fresh:staleSgg(c2),same:staleSgg(c3)};});
  console.log('⑥',six);
  assert.equal(six.a,'경기도 화성시 만세구');assert.equal(six.stale,true);assert.equal(six.fresh,false);assert.equal(six.same,false);
  // ⑦ 한 글자 구
  const sev=await page.evaluate(()=>{
    const regs=['서울','서울 > 종로구','서울 > 중구','부산 > 중구','대구 > 동구','인천 > (구)중구','경기 > 화성시','경기 > 화성시 > 만세구'];
    const pick=h=>{const i=jbPickRegion(regs,h);return i<0?null:regs[i];};
    return {jung:pick('서울특별시 중구 광희동2가 246-2'),jungSido:pick('서울특별시 중구'),busan:pick('부산광역시 중구 중앙동 1'),
      sangbong:pick('상봉동 74-6'),seoulOnly:pick('서울특별시'),incheon:pick('인천광역시 중구 신포동 1'),hwaseong:pick('화성시 우정읍 화산리 1'),
      stale:staleRegSgg({sgg:'서울특별시 중구',loc:'광희동2가 246-2',timeMeta:{reg:'서울 종로구'}}),
      ok:staleRegSgg({sgg:'서울특별시 중구',loc:'광희동2가 246-2',timeMeta:{reg:'서울 중구'}}),
      noSgg:staleRegSgg({loc:'광희동2가 246-2',timeMeta:{reg:'서울 종로구'}})};});
  console.log('⑦',sev);
  assert.equal(sev.jung,'서울 > 중구');assert.equal(sev.jungSido,'서울 > 중구');assert.equal(sev.busan,'부산 > 중구');
  assert.equal(sev.sangbong,null,'상봉동은 동구 아님');assert.equal(sev.seoulOnly,'서울');assert.equal(sev.incheon,'인천 > (구)중구');
  assert.equal(sev.hwaseong,'경기 > 화성시');assert.equal(sev.stale,true);assert.equal(sev.ok,false);assert.equal(sev.noSgg,false);
  // ④ 저장 → 새로고침 → 켤 때 자동 재계산(통신 막힘 → 본건 시군구 화성시로)
  await page.evaluate(()=>{
    LANDS=[{소재지:'우정읍 화산리',지번:'664-75',fullAddr:'경기도 화성시 우정읍 화산리 664-75',지목:'임',면적:'2000',용도지역:'계획관리',공시지가:'100000',stdIdx:0}];
    STDS=[{소재지:'화산리',지번:'2',공시지가:'100000'}];
    TRADES=[{loc:'장안면 사곡리 309-17',use:'계획관리',jimok:'임야',date:'2025.08.04',landA:'2475',total:'273595291',timeMeta:{reg:'경기 수원시 장안구',use:'계획관리지역',from:'25.08.04',to:'26.10.19',factor:'1.02191'},
      gaMem:{f:{ga_time:'1.02191'}}},{loc:'화산리 1228',sgg:'강원특별자치도 삼척시',use:'계획관리',jimok:'공장용지',date:'2024.12.31',landA:'1000',total:'500000000',
      timeMeta:{reg:'강원 삼척시',use:'계획관리지역',from:'24.12.31',to:'26.10.19',factor:'1.03812'}},
      {loc:'광희동2가 246-2',sgg:'서울특별시 중구',sggV:2,use:'일반상업',jimok:'대',date:'2026.05.13',landA:'67.2',total:'2300000000',
      timeMeta:{reg:'서울 종로구',use:'상업지역',from:'26.05.13',to:'26.10.19',factor:'1.01639'}}];
    document.getElementById('base_gijun').value='2026.10.19';renderLands();renderTrade();calcGongsi();saveForm();
  });
  await page.goto(base+'/토지건물.html?mode=land&last=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.TRADES&&TRADES[0]&&TRADES[0].timeMeta&&!/수원/.test(TRADES[0].timeMeta.reg)&&TRADES[1].timeMeta&&!/삼척/.test(TRADES[1].timeMeta.reg)&&TRADES[2].timeMeta&&!/종로/.test(TRADES[2].timeMeta.reg),null,{timeout:20000}).catch(async e=>{console.log(await page.evaluate(()=>JSON.stringify(TRADES.map(t=>({m:t.timeMeta,s:t.sgg,e:t.timeErr,b:t.timeBusy})))));throw e;});
  const re=await page.evaluate(()=>({reg:TRADES[0].timeMeta.reg,f:TRADES[0].timeMeta.factor,mem:TRADES[0].gaMem.f.ga_time,cell:document.getElementById('tradeTime_0').textContent,reg1:TRADES[1].timeMeta.reg,reg2:TRADES[2].timeMeta.reg}));
  console.log('④ 새로고침 뒤',re);
  assert.ok(/화성시/.test(re.reg));assert.equal(re.mem,re.f,'옮겨 적어 둔 거래사례비교법 시점수정도 새 값');assert.ok(re.cell.includes('화성시'));assert.ok(/화성시/.test(re.reg1),'삼척으로 잡혔던 사례도 화성시로');assert.equal(re.reg2,'서울 중구','종로구로 잡혔던 광희동2가 사례는 중구로');
  assert.deepEqual(errs,[]);
  console.log('\n✅ 사례 시점수정 지역 검증 통과');
  await browser.close();server.close();
})().catch(e=>{console.error('❌',e);process.exit(1);});
