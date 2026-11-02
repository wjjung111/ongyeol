// 기준시가.html 건물 탭 — 여러 동 건물(김포 통진읍 옹정리 336 공장 가·나·다동) + 층별개요가 아직 없는 신축
// ① 동 드롭다운이 뜨고 동마다 표제부·층별개요로 따로 계산 ② 층별개요가 없으면 표제부 연면적으로 1행 + 노란(경고) 안내, ✅ 아님
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/gjs_bld_multidong.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.css')?'text/css':'text/javascript');fs.createReadStream(f).pipe(res);});
const hub=arr=>({response:{header:{resultCode:'00'},body:{items:{item:arr},numOfRows:200,pageNo:1,totalCount:arr.length}}});
const T=(d,area,roof,fl)=>({regstrGbCdNm:'일반',regstrKindCdNm:'일반건축물',mainAtchGbCdNm:'주건축물',dongNm:d,bldNm:'',totArea:String(area),platArea:'11423',grndFlrCnt:String(fl),strctCdNm:'일반철골구조',roofCdNm:'기타지붕',etcRoof:roof,mainPurpsCdNm:'공장',etcPurps:'',useAprDay:'20260903'});
const TITLES=[T('다동',621.14,'준불연판넬지붕',2),T('가동',800,'불연판넬지붕',1),T('나동',740,'불연판넬지붕',1)];
const F=(d,no,area)=>({dongNm:d,flrGbCd:'20',flrGbCdNm:'지상',flrNo:String(no),flrNoNm:no+'층',mainPurpsCdNm:'공장',etcPurps:'',area:String(area),mainAtchGbCdNm:'주건축물',strctCdNm:'일반철골구조'});
let FLOORS=[];
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL});
  try{
    const ctx=await browser.newContext(),pg=await ctx.newPage(),errors=[];
    pg.on('pageerror',e=>errors.push(e.message));
    await ctx.route('**/*',r=>{const u=r.request().url();
      if(u.startsWith(base))return r.continue();
      if(u.includes('/req/search'))return r.fulfill({json:{response:{status:'OK',result:{items:[{id:'4157025624103360000',title:'옹정리 336',address:{parcel:'경기도 김포시 통진읍 옹정리 336'}}]}}}});
      if(u.includes('getLandCharacteristics'))return r.fulfill({json:{landCharacteristicss:{field:[{stdrYear:'2026',pblntfPclnd:'300000',lndpclAr:'11423'}]}}});
      if(u.includes('getIndvdHousingPriceAttr'))return r.fulfill({json:{indvdHousingPrices:{field:[]}}});
      if(u.includes('workers.dev/bld')){const op=new URL(u).searchParams.get('op');
        if(op==='getBrTitleInfo')return r.fulfill({json:hub(TITLES)});
        if(op==='getBrFlrOulnInfo')return r.fulfill({json:hub(FLOORS)});
        return r.fulfill({json:hub([])});}
      return r.abort();});
    await pg.addInitScript(()=>{try{localStorage.setItem('arap-user-name','wdw');}catch(e){}});
    await pg.goto(base+'/기준시가.html',{waitUntil:'domcontentloaded'});
    // ── 1) 신축: 층별개요 없음 ──
    await pg.fill('#qDate','2026-11-02');
    await pg.fill('#qAddr','김포시 통진읍 옹정리 336');
    await pg.click('#qGo');
    await pg.waitForSelector('#qDongRow',{state:'visible'});
    // 동 순서: 가·나·다(이름순), 첫 동 자동
    assert.deepEqual(await pg.$$eval('#qDong option',a=>a.map(o=>o.textContent.split(' · ')[0])),['가동','나동','다동']);
    const st1=await pg.textContent('#qStatus');
    assert.match(st1,/층별개요가 공공 API에 아직 없습니다/);assert.doesNotMatch(st1,/✅/);
    assert.equal(await pg.$eval('#qStatus',e=>e.className),'status err');
    let R=await pg.evaluate(()=>rows.map(r=>({area:+r.area,label:r.label})));
    assert.equal(R.length,1);assert.equal(R[0].area,800);assert.match(R[0].label,/가동 전체 공장/);
    assert.equal(await pg.$eval('#builtYear',e=>e.value),'2026');
    // 기타지붕 + 불연판넬지붕 → 판넬 0.8, 전체 한 줄엔 상가 1층 조정 없음
    assert.equal(await pg.$eval('#roof',e=>e.value),'0.8');
    assert.equal(await pg.evaluate(()=>rows[0].ftype),'none');
    assert.match(await pg.$eval('#siteName',e=>e.value),/가동$/);
    // 📄 건축물대장 보기 → 아래로 펼침, 고른 동 표제부·동 목록·층별개요 없음 안내
    assert.equal(await pg.isVisible('#toggleBld'),true);
    assert.equal(await pg.$eval('#qBldWrap',e=>e.classList.contains('open')),false);
    await pg.click('#toggleBld');
    assert.equal(await pg.$eval('#qBldWrap',e=>e.classList.contains('open')),true);
    assert.match(await pg.textContent('#toggleBld'),/접기/);
    let bt=await pg.textContent('#qBld');
    assert.match(bt,/건축물대장 · 가동/);assert.match(bt,/2026-09-03/);assert.match(bt,/기타지붕 \(불연판넬지붕\)/);assert.match(bt,/층별개요가 공공 API에 없습니다/);
    assert.equal(await pg.$$eval('#qBld > .tw:first-of-type tbody tr',a=>a.length),3);   // 동 목록 3동
    // 다동으로 바꾸면 621.14㎡·지상 2층
    await pg.selectOption('#qDong','2');
    R=await pg.evaluate(()=>rows.map(r=>+r.area));
    assert.deepEqual(R,[621.14]);
    assert.equal(await pg.$eval('#topFloor',e=>e.value),'2');
    assert.match(await pg.textContent('#qStatus'),/다동/);
    assert.match(await pg.textContent('#qBld'),/건축물대장 · 다동/);   // 펼친 대장도 그 동으로
    // ── 2) 층별개요가 있으면 고른 동 것만 ──
    FLOORS=[F('가동',1,800),F('나동',1,740),F('다동',1,400),F('다동',2,221.14)];
    await pg.click('#qGo');
    await pg.waitForFunction(()=>/✅/.test(document.getElementById('qStatus').textContent));
    R=await pg.evaluate(()=>rows.map(r=>+r.area));
    assert.deepEqual(R,[800]);
    await pg.selectOption('#qDong','2');
    R=await pg.evaluate(()=>rows.map(r=>+r.area));
    assert.deepEqual(R,[400,221.14]);
    assert.match(await pg.textContent('#qStatus'),/✅ 불러옴: .*다동 · 층 2개/);
    // 층별현황: 위층부터, 합계
    assert.deepEqual(await pg.$$eval('#qBld > .tw:last-of-type tbody tr td:first-child',a=>a.map(x=>x.textContent)),['2층','1층','합계']);
    assert.match(await pg.$eval('#qBld > .tw:last-of-type tbody tr:last-child',e=>e.textContent),/621\.14/);
    // ── 3) 한 동짜리면 드롭다운 없음 ──
    TITLES.splice(1);FLOORS=[F('다동',1,400),F('다동',2,221.14)];
    await pg.click('#qGo');
    await pg.waitForFunction(()=>document.getElementById('qDongRow').hidden&&/✅/.test(document.getElementById('qStatus').textContent));
    assert.deepEqual(await pg.evaluate(()=>rows.map(r=>+r.area)),[400,221.14]);
    assert.deepEqual(errors,[]);
    console.log('OK gjs_bld_multidong');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
