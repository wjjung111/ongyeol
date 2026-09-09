// 괄감(감정평가표) 건물 칸 회귀 검증 — 새로고침 직후 건물 탭을 열지 않고 문서를 뽑아도 건물 면적·단가·금액이 채워져야 한다.
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_gwalho.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),http=require('http');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.env.GWALHO_TEST_OUTPUT||path.join(root,'..','gwalho-test'));
fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
  const name=decodeURIComponent(req.url.split('?')[0]);
  const file=path.join(root,name);if(!file.startsWith(root)||!fs.existsSync(file)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript':'application/octet-stream');fs.createReadStream(file).pipe(res);
});
// 토지 1필지 + 건물 2개 층(재조달원가 입력 완료)까지 채우고 저장까지 마친다.
async function fixture(page){return page.evaluate(()=>{
  const set=(k,v)=>{const el=document.getElementById(k);if(el)el.value=String(v);};
  LANDS=[{소재지:'검증동',지번:'10-1',지목:'대',면적:'271.3',용도지역:'일반상업',공시지가:'800000',도로교통:'광대한면',형상:'정방형',지세:'평지',stdIdx:0,gf:[1,1,1,1,1,1],gaf:[1,1,1,1,1,1]}];
  STDS=[{소재지:'표준동',지번:'20-1',지목:'대',면적:'150',공시지가:'1000000',용도지역:'일반상업',etcDecide:'2'}];
  TRADES=[];APPRS=[];ETC={type:'t',idx:0};GA={idx:0};
  renderStds();renderLands();
  for(const [k,v] of Object.entries({ov_client:'검증 의뢰인',ov_caseNo:'GWAL-TEST',base_gijun:'2026.01.01',base_gongsi:'2026.01.01',base_josa:'2026.01.02',
    bt_useApr:'2018.01.01',bt_strct:'철근콘크리트',bt_purps:'근린생활시설',bt_flrs:'지상 2층',jb_factor:'1',eTime:'1',eArea:'1',eSaj1:'1',eSaj2:'1',eArea2:'1',eInd2:'1'}))set(k,v);
  for(let i=1;i<=6;i++)set('e_f'+i,1);
  const rows=[{'구분':'주','층구분':'지상','층별':'1층','구조':'철근콘크리트','용도':'점포','연면적':'100'},
              {'구분':'주','층구분':'지상','층별':'2층','구조':'철근콘크리트','용도':'점포','연면적':'100'}];
  document.getElementById('bldBody').innerHTML='';rows.forEach(r=>addBldRow(r));
  window.BLD_STATE={};rows.forEach((r,i)=>window.BLD_STATE[i]={reCost:'1500000',life:'50'});
  calcGongsi();renderBldCalc();calcFinal();
  doSave();
  return {land:LAND_FINAL,bld:BLD_RESULT.total,size:BLD_RESULT.size};
});}
// 새로고침 직후(건물 탭 미방문) 괄감 토큰맵
async function gwalAfterReload(page,url){
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof gwalMap==='function');
  return page.evaluate(()=>gwalMap());
}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE||undefined});
  try{
    const context=await browser.newContext({acceptDownloads:true}),page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('dialog',d=>d.accept());
    await context.route('**/*',route=>{const u=route.request().url();if(u.includes('arap_access.js'))return route.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return route.continue();return route.abort();});
    await page.goto(base+'/토지건물.html',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.ArapTojiOpinion);
    const calc=await fixture(page);
    assert.equal(calc.size,200);assert(calc.bld>0);

    // 1) 고친 화면: 새로고침 뒤 바로 괄감을 뽑아도 건물 칸이 채워진다.
    const fixed=await gwalAfterReload(page,base+'/토지건물.html');
    assert.equal(fixed['괄_건물_공부면적'],'200');
    assert.equal(fixed['괄_건물_사정면적'],'200');
    assert.notEqual(fixed['괄_건물_단가'],'-');
    assert.notEqual(fixed['괄_건물_금액'],'-');
    assert.equal(fixed['괄_건물_금액'],calc.bld.toLocaleString('ko-KR'));

    // 2) 켤 때 건물 원가법이 계산돼 있어야 한다(= 예전 증상의 원인이 재발하지 않는지)
    const booted=await page.evaluate(()=>window.BLD_RESULT&&window.BLD_RESULT.total);
    assert.equal(booted,calc.bld);

    // 3) 실제 다운로드 + 토큰 전량 치환 확인
    await page.evaluate(()=>showTab('final'));   // '문서 생성' 칸은 토지건물 시산가액 탭에 있다
    const dl=page.waitForEvent('download');await page.locator('button[onclick="downloadGwal()"]').click();
    const file=path.join(out,'gwalho.hwpx');await (await dl).saveAs(file);
    const text=await page.evaluate(async bytes=>{
      const entries=await ArapCheonggu.parseZip(Uint8Array.from(bytes).buffer);
      let all='';
      for(const e of entries.filter(e=>/^Contents\/section\d+\.xml$/.test(e.name))){
        const xml=new TextDecoder().decode(e.data);
        if(/\{\{[^}]+\}\}/.test(xml))throw Error('미치환 토큰');
        all+=new DOMParser().parseFromString(xml,'application/xml').documentElement.textContent+'\n';
      }
      return all;
    },Array.from(fs.readFileSync(file)));
    assert(text.includes(calc.bld.toLocaleString('ko-KR')),'건물 금액');
    assert(text.includes((calc.land+calc.bld).toLocaleString('ko-KR')),'감정평가액 합계');
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({status:'PASS',calc,fixed,booted,output:out},null,2));
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
