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
      '(1) 기호1 : 전로 이용중임.',
      '(2) 기호2 : 답로 이용중임.',
      '(3) 기호3 : {{요항_이용상황}}로 이용중임.',
      '(1) 기호1 : 남측으로 노폭 약 6m, 서측으로 노폭 약 4m 내외의 아스팔트 포장도로와 각각 접하고 있음.',
      '(2) 기호2 : 북측으로 노폭 약 3m 내외의 아스팔트 포장도로와 접하고 있음.',
      '(3) 기호3 : {{요항_도로1방위}}으로 노폭 약 {{요항_도로1노폭}}m, {{요항_도로2방위}}으로 노폭 약 {{요항_도로2노폭}}m 내외의 아스팔트 포장도로와 각각 접하고 있음.']);
    assert(res.firstRunBlack.every(Boolean),'기호 머리는 검정');
    assert.deepEqual(res.redVals[1],['완경사','세장형'],'값은 빨강');
    assert.equal(res.hashLeft,false);
    // 필지 1개면 종전과 같다(기호 머리 없음)
    await page.evaluate(()=>{LANDS=LANDS.slice(0,1);renderLands();showTab('yohang');});
    assert.equal(await page.locator('.y-kiho:visible').count(),0);assert(await page.locator('#y_roadBon').isVisible());
    const single=await page.evaluate(async()=>{const bytes=await ArapTojiDocuments.buildYohang();const es=await ArapCheonggu.parseZip(bytes.buffer);
      return new TextDecoder().decode(es.find(e=>e.name==='Contents/section0.xml').data).replace(/<[^>]+>/g,'');});
    assert(!single.includes('기호1 :')&&single.includes('본건 남측으로 노폭 약 6m'),'필지 1개 = 종전 문장');
    assert.deepEqual(errors,[]);
    console.log('PASS',file);
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
