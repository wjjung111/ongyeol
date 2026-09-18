// 거래사례 열 이동(끌어놓기·◀▶)과 번호 자동 재부여 + 토지단가 원 미만 절사 검증.
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_trade_move.cjs
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
  const ctx=await browser.newContext();const page=await ctx.newPage();const errs=[];
  page.on('pageerror',e=>errs.push(e.message));page.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text());});
  await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js'))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
  await page.goto(base+'/토지건물.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.renderTrade&&window.moveTrade);

  // 사례 3건 — #3의 토지단가는 나누어떨어지지 않아 절사가 드러난다(900,000,000 ÷ 92.3)
  await page.evaluate(()=>{
    TRADES=[{loc:'가동 1-1',landA:'100',total:'500000000',date:'2025.01.10'},
            {loc:'나동 2-2',landA:'200',total:'800000000',date:'2025.02.20'},
            {loc:'다동 3-3',landA:'92.3',total:'900000000',date:'2025.03.30'}];
    APPRS=[];ETC={type:'t',idx:2};GA={idx:1};
    renderTrade();syncPick();calcGongsi();
  });

  // ① 토지단가는 원 미만 절사 — 900,000,000 ÷ 92.3 = 9,750,812.5677… → 9,750,812
  const unit=await page.evaluate(()=>{
    const cell=i=>document.querySelector('#tblTrade input[data-i="'+i+'"][data-k="landUnit"]').value;
    return {calc:tradeCalc(TRADES[2]).landUnit,shown:cell(2),shown0:cell(0),
            pick:[...document.querySelectorAll('#tblTradePick tr')].slice(1).map(tr=>tr.cells[4].textContent)};
  });
  console.log('① 토지단가 절사',unit);
  assert.equal(unit.calc,9750812);
  assert.equal(unit.shown,'9,750,812');
  assert.equal(unit.shown0,'5,000,000');
  assert.equal(unit.pick[2],'9,750,812');

  // ② ▶ 한 칸 이동: #1 → #2 자리. 번호는 자리 순서대로, 선정(그밖의요인 #3·거래사례 #2)도 따라간다
  const mv=await page.evaluate(()=>{
    moveTrade(0,1);
    return {order:TRADES.map(c=>c.loc),etc:ETC.idx,ga:GA.idx,
            heads:[...document.querySelectorAll('#tblTrade tr:first-child th')].slice(1).map(th=>th.textContent.replace(/\s+/g,' ').trim()),
            etcChecked:[...document.querySelectorAll('input[name="pickTrade"]')].findIndex(r=>r.checked),
            gaChecked:[...document.querySelectorAll('input[name="pickTradeGa"]')].findIndex(r=>r.checked)};
  });
  console.log('② 한 칸 이동',mv);
  assert.deepEqual(mv.order,['나동 2-2','가동 1-1','다동 3-3']);
  assert.equal(mv.etc,2);                 // 다동은 그대로 3번째
  assert.equal(mv.ga,0);                  // 나동(거래사례 선정)이 1번째로
  assert.equal(mv.etcChecked,2);assert.equal(mv.gaChecked,0);
  assert.ok(mv.heads[0].includes('거래사례 #1'));
  assert.ok(mv.heads[2].includes('거래사례 #3'));

  // ③ 끌어놓기(HTML5 drag&drop): 3번째 머리글을 1번째 자리로
  const drag=await page.evaluate(async()=>{
    const ths=[...document.querySelectorAll('#tblTrade tr:first-child th')].slice(1);
    const dt=new DataTransfer();
    ths[2].dispatchEvent(new DragEvent('dragstart',{dataTransfer:dt,bubbles:true}));
    ths[0].dispatchEvent(new DragEvent('dragover',{dataTransfer:dt,bubbles:true,cancelable:true}));
    const over=[...document.querySelectorAll('#tblTrade th.cdrag')].map(t=>t.className).join('|');
    ths[0].dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true}));
    return {order:TRADES.map(c=>c.loc),etc:ETC.idx,ga:GA.idx,over,
            leftover:document.querySelectorAll('#tblTrade th.dragover,#tblTrade th.dragging').length,
            msg:document.getElementById('pTradeMsg').textContent};
  });
  console.log('③ 끌어놓기',drag);
  assert.deepEqual(drag.order,['다동 3-3','나동 2-2','가동 1-1']);
  assert.equal(drag.etc,0);               // 다동(그밖의요인 선정)이 1번째로
  assert.equal(drag.ga,1);                // 나동은 그대로 2번째
  assert.ok(drag.over.includes('dragover'),'끄는 동안 놓을 자리가 표시된다');
  assert.equal(drag.leftover,0,'놓은 뒤 표시가 남지 않는다');

  // ④ 옮긴 뒤 계산이 그대로 따라온다 — 그밖의요인 사례단가 = 다동의 절사 단가
  const calc=await page.evaluate(()=>({src:srcUnit(),ga:tradeCalc(TRADES[GA.idx]).landUnit,
    etcSel:document.getElementById('etcCaseSel')?document.getElementById('etcCaseSel').value:null}));
  console.log('④ 계산 연동',calc);
  assert.equal(calc.src,9750812);
  assert.equal(calc.ga,4000000);          // 나동 800,000,000 ÷ 200

  // ⑤ 저장·복원 후에도 바뀐 순서와 선정이 유지된다
  const round=await page.evaluate(()=>{
    doSave();const o=JSON.parse(localStorage.getItem(FORM_STORAGE));
    clearForm();applyForm(o);refreshAfterLoad();
    return {order:TRADES.map(c=>c.loc),etc:ETC.idx,ga:GA.idx};
  });
  console.log('⑤ 저장·복원',round);
  assert.deepEqual(round.order,['다동 3-3','나동 2-2','가동 1-1']);
  assert.equal(round.etc,0);assert.equal(round.ga,1);

  // ⑥ 삭제 → 이동 → ↩ 복구가 옮긴 자리를 따라간다
  const undo=await page.evaluate(()=>{
    delTrade(0);                     // 다동 비우기(3열이라 비우기)
    moveTrade(2,0);                  // 가동을 맨 앞으로 → 빈 열은 2번째로
    undoTrade();
    return {order:TRADES.map(c=>c.loc||'(빈칸)')};
  });
  console.log('⑥ 삭제·이동·복구',undo);
  assert.deepEqual(undo.order,['가동 1-1','다동 3-3','나동 2-2']);

  if(errs.length){console.log('페이지 오류',errs);throw new Error('page errors');}
  console.log('✅ 모두 통과');
  await browser.close();server.close();
})().catch(e=>{console.error('❌',e);process.exit(1);});
