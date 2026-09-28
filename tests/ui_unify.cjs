// 집합건물(단일 호수)·토지건물 화면 통일 검증 (2026-09-28)
//  토지건물: 평가구분 빈칸+Tab 채움 / 기준시점근거 선택지·옛 값 이관 / 의뢰일 2026/06/08 / 달력 팝업 / 건물 단가 백원 반올림 기본 /
//            ✕ 지운 뒤 되돌리기 안내 + Ctrl+Z·Ctrl+Y / 이전·다음
//  집합건물 단일: 현장조사일 라벨 / 평가구분 Tab 채움 / 사례 ✕ → 되돌리기 안내·버튼 / Ctrl+Y / 자동저장 0.4초 / 창 닫힘 즉시 저장
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/ui_unify.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');
  fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
  try{
    // ── 토지건물 ──
    {const ctx=await browser.newContext({viewport:{width:1440,height:900}});const page=await ctx.newPage();const errs=[];page.on('pageerror',e=>errs.push(e.message));
      await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
      // 옛 저장 형식(기준시점근거 옛 문구·의뢰일 점) 이관 확인용 작업 저장값
      await page.addInitScript(()=>{if(sessionStorage.getItem('seeded'))return;sessionStorage.setItem('seeded','1');
        localStorage.setItem('tojigeonmul-v0.2',JSON.stringify({ov:{ov_gijunBasis:'실지조사 완료일인',ov_orderDay:'2026.06.08',ov_kind:''}}));});
      await page.goto(base+'/토지건물.html',{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>window.histUndo&&window.ArapTojiDocuments);
      assert.equal(await page.inputValue('#ov_gijunBasis'),'현장조사완료일인','옛 선택지 → 현장조사완료일인');
      assert.equal(await page.inputValue('#ov_orderDay'),'2026/06/08','옛 의뢰일 점 → 빗금');
      assert.deepEqual(await page.$$eval('#ov_gijunBasis option',o=>o.map(x=>x.textContent)),['선택','의뢰일인','현장조사완료일인','귀 제시일인']);
      const labels=await page.$$eval('.fld label',l=>l.map(x=>x.textContent));
      assert.ok(labels.includes('현장조사일')&&labels.includes('감정평가조건')&&!labels.includes('실지조사일'),'라벨 통일');
      // 평가구분: 비어 있고 안내 글씨만 → Tab 누르면 채움
      assert.equal(await page.inputValue('#ov_kind'),'');
      assert.equal(await page.getAttribute('#ov_kind','placeholder'),'상속(증여)');
      await page.focus('#ov_kind');await page.keyboard.press('Tab');
      assert.equal(await page.inputValue('#ov_kind'),'상속(증여)');
      // 새 평가서: 기준시점근거 '선택', 건물 단가 백원 단위 반올림 기본
      await page.evaluate(()=>newCase());
      assert.equal(await page.inputValue('#ov_gijunBasis'),'');
      assert.equal(await page.inputValue('#ov_kind'),'','새 건 평가구분 미리 안 채움');
      assert.deepEqual(await page.evaluate(()=>({u:BLD_STATE._rUnit,m:BLD_STATE._rMode})),{u:'100',m:'round'});
      // 의뢰일 8자리 → 2026/06/08, 달력 팝업(오늘)
      await page.fill('#ov_orderDay','20260608');assert.equal(await page.inputValue('#ov_orderDay'),'2026/06/08');
      await page.keyboard.press('Escape');
      await page.click('#base_gijun');await page.waitForSelector('.arap-calpop');
      await page.click('.arap-calpop [data-today]');
      assert.match(await page.inputValue('#base_gijun'),/^\d{4}\.\d{2}\.\d{2}$/);
      assert.equal(await page.$('.arap-calpop'),null,'날짜 고르면 닫힘');
      // ✕ 지우기 → 안내 → Ctrl+Z / Ctrl+Y
      await page.evaluate(()=>{addLand();});await page.waitForTimeout(600);
      assert.equal(await page.evaluate(()=>LANDS.length),2);
      await page.locator('#tab-daesang .del[title="필지 삭제"]').last().click();await page.waitForTimeout(600);
      assert.equal(await page.evaluate(()=>LANDS.length),1);
      assert.ok(await page.isVisible('#undoToast'),'되돌리기 안내');
      await page.mouse.click(700,20);
      await page.keyboard.press('Control+z');await page.waitForTimeout(600);
      assert.equal(await page.evaluate(()=>LANDS.length),2,'Ctrl+Z');
      await page.keyboard.press('Control+y');await page.waitForTimeout(600);
      assert.equal(await page.evaluate(()=>LANDS.length),1,'Ctrl+Y');
      // 이전/다음
      await page.click('#btnNextTab');assert.equal(await page.evaluate(()=>CUR_TAB),'gongsi');
      await page.click('#btnPrevTab');assert.equal(await page.evaluate(()=>CUR_TAB),'daesang');
      assert.deepEqual(errs,[]);console.log('  ✓ 토지건물');await ctx.close();}

    // ── 집합건물 단일 호수 ──
    {const ctx=await browser.newContext({viewport:{width:1440,height:900}});const page=await ctx.newPage();const errs=[];page.on('pageerror',e=>errs.push(e.message));page.on('dialog',d=>d.accept());
      await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js'))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
      await page.addInitScript(()=>{localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-jiphap-mode','single');});
      await page.goto(base+'/s3r86w8a.html');
      const r=page.locator('#root');
      await r.getByText('1. 접수개요',{exact:true}).waitFor({timeout:60000});
      assert.equal(await r.getByText('현장조사일',{exact:true}).count(),1);
      // 샘플 건: 사례 ✕ → 안내·되돌리기 → Ctrl+Y
      await r.getByText('3. 사례 등 입력',{exact:true}).click();
      const tag=()=>r.getByText(/^사례 \d+ \| 선정/).textContent();
      const before=await tag();
      await r.locator('td span',{hasText:'✕'}).first().click();await page.waitForTimeout(600);
      assert.notEqual(await tag(),before);
      await r.getByRole('button',{name:'↩ 되돌리기'}).last().click();await page.waitForTimeout(600);
      assert.equal(await tag(),before,'되돌리기 버튼');
      await page.mouse.click(700,20);await page.keyboard.press('Control+y');await page.waitForTimeout(600);
      assert.notEqual(await tag(),before,'Ctrl+Y');
      await page.keyboard.press('Control+z');await page.waitForTimeout(600);
      assert.equal(await tag(),before,'Ctrl+Z');
      // 자동저장 0.4초: 의뢰인 고치고 1초 안에 저장소 반영
      await r.getByText('1. 접수개요',{exact:true}).click();
      const client=r.locator('input').nth(1);
      await client.fill('자동저장검증');await page.waitForTimeout(1000);
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('case:SAMPLE-압구정현대')).ov.client),'자동저장검증');
      // 창 닫힘(pagehide) 즉시 저장 — 0.4초 기다리지 않고 바로
      await client.fill('닫힘저장');await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('case:SAMPLE-압구정현대')).ov.client),'닫힘저장');
      // 평가구분 Tab 채움 (새 평가서)
      await r.getByText('+ 새 평가서').click();
      const kind=r.locator('input[placeholder="상속(증여)"]');await kind.focus();await page.keyboard.press('Tab');
      assert.equal(await kind.inputValue(),'상속(증여)');
      assert.deepEqual(errs,[]);console.log('  ✓ 집합건물 단일 호수');await ctx.close();}
    console.log('ui_unify: all passed');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
