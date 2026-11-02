// 기준시가.html 「🏬 집합건물(근생·오피스텔)」 탭 검증 — 집합건물_기준시가.html?embed=1 을 iframe으로 붙임
// 처음 열 때만 iframe 생성 · 안쪽 상단바/서명 숨김 · 높이 = 내용(안쪽 스크롤 없음) · #condo 로 다시 열림 · 공동주택 소재지 → 지번주소 칸 미리 넣기
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/gjs_condo_tab.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.css')?'text/css':'text/javascript');fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL});
  try{
    const ctx=await browser.newContext({viewport:{width:1400,height:900}}),pg=await ctx.newPage(),errors=[];
    pg.on('pageerror',e=>errors.push(e.message));
    await ctx.route('**/*',r=>{const u=r.request().url();
      if(u.startsWith(base))return r.continue();
      return r.abort();});
    await pg.addInitScript(()=>{try{localStorage.setItem('arap-user-name','wdw');}catch(e){}});
    await pg.goto(base+'/기준시가.html',{waitUntil:'domcontentloaded'});
    assert.equal(await pg.isVisible('#paneBld'),true);
    assert.equal(await pg.$('#condoFrame'),null,'처음엔 iframe 안 만듦');

    // 공동주택가격 탭 소재지 → 집합건물 탭 지번주소 칸으로
    await pg.click('.ptabs button[data-pane="apt"]');
    await pg.fill('#aAddr','서울특별시 중구 명동1가 59');
    await pg.click('.ptabs button[data-pane="condo"]');
    assert.equal(await pg.isVisible('#paneCondo'),true);
    assert.equal(await pg.isVisible('#paneBld'),false);assert.equal(await pg.isVisible('#paneApt'),false);
    assert.equal(await pg.textContent('#tbTitle'),'집합건물 기준시가');
    assert.equal(new URL(pg.url()).hash,'#condo');
    const fh=await pg.waitForSelector('#condoFrame');
    assert.match(await fh.getAttribute('src'),/집합건물_기준시가\.html\?embed=1&addr=/);
    const fr=await fh.contentFrame();
    await fr.waitForSelector('#mode');
    assert.equal(await fr.isVisible('.ttop'),false,'안쪽 상단바 숨김');
    assert.equal(await fr.isVisible('.tsign'),false,'안쪽 서명 숨김');
    assert.equal(await fr.$eval('#address',e=>e.value),'서울특별시 중구 명동1가 59');
    // 평가 방식 고르면 내용이 길어짐 → iframe 높이도 따라감, 안쪽 스크롤 없음
    await fr.selectOption('#mode','manual');
    await pg.waitForFunction(()=>{const f=document.getElementById('condoFrame');const d=f.contentDocument;
      return f.offsetHeight>600&&Math.abs(f.offsetHeight-Math.ceil(d.body.getBoundingClientRect().height))<=2;});
    const m=await pg.$eval('#condoFrame',f=>({h:f.offsetHeight,sh:f.contentDocument.documentElement.scrollHeight,ch:f.contentDocument.documentElement.clientHeight}));
    assert.ok(m.h>600,'iframe 높이 '+m.h);assert.ok(m.sh<=m.ch+1,'안쪽 스크롤 없음 '+JSON.stringify(m));
    assert.equal(await fr.isVisible('#address'),true);
    // 다시 접으면 줄어듦(본문 최소높이 100vh에 묶이지 않음)
    await fr.selectOption('#mode','');
    await pg.waitForFunction(h=>document.getElementById('condoFrame').offsetHeight<h-200,m.h);

    // 화면 가로 스크롤 없음
    assert.ok(await pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));

    // 새로고침 → #condo 그대로
    await pg.reload({waitUntil:'domcontentloaded'});
    assert.equal(await pg.isVisible('#paneCondo'),true);assert.equal(await pg.textContent('#tbTitle'),'집합건물 기준시가');
    await pg.waitForSelector('#condoFrame');
    assert.ok(!/addr=/.test(await pg.getAttribute('#condoFrame','src')),'소재지 없으면 addr 안 붙임');
    // 다른 탭으로 갔다 와도 iframe 하나(다시 안 만듦)
    await pg.click('.ptabs button[data-pane="bld"]');
    assert.equal(await pg.isVisible('#paneBld'),true);assert.equal(await pg.isVisible('#paneCondo'),false);
    assert.equal(await pg.textContent('#tbTitle'),'건물 기준시가');assert.equal(new URL(pg.url()).hash,'');
    await pg.click('.ptabs button[data-pane="apt"]');
    assert.equal(await pg.isVisible('#paneApt'),true);assert.equal(new URL(pg.url()).hash,'#apt');
    await pg.click('.ptabs button[data-pane="condo"]');
    assert.equal(await pg.$$eval('#paneCondo iframe',a=>a.length),1);
    // 해시 없이 열면 마지막 탭(집합건물) 기억
    await pg.goto(base+'/기준시가.html',{waitUntil:'domcontentloaded'});
    assert.equal(await pg.isVisible('#paneCondo'),true);

    // 단독으로 열면 상단바·서명 그대로
    const sp=await ctx.newPage();sp.on('pageerror',e=>errors.push(e.message));
    await sp.goto(base+'/집합건물_기준시가.html',{waitUntil:'domcontentloaded'});
    assert.equal(await sp.isVisible('.ttop'),true);assert.equal(await sp.isVisible('.tsign'),true);
    assert.equal(await sp.$eval('#address',e=>e.value),'');

    // 휴대폰 폭: 가로 스크롤 없음
    await pg.setViewportSize({width:390,height:800});
    await pg.waitForTimeout(300);
    assert.ok(await pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'390px 가로 스크롤');
    const shot=process.env.SHOT_DIR;
    if(shot){await pg.screenshot({path:path.join(shot,'condo_tab_390.png'),fullPage:true});
      await pg.setViewportSize({width:1400,height:900});await pg.waitForTimeout(300);
      await (await pg.$('#condoFrame')).contentFrame().then(f=>f.selectOption('#mode','manual'));await pg.waitForTimeout(400);
      await pg.screenshot({path:path.join(shot,'condo_tab_1400.png'),fullPage:true});}

    assert.deepEqual(errors,[]);
    console.log('PASS: 기준시가 집합건물 탭 — iframe 지연 생성, 상단바·서명 숨김, 높이 맞춤, #condo 기억, 소재지 미리 넣기, 단독 화면 불변');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
