// 집합건물 여러 호수 ④ 적용단가 — 본건 묶기(A~E): 같은 글자 호수끼리 선정사례·요인 공유 (2026-11-09)
//  ① 묶음 지정 → 한 호 요인 수정이 묶음 전체에 반영  ② 사례 변경도 묶음 전체  ③ 두 묶음 독립
//  ④ 값 있는 묶음에 나중 합류 → 그 값 승계  ④-2 비교 의견도 공유(묶음당 칸 하나)  ⑤ 묶음 해제 후 따로 놂  ⑥ 저장(ov.units[].grp) 유지
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/jiphap_multi_unit_group.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':'text/javascript');fs.createReadStream(f).pipe(res);});
const c=(id,sym,price)=>({id,symbol:sym,location:'덕산동',jibun:'96-15',aptName:'사례'+sym,dong:'',floor:'1',ho:'10'+sym,exclusiveArea:'50',price:String(price*50),unitPrice:String(price),tradeDate:'2026.01.01',timeAdj:1,timeAdjDetail:'1.00000',isSelected:true,isShown:true});
const unit=(id,ho)=>({id,dong:'',floor:'2',ho,area:'100',evalArea:'',assessedArea:'100'});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true});
  try{
    const ctx=await browser.newContext({viewport:{width:1600,height:1000}}),page=await ctx.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());page.setDefaultTimeout(20000);
    await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});return u.startsWith(base)?r.continue():r.abort();});
    await page.addInitScript(({cs,us})=>{if(sessionStorage.getItem('seeded'))return;sessionStorage.setItem('seeded','1');
      localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-jiphap-mode','multi');
      localStorage.setItem('v2:appraisal-case-list',JSON.stringify([{id:'GRP',label:'묶기 검증'}]));
      localStorage.setItem('v2:case:GRP',JSON.stringify({ov:{caseNo:'GRP',client:'검증',jibun:'대구광역시 중구 덕산동 96-15',units:us,baseDate:'2026.11.03',writeDate:'2026.11.03'},cases:cs,propType:'주거용',rnd:{uD:'원',uM:'none',tD:'원',tM:'none'}}));
      localStorage.setItem('v2:last-case-id','GRP');},
      {cs:[c('c1',1,10000000),c('c2',2,20000000)],us:[unit(1,'201'),unit(2,'202'),unit(3,'203'),unit(4,'204')]});
    await page.goto(base+'/s3r86w8a.html?last=1');
    const scope=page.locator('#root-multi');
    await scope.getByText('2. 대상물건개요',{exact:true}).first().waitFor({timeout:60000});
    // 저장된 건 열기(시작 화면이 빈 평가서일 수 있음)
    if(!(await page.evaluate(()=>document.querySelector('#root-multi').innerText.includes('GRP')))){
      await scope.locator('button',{hasText:'저장된 건'}).first().click();
      await scope.getByText('묶기 검증').first().click();
    }
    await scope.getByText('4. 가격산출',{exact:true}).click();
    const tbl=scope.locator('table').filter({has:page.getByRole('columnheader',{name:'묶음',exact:true})});
    await tbl.waitFor();
    const row=i=>tbl.locator('tbody tr').nth(i);
    const fac=(i,k)=>row(i).locator('input[type=text]').nth(k);   // 0 외부 1 내부 2 호별 3 기타
    const grp=(i,g)=>scope.getByLabel('묶음 '+'가나다라'[i],{exact:true}).selectOption(g);
    const kase=(i,id)=>scope.getByLabel('적용 사례 '+'가나다라'[i],{exact:true}).selectOption(id);
    const units=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('v2:case:GRP')).ov.units);
    const setF=async(i,k,v)=>{await fac(i,k).fill(String(v));await fac(i,k).blur();};
    // ① 가·나 = A, 한 호 수정 → 둘 다
    await grp(0,'A');await grp(1,'A');
    await setF(0,1,1.05);
    assert.equal(await fac(1,1).inputValue(),'1.05','A 묶음 내부요인 공유');
    assert.equal(await fac(2,1).inputValue(),'1','묶음 밖 다호는 그대로');
    // ② 사례 변경도 묶음 전체
    await kase(1,'c2');
    assert.equal(await scope.getByLabel('적용 사례 가',{exact:true}).inputValue(),'c2','사례 공유');
    assert.equal(await scope.getByLabel('적용 사례 다',{exact:true}).inputValue(),'c1','묶음 밖 사례 그대로');
    // ③ 다·라 = B (독립)
    await grp(2,'B');await setF(2,2,0.97);await grp(3,'B');
    // ④ 라는 나중 합류 → B 값 승계
    assert.equal(await fac(3,2).inputValue(),'0.97','나중 합류 시 묶음 값 승계');
    assert.equal(await fac(0,2).inputValue(),'1','A 묶음은 B 영향 없음');
    await setF(3,0,1.1);
    assert.equal(await fac(2,0).inputValue(),'1.1');assert.equal(await fac(0,0).inputValue(),'1');
    // 비교 의견도 묶음 공유 — B 묶음(다·라)은 의견 칸 하나
    const notes=scope.locator('textarea[aria-label^="호별 비교 의견"]');
    assert.equal(await notes.count(),2,'A(가·나) 1칸 + B(다·라) 1칸');
    const noteB=scope.getByLabel('호별 비교 의견 3',{exact:true});
    await noteB.fill('- 외부요인: 같음');
    await page.waitForFunction(()=>{const u=JSON.parse(localStorage.getItem('v2:case:GRP')).ov.units;return u[2].factorNote==='- 외부요인: 같음'&&u[3].factorNote==='- 외부요인: 같음';});
    assert.equal(await scope.getByLabel('호별 비교 의견 4',{exact:true}).count(),0,'라호 의견 칸은 숨김(묶음 칸 하나)');
    assert.match(await noteB.locator('xpath=..').innerText(),/다·라/,'묶음 의견 칸 이름');
    // 본건 칸에 호수 표시
    assert.equal(await row(0).locator('td').nth(1).innerText(),'(가)201호','본건 옆 호수');
    // 색 띠
    const sh=await row(0).locator('td').first().evaluate(td=>getComputedStyle(td).boxShadow);assert.match(sh,/inset/,'색 띠');
    // ⑤ 해제
    await grp(1,'');await setF(1,1,0.9);
    assert.equal(await fac(0,1).inputValue(),'1.05','해제 후 따로');
    assert.equal(await fac(1,1).inputValue(),'0.9');
    // ⑥ 저장
    await page.waitForFunction(()=>{const u=JSON.parse(localStorage.getItem('v2:case:GRP')).ov.units;return u[1].intFactor===0.9&&u[3].extFactor===1.1;});
    const us=await units();
    assert.deepEqual(us.map(u=>u.grp||''),['A','','B','B']);
    assert.deepEqual(us.map(u=>u.appliedCaseId),['c2','c2',undefined,undefined].map((v,i)=>v??us[i].appliedCaseId));
    assert.equal(us[0].appliedCaseId,'c2');
    await page.reload();
    await scope.getByText('4. 가격산출',{exact:true}).click({timeout:60000});
    await tbl.waitFor();
    assert.equal(await scope.getByLabel('묶음 다',{exact:true}).inputValue(),'B','새로고침 후 묶음 유지');
    assert.equal(await fac(2,2).inputValue(),'0.97');
    await page.screenshot({path:path.join(process.env.SHOT_DIR||require('os').tmpdir(),'jiphap_multi_unit_group.png')});
    assert.deepEqual(errors,[]);
    console.log('PASS');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
