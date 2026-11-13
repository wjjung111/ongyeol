// 집합건물 앱 「2. 사례 · 가격산출」 / 「3. 위치도 · 청구서」 배치 검증(단일·여러호수) — 2026-11-13 탭 3개로 다시 씀
//  - 2번 탭(단일): 왼쪽 [거래사례·평가전례 표 / 적용단가] | 오른쪽 [가치형성요인], 맨 아래 [시산가액 결정]. 본문 1550px 미만이면 한 줄. 여러호수는 위아래
//  - 3번 탭: [내려받기 전 확인·서류 | 청구서], 그 아래 전체 폭 위치도
//  - 청구서 칸(착수금)을 고치면 정산청구액이 바뀌고, 탭을 오가도 입력이 남는다
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/jiphap_k4_layout.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
  try{
    for(const mode of ['single','multi']){
      const W=mode==='multi'?2400:2300;   // 메모장을 펼친 화면 기준 — 단일호수 2번 탭 2단은 본문 1550px 이상   // 여러호수 적용단가 표가 본건 면적·사례 지번/건물명/호/면적 열로 ~1300px(2026-11-10) — 2단 검사는 넓은 창에서
      const ctx=await browser.newContext({viewport:{width:W,height:900}}),page=await ctx.newPage(),errors=[];
      page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message);});page.setDefaultTimeout(60000);
      await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
      await page.addInitScript(({mode})=>{
        localStorage.setItem('arap-user-name','wdw');(localStorage.setItem('arap-jiphap-mode',mode),sessionStorage.setItem('arap-jiphap-mode',mode));const pre=mode==='multi'?'v2:':'';
        const c=(id,sym,ho,price,sel)=>({id,symbol:sym,location:'서울특별시 중구 회현동2가',jibun:'87',aptName:'쌍용남산플라티넘 B-'+ho,dong:'',floor:'4',ho,exclusiveArea:88.5,price,unitPrice:Math.round(price/88.5),tradeDate:'2025.08.21',approvalDate:'2010.08.05',timeAdj:1.08473,timeAdjDetail:'x ≒ 1.08473',isShown:true,isSelected:sel});
        localStorage.setItem(pre+'appraisal-case-list',JSON.stringify([{id:'T',label:'t'}]));
        localStorage.setItem(pre+'case:T',JSON.stringify({ov:{caseNo:'T',jibun:'서울특별시 중구 회현동2가 87',units:[{id:1,dong:'7',floor:'7',ho:'702',area:'88.5'}],dong:'7',floor:'7',ho:'702',area:'88.5',baseDate:'2026.09.17',writeDate:'2026.09.17',client:'테스트'},cases:[c('c1','1','702',1141000000,true),c('c2','2','1501',2000000000,true),c('c3','3','801',2050000000,true)],precs:[],propType:'주거용'}));
      },{mode});
      await page.goto(base+'/s3r86w8a.html?last=1');
      const openMemo=async()=>{const b=page.locator('span:text-is("◀ 메모"):visible');await b.first().waitFor();await b.first().click();};   // 메모장은 켤 때 접혀 있다(2026-10-13) — 펼친 뒤 검사
      await openMemo();   // 폭 기준은 메모장을 펼친 화면
      const scope=page.locator(mode==='single'?'#root':'#root-multi');
      const tab=n=>scope.getByText(n,{exact:true}).click();
      const split=scope.locator('.k4-split').first();
      const box=sel=>split.locator(sel).evaluate(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,vis:!!e.offsetParent,text:e.innerText};});

      const tabs=scope.locator('.js-tab');
      const vis=sel=>scope.locator(sel).first().isVisible();
      const bb=sel=>scope.locator(sel).first().boundingBox();
      // 1) 「2. 사례 · 가격산출」 — 단일호수: 왼쪽 [거래사례 표 / 적용단가] | 오른쪽 [가치형성요인], 아래 전체 폭 [시산가액 결정]. 여러호수: 위아래(적용단가 표가 넓음)
      await tabs.nth(1).click();await scope.locator('.s3-card').waitFor();
      assert.ok(!(await vis('.pf-list')),'2번 탭엔 청구서 쪽 없음');
      assert.ok(!(await vis('.k4-pick')),'가격산출의 사례 선택 표 숨김');
      if(mode==='single'){
        const C=await bb('.s3-card'),F=await bb('.k4-colA'),A=await bb('.k4-apply'),Z=await bb('.k4-final');
        assert.ok(F.x>C.x+C.width-2&&Math.abs(F.y-C.y)<4,`거래사례 | 가치형성요인 ${JSON.stringify({C,F})}`);
        assert.ok(Math.abs(A.x-C.x)<2&&A.y>=C.y+C.height-2,'적용단가는 거래사례 아래');
        assert.ok(Z.y>=Math.max(F.y+F.height,A.y+A.height)-2,'시산가액 결정은 맨 아래');
        // 표가 잘리지 않음(2단일 때)
        const clipped=await scope.locator('.t23').evaluate(g=>[...g.querySelectorAll('.s3-card *,.k4-apply *')].filter(e=>{const o=getComputedStyle(e).overflowX;return(o==='auto'||o==='scroll')&&e.scrollWidth>e.clientWidth+4&&e.offsetParent;})   /* 표 테두리 몇 px(+3)은 원래부터 있음 — 열이 잘리는 수준만 본다 */.map(e=>e.scrollWidth+'>'+e.clientWidth));
        assert.deepEqual(clipped,[],'넓은 화면에서 거래사례·적용단가 표가 잘림');
        // 좁으면 한 줄
        await page.setViewportSize({width:1400,height:900});await page.waitForTimeout(300);
        const C2=await bb('.s3-card'),F2=await bb('.k4-colA');
        assert.ok(Math.abs(C2.x-F2.x)<2&&F2.y>C2.y,'좁으면 가치형성요인이 거래사례 아래');
        await page.setViewportSize({width:W,height:900});await page.waitForTimeout(300);
      }else{
        const C=await bb('.s3-card'),K=await bb('.t23-k4');
        assert.ok(Math.abs(C.x-K.x)<2&&K.y>=C.y+C.height-2,'여러호수: 가격산출은 거래사례 아래');
      }

      // 2) 「3. 위치도 · 청구서」 — [내려받기 전 확인·서류 | 청구서] + 오른쪽(좁으면 아래) 위치도. 사례·계산은 숨김
      await tabs.nth(2).click();
      assert.ok(!(await vis('.s3-card')),'3번 탭엔 거래사례 없음');
      assert.ok(await vis('.pf-list'),'3번 탭 내려받기 전 확인');
      const R=await split.locator('.k4-right').evaluate(e=>e.innerText);
      assert.ok(R.includes('내려받기 전 확인')&&R.includes('평가서 내려받기')&&R.includes('청구서'));
      const kids=()=>split.locator('.k4-right').evaluate(e=>[...e.children].map(c=>{const r=c.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};}));
      let k=await kids();assert.equal(k.length,2);
      assert.ok(k[1].x>k[0].x+k[0].w-2&&Math.abs(k[0].y-k[1].y)<=4,`확인 카드 | 청구서 카드 2단 ${JSON.stringify(k)}`);
      const M=await bb('.t23-map');
      assert.ok(M.y>=Math.max(k[0].y+k[0].h,k[1].y+k[1].h)-2&&M.width>k[0].w+k[1].w,`위치도는 청구서 아래 전체 폭 ${JSON.stringify({M,k})}`);

      // 3) 청구서 입력은 그대로 동작 — 기납부착수금 입력 → 정산청구액 반영 (평가수수료는 자동 계산이라 「착수금만큼 줄어드는지」를 본다)
      const due=async()=>{const t=await split.locator('.k4-right').innerText();const m=t.match(/정산청구액[^\d]*([\d,]+)/);return m?Number(m[1].replace(/,/g,'')):null;};
      const down=split.locator('.k4-right input').last();
      await down.fill('0');await down.blur();await page.waitForTimeout(300);
      const before=await due();
      await down.fill('50,000');await down.blur();
      await page.waitForTimeout(300);
      assert.equal(await down.inputValue(),'50,000');
      assert.ok(before>50000&&(await due())===before-50000,`기납부착수금을 넣으면 정산청구액이 50,000 줄어야 함 (${before} → ${await due()})`);
      // 탭을 오가도 청구서 입력이 남는다(Step4를 한 번만 그리므로)
      await tabs.nth(1).click();await tabs.nth(2).click();
      assert.equal(await down.inputValue(),'50,000','탭을 오간 뒤에도 착수금 유지');

      // 4) 좁은 화면 — 확인 카드 아래에 청구서, 위치도는 그 아래
      await page.setViewportSize({width:1100,height:900});await page.waitForTimeout(300);
      k=await kids();
      assert.ok(Math.abs(k[0].x-k[1].x)<=2&&k[1].y>=k[0].y+k[0].h-2,`좁으면 위아래 ${JSON.stringify(k)}`);
      const M2=await bb('.t23-map');assert.ok(M2.y>=k[1].y+k[1].h-2,'좁으면 위치도는 맨 아래');

      assert.deepEqual(errors,[]);
      console.log(mode+': PASS 2번 탭 사례|가치형성요인·적용단가·시산가액, 3번 탭 확인·서류|청구서|위치도, 입력 동작·유지, 좁은 화면 위아래, 페이지 오류 없음');
      await ctx.close();
    }
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
