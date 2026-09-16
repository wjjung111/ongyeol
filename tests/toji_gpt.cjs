// Run with PLAYWRIGHT_MODULE pointing to playwright; uses an isolated local browser profile.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),http=require('http'),cp=require('child_process');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.env.GPT_TEST_OUTPUT||path.join(root,'..','gpt-test'));
fs.mkdirSync(out,{recursive:true});
// Pin the source snapshot so concurrent changes to the original UI do not redefine the regression baseline.
const baseline=cp.execFileSync('git',['show','dc6de4ded3ce1f614b2a5c9ebea451e6d1316fcb:토지건물.html'],{cwd:root,encoding:'utf8'});
const server=http.createServer((req,res)=>{
  if(req.url==='/baseline.html'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(baseline);}
  const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',/\.html$/i.test(file)?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript':'application/octet-stream');
  fs.createReadStream(file).pipe(res);
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

async function originalStorage(page){return page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('tojigeonmul-')&&!k.startsWith('tojigeonmul-gpt-'))));}
async function download(page,selector,label){
  const pending=page.waitForEvent('download',{timeout:20000});await page.locator(selector).click();const d=await pending;
  const file=path.join(out,label+path.extname(d.suggestedFilename()));await d.saveAs(file);
  const bytes=Array.from(fs.readFileSync(file));assert(bytes.length>1000,label+' generated');
  return page.evaluate(async bytes=>{
    const entries=await ArapCheonggu.parseZip(Uint8Array.from(bytes).buffer),xml={};
    for(const e of entries.filter(e=>/\.xml$/.test(e.name))){
      const s=new TextDecoder().decode(e.data),doc=new DOMParser().parseFromString(s,'application/xml');
      if(doc.querySelector('parsererror'))throw Error('Invalid XML '+e.name);
      xml[e.name]=s;
    }
    return xml;
  },bytes);
}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
 try{
  const context=await browser.newContext({acceptDownloads:true,viewport:{width:1600,height:1000}}),errors=[];
  context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
  // Only the LOCAL fixture bypasses the access overlay. Production code is unchanged.
  await context.route('**/*',route=>{
    const u=route.request().url();if(u===base+'/arap_access.js')return route.fulfill({body:'',contentType:'text/javascript'});
    return u.startsWith(base)?route.continue():route.abort();
  });
  const original=await context.newPage();await original.goto(base+'/baseline.html');
  await fixture(original,true);await original.evaluate(()=>{doSave();setMemos([{text:'원본 메모 보존',time:'test'}]);});
  const before=await originalStorage(original);
  const page=await context.newPage();await page.goto(base+'/토지건물_GPT.HTML');
  assert.equal(await page.locator('#ov_caseNo').inputValue(),'CODEX-TEST','first-run copy');
  assert.equal(await page.evaluate(()=>getMemos()[0].text),'원본 메모 보존');
  assert.deepEqual(await originalStorage(page),before,'original data unchanged on opening GPT');
  assert.equal(await page.locator('.gpt-main-tabs>button').count(),8);
  assert.equal(await page.locator('#conflictBar').isVisible(),false,'empty conflict banner hidden');
  assert.equal(await page.locator('.gpt-land-tabs>button').count(),3);
  // Existing field IDs survive, and duplicated IDs cannot silently bind the wrong controls.
  const oldIds=await original.locator('[id]').evaluateAll(es=>es.map(e=>e.id));
  const newIds=await page.locator('[id]').evaluateAll(es=>es.map(e=>e.id));
  assert.equal(new Set(newIds).size,newIds.length,'unique IDs');
  oldIds.forEach(id=>assert(newIds.includes(id),'preserved '+id));
  for(const multi of [false,true])assert.deepEqual(await fixture(page,multi),await fixture(original,multi),'calculation parity');
  await page.evaluate(()=>{window.gptMapOpened=0;window.mapOpen=()=>window.gptMapOpened++;});
  for(const [button,panel] of [['land','gongsi'],['georae','georae'],['gyeoljeong','gyeoljeong'],['bld','bld'],['land','gyeoljeong'],['gongsi','gongsi'],['final','final'],['jido','jido'],['yohang','yohang'],['download','download'],['cheonggu','cheonggu'],['daesang','daesang']]){
    await page.locator('#tabbtn-'+button).click();
    assert.equal(await page.locator('.tab.active').count(),1,'single visible panel');
    assert.equal(await page.locator('.tab.active').getAttribute('id'),'tab-'+panel);
    assert.equal(await page.locator('.gpt-main-tabs>button.active').count(),1,'one primary selection');
    assert.equal(await page.locator('#gpt-land-tabs').isVisible(),['gongsi','georae','gyeoljeong'].includes(panel));
  }
  assert.equal(await page.evaluate(()=>gptMapOpened),1,'map activation retained');
  await page.locator('#btnHwpx').click();assert(await page.locator('#tab-download').isVisible());
  // Compare actual document outputs from old and GPT buttons, including moved fields.
  await fixture(page,true);await fixture(original,true);
  await page.evaluate(()=>showTab('yohang'));await original.evaluate(()=>showTab('yohang'));
  await page.evaluate(()=>showTab('download'));await original.evaluate(()=>showTab('final'));
  const files=[];
  for(const [selector,label] of [['button[onclick="downloadPyoji()"]','cover'],['button[onclick="downloadGwal()"]','valuation'],['#btnOpinion','opinion'],['#btnMyeongse','statement'],['#btnYohang','yohang']]){
    const gpt=await download(page,selector,'gpt-'+label),old=await download(original,selector,'original-'+label);
    assert.deepEqual(gpt,old,label+' XML parity');files.push(label);
  }
  for(const p of [page,original])await p.evaluate(()=>{
    document.getElementById('cg_feeText').value='하한 수수료 1,000,000\n기준 수수료 1,200,000\n상한 수수료 1,400,000';
    showTab('cheonggu');
  });
  assert.deepEqual(await download(page,'#btnCheonggu','gpt-invoice'),await download(original,'#btnCheonggu','original-invoice'),'invoice XML parity');
  const sourceSnapshot=await originalStorage(original);
  await page.evaluate(()=>{document.getElementById('ov_client').value='GPT 독립 수정';doSave();setMemos([{text:'GPT 메모',time:'test'}]);});
  await page.reload();assert.equal(await page.locator('#ov_client').inputValue(),'GPT 독립 수정');
  assert.equal(await page.evaluate(()=>getMemos()[0].text),'GPT 메모');
  assert.deepEqual(await originalStorage(page),sourceSnapshot,'save and reload cannot change source');
  await original.evaluate(()=>{document.getElementById('ov_client').value='원본 별도 수정';doSave();});
  await page.reload();assert.equal(await page.locator('#ov_client').inputValue(),'GPT 독립 수정','migration runs once');
  const sourceAfterEdit=await originalStorage(original);
  page.on('dialog',d=>d.accept());await page.getByRole('button',{name:'+ 새 평가서',exact:true}).click();
  assert.equal(await page.locator('#ov_caseNo').inputValue(),'');
  await page.evaluate(()=>loadCase('CODEX-TEST'));
  assert.equal(await page.locator('#ov_client').inputValue(),'GPT 독립 수정','case reopen');
  assert.deepEqual(await originalStorage(page),sourceAfterEdit,'new/reopen isolated');
  for(const width of [1366,1920]){
    await page.setViewportSize({width,height:1000});await page.locator('#tabbtn-land').click();
    assert(await page.locator('#tabbtn-gongsi').isVisible());
    await page.screenshot({path:path.join(out,'tabs-'+width+'.png'),fullPage:true});
  }
  await page.locator('#tabbtn-download').click();await page.screenshot({path:path.join(out,'downloads.png'),fullPage:true});
  assert.deepEqual(errors,[],'no uncaught browser errors');
  console.log(JSON.stringify({status:'PASS',checks:['8 primary and 3 land menus','all navigation and map activation','all existing IDs preserved','simple and multi-parcel calculation parity','6 actual downloads with exact original XML parity','first-run copy and isolated case/memo saves','reload and new/reopen cases','1366/1920 layouts','no runtime errors'],downloads:files.concat('invoice'),output:out},null,2));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
