// 청구서 배수(할증) — 수수료 요율 옆 × 배수, 특별용역비 옆 × 배수, 둘의 연동과 문서 값.
// 특별용역비: 직접입력이면 적은 금액 그대로(배수 무시), 차액 방식이면 차액 × 배수 = 적용액(입력칸, 고칠 수 있음).
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
  const set=(id,v)=>page.evaluate(([id,v])=>{const el=document.getElementById(id);el.value=v;el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));},[id,v]);
  const read=()=>page.evaluate(()=>{
    const t=id=>document.getElementById(id).textContent.trim();
    const g=id=>document.getElementById(id);
    return {fee:t('cgv_fee'),sub:t('cgv_sub'),sum:t('cgv_sum'),vat:t('cgv_vat'),total:t('cgv_total'),due:t('cgv_due'),
            feeMul:g('cg_feeMul').value,spMul:g('cg_specialMul').value,spMulHidden:g('cg_specialMul').hidden,
            eqHidden:g('cg_specialEq').hidden,applied:g('cg_specialApplied').value,special:g('cg_special').value,
            note:g('cg_mulNote').textContent,
            onFee:g('cg_feeMul').classList.contains('on'),onSp:g('cg_specialMul').classList.contains('on'),
            onAp:g('cg_specialApplied').classList.contains('on'),doc:cgFee().특별용역비};
  });

  // ① 배수를 비워 두면 종전 그대로(1배). 직접입력이면 배수 칸·적용액 줄이 숨는다
  await setup(FEE);
  const plain=await read();
  console.log('① 배수 없음',plain);
  assert.equal(plain.fee,'1,512,000 원');        // 하한 1,512,680 → 천원 절사
  assert.equal(plain.sub,'1,070,000 원');        // 여비4만+조사1.5만+공부1.5만+특용비 100만
  assert.equal(plain.total,'2,840,200 원');
  assert.ok(plain.eqHidden&&plain.spMulHidden,'직접입력이면 배수·적용액은 숨는다');
  assert.equal(plain.note,'');

  // ② 수수료 배수 1.5 → (가)평가수수료 1.5배. 직접입력 특별용역비는 적은 금액 그대로(1.5배 안 붙음)
  await set('cg_feeMul','1.5');
  const x15=await read();
  console.log('② 수수료 1.5배·직접입력',x15);
  assert.equal(x15.spMul,'1.5','특별용역비 배수 칸은 따라오되(숨김) 직접입력엔 안 쓰인다');
  assert.equal(x15.fee,'2,269,000 원');          // 1,512,680 × 1.5 = 2,269,020 → 천원 절사
  assert.equal(x15.doc,1000000,'직접입력 100만은 그대로 100만');
  assert.ok(x15.eqHidden&&x15.spMulHidden);
  assert.equal(x15.sub,'1,070,000 원');
  assert.equal(x15.sum,'3,339,000 원');
  assert.equal(x15.total,'3,672,900 원');
  assert.equal(x15.due,'3,372,900 원');
  assert.ok(x15.onFee&&!x15.onSp);
  assert.ok(x15.note.includes('1.5배'));

  // ③ 상한-하한으로 바꾸면 차액 615,580이 채워지고 × 1.5 = 923,370 이 적용액 칸에 뜬다
  await set('cg_specialMode','상한-하한');
  const diff=await read();
  console.log('③ 상한-하한 × 1.5',diff);
  assert.equal(diff.special,'615,580');
  assert.equal(diff.eqHidden,false);assert.equal(diff.spMulHidden,false);
  assert.equal(diff.applied,'923,370');
  assert.equal(diff.doc,923370);
  assert.ok(diff.onSp&&!diff.onAp);
  assert.equal(diff.sub,'993,370 원');

  // ④ 적용액을 손으로 923,000 으로 고치면 그 값이 청구서에 나간다
  await set('cg_specialApplied','923,000');
  const man=await read();
  console.log('④ 적용액 수정',man);
  assert.equal(man.applied,'923,000');assert.equal(man.doc,923000);assert.ok(man.onAp,'고친 적용액은 강조');
  assert.equal(man.sub,'993,000 원');

  // ⑤ 저장·복원해도 고친 적용액이 유지된다
  const round=await page.evaluate(()=>{
    doSave();const o=JSON.parse(localStorage.getItem(FORM_STORAGE));
    clearForm();applyForm(o);refreshAfterLoad();renderCheonggu();
    return {feeMul:document.getElementById('cg_feeMul').value,spMul:document.getElementById('cg_specialMul').value,
            fee:document.getElementById('cgv_fee').textContent.trim(),applied:document.getElementById('cg_specialApplied').value,special:cgSpecialApplied()};
  });
  console.log('⑤ 저장·복원',round);
  assert.equal(round.feeMul,'1.5');assert.equal(round.spMul,'1.5');
  assert.equal(round.fee,'2,269,000 원');
  assert.equal(round.applied,'923,000');assert.equal(round.special,923000);

  // ⑥ 배수를 다시 고치면 적용액은 자동값으로 돌아간다(특용비 배수만 1.2 → 738,696). 적용액을 비워도 자동
  await set('cg_specialMul','1.2');
  const re=await read();
  console.log('⑥ 배수 재수정',re);
  assert.equal(re.applied,'738,696');assert.equal(re.doc,738696);assert.ok(!re.onAp);
  assert.equal(re.fee,'2,269,000 원','수수료는 1.5배 유지');
  await set('cg_specialApplied','700,000');await set('cg_specialApplied','');
  await page.evaluate(()=>document.getElementById('cg_specialApplied').blur());
  const emp=await read();
  assert.equal(emp.applied,'738,696','비우면 자동값 복귀');

  // ⑦ 차액(기초값)을 고쳐도 적용액은 자동 재계산. ↺ 누르면 차액·적용액 모두 자동
  await set('cg_specialApplied','700,000');
  await set('cg_special','600,000');
  const bs=await read();
  console.log('⑦ 차액 수정',bs);
  assert.equal(bs.applied,'720,000');assert.equal(bs.doc,720000);
  await page.evaluate(()=>cgResetSpecial());
  const rs=await read();
  assert.equal(rs.special,'615,580');assert.equal(rs.applied,'738,696');

  // ⑧ 이상한 값(0·문자)은 1배로 본다
  await set('cg_feeMul','0');await set('cg_specialMul','abc');
  const bad=await page.evaluate(()=>{const c=cgFee();return {수수료:c.평가수수료,특용비:c.특별용역비};});
  console.log('⑧ 0·문자',bad);
  assert.equal(bad.수수료,1512000);assert.equal(bad.특용비,615580);

  // ⑨ 다시 직접입력으로 돌아오면 칸의 금액(차액이 남아 있음)이 그대로 나간다
  await set('cg_specialMode','직접입력');await set('cg_specialMul','1.5');
  const back=await read();
  console.log('⑨ 직접입력 복귀',back);
  assert.ok(back.eqHidden&&back.spMulHidden);assert.equal(back.doc,615580);

  if(errs.length){console.log('페이지 오류',errs);throw new Error('page errors');}
  console.log('✅ 모두 통과');
  await browser.close();server.close();
})().catch(e=>{console.error('❌',e);process.exit(1);});
