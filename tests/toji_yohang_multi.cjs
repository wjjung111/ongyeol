// 요항표 — 본건 필지가 여럿이면 「Ⅱ. 토지의 개황」 1. 지세 및 형상 · 2. 이용상황 · 3. 접면도로 상황을 기호별 문단으로.
// 화면(기호2부터 입력칸·자동채움·저장 복원) + 실제 다운로드한 hwpx 문단(앞머리 검정, 값 빨강, 접면도로 한 면이면 ② 뺌, 빈 칸은 양식 표시) 확인.
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_yohang_multi.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.env.YOHANG_TEST_OUTPUT||path.join(root,'..','yohang-test'));
fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  try{
    const ctx=await browser.newContext({acceptDownloads:true}),page=await ctx.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await ctx.route('**/*',r=>{const u=r.request().url();if((u.includes('arap_access.js')||u.includes('arap_user.js')))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
    await page.goto(base+'/토지건물.html',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.ArapTojiDocuments);
    await page.evaluate(()=>{
      LANDS=[{소재지:'검증동',지번:'10',지목:'답',면적:'100',이용상황:'전',형상:'부정형',지세:'평지'},
             {소재지:'검증동',지번:'11',지목:'답',면적:'100',이용상황:'답',형상:'세장형',지세:'완경사'},
             {소재지:'검증동',지번:'12',지목:'답',면적:'100',이용상황:'',형상:'',지세:''}];
      renderLands();document.getElementById('ov_client').value='검증 의뢰인';showTab('yohang');});
    // 화면: 기호 머리 보임, 기호2·3 입력칸 생김, 빈 칸 자동채움
    assert.equal(await page.locator('.y-kiho:visible').count(),3,'기호1 머리 3곳');
    assert(await page.locator('#y_roadBon').isHidden(),'기호별이면 "본건" 숨김');
    const f=(i,k)=>page.locator('[data-i="'+i+'"][data-k="'+k+'"]');
    assert.equal(await f(1,'jise').inputValue(),'완경사한');assert.equal(await f(1,'shape').inputValue(),'세장형');assert.equal(await f(1,'use').inputValue(),'답');
    assert.equal(await f(2,'jise').inputValue(),'');
    await page.locator('#y_road1dir').fill('남측');await page.locator('#y_road1w').fill('6');await page.locator('#y_road2dir').fill('서측');await page.locator('#y_road2w').fill('4');
    await f(1,'road1dir').fill('북측');await f(1,'road1w').fill('3');
    await f(1,'roadCnt').selectOption('1');
    assert(await page.locator('#y_landMore3 p').first().locator('.y-road2').first().isHidden(),'한 면이면 ② 숨김');
    await f(2,'shape').fill('사다리형');
    // 저장·복원
    await page.evaluate(()=>doSave());
    await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.ArapTojiDocuments);
    await page.evaluate(()=>showTab('yohang'));
    assert.equal(await f(1,'road1dir').inputValue(),'북측','복원');assert.equal(await f(1,'roadCnt').inputValue(),'1');assert.equal(await f(2,'shape').inputValue(),'사다리형');
    // 다운로드
    const dl=page.waitForEvent('download');await page.locator('#btnYohang2').click();
    const file=path.join(out,'요항표_여러필지.hwpx');await (await dl).saveAs(file);
    const res=await page.evaluate(async bytes=>{
      const es=await ArapCheonggu.parseZip(Uint8Array.from(bytes).buffer),dec=new TextDecoder();
      const hdoc=new DOMParser().parseFromString(dec.decode(es.find(e=>e.name==='Contents/header.xml').data),'application/xml');
      const redIds=new Set(Array.from(hdoc.getElementsByTagNameNS('*','charPr')).filter(p=>(p.getAttribute('textColor')||'').toUpperCase()==='#FF0000').map(p=>p.getAttribute('id')));
      const doc=new DOMParser().parseFromString(dec.decode(es.find(e=>e.name==='Contents/section0.xml').data),'application/xml');
      if(doc.querySelector('parsererror'))throw Error('XML');
      const ps=Array.from(doc.documentElement.children).filter(n=>n.localName==='p');
      const txt=ps.map(p=>p.textContent);
      const a=txt.findIndex(t=>t.trim()==='Ⅱ. 토지의 개황'),b=txt.findIndex(t=>t.trim()==='Ⅲ. 건물의 개황');
      const sec=ps.slice(a,b).filter(p=>/^\(\d\) 기호\d : /.test(p.textContent));
      return {lines:sec.map(p=>p.textContent),
        firstRunBlack:sec.map(p=>{const r=Array.from(p.children).find(n=>n.localName==='run');return !redIds.has(r.getAttribute('charPrIDRef'));}),
        redVals:sec.map(p=>Array.from(p.children).filter(n=>n.localName==='run'&&redIds.has(n.getAttribute('charPrIDRef'))).map(r=>r.textContent)),
        hashLeft:/#\d+\}\}/.test(dec.decode(es.find(e=>e.name==='Contents/section0.xml').data))};
    },Array.from(fs.readFileSync(file)));
    console.log(res.lines.join('\n'));
    assert.deepEqual(res.lines,[
      '(1) 기호1 : 인접토지 및 인접도로 대비 평탄한 부정형의 토지임. ',
      '(2) 기호2 : 인접토지 및 인접도로 대비 완경사한 세장형의 토지임. ',
      '(3) 기호3 : 인접토지 및 인접도로 대비 {{요항_지세}}한 사다리형의 토지임. ',
      '(1) 기호1 : 전으로 이용중임.',
      '(2) 기호2 : 답으로 이용중임.',
      '(3) 기호3 : {{요항_이용상황}}로 이용중임.',
      '(1) 기호1 : 남측으로 노폭 약 6m, 서측으로 노폭 약 4m 내외의 아스팔트 포장도로와 각각 접하고 있음.',
      '(2) 기호2 : 북측으로 노폭 약 3m 내외의 아스팔트 포장도로와 접하고 있음.',
      '(3) 기호3 : {{요항_도로1방위}}으로 노폭 약 {{요항_도로1노폭}}m, {{요항_도로2방위}}으로 노폭 약 {{요항_도로2노폭}}m 내외의 아스팔트 포장도로와 각각 접하고 있음.']);
    assert(res.firstRunBlack.every(Boolean),'기호 머리는 검정');
    assert.deepEqual(res.redVals[1],['완경사','세장형'],'값은 빨강');
    assert.equal(res.hashLeft,false);
    // 묶기(일단지)면 기호별로 나누지 않고 1·2항 앞에만 "[기호1,2,3 공히] ", 접면도로는 기호 없이 종전 "본건 …"(값은 기호1 칸 = 종전 칸)
    await page.evaluate(()=>{SAJ_MODE.land='group';showTab('yohang');});
    assert.equal(await page.locator('.y-kiho:visible').count(),2,'공히 머리 2곳(접면도로 제외)');
    assert.equal(await page.locator('.y-kiho').first().textContent(),'[기호1,2,3 공히] ');
    assert(await page.locator('#y_roadBon').isVisible(),'일단지 접면도로는 "본건" 그대로');
    assert.equal(await page.locator('#y_landMore1 p').count(),0,'기호2부터 칸 없음');
    const grpRoad=await page.evaluate(async()=>{const bytes=await ArapTojiDocuments.buildYohang();const es=await ArapCheonggu.parseZip(bytes.buffer);
      return new TextDecoder().decode(es.find(e=>e.name==='Contents/section0.xml').data).replace(/<[^>]+>/g,'');});
    assert(grpRoad.includes('본건 남측으로 노폭 약 6m, 서측으로 노폭 약 4m 내외의 아스팔트 포장도로와 각각 접하고 있음.'),'일단지 접면도로 = 종전 문장');
    const grp=await page.evaluate(async()=>{const bytes=await ArapTojiDocuments.buildYohang();const es=await ArapCheonggu.parseZip(bytes.buffer);
      const HP='http://www.hancom.co.kr/hwpml/2011/paragraph',dec=new TextDecoder();
      const hdoc=new DOMParser().parseFromString(dec.decode(es.find(e=>e.name==='Contents/header.xml').data),'application/xml');
      const redIds=new Set(Array.from(hdoc.getElementsByTagNameNS('*','charPr')).filter(p=>(p.getAttribute('textColor')||'').toUpperCase()==='#FF0000').map(p=>p.getAttribute('id')));
      const doc=new DOMParser().parseFromString(dec.decode(es.find(e=>e.name==='Contents/section0.xml').data),'application/xml');
      const ps=Array.from(doc.documentElement.children).filter(n=>n.localName==='p');
      const sec=ps.filter(p=>p.textContent.startsWith('[기호'));
      return {lines:sec.map(p=>p.textContent),black:sec.map(p=>!redIds.has(Array.from(p.children).find(n=>n.localName==='run').getAttribute('charPrIDRef'))),
        kiho:ps.some(p=>/^\(\d\) 기호\d : /.test(p.textContent))};});
    console.log(grp.lines.join('\n'));
    assert.deepEqual(grp.lines,[
      '[기호1,2,3 공히] 인접토지 및 인접도로 대비 평탄한 부정형의 토지임. ',
      '[기호1,2,3 공히] 전으로 이용중임.']);
    assert(grp.black.every(Boolean),'공히 머리는 검정');assert.equal(grp.kiho,false,'기호별 문단 없음');
    // 일단지 + 한 면만 접함 → ②·"각각" 빠짐(종전 처리와 함께)
    await page.selectOption('#y_roadCnt','1');
    const grp1=await page.evaluate(async()=>{const bytes=await ArapTojiDocuments.buildYohang();const es=await ArapCheonggu.parseZip(bytes.buffer);
      return new TextDecoder().decode(es.find(e=>e.name==='Contents/section0.xml').data).replace(/<[^>]+>/g,'');});
    assert(grp1.includes('본건 남측으로 노폭 약 6m 내외의 아스팔트 포장도로와 접하고 있음.'),'일단지 한 면 = 종전 문장');
    assert(!grp1.includes('공히] 남측')&&!grp1.includes('공히] 본건'),'접면도로에 공히 머리 없음');
    await page.selectOption('#y_roadCnt','2');
    // 사정면적 모드를 탭 이동 없이 바꿔도 요항표 머리가 바로 다시 그려진다(묶기 → 직접)
    await page.evaluate(()=>setSajMode('land','direct'));
    assert.equal(await page.locator('.y-kiho:visible').count(),3,'직접 → 기호별 머리 3곳');
    assert.equal(await page.locator('.y-kiho').first().textContent(),'(1) 기호1 : ');
    // 「일단지」 체크만 켜도(사정면적은 직접) 공히 — 이 앱에서 일단지와 묶기는 따로 켠다
    await page.evaluate(()=>setIldanji(true));
    assert.equal(await page.locator('.y-kiho:visible').count(),2,'일단지 체크 → 공히 머리 2곳');
    assert.equal(await page.locator('.y-kiho').first().textContent(),'[기호1,2,3 공히] ');
    const ild=await page.evaluate(async()=>{const bytes=await ArapTojiDocuments.buildYohang();const es=await ArapCheonggu.parseZip(bytes.buffer);
      return new TextDecoder().decode(es.find(e=>e.name==='Contents/section0.xml').data).replace(/<[^>]+>/g,'');});
    assert(ild.includes('[기호1,2,3 공히] 전으로 이용중임.')&&!ild.includes('(2) 기호2'),'일단지 체크 출력 = 공히');
    // 불러오기·되돌리기 뒤(refreshAfterLoad)에도 머리가 상태를 따라간다
    await page.evaluate(()=>{ILDANJI=false;refreshAfterLoad();});
    assert.equal(await page.locator('.y-kiho').first().textContent(),'(1) 기호1 : ','불러온 뒤 다시 그림');
    await page.evaluate(()=>{SAJ_MODE.land='direct';ILDANJI=false;});
    // 조사 로/으로 — 판단 함수 + 화면 + 출력
    assert.deepEqual(await page.evaluate(()=>['답','대','골','전','건부지','공장','주거용(단독)','3','',null,'다가구주택(1가구)','제1종근린생활시설(소매점)','주거용（단독）','(주택)','다가구주택 (3가구) '].map(josaRo)),
      ['으로','로','로','으로','로','으로','으로',null,null,null,'으로','로','으로','으로','으로']);
    await page.locator('#y_use').fill('공장');
    assert.equal(await page.locator('#y_use + .y-ro').textContent(),'으로','화면 조사 = 으로');
    await page.locator('#y_use').fill('대');
    assert.equal(await page.locator('#y_use + .y-ro').textContent(),'로','화면 조사 = 로');
    await page.locator('#y_road1dir').fill('서');await page.locator('#y_usestate').fill('공장');
    const jo=await page.evaluate(async()=>{const bytes=await ArapTojiDocuments.buildYohang();const es=await ArapCheonggu.parseZip(bytes.buffer);
      return new TextDecoder().decode(es.find(e=>e.name==='Contents/section0.xml').data).replace(/<[^>]+>/g,'');});
    assert(jo.includes('대로 이용중임.'),'대로');assert(jo.includes('(1) 기호1 : 서로 노폭 약 6m'),'방위 받침 없음 → 로');assert(jo.includes('공부상 공장으로 이용 중임.'),'이용상태 공장으로');
    await page.locator('#y_use').fill('전');await page.locator('#y_road1dir').fill('남측');
    // 필지 1개면 종전과 같다(기호 머리 없음)
    await page.evaluate(()=>{LANDS=LANDS.slice(0,1);renderLands();showTab('yohang');});
    assert.equal(await page.locator('.y-kiho:visible').count(),0);assert(await page.locator('#y_roadBon').isVisible());
    const single=await page.evaluate(async()=>{const bytes=await ArapTojiDocuments.buildYohang();const es=await ArapCheonggu.parseZip(bytes.buffer);
      return new TextDecoder().decode(es.find(e=>e.name==='Contents/section0.xml').data).replace(/<[^>]+>/g,'');});
    assert(!single.includes('기호1 :')&&single.includes('본건 남측으로 노폭 약 6m'),'필지 1개 = 종전 문장');
    // 비워 둔 칸의 양식 표시 뒤 조사는 양식 그대로({{…}}으로 / {{…}}로)
    await page.locator('#y_road1dir').fill('');await page.locator('#y_use').fill('');
    const blank=await page.evaluate(async()=>{const bytes=await ArapTojiDocuments.buildYohang();const es=await ArapCheonggu.parseZip(bytes.buffer);
      return new TextDecoder().decode(es.find(e=>e.name==='Contents/section0.xml').data).replace(/<[^>]+>/g,'');});
    assert(blank.includes('본건 {{요항_도로1방위}}으로 노폭'),'빈 방위 칸 뒤 = 으로(양식)');
    assert(blank.includes('{{요항_이용상황}}로 이용중임.'),'빈 이용상황 칸 뒤 = 로(양식)');
    assert.equal(await page.locator('#y_use + .y-ro').textContent(),'로','화면도 양식 조사');
    assert.deepEqual(errors,[]);
    console.log('PASS',file);
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
