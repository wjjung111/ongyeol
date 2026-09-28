// 저장된 건 복제(⧉ 복제): 새 접수번호로 한 벌 더 만들고, 복제본 수정이 원본에 번지지 않는지 검증.
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
  await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js'))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
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

  assert.deepEqual(errs,[]);console.log('OK');
  await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1);});
