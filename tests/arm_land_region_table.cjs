// 시점수정 계산기 토지 탭 지역 = 표 목록(2026-10-29) — 지가변동률 지역(시도 > 시 > 구)을 지역1~지역3 칸으로 한 번에, 줄 클릭 선택, 검색.
// 실제 지가변동률 파일(arap_jibyun_data.js). 확인: 머리·줄 순서(전국 → 수도권 → 서울…, 시도 바로 아래 시지역·군지역) · 검색 → 클릭 → 계산 지역 · 새로고침 뒤 선택 유지
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8');fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true});
  try{
    const ctx=await browser.newContext({viewport:{width:1300,height:950}});
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
    await ctx.addInitScript(()=>{try{localStorage.setItem('arap-user-name','테스트');}catch(e){}});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(base+'/'+encodeURI('arm_시점수정.html'));await p.waitForSelector('#tab-land');
    await p.click('#tab-land');await p.waitForSelector('#landRegBody tr[data-key]');
    assert.equal(await p.isVisible('#land-rtable'),true);assert.equal(await p.isVisible('#region'),false,'드롭다운 숨김');
    assert.deepEqual(await p.locator('#landRegHead th').allTextContents(),['지역1','지역2','지역3']);
    const keys=await p.locator('#landRegBody tr[data-key]').evaluateAll(t=>t.map(x=>x.dataset.key));
    assert.ok(keys.length>300,'줄 수 '+keys.length);assert.equal(keys[0],'전국');
    const iG=keys.indexOf('경기');assert.deepEqual(keys.slice(iG,iG+3),['경기','경기 > 군지역','경기 > 시지역'],'시도 바로 아래 묶음');
    assert.deepEqual(await p.locator('tr[data-key="전북 > 전주시 > 완산구"] td').allTextContents(),['전북','전주시','완산구']);
    // 검색 → 클릭 → 계산
    await p.fill('#landRegQ','완산');assert.equal(await p.locator('#landRegBody tr[data-key]').count(),1);
    await p.click('#landRegBody tr[data-key]');
    assert.equal(await p.inputValue('#region'),'전북 > 전주시 > 완산구');assert.equal(await p.locator('#landRegSel b').textContent(),'전북 > 전주시 > 완산구');
    assert.equal(await p.getAttribute('#landRegBody tr[data-key]','class'),'on');
    await p.fill('#tradeDate','2025.03.10');await p.fill('#baseDate','2026.08.01');await p.click('#btn-calc');
    await p.waitForFunction(()=>/지역 :/.test(document.getElementById('resultText').value),null,{timeout:20000});
    assert.match(await p.inputValue('#resultText'),/지역 : 전북 전주시 완산구/);
    await p.fill('#landRegQ','없는지역xyz');assert.equal(await p.locator('#landRegBody td.msg').textContent(),'찾는 지역이 없습니다');
    // 새로고침 뒤에도 선택 유지
    await p.reload();await p.click('#tab-land');await p.waitForSelector('#landRegBody tr.on');
    assert.equal(await p.getAttribute('#landRegBody tr.on','data-key'),'전북 > 전주시 > 완산구');
    // 집합건물 탭으로 가면 같은 자리에 매매가격지수 지역 표(지역1~지역4) — tests/sijeom_region3.cjs
    await p.click('#tab-bld');assert.equal(await p.isVisible('#land-rtable'),true);
    assert.deepEqual(await p.locator('#landRegHead th').allTextContents(),['지역1','지역2','지역3','지역4']);
    assert.deepEqual(errs,[]);console.log('PASS');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
