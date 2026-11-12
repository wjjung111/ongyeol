// 집합건물 ④ 적용단가 표 — 본건 면적 + 선정사례 기호·지번·건물명·호·면적 표시 (2026-11-10, 단일·여러호수)
//  ① 단일: 본건 기호·호·면적(사정면적이면 사정면적) / 사례 #기호·법정동 지번·건물명·동호·전유면적
//  ② 여러호수: 본건 호 옆 면적 칸, 사례 고르는 칸은 「#2」만 보이고 펼치면 지번·건물명·호·면적, 오른쪽 칸들이 고른 사례로 바뀜
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/jiphap_apply_case_info.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true});
  try{
    for(const mode of ['single','multi']){
      const ctx=await browser.newContext({viewport:{width:2560,height:1000}}),page=await ctx.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(60000);
      await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});return u.startsWith(base)?r.continue():r.abort();});
      await page.addInitScript(({mode})=>{if(sessionStorage.getItem('seeded'))return;sessionStorage.setItem('seeded','1');
        localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-jiphap-mode',mode);const pre=mode==='multi'?'v2:':'';
        const c=(id,sym,dong,ho,area,price)=>({id,symbol:sym,location:'대구광역시 중구 동성로2가',jibun:'96-15',aptName:sym==='1'?'동성로 하우스디어반':'대구메디스퀘어',dong,floor:ho.slice(0,-2),ho,exclusiveArea:area,price,unitPrice:Math.round(price/area),tradeDate:'2026.08.21',approvalDate:'2020.08.05',timeAdj:1.02,timeAdjDetail:'x ≒ 1.02000',isShown:true,isSelected:true});
        localStorage.setItem(pre+'appraisal-case-list',JSON.stringify([{id:'T',label:'t'}]));
        localStorage.setItem(pre+'case:T',JSON.stringify({ov:{caseNo:'T',jibun:'대구광역시 중구 덕산동 96-15',
          units:[{id:1,dong:'',floor:'2',ho:'201',area:'110.3',appliedCaseId:'c1'},{id:2,dong:'',floor:'7',ho:'701',area:'377.04',appliedCaseId:'c2'}],
          dong:'',floor:'2',ho:'201',area:'110.3',baseDate:'2026.11.03',writeDate:'2026.11.03',client:'테스트'},
          cases:[c('c1','1','','206',84.9712,1300000000),c('c2','2','3','702',45.5,350000000)],precs:[],propType:'비주거용'}));
      },{mode});
      await page.goto(base+'/s3r86w8a.html?last=1');
      const scope=page.locator(mode==='single'?'#root':'#root-multi');
      await scope.getByText('2. 사례 · 가격산출',{exact:true}).click();
      const tbl=scope.locator('table').filter({has:page.getByRole('columnheader',{name:'건물명',exact:true})}).last();
      await tbl.waitFor();
      const head=await tbl.locator('thead').innerText();
      for(const h of ['본건','선정사례','기호','지번','건물명','호','면적(㎡)'])assert.ok(head.includes(h),`${mode} 머리글 ${h}`);
      const cells=async i=>(await tbl.locator('tbody tr').nth(i).locator('td').allInnerTexts()).map(t=>t.replace(/\s+/g,' ').trim());
      if(mode==='single'){
        const r=await cells(0);   // 기호 호 면적 | #기호 지번 건물명 호 면적 | 사례단가 …
        assert.deepEqual(r.slice(0,8),['가','201호','110.30','#1','동성로2가 96-15','동성로 하우스디어반','206호','84.97'],'단일 1행');
        const r2=await cells(1);
        assert.deepEqual(r2.slice(3,8),['#2','동성로2가 96-15','대구메디스퀘어','3동 702호','45.50'],'단일 2행(동 있는 사례)');
        assert.equal(await tbl.locator('tbody tr').first().locator('td').nth(4).getAttribute('title'),'대구광역시 중구 동성로2가 96-15','지번 칸 마우스 올리면 전체 소재지');
      }else{
        const r=await cells(0);   // 구분 본건 면적 묶음 사례 지번 건물명 호 면적 시점수정치 …
        assert.equal(r[1],'(가)201호');assert.equal(r[2],'110.30','본건 면적');
        assert.match(r[4],/^#1/,'닫힌 사례 칸은 #기호');
        assert.deepEqual(r.slice(5,9),['동성로2가 96-15','동성로 하우스디어반','206호','84.97']);
        const opts=await scope.getByLabel('적용 사례 가',{exact:true}).locator('option').allInnerTexts();
        assert.ok(opts.includes('#2 · 동성로2가 96-15 · 대구메디스퀘어 · 3동 702호 · 45.50㎡'),'펼친 목록에 지번·건물명·호·면적: '+opts.join(' / '));
        const r2=await cells(1);assert.equal(r2[2],'377.04');assert.deepEqual(r2.slice(5,9),['동성로2가 96-15','대구메디스퀘어','3동 702호','45.50']);
        // 사례 바꾸면 오른쪽 칸도 바뀜
        await scope.getByLabel('적용 사례 가',{exact:true}).selectOption('c2');
        await page.waitForFunction(()=>[...document.querySelectorAll('#root-multi table tbody tr')].some(tr=>/^1\b/.test(tr.innerText.trim())&&tr.innerText.includes('대구메디스퀘어')));
        const r3=await cells(0);assert.match(r3[4],/^#2/);assert.deepEqual(r3.slice(5,9),['동성로2가 96-15','대구메디스퀘어','3동 702호','45.50']);
      }
      await tbl.screenshot({path:path.join(process.env.SHOT_DIR||require('os').tmpdir(),`jiphap_apply_case_info_${mode}.png`)});
      assert.deepEqual(errors,[]);
      console.log(mode+': PASS 본건 면적 · 사례 기호/지번/건물명/호/면적');
      await ctx.close();
    }
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
