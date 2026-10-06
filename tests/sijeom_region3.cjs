// 시점수정 계산기(arm_시점수정.html) 주거용 지역 3단 드롭다운 — ① 시도 ② 권역 ③ 세부지역.
// 확인: 서울 동북권 강북구 선택·계산 · 경기 시 아래 구 · 인천 아파트(가짜 구 지수) · 연립/오피스텔 인천은 ②③ 회색 잠금 + 인천 지수로 계산 ·
//       새로고침 뒤 선택 복원 · 기존 저장값(arap-sjidx-region) 그대로 읽힘 · 비주거용 탭은 기존 드롭다운
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);
  res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8');
  const f=path.join(root,n.slice(1));if(!fs.existsSync(f)){res.statusCode=404;return res.end();}
  let body=fs.readFileSync(f);
  if(n==='/arap_index_data.js'){ // 인천 아파트가 아직 없을 수 있어 가짜 인천 지역을 덧붙임
    const s={};for(let y=2020;y<=2026;y++)for(let m=1;m<=12;m++)s[`${y}${String(m).padStart(2,'0')}`]=100+m;
    body=body.toString()+`;(function(){var r=window.ARAP_INDEX_DATA.tables["아파트"].regions,s=${JSON.stringify(s)};
      if(!r["인천"])r["인천"]={cls:1,full:"인천",s:s};if(!r["인천 중구"]&&!r["서구"]){r["서구"]={cls:2,full:"인천>서구",s:s};r["인천 중구"]={cls:3,full:"인천>중구",s:s};}})();`;}
  res.end(body);});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL});try{
  const ctx=await browser.newContext();
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
  await ctx.addInitScript(()=>{try{localStorage.setItem('arap-user-name','테스트');}catch(e){}});
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  const url=base+'/'+encodeURI('arm_시점수정.html');
  await p.goto(url);await p.waitForSelector('#r1');
  const st=()=>p.evaluate(()=>{const g=id=>document.getElementById(id);const o=s=>[...s.options].map(x=>x.textContent);
    return {r1:g('r1').value,r2:g('r2').selectedOptions[0].textContent,r3:g('r3').selectedOptions[0].textContent,d2:g('r2').disabled,d3:g('r3').disabled,
      o1:o(g('r1')),o2:o(g('r2')),o3:o(g('r3')),region:g('region').value,vis:getComputedStyle(g('fld-region')).display,vis3:getComputedStyle(g('pair-r23')).display};});
  const pick=async(id,label)=>{await p.selectOption('#'+id,{label});};
  let s=await st();
  assert.equal(s.vis,'none');assert.notEqual(s.vis3,'none');
  assert.deepEqual(s.o1.slice(0,3),['서울','경기','인천']);
  // 서울 동북권 강북구
  await pick('r1','서울');await pick('r2','동북권');s=await st();
  assert.ok(s.o3.includes('강북구')&&!s.o3.includes('강남구'),'동북권 아래 구만');
  await pick('r3','강북구');s=await st();assert.equal(s.region,'강북구');
  await p.fill('#tradeDate','2025.03.10');await p.fill('#baseDate','2026.08.01');await p.click('#btn-calc');
  assert.match(await p.inputValue('#resultText'),/서울 강북구/);
  // 경기 경부1권 → 성남시 분당구
  await pick('r1','경기');s=await st();assert.equal(s.r2,'경기 전체');assert.equal(s.d3,true,'시도 전체면 ③ 고를 게 없음(경기는 모두 권역 아래)');
  await pick('r2','경부1권');await pick('r3','성남시 분당구');s=await st();assert.equal(s.region,'분당구');
  // 인천 아파트: ② 해당 없음(잠금), ③ 구 목록
  await pick('r1','인천');s=await st();assert.equal(s.d2,true);assert.equal(s.d3,false);assert.ok(s.o3.includes('서구'));
  await pick('r3','서구');s=await st();assert.equal(s.region,'서구');
  // 새로고침 → 복원
  await p.reload();await p.waitForSelector('#r1');s=await st();assert.equal(s.r1,'인천');assert.equal(s.r3,'서구');
  // 연립다세대: 인천만 → ②③ 잠금, 인천 지수
  await p.selectOption('#kind','연립다세대');s=await st();
  assert.equal(s.r1,'인천');assert.equal(s.d2,true);assert.equal(s.d3,true);assert.equal(s.region,'인천');
  await p.fill('#tradeDate','2025.03.10');await p.fill('#baseDate','2026.08.01');await p.click('#btn-calc');assert.match(await p.inputValue('#resultText'),/지역 : 인천\n/);
  // 연립 서울 → 권역까지만, ③ 잠금
  await pick('r1','서울');await pick('r2','동북권');s=await st();assert.equal(s.d3,true);assert.equal(s.region,'동북권');
  // 오피스텔 인천도 잠금
  await p.selectOption('#kind','오피스텔');await pick('r1','인천');s=await st();assert.equal(s.d2,true);assert.equal(s.d3,true);
  // 아파트로 돌아오면 마지막에 고른 지역(오피스텔에서 고른 인천) 기준
  await p.selectOption('#kind','아파트');s=await st();assert.equal(s.r1,'인천');assert.equal(s.r3,'인천 전체');assert.equal(s.region,'인천');
  // 옛 저장값(구 이름) 그대로 읽힘
  await p.evaluate(()=>{localStorage.setItem('arap-sjidx-kind','아파트');localStorage.setItem('arap-sjidx-region','종로구');});
  await p.reload();await p.waitForSelector('#r1');s=await st();assert.deepEqual([s.r1,s.r2,s.r3],['서울','도심권','종로구']);
  // 비주거용 탭: 기존 드롭다운
  await p.click('#tab-nr');s=await st();assert.notEqual(s.vis,'none');assert.equal(s.vis3,'none');
  await p.click('#tab-res');s=await st();assert.equal(s.vis,'none');
  assert.deepEqual(errs,[]);
  console.log('OK sijeom_region3');
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);process.exit(1);});
