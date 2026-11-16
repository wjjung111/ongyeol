// 집건 거래사례 「용도」 칸(2026-11-16) — 주거·비주거 섞인 건
//  - 거래사례 표에 용도 열(고르기/직접 입력). 근린생활시설이면 🧮 창이 자본수익률, 아파트면 매매가격지수(건 전체는 주거용 그대로)
//  - 여러 호수: 사례를 안 고른 호수는 주용도(전유부)와 같은 갈래 사례를 기본으로(근생 호수 → 근생 사례), 갈래가 다르면 ⚠
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/jiphap_case_use.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true});
  try{
    for(const mode of ['single','multi']){
      const ctx=await browser.newContext({viewport:{width:2200,height:1000}}),page=await ctx.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(60000);
      await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
      await page.addInitScript(({mode})=>{
        localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-jiphap-mode',mode);sessionStorage.setItem('arap-jiphap-mode',mode);const pre=mode==='multi'?'v2:':'';
        const c=(id,sym,name,use,sel)=>({id,symbol:sym,location:'서울특별시 성동구 성수동1가',jibun:'1',aptName:name,dong:'',floor:'2',ho:'201',exclusiveArea:50,price:300000000,unitPrice:6000000,tradeDate:'2026.03.10',approvalDate:'2010.01.01',timeAdj:null,timeAdjDetail:'',isShown:true,isSelected:sel,...(use?{useKind:use}:{})});
        localStorage.setItem(pre+'appraisal-case-list',JSON.stringify([{id:'T',label:'t'}]));
        localStorage.setItem(pre+'case:T',JSON.stringify({ov:{caseNo:'T',jibun:'서울특별시 성동구 성수동1가 1',kind:'다세대주택',units:[{id:1,floor:'2',ho:'201',area:'50',mainUseJeonyu:'다세대주택'},{id:2,floor:'1',ho:'101',area:'40',mainUseJeonyu:'제2종근린생활시설'}],floor:'2',ho:'201',area:'50',baseDate:'2026.09.17',writeDate:'2026.09.17',client:'테스트'},cases:[c('c1','1','성수빌라 201호','연립/다세대',true),c('c2','2','성수상가 101호','근린생활시설',true),c('c3','3','LAPUTA 174 101호 (근생)','',false)],precs:[],propType:'주거용'}));
      },{mode});
      await page.goto(base+'/s3r86w8a.html?last=1');
      const scope=page.locator(mode==='single'?'#root':'#root-multi');
      await scope.locator('.js-tab').nth(1).click();await scope.locator('.s3-card').waitFor();
      const card=scope.locator('.s3-card').first();
      assert.ok(await card.locator('th',{hasText:/^용도/}).count()>=1,mode+': 용도 열');
      const use=n=>card.getByLabel(`거래사례 #${n} 용도`);
      assert.equal(await use(1).inputValue(),'연립/다세대');assert.equal(await use(2).inputValue(),'근린생활시설');
      // 직접 입력
      await use(3).fill('사무소');assert.equal(await use(3).inputValue(),'사무소');
      const opts=await page.evaluate(id=>[...document.getElementById(id).options].map(o=>o.value),mode==='single'?'case-use-opts':'case-use-optsM');
      assert.deepEqual(opts,['아파트','연립/다세대','오피스텔','근린생활시설']);
      // 🧮 — 근생 사례는 자본수익률, 다세대 사례는 매매가격지수
      const openCalc=async n=>{await card.getByLabel(`거래사례 #${n} 시점수정 창`).click();return page.locator('div',{hasText:/^시점수정치 — 사례/}).last();};
      let h=await openCalc(2);let txt=await page.locator('text=입력 ·').first().innerText();
      assert.ok(/자본수익률/.test(txt),mode+' 근생 → 자본수익률: '+txt);
      assert.ok(await page.getByText('용도 근린생활시설 → 자본수익률').count()>=1);
      {const tl=await page.evaluate(()=>{const s=[...document.querySelectorAll('select')].find(x=>[...x.options].some(o=>/집합\s*상가/.test(o.value)));return s?s.value:null;});if(tl!==null)assert.ok(/집합\s*상가/.test(tl),'근생 → 집합상가 기본: '+tl);}
      await page.mouse.click(2190,990);
      await page.waitForTimeout(200);
      // 용도 칸 빈 사례라도 건물명 「(근생)」이면 자본수익률, 창 버튼으로 방식 바꾸면 용도 칸도 바뀜
      await use(3).fill('');
      h=await openCalc(3);txt=await page.locator('text=입력 ·').first().innerText();
      assert.ok(/자본수익률/.test(txt),mode+' 건물명 근생 → 자본수익률: '+txt);
      await page.getByLabel('시점수정 방식 매매가격지수').click();
      txt=await page.locator('text=입력 ·').first().innerText();assert.ok(/매매가격지수/.test(txt),mode+' 버튼 → 매매가격지수');
      await page.getByLabel('시점수정 방식 자본수익률').click();
      txt=await page.locator('text=입력 ·').first().innerText();assert.ok(/자본수익률/.test(txt),mode+' 버튼 → 자본수익률');
      await page.mouse.click(2190,990);await page.waitForTimeout(200);
      assert.equal(await use(3).inputValue(),'근린생활시설','버튼 누르면 용도 칸도');
      h=await openCalc(1);txt=await page.locator('text=입력 ·').first().innerText();
      assert.ok(/매매가격지수/.test(txt),mode+' 다세대 → 매매가격지수: '+txt);
      await page.mouse.click(2190,990);await page.waitForTimeout(200);
      if(mode==='multi'){
        // 호수 주용도별 기본 사례
        const pick=await page.evaluate(()=>{const cs=[{id:'a',symbol:'1',isSelected:true,useKind:'다세대',timeAdj:1.01},{id:'b',symbol:'2',isSelected:true,useKind:'근린생활시설',timeAdj:1.02},{id:'c',symbol:'3',isSelected:true}];
          const R=ArapMultiHwpx.resolveCase;return[R({mainUseJeonyu:'다세대주택'},cs).id,R({mainUseJeonyu:'제2종근린생활시설'},cs).id,R({},cs).id,R({mainUseJeonyu:'근린생활시설',appliedCaseId:'a'},cs).id];});
        assert.deepEqual(pick,['a','b','a','a']);
        // 호수 101(근생)에 다세대 사례를 직접 고르면 ⚠
        await scope.getByText('호수별 적용',{exact:false}).count();
        const warn0=await scope.locator('span[title*="같은 갈래 사례를 고르세요"]').count();
        assert.equal(warn0,0,'기본 배정은 갈래 일치');
        await scope.getByLabel('적용 사례 나').selectOption('c1');
        assert.equal(await scope.locator('span[title*="같은 갈래 사례를 고르세요"]').count(),1,'갈래 다르면 ⚠');
        // 근생 사례 창 → 유형 기본 집합상가(자료에 있을 때)
        // 적용단가 표 묶음 행 파스텔 바탕 + 마우스 올린 행 노란 강조
        await page.evaluate(()=>0);
        const rows=scope.locator('tr.u-row');assert.equal(await rows.count(),2);
        await scope.getByLabel('묶음 가').selectOption('A');
        assert.equal(await rows.nth(0).evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(254, 242, 242)','묶음 A 바탕');
        await rows.nth(1).hover();
        assert.equal(await rows.nth(1).locator('td').nth(2).evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(254, 240, 138)','호버 강조');
      }
      // 건 전체 주거용/비주거용은 그대로
      assert.equal(errors.length,0,errors.join('\n'));
      await ctx.close();
      console.log(mode,'ok');
    }
  }finally{await browser.close();server.close();}
  console.log('jiphap_case_use: 통과');
})().catch(e=>{console.error(e);process.exit(1);});
