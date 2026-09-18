// 청구서 배수(할증) — 수수료 요율 옆 × 배수, 특별용역비 옆 × 배수, 둘의 연동과 문서 값.
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_cheonggu_mul.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');
  fs.createReadStream(f).pipe(res);});
const FEE=['1  예상평가액  1,775,270,360',
           '2  하한 수수료  1,512,680  10억원 ~ 50억원',
           '3  기준 수수료  1,815,216  10억원 ~ 50억원',
           '4  상한 수수료  2,128,260  10억원 ~ 50억원',
           '5  하한 총액  1,652,390  실비 및 VAT(10%)포함'].join('\n');
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
  const ctx=await browser.newContext();const page=await ctx.newPage();const errs=[];
  page.on('pageerror',e=>errs.push(e.message));page.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text());});
  await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js'))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
  await page.goto(base+'/토지건물.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.renderCheonggu&&window.ArapCheonggu);

  const setup=fee=>page.evaluate(f=>{
    showTab('cheonggu');
    const set=(id,v)=>{const el=document.getElementById(id);el.value=v;el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));};
    document.getElementById('cg_feeText').value=f;
    set('cg_specialMode','직접입력');set('cg_special','1,000,000');set('cg_travel','40,000');
    set('cg_survey','15,000');set('cg_doc','15,000');set('cg_etc','0');set('cg_downPayment','300,000');
    set('cg_feeMul','');set('cg_specialMul','');
    renderCheonggu();
  },fee);
  const read=()=>page.evaluate(()=>{
    const t=id=>document.getElementById(id).textContent.trim();
    const eq=document.getElementById('cg_specialEq');
    return {fee:t('cgv_fee'),sub:t('cgv_sub'),sum:t('cgv_sum'),vat:t('cgv_vat'),total:t('cgv_total'),due:t('cgv_due'),
            feeMul:document.getElementById('cg_feeMul').value,spMul:document.getElementById('cg_specialMul').value,
            eqHidden:eq.hidden,eq:eq.textContent,note:document.getElementById('cg_mulNote').textContent,
            onFee:document.getElementById('cg_feeMul').classList.contains('on'),
            onSp:document.getElementById('cg_specialMul').classList.contains('on')};
  });

  // ① 배수를 비워 두면 종전 그대로(1배)
  await setup(FEE);
  const plain=await read();
  console.log('① 배수 없음',plain);
  assert.equal(plain.fee,'1,512,000 원');        // 하한 1,512,680 → 천원 절사
  assert.equal(plain.sub,'1,070,000 원');        // 여비4만+조사1.5만+공부1.5만+특용비 100만
  assert.equal(plain.total,'2,840,200 원');
  assert.ok(plain.eqHidden,'배수 1이면 적용액 줄은 숨는다');
  assert.equal(plain.note,'');

  // ② 수수료 배수 1.5 → (가)평가수수료 1.5배, 특별용역비 배수도 같이 1.5로 따라온다
  const x15=await page.evaluate(()=>{
    const el=document.getElementById('cg_feeMul');el.value='1.5';el.dispatchEvent(new Event('input',{bubbles:true}));
    return null;
  }).then(read);
  console.log('② 수수료 1.5배',x15);
  assert.equal(x15.spMul,'1.5','특별용역비 배수가 따라온다');
  assert.equal(x15.fee,'2,269,000 원');          // 1,512,680 × 1.5 = 2,269,020 → 천원 절사
  assert.equal(x15.eq,'× 1.5 = 1,500,000 원');   // 특별용역비 100만 × 1.5
  assert.equal(x15.eqHidden,false);
  assert.equal(x15.sub,'1,570,000 원');          // 실비 7만 + 특용비 150만
  assert.equal(x15.sum,'3,839,000 원');
  assert.equal(x15.total,'4,222,900 원');
  assert.equal(x15.due,'3,922,900 원');
  assert.ok(x15.onFee&&x15.onSp,'배수 칸이 강조된다');
  assert.ok(x15.note.includes('1.5배'));

  // ③ 특별용역비 배수만 따로 1로 되돌릴 수 있다(수수료는 1.5배 유지)
  const only=await page.evaluate(()=>{
    const el=document.getElementById('cg_specialMul');el.value='1';el.dispatchEvent(new Event('input',{bubbles:true}));
    return null;
  }).then(read);
  console.log('③ 특용비만 1배',only);
  assert.equal(only.fee,'2,269,000 원');
  assert.equal(only.sub,'1,070,000 원');
  assert.ok(only.eqHidden);

  // ④ 문서(hwpx) 토큰에도 배수가 적용된 금액이 나간다
  const doc=await page.evaluate(()=>{
    const set=(id,v)=>{const el=document.getElementById(id);el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));};
    set('cg_feeMul','1.5');set('cg_specialMul','1.5');
    const c=cgFee();
    return {수수료:c.평가수수료,특용비:c.특별용역비,소계:c.소계,합계:c.합계,총계:c.총계,정산:c.정산청구액};
  });
  console.log('④ 청구서 값',doc);
  assert.equal(doc.수수료,2269000);
  assert.equal(doc.특용비,1500000);
  assert.equal(doc.합계,3839000);
  assert.equal(doc.정산,3922900);

  // ⑤ 이상한 값(0·문자)은 1배로 본다
  const bad=await page.evaluate(()=>{
    const set=(id,v)=>{const el=document.getElementById(id);el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));};
    set('cg_feeMul','0');set('cg_specialMul','abc');
    const c=cgFee();
    return {수수료:c.평가수수료,특용비:c.특별용역비};
  });
  console.log('⑤ 0·문자',bad);
  assert.equal(bad.수수료,1512000);assert.equal(bad.특용비,1000000);

  // ⑥ 배수도 건과 함께 저장·복원된다
  const round=await page.evaluate(()=>{
    const set=(id,v)=>{const el=document.getElementById(id);el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));};
    set('cg_feeMul','1.5');set('cg_specialMul','1.2');
    doSave();const o=JSON.parse(localStorage.getItem(FORM_STORAGE));
    clearForm();applyForm(o);refreshAfterLoad();renderCheonggu();
    return {feeMul:document.getElementById('cg_feeMul').value,spMul:document.getElementById('cg_specialMul').value,
            fee:document.getElementById('cgv_fee').textContent.trim(),special:cgSpecialApplied()};
  });
  console.log('⑥ 저장·복원',round);
  assert.equal(round.feeMul,'1.5');assert.equal(round.spMul,'1.2');
  assert.equal(round.fee,'2,269,000 원');
  assert.equal(round.special,1200000);

  if(errs.length){console.log('페이지 오류',errs);throw new Error('page errors');}
  console.log('✅ 모두 통과');
  await browser.close();server.close();
})().catch(e=>{console.error('❌',e);process.exit(1);});
