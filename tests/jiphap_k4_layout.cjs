// 집합건물 앱 「3. 가격산출 · 위치도」 / 「4. 청구서 · 내려받기」 배치 검증(단일·여러호수) — 2026-11-12 화면 개편으로 다시 씀
//  - 3번 탭: 계산 쪽(.k4-left)만 — 단일호수는 본문이 넓으면 2단(사례 선택·가치형성요인 | 적용단가·감정평가액), 좁으면(<1300px) 한 줄. 여러호수는 항상 한 줄. 아래에 위치도
//  - 4번 탭: 청구서 쪽(.k4-right)만 — 내려받기 전 확인·서류 버튼 | 청구서. 좁으면 위아래
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
      const W=mode==='multi'?2400:2100;   // 여러호수 적용단가 표가 본건 면적·사례 지번/건물명/호/면적 열로 ~1300px(2026-11-10) — 2단 검사는 넓은 창에서
      const ctx=await browser.newContext({viewport:{width:W,height:900}}),page=await ctx.newPage(),errors=[];
      page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message);});page.setDefaultTimeout(60000);
      await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
      await page.addInitScript(({mode})=>{
        localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-jiphap-mode',mode);const pre=mode==='multi'?'v2:':'';
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

      // 1) 「3. 가격산출 · 위치도」 — 계산 쪽만 보이고 청구서는 숨는다. 단일호수는 넓으면 2단(사례 선택·요인 | 적용단가·감정평가액), 여러호수는 표가 넓어 한 줄
      await tab('3. 가격산출 · 위치도');await split.locator('.k4-left').waitFor();
      let L=await box('.k4-left'),R=await box('.k4-right');
      assert.ok(L.vis&&!R.vis,'3번 탭: 계산만 보임');
      assert.ok(L.text.includes('사례 선택')&&L.text.includes('적용단가'));
      assert.ok(!L.text.includes('청구서 hwpx 다운로드'),'청구서가 계산 쪽에 남음');
      if(mode==='single'){
        const A=await box('.k4-colA'),B=await box('.k4-colB');
        assert.ok(B.x>A.x+A.w-2&&Math.abs(A.y-B.y)<=4,`넓으면 2단 ${JSON.stringify({A:[A.x,A.y,A.w],B:[B.x,B.y,B.w]})}`);
        assert.ok(A.text.includes('사례 선택')&&A.text.includes('가치형성요인')&&!A.text.includes('적용단가'));
        assert.ok(B.text.includes('적용단가')&&B.text.includes('감정평가액 결정')&&!B.text.includes('사례 선택'));
      }
      const cols=()=>split.locator('.k4-left').evaluate(e=>getComputedStyle(e).display==='grid'?getComputedStyle(e).gridTemplateColumns.split(' ').length:1);
      for(const [w,exp] of (mode==='single'?[[2560,2],[1920,2],[1700,1],[1400,1]]:[[2600,1],[1700,1]])){
        await page.setViewportSize({width:w,height:900});await page.waitForTimeout(250);
        assert.equal(await cols(),exp,`${mode} ${w}px 계산 단 수`);
      }
      await page.setViewportSize({width:W,height:900});await page.waitForTimeout(250);
      assert.ok(await scope.getByText('위치도 — 본건',{exact:true}).isVisible(),'3번 탭 아래에 위치도');

      // 2) 「4. 청구서 · 내려받기」 — 청구서 쪽만 보인다: 왼쪽 = 내려받기 전 확인 + 서류 버튼, 오른쪽 = 청구서
      await tab('4. 청구서 · 내려받기');
      L=await box('.k4-left');R=await box('.k4-right');
      assert.ok(!L.vis&&R.vis,'4번 탭: 청구서만 보임');
      assert.ok(R.text.includes('내려받기 전 확인')&&R.text.includes('평가서 내려받기')&&R.text.includes('청구서'));
      assert.ok(!(await scope.getByText('위치도 — 본건',{exact:true}).isVisible()),'4번 탭엔 위치도 없음');
      const kids=()=>split.locator('.k4-right').evaluate(e=>[...e.children].map(c=>{const r=c.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};}));
      let k=await kids();assert.equal(k.length,2);
      assert.ok(k[1].x>k[0].x+k[0].w-2&&Math.abs(k[0].y-k[1].y)<=4,`확인 카드 | 청구서 카드 2단 ${JSON.stringify(k)}`);

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
      await tab('3. 가격산출 · 위치도');await tab('4. 청구서 · 내려받기');
      assert.equal(await down.inputValue(),'50,000','탭을 오간 뒤에도 착수금 유지');

      // 4) 좁은 화면 — 확인 카드 아래에 청구서
      await page.setViewportSize({width:1100,height:900});await page.waitForTimeout(300);
      k=await kids();
      assert.ok(Math.abs(k[0].x-k[1].x)<=2&&k[1].y>=k[0].y+k[0].h-2,`좁으면 위아래 ${JSON.stringify(k)}`);

      assert.deepEqual(errors,[]);
      console.log(mode+': PASS 3번 탭 계산(단일 2단/여러 한 줄)+위치도, 4번 탭 확인·서류|청구서, 입력 동작·유지, 좁은 화면 위아래, 페이지 오류 없음');
      await ctx.close();
    }
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
