// 입주권 시점수정 지역 단계 선택(2026-10-29) — 시도 → 권역 → 시 → 구 차례로 고름. 「○○ 전체」 = 윗단계 지수. 실제 지수 파일.
// 확인: 시도 순서(서울·경기·인천·부산…제주) · 서울 4단 · 경기 시 아래 구 · 대구 2단 · 「전체」로 윗단계 · 시도 바꾸면 아랫칸 다시 · 계산 결과 지역 · 창 다시 열면 고른 값 유지
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8');fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true});
  try{
    const ctx=await browser.newContext({viewport:{width:1400,height:900}}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});return u.startsWith(base)?r.continue():r.abort();});
    await page.addInitScript(()=>{try{localStorage.setItem('arap-user-name','wdw');}catch(e){}});
    await page.goto(base+'/'+encodeURI('입주권.html'),{waitUntil:'domcontentloaded'});await page.waitForSelector('text=② 접수개요',{timeout:60000});
    const open=async()=>{await page.click('text=③ 사례 등 입력');await page.locator('td:has-text("1.01500")').first().click();await page.waitForSelector('text=지수 자동계산');};
    await open();
    const steps=page.locator('select[aria-label^="시점수정 지역"]');
    const vals=()=>steps.evaluateAll(ss=>ss.map(s=>s.value));const region=()=>page.locator('[data-region]').getAttribute('data-region');
    const opts=i=>steps.nth(i).evaluate(s=>[...s.options].map(o=>o.textContent));
    const calc=async()=>{await page.locator('div:has(> b:text("지수 자동계산")) button:text-is("계산")').click();
      return (await page.locator('textarea').evaluateAll(t=>t.map(x=>x.value).filter(v=>/지역 :/.test(v))))[0]||'';};
    // 시도 순서
    assert.deepEqual((await opts(0)).slice(0,5),['서울','경기','인천','부산','대구']);
    assert.equal((await opts(0)).at(-1),'제주');
    // 서울 4단 (샘플 = 서초구)
    assert.deepEqual(await vals(),['서울','강남지역','동남권','서초구']);
    // 경기 → 경부1권 → 성남시 → 분당구
    await steps.nth(0).selectOption('경기');assert.equal(await region(),'경기');assert.deepEqual(await vals(),['경기','']);
    assert.equal((await opts(1))[0],'경기 전체');
    await steps.nth(1).selectOption('경부1권');await steps.nth(2).selectOption('성남시');await steps.nth(3).selectOption('분당구');
    assert.equal(await region(),'분당구');assert.match(await calc(),/지역 : 경기 분당구\n/);
    // 「성남시 전체」 → 성남시 지수
    await steps.nth(3).selectOption('');assert.equal(await region(),'성남시');assert.match(await calc(),/지역 : 경기 성남시\n/);
    // 대구 2단 · 동명 구는 키 「대구 중구」
    await steps.nth(0).selectOption('대구');await steps.nth(1).selectOption('중구');assert.equal(await region(),'대구 중구');assert.equal(await steps.count(),2);
    assert.match(await calc(),/지역 : 대구 중구\n/);
    // 부산 권역 아래 구
    await steps.nth(0).selectOption('부산');await steps.nth(1).selectOption('동부산권');await steps.nth(2).selectOption('해운대구');
    assert.equal(await region(),'해운대구');assert.match(await calc(),/지역 : 부산 해운대구\n/);
    // 창 닫았다 다시 열면 유지
    await page.keyboard.press('Escape').catch(()=>{});await page.mouse.click(5,5);await page.waitForTimeout(200);
    if(await page.locator('text=지수 자동계산').count()===0){await open();assert.equal(await region(),'해운대구');assert.deepEqual(await vals(),['부산','동부산권','해운대구']);}
    assert.deepEqual(errors,[]);await ctx.close();console.log('PASS');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
