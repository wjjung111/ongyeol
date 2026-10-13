// 감정평가수수료 자동 계산(arap_fee.js, 보수에 관한 기준 2026.2.9. 별표) + 토지건물 청구서 연결 + 기평가건 검증
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_fee_auto.cjs
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),http=require('http');
const root=path.resolve(__dirname,'..');
// ① 엔진 — 별표 표 값(각 구간 경계에서 하한·기준·상한 누적액이 표와 같아야 함) + 수수료 사이트 계산서 실값
global.window={};require(path.join(root,'arap_fee.js'));const F=window.ArapFee;
const T=[[5e8,646000,745000,844000],[1e9,1006000,1195000,1384000],[5e9,3566000,4395000,5224000],[1e10,6366000,7895000,9424000],
  [5e10,25566000,31895000,38224000],[1e11,45566000,56895000,68224000],[3e11,109566000,136895000,164224000],
  [6e11,181566000,226895000,272224000],[1e12,245566000,306895000,368224000]];
T.forEach(([v,lo,ba,hi])=>{const r=F.calc(v);assert.deepEqual([r.하한수수료,r.기준수수료,r.상한수수료],[lo,ba,hi],'경계 '+v);});
assert.deepEqual(['하한수수료','기준수수료','상한수수료'].map(k=>F.calc(3e7)[k]),[250000,250000,250000],'5천만원 이하');
// 사이트 계산서 실값: 1,775,270,360 → 기준 1,815,216(소수 .288 버림=반올림) · 상한 2,128,260(.5 반올림), 7,900,000,000 → 하한 5,190,000
const a=F.calc(1775270360);assert.equal(a.기준수수료,1815216);assert.equal(a.상한수수료,2128260);assert.equal(a.하한수수료,1502173);
assert.equal(F.calc(7900000000).하한수수료,5190000);
assert.equal(F.calc('1,775,270,360').기준수수료,1815216,'콤마 글자');
// 계산서 대조
const ok=F.check('1 예상평가액 7,900,000,000 입력값\n2 하한 수수료 5,190,000 50억원 ~ 100억원\n3 기준 수수료 6,425,000\n4 상한 수수료 7,660,000');
assert(ok&&ok.ok,'같은 값 → ok');
const bad=F.check('1 예상평가액 1,775,270,360\n2 하한 수수료 1,512,680\n3 기준 수수료 1,815,216\n4 상한 수수료 2,128,260');
assert(bad&&!bad.ok&&bad.diffs.join()==='하한수수료','다른 값 → 하한만 다름');
console.log('engine OK');
// ② 토지건물 청구서 — 붙여넣기 없이 감정평가액으로 평가수수료, 붙여넣으면 그 값, 기평가건 검증 표
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  try{
    const ctx=await browser.newContext(),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
    await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});return u.startsWith(base)?r.continue():r.abort();});
    // 기평가건(다른 앱 저장 형식 흉내) 두 건 — 하나는 맞고, 하나는 하한이 다름
    await page.addInitScript(()=>{localStorage.setItem('v2:case:OLD-1',JSON.stringify({fee:{feeText:'1 예상평가액 7,900,000,000\n2 하한 수수료 5,190,000\n3 기준 수수료 6,425,000\n4 상한 수수료 7,660,000'}}));
      localStorage.setItem('ipj:case:OLD-2',JSON.stringify({x:{feeText:'1 예상평가액 1,775,270,360\n2 하한 수수료 1,512,680\n3 기준 수수료 1,815,216\n4 상한 수수료 2,128,260'}}));});
    await page.goto(base+'/토지건물.html',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.ArapFee&&window.renderCheonggu);
    const r=await page.evaluate(()=>{
      window.LAND_FINAL=1500000000;window.BLD_RESULT={total:275270360,size:100,rows:[]};
      document.getElementById('cg_feeText').value='';showTab('cheonggu');renderCheonggu();
      const t=id=>document.getElementById(id).textContent;
      return {fee:t('cgv_fee'),state:t('cg_feeState'),box:t('cg_autoBox'),dis:document.getElementById('btnCheonggu').disabled};});
    // 1,775,270,360 하한 1,502,173 → 평가수수료 천원 미만 절사 1,502,000(종전 청구서 규칙 그대로)
    assert.equal(r.fee,'1,502,000 원','자동 평가수수료(하한)');assert(r.state.includes('자동 계산'));assert.equal(r.dis,false,'청구서 받기 가능');
    assert(r.box.includes('1,775,270,360')&&r.box.includes('1,502,173')&&r.box.includes('1,815,216')&&r.box.includes('2,128,260'),'자동 상자 '+r.box);
    const b=await page.evaluate(()=>{const s=document.getElementById('cg_feeBasis');s.value='기준';s.dispatchEvent(new Event('change',{bubbles:true}));renderCheonggu();return document.getElementById('cgv_fee').textContent;});
    assert.equal(b,'1,815,000 원','기준요율');
    // 특별용역비 상한-하한 차액도 자동값으로
    const sp=await page.evaluate(()=>{const s=document.getElementById('cg_specialMode');s.value='상한-하한';s.dispatchEvent(new Event('change',{bubbles:true}));return document.getElementById('cg_special').value;});
    assert.equal(sp,'626,087','상한-하한 차액(2,128,260-1,502,173) — 자동값 차액');
    // 붙여넣으면 그 값 + 다르면 경고
    const p=await page.evaluate(()=>{const s=document.getElementById('cg_feeBasis');s.value='하한';
      document.getElementById('cg_feeText').value='1 예상평가액 1,775,270,360\n2 하한 수수료 1,512,680\n3 기준 수수료 1,815,216\n4 상한 수수료 2,128,260';renderCheonggu();
      return {fee:document.getElementById('cgv_fee').textContent,box:document.getElementById('cg_autoBox').textContent,state:document.getElementById('cg_feeState').textContent};});
    assert.equal(p.fee,'1,512,000 원','붙여넣은 값 우선');assert(p.state.includes('붙여넣은'));assert(p.box.includes('자동 계산과 다릅니다')&&p.box.includes('1,502,173'),'다르면 경고');
    // 예상평가액이 지금 감정평가액과 다르면 경고
    const q=await page.evaluate(()=>{window.LAND_FINAL=1600000000;renderCheonggu();return document.getElementById('cg_autoBox').textContent;});
    assert(q.includes('지금 감정평가액'),'예상평가액 불일치 경고');
    // 기평가건 검증 표
    const v=await page.evaluate(()=>{cgVerifySaved();const el=document.getElementById('cg_verify');return {hidden:el.hidden,text:el.textContent,rows:el.querySelectorAll('tr').length};});
    assert.equal(v.hidden,false);assert(v.text.includes('같음 1건')&&v.text.includes('다름 1건'),v.text);assert.equal(v.rows,3,'머리+2건');
    assert.deepEqual(errors,[]);
    console.log('PASS');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
