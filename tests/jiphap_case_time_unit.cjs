// 집건 ③ 거래사례 표 「시점수정 단가」 열(화면 전용) — 단가 × 시점수정치, 원 단위 반올림. 시점수정치가 없으면 「-」. 단일·여러 호수 둘 다
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/jiphap_case_time_unit.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':'text/javascript');fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true});
  try{
    for(const mode of ['single','multi']){
      const ctx=await browser.newContext({viewport:{width:1500,height:900}}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
      await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});return u.startsWith(base)?r.continue():r.abort();});
      await page.addInitScript(m=>{localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-jiphap-mode',m);
        const c=(id,sym,unit,ta)=>({id,symbol:sym,location:'서울특별시 송파구 잠실동',jibun:'86',aptName:'아시아선수촌아파트',dong:'13',floor:'7',ho:'705',exclusiveArea:134.49,price:4045000000,unitPrice:unit,tradeDate:'2024.09.30',approvalDate:'1986.06.14',timeAdj:ta,timeAdjDetail:'',isShown:true,isSelected:false});
        const prefix=m==='multi'?'v2:':'';if(localStorage.getItem(prefix+'case:TEST-TU'))return;
        const ov={caseNo:'TEST-TU',jibun:'서울특별시 송파구 잠실동 86',area:'134.485',baseDate:'2026.10.26',writeDate:'2026.10.26'};if(m==='multi')ov.units=[{id:1,dong:'10',floor:'10',ho:'1003',area:'134.485'}];
        localStorage.setItem(prefix+'appraisal-case-list',JSON.stringify([{id:'TEST-TU',label:'시점수정 단가 검증'}]));
        localStorage.setItem(prefix+'case:TEST-TU',JSON.stringify({ov,cases:[c('c1','1',30077703,1.28182),c('c2','2',28479012,null)],precs:[],propType:'주거용'}));},mode);
      await page.goto(base+'/s3r86w8a.html?last=1');
      const scope=page.locator(mode==='multi'?'#root-multi':'#root');
      await scope.getByText('3. 사례 등 입력',{exact:true}).click({timeout:60000});
      const cell=scope.getByLabel('거래사례 #1 시점수정 단가');
      assert.equal(await cell.innerText(),(Math.round(30077703*1.28182)).toLocaleString('en-US'),'단가 × 시점수정치');
      assert.equal(await scope.getByLabel('거래사례 #2 시점수정 단가').innerText(),'-','시점수정치 없으면 -');
      assert.deepEqual(errors,[]);await ctx.close();console.log(mode,'OK');
    }
    console.log('PASS');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
