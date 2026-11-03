// 토건 공부서류·접수 캡처 업로드 → 자동 인식 (2026-11-03)
// ① 순수 함수(normalize·planParcels) ② 화면: Anthropic API·토지 조회를 가짜로 바꿔 끝까지 채워지는지
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_upload.cjs
const assert=require('assert/strict'),path=require('path'),fs=require('fs'),http=require('http');
const U=require('../arap_toji_upload.js');
// ── ① 순수 함수
{
  assert.deepEqual(U.splitAddr('경기도 안양시 동안구 관양동 1443-5'),{dong:'관양동',jibun:'1443-5'});
  assert.deepEqual(U.splitAddr('강원특별자치도 홍천군 서면 팔봉리 산 12-3'),{dong:'팔봉리',jibun:'산12-3'});
  assert.equal(U.orderDayFromCaseNo('HI260305-2601'),'2026/03/05');
  const n=U.normalize({caseNo:'HI261103-1001',client:'홍길동',baseDate:'2026-09-25',evalCategory:'특수관계자간 매매',
    feeDownPayment:'1000000',feeSpecial:0,feeBasis:'하한요율',ownerLand:'김철수, 이영희',ownerBld:'김철수',ownerShares:'김철수 2분의 1, 이영희 2분의 1',
    landParcels:[{addr:'경기도 안양시 동안구 관양동 1443-5',jimok:'대',area:'330.5'},{addr:'경기도 안양시 동안구 관양동 1443-5',jimok:'대',area:'330.5'}],
    bldSiteAddrs:['경기도 안양시 동안구 관양동 1443-5'],roadAddr:'[도로명주소] 경기도 안양시 동안구 관악대로 1',bldRegText:'철근콘크리트구조\\n1층 100.5㎡'});
  assert.equal(n.ov.ov_orderDay,'2026/11/03');assert.equal(n.ov.base_gijun,'2026.09.25');
  assert.equal(n.ov.ov_kind,undefined,'상속·증여가 아니면 평가구분 비움');
  assert.equal(n.ov.ov_owner,'김철수, 이영희');
  assert.equal(n.cg.cg_downPayment,'1,000,000');assert.equal(n.cg.cg_special,'0');assert.equal(n.cg.cg_feeBasis,'하한');
  assert.equal(n.parcels.length,1,'같은 필지 중복 제거');
  assert.equal(n.bt.bt_roadAddr,'경기도 안양시 동안구 관악대로 1');assert.equal(n.bt.bt_regText,'철근콘크리트구조\n1층 100.5㎡');
  assert.ok(n.notes.some(t=>/소유자/.test(t))&&n.notes.some(t=>/지분/.test(t)));
  // 건물등기만 있으면 소재지번으로 필지
  assert.equal(U.normalize({bldSiteAddrs:['서울특별시 강남구 압구정동 1-2','서울특별시 강남구 압구정동 1-3']}).parcels.length,2);
  const P=[{dong:'관양동',jibun:'1443-5'},{dong:'관양동',jibun:'1443-6'}];
  assert.equal(U.planParcels([{}],P).mode,'add');
  assert.equal(U.planParcels([{'소재지':'관양동','지번':'1443-5'}],P).add.length,1);
  assert.equal(U.planParcels([{'소재지':'압구정동','지번':'1'}],P).mode,'replace');
  console.log('순수 함수 OK');
}
// ── ② 화면
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8');fs.createReadStream(f).pipe(res);});
const AI={caseNo:'HI261103-1001',client:'홍길동',baseDate:'2026.09.25',evalCategory:'상속',feeDownPayment:'1000000',feeSpecial:'0',feeBasis:'하한',
  ownerLand:'홍길순',ownerBld:'홍길순',landParcels:[{addr:'경기도 안양시 동안구 관양동 1443-5',jimok:'대',area:'330.6'},{addr:'경기도 안양시 동안구 관양동 1443-6',jimok:'대',area:'50'}],
  roadAddr:'경기도 안양시 동안구 관악대로 1',bldRegText:'철근콘크리트구조\n(철근)콘크리트지붕 3층\n근린생활시설\n1층 100.5㎡\n2층 100.5㎡'};
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true});
  try{
    const ctx=await browser.newContext(),page=await ctx.newPage(),errors=[],sent=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());page.setDefaultTimeout(60000);
    await ctx.route('**/*',r=>{const u=r.request().url();
      if(u.startsWith('https://api.anthropic.com/')){sent.push(JSON.parse(r.request().postData()));return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:[{type:'text',text:'```json\n'+JSON.stringify(AI)+'\n```'}]})});}
      if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});return u.startsWith(base)?r.continue():r.abort();});
    await ctx.addInitScript(()=>{localStorage.setItem('arap-user-name','wdw');localStorage.setItem('v2:appraisal-api-key','sk-ant-test');});
    await page.goto(base+'/'+encodeURI('토지건물.html'),{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.ArapTojiUpload&&typeof doSave==='function');
    assert.equal(await page.$eval('#up_apiKey',e=>e.value),'sk-ant-test','집건 API 키 공용');
    // 토지 조회(브이월드)는 가짜로 — 1443-6은 조회 실패 → 등기 지목·면적만
    await page.evaluate(()=>{window.queryParcel=function(q){if(/1443-6/.test(q))return Promise.reject(new Error('없음'));
      return Promise.resolve({pnu:'4117310400114430005',addr:q,char:{ldCodeNm:'경기도 안양시 동안구 관양동',mnnmSlno:'1443-5',lndcgrCodeNm:'대',lndpclAr:'330.5',prposArea1Nm:'제2종일반주거지역',ladUseSittnNm:'상업용',roadSideCodeNm:'중로한면',tpgrphFrmCodeNm:'가로장방',tpgrphHgCodeNm:'평지',pblntfPclnd:'5000000'}});};
      window.fetchBuilding=function(){window.__fetchedBld=true;};});
    await page.setInputFiles('#up_files',[{name:'토지등기.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 test')},{name:'접수.png',mimeType:'image/png',buffer:Buffer.from('89504e47','hex')}]);
    assert.equal(await page.locator('#up_list span.del').count(),2);
    await page.click('#up_run');
    await page.waitForFunction(()=>/인식 완료|인식 실패/.test(document.getElementById('up_status').textContent));
    assert.match(await page.textContent('#up_status'),/인식 완료/);
    const c=sent[0].messages[0].content;assert.equal(c[0].type,'document');assert.equal(c[1].type,'image');
    const v=id=>page.$eval('#'+id,e=>e.value);
    assert.equal(await v('ov_caseNo'),'HI261103-1001');assert.equal(await v('ov_client'),'홍길동');assert.equal(await v('ov_orderDay'),'2026/11/03');
    assert.equal(await v('base_gijun'),'2026.09.25');assert.equal(await v('ov_kind'),'상속');assert.equal(await v('ov_owner'),'홍길순');
    assert.equal(await v('cg_downPayment'),'1,000,000');assert.equal(await v('cg_feeBasis'),'하한');
    assert.match(await v('bt_regText'),/2층 100.5㎡/);assert.equal(await v('bt_roadAddr'),'경기도 안양시 동안구 관악대로 1');
    assert.ok(await page.$eval('#ov_client',e=>e.classList.contains('up-auto')),'자동 칸 연노랑');
    const lands=await page.evaluate(()=>LANDS.map(L=>[L['소재지'],L['지번'],L['면적'],L['공시지가']||'']));
    assert.deepEqual(lands,[['관양동','1443-5','330.5','5,000,000'],['관양동','1443-6','50','']]);
    const res=await page.textContent('#up_result');assert.match(res,/토지대장\(조회\) 330.5㎡ ↔ 등기 330.6㎡/);assert.match(res,/조회 실패: 관양동 1443-6/);
    assert.ok(await page.evaluate(()=>window.__fetchedBld),'건물 표가 비면 건축물대장 자동 불러오기');
    // 두 번째 인식: 같은 필지면 추가 안 함
    await page.click('#up_run');await page.waitForFunction(()=>!document.getElementById('up_run').disabled&&/인식 완료/.test(document.getElementById('up_status').textContent));
    assert.equal(await page.evaluate(()=>LANDS.length),2,'같은 필지 다시 넣지 않음');
    // 손으로 고치면 연노랑 해제
    await page.fill('#ov_client','김');assert.ok(!(await page.$eval('#ov_client',e=>e.classList.contains('up-auto'))));
    assert.deepEqual(errors,[]);await ctx.close();console.log('화면 OK');
    console.log('PASS');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
