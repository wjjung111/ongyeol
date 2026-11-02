// 기준시가.html 「공동주택가격」 탭 검증 — V-World getApartHousingPriceAttr 응답을 가짜로 꾸며
// 지번 → 동·호 드롭다운 → 연도별 가격, 평가기준일이 공시일 전이면 직전 연도 적용, 대단지 페이지 나눔, 자료 없음 안내, 탭 기억
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/gjs_apt_price.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.css')?'text/css':'text/javascript');fs.createReadStream(f).pipe(res);});
const PNU_APT='1168011000100040000', PNU_BIG='1168011000100050000', PNU_NONE='1168011000100060000';
// 작은 단지: 101동·102동 × 3호, 2024·2025·2026년
const U=(y,dong,ho,fl,pc)=>({pnu:PNU_APT,stdrYear:String(y),stdrMt:'01',aphusNm:'테스트아파트',aphusSeCodeNm:'아파트',dongNm:dong,floorNm:fl,hoNm:ho,prvuseAr:'84.97',pblntfPc:String(pc),lastUpdtDt:y+'-04-30'});
const SMALL=[];
for(const y of [2024,2025,2026]) for(const d of ['102동','101동']) for(const [h,f] of [['1001','10'],['201','2'],['1501','15']])
  SMALL.push(U(y,d,h,f,(y-2000)*10000000+(+h)*1000+(d==='101동'?1:2)));
