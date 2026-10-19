// 토지건물 접수번호 확정 저장(집합건물과 같은 UX) 검증.
// ① 번호를 쳐도 저장 안 함 → 💾 저장으로 확정 ② 저장된 건은 칸만 고치면 원래 번호로 계속 저장 ③ 💾 번호 바꿔 저장 = 이름 바꾸기(메모·이전 버전 이동)
// ④ 이미 있는 번호는 거절 ⑤ 새로고침 뒤에도 확정 번호 유지 ⑥ 저장 전 메모는 💾 저장 때 그 건으로
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_case_commit.cjs
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
  const ctx=await browser.newContext({viewport:{width:1500,height:900}});const page=await ctx.newPage();const errs=[],dialogs=[];
  page.on('pageerror',e=>errs.push(e.message));
  page.on('dialog',d=>{dialogs.push(d.message());d.accept();});
  await ctx.route('**/*',r=>{const u=r.request().url();
    if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});
    if(u.startsWith(base))return r.continue();return r.abort();});
  await page.goto(base+'/토지건물.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.commitCaseNo&&window.renderCaseBar);
  const keys=()=>page.evaluate(()=>Object.keys(localStorage).filter(k=>/^tojigeonmul-(case|memo|bak):/.test(k)&&!/:_temp$/.test(k)).sort());
  const status=()=>page.locator('#caseStatus').innerText();
  const settle=()=>page.waitForTimeout(700);

  // ① 처음엔 빨간 안내 + 💾 저장(비활성). 번호를 쳐도(반쪽 번호 포함) 저장 안 함
  assert.match(await status(),/아직 저장 안 됨/);
  assert.equal(await page.locator('#caseStatus .save-btn').isDisabled(),true);
  await page.evaluate(()=>{localStorage.setItem('tojigeonmul-memo:_temp','[{"t":"저장 전 메모"}]');});
  await page.locator('#ov_caseNo').pressSequentially('HI26',{delay:30});await settle();
  await page.locator('#ov_caseNo').pressSequentially('0305-2601',{delay:30});
  await page.locator('#ov_client').fill('의뢰인A');await settle();
  assert.deepEqual(await keys(),[],'💾 저장 전엔 저장 안 함');
  assert.match(await status(),/💾 저장 \(HI260305-2601\)/);
  await page.locator('#caseStatus .save-btn').click();await settle();
  assert.deepEqual(await keys(),['tojigeonmul-case:HI260305-2601','tojigeonmul-memo:HI260305-2601']);
  assert.match(await status(),/HI260305-2601 저장완료/);
  console.log('① 확정 저장',await keys());

  // ② 칸 번호만 고치면 원래 번호로 계속 저장(그 건의 접수번호도 원래 번호), 새 건 안 생김
  await page.locator('#ov_caseNo').fill('HI260305-2699');
  await page.locator('#ov_client').fill('의뢰인B');await settle();
  assert.deepEqual((await keys()).filter(k=>!k.includes('-bak:')),['tojigeonmul-case:HI260305-2601','tojigeonmul-memo:HI260305-2601']);
  const s2=await page.evaluate(()=>JSON.parse(localStorage.getItem('tojigeonmul-case:HI260305-2601')).ov);
  assert.equal(s2.ov_client,'의뢰인B');assert.equal(s2.ov_caseNo,'HI260305-2601');
  assert.match(await status(),/변경 대기: HI260305-2601 → HI260305-2699/);
  console.log('② 변경 대기 중 원래 번호로 저장');

  // ⑤ 새로고침해도 확정 번호(2601)로 계속 저장
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.commitCaseNo);
  assert.equal(await page.evaluate(()=>currentId),'HI260305-2601');
  assert.equal(await page.locator('#ov_caseNo').inputValue(),'HI260305-2699');
  console.log('⑤ 새로고침 뒤 확정 번호 유지');

  // ③ 번호 바꿔 저장 = 이름 바꾸기
  if(!(await keys()).includes('tojigeonmul-bak:HI260305-2601'))await page.evaluate(()=>localStorage.setItem(bakKey('HI260305-2601'),'[{"t":1,"data":{}}]'));
  await page.locator('#caseStatus .save-btn').click();await settle();
  assert.deepEqual(await keys(),['tojigeonmul-bak:HI260305-2699','tojigeonmul-case:HI260305-2699','tojigeonmul-memo:HI260305-2699']);
  assert.deepEqual(await page.evaluate(()=>getLandList().map(c=>c.id)),['HI260305-2699']);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('tojigeonmul-memo:HI260305-2699'))[0].t),'저장 전 메모');
  assert.ok(dialogs.some(m=>m.includes('HI260305-2601 → HI260305-2699')));
  console.log('③ 이름 바꾸기',await keys());

  // ④ 다른 건이 쓰는 번호는 거절
  await page.evaluate(()=>{newCase();document.getElementById('ov_caseNo').value='HI260305-2699';renderCaseBar();});
  await page.locator('#caseStatus .save-btn').click();await settle();
  assert.ok(dialogs[dialogs.length-1].includes('이미 있습니다'));
  assert.equal(await page.evaluate(()=>currentId),null);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('tojigeonmul-case:HI260305-2699')).ov.ov_client),'의뢰인B','기존 건 안 덮어씀');
  console.log('④ 중복 번호 거절');

  // 저장된 건을 열면 그 번호가 확정 번호
  await page.evaluate(()=>loadCase('HI260305-2699'));
  assert.equal(await page.evaluate(()=>currentId),'HI260305-2699');
  assert.match(await status(),/HI260305-2699 저장완료/);
  assert.deepEqual(errs,[]);
  console.log('✅ 모두 통과');
  await browser.close();server.close();
})().catch(e=>{console.error('❌',e);process.exit(1);});
