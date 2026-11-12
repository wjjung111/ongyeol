// 등기발급.html — 주소 + Enter → 토지만 / 건물만 / 토지+건물 고르기. 토지+건물은 요청 2건. 호가 있으면 집합건물로 바로.
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/deunggi_kind_pick.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':'text/javascript');fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL});
  try{
    const ctx=await browser.newContext(),page=await ctx.newPage(),errors=[],posted=[];
    page.on('pageerror',e=>errors.push(e.message));
    await ctx.route('**/*',r=>{const u=r.request().url();
      if(u.startsWith(base))return r.continue();
      if(u.startsWith('http://127.0.0.1:8790/')){
        const action=new URL(u).searchParams.get('action');
        if(action==='add'){posted.push(JSON.parse(r.request().postData()));return r.fulfill({json:{ok:true,id:'T-'+posted.length}});}
        if(action==='list')return r.fulfill({json:{ok:true,agent_last_seen:'',agent_state:{},jobs:[]}});
      }
      return r.abort();});
    await page.addInitScript(()=>{try{localStorage.setItem('arap-user-name','wdw');}catch(e){}});
    await page.goto(base+'/등기발급.html',{waitUntil:'domcontentloaded'});
    const hidden=()=>page.$eval('#kindPick',e=>e.hidden);
    assert.equal(await hidden(),true);
    // 주소 없이 Enter → 안내만
    await page.press('#addr','Enter');
    assert.match(await page.textContent('#formStatus'),/주소를 입력/);assert.equal(await hidden(),true);
    // 주소 + Enter → 고르기 표시, 아직 요청 없음
    await page.fill('#addr','대전광역시 유성구 교촌동 332-3');await page.press('#addr','Enter');
    assert.equal(await hidden(),false);assert.equal(posted.length,0);
    assert.match(await page.textContent('#kindAsk'),/교촌동 332-3/);
    assert.deepEqual(await page.$$eval('#kindPick [data-kind]',a=>a.map(b=>b.textContent)),['토지만','건물만','토지+건물 (2건)']);
    // 토지+건물 → 2건 (토지, 건물), 같은 주소
    await page.click('#kindPick [data-kind="토지,건물"]');
    await page.waitForFunction(()=>/요청됨/.test(document.getElementById('formStatus').textContent));
    assert.deepEqual(posted.map(p=>[p.address,p.rtype,p.doc_type,p.ho]),[['대전광역시 유성구 교촌동 332-3','토지','열람',''],['대전광역시 유성구 교촌동 332-3','건물','열람','']]);
    assert.match(await page.textContent('#formStatus'),/토지 T-1 · 건물 T-2/);
    assert.equal(await hidden(),true);assert.equal(await page.inputValue('#addr'),'');
    // 토지만
    await page.fill('#addr','교촌동 332-3');await page.click('#addBtn');await page.click('#kindPick [data-kind="토지"]');
    await page.waitForFunction(()=>/토지 T-3/.test(document.getElementById('formStatus').textContent));
    assert.equal(posted.length,3);assert.equal(posted[2].rtype,'토지');
    // 주소를 고치면 고르기가 닫힘(전 주소로 잘못 요청 방지), 취소도 닫힘
    await page.fill('#addr','상동 1');await page.press('#addr','Enter');assert.equal(await hidden(),false);
    await page.fill('#addr','상동 12');assert.equal(await hidden(),true);
    await page.press('#addr','Enter');await page.click('#kindCancel');assert.equal(await hidden(),true);assert.equal(posted.length,3);
    // 호가 있으면 묻지 않고 집합건물로 바로
    await page.fill('#addr','압구정동 369-1');await page.fill('#dong','11');await page.fill('#ho','902');await page.press('#ho','Enter');
    await page.waitForFunction(()=>/집합건물 T-4/.test(document.getElementById('formStatus').textContent));
    assert.deepEqual([posted[3].rtype,posted[3].dong,posted[3].ho],['집합건물','11','902']);assert.equal(await hidden(),true);
    assert.deepEqual(errors,[]);
    console.log('OK deunggi_kind_pick');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
