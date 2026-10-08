// 건축물대장.html 관련지번(부속지번, getBrAtchJibunInfo) 표시 검증 — 여의도동 17-6(광복회관) 실제 대장 기준
// 신판 프록시: 지번 '17-6 외 3필지' + 지번 관련 주소 '17-21, 17-22, 17-23' / 구판 프록시(층별개요로 대체 응답): 재배포 안내
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/bldrgst_atch_jibun.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':'text/javascript');fs.createReadStream(f).pipe(res);});
const PNU='1156011000100170006';
const hub=arr=>({response:{header:{resultCode:'00'},body:{items:{item:arr},numOfRows:200,pageNo:1,totalCount:arr.length}}});
const T={regstrGbCdNm:'일반',regstrKindCdNm:'일반건축물',mainAtchGbCdNm:'주건축물',platPlc:'서울특별시 영등포구 여의도동 17-6번지',bun:'0017',ji:'0006',bldNm:'광복회관',totArea:'18431.55'};
const FLR=[{flrGbCdNm:'지하',flrNo:'1',flrNoNm:'지1',mainAtchGbCdNm:'주건축물',strctCdNm:'철골철근콘크리트구조',area:'1738.5'}];
const A=(ji)=>({atchRegstrGbCdNm:'일반',atchSigunguCd:'11560',atchBjdongCd:'11000',atchPlatGbCd:'0',atchBun:'0017',atchJi:ji});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL});
  try{
    for(const oldProxy of [false,true]){
      const ctx=await browser.newContext(),page=await ctx.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await ctx.route('**/*',r=>{const u=r.request().url();
        if(u.startsWith(base))return r.continue();
        if(u.startsWith('https://api.vworld.kr'))return r.fulfill({json:{response:{status:'OK',result:{items:[{id:PNU,title:'서울특별시 영등포구 여의도동 17-6',address:{parcel:'서울특별시 영등포구 여의도동 17-6'}}]}}}});
        if(u.includes('workers.dev/bld')){const op=new URL(u).searchParams.get('op');
          if(op==='getBrTitleInfo')return r.fulfill({json:hub([T])});
          if(op==='getBrAtchJibunInfo')return r.fulfill({json:hub(oldProxy?FLR:[A('0021'),A('0022'),A('0023'),A('0021')])});
          if(op==='getBrJijiguInfo')return r.fulfill({json:hub([])});
          return r.fulfill({json:hub(FLR)});}
        return r.abort();});
      await page.addInitScript(()=>{try{localStorage.setItem('arap-user-name','wdw');}catch(e){}});
      await page.goto(base+'/건축물대장.html',{waitUntil:'domcontentloaded'});
      await page.fill('#q','여의도동 17-6');
      await page.click('#btnGo');
      await page.waitForSelector('#tblInfo tr');
      const info=await page.$eval('#tblInfo',e=>e.innerText);
      if(!oldProxy){
        assert.match(info,/17-6 외 3필지/);
        assert.match(info,/지번 관련 주소\s+17-21, 17-22, 17-23/);
      }else{
        assert.match(info,/지번\s+17-6\s/);
        assert.match(info,/프록시가 구버전/);
      }
      assert.deepEqual(errors,[]);
      await ctx.close();
    }
    console.log('OK bldrgst_atch_jibun');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
