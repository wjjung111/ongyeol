// 집합건물 앱 '② 대상물건개요' 건축물대장 불러오기 검증 — V-World·프록시 응답을 흉내내어
// 주소 조회 → 동·호 선택 → 빈칸 채움(단일 호수) / 표 추가(여러 호수), '빈칸만 채우기' 규칙 확인
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/jiphap_bldrgst.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');fs.createReadStream(f).pipe(res);});
const PNU='1165010600113440000';
const hub=(arr,page,total)=>({response:{header:{resultCode:'00',resultMsg:'NORMAL SERVICE'},body:{items:{item:arr},numOfRows:200,pageNo:page||1,totalCount:total==null?arr.length:total}}});
const T=(dong,extra)=>Object.assign({regstrGbCdNm:'집합',regstrKindCdNm:'표제부',mainAtchGbCdNm:'주건축물',platPlc:'서울특별시 서초구 방배동 1344번지 외 3필지',newPlatPlc:'서울특별시 서초구 서초대로1길 30',bldNm:'방배1차현대아파트',dongNm:dong,mainPurpsCdNm:'공동주택',etcPurps:'아파트',strctCdNm:'철근콘크리트구조',etcStrct:'',roofCdNm:'(철근)콘크리트',etcRoof:'',useAprDay:'19870512',grndFlrCnt:'13',ugrndFlrCnt:'1',totArea:'8123.45',platArea:'24658',hhldCnt:'96'},extra||{});
const MOCK={
  vworld:{response:{status:'OK',result:{items:[{id:PNU,title:'서울특별시 서초구 방배동 1344',address:{parcel:'서울특별시 서초구 방배동 1344',road:'서울특별시 서초구 서초대로1길 30'}}]}}},
  getBrTitleInfo:hub([T('107동'),T('108동'),T('',{mainAtchGbCdNm:'부속건축물',dongNm:'관리동'})]),
  getBrRecapTitleInfo:hub([{platPlc:'서울특별시 서초구 방배동 1344번지 외 3필지',newPlatPlc:'서울특별시 서초구 서초대로1길 30',bldNm:'방배1차현대아파트',mainBldCnt:'2',hhldCnt:'192',platArea:'24658',totArea:'16246.9',useAprDay:'19870512'}]),
  getBrJijiguInfo:hub([{jijiguGbCdNm:'용도지역',jijiguCdNm:'도시지역'},{jijiguGbCdNm:'용도지역',jijiguCdNm:'제3종일반주거지역'},{jijiguGbCdNm:'용도지구',jijiguCdNm:'고도지구'}]),
  getBrExposInfo:(q)=>hub(q.get('dongNm')==='107동'?[{dongNm:'107동',hoNm:'901호',flrNo:'9',flrGbCdNm:'지상',mainPurpsCdNm:'아파트'},{dongNm:'107동',hoNm:'902호',flrNo:'9',flrGbCdNm:'지상',mainPurpsCdNm:'아파트'},{dongNm:'107동',hoNm:'101호',flrNo:'1',flrGbCdNm:'지상',mainPurpsCdNm:'아파트'}]:[{dongNm:'108동',hoNm:'201호',flrNo:'2',flrGbCdNm:'지상',mainPurpsCdNm:'아파트'}]),
  getBrExposPubuseAreaInfo:(q)=>{const ho=q.get('hoNm'),d=q.get('dongNm');return hub([
    {dongNm:d,hoNm:ho,exposPubuseGbCdNm:'전유',mainAtchGbCdNm:'주건축물',flrNo:ho==='101호'?'1':'9',flrGbCdNm:'지상',mainPurpsCdNm:'아파트',area:ho==='101호'?'84.96':'59.94'},
    {dongNm:d,hoNm:ho,exposPubuseGbCdNm:'공용',mainAtchGbCdNm:'주건축물',flrNo:'9',flrGbCdNm:'지상',mainPurpsCdNm:'계단실',area:'10.1234'},
    {dongNm:d,hoNm:ho,exposPubuseGbCdNm:'공용',mainAtchGbCdNm:'부속건축물',flrNo:'1',flrGbCdNm:'지하',mainPurpsCdNm:'주차장',area:'5.2'}]);}
};
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true});
  try{
    const ctx=await browser.newContext(),page=await ctx.newPage(),errors=[],calls=[];
    page.on('pageerror',e=>errors.push(e.message));
    await ctx.route('**/*',r=>{const u=r.request().url();
      if(u.includes('arap_access.js'))return r.fulfill({body:'',contentType:'text/javascript'});
      if(u.startsWith(base))return r.continue();
      if(u.startsWith('https://api.vworld.kr'))return r.fulfill({json:MOCK.vworld});
      if(u.includes('workers.dev/bld')){const q=new URL(u).searchParams,op=q.get('op');calls.push(op+':'+(q.get('dongNm')||'')+':'+(q.get('hoNm')||''));const m=MOCK[op];return r.fulfill({json:typeof m==='function'?m(q):m});}
      if(u.startsWith('https://script.google.com')||u.startsWith('https://api.github.com'))return r.fulfill({json:{ok:true}});
      return r.abort();});
    await page.addInitScript(()=>{try{localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-jiphap-mode','single');}catch(e){}});
    await page.goto(base+'/s3r86w8a.html',{waitUntil:'domcontentloaded'});
    await page.waitForSelector('#root >> text=② 대상물건개요',{timeout:60000});
    await page.waitForFunction(()=>window.ArapBldrgst&&window.ArapBldrgst.Panel);
    // ── 단일 호수: 대표 샘플(압구정)이 로드된 상태 → 주소칸에 지번 첫 필지가 미리 들어감 ──
    const single=page.locator('#root');
    await single.getByText('② 대상물건개요',{exact:true}).click();
    const panel=single.locator('text=🏢 건축물대장 불러오기').locator('xpath=ancestor::div[1]/..');
    const qbox=single.locator('input[placeholder^="지번(예"]');
    assert.equal(await qbox.inputValue(),'서울특별시 강남구 압구정동 456');
    // 등기 인식 결과처럼 일부 칸을 채우고(빈칸 규칙 확인용), 나머지는 비운다
    // 입력칸은 '대상물건 정보'·'건물 개요' 카드 안에서만 찾는다(왼쪽 요약패널 등 같은 라벨 제외)
    const form=single.locator('xpath=//div[normalize-space(text())="대상물건 정보"]/.. | //div[normalize-space(text())="건물 개요 (의견서용)"]/..');
    const setF=async(label,val)=>{const inp=form.locator(`xpath=.//span[normalize-space(text())="${label}"]/following-sibling::input[1]`);await inp.fill(val);};
    for(const [l,v] of [['지번주소','서울특별시 서초구 방배동 1344, 1344-1, 1344-2, 1344-3'],['도로명주소','서울특별시 서초구 서초대로1길 30'],['건물명','방배1차현대아파트'],['동','107'],['층','9'],['호','902'],['전유면적(㎡)','59.94'],['공용면적(㎡)',''],['용도지역',''],['주구조',''],['주용도(표제부)',''],['단지규모(동/세대)',''],['대지면적(㎡)','24657.999999999996'],['연면적(㎡)',''],['층수(지상/지하)',''],['소유자','한신명']])await setF(l,v);
    const aprBox=form.locator('xpath=.//span[normalize-space(text())="사용승인일"]/..//input');
    await aprBox.first().fill('');
    await qbox.fill('서울 서초구 방배동 1344');
    await single.locator('button:has-text("🔍 조회")').click();
    await single.locator('text=/→ 칸에 채웠습니다/').waitFor({timeout:15000});
    const getF=async(label)=>form.locator(`xpath=.//span[normalize-space(text())="${label}"]/following-sibling::input[1]`).inputValue();
    // 등기에서 읽은 동 107·호 902가 드롭다운에 미리 선택됨
    const sels=single.locator('text=동 / 호').locator('xpath=following-sibling::select');
    assert.equal(await sels.nth(0).inputValue(),'107동');assert.equal(await sels.nth(1).inputValue(),'902호');
    // 빈칸만 채워짐: 기존 값(소유자·대지면적·지번주소)은 그대로, 빈칸은 대장 값
    assert.equal(await getF('공용면적(㎡)'),'15.3234');
    assert.equal(await getF('용도지역'),'제3종일반주거지역');
    assert.equal(await getF('주구조'),'철근콘크리트구조 (철근)콘크리트지붕');
    assert.equal(await getF('주용도(표제부)'),'공동주택(아파트)');
    assert.equal(await getF('단지규모(동/세대)'),'2/192');
    assert.equal(await getF('연면적(㎡)'),'8123.45');
    assert.equal(await getF('층수(지상/지하)'),'13/1');
    assert.equal(await getF('대지면적(㎡)'),'24657.999999999996');   // 빈칸만 → 등기값 유지
    assert.equal(await getF('지번주소'),'서울특별시 서초구 방배동 1344, 1344-1, 1344-2, 1344-3');
    assert.equal(await getF('소유자'),'한신명');
    assert.equal(await getF('전유면적(㎡)'),'59.94');
    const apr=await aprBox.first().inputValue();
    assert.equal(apr,'1987.05.12');
    // 다른 호(101호)로 바꿔도 빈칸만 규칙이라 전유면적은 안 바뀜 → 체크 해제 후 다시 고르면 덮어씀
    await sels.nth(1).selectOption('101호');await page.waitForTimeout(400);
    assert.equal(await getF('전유면적(㎡)'),'59.94');
    await single.locator('text=빈칸만 채우기').locator('input').uncheck();
    await sels.nth(1).selectOption('902호');await page.waitForTimeout(300);
    await sels.nth(1).selectOption('101호');await page.waitForTimeout(400);
    assert.equal(await getF('전유면적(㎡)'),'84.96');assert.equal(await getF('층'),'1');assert.equal(await getF('호'),'101');
    assert.equal(await getF('대지면적(㎡)'),'24658');   // 덮어쓰기 → 대장 대지면적
    // 동을 바꾸면 그 동 호 목록으로
    await sels.nth(0).selectOption('108동');await single.locator('text=/1호$/').waitFor({timeout:5000});
    assert.ok(calls.includes('getBrExposInfo:108동:'));
    console.log('단일 호수 OK');

    // ── 여러 호수: 호를 고르면 상세물건정보 표에 행 추가 ──
    await page.locator('#btn-multi').click();
    const multi=page.locator('#root-multi');
    await multi.getByText('② 대상물건개요',{exact:true}).click();
    const mq=multi.locator('input[placeholder^="지번(예"]');
    await mq.fill('서울 서초구 방배동 1344');
    await multi.locator('button:has-text("🔍 조회")').click();
    const msels=multi.locator('text=동 / 호').locator('xpath=following-sibling::select');
    await msels.nth(1).locator('option:has-text("902호")').waitFor({state:'attached',timeout:15000});
    await msels.nth(1).selectOption('902호');await multi.locator('text=/표에 넣었습니다/').waitFor({timeout:10000});
    await msels.nth(1).selectOption('901호');await page.waitForTimeout(600);
    const rows=await multi.locator('table tbody tr').evaluateAll(trs=>trs.map(tr=>Array.from(tr.querySelectorAll('input')).slice(0,7).map(i=>i.value)));
    const units=rows.filter(r=>r.length>=6).map(r=>r.slice(0,6));
    assert.deepEqual(units.map(r=>r.slice(0,5)),[['107','9','902','59.94','15.3234'],['107','9','901','59.94','15.3234']]);
    const mform=multi.locator('xpath=//div[normalize-space(text())="대상물건정보"]/..');
    const mget=async(label)=>mform.locator(`xpath=.//span[normalize-space(text())="${label}"]/following-sibling::input[1]`).inputValue();
    assert.equal(await mget('용도지역'),'제3종일반주거지역');assert.equal(await mget('층수(지상/지하)'),'13/1');assert.equal(await mget('단지규모(동/세대)'),'2/192');
    console.log('여러 호수 OK');
    assert.deepEqual(errors,[]);
    console.log('PASS');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error('FAIL',e);process.exit(1);});
