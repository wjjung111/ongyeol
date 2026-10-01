// 집합건물 앱 ④ 가격산출 2단 배치 검증(단일·여러호수)
//  - 본문 폭이 넓으면: 왼쪽 = 사례 선택·가치형성요인(여러호수는 적용단가·감정평가액 결정), 오른쪽 = 청구서 카드
//  - 오른쪽 청구서는 아래로 스크롤해도 화면 위쪽에 붙어 따라온다(sticky) — 단일호수만(여러호수는 페이지 전체가 스크롤되는 구조라 같이 스크롤)
//  - 본문 폭이 좁으면(<1100px) 한 줄로 쌓인다 — 예전과 같은 순서(청구서가 맨 아래)
//  - 청구서 칸(착수금)을 고치면 정산청구액이 바뀌는 등 입력이 그대로 동작
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
      const ctx=await browser.newContext({viewport:{width:2100,height:900}}),page=await ctx.newPage(),errors=[];
      page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message);});page.setDefaultTimeout(60000);
      await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
      await page.addInitScript(({mode})=>{
        localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-jiphap-mode',mode);const pre=mode==='multi'?'v2:':'';
        const c=(id,sym,ho,price,sel)=>({id,symbol:sym,location:'서울특별시 중구 회현동2가',jibun:'87',aptName:'쌍용남산플라티넘 B-'+ho,dong:'',floor:'4',ho,exclusiveArea:88.5,price,unitPrice:Math.round(price/88.5),tradeDate:'2025.08.21',approvalDate:'2010.08.05',timeAdj:1.08473,timeAdjDetail:'x ≒ 1.08473',isShown:true,isSelected:sel});
        localStorage.setItem(pre+'appraisal-case-list',JSON.stringify([{id:'T',label:'t'}]));
        localStorage.setItem(pre+'case:T',JSON.stringify({ov:{caseNo:'T',jibun:'서울특별시 중구 회현동2가 87',units:[{id:1,dong:'7',floor:'7',ho:'702',area:'88.5'}],dong:'7',floor:'7',ho:'702',area:'88.5',baseDate:'2026.09.17',writeDate:'2026.09.17',client:'테스트'},cases:[c('c1','1','702',1141000000,true),c('c2','2','1501',2000000000,true),c('c3','3','801',2050000000,true)],precs:[],propType:'주거용'}));
      },{mode});
      await page.goto(base+'/s3r86w8a.html');
      const scope=page.locator(mode==='single'?'#root':'#root-multi');
      await scope.getByText('4. 가격산출',{exact:true}).click();
      const split=scope.locator('.k4-split:visible').first();await split.waitFor();
      const geo=()=>split.evaluate(sp=>{const L=sp.querySelector('.k4-left'),R=sp.querySelector('.k4-right');const l=L.getBoundingClientRect(),r=R.getBoundingClientRect();return{l:{x:l.x,y:l.y,w:l.width,h:l.height},r:{x:r.x,y:r.y,w:r.width,h:r.height},leftText:L.innerText,rightText:R.innerText};});

      // 1) 넓은 화면 — 2단: 오른쪽이 청구서, 왼쪽에 사례 선택(+가치형성요인/적용단가)
      let g=await geo();
      assert.ok(g.r.x>g.l.x+g.l.w-2,`오른쪽 열이 왼쪽 오른편에 있어야 함 ${JSON.stringify(g)}`);
      assert.ok(Math.abs(g.r.y-g.l.y)<=40,`두 열의 윗선이 같아야 함 ${g.r.y} vs ${g.l.y}`);
      assert.ok(g.r.w>=430&&g.r.w<=560,`청구서 폭 ${g.r.w}`);
      assert.ok(g.l.w>=900,`왼쪽 폭 ${g.l.w}`);
      assert.ok(g.leftText.includes('사례 선택'));
      assert.ok(mode==='single'?g.leftText.includes('가치형성요인'):g.leftText.includes('적용단가'));
      assert.ok(g.rightText.includes('청구서'));
      assert.ok(!g.leftText.includes('청구서 hwpx 다운로드'),'청구서 카드가 왼쪽에 남음');
      assert.ok(!g.rightText.includes('사례 선택'),'사례 선택이 오른쪽에 들어감');

      // 2) 스크롤해도 청구서가 따라온다 — 가운데 스크롤 영역을 내린 뒤에도 오른쪽 열이 화면 위에 붙어 있다
      await page.setViewportSize({width:2100,height:520});await page.waitForTimeout(200);   // 창을 낮춰 두면 짧은 건에서도 스크롤 여지가 생긴다
      const scroller=await split.evaluateHandle(sp=>{let e=sp.parentElement;while(e&&!(getComputedStyle(e).overflowY==='auto'&&e.scrollHeight>e.clientHeight+50))e=e.parentElement;return e||document.scrollingElement;});   // 단일호수는 가운데 영역이, 여러호수는 페이지 전체가 스크롤된다
      const sc0=await scroller.evaluate(e=>{const pg=e===document.scrollingElement;return{top:pg?0:e.getBoundingClientRect().top,max:e.scrollHeight-e.clientHeight};});
      assert.ok(sc0.max>200,`스크롤 여지가 있어야 검증 가능: ${sc0.max}`);
      await scroller.evaluate(e=>{e.scrollTop=400;});await page.waitForTimeout(150);
      g=await geo();
      assert.ok(g.l.y<-100,'왼쪽은 같이 올라가야 함');
      // 단일호수: 가운데 영역이 스크롤되므로 청구서가 위에 붙어 따라온다. 여러호수: 가운데 영역에 높이 제한이 없어(페이지 전체 스크롤) 따라오기(sticky)는 적용되지 않고 같이 스크롤된다 — 2단 배치만 유지
      if(mode==='single'){assert.ok(g.r.y<sc0.top+40&&g.r.y>=sc0.top-2,`스크롤 후 청구서 위치 ${g.r.y} (스크롤영역 위 ${sc0.top})`);assert.ok(g.r.y+g.r.h<=520+1,`낮은 창에서 청구서 아래가 화면 밖 ${g.r.y+g.r.h}`);}
      else assert.ok(g.r.x>g.l.x+g.l.w-2,'스크롤 뒤에도 2단 유지');
      await scroller.evaluate(e=>{e.scrollTop=0;});await page.setViewportSize({width:2100,height:900});await page.waitForTimeout(200);

      // 3) 오른쪽 청구서 입력은 그대로 동작 — 기납부착수금 입력 → 정산청구액 반영
      const down=split.locator('.k4-right input').last();
      await down.fill('50,000');await down.blur();
      await page.waitForTimeout(300);
      assert.equal(await down.inputValue(),'50,000');
      assert.ok((await split.locator('.k4-right').innerText()).includes('27,000'),'기납부착수금을 넣으면 정산청구액(77,000-50,000)이 바뀌어야 함');

      // 3-1) 어느 폭에서도 왼쪽 표가 잘리지 않는다(특히 여러호수 적용단가 표 ~980px) — 2단이면 왼쪽 폭이 충분하거나, 모자라면 한 줄로 쌓여 있어야 함
      const clipped=()=>split.evaluate(sp=>[...sp.querySelectorAll('.k4-left *')].filter(e=>{const o=getComputedStyle(e).overflowX;return(o==='auto'||o==='scroll')&&e.scrollWidth>e.clientWidth+1&&e.offsetParent;}).map(e=>e.scrollWidth+'>'+e.clientWidth));
      const cols=()=>split.evaluate(sp=>getComputedStyle(sp).gridTemplateColumns.split(' ').length);
      for(const [w,exp] of (mode==='single'?[[2560,2],[1920,2],[1700,1],[1600,1]]:[[2560,2],[2100,2],[1920,1],[1700,1]])){
        await page.setViewportSize({width:w,height:900});await page.waitForTimeout(250);
        assert.equal(await cols(),exp,`${mode} ${w}px 단 수`);
        assert.deepEqual(await clipped(),[],`${mode} ${w}px 에서 표가 잘림`);
      }
      await page.setViewportSize({width:2100,height:900});await page.waitForTimeout(250);

      // 4) 좁은 화면(본문 1100px 미만) — 한 줄로 쌓임: 청구서가 왼쪽 내용 아래
      await page.setViewportSize({width:1400,height:900});await page.waitForTimeout(300);
      g=await geo();
      assert.ok(Math.abs(g.r.x-g.l.x)<=2&&Math.abs(g.r.w-g.l.w)<=2,`좁으면 폭이 같아야 함 ${JSON.stringify(g)}`);
      assert.ok(g.r.y>=g.l.y+g.l.h-2,'좁으면 청구서가 아래에 놓여야 함');
      const pos=await split.locator('.k4-right').evaluate(e=>getComputedStyle(e).position);assert.equal(pos,'static');


      assert.deepEqual(errors,[]);
      console.log(mode+': PASS 2단 배치(왼쪽 사례·요인 / 오른쪽 청구서), 스크롤 시 청구서 고정, 입력 동작, 좁은 화면 한 줄, 페이지 오류 없음');
      await ctx.close();
    }
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
