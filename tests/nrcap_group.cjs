// 비주거용(자본수익률) 시점수정 지역 2단 — ① 시도(대그룹) → ② 상권(소그룹)
// 확인: 시점수정 계산기(arm_시점수정.html) 비주거용 탭 · 집합건물 앱(단일호수 사례 시점수정치 창) · 여러호수/입주권 화면 오류 없음
//       대그룹 정보(group)가 없는 옛 데이터면 「상권(구분 전)」 묶음으로 동작
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/nrcap_group.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
let withGroup=true;
// 실제 데이터에 대그룹(group)을 가짜로 덧붙임 + 이름 겹침 키(「대전 원도심」) 하나
const INJECT=`;(function(){var C=window.ARAP_INDEX_DATA.capReturn;var R=["서울","경기","인천","전국","부산","대구","광주","대전","울산","세종","강원","충북","충남","전북","전남","경북","경남","제주"];
  var M={"강남":"서울","도심":"서울","여의도마포":"서울","기타":"서울","분당역세권":"경기","분당":"경기","구월":"인천","부평":"인천","원도심":"인천"};
  Object.keys(C.types).forEach(function(k){var T=C.types[k],g={};Object.keys(T.regions).forEach(function(r){g[r]=R.indexOf(r)>=0?r:(M[r]||"부산");});
    if(T.regions["서울"]){T.regions["대전 원도심"]=T.regions["서울"];g["대전 원도심"]="대전";}T.group=g;});})();`;
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n.slice(1));
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8');
  let body=fs.readFileSync(f);if(n==='/arap_index_data.js'&&withGroup)body=body.toString()+INJECT;res.end(body);});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});try{
  const mk=async init=>{const ctx=await browser.newContext({viewport:{width:1300,height:900}});
    await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});return u.startsWith(base)?r.continue():r.abort();});
    await ctx.addInitScript(i=>{try{localStorage.setItem('arap-user-name','wdw');Object.entries(i||{}).forEach(([k,v])=>localStorage.setItem(k,v));}catch(e){}},init);
    const p=await ctx.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));p.on('dialog',d=>d.accept());p.setDefaultTimeout(30000);return {ctx,p};};

  // ── 1) 시점수정 계산기 비주거용 탭
  {const {ctx,p}=await mk();
    const url=base+'/'+encodeURI('arm_시점수정.html');await p.goto(url);await p.click('#tab-nr');
    const st=()=>p.evaluate(()=>{const g=id=>document.getElementById(id),o=s=>[...s.options].map(x=>x.textContent);
      return {r1:g('r1').value,r2:g('r2').value,l2:g('r2').selectedOptions[0]&&g('r2').selectedOptions[0].textContent,o1:o(g('r1')),o2:o(g('r2')),region:g('region').value,
        vis:['fld-region','fld-r1','fld-r2','fld-r3'].map(id=>getComputedStyle(g(id)).display!=='none'),lbl:g('lbl-r2').textContent};});
    let s=await st();
    assert.deepEqual(s.vis,[false,true,true,false],'비주거용: ①② 두 칸만');assert.equal(s.lbl,'② 상권');
    assert.deepEqual(s.o1.slice(0,4),['서울','경기','인천','전국'],'대그룹 순서');
    const row=await p.evaluate(()=>['kind','r1','r2'].map(id=>Math.round(document.getElementById(id).getBoundingClientRect().top)));
    assert.equal(new Set(row).size,1,'유형·①·② 한 줄');
    await p.selectOption('#r1','서울');s=await st();
    assert.equal(s.o2[0],'서울 전체');assert.ok(s.o2.includes('강남')&&!s.o2.includes('분당역세권'),'서울 상권만: '+s.o2.join(','));
    await p.selectOption('#r2','강남');s=await st();assert.equal(s.region,'강남');
    await p.fill('#tradeDate','2025.03.10');await p.fill('#baseDate','2026.08.01');await p.click('#btn-calc');
    assert.match(await p.inputValue('#resultText'),/지역 : 강남\n/);
    await p.reload();await p.click('#tab-nr');s=await st();assert.deepEqual([s.r1,s.r2],['서울','강남'],'새로고침 뒤 복원');
    await p.selectOption('#r1','경기');s=await st();assert.equal(s.region,'경기');assert.equal(s.l2,'경기 전체');
    await p.selectOption('#r1','대전');await p.selectOption('#r2',{label:'원도심'});s=await st();assert.equal(s.region,'대전 원도심','겹치는 이름은 「시도 이름」 키');
    await p.fill('#tradeDate','2025.03.10');await p.fill('#baseDate','2026.08.01');await p.click('#btn-calc');assert.match(await p.inputValue('#resultText'),/지역 : 대전 원도심\n/);
    // 주거용으로 돌아가면 ①②③ 그대로
    await p.click('#tab-res');s=await st();assert.deepEqual(s.vis,[false,true,true,true]);assert.equal(s.lbl,'② 권역');
    assert.deepEqual(p.errs,[]);await ctx.close();console.log('계산기 OK');}

  // ── 2) group 없는 옛 데이터
  withGroup=false;
  {const {ctx,p}=await mk();await p.goto(base+'/'+encodeURI('arm_시점수정.html'));await p.click('#tab-nr');
    const o1=await p.evaluate(()=>[...document.getElementById('r1').options].map(x=>x.value));
    assert.ok(o1.includes('서울')&&o1.includes('상권(구분 전)'),'옛 데이터 묶음: '+o1.join(','));
    await p.selectOption('#r1','상권(구분 전)');await p.selectOption('#r2','강남');
    await p.fill('#tradeDate','2025.03.10');await p.fill('#baseDate','2026.08.01');await p.click('#btn-calc');
    assert.match(await p.inputValue('#resultText'),/지역 : 강남\n/);
    assert.deepEqual(p.errs,[]);await ctx.close();console.log('옛 데이터 OK');}
  withGroup=true;

  // ── 3) 집합건물 앱 단일호수: 비주거용 → ③ 사례 시점수정치 창
  {const {ctx,p}=await mk({'arap-jiphap-mode':'single','arap-nrcap-region':'도심'});await p.goto(base+'/s3r86w8a.html');
    const scope=p.locator('#root');
    await scope.getByText('2. 대상물건개요',{exact:true}).click({timeout:60000});
    await scope.locator('button',{hasText:/^비주거용$/}).first().click();
    await scope.getByText('3. 사례 등 입력',{exact:true}).click();
    await scope.locator('td[style*="cursor: pointer"]').filter({hasNotText:'✕'}).first().click();
    const s1=scope.locator('select[title="① 시도"]'),s2=scope.locator('select[title="② 상권"]');
    assert.equal(await s1.inputValue(),'서울','저장값(도심) → 서울 그룹');assert.equal(await s2.inputValue(),'도심');
    await s1.selectOption('경기');assert.equal(await s2.inputValue(),'경기');
    assert.equal(await s2.evaluate(s=>s.selectedOptions[0].textContent),'경기 전체');
    await s2.selectOption('분당역세권');
    await scope.locator('button:has-text("계산")').first().click();
    const tas=await scope.locator('textarea').evaluateAll(ts=>ts.map(t=>t.value));
    assert.ok(tas.some(v=>/^집합상가|^오피스|^중대형상가|^소규모상가/.test(v)&&/지역 : 분당역세권\n/.test(v)),'산식에 분당역세권');
    assert.equal(await p.evaluate(()=>localStorage.getItem('arap-nrcap-region')),'분당역세권');
    assert.deepEqual(p.errs,[]);await ctx.close();console.log('집건 단일 OK');}

  // ── 4) 여러호수·입주권: 화면이 오류 없이 뜨는지
  for(const [file,init] of [['s3r86w8a.html',{'arap-jiphap-mode':'multi'}],['입주권.html',{}]]){
    const {ctx,p}=await mk(init);await p.goto(base+'/'+encodeURI(file));await p.waitForTimeout(4000);
    assert.deepEqual(p.errs,[],file);await ctx.close();console.log(file,'로드 OK');}
  console.log('PASS');
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);process.exit(1);});
