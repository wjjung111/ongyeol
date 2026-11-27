// // 집합건물 여러 호수 ④ 적용단가 — 사례 「선택 안함」(2026-11-27): 고르면 자동 배정 없이 「-」, 저장·묶음 공유·다시 고르기 + 합계 줄
// (원본 틀: jiphap_multi_unit_group.cjs) 본건 묶기(A~E): 같은 글자 호수끼리 선정사례·요인 공유 (2026-11-09)
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
      localStorage.setItem('arap-user-name','wdw');(localStorage.setItem('arap-jiphap-mode','multi'),sessionStorage.setItem('arap-jiphap-mode','multi'));
      localStorage.setItem('v2:appraisal-case-list',JSON.stringify([{id:'GRP',label:'묶기 검증'}]));
      localStorage.setItem('v2:case:GRP',JSON.stringify({ov:{caseNo:'GRP',client:'검증',jibun:'대구광역시 중구 덕산동 96-15',units:us,baseDate:'2026.11.03',writeDate:'2026.11.03'},cases:cs,propType:'주거용',rnd:{uD:'원',uM:'none',tD:'원',tM:'none'}}));
      localStorage.setItem('v2:last-case-id','GRP');},
      {cs:[c('c1',1,10000000),c('c2',2,20000000)],us:[unit(1,'201'),unit(2,'202'),unit(3,'203'),unit(4,'204')]});
    await page.goto(base+'/s3r86w8a.html?last=1');
    const scope=page.locator('#root-multi');
    await scope.getByText('1. 접수 · 대상물건',{exact:true}).first().waitFor({timeout:60000});
    // 저장된 건 열기(시작 화면이 빈 평가서일 수 있음)
    if(!(await page.evaluate(()=>document.querySelector('#root-multi').innerText.includes('GRP')))){
      await scope.locator('button',{hasText:'저장된 건'}).first().click();
      await scope.getByText('묶기 검증').first().click();
    }
    await scope.getByText('2. 사례 · 가격산출',{exact:true}).click();
    const tbl=scope.locator('table').filter({has:page.getByRole('columnheader',{name:'묶음',exact:true})});
    await tbl.waitFor();
    const row=i=>tbl.locator('tbody tr').nth(i);
    const fac=(i,k)=>row(i).locator('input[type=text]').nth(k);   // 0 외부 1 내부 2 호별 3 기타
    const grp=(i,g)=>scope.getByLabel('묶음 '+'가나다라'[i],{exact:true}).selectOption(g);
    const kase=(i,id)=>scope.getByLabel('적용 사례 '+'가나다라'[i],{exact:true}).selectOption(id);
    const units=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('v2:case:GRP')).ov.units);
    const pick=i=>scope.getByLabel('적용 사례 '+'가나다라'[i],{exact:true});
    // 처음엔 자동 배정(#1)
    assert.equal(await pick(0).inputValue(),'c1','자동 배정');
    assert.match(await row(0).innerText(),/10,000,000/,'자동 배정 단가');
    // ① 선택 안함 → 사례 칸·금액 「-」, 자동 배정 안 됨
    await pick(0).selectOption('none');
    assert.equal(await pick(0).inputValue(),'none');
    assert.match(await row(0).locator('td').nth(4).innerText(),/안함/,'닫힌 칸 「안함」');
    const cells=await row(0).locator('td').allInnerTexts();
    assert.equal(cells[cells.length-1].trim(),'-','감정평가액 -');
    assert.equal(cells[5].trim(),'-','지번 -');
    assert.equal(await pick(1).inputValue(),'c1','다른 호는 그대로');
    // 합계 줄 — 선택 안함 호수는 빠지고 「1개호 미완」
    const tot=()=>tbl.locator('tfoot tr.u-total');
    assert.equal(await tot().getByLabel('감정평가액 합계').innerText(),'3,000,000,000','합계(3개호)');
    assert.match(await tot().innerText(),/1개호 미완/);
    assert.match(await tot().innerText(),/400\.00/,'면적 합');
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('v2:case:GRP')).ov.units[0].appliedCaseId==='none');
    // ② 새로고침해도 유지
    await page.reload();
    await scope.getByText('2. 사례 · 가격산출',{exact:true}).click({timeout:60000});
    await tbl.waitFor();
    assert.equal(await pick(0).inputValue(),'none','새로고침 후 선택 안함 유지');
    // ③ 묶음이면 묶음 전체 선택 안함
    await scope.getByLabel('묶음 나',{exact:true}).selectOption('A');await scope.getByLabel('묶음 다',{exact:true}).selectOption('A');
    await pick(1).selectOption('none');
    assert.equal(await pick(2).inputValue(),'none','묶음 공유');
    // ④ 다시 사례 고르면 정상
    await pick(0).selectOption('c2');
    assert.equal(await pick(0).inputValue(),'c2');
    assert.match(await row(0).innerText(),/20,000,000/,'다시 고른 사례 단가');
    assert.equal(await tot().getByLabel('감정평가액 합계').innerText(),'3,000,000,000','가 2억×10 + 라 1억×10');
    assert.match(await tot().innerText(),/2개호 미완/);
    // ⑤ resolveCase 직접
    const r=await page.evaluate(()=>{const cs=[{id:'c1',symbol:1,isSelected:true,timeAdj:1}];return [ArapMultiHwpx.resolveCase({appliedCaseId:'none'},cs),ArapMultiHwpx.resolveCase({},cs)?.id];});
    assert.deepEqual(r,[null,'c1']);
    await page.screenshot({path:path.join(process.env.SHOT_DIR||require('os').tmpdir(),'jiphap_multi_nocase.png')});
    assert.deepEqual(errors,[]);
    console.log('PASS');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
