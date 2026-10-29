// 집건(③ 사례 표·④ 가격산출, 단일·여러 호수)·입주권 시점수정 창 = 계산기(arm_시점수정.html) 화면처럼(2026-10-29)
// 왼쪽 입력(유형·지역 표·거래시점·기준시점·「시점수정치 계산」) | 오른쪽 결과(시점수정치 크게·산식). 날짜 칸은 사례·개요 값으로 미리 채우고 고치면 그 날짜로 계산.
// 「적용」 → 사례 시점수정치 칸에 들어감. 실제 지수 파일.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8');fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true});
  const newPage=async(init,arg)=>{const ctx=await browser.newContext({viewport:{width:1500,height:950}}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
    await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});return u.startsWith(base)?r.continue():r.abort();});
    await page.addInitScript(init,arg);return {ctx,page,errors};};
  // 창 공통 확인: 좌우 배치, 날짜 미리 채움, 계산 → 큰 숫자 = 산식 값, 거래시점 고치면 그 날짜로
  const checkModal=async(page,tradeDate,baseDate,tag)=>{
    await page.waitForSelector('button:text-is("시점수정치 계산")');
    const L=await page.getByLabel('시점수정 유형').boundingBox(),R=await page.getByLabel('시점수정치 결과').boundingBox();
    assert.ok(R.x>L.x+300&&Math.abs(R.y-L.y)<120,tag+' 입력 왼쪽 · 결과 오른쪽 '+JSON.stringify([L,R]));
    assert.equal(await page.getByLabel('시점수정 거래시점').inputValue(),tradeDate,tag+' 거래시점');assert.equal(await page.getByLabel('시점수정 기준시점').inputValue(),baseDate,tag+' 기준시점');
    await page.click('button:text-is("시점수정치 계산")');
    const ta=page.locator('textarea').filter({hasText:''});const txt=async()=>(await page.locator('textarea').evaluateAll(t=>t.map(x=>x.value).filter(v=>/지역 :/.test(v))))[0]||'';
    let t=await txt();const m=t.match(/≒(\d\.\d{5})/);assert.ok(m,tag+' 산식 '+t);
    assert.equal(await page.getByLabel('시점수정치 결과').textContent(),m[1],tag+' 큰 숫자 = 산식 값');
    await page.getByLabel('시점수정 거래시점').fill('20240115');assert.equal(await page.getByLabel('시점수정 거래시점').inputValue(),'2024.01.15');
    await page.click('button:text-is("시점수정치 계산")');t=await txt();assert.match(t,/2024년 1월 15일|2023년 12월/,tag+' 고친 거래시점으로 계산');
    assert.ok(await page.locator('text=사례 거래시점').first().isVisible(),tag+' 사례와 다른 날짜 안내');
    return (await page.getByLabel('시점수정치 결과').textContent());};
  try{
    for(const mode of ['single','multi']){
      const {ctx,page,errors}=await newPage(m=>{localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-jiphap-mode',m);
        const prefix=m==='multi'?'v2:':'';if(localStorage.getItem(prefix+'case:TEST-ML'))return;
        const c={id:'c1',symbol:'1',location:'서울특별시 강남구 대치동',jibun:'1',aptName:'대치아파트',dong:'101',floor:'5',ho:'501',exclusiveArea:84.9,price:2000000000,unitPrice:23557126,tradeDate:'2025.03.10',approvalDate:'2005.01.01',timeAdj:null,timeAdjDetail:'',isShown:true,isSelected:true};
        const ov={caseNo:'TEST-ML',jibun:'서울특별시 강남구 대치동 1',area:'84.9',baseDate:'2026.08.01',writeDate:'2026.08.01'};if(m==='multi')ov.units=[{id:1,dong:'101',floor:'6',ho:'601',area:'84.9'}];
        localStorage.setItem(prefix+'appraisal-case-list',JSON.stringify([{id:'TEST-ML',label:'창 배치'}]));
        localStorage.setItem(prefix+'case:TEST-ML',JSON.stringify({ov,cases:[c],precs:[],propType:'주거용'}));},mode);
      await page.goto(base+'/s3r86w8a.html?last=1');
      const scope=page.locator(mode==='multi'?'#root-multi':'#root');
      await scope.getByText('3. 사례 등 입력',{exact:true}).click({timeout:60000});
      const cell=scope.getByLabel('거래사례 #1 시점수정 단가').locator('xpath=preceding-sibling::td[1]');await cell.click();
      assert.equal(await page.locator('[data-region]').getAttribute('data-region'),'강남구');
      const v=await checkModal(page,'2025.03.10','2026.08.01','집건 '+mode+' ③');
      await page.click('button:text-is("적용")');await page.waitForSelector('button:text-is("시점수정치 계산")',{state:'detached'});
      assert.match(await cell.textContent(),new RegExp(v.replace('.','\\.')),mode+' 적용 → 사례 칸');
      assert.deepEqual(errors,[]);await ctx.close();console.log('집건',mode,'OK');
    }
    {const {ctx,page,errors}=await newPage(()=>{localStorage.setItem('arap-user-name','wdw');});
      await page.goto(base+'/'+encodeURI('입주권.html'),{waitUntil:'domcontentloaded'});await page.waitForSelector('text=② 접수개요',{timeout:60000});
      await page.click('text=③ 사례 등 입력');await page.locator('td:has-text("1.01500")').first().click();
      const td=await page.getByLabel('시점수정 거래시점').inputValue(),bd=await page.getByLabel('시점수정 기준시점').inputValue();
      assert.match(td,/^\d{4}\.\d{2}\.\d{2}$/);assert.match(bd,/^\d{4}\.\d{2}\.\d{2}$/);
      await checkModal(page,td,bd,'입주권');
      await page.getByLabel('시점수정 지역 검색').fill('분당');await page.locator('tr[data-key="분당구"]').click();assert.equal(await page.locator('[data-region]').getAttribute('data-region'),'분당구');
      await page.click('button:text-is("취소")');
      assert.deepEqual(errors,[]);await ctx.close();console.log('입주권 OK');}
    console.log('PASS');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
