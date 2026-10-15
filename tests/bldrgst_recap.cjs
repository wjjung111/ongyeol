// 건축물대장.html 총괄표제부 검증 — 여러 동 대단지: 총괄표제부 카드가 맨 위, 동 숫자순, 동 줄 클릭 → 호 드롭다운 동 바뀜
// 구판 프록시(총괄표제부 대신 층별개요가 옴)면 총괄 정보 대신 안내 문구
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/bldrgst_recap.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':'text/javascript');fs.createReadStream(f).pipe(res);});
const PNU='1168011000100100000';
const hub=arr=>({response:{header:{resultCode:'00'},body:{items:{item:arr},numOfRows:200,pageNo:1,totalCount:arr.length}}});
const T=(d,gb)=>({regstrGbCdNm:'집합',regstrKindCdNm:'표제부',mainAtchGbCdNm:gb||'주건축물',platPlc:'서울특별시 강남구 대치동 10번지',bun:'0010',ji:'0000',bldNm:'테스트아파트',dongNm:d,totArea:'10000',grndFlrCnt:'25',ugrndFlrCnt:'2',hhldCnt:'100',hoCnt:'0',useAprDay:'20000101',mainPurpsCdNm:'공동주택'});
const TITLES=[T('103동'),T('관리동','부속건축물'),T('101동'),T('102동')];
const RECAP={regstrGbCdNm:'집합',regstrKindCdNm:'총괄표제부',platPlc:'서울특별시 강남구 대치동 10번지',bun:'0010',ji:'0000',bldNm:'테스트아파트',platArea:'50000',archArea:'8000',bcRat:'16',totArea:'31234.5',vlRat:'250',mainPurpsCdNm:'공동주택',hhldCnt:'300',fmlyCnt:'0',hoCnt:'0',mainBldCnt:'3',atchBldCnt:'1',atchBldArea:'234.5',totPkngCnt:'450',useAprDay:'20000101',mgmBldrgstPk:'11680-999'};
const FLR=[{dongNm:'101동',flrGbCdNm:'지상',flrNo:'1',flrNoNm:'1층',mainAtchGbCdNm:'주건축물',area:'400'}];
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL});
  try{
    for(const oldProxy of [false,true]){
      const ctx=await browser.newContext(),page=await ctx.newPage(),errors=[],exposDongs=[];
      page.on('pageerror',e=>errors.push(e.message));
      await ctx.route('**/*',r=>{const u=r.request().url();
        if(u.startsWith(base))return r.continue();
        if(u.startsWith('https://api.vworld.kr'))return r.fulfill({json:{response:{status:'OK',result:{items:[{id:PNU,title:'서울특별시 강남구 대치동 10',address:{parcel:'서울특별시 강남구 대치동 10'}}]}}}});
        if(u.includes('workers.dev/bld')){const sp=new URL(u).searchParams,op=sp.get('op');
          if(op==='getBrTitleInfo')return r.fulfill({json:hub(TITLES)});
          if(op==='getBrRecapTitleInfo')return r.fulfill({json:hub(oldProxy?FLR:[RECAP])});
          if(op==='getBrExposInfo'){const d=sp.get('dongNm');exposDongs.push(d);return r.fulfill({json:hub([{dongNm:d,hoNm:'101호',flrNo:'1',flrGbCdNm:'지상'},{dongNm:d,hoNm:'102호',flrNo:'1',flrGbCdNm:'지상'}])});}
          if(op==='getBrJijiguInfo'||op==='getBrAtchJibunInfo')return r.fulfill({json:hub([])});
          return r.fulfill({json:hub(FLR)});}
        return r.abort();});
      await page.addInitScript(()=>{try{localStorage.setItem('arap-user-name','wdw');}catch(e){}});
      await page.goto(base+'/건축물대장.html',{waitUntil:'domcontentloaded'});
      await page.fill('#q','대치동 10');
      await page.click('#btnGo');
      await page.waitForSelector('#recapPanel',{state:'visible'});
      // 총괄표제부 카드가 결과 맨 위(호별 전유면적보다 앞)
      const order=await page.$$eval('#result > .card',cs=>cs.filter(c=>c.style.display!=='none').map(c=>c.id||c.querySelector('h2').textContent.trim().slice(0,4)));
      assert.equal(order[0],'recapPanel');assert.equal(order[1],'hoPanel');
      const info=await page.$eval('#tblRecap',e=>e.innerText);
      if(!oldProxy){
        assert.match(info,/31,234\.5/);assert.match(info,/300세대/);assert.match(info,/3동/);assert.match(info,/450대/);
      }else assert.match(info,/총괄표제부가 없습니다/);
      // 동 숫자순, 부속(관리동) 맨 뒤
      const dongs=await page.$$eval('#tblRecapDong .recap-dong td:nth-child(3)',a=>a.map(x=>x.textContent));
      assert.deepEqual(dongs,['101동','102동','103동','관리동']);
      const sel=await page.$$eval('#hoDongSel option',a=>a.map(o=>o.value));
      assert.deepEqual(sel,['101동','102동','103동','관리동']);
      await page.waitForFunction(()=>document.querySelectorAll('#hoSel option').length>1);
      // 103동 줄 클릭 → 동 드롭다운·동명세 103동, 호 목록 다시 받음
      await page.click('#tblRecapDong .recap-dong:nth-child(4)');
      await page.waitForFunction(()=>document.getElementById('hoDongSel').value==='103동');
      await page.waitForFunction(()=>document.querySelectorAll('#hoSel option').length===3);
      assert.match(await page.$eval('#tblDong',e=>e.innerText),/103동/);
      assert.ok(exposDongs.includes('103동'));
      assert.deepEqual(errors,[]);
      await ctx.close();
    }
    console.log('OK bldrgst_recap');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
