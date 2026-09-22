// 여비 자동입력이 세 앱(집합건물·입주권·토지건물)에서 본건 소재지대로 들어가 청구서 hwpx까지 반영되는지 검증.
// 기준표 키가 "경기도 성남분당구"처럼 시를 뺀 붙여쓰기라, 공부상 "경기도 성남시 분당구"를 맞추는 정규화가 세 곳 모두 필요하다.
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/travel_fee_apps.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),zlib=require('zlib');
// hwpx(zip) 읽기 — stored/deflate 둘 다
function unzip(buf){const files={};let p=0;
  while(p+4<=buf.length&&buf.readUInt32LE(p)===0x04034b50){
    const m=buf.readUInt16LE(p+8),cs=buf.readUInt32LE(p+18),nl=buf.readUInt16LE(p+26),el=buf.readUInt16LE(p+28);
    const name=buf.slice(p+30,p+30+nl).toString('utf8'),ds=p+30+nl+el,data=buf.slice(ds,ds+cs);
    files[name]=m?zlib.inflateRawSync(data):data;p=ds+cs;}
  return files;}
const JIP_API='{buildCheongguTokenMap,buildTokenHwpx,V2CHEONGGU_TPL_B64,V2CHEONGGU_BLUE2BLACK,parseZip,arapTravelFee}';
const IPJ_API='{ipjCheongguMap,buildTokenHwpx,V2CHEONGGU_TPL_B64,V2CHEONGGU_BLUE2BLACK,parseZip,arapTravelFee,arapTravelFeeBySgg}';
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  let s=fs.readFileSync(f);
  if(f.endsWith('s3r86w8a.html'))s=s.toString()
    .replace("ReactDOM.createRoot(document.getElementById('root'))",`window.testSingle=${JIP_API};ReactDOM.createRoot(document.getElementById('root'))`)
    .replace("ReactDOM.createRoot(document.getElementById('root-multi'))",`window.testMulti=${JIP_API};ReactDOM.createRoot(document.getElementById('root-multi'))`);
  if(f.endsWith('입주권.html'))s=s.toString()
    .replace("ReactDOM.createRoot(document.getElementById('root'))",`window.testIpj=${IPJ_API};ReactDOM.createRoot(document.getElementById('root'))`);
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');
  res.end(s);});
