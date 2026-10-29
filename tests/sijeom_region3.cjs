// 시점수정 계산기(arm_시점수정.html) 주거용 지역 = 표 목록(2026-10-29, 종전 ①②③ 3단 드롭다운 대체 — 토지 탭·집건 앱과 같은 방식).
// 확인: 지역1~지역4 표(서울 맨 앞, 윗단계 줄 먼저) · 검색 → 클릭 → 계산 · 경기 시 아래 구 · 연립/오피스텔은 아파트 지역 전부 보이되
//       그 유형에 없는 줄은 회색, 「선택」 옆 실제 적용 지역 안내, 계산은 상위 지수 · 새로고침 뒤 선택 복원(선택 줄로 스크롤) ·
//       옛 저장값(arap-sjidx-region) 그대로 · 비주거용 탭은 ①② 두 칸
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);
  res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8');
  const f=path.join(root,n.slice(1));if(!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.end(fs.readFileSync(f));});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL});try{
  const ctx=await browser.newContext({viewport:{width:1100,height:800}});
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
  await ctx.addInitScript(()=>{try{localStorage.setItem('arap-user-name','테스트');}catch(e){}});
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  const url=base+'/'+encodeURI('arm_시점수정.html');
  await p.goto(url);await p.waitForSelector('#landRegBody tr[data-key]');
  const keys=()=>p.locator('#landRegBody tr[data-key]').evaluateAll(t=>t.map(x=>x.dataset.key));
  const pick=async(q,k)=>{await p.fill('#landRegQ',q);await p.click(`#landRegBody tr[data-key="${k}"]`);assert.equal(await p.inputValue('#region'),k);};
  const calc=async()=>{await p.fill('#tradeDate','2025.03.10');await p.fill('#baseDate','2026.08.01');await p.click('#btn-calc');return p.inputValue('#resultText');};
  assert.equal(await p.isVisible('#land-rtable'),true);for(const id of ['#region','#r1','#r2'])assert.equal(await p.isVisible(id),false,id+' 숨김');
  assert.deepEqual(await p.locator('#landRegHead th').allTextContents(),['지역1','지역2','지역3','지역4']);
  const ks=await keys();assert.ok(ks.length>200,'줄 수 '+ks.length);assert.equal(ks[0],'서울');
  assert.ok(ks.indexOf('강북지역')<ks.indexOf('동북권')&&ks.indexOf('동북권')<ks.indexOf('강북구'),'윗단계 줄 먼저');
  assert.deepEqual(await p.locator('tr[data-key="강북구"] td').allTextContents(),['서울','강북지역','동북권','강북구']);
  // 서울 강북구
  await pick('강북','강북구');assert.equal(await p.locator('#landRegSel b').textContent(),'서울 > 강북지역 > 동북권 > 강북구');
  assert.match(await calc(),/서울 강북구/);
  // 경기 성남시 분당구
  await pick('분당','분당구');assert.match(await p.locator('#landRegSel b').textContent(),/경기 > .*분당구/);
  // 연립다세대: 아파트 지역도 보이되 연립에 없는 줄은 회색 · 고른 분당구는 그대로, 계산은 소속 권역 지수
  await p.selectOption('#kind','연립다세대');assert.equal(await p.inputValue('#region'),'분당구');
  assert.equal(await p.getAttribute('#landRegBody tr[data-key="분당구"] td','class'),'agg');
  assert.match(await p.locator('#landRegSel').textContent(),/→ 연립다세대 지수는 경기 > .* 적용/);
  assert.match(await calc(),/※ 연립다세대 지수는 분당구 단위로 공표되지 않아/);
  // 연립 권역 줄은 회색 아님
  await pick('동북','동북권');assert.equal(await p.getAttribute('#landRegBody tr[data-key="동북권"] td','class'),null);
  assert.equal(await p.locator('#landRegSel .rt-note').count(),0);
  // 오피스텔: 서울 강남구 → 상위 지수
  await p.selectOption('#kind','오피스텔');await pick('강남구','강남구');assert.match(await p.locator('#landRegSel').textContent(),/→ 오피스텔 지수(는 서울 .* 적용| 없음)/);
  // 아파트로 돌아오면 마지막에 고른 강남구 그대로
  await p.selectOption('#kind','아파트');assert.equal(await p.inputValue('#region'),'강남구');
  // 새로고침 → 복원 + 선택 줄 보임
  await p.reload();await p.waitForSelector('#landRegBody tr.on');assert.equal(await p.getAttribute('#landRegBody tr.on','data-key'),'강남구');
  assert.equal(await p.locator('#landRegBody tr.on').isVisible(),true);
  // 옛 저장값(구 이름) 그대로 읽힘
  await p.evaluate(()=>{localStorage.setItem('arap-sjidx-kind','아파트');localStorage.setItem('arap-sjidx-region','종로구');});
  await p.reload();await p.waitForSelector('#landRegBody tr.on');assert.equal(await p.locator('#landRegSel b').textContent(),'서울 > 강북지역 > 도심권 > 종로구');
  // 비주거용 탭: 표 숨김·①② 두 칸, 토지 탭 갔다 오면 검색칸 비움
  await p.fill('#landRegQ','종로');await p.click('#tab-nr');assert.equal(await p.isVisible('#land-rtable'),false);assert.equal(await p.isVisible('#r1'),true);
  await p.click('#tab-res');assert.equal(await p.isVisible('#land-rtable'),true);assert.equal(await p.isVisible('#r1'),false);
  await p.click('#tab-land');assert.equal(await p.inputValue('#landRegQ'),'');
  assert.deepEqual(errs,[]);
  console.log('OK sijeom_region3');
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);process.exit(1);});
