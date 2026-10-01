// 집합건물 앱 ③ 사례 등 입력 — 거래사례·평가전례 표(단일/여러호수)와 여러호수 상세물건정보 표의 열 너비 조절 검증
//  - 안 끌었을 때는 예전과 똑같이 자동 너비(colgroup·고정 레이아웃 없음)
//  - 머리글 손잡이를 끌면 그 열만 넓어지고 / 새로고침해도 유지 / 더블클릭하면 기본 너비로 복귀
//  - 정렬 머리글(소재지)을 끌 때 정렬이 눌리지 않고, 끄는 도중 다시 그려져도 끊기지 않음
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/jiphap_col_resize.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
  try{
    for(const mode of ['single','multi']){
      const ctx=await browser.newContext({viewport:{width:1500,height:1000}}),page=await ctx.newPage(),errors=[];
      page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message);});page.setDefaultTimeout(60000);
      await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
      await page.addInitScript(({mode})=>{
        localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-jiphap-mode',mode);const prefix=mode==='multi'?'v2:':'';
        if(localStorage.getItem(prefix+'case:TEST-COLW'))return;
        const c=(id,sym,ho,price)=>({id,symbol:sym,location:'서울특별시 성동구 행당동',jibun:'87',aptName:'쌍용남산플라티넘 B-4',dong:'',floor:'4',ho,exclusiveArea:158.97,price,unitPrice:Math.round(price/158.97),tradeDate:'2025.11.27',approvalDate:'2010.08.05',timeAdj:null,timeAdjDetail:'',isShown:true,isSelected:false});
        const p=(id,sel)=>({id,selected:sel,location:'행당동',jibun:'87',buildingName:'검증',exclusiveArea:50,appraiseAmount:300000000,unitPrice:6000000,baseDate:'2026.01.01',purpose:'일반거래',isShown:true});
        localStorage.setItem(prefix+'appraisal-case-list',JSON.stringify([{id:'TEST-COLW',label:'열너비 검증'}]));
        localStorage.setItem(prefix+'case:TEST-COLW',JSON.stringify({ov:{caseNo:'TEST-COLW',jibun:'서울특별시 성동구 행당동 87',units:[{id:1,dong:'',floor:'4',ho:'404',area:'100'},{id:2,dong:'',floor:'5',ho:'505',area:'90'}],area:'100',baseDate:'2026.09.17',writeDate:'2026.09.17'},cases:[c('c1','1','404',2200000000),c('c2','2','2701',2140000000)],precs:[p('p1','a'),p('p2','b')],propType:'주거용'}));
      },{mode});
      await page.goto(base+'/s3r86w8a.html');
      const scope=page.locator(mode==='single'?'#root':'#root-multi');
      await scope.getByText('3. 사례 등 입력',{exact:true}).click();

      // 표는 머리글 글자로 찾는다(여러호수는 단계가 한 화면에 같이 떠서 순번이 다르다) — 0 = 거래사례, 1 = 평가전례
      const tbl=n=>scope.locator('table').filter({has:page.locator('th',{hasText:n===0?'사용승인일':'기준시점'})}).first();
      const widths=async n=>tbl(n).locator('thead > tr:first-child > th').evaluateAll(a=>a.map(t=>Math.round(t.getBoundingClientRect().width)));
      const info=n=>tbl(n).evaluate(t=>({fixed:getComputedStyle(t).tableLayout==='fixed',cols:t.querySelectorAll('colgroup > col').length,cls:t.className}));
      const grip=(n,i)=>tbl(n).locator('thead > tr:first-child > th').nth(i).locator('.rsz-grip');
      const dragBy=async(g,dx)=>{const b=await g.boundingBox();const x=b.x+b.width/2,y=b.y+b.height/2;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx/2,y,{steps:4});await page.mouse.move(x+dx,y,{steps:4});await page.mouse.up();};

      // 1) 안 끌었으면 자동 너비 — 손잡이는 머리글 칸 수만큼 있다
      let i0=await info(0);assert.equal(i0.fixed,false);assert.equal(i0.cols,0);
      assert.equal(await tbl(0).locator('thead .rsz-grip').count(),14);
      assert.equal(await tbl(1).locator('thead .rsz-grip').count(),12);
      const w0=await widths(0);assert.equal(w0.length,14);

      // 2) 건물명(6번) 열을 +80px — 그 열만 넓어지고 나머지는 그대로
      await dragBy(grip(0,6),80);
      const w1=await widths(0);i0=await info(0);
      assert.equal(i0.fixed,true);assert.equal(i0.cols,14);
      assert.ok(Math.abs(w1[6]-(w0[6]+80))<=2,`건물명 열 ${w0[6]}→${w1[6]}`);
      for(const j of [0,1,2,3,4,5,7,8,9,10,11,12,13])assert.ok(Math.abs(w1[j]-w0[j])<=2,`열 ${j} 변동 ${w0[j]}→${w1[j]}`);

      // 3) 정렬 머리글(소재지, 4번)을 끌어도 정렬이 눌리지 않는다 — 끄는 도중 다시 그려져도 끊기지 않고 좁히기도 된다
      const before=await tbl(0).locator('thead th').nth(4).innerText();
      await dragBy(grip(0,4),-40);
      const w2=await widths(0);
      assert.ok(Math.abs(w2[4]-(w1[4]-40))<=2,`소재지 열 ${w1[4]}→${w2[4]}`);
      const after=await tbl(0).locator('thead th').nth(4).innerText();
      assert.equal(after,before,'손잡이를 끌었는데 정렬이 눌림');

      // 4) 새로고침해도 유지(표별 localStorage), 평가전례 표는 영향 없음
      await page.waitForFunction(()=>!!localStorage.getItem('arap-colw-cases'));
      assert.equal(await page.evaluate(()=>localStorage.getItem('arap-colw-precs')),null);
      await page.reload();await scope.getByText('3. 사례 등 입력',{exact:true}).click();
      const w3=await widths(0);assert.ok(Math.abs(w3[6]-w1[6])<=2&&Math.abs(w3[4]-w2[4])<=2,`새로고침 뒤 ${w3}`);
      assert.equal((await info(1)).fixed,false);

      // 5) 평가전례 표도 따로 조절된다
      const p0=await widths(1);await dragBy(grip(1,5),60);const p1=await widths(1);
      assert.ok(Math.abs(p1[5]-(p0[5]+60))<=2,`평가전례 건물명 ${p0[5]}→${p1[5]}`);
      assert.equal((await info(1)).cols,12);

      // 6) 더블클릭 = 기본 너비로 복귀, 저장값 삭제
      await grip(0,6).dblclick();
      i0=await info(0);assert.equal(i0.fixed,false);assert.equal(i0.cols,0);
      assert.equal(await page.evaluate(()=>localStorage.getItem('arap-colw-cases')),null);

      // 7) 여러호수만: 상세물건정보(호 단위) 표 — '2. 대상물건개요'
      if(mode==='multi'){
        await scope.getByText('2. 대상물건개요',{exact:true}).click();
        const ut=scope.locator('table').filter({has:page.locator('th',{hasText:'탁상단가'})}).first();
        const uw=()=>ut.locator('thead > tr:first-child > th').evaluateAll(a=>a.map(t=>Math.round(t.getBoundingClientRect().width)));
        const u0=await uw();assert.equal(u0.length,13);
        const g=ut.locator('thead > tr:first-child > th').nth(7).locator('.rsz-grip');
        await g.scrollIntoViewIfNeeded();
        const b=await g.boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+50,b.y+b.height/2,{steps:6});await page.mouse.up();
        const u1=await uw();assert.ok(Math.abs(u1[7]-(u0[7]+50))<=2,`주용도 열 ${u0[7]}→${u1[7]}`);
        await g.dblclick();assert.equal(await page.evaluate(()=>localStorage.getItem('arap-colw-units')),null);
      }

      assert.deepEqual(errors,[]);
      console.log(mode+': PASS 자동너비 유지, 열 하나만 늘고 줄기, 정렬 안 눌림, 새로고침 유지, 더블클릭 복귀'+(mode==='multi'?', 호수 표':'')+', 페이지 오류 없음');
      await ctx.close();
    }
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
