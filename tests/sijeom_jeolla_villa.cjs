// 전라도 연립다세대 시점수정(2026-10-29) — 실제 지수 파일로 집건(단일·여러 호수)·입주권 시점수정 창에서 계산.
// 연립다세대는 시도 단위만 공표 → 완산구 사례는 「전북」, 여수시 사례는 「전남」(전남광주 묶음 이름 안 붙임) 지수로 대체.
// 집건: 사례 소재지(전주 완산구 ○○빌라)로 유형·지역 자동 선택까지 확인. 입주권: 유형·지역을 골라 계산.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8');fs.createReadStream(f).pipe(res);});
const checkText=(t,sido)=>{assert.match(t,/^연립다세대\n/,t);assert.match(t,new RegExp(`지역 : ${sido}\\n`),t);
  assert.match(t,new RegExp(`※ 연립다세대 지수는 .+ 단위로 공표되지 않아 ${sido} 지수를 적용함`),t);assert.doesNotMatch(t,/전남광주/,t);assert.match(t,/시점수정치 : [\d.]+\/[\d.]+≒\d\.\d{5}/,t);};
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true});
  const newPage=async(init,arg)=>{const ctx=await browser.newContext({viewport:{width:1500,height:900}}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
    await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});return u.startsWith(base)?r.continue():r.abort();});
    await page.addInitScript(init,arg);return {ctx,page,errors};};
  const modalText=async(scope)=>{await scope.locator('div:has(> b:text("지수 자동계산")) button:text-is("계산")').click();
    const v=await scope.locator('textarea').evaluateAll(t=>t.map(x=>x.value).filter(v=>/지역 :/.test(v)));return v[0]||'';};
  try{
    // 집건 단일·여러 호수
    for(const [loc,name,sido,ta] of [['전라북도 전주시 완산구 서신동','서신빌라','전북',1.01234],['전라남도 여수시 웅천동','웅천연립','전남',1.02345]])for(const mode of ['single','multi']){
      const {ctx,page,errors}=await newPage(([m,loc,name])=>{localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-jiphap-mode',m);
        const prefix=m==='multi'?'v2:':'';if(localStorage.getItem(prefix+'case:TEST-JV'))return;
        const c={id:'c1',symbol:'1',location:loc,jibun:'1',aptName:name,dong:'',floor:'2',ho:'201',exclusiveArea:59.9,price:150000000,unitPrice:2504174,tradeDate:'2025.03.10',approvalDate:'2005.01.01',timeAdj:null,timeAdjDetail:'',isShown:true,isSelected:false};
        const ov={caseNo:'TEST-JV',jibun:loc+' 1',area:'59.9',baseDate:'2026.08.01',writeDate:'2026.08.01'};if(m==='multi')ov.units=[{id:1,dong:'',floor:'2',ho:'202',area:'59.9'}];
        localStorage.setItem(prefix+'appraisal-case-list',JSON.stringify([{id:'TEST-JV',label:'전라 연립'}]));
        localStorage.setItem(prefix+'case:TEST-JV',JSON.stringify({ov,cases:[c],precs:[],propType:'주거용'}));},[mode,loc,name]);
      await page.goto(base+'/s3r86w8a.html?last=1');
      const scope=page.locator(mode==='multi'?'#root-multi':'#root');
      await scope.getByText('3. 사례 등 입력',{exact:true}).click({timeout:60000});
      await scope.getByLabel('거래사례 #1 시점수정 단가').locator('xpath=preceding-sibling::td[1]').click();
      await page.waitForSelector('text=지수 자동계산');
      const sel=page.locator('div:has(> b:text("지수 자동계산")) select');
      assert.equal(await sel.nth(0).inputValue(),'연립다세대',mode+' 유형 자동');
      const want=sido==='전북'?'완산구':'여수시';assert.equal(await sel.nth(1).inputValue(),want,mode+' 지역 자동');
      checkText(await modalText(page),sido);
      assert.deepEqual(errors,[]);await ctx.close();console.log('집건',mode,sido,'OK');
    }
    // 입주권
    {const {ctx,page,errors}=await newPage(()=>{localStorage.setItem('arap-user-name','wdw');});
      await page.goto(base+'/'+encodeURI('입주권.html'),{waitUntil:'domcontentloaded'});await page.waitForSelector('text=② 접수개요',{timeout:60000});
      await page.click('text=③ 사례 등 입력');await page.locator('td:has-text("1.01500")').first().click();await page.waitForSelector('text=지수 자동계산');
      const sel=page.locator('div:has(> b:text("지수 자동계산")) select');
      await sel.nth(0).selectOption('연립다세대');
      // 입주권 지역은 단계 선택(시도 → … → 구)
      const steps=page.locator('select[aria-label^="시점수정 지역"]');
      for(const [path,sido] of [[['전북','전주시','완산구'],'전북'],[['전남광주','전남','여수시'],'전남'],[['전남광주','광주','광산구'],'광주']]){
        for(let i=0;i<path.length;i++)await steps.nth(i).selectOption(path[i]);
        assert.equal(await page.locator('[data-region]').getAttribute('data-region'),path[path.length-1]);
        checkText(await modalText(page),sido);console.log('입주권',path.join('>'),'→',sido,'OK');}
      assert.deepEqual(errors,[]);await ctx.close();}
    console.log('PASS');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
