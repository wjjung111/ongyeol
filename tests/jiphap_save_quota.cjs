// 집합건물 앱(단일·여러호수) 「💾 저장」 — 브라우저 저장 공간이 가득 차 있으면 조용히 멈추지 않고 안내창을 띄우는지(2026-10-28 사용자 제보 ON261026-3002)
//  ① 공간 가득 → 💾 저장 → 「저장 공간이 가득 차서」 안내, 반쯤 저장된 새 건 없음, 화면은 여전히 「아직 저장 안 됨」
//  ② 공간을 비우고 다시 누르면 정상 저장
// PLAYWRIGHT_MODULE=/path/to/playwright PLAYWRIGHT_CHANNEL=chromium node tests/jiphap_save_quota.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':'text/javascript');fs.createReadStream(f).pipe(res);});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL});
  try{for(const mode of ['single','multi']){
    const pre=mode==='multi'?'v2:':'';
    const ctx=await browser.newContext({viewport:{width:1500,height:900}}),page=await ctx.newPage(),errors=[],dialogs=[];page.setDefaultTimeout(30000);
    page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{dialogs.push(d.message());d.accept();});
    await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
    await page.addInitScript(({mode})=>{if(sessionStorage.getItem('init'))return;sessionStorage.setItem('init','1');
      localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-jiphap-mode',mode);},{mode});
    await page.goto(base+'/s3r86w8a.html');
    const scope=page.locator(mode==='single'?'#root':'#root-multi');
    const caseNo=scope.locator('input[placeholder="HI260305-2601"]').first();
    await caseNo.waitFor();await page.waitForTimeout(800);
    // 저장 공간을 거의 다 채운다(남은 공간 < 건 하나)
    await page.evaluate(()=>{let n=0,sz=1<<20;const blk=s=>"x".repeat(s);
      while(sz>=16){try{localStorage.setItem("junk-"+n,blk(sz));n++;}catch(e){sz=sz>>1;}}});
    await caseNo.fill('QT-1');await page.waitForTimeout(300);
    await scope.locator('.save-btn').click();await page.waitForTimeout(500);
    assert.ok(dialogs.some(m=>/저장 공간이 가득 차서 이 건을 저장하지 못했습니다/.test(m)),'안내창 '+JSON.stringify(dialogs));
    assert.equal(await page.evaluate(k=>localStorage.getItem(k),pre+'case:QT-1'),null,'반쯤 저장된 건 없음');
    await scope.getByText(/아직 저장 안 됨/).waitFor();
    console.log(mode,'① 공간 가득 → 안내창 OK');
    // ② 비우고 다시
    await page.evaluate(()=>{Object.keys(localStorage).filter(k=>k.startsWith('junk-')).forEach(k=>localStorage.removeItem(k));});
    await scope.locator('.save-btn').click();
    await page.waitForFunction(pre=>!!localStorage.getItem(pre+'case:QT-1'),pre);
    await scope.getByText(/QT-1 저장완료/).waitFor();
    console.log(mode,'② 비운 뒤 저장 OK');
    assert.deepEqual(errors,[],'페이지 오류 '+errors.join('|'));
    await ctx.close();
  }}finally{await browser.close();server.close();}
  console.log('PASS jiphap_save_quota');
})().catch(e=>{console.error(e);process.exit(1);});
