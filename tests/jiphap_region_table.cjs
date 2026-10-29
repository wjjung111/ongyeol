// 집건 시점수정 창 지역 = 표 목록(2026-10-29) — 지역1~지역4 칸으로 전국이 한 번에, 줄 클릭 선택, 검색칸. 월별 지수표 없음.
// ③ 거래사례 표의 시점수정치 칸으로 여는 창. 단일·여러 호수 둘 다. 실제 지수 파일.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8');fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true});
  try{
    for(const mode of ['single','multi']){
      const ctx=await browser.newContext({viewport:{width:1500,height:950}}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
      await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});return u.startsWith(base)?r.continue():r.abort();});
      await page.addInitScript(m=>{localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-jiphap-mode',m);
        const prefix=m==='multi'?'v2:':'';if(localStorage.getItem(prefix+'case:TEST-RT'))return;
        const c={id:'c1',symbol:'1',location:'전라북도 전주시 완산구 서신동',jibun:'1',aptName:'서신아파트',dong:'101',floor:'5',ho:'501',exclusiveArea:84.9,price:300000000,unitPrice:3533569,tradeDate:'2025.03.10',approvalDate:'2005.01.01',timeAdj:null,timeAdjDetail:'',isShown:true,isSelected:false};
        const ov={caseNo:'TEST-RT',jibun:'전라북도 전주시 완산구 서신동 1',area:'84.9',baseDate:'2026.08.01',writeDate:'2026.08.01'};if(m==='multi')ov.units=[{id:1,dong:'101',floor:'6',ho:'601',area:'84.9'}];
        localStorage.setItem(prefix+'appraisal-case-list',JSON.stringify([{id:'TEST-RT',label:'표 목록'}]));
        localStorage.setItem(prefix+'case:TEST-RT',JSON.stringify({ov,cases:[c],precs:[],propType:'주거용'}));},mode);
      await page.goto(base+'/s3r86w8a.html?last=1');
      const scope=page.locator(mode==='multi'?'#root-multi':'#root');
      await scope.getByText('3. 사례 등 입력',{exact:true}).click({timeout:60000});
      await scope.getByLabel('거래사례 #1 시점수정 단가').locator('xpath=preceding-sibling::td[1]').click();
      await page.waitForSelector('text=지수 자동계산');
      const region=()=>page.locator('[data-region]').getAttribute('data-region');
      // 표 머리 지역1~지역4, 월별 지수표(1월~12월) 없음
      const heads=await page.locator('th').evaluateAll(t=>t.map(x=>x.textContent));
      assert.deepEqual(heads.filter(h=>/^지역\d$/.test(h)),['지역1','지역2','지역3','지역4']);assert.ok(!heads.some(h=>/^\d+월$/.test(h)),'월별 지수표 없음');
      // 자동 선택 = 완산구(파랑 줄) · 선택 경로 표시
      assert.equal(await region(),'완산구');assert.equal(await page.locator('[data-region]').textContent(),'전북 > 전주시 > 완산구');
      const rows=page.locator('tr[data-key]');const n=await rows.count();assert.ok(n>200,'전국 줄 수 '+n);
      // 줄 순서: 서울이 맨 앞, 서울 > 강북지역 > 도심권 > 종로구 줄이 있음
      assert.equal(await rows.first().getAttribute('data-key'),'서울');
      assert.deepEqual(await page.locator('tr[data-key="종로구"] td').evaluateAll(t=>t.map(x=>x.textContent)),['서울','강북지역','도심권','종로구']);
      // 검색 → 클릭 → 계산
      await page.getByLabel('시점수정 지역 검색').fill('해운대');assert.equal(await rows.count(),1);
      await rows.first().click();assert.equal(await region(),'해운대구');
      await page.locator('div:has(> b:text("지수 자동계산")) button:text-is("계산")').click();
      assert.match((await page.locator('textarea').evaluateAll(t=>t.map(x=>x.value).filter(v=>/지역 :/.test(v))))[0]||'',/지역 : 부산 해운대구\n/);
      await page.getByLabel('시점수정 지역 검색').fill('없는지역xyz');assert.ok(await page.locator('text=찾는 지역이 없습니다').isVisible());
      assert.deepEqual(errors,[]);await ctx.close();console.log(mode,'OK');
    }
    console.log('PASS');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
