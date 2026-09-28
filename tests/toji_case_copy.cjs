// 저장된 건 복제(⧉ 복제)·휴지통: 새 접수번호로 한 벌 더 만들고 복제본 수정이 원본에 번지지 않는지,
// 삭제한 건이 휴지통에 들어가 되살아나는지(같은 번호가 있으면 새 번호로) 검증.
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_case_copy.cjs
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
  page.on('pageerror',e=>errs.push(e.message));
  await ctx.route('**/*',r=>{const u=r.request().url();if((u.includes('arap_access.js')||u.includes('arap_user.js')))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
  await page.goto(base+'/토지건물.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.copyCase&&window.loadCase);

  // 원본 건 만들기: 접수번호 + 표준지 A
  await page.evaluate(()=>{
    newCase();document.getElementById('ov_caseNo').value='T-001';
    STDS=[{'소재지':'신사동','지번':'586','공시지가':'23010000'}];renderStds();
    localStorage.setItem('tojigeonmul-memo:T-001',JSON.stringify([{t:'메모'}]));
    doSave();
  });
  // 복제 — 제안값 T-001-2 그대로 수락
  page.once('dialog',d=>{assert.equal(d.defaultValue(),'T-001-2');d.accept(d.defaultValue());});
  await page.evaluate(()=>{toggleCaseList();});
  await page.click('.copy-btn');await page.waitForTimeout(300);
  const r=await page.evaluate(()=>({cur:document.getElementById('ov_caseNo').value,id:currentId,
    std:STDS[0]['지번'],list:getLandList().map(c=>c.id),memo:localStorage.getItem('tojigeonmul-memo:T-001-2')}));
  console.log('① 복제',r);
  assert.equal(r.cur,'T-001-2');assert.equal(r.id,'T-001-2');assert.equal(r.std,'586');
  assert.deepEqual(r.list.slice(0,2),['T-001-2','T-001']);assert.ok(r.memo);

  // 복제본에서 표준지를 바꿔 저장 → 원본은 그대로
  const r2=await page.evaluate(()=>{STDS=[{'소재지':'신사동','지번':'999'}];renderStds();doSave();
    return {copy:JSON.parse(localStorage.getItem('tojigeonmul-case:T-001-2')).STDS[0]['지번'],
            orig:JSON.parse(localStorage.getItem('tojigeonmul-case:T-001')).STDS[0]['지번']};});
  console.log('② 독립 저장',r2);
  assert.equal(r2.copy,'999');assert.equal(r2.orig,'586');

  // 이미 있는 번호로 복제 → 거절, 덮어쓰지 않음
  await page.evaluate(()=>{toggleCaseList();});
  const msgs=[];page.on('dialog',d=>{msgs.push(d.message());d.type()==='prompt'?d.accept('T-001-2'):d.accept();});
  await page.evaluate(()=>copyCase('T-001'));
  const r3=await page.evaluate(()=>JSON.parse(localStorage.getItem('tojigeonmul-case:T-001-2')).STDS[0]['지번']);
  console.log('③ 중복 거절',msgs[1]);
  assert.equal(r3,'999');assert.match(msgs[1],/이미 있습니다/);

  // ④ 삭제 → 휴지통 → 되살리기(내용·메모 그대로)
  page.removeAllListeners('dialog');
  page.on('dialog',d=>d.accept());
  const r4=await page.evaluate(()=>{deleteCase('T-001');
    const after={has:!!localStorage.getItem('tojigeonmul-case:T-001'),list:getLandList().map(c=>c.id),trash:getTrash().map(x=>x.id)};
    showCaseList=true;document.getElementById('caseListPanel').hidden=false;showTrash=true;renderCaseListPanel();
    const btn=!!document.querySelector('.trash-tbl button');
    restoreTrash(0);
    return {after,btn,back:JSON.parse(localStorage.getItem('tojigeonmul-case:T-001')).STDS[0]['지번'],
      memo:localStorage.getItem('tojigeonmul-memo:T-001'),list:getLandList().map(c=>c.id),trash:getTrash().length};});
  console.log('④ 휴지통',r4);
  assert.equal(r4.after.has,false);assert.deepEqual(r4.after.list,['T-001-2']);assert.deepEqual(r4.after.trash,['T-001']);
  assert.ok(r4.btn);assert.equal(r4.back,'586');assert.ok(r4.memo);assert.deepEqual(r4.list,['T-001','T-001-2']);assert.equal(r4.trash,0);

  // ⑤ 같은 번호가 이미 있으면 새 번호로 되살림(기존 건은 안 건드림)
  page.removeAllListeners('dialog');
  page.on('dialog',d=>d.type()==='prompt'?d.accept('T-001-R'):d.accept());
  const r5=await page.evaluate(()=>{deleteCase('T-001-2');
    const o=JSON.parse(getTrash()[0].raw);o.ov.ov_caseNo='T-001-2';
    localStorage.setItem('tojigeonmul-case:T-001-2',JSON.stringify(Object.assign({},o,{STDS:[{'지번':'NEW'}]})));
    restoreTrash(0);
    return {kept:JSON.parse(localStorage.getItem('tojigeonmul-case:T-001-2')).STDS[0]['지번'],
      r:JSON.parse(localStorage.getItem('tojigeonmul-case:T-001-R')),};});
  console.log('⑤ 새 번호로 되살림',r5.kept,r5.r.ov.ov_caseNo,r5.r.STDS[0]['지번']);
  assert.equal(r5.kept,'NEW');assert.equal(r5.r.ov.ov_caseNo,'T-001-R');assert.equal(r5.r.STDS[0]['지번'],'999');

  // ⑥ 작업 열 줄바꿈 없음 — 버튼 3개가 한 줄
  await page.setViewportSize({width:1400,height:900});
  await page.evaluate(()=>{localStorage.setItem('tojigeonmul-bak:T-001-R',JSON.stringify([{t:Date.now(),data:{}},{t:Date.now(),data:{}}]));deleteCase('T-001');showCaseList=true;showTrash=true;document.getElementById('caseListPanel').hidden=false;renderCaseListPanel();});
  const tops=await page.evaluate(()=>[...document.querySelector('.caselist-tbl tbody tr:first-child td:last-child').querySelectorAll('button')].map(b=>Math.round(b.getBoundingClientRect().top)));
  console.log('⑥ 버튼 높이',tops);assert.ok(Math.max(...tops)-Math.min(...tops)<5);
  await page.screenshot({path:process.env.SHOT||'/dev/null',clip:{x:0,y:0,width:1400,height:500}}).catch(()=>{});

  assert.deepEqual(errs,[]);console.log('OK');
  await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1);});
