// Codex: 실제 브라우저 다운로드 + 계산 회귀 + HWPX 표 구조 검증.
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_opinion.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),http=require('http'),cp=require('child_process');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.env.OPINION_TEST_OUTPUT||path.join(root,'..','opinion-test'));
fs.mkdirSync(out,{recursive:true});
const baseline=cp.execFileSync('git',['show','HEAD:토지건물.html'],{cwd:root,encoding:'utf8'});
const server=http.createServer((req,res)=>{
  const name=decodeURIComponent(req.url.split('?')[0]);
  if(name==='/baseline.html'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(baseline);}
  const file=path.join(root,name);if(!file.startsWith(root)||!fs.existsSync(file)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript':'application/octet-stream');fs.createReadStream(file).pipe(res);
});
async function fixture(page,multi=false){return page.evaluate((multi)=>{
  const set=(k,v)=>document.getElementById(k).value=String(v);
  LANDS=[{소재지:'검증동',지번:'10-1',지목:'대',면적:'100',용도지역:'일반상업',공시지가:'800000',도로교통:'광대한면',형상:'정방형',지세:'평지',stdIdx:0,gf:[1,1,1,1,1,1],gaf:[1,1,1,0.95,1.05,1]}];
  STDS=[{소재지:'표준동',지번:'20-1',지목:'대',면적:'150',공시지가:'1000000',용도지역:'일반상업',etcDecide:'2'}];
  TRADES=Array.from({length:multi?4:3},(_,i)=>({loc:'거래동 '+(30+i)+'-1',use:'일반상업',jimok:'대',landA:'100',bldA:'0',total:'200000000',date:'2025.01.01',landUnit:'2000000'}));
  APPRS=Array.from({length:multi?4:1},(_,i)=>({no:String.fromCharCode(97+i),loc:'평가동 '+(40+i)+'-1',use:'일반상업',jimok:'대',cond:'상업용',unit:'2100000',base:'2025.02.01',purp:'시가참고'}));
  ETC={type:'t',idx:0};GA={idx:multi?3:0};
  if(multi){LANDS.push({...LANDS[0],소재지:'두번째동',지번:'11-2',면적:'75.5',stdIdx:1,apply:'3333000',gaApply:'3555000'});
    STDS.push({...STDS[0],소재지:'다른표준동',지번:'21-2',공시지가:'1200000',etcDecide:'2.5'});}
  renderStds();renderLands();
  for(const [k,v] of Object.entries({ov_client:'Codex 검증 & <의뢰인>',ov_caseNo:'CODEX-TEST',base_gijun:'2026.01.01',base_gongsi:'2026.01.01',base_josa:'2026.01.02',bt_useApr:'2018.01.01',bt_strct:'철근콘크리트',bt_purps:'근린생활시설',bt_flrs:'지상 2층',jb_factor:'1.02',jb_region:'검증시 검증구',jb_use:'상업',eTime:'1.02',eArea:'1',eSaj1:'1',eSaj2:'1',eArea2:'1',eInd2:'1',ga_time:'1.03',ga_area:'1',ga_sajeong:'1',g_opinion:'공시 의견 & 특수문자 <검증>',ga_opinion:'거래 비교 의견',e_opinion:'표준지 비교 의견',fn_opinion:'Codex 결정의견: 화면에서 입력한 문구.'}))set(k,v);
  for(let i=1;i<=6;i++)set('e_f'+i,1);
  if(document.getElementById('op_location')){set('op_location','검증초등학교 북측');set('op_costSource','검증용 단가표, 2026년');set('op_costRows','검증분류\t점포\t철근콘크리트\t3\t1,500,000\t50\t(45~55)');}
  const rows=Array.from({length:multi?7:1},(_,i)=>({'동':multi&&i>3?'나':'가','구분':'주','층구분':'지상','층별':(i+1)+'층','구조':'철근콘크리트','용도':'점포','연면적':multi?'100':'200'}));
  document.getElementById('bldBody').innerHTML='';
  rows.forEach(r=>addBldRow(r));
  window.BLD_STATE={};rows.forEach((r,i)=>window.BLD_STATE[i]={reCost:'1500000',life:'50'});
  calcGongsi();renderBldCalc();calcFinal();
  return {land:LAND_FINAL,gongsi:GONGSI_RESULT.total,georae:GEORAE_RESULT.total,bld:BLD_RESULT.total};
},multi);}
async function validate(page,bytes,label){return page.evaluate(async ({bytes,label})=>{
  const entries=await ArapCheonggu.parseZip(Uint8Array.from(bytes).buffer),sections=entries.filter(e=>/^Contents\/section\d+\.xml$/.test(e.name));
  const texts=[],sizes=[];
  for(const e of sections){const xml=new TextDecoder().decode(e.data),doc=new DOMParser().parseFromString(xml,'application/xml');
    if(doc.querySelector('parsererror'))throw Error('Invalid XML '+label);
    if(/\{\{[^}]+\}\}/.test(xml))throw Error('Unfilled token '+label);
    if(/fieldBegin[^>]*type="FORMULA"/.test(xml))throw Error('FORMULA '+label);
    for(const table of doc.getElementsByTagNameNS('http://www.hancom.co.kr/hwpml/2011/paragraph','tbl')){
      const rows=Array.from(table.children).filter(n=>n.localName==='tr'),count=Number(table.getAttribute('rowCnt')),cols=Number(table.getAttribute('colCnt')),occupied=new Set();
      if(count!==rows.length)throw Error('rowCnt mismatch');
      rows.forEach((row,i)=>Array.from(row.children).filter(n=>n.localName==='tc').forEach(cell=>{
        const addr=Array.from(cell.children).find(n=>n.localName==='cellAddr'),span=Array.from(cell.children).find(n=>n.localName==='cellSpan');
        const r=Number(addr.getAttribute('rowAddr')),c=Number(addr.getAttribute('colAddr')),rs=Number(span.getAttribute('rowSpan')),cs=Number(span.getAttribute('colSpan'));
        if(r!==i||r+rs>count||c+cs>cols)throw Error('Cell bounds');
        for(let y=r;y<r+rs;y++)for(let x=c;x<c+cs;x++){const key=y+','+x;if(occupied.has(key))throw Error('Overlapping cell');occupied.add(key);}
      }));
      if(occupied.size!==count*cols)throw Error('Missing cells');sizes.push([count,cols]);
    }
    texts.push(doc.documentElement.textContent);
  }
  return {text:texts.join('\n'),sizes,first:entries[0].name};
},{bytes:Array.from(bytes),label});}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
  try{
    const context=await browser.newContext({acceptDownloads:true}),page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await context.route('**/*',route=>{const u=route.request().url();if(u.includes('arap_access.js'))return route.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return route.continue();return route.abort();});
    await page.goto(base+'/토지건물.html',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.ArapTojiOpinion);
    const simple=await fixture(page);
    assert.equal(simple.gongsi,204000000);assert.equal(simple.georae,205400000);assert.equal(simple.bld,252000000);
    await page.evaluate(()=>showTab('final'));
    const downloadPromise=page.waitForEvent('download');await page.locator('#btnOpinion').click();const download=await downloadPromise;
    await download.saveAs(path.join(out,'simple.hwpx'));
    const one=await validate(page,fs.readFileSync(path.join(out,'simple.hwpx')),'simple');
    assert.equal(one.first,'mimetype');assert(one.text.includes('456,000,000'));assert(one.text.includes('공시 의견 & 특수문자 <검증>'));assert(one.text.includes('Codex 결정의견: 화면에서 입력한 문구.'));
    assert(!one.text.includes('신사동'));assert(!one.text.includes('한국부동산원, 2025년'));assert(one.text.includes('검증분류'));assert(!one.text.includes('[기입]'));
    const oldPage=await context.newPage();await oldPage.goto(base+'/baseline.html',{waitUntil:'domcontentloaded'});const oldSimple=await fixture(oldPage);assert.deepEqual(simple,oldSimple);
    const multi=await fixture(page,true),oldMulti=await fixture(oldPage,true);assert.deepEqual(multi,oldMulti);
    const multiBytes=await page.evaluate(async()=>Array.from(await ArapTojiOpinion.build(await fetchTplB64('템플릿/토건 의견서(산출근거) 템플릿.hwpx'),ArapTojiOpinion.data())));
    fs.writeFileSync(path.join(out,'multi.hwpx'),Buffer.from(multiBytes));const many=await validate(page,multiBytes,'multi');
    for(const marker of ['두번째동','다른표준동','거래사례#4','거래동 33-1','평가동','43-1','7층','3,333,000','3,555,000'])assert(many.text.includes(marker),marker);
    assert.equal(many.sizes.filter(s=>s[0]===17&&s[1]===4).length,4);
    assert(many.sizes.some(s=>s[0]===8&&s[1]===6));assert(many.sizes.some(s=>s[0]===6&&s[1]===7));
    // 수동 수정값과 평가사례 채택을 문서에 반영한다.
    await page.evaluate(()=>{ETC={type:'a',idx:3};STDS[0].etcOvr={src:'2345678',std:'1234567',stdTime:'1.07',out1:'7654321',out2:'3456789',ind:'1.123',ratio:'2.22'};document.getElementById('eSaj2').value='1.1';document.getElementById('eArea2').value='1.2';calcGongsi();});
    const over=await page.evaluate(async()=>Array.from(await ArapTojiOpinion.build(await fetchTplB64('템플릿/토건 의견서(산출근거) 템플릿.hwpx'),ArapTojiOpinion.data())));
    const ov=await validate(page,over,'override');for(const marker of ['2,345,678','1,234,567','7,654,321','3,456,789','1.123','2.22','1.100','1.200','평가사례 d'])assert(ov.text.includes(marker),marker);
    // 선택 항목 미입력과 알 수 없는 토큰도 확인한다.
    await page.evaluate(()=>{document.getElementById('op_location').value='';document.getElementById('op_costRows').value='';APPRS=[];document.getElementById('bldBody').innerHTML='';renderBldCalc();});
    const blank=await page.evaluate(async()=>Array.from(await ArapTojiOpinion.build(await fetchTplB64('템플릿/토건 의견서(산출근거) 템플릿.hwpx'),ArapTojiOpinion.data())));
    const empty=await validate(page,blank,'blank');assert(empty.text.includes('[기입]'));
    await page.evaluate(()=>{let failed=false;try{ArapTojiOpinion.xml('<hp:sec xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph"><hp:p><hp:run><hp:t>{{알수없는토큰}}</hp:t></hp:run></hp:p></hp:sec>',ArapTojiOpinion.data());}catch(e){failed=/알수없는토큰/.test(e.message);}if(!failed)throw Error('Unknown token must fail');});
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({status:'PASS',simple,multi,tests:['actual download','baseline calculation parity','multiple parcels/standards/floors/appraisals/trades','manual overrides','empty optional inputs','XML grid/token integrity','unknown token failure'],output:out},null,2));
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
