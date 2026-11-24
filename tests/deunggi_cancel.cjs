// 등기발급.html — 요청 목록 「중단」 버튼: 대기·처리중에만 보이고, 누르면 action=cancel&id 전송 → 중단됨 표시.
// 처리중은 확인창(취소하면 안 보냄). 옛 에이전트(cancel 모름)면 업데이트 안내.
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/deunggi_cancel.cjs [스크린샷경로]
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
    const ctx=await browser.newContext({viewport:{width:1300,height:900}}),page=await ctx.newPage(),errors=[],cancels=[];
    let oldAgent=false;
    const jobs=[
      {id:'A',address:'서울특별시 금천구 독산동 1023-9',rtype:'토지',record_type:'전부(말소사항 포함)',created:'2026-11-24 20:22:52',status:'대기'},
      {id:'B',address:'수성구 만촌동 984-1 가동',ho:'31',rtype:'집합건물',record_type:'전부(말소사항 포함)',created:'2026-11-24 16:47:19',status:'처리중'},
      {id:'C',address:'수성구 만촌동 984-1 가동',ho:'30',rtype:'집합건물',record_type:'전부(말소사항 포함)',created:'2026-11-24 16:47:12',status:'실패',error:'TargetClosedError'},
      {id:'D',address:'당산동5가 42',dong:'405',ho:'801',rtype:'집합건물',created:'2026-11-23 23:34:26',status:'완료',fields:{'고유번호':'2541-2004-002860'}},
    ];
    page.on('pageerror',e=>errors.push(e.message));
    await ctx.route('**/*',r=>{const u=r.request().url();
      if(u.startsWith(base))return r.continue();
      if(u.startsWith('http://127.0.0.1:8790/')){
        const q=new URL(u).searchParams,action=q.get('action');
        if(action==='list')return r.fulfill({json:{ok:true,agent_last_seen:'',agent_state:{},jobs}});
        if(action==='history')return r.fulfill({json:{ok:true,items:[]}});
        if(action==='cancel'){
          if(oldAgent)return r.fulfill({json:{ok:false,error:'unknown action'}});
          cancels.push(q.get('id'));const j=jobs.find(x=>x.id===q.get('id'));j.status='취소';return r.fulfill({json:{ok:true}});}
      }
      return r.abort();});
    await page.addInitScript(()=>{try{localStorage.setItem('arap-user-name','wdw');}catch(e){}});
    await page.goto(base+'/등기발급.html',{waitUntil:'domcontentloaded'});
    await page.waitForSelector('.job');
    // 대기·처리중에만 버튼
    assert.deepEqual(await page.$$eval('.job',a=>a.map(e=>!!e.querySelector('[data-stop]'))),[true,true,false,false]);
    if(process.argv[2])await page.locator('#jobList').screenshot({path:process.argv[2]});
    // 옛 에이전트 → 업데이트 안내, 상태 그대로
    oldAgent=true;
    await page.click('.job:nth-child(1) [data-stop]');
    await page.waitForFunction(()=>/중단 실패/.test(document.getElementById('formStatus').textContent));
    assert.match(await page.textContent('#formStatus'),/에이전트 업데이트 필요/);
    oldAgent=false;
    // 대기 → 확인창 없이 바로 중단
    await page.click('.job:nth-child(1) [data-stop]');
    await page.waitForFunction(()=>/중단됨/.test(document.querySelector('.job').textContent));
    assert.deepEqual(cancels,['A']);
    assert.equal(await page.$eval('.job',e=>e.classList.contains('cancelled')&&!e.querySelector('[data-stop]')),true);
    // 처리중 → 확인창에서 아니오면 안 보냄, 예면 보냄
    page.once('dialog',d=>d.dismiss());
    await page.click('.job:nth-child(2) [data-stop]');
    await page.waitForTimeout(200);assert.deepEqual(cancels,['A']);
    page.once('dialog',d=>{assert.match(d.message(),/처리 중/);d.accept();});
    await page.click('.job:nth-child(2) [data-stop]');
    await page.waitForFunction(()=>/중단됨/.test(document.querySelectorAll('.job')[1].textContent));
    assert.deepEqual(cancels,['A','B']);
    assert.deepEqual(errors,[]);
    console.log('OK deunggi_cancel');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
