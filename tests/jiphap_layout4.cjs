// 집합건물 화면 개편(2026-11-12) 검증 — 단일·여러 호수 둘 다
//  - 왼쪽 = 최근 평가서 목록(누르면 열림, 찾기), 탭 위 = 요약 띠(1번 탭은 한 줄, 나머지는 물건/접수/탁상 펼침)
//  - 탭 4개: 1. 접수 · 대상물건(접수개요|대상물건개요 한 화면) / 2. 사례 · 가격산출 / 2. 사례 · 가격산출 / 3. 위치도 · 청구서
//  - 3번 탭엔 청구서·서류 버튼이 안 보이고, 4번 탭엔 「내려받기 전 확인」+서류 버튼+청구서만 보인다(Step4는 한 번만 그림)
//  - 「💾 저장」 묶음은 화면에 하나만(1번 탭 = 접수번호 칸 위, 다른 탭 = 요약 띠)
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/jiphap_layout4.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');fs.createReadStream(f).pipe(res);});
const TABS=['1. 접수 · 대상물건','2. 사례 · 가격산출','3. 위치도 · 청구서'];
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
  try{
    for(const mode of ['single','multi']){
      const ctx=await browser.newContext({viewport:{width:1700,height:1000}}),page=await ctx.newPage(),errors=[];
      page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message);});page.setDefaultTimeout(60000);
      await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
      await page.addInitScript(({mode})=>{localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-jiphap-mode',mode);},{mode});
      await page.goto(base+'/s3r86w8a.html');
      const sc=page.locator(mode==='single'?'#root':'#root-multi');
      await sc.locator('.jr-rail').waitFor();

      // 탭 4개, 이름 그대로
      const tabs=sc.locator('.js-tab');
      assert.deepEqual(await tabs.locator('span:first-child').allInnerTexts(),TABS,mode+': 탭 이름');

      // 빈 새 평가서: 요약 띠는 「새 평가서」 한 줄, 저장 묶음은 접수번호 칸 위에 하나
      assert.equal(await sc.locator('.js-nm').innerText(),'새 평가서');
      assert.equal(await sc.locator('.js-row').count(),0,mode+': 1번 탭에서는 요약 둘째 줄 없음');
      assert.equal(await sc.locator('.save-btn').count(),1,mode+': 저장 버튼 하나');
      assert.equal(await sc.locator('.s1-save .save-btn').count(),1,mode+': 1번 탭 저장 버튼은 접수개요 안');
      // 1번 탭에 접수개요와 대상물건 입력이 같이 보인다
      assert(await sc.getByText('감정평가 개요',{exact:true}).isVisible(),mode+': 접수개요 보임');
      assert(await sc.getByText('건축물대장 불러오기',{exact:false}).first().isVisible(),mode+': 대상물건개요 보임');
      await tabs.nth(1).click();
      assert.equal(await sc.locator('.save-btn').count(),1,mode+': 2번 탭에서도 저장 버튼 하나');
      assert.equal(await sc.locator('.js-tools .save-btn').count(),1,mode+': 2번 탭 저장 버튼은 요약 띠');
      // 2번 탭 맨 위 한 줄: 붙여넣기 2칸 + 인근가격수준
      assert.equal(await sc.locator('.s3-top > div').count(),3,mode+': 사례 탭 맨 위 3칸');
      assert(await sc.getByPlaceholder('카이스에서 복사 후 여기에 Ctrl+V').isVisible());
      assert(await sc.getByPlaceholder('카파허브에서 복사 후 여기에 Ctrl+V').isVisible());

      // 2번 탭 = 사례 + 가격산출(가치형성요인 등), 청구서·위치도 없음 / 3번 탭 = 확인·서류·청구서 + 위치도, 사례·계산 없음
      const vis=async t=>sc.getByText(t,{exact:true}).first().isVisible();
      assert(await sc.locator('.s3-card').isVisible(),mode+': 2번 탭에 거래사례 표');
      if(mode==='multi')assert(await vis('적용단가'),mode+': 2번 탭에 적용단가(여러 호수는 빈 건에도 표가 있음)');
      assert(!(await sc.locator('.pf-list').isVisible()),mode+': 2번 탭엔 내려받기 전 확인 없음');
      assert(!(await vis('위치도 — 본건')),mode+': 2번 탭엔 위치도 없음');
      assert(!(await sc.locator('.k4-pick').isVisible()),mode+': 가격산출의 사례 선택 표는 숨김(왼쪽 거래사례 표와 겹침)');
      await tabs.nth(2).click();
      assert(!(await sc.locator('.s3-card').isVisible()),mode+': 3번 탭엔 거래사례 표 없음');
      if(mode==='multi')assert(!(await vis('적용단가')),mode+': 3번 탭엔 계산 없음');
      assert(!(await sc.getByPlaceholder('카이스에서 복사 후 여기에 Ctrl+V').isVisible()),mode+': 3번 탭엔 사례 없음');
      assert(await sc.locator('.pf-list').isVisible(),mode+': 3번 탭 내려받기 전 확인');
      assert(await vis('위치도 — 본건'),mode+': 3번 탭에 위치도');
      assert(await sc.locator('.k4-right .pf-item').count()>=6,mode+': 내려받기 전 확인 목록');
      assert(await sc.locator('.k4-right .pf-item.todo').count()>=3,mode+': 빈 건은 남은 일이 있다');
      assert(await sc.locator('.k4-right').getByRole('button',{name:'명세표(excel)'}).isVisible(),mode+': 서류 버튼은 3번 탭');
      // 「바로 가기」 → 그 탭으로
      await sc.locator('.k4-right .pf-item.todo a').first().click();
      assert(await sc.getByText('감정평가 개요',{exact:true}).isVisible(),mode+': 바로 가기 → 1번 탭');

      if(mode==='single'){
        // 왼쪽 목록에서 샘플 열기 → 요약 띠·탭 배지·결과
        const item=sc.locator('.jr-item').filter({hasText:'SAMPLE-압구정현대'});
        await item.waitFor();
        assert((await item.innerText()).includes('압구정동'),'목록 둘째 줄에 동 이름');
        assert((await item.innerText()).includes('이유진'),'목록 셋째 줄에 의뢰인');
        await item.click();
        await sc.locator('.js-nm',{hasText:'현대아파트 77동 904호'}).waitFor();
        assert(await sc.locator('.jr-item.cur').count()===1,'연 건이 목록에서 표시됨');
        assert.equal(await sc.locator('.js-row').count(),0,'열면 1번 탭 — 요약 한 줄');
        await tabs.nth(1).click();
        await sc.locator('.js-grp.res').waitFor();
        const res=await sc.locator('.js-grp.res').innerText();
        assert(res.includes('50,200,000')&&res.includes('7,900,000,000')&&res.includes('0.00%'),'요약 띠 결과: '+res);
        const row=await sc.locator('.js-row').innerText();
        assert(row.includes('157.36㎡')&&row.includes('2026.07.14')&&row.includes('7,900,000,000원'),'요약 띠 물건/접수/탁상: '+row);
        // 2번 탭 배치: 왼쪽 [거래사례 표 / 적용단가] | 오른쪽 [가치형성요인], 맨 아래 전체 폭 [시산가액 결정]
        await page.setViewportSize({width:1950,height:1000});await page.waitForTimeout(300);   // 2단은 본문 1550px 이상
        const bb=sel=>sc.locator(sel).first().boundingBox();
        const C=await bb('.s3-card'),A=await bb('.k4-apply'),F=await bb('.k4-colA'),Z=await bb('.k4-final');
        assert(F.x>C.x+C.width-2&&Math.abs(F.y-C.y)<4,'거래사례 | 가치형성요인 나란히');
        assert(Math.abs(A.x-C.x)<2&&A.y>C.y+C.height-2&&A.y<C.y+C.height+40,'적용단가는 거래사례 표 바로 아래');
        assert(Z.y>=F.y+F.height-2&&Z.width>C.width+F.width-2,'시산가액 결정은 맨 아래 전체 폭');
        assert((await tabs.nth(1).innerText()).includes('✓'),'2번 탭 배지 ✓');
        await page.setViewportSize({width:1700,height:1000});
        await tabs.nth(2).click();
        assert.equal(await sc.locator('.k4-right .pf-item.todo').count(),1,'샘플은 층별면적만 남음');
        for(const n of ['표지','괄감','의견서','요항표']){const b=sc.locator('.k4-right').getByRole('button',{name:n,exact:true});for(let k=0;k<40&&!(await b.isEnabled());k++)await page.waitForTimeout(250);assert(await b.isEnabled(),n+' 버튼 켜짐');}
        // 찾기
        await sc.getByLabel('저장된 건 찾기').fill('없는번호zzz');
        assert.equal(await sc.locator('.jr-item').count(),0,'찾기: 없는 건');
        await sc.getByLabel('저장된 건 찾기').fill('이유진');
        assert.equal(await sc.locator('.jr-item').count(),1,'찾기: 의뢰인으로');
      }
      // 왼쪽 접기 → 새 평가서·저장된 건 버튼이 요약 띠로
      await sc.getByText('◀ 접기',{exact:true}).first().click();
      assert(await sc.locator('.js-tools').getByRole('button',{name:/저장된 건/}).isVisible(),mode+': 접으면 저장된 건 버튼이 요약 띠에');
      await sc.locator('.jr-rail-min').click();
      assert(await sc.locator('.jr-rail').isVisible());

      // 좁은 화면(1100px): 가로로 넘치지 않고 1번 탭은 위아래로
      await page.setViewportSize({width:1100,height:900});await tabs.nth(0).click();
      const g=await sc.locator('.t1-cols').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length);
      assert.equal(g,1,mode+': 좁으면 한 줄');
      assert.deepEqual(errors,[],mode+' page errors');
      await ctx.close();console.log('PASS',mode);
    }
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
