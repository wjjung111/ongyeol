// 집합건물 ③ 거래사례 표 — 단가 직접 수정 + ↺ 복붙 원래값 복귀(행별·전체), 단일·여러호수 양쪽
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/jiphap_case_unit_edit.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':'text/javascript');fs.createReadStream(f).pipe(res);});
const TSV=['소재지\t지번\t기타주소\t거래시점\t전용면적\t물건금액\t단가\t사용승인일자',
  '신천동\t17\t파크리오 316동 1303호\t2026.02.27\t59.86\t2,185,000,000\t36,501,837\t2008-08-29',
  '신천동\t17\t파크리오 120동 601호\t2025.12.11\t59.95\t2,580,000,000\t43,035,863\t2008-08-29'].join('\n');
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  try{
    for(const mode of ['single','multi']){
      const ctx=await browser.newContext(),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());page.setDefaultTimeout(20000);
      await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});return u.startsWith(base)?r.continue():r.abort();});
      await page.addInitScript(({mode})=>{localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-jiphap-mode',mode);},{mode});
      await page.goto(base+'/s3r86w8a.html?last=1');
      const scope=page.locator(mode==='single'?'#root':'#root-multi');
      await scope.getByText('3. 사례 등 입력',{exact:true}).click({timeout:60000});
      // 카이스 복붙 두 건
      await scope.locator('textarea[placeholder^="카이스에서 복사"]').first().evaluate((ta,t)=>{const dt=new DataTransfer();dt.setData('text/plain',t);ta.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));},TSV);
      const box=n=>scope.locator(`input[aria-label="거래사례 #${n} 단가"]`);
      const last=mode==='single'?5:1;   // 단일 샘플엔 사례 4건이 이미 있다
      await box(last).waitFor();
      assert.equal(await box(last).inputValue(),'36,501,837','복붙 직후 단가');
      assert.equal(await scope.locator('text=단가 전체 원래값으로').count(),0,'고치기 전엔 전체 버튼 없음');
      // 직접 수정
      await box(last).fill('36500000');await box(last).blur();
      assert.equal(await box(last).inputValue(),'36,500,000','고친 값 표시');
      const restore=scope.locator(`span[title^="복붙 원래값(36,501,837)"]`);assert.equal(await restore.count(),1,'행 ↺ 버튼');
      await box(last+1).fill('40000000');await box(last+1).blur();
      const all=scope.locator('button:has-text("단가 전체 원래값으로")');assert.equal(await all.innerText(),'↺ 단가 전체 원래값으로 (2건)');
      // 행 ↺
      await restore.click();
      assert.equal(await box(last).inputValue(),'36,501,837','행 ↺ → 원래값');
      assert.equal(await all.innerText(),'↺ 단가 전체 원래값으로 (1건)');
      // 다시 고친 뒤 전체 ↺
      await box(last).fill('1');await box(last).blur();
      await all.click();
      assert.equal(await box(last).inputValue(),'36,501,837');assert.equal(await box(last+1).inputValue(),'43,035,863','전체 ↺');
      assert.equal(await scope.locator('text=단가 전체 원래값으로').count(),0);
      // 옛 저장건(원래값 기록 없음)도 처음 고칠 때 그 값을 원래값으로 기억 — 단일 샘플 #1
      if(mode==='single'){
        const v0=await box(1).inputValue();
        await box(1).fill('123');await box(1).blur();
        await scope.locator(`span[title^="복붙 원래값(${v0})"]`).click();
        assert.equal(await box(1).inputValue(),v0,'옛 건도 복귀');
      }
      assert.deepEqual(errors,[]);
      console.log(mode,'OK');
      await ctx.close();
    }
    console.log('PASS');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
