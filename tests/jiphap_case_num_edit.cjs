// 집합건물 ③ 거래사례(카이스) 표 — 전유면적·사례가격·단가·거래시점·사용승인일·시점수정치 직접 수정(2026-11-09), 단일·여러호수 양쪽
//   전유면적·사례가격 고치면 단가 = 사례가격 ÷ 전유면적(원 미만 절사) 다시 채움 · 고친 칸 파란 굵게 + ↺ · 시점수정치는 창 계산값 → 칸에서 키인 → ↺ 계산값
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/jiphap_case_num_edit.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':'text/javascript');fs.createReadStream(f).pipe(res);});
const DETAIL='아파트\n지역 : 서울 송파구\n거래 2025.12 / 기준 2026.10\n105.2 / 100.4 ≒ 1.04781';
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  try{
    for(const mode of ['single','multi']){
      const ctx=await browser.newContext({viewport:{width:1600,height:900}}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());page.setDefaultTimeout(20000);
      await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});return u.startsWith(base)?r.continue():r.abort();});
      await page.addInitScript(({m,DETAIL})=>{localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-jiphap-mode',m);
        const prefix=m==='multi'?'v2:':'';if(localStorage.getItem(prefix+'case:TEST-NE'))return;
        const c=(id,sym,o)=>({id,symbol:sym,location:'신천동',jibun:'17',aptName:'파크리오',dong:'316',floor:'13',ho:'1303',exclusiveArea:59.86,price:2185000000,unitPrice:36501837,unitPriceOrig:36501837,tradeDate:'2025.12.27',approvalDate:'2008-08-29',timeAdj:null,timeAdjDetail:'',isShown:true,isSelected:false,...o});
        const ov={caseNo:'TEST-NE',jibun:'서울특별시 송파구 신천동 17',area:'59.86',baseDate:'2026.10.26',writeDate:'2026.10.26'};if(m==='multi')ov.units=[{id:1,dong:'301',floor:'5',ho:'501',area:'59.86'}];
        localStorage.setItem(prefix+'appraisal-case-list',JSON.stringify([{id:'TEST-NE',label:'숫자 수정 검증'}]));
        localStorage.setItem(prefix+'case:TEST-NE',JSON.stringify({ov,cases:[c('c1','1',{}),c('c2','2',{timeAdj:1.04781,timeAdjDetail:DETAIL,isSelected:true})],precs:[],propType:'주거용'}));},{m:mode,DETAIL});
      await page.goto(base+'/s3r86w8a.html?last=1');
      const scope=page.locator(mode==='multi'?'#root-multi':'#root');
      await scope.getByText('2. 사례 · 가격산출',{exact:true}).click({timeout:60000});
      const box=(n,f)=>scope.getByLabel(`거래사례 #${n} ${f}`,{exact:true});
      const set=async(n,f,v)=>{await box(n,f).fill(v);await box(n,f).blur();};
      const blueBold=async loc=>loc.evaluate(e=>{const s=getComputedStyle(e);return s.fontWeight==='700'&&s.color==='rgb(37, 99, 235)';});
      // 처음 모양 — 칸마다 값, 고친 칸 없음
      assert.equal(await box(1,'전유면적').inputValue(),'59.86');
      assert.equal(await box(1,'사례가격').inputValue(),'2,185,000,000');
      assert.equal(await box(1,'거래시점').inputValue(),'2025.12.27');
      assert.equal(await box(1,'사용승인일').inputValue(),'2008-08-29');
      assert.equal(await box(1,'시점수정치').inputValue(),'','시점수정치 없음 → 빈칸');
      assert.equal(await box(2,'시점수정치').inputValue(),'1.04781','창 계산값이 칸에');
      assert.equal(await blueBold(box(2,'시점수정치')),false);
      assert.equal(await scope.locator('text=고친 칸 전체 원래값으로').count(),0);
      // 전유면적 → 단가 다시 계산(절사)
      await set(1,'전유면적','60');
      assert.equal(await box(1,'전유면적').inputValue(),'60.00');
      assert.equal(await box(1,'단가').inputValue(),Math.floor(2185000000/60).toLocaleString('en-US'),'단가 = 가격 ÷ 면적');
      assert.ok(await blueBold(box(1,'전유면적')),'고친 면적 파란 굵게');
      // 사례가격 → 단가 다시 계산
      await set(1,'사례가격','2400000000');
      assert.equal(await box(1,'단가').inputValue(),'40,000,000');
      // 단가는 그 뒤에도 직접
      await set(1,'단가','39990000');assert.equal(await box(1,'단가').inputValue(),'39,990,000');
      // 거래시점·사용승인일 8자리 → 날짜
      await set(1,'거래시점','20260115');assert.equal(await box(1,'거래시점').inputValue(),'2026.01.15');
      await set(1,'사용승인일','20080830');assert.equal(await box(1,'사용승인일').inputValue(),'2008.08.30');
      // 시점수정치 직접 키인(근거 없는 사례) → 시점수정 단가 반영, 파란색 아님(계산값이 없으니 고친 값 아님)
      await set(1,'시점수정치','1.02');
      assert.equal(await box(1,'시점수정치').inputValue(),'1.02000');
      assert.equal(await scope.getByLabel('거래사례 #1 시점수정 단가').innerText(),Math.round(39990000*1.02).toLocaleString('en-US'));
      // 계산값 있는 사례를 고치면 파란 굵게 + ↺(계산값으로)
      await set(2,'시점수정치','1.05');
      assert.ok(await blueBold(box(2,'시점수정치')));
      const allBtn=scope.locator('button:has-text("고친 칸 전체 원래값으로")');
      assert.equal(await allBtn.innerText(),'↺ 고친 칸 전체 원래값으로 (6칸)','면적·가격·단가·거래시점·승인일·시점수정치');
      await scope.locator('span[title="시점수정 창 계산값(1.04781)으로 되돌리기"]').click();
      assert.equal(await box(2,'시점수정치').inputValue(),'1.04781','↺ → 계산값');
      // 면적 행 ↺
      await scope.locator('span[title="복붙 원래값(59.86)으로 되돌리기"]').click();
      assert.equal(await box(1,'전유면적').inputValue(),'59.86');
      // 전체 ↺
      await set(2,'시점수정치','1.1');
      await allBtn.click();
      assert.equal(await box(1,'사례가격').inputValue(),'2,185,000,000');
      assert.equal(await box(1,'단가').inputValue(),'36,501,837');
      assert.equal(await box(1,'거래시점').inputValue(),'2025.12.27');
      assert.equal(await box(1,'사용승인일').inputValue(),'2008-08-29');
      assert.equal(await box(2,'시점수정치').inputValue(),'1.04781');
      assert.equal(await box(1,'시점수정치').inputValue(),'1.02000','키인만 한 값은 그대로(원래값 없음)');
      assert.equal(await scope.locator('text=고친 칸 전체 원래값으로').count(),0);
      // 🧮 → 시점수정 창이 열림
      await scope.getByLabel('거래사례 #2 시점수정 창',{exact:true}).click();
      await page.getByText('시점수정치 계산').first().waitFor();
      assert.deepEqual(errors,[]);
      console.log(mode,'OK');
      await ctx.close();
    }
    // 의견서 산식 끝 값 = 적용 시점수정치(직접 고친 값) — 엔진 함수 소스를 떼어 Node에서 직접
    {
      const html=fs.readFileSync(path.join(root,'s3r86w8a.html'),'utf8');
      const grab=name=>{const i=html.indexOf('const '+name+'=');assert.ok(i>=0,name);const j=html.indexOf('\n};',i);const k=html.indexOf('\n',i);return html.slice(i,html.slice(i,k).trim().endsWith(';')?k:j+3);};
      const f=new Function(['fmtDec','pStr','fmtDate','parseTimeAdjDetail'].map(grab).join('\n')+'\nreturn parseTimeAdjDetail;')();
      const r=[undefined,1.04781,1.05].map(a=>f(DETAIL,'2025.12.27','2026.10.26',a).시점수정산식);
      assert.match(r[0],/= 1\.04781$/);assert.equal(r[1],r[0],'같은 값이면 그대로');assert.match(r[2],/= 1\.05000$/,'고친 값으로');
      console.log('산식 OK',r[2]);
    }
    console.log('PASS');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
