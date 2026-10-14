// 집합건물 앱(단일·여러호수) 저장건 안전장치(arap_casebak.js) 검증 — 2026-10-15 ON261013-3301 사고 뒤.
//  ① 접수번호 칸만 고치면 새 건이 생기지 않고 원래 번호로 계속 저장
//  ② 「💾 번호 바꿔 저장」을 누르면 그 건의 번호만 바뀜(옛 번호 줄 빠짐, 메모도 따라감)
//  ③ 이미 다른 건이 쓰는 번호로는 저장 거절
//  ④ 새 평가서는 💾 저장을 눌러야 저장 시작, 이미 있는 번호는 거절
//  ⑥ 다른 창이 고친 내용을 덮어쓰면 「↺ 이전 버전」에 남고, 골라 되돌릴 수 있음
//  ⑤ 목록에서 빠진 저장건은 열 때 목록에 다시 올라옴
// PLAYWRIGHT_MODULE=/path/to/playwright PLAYWRIGHT_CHANNEL=chromium node tests/jiphap_case_rename.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':'text/javascript');fs.createReadStream(f).pipe(res);});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL});
  try{for(const mode of ['single','multi']){
    const pre=mode==='multi'?'v2:':'',wait=mode==='multi'?5800:900;   // 자동저장 대기(단일 0.4초·여러 5초)
    const ctx=await browser.newContext({viewport:{width:1500,height:900}}),page=await ctx.newPage(),errors=[];page.setDefaultTimeout(30000);
    page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
    await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
    await page.addInitScript(({mode,pre})=>{if(sessionStorage.getItem('init'))return;sessionStorage.setItem('init','1');
      localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-jiphap-mode',mode);
      const d=(id,b,n)=>JSON.stringify({ov:{caseNo:id,buildingName:b,dong:'1',ho:'101',owner:'홍길동',area:'84.9'},cases:Array.from({length:n},(_,i)=>({id:'c'+i,symbol:i+1,unitPrice:5000000})),precs:[],propType:'주거용'});
      localStorage.setItem(pre+'appraisal-case-list',JSON.stringify([{id:'C-1',label:'C-1 검증빌딩',updated:'2026-10-14T10:00:00Z'},{id:'D-1',label:'D-1 남의빌딩',updated:'2026-10-13T10:00:00Z'}]));
      localStorage.setItem(pre+'case:C-1',d('C-1','검증빌딩',3));
      localStorage.setItem(pre+'case:D-1',d('D-1','남의빌딩',2));
      localStorage.setItem(pre+'case:Z-9',d('Z-9','빠진빌딩',1));   // 목록에 없는 저장건
      localStorage.setItem(pre+'appraisal-memo:C-1',JSON.stringify([{t:'메모'}]));},{mode,pre});
    await page.goto(base+'/s3r86w8a.html');
    const scope=page.locator(mode==='single'?'#root':'#root-multi');
    const S=k=>page.evaluate(k=>localStorage.getItem(k),k);
    const J=async k=>JSON.parse(await S(k)||'null');
    const ids=async()=>(await J(pre+'appraisal-case-list')).map(c=>c.id);
    const caseNo=scope.locator('input[placeholder="HI260305-2601"]').first();
    await caseNo.waitFor();
    assert.equal(await caseNo.inputValue(),'C-1','마지막 작업건 C-1 복원');

    // ⑤ 목록에서 빠진 Z-9가 다시 올라옴
    assert.ok((await ids()).includes('Z-9'),'빠진 건 목록 복구');
    console.log(mode,'⑤ 빠진 건 목록 복구 OK');

    // ① 접수번호 칸만 고치면(💾 안 누름) 새 건이 생기지 않고 원래 번호로 계속 저장
    await caseNo.click();await caseNo.press('End');
    await caseNo.type('-');await page.waitForTimeout(wait);
    await caseNo.type('렉');await page.waitForTimeout(wait);
    await caseNo.type('스');await page.waitForTimeout(wait);
    let L=await ids();
    assert.ok(L.includes('C-1')&&!L.some(x=>/^C-1-/.test(x)),'중간 번호 건 없음 '+L);
    assert.equal((await J(pre+'case:C-1')).ov.caseNo,'C-1');assert.equal((await J(pre+'case:C-1')).cases.length,3);
    await scope.getByText(/접수번호 변경 대기: C-1 → C-1-렉스/).waitFor();
    console.log(mode,'① 칸만 고치면 새 건 안 생김 OK',L.join(','));

    // ② 💾 번호 바꿔 저장 → 이름 바꾸기(옛 번호 줄 빠짐, 메모 따라감)
    await scope.locator('.save-btn').click();
    await page.waitForFunction(pre=>!!localStorage.getItem(pre+'case:C-1-렉스'),pre);
    L=await ids();
    assert.ok(L.includes('C-1-렉스')&&!L.includes('C-1'),'번호 바뀜 '+L);
    assert.equal(await S(pre+'case:C-1'),null);assert.equal((await J(pre+'case:C-1-렉스')).cases.length,3);
    assert.ok(await S(pre+'appraisal-memo:C-1-렉스'),'메모 따라감');assert.equal(await S(pre+'appraisal-memo:C-1'),null);
    console.log(mode,'② 💾 번호 바꿔 저장 OK');

    // ③ 이미 있는 번호(D-1)로 저장 → 거절, D-1 그대로, 내용은 C-1-렉스로 계속
    const d1=await S(pre+'case:D-1');
    await caseNo.fill('D-1');await scope.locator('.save-btn').click();await page.waitForTimeout(wait);
    assert.equal(await S(pre+'case:D-1'),d1,'D-1 그대로');
    assert.ok((await ids()).includes('C-1-렉스'));
    await caseNo.fill('E-1');await scope.locator('.save-btn').click();
    await page.waitForFunction(pre=>!!localStorage.getItem(pre+'case:E-1'),pre);
    L=await ids();
    assert.ok(L.includes('E-1')&&L.includes('D-1')&&!L.includes('C-1-렉스'),'E-1로 바꿈 '+L);
    assert.equal(await S(pre+'case:D-1'),d1);
    console.log(mode,'③ 이미 있는 번호 거절 OK');

    // ④ 새 평가서 — 번호만 쳐서는 저장 안 됨, 💾 저장을 눌러야 저장 / 이미 있는 번호는 거절
    await scope.getByRole('button',{name:'+ 새 평가서'}).click();
    await caseNo.fill('N-1');await page.waitForTimeout(wait);
    assert.equal(await S(pre+'case:N-1'),null,'누르기 전 저장 안 됨');
    await scope.locator('.unsaved-msg').waitFor();
    await page.screenshot({path:process.env.SHOT?process.env.SHOT+'-unsaved-'+mode+'.png':'/dev/null'}).catch(()=>{});
    await scope.locator('.save-btn').click();
    await page.waitForFunction(pre=>!!localStorage.getItem(pre+'case:N-1'),pre);
    assert.ok((await ids()).includes('N-1'));
    await scope.getByRole('button',{name:'+ 새 평가서'}).click();
    await caseNo.fill('D-1');await scope.locator('.save-btn').click();await page.waitForTimeout(wait);
    assert.equal(await S(pre+'case:D-1'),d1,'새 평가서가 D-1을 덮어쓰지 않음');
    console.log(mode,'④ 새 평가서 💾 저장 OK');

    // ⑥ 다른 창이 고친 내용을 덮어쓰면 이전 버전에 남고 되돌리기
    await scope.getByText(/📂 저장된 건/).click();
    await scope.locator('tr',{hasText:'E-1'}).first().getByRole('button',{name:'열기'}).click();
    await page.waitForTimeout(300);
    await page.evaluate(pre=>{const o=JSON.parse(localStorage.getItem(pre+'case:E-1'));o.cases.push({id:'other',symbol:9,unitPrice:1});o.ov.buildingName='다른창빌딩';localStorage.setItem(pre+'case:E-1',JSON.stringify(o));},pre);
    await caseNo.click();await caseNo.press('End');   // 칸을 고쳤다 되돌려 자동저장을 한 번 일으킴
    await caseNo.type('x');await caseNo.press('Backspace');
    await page.waitForTimeout(wait);
    const ring=await J(pre+'appraisal-bak:E-1');
    assert.ok(ring&&ring.length>=1,'이전 버전 보관');
    assert.ok(ring.some(v=>JSON.parse(v.raw).ov.buildingName==='다른창빌딩'),'다른 창 내용이 이전 버전에');
    await page.locator('#arap-casebak-toast').waitFor();
    console.log(mode,'⑥ 덮어쓰기 전 내용 이전 버전 보관 OK');
    await scope.getByText(/📂 저장된 건/).click();
    const row=scope.locator('tr',{hasText:'E-1'}).first();
    await row.locator('.bak-btn').click();
    const k=ring.findIndex(v=>JSON.parse(v.raw).ov.buildingName==='다른창빌딩');
    await scope.locator('.bak-row .bak-restore').nth(k).click();
    await page.waitForTimeout(wait);
    const now=await J(pre+'case:E-1');
    assert.equal(now.ov.buildingName,'다른창빌딩');assert.equal(now.ov.caseNo,'E-1');assert.equal(now.cases.length,4);
    await page.screenshot({path:process.env.SHOT?process.env.SHOT+'-'+mode+'.png':'/dev/null'}).catch(()=>{});
    console.log(mode,'⑥ 이전 버전 되돌리기 OK');
    assert.deepEqual(errors,[]);await ctx.close();
  }
  console.log('ALL OK');
  }catch(e){console.error(e);process.exitCode=1;}finally{await browser.close();server.close();}
})();