// 대단지: 2,500세대 1개 연도 → 3페이지
const BIG=[]; for(let i=0;i<2500;i++) BIG.push({pnu:PNU_BIG,stdrYear:'2026',stdrMt:'01',aphusNm:'큰단지',aphusSeCodeNm:'아파트',dongNm:(100+Math.floor(i/100))+'동',floorNm:String(1+i%25),hoNm:String((1+i%25)*100+1+Math.floor(i/25)%4),prvuseAr:'59.9',pblntfPc:'500000000'});
const page=(arr,pg)=>({apartHousingPrices:{field:arr.slice((pg-1)*1000,pg*1000),totalCount:String(arr.length),numOfRows:'1000',pageNo:String(pg)}});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL});
  const reqs=[];
  try{
    const ctx=await browser.newContext(),pg=await ctx.newPage(),errors=[];
    pg.on('pageerror',e=>errors.push(e.message));
    await ctx.route('**/*',r=>{const u=r.request().url();
      if(u.startsWith(base))return r.continue();
      if(u.includes('/req/search')){const q=new URL(u).searchParams.get('query');
        const id=/456/.test(q)?PNU_APT:/789/.test(q)?PNU_BIG:PNU_NONE;
        return r.fulfill({json:{response:{status:'OK',result:{items:[{id,title:q,address:{parcel:'서울특별시 강남구 압구정동 '+q.replace(/\D/g,'')}}]}}}});}
      if(u.includes('getApartHousingPriceAttr')){const sp=new URL(u).searchParams;reqs.push(Object.fromEntries(sp));
        const src=sp.get('pnu')===PNU_APT?SMALL:sp.get('pnu')===PNU_BIG?BIG:[];
        const y=sp.get('stdrYear'),d=sp.get('dongNm'),h=sp.get('hoNm');
        const f=src.filter(it=>(!y||it.stdrYear===y)&&(!d||it.dongNm===d)&&(!h||it.hoNm===h));
        return r.fulfill({json:page(f,+sp.get('pageNo')||1)});}
      return r.abort();});
    await pg.addInitScript(()=>{try{localStorage.setItem('arap-user-name','wdw');}catch(e){}});
    await pg.goto(base+'/기준시가.html',{waitUntil:'domcontentloaded'});
    // 처음엔 건물 기준시가 탭
    assert.equal(await pg.isVisible('#paneBld'),true);assert.equal(await pg.isVisible('#paneApt'),false);
    await pg.click('.ptabs button[data-pane="apt"]');
    assert.equal(await pg.isVisible('#paneApt'),true);assert.equal(await pg.isVisible('#paneBld'),false);
    assert.equal(await pg.textContent('#tbTitle'),'공동주택가격');

    // 1) 평가기준일 2026.03.10 (공시일 04.30 전) → 2025년 목록·가격
    await pg.fill('#aDate','2026-03-10');
    await pg.fill('#aAddr','압구정동 456');
    await pg.click('#aGo');
    await pg.waitForSelector('#aPick',{state:'visible'});
    assert.equal(reqs[0].stdrYear,'2025');
    assert.deepEqual(await pg.$$eval('#aDong option',a=>a.map(o=>o.value)),['101동','102동']);
    assert.deepEqual(await pg.$$eval('#aHo option',a=>a.slice(1).map(o=>o.value)),['201','1001','1501']);   // 층 순
    assert.match(await pg.textContent('#aStatus'),/6세대/);
    // 호수 10개 이하 → 조회하자마자 전체 호 표(동·층·호 순, 2025년 가격)
    assert.deepEqual(await pg.$$eval('#aAllTbl thead th',a=>a.map(x=>x.textContent)),['동','층','호','전유면적(㎡)','2025년 공동주택가격']);
    const allRows=await pg.$$eval('#aAllTbl tbody tr',a=>a.map(tr=>[...tr.children].map(td=>td.textContent)));
    assert.equal(allRows.length,6);
    assert.deepEqual(allRows[0],['101동','2','201호','84.97',(250000000+201000+1).toLocaleString('ko-KR')+'원']);
    assert.deepEqual(allRows[3].slice(0,3),['102동','2','201호']);
    // 📋 전체 호 복사 → 엑셀용 탭 구분, 숫자는 쉼표·원 없이
    await ctx.grantPermissions(['clipboard-read','clipboard-write'],{origin:base});
    await pg.click('#aAllCopy');
    await pg.waitForFunction(()=>/6호 복사 완료/.test(document.getElementById('aAllSt').textContent));
    const clip=(await pg.evaluate(()=>navigator.clipboard.readText())).split('\n');
    assert.equal(clip[0],['동','층','호','전유면적(㎡)','2025년 공동주택가격'].join('\t'));
    assert.equal(clip[1],['101동','2','201호','84.97',String(250000000+201000+1)].join('\t'));
    assert.equal(clip.length,7);
    // 「그 호는 집합건물 탭에서 계산」 → 집합건물 탭, 주소·평가기준일·일괄고시 없는 비주거 채움 + 주소 조회 누름
    await pg.click('#aAll [data-to-condo]');
    await pg.waitForSelector('#paneCondo iframe');
    assert.equal(await pg.isVisible('#paneApt'),false);
    const fr=pg.frameLocator('#condoFrame');
    await fr.locator('#address').waitFor({state:'visible'});
    assert.equal(await fr.locator('#address').inputValue(),'서울특별시 강남구 압구정동 456');
    assert.equal(await fr.locator('#mode').inputValue(),'manual');
    assert.equal(await fr.locator('#date').inputValue(),'2026-03-10');
    assert.equal(new URL(pg.url()).hash,'#condo');
    await pg.click('.ptabs button[data-pane="apt"]');
    // 줄 클릭 → 그 호 선택·연도별 표
    await pg.click('#aAllTbl tbody tr:nth-child(5)');
    await pg.waitForFunction(()=>document.getElementById('aHo').value==='1001'&&document.getElementById('aDong').value==='102동'&&document.getElementById('aVal'));
    await pg.selectOption('#aDong','101동');
    await pg.selectOption('#aHo','1001');
    await pg.waitForSelector('#aVal');
    assert.equal(await pg.textContent('#aVal'),(250000000+1001000+1).toLocaleString('ko-KR')+'원');
    assert.match(await pg.textContent('#aResult'),/직전 연도 2025년/);
    assert.deepEqual(await pg.$$eval('#aResult tbody tr td:first-child',a=>a.map(x=>x.textContent)),['2026','2025','2024']);
    assert.equal(await pg.$eval('#aResult tr.apply td',e=>e.textContent),'2025');
    await pg.click('#aYearCopy');
    await pg.waitForFunction(()=>/3개 연도 복사 완료/.test(document.getElementById('aYearSt').textContent));
    const yc=(await pg.evaluate(()=>navigator.clipboard.readText())).split('\n');
    assert.equal(yc[1],'공시연도\t기준월\t공동주택가격\t전용면적\t전용㎡당');
    assert.equal(yc[3],['2025','01',String(250000000+1001000+1),'84.97',String(Math.round((250000000+1001000+1)/84.97))].join('\t'));
    const hreq=reqs[reqs.length-1];assert.equal(hreq.dongNm,'101동');assert.equal(hreq.hoNm,'1001');assert.ok(!hreq.stdrYear);

    // 2) 평가기준일을 공시일 뒤로 → 2026년
    await pg.fill('#aDate','2026-05-10');await pg.dispatchEvent('#aDate','change');
    await pg.waitForFunction(()=>document.querySelector('#aResult tr.apply td')?.textContent==='2026');
    assert.equal(await pg.textContent('#aVal'),(260000000+1001000+1).toLocaleString('ko-KR')+'원');
    assert.match(await pg.textContent('#aResult'),/당해 2026년/);
    // 공시일을 05.20으로 고치면 다시 2025년
    await pg.fill('#aPubDay','05.20');await pg.dispatchEvent('#aPubDay','change');
    await pg.waitForFunction(()=>document.querySelector('#aResult tr.apply td')?.textContent==='2025');
    // 동 바꾸면 호 목록 다시, 결과 지움
    await pg.selectOption('#aDong','102동');
    assert.equal(await pg.innerHTML('#aResult'),'');

    // 3) 2026년 자료 없음(평가기준일 2027.06) → 2026년 목록으로 대체, 안내
    reqs.length=0;
    await pg.fill('#aDate','2027-06-01');await pg.fill('#aPubDay','04.30');
    await pg.click('#aGo');
    await pg.waitForFunction(()=>/2026년 목록/.test(document.getElementById('aStatus').textContent));
    assert.deepEqual(reqs.filter(r=>r.stdrYear).slice(-2).map(r=>r.stdrYear),['2027','2026']);
    await pg.selectOption('#aHo','201');
    await pg.waitForSelector('#aResult .why.warn');
    assert.match(await pg.textContent('#aResult'),/2027년 공동주택가격이 조회되지 않습니다/);
    assert.equal(await pg.isDisabled('#aCopy'),true);

    // 4) 대단지 2,500세대 → 페이지 3개 받아 동 25개
    reqs.length=0;
    await pg.fill('#aDate','2026-06-01');await pg.fill('#aAddr','압구정동 789');
    await pg.click('#aGo');
    await pg.waitForFunction(()=>/2,500세대/.test(document.getElementById('aStatus').textContent));
    assert.deepEqual(reqs.filter(r=>r.pnu==='1168011000100050000').map(r=>r.pageNo).sort(),['1','2','3']);
    assert.equal(await pg.$$eval('#aDong option',a=>a.length),25);
    assert.equal(await pg.$('#aAllTbl'),null);   // 2,500세대는 전체 표 없음

    // 5) 자료 없는 지번 → 안내
    await pg.fill('#aAddr','압구정동 1');
    await pg.click('#aGo');
    await pg.waitForFunction(()=>document.getElementById('aStatus').classList.contains('err'));
    assert.match(await pg.textContent('#aStatus'),/공시된 공동주택가격이 없습니다/);
    assert.equal(await pg.isVisible('#aPick'),false);

    // 6) 다시 열면 마지막 탭(공동주택가격) 유지, #apt 없이 건물 탭 누르면 건물로
    await pg.reload({waitUntil:'domcontentloaded'});
    assert.equal(await pg.isVisible('#paneApt'),true);
    await pg.click('.ptabs button[data-pane="bld"]');
    assert.equal(await pg.isVisible('#qGo'),true);
    assert.deepEqual(errors,[]);
    await ctx.close();
    console.log('OK gjs_apt_price');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
