// Codex: 토지건물 화면 회귀 — 거래사례 자동계산 복구/'-' 표기, 청구서 표 구성·특별용역비 방식.
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_ui.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');
  fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
  const ctx=await browser.newContext();const page=await ctx.newPage();const errs=[];page.on('pageerror',e=>errs.push(e.message));
  await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js'))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
  await page.goto(base+'/토지건물.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.ArapCheonggu&&window.renderCheonggu);

  // ① 거래사례: 건물단가·건물금액에 '-'가 남아 있어도 재조달원가를 넣으면 자동계산으로 돌아온다
  const trade=await page.evaluate(()=>{
    TRADES=[{loc:'자양동 617-20',use:'2종일주',jimok:'대',landA:'92.3',bldA:'139.76',total:'900000000',
             date:'2025.09.20',appr:'1989.08.17',struct:'연와조',life:'40',bldUnit:'-',bldAmt:'-'}];
    renderTrade();
    const before=tradeCalc(TRADES[0]);
    tradeIn(0,'reCost','800000');
    const after=tradeCalc(TRADES[0]);
    const cell=k=>document.querySelector('#tblTrade input[data-i="0"][data-k="'+k+'"]').value;
    return {before:{bldUnit:before.bldUnit,bldAmt:before.bldAmt},after:{bldUnit:after.bldUnit,bldAmt:after.bldAmt},
            shown:{rest:cell('rest'),bldUnit:cell('bldUnit'),bldAmt:cell('bldAmt')}};
  });
  console.log('거래사례', JSON.stringify(trade));
  assert.equal(trade.after.bldUnit,80000,'재조달원가 입력 후 건물 적용단가 자동계산');
  assert.equal(trade.shown.bldUnit,'80,000');
  assert.equal(trade.shown.bldAmt,'11,180,800');

  // ② 계산 재료가 없으면 0이 아니라 '-'로 보인다
  const dash=await page.evaluate(()=>{
    TRADES=[{loc:'자양동 613-24',landA:'91.2',bldA:'91.9',total:'950000000',date:'2026.03.31',struct:'-',reCost:'-',life:'-'}];
    renderTrade();
    const cell=k=>document.querySelector('#tblTrade input[data-i="0"][data-k="'+k+'"]').value;
    return {rest:cell('rest'),bldUnit:cell('bldUnit'),bldAmt:cell('bldAmt'),landAmt:cell('landAmt')};
  });
  console.log('빈 계산칸', JSON.stringify(dash));
  assert.deepEqual([dash.rest,dash.bldUnit,dash.bldAmt],['-','-','-']);
  assert.equal(dash.landAmt,'950,000,000');

  // ③ 청구서 특별용역비 방식 드롭다운 — 계산서 차액 자동 채움
  const fee=['1  예상평가액  1,775,270,360',
             '2  하한 수수료  1,512,680  10억원 ~ 50억원',
             '3  기준 수수료  1,815,216  10억원 ~ 50억원',
             '4  상한 수수료  2,128,260  10억원 ~ 50억원',
             '5  하한 총액  1,652,390  실비 및 VAT(10%)포함'].join('\n');
  const special=await page.evaluate(async(fee)=>{
    showTab('cheonggu');
    document.getElementById('cg_feeText').value=fee;
    const set=(id,v)=>{const el=document.getElementById(id);el.value=v;el.dispatchEvent(new Event('change',{bubbles:true}));};
    const out={};
    set('cg_specialMode','상한-하한');out['상한-하한']=document.getElementById('cg_special').value;
    set('cg_specialMode','기준-하한');out['기준-하한']=document.getElementById('cg_special').value;
    set('cg_specialMode','상한-기준');out['상한-기준']=document.getElementById('cg_special').value;
    set('cg_specialMode','직접입력');out['직접입력_유지']=document.getElementById('cg_special').value;
    out.options=Array.from(document.querySelectorAll('#cg_specialMode option')).map(o=>o.value);
    return out;
  },fee);
  console.log('특별용역비', JSON.stringify(special));
  assert.equal(special['상한-하한'],'615,580');   // 2,128,260 - 1,512,680
  assert.equal(special['기준-하한'],'302,536');   // 1,815,216 - 1,512,680
  assert.equal(special['상한-기준'],'313,044');   // 2,128,260 - 1,815,216
  assert.equal(special['직접입력_유지'],'313,044');
  assert.deepEqual(special.options,['직접입력','상한-하한','기준-하한','상한-기준']);

  // ④ 청구서 표 구성(집합건물과 같은 구성) + 계산값
  const cg=await page.evaluate(async(fee)=>{
    showTab('cheonggu');
    document.getElementById('cg_feeText').value=fee;
    const set=(id,v)=>{const el=document.getElementById(id);el.value=v;el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));};
    set('cg_specialMode','직접입력');set('cg_special','0');set('cg_travel','40,000');
    set('cg_survey','15,000');set('cg_doc','15,000');set('cg_etc','0');set('cg_downPayment','300,000');
    const t=id=>document.getElementById(id).textContent.trim();
    return {rows:Array.from(document.querySelectorAll('#cg_table tr')).map(r=>Array.from(r.children).map(c=>c.textContent.replace(/\s+/g,'')).join('|')),
            fee:t('cgv_fee'),sub:t('cgv_sub'),sum:t('cgv_sum'),vat:t('cgv_vat'),total:t('cgv_total'),due:t('cgv_due'),
            state:t('cg_feeState'),btn:document.getElementById('btnCheonggu').disabled};
  },fee);
  console.log('청구서', JSON.stringify({fee:cg.fee,sub:cg.sub,sum:cg.sum,vat:cg.vat,total:cg.total,due:cg.due,btn:cg.btn}));
  console.log('청구서 행', JSON.stringify(cg.rows,null,0));
  assert.equal(cg.fee,'1,512,000 원');          // 하한 1,512,680 → 천원 절사
  assert.equal(cg.sub,'70,000 원');
  assert.equal(cg.sum,'1,582,000 원');
  assert.equal(cg.vat,'158,200 원');
  assert.equal(cg.total,'1,740,200 원');
  assert.equal(cg.due,'1,440,200 원');          // 총계 − 착수금 300,000
  assert.equal(cg.btn,false);
  assert(cg.state.includes('인식'));
  for(const m of ['평가수수료','여　비','물건조사비','공부발급비','기타실비','특별용역비','소　계','합계(가+나)','부가가치세','총　계','기납부착수금','정산청구액'])
    assert(cg.rows.some(r=>r.replace(/\s+/g,'').includes(m.replace(/\s+/g,''))),m);

  console.log('errors',errs);assert.deepEqual(errs,[]);
  console.log('PASS');
  await browser.close();server.close();
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
