// 토지건물 청구서가 감정평가액을 따라오는지 — 4번 탭을 연 뒤에 평가액이 정해져도(저장건 다시 열기 → 시점수정 등이 뒤늦게 들어옴)
// 평가수수료·정산청구액이 바로 채워지고 「청구서 받기」가 켜진다. 저장건을 열 때 직접 적은 여비는 자동값으로 덮이지 않는다.
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_cheonggu_refresh.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
global.window={};require(path.join(root,'arap_fee.js'));const F=window.ArapFee;
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  try{
    const ctx=await browser.newContext(),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
    await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});return u.startsWith(base)?r.continue():r.abort();});
    await page.goto(base+'/토지건물.html',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.ArapFee&&window.renderCheonggu);
    const read=()=>page.evaluate(()=>({fee:document.getElementById('cgv_fee').textContent,due:document.getElementById('cgv_due').textContent,
      dis:document.getElementById('btnCheonggu').disabled,box:document.getElementById('cg_autoBox').textContent,travel:document.getElementById('cg_travel').value}));
    // ① 4번 탭을 먼저 열고(평가액 없음) → 평가액이 뒤늦게 정해짐(탭 이동·입력 없이 calcFinal만)
    await page.evaluate(()=>showTab('final'));
    const before=await read();assert.equal(before.fee,'-');assert.equal(before.dis,true);
    await page.evaluate(()=>{window.LAND_FINAL=2031750000;window.BLD_RESULT={total:37422720,size:462.36,rows:[]};calcFinal();});
    await page.waitForTimeout(100);
    const after=await read(),a=F.calc(2069172720);
    assert.equal(after.fee,(Math.floor(a.하한수수료/1000)*1000).toLocaleString('ko-KR')+' 원','평가액이 정해지면 평가수수료 바로 채움 '+JSON.stringify(after));
    assert.notEqual(after.due,'-','정산청구액');assert.equal(after.dis,false,'청구서 받기 켜짐');
    assert(after.box.includes('2,069,172,720'),'자동 상자에 예상평가액');
    // ② 여비를 직접 적어 저장 → 4번 탭에 있는 채로 다른 건 열었다가 다시 열기 → 직접 적은 여비 그대로
    await page.evaluate(()=>{const el=document.getElementById('cg_travel');el.value='77,000';el.dispatchEvent(new Event('input',{bubbles:true}));
      document.getElementById('ov_caseNo').value='T-CG-REFRESH';commitCaseNo();saveForm();});
    await page.waitForTimeout(1200);
    await page.evaluate(()=>{newCase();showTab('final');loadCase('T-CG-REFRESH');showTab('final');});
    await page.waitForTimeout(100);
    assert.equal((await read()).travel,'77,000','저장건을 열어도 직접 적은 여비 유지');
    // ③ 수수료 파일을 못 불러온 경우 빈 상자 대신 안내
    const warn=await page.evaluate(()=>{const f=window.ArapFee;window.ArapFee=undefined;renderCheonggu();const t=document.getElementById('cg_autoBox').textContent;window.ArapFee=f;return t;});
    assert(warn.includes('새로고침'),'모듈 없음 안내: '+warn);
    assert.deepEqual(errors,[]);
    console.log('PASS');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
