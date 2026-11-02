// 집합건물_기준시가.html — 동 구분 없는 다세대(대장 dongNm이 " " 공백)에서 호를 고르면 전유·공용면적이 자동으로 채워지는지
// (2026-11-02 성내동 420-5 101호: 건축물대장.html은 나오는데 이 화면은 「전유·공용면적 자료가 없습니다」였던 문제)
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/condo_blank_dong.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.css')?'text/css':'text/javascript');fs.createReadStream(f).pipe(res);});
const PNU='1174010800104200005';
const hub=arr=>({response:{header:{resultCode:'00'},body:{items:{item:arr},numOfRows:200,pageNo:1,totalCount:arr.length}}});
const TITLE={regstrGbCdNm:'집합',regstrKindCdNm:'표제부',dongNm:' ',bldNm:' ',useAprDay:'20030709',grndFlrCnt:'5',totArea:'592.25',strctCdNm:'철근콘크리트구조',mainPurpsCdNm:'공동주택'};
const EXPOS=['101','201','301'].map(h=>({dongNm:'',hoNm:h,flrNo:h[0],flrGbCdNm:'지상'}));
const PUB=[ // 101호: 전유 58.28 + 공용 11.02 (계단·복도) — 동 칸은 공백/빈칸이 섞여 옴
  {dongNm:' ',hoNm:'101',exposPubuseGbCdNm:'전유',mainAtchGbCdNm:'주건축물',flrGbCdNm:'지상',flrNo:'1',mainPurpsCdNm:'제2종근린생활시설',etcPurps:'수리점',strctCdNm:'철근콘크리트구조',area:'58.28'},
  {dongNm:'',hoNm:'101 ',exposPubuseGbCdNm:'공용',mainAtchGbCdNm:'주건축물',flrGbCdNm:'지상',flrNo:'1',mainPurpsCdNm:'제2종근린생활시설',etcPurps:'계단실',strctCdNm:'철근콘크리트구조',area:'11.02'}];
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL});
  try{
    const ctx=await browser.newContext(),pg=await ctx.newPage(),errors=[],seen=[];
    pg.on('pageerror',e=>errors.push(e.message));
    await ctx.route('**/*',r=>{const u=r.request().url();
      if(u.startsWith(base))return r.continue();
      if(u.includes('/req/search'))return r.fulfill({json:{response:{status:'OK',result:{items:[{id:PNU,title:'성내동 420-5',address:{parcel:'서울특별시 강동구 성내동 420-5'}}]}}}});
      if(u.includes('getLandCharacteristics'))return r.fulfill({json:{landCharacteristicss:{field:[{stdrYear:'2026',stdrMt:'01',pblntfPclnd:'6000000',lndpclAr:'218.3'}]}}});
      if(u.includes('workers.dev/bld')){const sp=new URL(u).searchParams,op=sp.get('op');seen.push(Object.fromEntries(sp));
        if(op==='getBrTitleInfo')return r.fulfill({json:hub([TITLE])});
        if(op==='getBrExposInfo')return r.fulfill({json:hub(EXPOS)});
        if(op==='getBrExposPubuseAreaInfo')return r.fulfill({json:hub(PUB)});
        return r.fulfill({json:hub([])});}
      return r.abort();});
    await pg.goto(base+'/집합건물_기준시가.html',{waitUntil:'domcontentloaded'});
    await pg.fill('#date','2026-11-02');
    await pg.selectOption('#mode','manual');
    await pg.fill('#address','서울특별시 강동구 성내동 420-5');
    await pg.click('#search');
    await pg.waitForFunction(()=>document.querySelectorAll('#ho option').length>1);
    // 동 칸: 공백이 아니라 「동 구분 없음」
    assert.equal(await pg.$eval('#dong',e=>e.selectedOptions[0].textContent),'동 구분 없음');
    assert.deepEqual(await pg.$$eval('#ho option',a=>a.slice(1).map(o=>o.value)),['101','201','301']);
    await pg.selectOption('#ho','101');
    await pg.waitForFunction(()=>/개 부분 불러옴/.test(document.getElementById('status').textContent));
    const areas=await pg.$$eval('#rows [data-k="area"]',a=>a.map(x=>Number(x.value)));
    assert.equal(Math.round(areas.reduce((a,b)=>a+b,0)*100)/100,69.3);
    // 동 없으면 공백 dongNm을 서버에 보내지 않음
    const q=seen.find(x=>x.op==='getBrExposPubuseAreaInfo');assert.equal(q.hoNm,'101');assert.ok(!('dongNm' in q));
    assert.equal(await pg.$eval('#built',e=>e.value),'2003');
    assert.deepEqual(errors,[]);
    console.log('OK condo_blank_dong');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
