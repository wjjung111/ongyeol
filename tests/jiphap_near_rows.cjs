// 집건 여러 호수 인근가격수준 — 행을 계속 추가하고 ▲▼로 순서 바꾸기(2026-11-16)
//  저장은 예전 칸 그대로: 1행 nearKind…(의견서·워드), 2행 nearKind2…·nearRow2, 3행부터 nearMore[]
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true});
  try{
    const ctx=await browser.newContext({viewport:{width:2000,height:1000}}),page=await ctx.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(60000);
    await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
    await page.addInitScript(()=>{localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-jiphap-mode','multi');sessionStorage.setItem('arap-jiphap-mode','multi');
      localStorage.setItem('v2:appraisal-case-list',JSON.stringify([{id:'T',label:'t'}]));
      localStorage.setItem('v2:case:T',JSON.stringify({ov:{caseNo:'T',jibun:'서울특별시 강동구 성내동 420-5',units:[{id:1,floor:'1',ho:'101',area:'40',mainUseJeonyu:'제2종근린생활시설'}],mainUseJeonyu:'제2종근린생활시설',nearKind:'근린생활시설 1층',nearAreaBase:'층',nearPriceLow:'6000000',nearPriceHigh:'11000000',nearRow2:true,nearKind2:'연립다세대주택',nearAreaBase2:'전유면적',nearPriceLow2:'4000000',nearPriceHigh2:'7000000',baseDate:'2026.09.17',writeDate:'2026.09.17'},cases:[],precs:[],propType:'주거용'}));});
    await page.goto(base+'/s3r86w8a.html?last=1');
    const sc=page.locator('#root-multi');await sc.locator('.js-tab').nth(1).click();
    const kind=i=>sc.getByLabel(`인근가격 ${i}행 유사 물건`),low=i=>sc.getByLabel(`인근가격 ${i}행 최저`);
    await kind(2).waitFor();
    assert.equal(await kind(1).inputValue(),'근린생활시설 1층');assert.equal(await kind(2).inputValue(),'연립다세대주택');
    // 3행 추가
    await sc.getByRole('button',{name:'+ 행 추가'}).click();
    await kind(3).fill('근린생활시설 2층');await low(3).fill('5000000');
    assert.equal(await sc.locator('.near-row').count(),3);
    // 3행을 맨 위로
    await sc.getByLabel('인근가격 3행 위로').click();await sc.getByLabel('인근가격 2행 위로').click();
    assert.deepEqual([await kind(1).inputValue(),await kind(2).inputValue(),await kind(3).inputValue()],['근린생활시설 2층','근린생활시설 1층','연립다세대주택']);
    assert.equal(await low(1).inputValue(),'5,000,000');
    assert.equal(await sc.getByLabel('인근가격 1행 기준').inputValue(),'전유면적');assert.equal(await sc.getByLabel('인근가격 2행 기준').inputValue(),'층');
    const sum=await sc.locator('text=→ 인근 유사').first().innerText();
    assert.ok(sum.indexOf('근린생활시설 2층')<sum.indexOf('근린생활시설 1층')&&sum.indexOf('근린생활시설 1층')<sum.indexOf('연립다세대주택'),sum);
    // 가운데 행 삭제 → 2행
    await sc.getByLabel('인근가격 2행 삭제').click();
    assert.equal(await sc.locator('.near-row').count(),2);
    assert.deepEqual([await kind(1).inputValue(),await kind(2).inputValue()],['근린생활시설 2층','연립다세대주택']);
    // 저장 칸 확인(💾 저장 없이도 저장된 건은 계속 저장)
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('v2:case:T')).ov.nearKind==='근린생활시설 2층',null,{timeout:15000}).catch(()=>{});
    const ov=await page.evaluate(()=>JSON.parse(localStorage.getItem('v2:case:T')).ov);
    assert.equal(ov.nearKind,'근린생활시설 2층');assert.equal(ov.nearRow2,true);assert.equal(ov.nearKind2,'연립다세대주택');assert.deepEqual(ov.nearMore,[]);
    // 행 하나만 남기면 ▲▼·✕ 없음
    await sc.getByLabel('인근가격 2행 삭제').click();
    assert.equal(await sc.locator('.near-row').count(),1);assert.equal(await sc.getByLabel('인근가격 1행 위로').count(),0);
    assert.deepEqual(errors,[]);
    console.log('PASS jiphap_near_rows');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
