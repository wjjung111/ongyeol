// 집건·토건 첫 화면 — 북마크·새 탭으로 들어오면 빈 새 평가서, 새로고침(F5)·?last=1 이면 하던 건 그대로 (2026-10-19)
// 토건은 접수번호 없는(저장 목록에 없는) 작성 중 화면은 지우지 않고 그대로 연다
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/start_blank.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8');fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  try{
    const mk=async()=>{const ctx=await browser.newContext(),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());page.setDefaultTimeout(60000);
      await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});return u.startsWith(base)?r.continue():r.abort();});
      await ctx.addInitScript(()=>{localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-jiphap-mode','single');});return {ctx,page,errors};};
    // ── 집합건물: 저장건(대표 샘플 압구정 현대)이 있어도 처음 들어오면 빈 화면
    {const {ctx,page,errors}=await mk();const root=page.locator('#root');
      const ready=async()=>{await root.getByText('1. 접수개요',{exact:true}).first().waitFor();await page.waitForTimeout(800);};
      const has=async()=>(await root.innerText()).includes('김준희');
      await page.goto(base+'/s3r86w8a.html');await ready();
      assert.equal(await has(),false,'집건 북마크 → 빈 새 평가서');
      await page.goto(base+'/s3r86w8a.html?last=1');await ready();
      assert.equal(await has(),true,'집건 ?last=1 → 마지막 건');
      await page.goto(base+'/s3r86w8a.html');await ready();await page.reload();await ready();
      assert.equal(await has(),true,'집건 새로고침 → 마지막 건');
      assert.deepEqual(errors,[]);await ctx.close();console.log('집건 OK');}
    // ── 토지건물
    {const {ctx,page,errors}=await mk();
      const url=base+'/'+encodeURI('토지건물.html');
      const val=id=>page.$eval('#'+id,e=>e.value);
      const go=async u=>{await page.goto(u,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>typeof doSave==='function');await page.waitForTimeout(300);};
      await go(url);
      // 접수번호 있는 건 저장
      await page.evaluate(()=>{document.getElementById('ov_caseNo').value='TEST-START-1';commitCaseNo();document.getElementById('ov_client').value='저장건의뢰인';doSave();});
      await go(url);
      assert.equal(await val('ov_caseNo'),'','토건 북마크 → 접수번호 빈칸');assert.equal(await val('ov_client'),'','토건 북마크 → 의뢰인 빈칸');
      assert.equal(await val('ov_purpose'),'일반거래(시가참고)','새 평가서 기본값은 채움');
      await go(url+'?last=1');
      assert.equal(await val('ov_caseNo'),'','저장 목록 건은 북마크로 들어올 때 지운 화면이라 ?last=1 에도 빈 화면');
      // 새로고침은 하던 화면 그대로
      await page.evaluate(()=>{document.getElementById('ov_caseNo').value='TEST-START-2';commitCaseNo();document.getElementById('ov_client').value='두번째';doSave();});
      await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>typeof doSave==='function');
      assert.equal(await val('ov_caseNo'),'TEST-START-2','토건 새로고침 → 하던 건');
      await go(url+'?last=1');assert.equal(await val('ov_client'),'두번째','토건 ?last=1 → 하던 건');
      // 저장건은 목록에서 다시 열 수 있다
      assert.ok(await page.evaluate(()=>!!localStorage.getItem('tojigeonmul-case:TEST-START-1')),'첫 건 저장 유지');
      // 접수번호 없는 작성 중 화면은 북마크로 들어와도 남긴다
      await page.evaluate(()=>{newCase();document.getElementById('ov_client').value='미저장작성중';doSave();});
      await go(url);assert.equal(await val('ov_client'),'미저장작성중','접수번호 없는 작성 중 화면은 유지');
      assert.deepEqual(errors,[]);await ctx.close();console.log('토건 OK');}
    console.log('PASS');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