const FEE='하한 수수료 1,512,680\n기준 수수료 1,815,216\n상한 수수료 2,128,260';
(async()=>{
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL});
const mk=async()=>{const ctx=await browser.newContext({acceptDownloads:true}),page=await ctx.newPage();page.setDefaultTimeout(30000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await ctx.route('**/*',r=>{const u=r.request().url();
    if(u.includes('arap_access.js')||u.includes('arap_name.js'))return r.fulfill({body:'',contentType:'text/javascript'});
    if(u.startsWith(base))return r.continue();return r.abort();});
  return {ctx,page,errors};};
// 화면에 보이지 않는 칸이어도 값은 읽을 수 있다(청구서 카드가 접혀 있는 탭에 있음)
const travelValue=(page,rootSel)=>page.waitForFunction(sel=>{
  const tr=[...document.querySelectorAll(sel+' tr')].find(t=>t.textContent.includes('여　비'));
  const i=tr&&tr.querySelector('input');return i&&i.value?i.value:false;},rootSel).then(h=>h.jsonValue());
try{
  // ── 1. 집합건물 — ② 대상물건개요 소재지(ov.jibun)가 "경기도 성남시 분당구" ──
  for(const [mode,rootSel,api] of [['single','#root','testSingle'],['multi','#root-multi','testMulti']]){
    const {ctx,page,errors}=await mk();
    await page.addInitScript(({mode})=>{localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-jiphap-mode',mode);
      const pre=mode==='multi'?'v2:':'';
      localStorage.setItem(pre+'appraisal-case-list',JSON.stringify([{id:'TRAVEL',label:'여비검증'}]));
      localStorage.setItem(pre+'case:TRAVEL',JSON.stringify({ov:{caseNo:'TRAVEL',client:'검증',
        jibun:'경기도 성남시 분당구 정자동 178',buildingName:'검증아파트',dong:'101',floor:'3',ho:'304',
        baseDate:'2026.09.21',kind:'아파트',units:[{id:1,dong:'101',floor:'3',ho:'304',area:'84'}]},cases:[],precs:[],propType:'주거용'}));},{mode});
    await page.goto(base+'/s3r86w8a.html');
    await page.locator(rootSel).waitFor({timeout:60000});
    const v=await travelValue(page,rootSel);
    assert.equal(v.replace(/,/g,''),'95600',`집건(${mode}) 여비 칸이 ${v}`);
    // 그 값이 청구서 hwpx 본문까지 나가는지
    const out=await page.evaluate(async({api,FEE,mode})=>{const T=window[api];
      const key=(mode==='multi'?'v2:':'')+'case:TRAVEL',ov=JSON.parse(localStorage.getItem(key)).ov;
      const auto=T.arapTravelFee(ov.jibun);
      const map=T.buildCheongguTokenMap({...ov,feeTravel:String(auto)},FEE,'0','0','하한');
      const bytes=await T.buildTokenHwpx(T.V2CHEONGGU_TPL_B64,map,T.V2CHEONGGU_BLUE2BLACK);
      const entries=await T.parseZip(bytes.buffer);
      const xml=entries.filter(e=>/^Contents\/section\d+\.xml$/.test(e.name)).map(e=>new TextDecoder().decode(e.data)).join('');
      return {auto,여비:map['여비'],left:xml.includes('{{'),xml};},{api,FEE,mode});
    assert.equal(out.auto,95600,'집건 arapTravelFee');
    assert.equal(out.여비,'95,600','집건 청구서 토큰맵 여비');
    assert.equal(out.left,false,'집건 청구서 미치환 토큰 남음');
    assert.ok(out.xml.includes('95,600'),'집건 청구서 hwpx 본문에 95,600 없음');
    console.log(`  ✓ 집합건물 ${mode}: 성남시 분당구 → 칸 ${v} · 청구서 hwpx 본문 95,600 확인`);
    assert.deepEqual(errors,[],`집건(${mode}) JS 오류`);
    await ctx.close();
  }

  // ── 2. 입주권 — 기본 샘플을 띄운 뒤 ② 접수개요의 소재지 칸을 실제로 입력해 여비가 따라오는지 ──
  //    (사업위치에 시도명이 있는 경우 / 시군구만 적어 보조 조회로 좁히는 경우 / 좁혀지지 않는 경우)
  {
    const {ctx,page,errors}=await mk();
    await page.addInitScript(()=>localStorage.setItem('arap-user-name','wdw'));
    await page.goto(base+'/입주권.html');
    await page.locator('#root').waitFor({timeout:60000});
    // 사업위치·시군구·법정동은 ① 대상물건개요, 여비 칸은 ④ 가격산출에 있다
    const tab=t=>page.locator('#root span').filter({hasText:new RegExp('^'+t+'$')}).first().click();
    const fld=lab=>page.getByText(lab,{exact:true}).locator('xpath=following-sibling::input').first();
    for(const [label,vals,want] of [
      ['사업위치에 시도명 있음',['경기도 성남시 분당구 정자동 일원','분당구','정자동'],'95,600'],
      ['사업위치 비움·서울 시군구만',['','서초구','방배동'],'40,000'],
      ['사업위치 비움·지방 시군구만',['','수성구','범어동'],'319,600'],
      // "중구"·"강서구"처럼 여러 시도에 있는 이름은 판단하지 않는다 → 자동입력을 하지 않고 직전 값을 그대로 둔다
      // (집합건물도 매칭 실패 시 칸을 건드리지 않는다. 바로 위 '수성구' 건의 319,600 이 남아 있어야 한다)
      ['여러 시도에 있는 시군구 이름은 건드리지 않음',['','중구','명동'],'319,600'],
    ]){
      const labs=['사업위치','소재지 시군구','법정동'];
      await tab('① 대상물건개요');
      for(let i=0;i<3;i++)await fld(labs[i]).fill(vals[i]);
      await tab('④ 가격산출');
      await page.waitForFunction(w=>{
        const tr=[...document.querySelectorAll('#root tr')].find(t=>t.textContent.includes('여　비'));
        const i=tr&&tr.querySelector('input');return !!i&&i.value===w;},want,{timeout:10000})
        .catch(async()=>{throw new Error(`입주권(${label}) 여비 칸이 ${await travelValue(page,'#root')}, 기대 ${want}`);});
      // 그 값이 청구서 hwpx 본문까지 나가는지
      const out=await page.evaluate(async({FEE,want})=>{const T=window.testIpj;
        const tr=[...document.querySelectorAll('#root tr')].find(t=>t.textContent.includes('여　비'));
        const shown=tr.querySelector('input').value;
        const ov={caseNo:'TRAVEL',client:'검증',sigungu:'서초구',beopjeongdong:'방배동',writeDate:'2026.09.22'};
        const fee={feeText:FEE,feeBasis:'하한',feeMain:'1,512,000',feeTravel:shown,
          feeSurvey:'15,000',feeDoc:'15,000',feeEtc:'0',specialFee:'0',specialFeeMode:'직접입력',downPayment:'0'};
        const map=T.ipjCheongguMap(ov,fee);
        const bytes=await T.buildTokenHwpx(T.V2CHEONGGU_TPL_B64,map,T.V2CHEONGGU_BLUE2BLACK);
        const entries=await T.parseZip(bytes.buffer);
        const xml=entries.filter(e=>/^Contents\/section\d+\.xml$/.test(e.name)).map(e=>new TextDecoder().decode(e.data)).join('');
        return {shown,여비:map['여비'],left:xml.includes('{{'),hit:xml.includes(want)};},{FEE,want});
      assert.equal(out.여비,want,`입주권(${label}) 청구서 토큰맵 여비`);
      assert.equal(out.left,false,`입주권(${label}) 청구서 미치환 토큰 남음`);
      assert.ok(out.hit,`입주권(${label}) 청구서 hwpx 본문에 ${want} 없음`);
      console.log(`  ✓ 입주권 ${label}: 칸 ${out.shown} · 청구서 hwpx 본문 ${want} 확인`);
    }
    // 보조 조회가 애매한 이름을 정말로 거르는지
    const loose=await page.evaluate(()=>['서초구','수성구','분당구','중구','강서구',''].map(q=>window.testIpj.arapTravelFeeBySgg(q)));
    assert.deepEqual(loose,[40000,319600,95600,null,null,null],'입주권 보조 조회(arapTravelFeeBySgg)');
    console.log('  \u2713 입주권 보조 조회: 서초구 40000 · 수성구 319600 · 분당구 95600 · 중구/강서구/빈칸 판단보류');
    assert.deepEqual(errors,[],'입주권 JS 오류');
    await ctx.close();
  }

  // ── 3. 토지건물 — 본건 토지 소재지(LANDS[0])로 1차, 시군구 입력칸(jb_region)으로 2차 ──
  {
    const {ctx,page,errors}=await mk();
    await page.goto(base+'/토지건물.html');
    await page.waitForFunction(()=>window.ArapCheonggu&&typeof cgTravelAuto==='function',null,{timeout:60000});
    for(const [label,setup,want] of [
      ['본건 소재지(LANDS[0])',()=>{LANDS=[{fullAddr:'경기도 성남시 분당구 정자동 178'}];document.getElementById('jb_region').value='';},'95,600'],
      ['본건이 비면 시군구 입력칸',()=>{LANDS=[{}];document.getElementById('jb_region').value='대구광역시 수성구';},'319,600'],
      ['둘 다 비면 기본값',()=>{LANDS=[{}];document.getElementById('jb_region').value='';},'40,000'],
    ]){
      const out=await page.evaluate(({setup,FEE})=>{
        eval('('+setup+')()');
        CG_TRAVEL_MANUAL=false;
        document.getElementById('cg_feeText').value=FEE;
        document.getElementById('cg_feeBasis').value='하한';
        renderCheonggu();
        const shown=document.getElementById('cg_travel').value;
        return {shown,여비:window.ArapCheonggu.fmt(cgFee().여비)};},{setup:setup.toString(),FEE});
      assert.equal(out.shown,want,`토건(${label}) 여비 칸이 ${out.shown}, 기대 ${want}`);
      assert.equal(out.여비,want,`토건(${label}) 청구서 계산에 들어간 여비`);
      console.log(`  ✓ 토지건물 ${label}: 칸 ${out.shown} · 청구서 계산 ${out.여비}`);
    }
    // 청구서 hwpx — 버튼을 실제로 눌러 받은 파일을 열어 확인
    await page.evaluate(({FEE})=>{
      LANDS=[{fullAddr:'경기도 성남시 분당구 정자동 178'}];CG_TRAVEL_MANUAL=false;
      document.getElementById('ov_client').value='검증의뢰인';
      document.getElementById('ov_writeDay').value='2026.09.22';
      document.getElementById('cg_feeText').value=FEE;
      showTab('cheonggu');renderCheonggu();},{FEE});
    await page.locator('#btnCheonggu').waitFor();
    assert.equal(await page.locator('#cg_travel').inputValue(),'95,600','토건 여비 칸');
    const [dl]=await Promise.all([page.waitForEvent('download',{timeout:30000}),page.locator('#btnCheonggu').click()]);
    const file=path.join(require('os').tmpdir(),'travel-fee-'+Date.now()+'.hwpx');
    await dl.saveAs(file);
    const buf=fs.readFileSync(file);
    const entries=unzip(buf);
    const xml=Object.keys(entries).filter(n=>/^Contents\/section\d+\.xml$/.test(n)).map(n=>entries[n].toString('utf8')).join('');
    assert.ok(xml.length>0,'토건 청구서 hwpx 본문 XML 없음');
    assert.ok(xml.includes('95,600'),'토건 청구서 hwpx 본문에 95,600 없음');
    assert.ok(!xml.includes('{{'),'토건 청구서 hwpx 미치환 토큰 남음');
    console.log(`  ✓ 토지건물: 청구서 hwpx 실제 다운로드(${dl.suggestedFilename()}, ${buf.length}바이트) 본문 95,600 확인`);
    fs.unlinkSync(file);
    assert.deepEqual(errors,[],'토건 JS 오류');
    await ctx.close();
  }

  console.log('\n여비 자동입력 검증 통과 (집합건물 2벌 · 입주권 4건 · 토지건물 3건)');
}finally{await browser.close();server.close();}
})().catch(e=>{console.error('\n실패:',e.message||e);server.close();process.exitCode=1;});
