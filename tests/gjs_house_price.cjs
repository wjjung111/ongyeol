// 기준시가.html 건물 탭 — 단독·다가구 개별주택가격을 결과표 맨 위에 바로 보여 줌 (평창동 477-10 다가구 사례)
// ① 평가기준일 현재 공시된 연도 가격(공시일 4.30 전이면 직전 연도) ② 같은 연도 중복은 가장 늦게 고쳐진 것 ③ 날짜를 바꾸면 따라 바뀜
// ④ 미래 연도는 최신 연도 + 경고 ⑤ 📋 표 복사 끝줄 ⑥ 공시가격 없는 주택은 안내만 ⑦ 새 지번 조회 때 앞 지번 주택가격이 안 남음
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/gjs_house_price.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.css')?'text/css':'text/javascript');fs.createReadStream(f).pipe(res);});
const hub=arr=>({response:{header:{resultCode:'00'},body:{items:{item:arr},numOfRows:200,pageNo:1,totalCount:arr.length}}});
const PNU_H='1111018300104770010', PNU_NONE='1111018300104770011';
const TITLE=[{regstrGbCdNm:'일반',regstrKindCdNm:'일반건축물',mainAtchGbCdNm:'주건축물',dongNm:'',bldNm:'',totArea:'410.04',platArea:'648',grndFlrCnt:'2',ugrndFlrCnt:'0',strctCdNm:'철근콘크리트구조',roofCdNm:'(철근)콘크리트',mainPurpsCdNm:'단독주택',etcPurps:'다가구용단독주택',useAprDay:'19980512'}];
const F=(no,area)=>({dongNm:'',flrGbCd:'20',flrGbCdNm:'지상',flrNo:String(no),flrNoNm:no+'층',mainPurpsCdNm:'단독주택',etcPurps:'다가구용단독주택',area:String(area),mainAtchGbCdNm:'주건축물',strctCdNm:'철근콘크리트구조'});
const FLOORS=[F(1,257.04),F(2,153)];
const H=(y,pc,upd)=>({pnu:PNU_H,stdrYear:String(y),stdrMt:'01',housePc:String(pc),calcPlotAr:'648',buldCalcTotAr:'616.59',buldAllTotAr:'616.59',lastUpdtDt:upd});
// 2025·2026년은 실제 응답처럼 같은 연도가 두 줄(고친 날짜만 다름) — 2026년은 늦게 고쳐진 줄이 맞는 값
const HOUSE=[H(2023,2467000000,'2024-01-20'),H(2024,2500000000,'2025-01-15'),H(2025,2563000000,'2025-08-05'),H(2025,2563000000,'2026-03-25'),H(2026,2600000000,'2026-05-21'),H(2026,2626000000,'2026-11-05')];
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL});
  try{
    const ctx=await browser.newContext(),pg=await ctx.newPage(),errors=[];
    pg.on('pageerror',e=>errors.push(e.message));
    await ctx.route('**/*',r=>{const u=r.request().url();
      if(u.startsWith(base))return r.continue();
      if(u.includes('/req/search')){const q=new URL(u).searchParams.get('query');const none=/477-11/.test(q);
        return r.fulfill({json:{response:{status:'OK',result:{items:[{id:none?PNU_NONE:PNU_H,title:q,address:{parcel:'서울특별시 종로구 평창동 '+(none?'477-11':'477-10')}}]}}}});}
      if(u.includes('getLandCharacteristics'))return r.fulfill({json:{landCharacteristicss:{field:[{stdrYear:'2026',pblntfPclnd:'4450000',lndpclAr:'648'}]}}});
      if(u.includes('getIndvdHousingPriceAttr'))return r.fulfill({json:{indvdHousingPrices:{field:new URL(u).searchParams.get('pnu')===PNU_H?HOUSE:[]}}});
      if(u.includes('workers.dev/bld')){const op=new URL(u).searchParams.get('op');
        if(op==='getBrTitleInfo')return r.fulfill({json:hub(TITLE)});
        if(op==='getBrFlrOulnInfo')return r.fulfill({json:hub(FLOORS)});
        return r.fulfill({json:hub([])});}
      return r.abort();});
    await pg.addInitScript(()=>{try{localStorage.setItem('arap-user-name','wdw');}catch(e){}
      window.__clip=[];Object.defineProperty(navigator,'clipboard',{value:{writeText:t=>{window.__clip.push(t);return Promise.resolve();}}});});
    await pg.goto(base+'/기준시가.html',{waitUntil:'domcontentloaded'});
    const setDate=d=>pg.evaluate(v=>{const e=document.getElementById('qDate');e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},d);
    // ── 1) 공시일 이후: 당해 연도, 같은 연도 두 줄 중 늦게 고쳐진 값 ──
    await setDate('2026-11-25');
    await pg.fill('#qAddr','서울특별시 종로구 평창동 477-10');
    await pg.click('#qGo');
    await pg.waitForSelector('#qHouse .v');
    assert.equal(await pg.textContent('#qHouse .v'),'2,626,000,000원');
    assert.match(await pg.textContent('#qHouse .t'),/개별주택가격\s*2026년/);
    assert.match(await pg.textContent('#qHouse'),/이후 → 당해 2026년 가격 적용/);
    assert.match(await pg.textContent('#qHouse'),/산정 대지면적 648㎡/);
    assert.equal(await pg.$eval('#housePrice',e=>e.value),'2626000000');
    assert.equal(await pg.$eval('#housePlot',e=>e.value),'648');
    // 개별주택가격 상자가 건물 표보다 위
    assert.equal(await pg.$eval('#qResult',e=>e.firstElementChild.id),'qHouse');
    // 연도별 표: 연도마다 한 줄(4개 연도), 적용 연도 표시
    assert.equal(await pg.$$eval('#qHouse details tr',a=>a.length),5);
    assert.match(await pg.$eval('#qHouse details tr.apply',e=>e.textContent),/^2026/);
    // 📋 표 복사 끝줄
    await pg.click('#qResult [data-qcopy]');
    const clip=(await pg.evaluate(()=>window.__clip)).pop().split('\n');
    assert.equal(clip[clip.length-1],'개별주택가격(2026년)\t\t\t\t\t\t\t2626000000');
    assert.equal(clip[clip.length-2],'');
    // ── 2) 공시일(4.30) 전: 직전 연도 — 다시 조회하지 않고 날짜만 바꿔도 따라 바뀜 ──
    await setDate('2026-03-10');
    assert.equal(await pg.textContent('#qHouse .v'),'2,563,000,000원');
    assert.match(await pg.textContent('#qHouse'),/전 → 직전 연도 2025년 가격 적용/);
    assert.equal(await pg.$eval('#housePrice',e=>e.value),'2563000000');
    await setDate('2024-02-10');
    assert.equal(await pg.textContent('#qHouse .v'),'2,467,000,000원');
    // ── 3) 아직 공시 안 된 미래 연도: 최신 연도 + 경고 ──
    await setDate('2027-06-01');
    assert.equal(await pg.textContent('#qHouse .v'),'2,626,000,000원');
    assert.match(await pg.textContent('#qHouse .why.warn'),/2027년 개별주택가격이 조회되지 않아/);
    // ── 4) 직접 고친 값은 날짜를 바꿔도 그대로, 상자에 알림 ──
    await setDate('2026-11-25');
    await pg.evaluate(()=>{const e=document.getElementById('housePrice');e.value='2700000000';e.dispatchEvent(new Event('input',{bubbles:true}));});
    await setDate('2026-03-10');
    assert.equal(await pg.$eval('#housePrice',e=>e.value),'2700000000');
    assert.match(await pg.textContent('#qHouse'),/고쳐져 있어/);
    // ── 5) 공시가격 없는 주택 지번: 앞 지번 값이 남지 않고 안내만 ──
    await setDate('2026-11-25');
    await pg.fill('#qAddr','서울특별시 종로구 평창동 477-11');
    await pg.click('#qGo');
    await pg.waitForFunction(()=>/477-11/.test(document.getElementById('qStatus').textContent));
    assert.equal(await pg.$eval('#housePrice',e=>e.value),'');
    assert.equal(await pg.$('#qHouse .v'),null);
    assert.match(await pg.textContent('#qHouse'),/이 지번으로 공시된 가격이 없습니다/);
    await pg.click('#qResult [data-qcopy]');
    const clip2=(await pg.evaluate(()=>window.__clip)).pop().split('\n');
    assert.match(clip2[clip2.length-1],/^건물 합계/);
    assert.deepEqual(errors,[]);
    console.log('OK gjs_house_price');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
