// 토건 공시지가기준법 「시점수정 (지가변동률)」 지역 고르기 = 표 목록(2026-11-16 사용자 요청 「너무 복잡해, 시점수정 계산기처럼」)
// 긴 드롭다운 대신 시점수정 계산기 토지 탭·집건 시점수정 창과 같은 표: 검색칸 + 지역1~지역3 줄 클릭 선택 → 바로 다시 계산.
// 확인: 자동조회 전엔 표 숨김 · 조회 뒤 본건 지역 자동 선택(줄 강조·「선택:」) · 순서(전국 첫 줄, 시도 바로 아래 시지역·군지역) · 검색 → 클릭 → 대상지역·시점수정치 다시 계산 · 용도지역 바꾸기
// 실제 지가변동률 파일(arap_jibyun_data.js)로 계산(통신 없음). PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_jb_region_table.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript; charset=utf-8':'application/octet-stream');
  fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  try{
    const ctx=await browser.newContext({viewport:{width:1400,height:1000}});
    await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});
      if(u.startsWith(base))return r.continue();return r.abort();});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(base+'/'+encodeURI('토지건물.html')+'?mode=land',{waitUntil:'domcontentloaded'});
    await p.waitForFunction(()=>window.ARAP_JIBYUN_DATA&&document.getElementById('btnJb'));
    const F=await p.evaluate(()=>({latest:+window.ARAP_JIBYUN_DATA.latestYm}));
    const ly=Math.floor(F.latest/100),lm=F.latest%100;
    const gijun=`${ly}.${String(lm).padStart(2,'0')}.15`;
    await p.evaluate(({gijun})=>{
      document.getElementById('base_gongsi').value='2025.01.01';document.getElementById('base_gijun').value=gijun;
      document.getElementById('jb_region').value='경기도 수원시 팔달구';document.getElementById('jb_use').value='주거지역';
      showTab('gongsi');document.getElementById('gsJbCard').scrollIntoView();
    },{gijun});
    // 자동조회 전: 표·용도 숨김, 지역 드롭다운은 언제나 숨김
    assert.equal(await p.isVisible('#jbRegTable'),false);assert.equal(await p.isVisible('#jb_selRegion'),false);
    await p.evaluate(()=>document.getElementById('btnJb').click());
    await p.waitForFunction(()=>/완료/.test(document.getElementById('jbStatus').textContent),null,{timeout:20000});
    assert.equal(await p.evaluate(()=>getComputedStyle(document.getElementById('jbRegTable')).display),'block');
    assert.equal(await p.evaluate(()=>getComputedStyle(document.getElementById('jb_selRegion')).display),'none','드롭다운은 숨김');
    assert.notEqual(await p.evaluate(()=>getComputedStyle(document.getElementById('jb_useWrap')).display),'none','용도지역 고르기는 보임');
    assert.deepEqual(await p.locator('#jbRegHead th').allTextContents(),['지역1','지역2','지역3']);
    const keys=await p.locator('#jbRegBody tr[data-key]').evaluateAll(t=>t.map(x=>x.dataset.key));
    assert.ok(keys.length>300,'줄 수 '+keys.length);assert.equal(keys[0],'전국');
    const iG=keys.indexOf('경기');assert.deepEqual(keys.slice(iG,iG+3),['경기','경기 > 군지역','경기 > 시지역'],'시도 바로 아래 묶음');
    // 본건 지역 자동 선택
    assert.equal(await p.getAttribute('#jbRegBody tr.on','data-key'),'경기 > 수원시 > 팔달구');
    assert.equal(await p.locator('#jbRegSel b').textContent(),'경기 > 수원시 > 팔달구');
    assert.equal(await p.inputValue('#jb_region'),'경기 수원시 팔달구');
    const f1=await p.inputValue('#jb_factor');assert.match(f1,/^\d\.\d{5}$/);
    // 검색 → 클릭 → 다시 계산
    await p.fill('#jbRegQ','완산');assert.equal(await p.locator('#jbRegBody tr[data-key]').count(),1);
    await p.click('#jbRegBody tr[data-key]');
    await p.waitForFunction(()=>document.getElementById('jb_region').value==='전북 전주시 완산구',null,{timeout:20000});
    assert.equal(await p.inputValue('#jb_selRegion'),'전북 > 전주시 > 완산구');
    assert.equal(await p.locator('#jbRegSel b').textContent(),'전북 > 전주시 > 완산구');
    assert.equal(await p.getAttribute('#jbRegBody tr[data-key]','class'),'on');
    await p.waitForFunction(f=>document.getElementById('jb_factor').value!==f,f1,{timeout:20000});
    // 「전주 완산」처럼 낱말 둘도
    await p.fill('#jbRegQ','전주 완산');assert.equal(await p.locator('#jbRegBody tr[data-key]').count(),1);
    await p.fill('#jbRegQ','없는지역xyz');assert.equal(await p.locator('#jbRegBody td.msg').textContent(),'찾는 지역이 없습니다');
    await p.fill('#jbRegQ','');
    // 용도지역 바꾸기 → 다시 계산
    const uses=await p.locator('#jb_selUse option').allTextContents();const com=uses.find(u=>/상업/.test(u));assert.ok(com,'상업 용도 있음');
    await p.selectOption('#jb_selUse',com);
    await p.waitForFunction(c=>document.getElementById('jb_use').value===c,com,{timeout:20000});
    if(process.env.SHOT)await p.locator('#gsJbCard').screenshot({path:process.env.SHOT});
    assert.deepEqual(errs,[]);console.log('PASS');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
