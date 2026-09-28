// 집합건물 앱(단일·여러호수) 저장된 건 「⧉ 복제」·「🗑 휴지통」 검증.
// PLAYWRIGHT_MODULE=/path/to/playwright PLAYWRIGHT_CHANNEL=chromium node tests/jiphap_case_copy.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':'text/javascript');fs.createReadStream(f).pipe(res);});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL});
  try{for(const mode of ['single','multi']){
    const pre=mode==='multi'?'v2:':'';
    const ctx=await browser.newContext({viewport:{width:1500,height:900}}),page=await ctx.newPage(),errors=[];page.setDefaultTimeout(30000);
    page.on('pageerror',e=>errors.push(e.message));
    let answer=null;page.on('dialog',d=>d.type()==='prompt'?d.accept(answer==null?d.defaultValue():answer):d.accept());
    await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js'))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
    await page.addInitScript(({mode,pre})=>{if(sessionStorage.getItem('init'))return;sessionStorage.setItem('init','1');
      localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-jiphap-mode',mode);
      localStorage.setItem(pre+'appraisal-case-list',JSON.stringify([{id:'C-1',label:'C-1 검증빌딩 1동 101호'}]));
      localStorage.setItem(pre+'case:C-1',JSON.stringify({ov:{caseNo:'C-1',buildingName:'검증빌딩',dong:'1',ho:'101'},cases:[{id:'a',symbol:1,unitPrice:5000000}],precs:[],propType:'주거용'}));
      localStorage.setItem(pre+'appraisal-memo:C-1',JSON.stringify([{t:'메모'}]));},{mode,pre});
    await page.goto(base+'/s3r86w8a.html');
    const scope=page.locator(mode==='single'?'#root':'#root-multi');
    await scope.getByText(/📂 저장된 건/).click();
    const S=k=>page.evaluate(k=>localStorage.getItem(k),k);

    // ① 복제 — 기본 번호 C-1-2, 새 건으로 열림, 원본 유지, 메모 복사
    await scope.locator('.copy-btn').first().click();
    await page.waitForFunction(pre=>!!localStorage.getItem(pre+'case:C-1-2'),pre);
    const cp=JSON.parse(await S(pre+'case:C-1-2'));
    assert.equal(cp.ov.caseNo,'C-1-2');assert.equal(cp.cases[0].unitPrice,5000000);
    assert.ok(await S(pre+'case:C-1'));assert.ok(await S(pre+'appraisal-memo:C-1-2'));
    await scope.getByText('💾 C-1-2 저장완료').or(scope.getByText('⏳ C-1-2 저장중...')).first().waitFor();
    console.log(mode,'① 복제 OK');

    // ② 원본 삭제 → 휴지통 → 되살리기
    await scope.getByText(/📂 저장된 건/).click();
    const row=scope.locator('tr',{hasText:'C-1'}).filter({hasNotText:'C-1-2'}).first();
    await row.getByRole('button',{name:'삭제'}).click();
    assert.equal(await S(pre+'case:C-1'),null);
    const tr=JSON.parse(await S(pre+'appraisal-trash'));assert.equal(tr[0].id,'C-1');
    await scope.locator('.trash-btn').click();
    const tops=await scope.locator('tr',{hasText:'C-1-2'}).first().locator('td').last().locator('button').evaluateAll(bs=>bs.map(b=>Math.round(b.getBoundingClientRect().top)));
    assert.ok(Math.max(...tops)-Math.min(...tops)<5,'작업 열 한 줄 '+tops);
    await page.screenshot({path:process.env.SHOT?process.env.SHOT+'-'+mode+'.png':'/dev/null'}).catch(()=>{});
    await scope.locator('.trash-tbl').getByRole('button',{name:'↩ 되살리기'}).click();
    await page.waitForFunction(pre=>!!localStorage.getItem(pre+'case:C-1'),pre);
    assert.equal(JSON.parse(await S(pre+'case:C-1')).cases[0].unitPrice,5000000);
    assert.ok(await S(pre+'appraisal-memo:C-1'));
    assert.equal(JSON.parse(await S(pre+'appraisal-trash')).length,0);
    assert.ok(JSON.parse(await S(pre+'appraisal-case-list')).some(c=>c.id==='C-1'));
    console.log(mode,'② 휴지통 되살리기 OK');

    // ③ 이미 있는 번호로 복제 → 거절
    answer='C-1';await scope.locator('tr',{hasText:'C-1-2'}).first().locator('.copy-btn').click();answer=null;
    assert.equal(JSON.parse(await S(pre+'case:C-1')).ov.caseNo,'C-1');
    console.log(mode,'③ 중복 거절 OK');
    assert.deepEqual(errors,[]);await ctx.close();
  }console.log('OK');}
  finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
