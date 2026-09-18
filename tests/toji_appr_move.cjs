// 평가사례 행 이동(⠿ 손잡이 끌어놓기)과 기호 자동 재부여 검증.
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_appr_move.cjs
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
  await page.waitForFunction(()=>window.renderAppr&&window.moveAppr);

  const fixture=()=>page.evaluate(()=>{
    APPRS=[{no:'a',loc:'가동 1-1',unit:'1,000,000',base:'2025.01.01'},
           {no:'b',loc:'나동 2-2',unit:'2,000,000',base:'2025.02.02'},
           {no:'c',loc:'다동 3-3',unit:'3,000,000',base:'2025.03.03'}];
    TRADES=[{}];ETC={type:'a',idx:2};GA={idx:0};
    renderAppr();renderTrade();syncPick();calcGongsi();
  });
  await fixture();

  // ① 손잡이 칸이 행마다 하나씩, 끌 수 있게 붙어 있다
  const grips=await page.evaluate(()=>{
    const g=[...document.querySelectorAll('#tblAppr td.grip-c')];
    return {count:g.length,draggable:g.every(td=>td.getAttribute('draggable')==='true'),text:g[0].textContent.trim(),
            headCells:document.querySelector('#tblAppr tr').cells.length,
            rowCells:document.querySelectorAll('#tblAppr tr')[1].cells.length};
  });
  console.log('① 손잡이',grips);
  assert.equal(grips.count,3);assert.ok(grips.draggable);assert.equal(grips.text,'⠿');
  assert.equal(grips.headCells,grips.rowCells,'머리행과 데이터행 칸 수가 같다');

  // ② 맨 아래(c·다동)를 맨 위로 — 기호는 자리 순서대로 a·b·c 다시 매겨지고 선정도 따라간다
  const mv=await page.evaluate(()=>{
    moveAppr(2,0);
    return {order:APPRS.map(a=>a.loc),syms:APPRS.map(a=>a.no),etc:ETC.idx,
            checked:[...document.querySelectorAll('input[name="pickAppr"]')].findIndex(r=>r.checked),
            msg:document.getElementById('pApprMsg').textContent,
            opt:[...document.getElementById('etcPick').options].map(o=>o.textContent)};
  });
  console.log('② 맨 아래 → 맨 위',mv);
  assert.deepEqual(mv.order,['다동 3-3','가동 1-1','나동 2-2']);
  assert.deepEqual(mv.syms,['a','b','c']);
  assert.equal(mv.etc,0);assert.equal(mv.checked,0);
  assert.ok(mv.msg.includes('자리 순서대로'));
  assert.ok(mv.opt.some(t=>t.startsWith('평가사례 a — 다동 3-3')),'그밖의요인 드롭다운도 새 기호로');

  // ③ 끌어놓기(HTML5) — 1행 손잡이를 3행에 놓으면 1행이 맨 아래로
  const drag=await page.evaluate(()=>{
    const rows=[...document.querySelectorAll('#tblAppr tr')].slice(1);
    const dt=new DataTransfer();
    rows[0].querySelector('td.grip-c').dispatchEvent(new DragEvent('dragstart',{dataTransfer:dt,bubbles:true}));
    rows[2].dispatchEvent(new DragEvent('dragover',{dataTransfer:dt,bubbles:true,cancelable:true}));
    const over=[...document.querySelectorAll('#tblAppr tr')].map(t=>t.className).join('|');
    rows[2].dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true}));
    return {order:APPRS.map(a=>a.loc),syms:APPRS.map(a=>a.no),etc:ETC.idx,over,
            leftover:document.querySelectorAll('#tblAppr tr.dragover,#tblAppr tr.dragging').length};
  });
  console.log('③ 끌어놓기',drag);
  assert.deepEqual(drag.order,['가동 1-1','나동 2-2','다동 3-3']);
  assert.deepEqual(drag.syms,['a','b','c']);
  assert.equal(drag.etc,2,'선정했던 다동이 3행으로 따라간다');
  assert.ok(drag.over.includes('dragover'),'끄는 동안 놓을 자리가 표시된다');
  assert.equal(drag.leftover,0,'놓은 뒤 표시가 남지 않는다');

  // ④ 기호를 직접 고쳐 뒀으면 건드리지 않는다
  const custom=await page.evaluate(()=>{
    APPRS[0].no='㉮';APPRS[1].no='㉯';APPRS[2].no='㉰';renderAppr();
    moveAppr(0,2);
    return {order:APPRS.map(a=>a.loc),syms:APPRS.map(a=>a.no),msg:document.getElementById('pApprMsg').textContent};
  });
  console.log('④ 직접 적은 기호',custom);
  assert.deepEqual(custom.order,['나동 2-2','다동 3-3','가동 1-1']);
  assert.deepEqual(custom.syms,['㉯','㉰','㉮'],'기호는 사례를 따라간다(다시 매기지 않음)');
  assert.ok(custom.msg.includes('그대로'));

  // ⑤ 저장·복원 후에도 순서·기호가 유지된다
  const round=await page.evaluate(()=>{
    doSave();const o=JSON.parse(localStorage.getItem(FORM_STORAGE));
    clearForm();applyForm(o);refreshAfterLoad();
    return {order:APPRS.map(a=>a.loc),syms:APPRS.map(a=>a.no)};
  });
  console.log('⑤ 저장·복원',round);
  assert.deepEqual(round.order,['나동 2-2','다동 3-3','가동 1-1']);
  assert.deepEqual(round.syms,['㉯','㉰','㉮']);

  // ⑥ 그밖의요인 적용사례가 평가사례일 때 단가가 옮긴 뒤에도 그 사례를 가리킨다
  const unit=await page.evaluate(()=>{
    APPRS=[{no:'a',loc:'가동 1-1',unit:'1,000,000'},{no:'b',loc:'나동 2-2',unit:'2,000,000'},{no:'c',loc:'다동 3-3',unit:'3,000,000'}];
    ETC={type:'a',idx:0};renderAppr();syncPick();
    const before=srcUnit();
    moveAppr(0,2);
    return {before:before,after:srcUnit(),etc:ETC.idx};
  });
  console.log('⑥ 적용사례 단가',unit);
  assert.equal(unit.before,1000000);assert.equal(unit.after,1000000);assert.equal(unit.etc,2);

  // ⑦ 실제 마우스로 손잡이 끌기 (공시지가기준법 탭 → '평가사례' 서브탭을 열고)
  await fixture();
  await page.evaluate(()=>{showTab('gongsi');sub(1,document.querySelectorAll('.subtabs button')[1]);});
  await page.locator('#tblAppr td.grip-c').nth(2).dragTo(page.locator('#tblAppr tr').nth(1));
  const mouse=await page.evaluate(()=>APPRS.map(a=>a.no+':'+a.loc));
  console.log('⑦ 실제 드래그',mouse);
  assert.deepEqual(mouse,['a:다동 3-3','b:가동 1-1','c:나동 2-2']);

  if(errs.length){console.log('페이지 오류',errs);throw new Error('page errors');}
  console.log('✅ 모두 통과');
  await browser.close();server.close();
})().catch(e=>{console.error('❌',e);process.exit(1);});
