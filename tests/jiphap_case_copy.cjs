// 집합건물 앱(단일·여러호수) 저장된 건 「⧉ 복제」·「🗑 휴지통」 + 두 방식 목록 합본·방식 바꿔 복제 검증.
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
    await scope.locator('tr',{hasText:'C-1'}).filter({hasNotText:'SAMPLE'}).first().locator('.copy-btn').click();
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

  }
  // ── 두 방식 합본: 단일 건 S-1, 여러 건 M-1(호수 2개) ──
  {const ctx=await browser.newContext({viewport:{width:1500,height:900}}),page=await ctx.newPage(),errors=[];page.setDefaultTimeout(30000);
    page.on('pageerror',e=>errors.push(e.message));
    const msgs=[];page.on('dialog',d=>{msgs.push(d.message());d.type()==='prompt'?d.accept(d.defaultValue()):d.accept();});
    await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js'))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
    await page.addInitScript(()=>{if(sessionStorage.getItem('init'))return;sessionStorage.setItem('init','1');
      localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-jiphap-mode','multi');
      localStorage.setItem('appraisal-case-list',JSON.stringify([{id:'S-1',label:'S-1 단일빌딩 1동 101호',updated:'2026-09-01T00:00:00Z'}]));
      localStorage.setItem('case:S-1',JSON.stringify({ov:{caseNo:'S-1',buildingName:'단일빌딩',dong:'1',ho:'101',area:'84.5'},cases:[{id:'a',unitPrice:7000000}],precs:[],propType:'주거용'}));
      localStorage.setItem('v2:appraisal-case-list',JSON.stringify([{id:'M-1',label:'M-1 여러빌딩 2동 201호',updated:'2026-09-02T00:00:00Z'}]));
      localStorage.setItem('v2:case:M-1',JSON.stringify({ov:{caseNo:'M-1',buildingName:'여러빌딩',dong:'2',ho:'201',area:'59',units:[{id:1,dong:'2',ho:'201',area:'59'},{id:2,dong:'2',ho:'202',area:'60'}]},cases:[],precs:[],propType:'주거용'}));});
    await page.goto(base+'/s3r86w8a.html');
    const S=k=>page.evaluate(k=>localStorage.getItem(k),k);
    const multi=page.locator('#root-multi'),single=page.locator('#root');
    // ④ 여러 호수 화면 목록에 단일 건도 보임 → 「여러호수로 복제」
    await multi.getByText(/📂 저장된 건/).click();
    const sRow=multi.locator('tr',{hasText:'S-1'}).first();
    await sRow.locator('.kind-tag',{hasText:'단일'}).waitFor();
    await sRow.getByRole('button',{name:'⧉ 여러호수로 복제'}).click();
    await page.waitForFunction(()=>!!localStorage.getItem('v2:case:S-1'));
    const m=JSON.parse(await S('v2:case:S-1'));
    assert.equal(m.ov.units.length,1);assert.equal(m.ov.units[0].ho,'101');assert.equal(m.ov.units[0].area,'84.5');assert.equal(m.cases[0].unitPrice,7000000);
    assert.ok(await S('case:S-1'),'원본 단일 건 유지');
    console.log('④ 단일 → 여러 복제 OK');
    // ⑤ 단일 화면으로 가서 여러 건 M-1 을 「단일호수로 복제」 — 첫 호수만
    await page.click('#btn-single');
    await single.getByText(/📂 저장된 건/).click();
    const mRow=single.locator('tr',{hasText:'M-1'}).first();
    await mRow.getByRole('button',{name:'⧉ 단일호수로 복제'}).click();
    await page.waitForFunction(()=>!!localStorage.getItem('case:M-1'));
    const sg=JSON.parse(await S('case:M-1'));
    assert.equal(sg.ov.units,undefined);assert.equal(sg.ov.ho,'201');
    assert.ok(msgs.some(t=>/첫 번째\(가\) 호수만/.test(t)),'호수 여러 개 안내');
    console.log('⑤ 여러 → 단일 복제 OK');
    // ⑥ 단일 화면에서 여러 건 「열기」 → 여러 호수 화면으로 넘어가 열림
    await single.getByText(/📂 저장된 건/).click();
    await single.locator('tr',{hasText:'M-1'}).filter({has:page.locator('.kind-tag',{hasText:'여러'})}).first().getByRole('button',{name:'열기'}).click();
    await multi.getByText('💾 M-1 저장완료').or(multi.getByText('⏳ M-1 저장중...')).first().waitFor();
    assert.equal(await page.evaluate(()=>document.getElementById('root').style.display),'none');
    console.log('⑥ 다른 방식 열기 OK');
    // ⑦ 단일 화면에서 여러 건 삭제 → 여러 휴지통으로
    await page.click('#btn-single');await single.getByText(/📂 저장된 건/).click();
    await single.locator('tr',{hasText:'S-1'}).filter({has:page.locator('.kind-tag',{hasText:'여러'})}).first().getByRole('button',{name:'삭제'}).click();
    assert.equal(await S('v2:case:S-1'),null);assert.equal(JSON.parse(await S('v2:appraisal-trash'))[0].id,'S-1');
    assert.ok(await S('case:S-1'));
    await single.locator('.trash-btn').click();
    await page.screenshot({path:process.env.SHOT?process.env.SHOT+'-cross.png':'/dev/null'}).catch(()=>{});
    await single.locator('.trash-tbl').getByRole('button',{name:'↩ 되살리기'}).click();
    await page.waitForFunction(()=>!!localStorage.getItem('v2:case:S-1'));
    console.log('⑦ 다른 방식 삭제·되살리기 OK');
    assert.deepEqual(errors,[]);await ctx.close();}
  console.log('OK');}
  finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
