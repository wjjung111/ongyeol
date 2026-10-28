// 토지건물 명세표 — 건물등기 건물내역(bt_regText)을 붙여넣으면 건물란이 등기대로(구조·용도·층 표시·순서·공부면적)
// 같은 층이 대장에서 용도별 두 줄이어도 한 줄로 합친다. 비우면 종전(건축물대장 목록) 그대로.
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_myeongse_reg.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.env.MYEONGSE_TEST_OUTPUT||path.join(root,'..','myeongse-test'));
fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true});
  try{
    const ctx=await browser.newContext({acceptDownloads:true}),page=await ctx.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await ctx.route('**/*',r=>{const u=r.request().url();if((u.includes('arap_access.js')||u.includes('arap_user.js')))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
    await page.goto(base+'/토지건물.html',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.ArapTojiDocuments);
    await page.evaluate(()=>{
      const set=(k,v)=>{const el=document.getElementById(k);if(el)el.value=String(v);};
      LANDS=[{소재지:'신사동',지번:'607-6',지목:'대',면적:'167',용도지역:'2종일주',공시지가:'800000',비고:'-',fullAddr:'서울특별시 강남구 신사동 607-6',stdIdx:0,gf:[1,1,1,1,1,1],gaf:[1,1,1,1,1,1]}];
      STDS=[{소재지:'표준동',지번:'20-1',지목:'대',면적:'150',공시지가:'1000000',용도지역:'2종일주',etcDecide:'1'}];
      TRADES=[];APPRS=[];ETC={type:'t',idx:0};GA={idx:0};
      for(const [k,v] of Object.entries({base_gijun:'2026.01.01',base_gongsi:'2026.01.01',bt_useApr:'2007.01.01',bt_strct:'철근콘크리트구조',bt_purps:'제2종근린생활시설',bt_flrs:'4/1',bt_roadAddr:'서울특별시 강남구 압구정로 165',ov_client:'명세검증',jb_factor:'1',eTime:'1',eArea:'1',eSaj1:'1',eSaj2:'1',eArea2:'1',eInd2:'1'}))set(k,v);
      for(let i=1;i<=6;i++)set('e_f'+i,1);
      renderStds();renderLands();
      document.getElementById('bldBody').innerHTML='';
      [['지하','지1층','일반음식점','294.39'],['지상','1층','소매점','148.26'],['지상','2층','학원','234.79'],['지상','3층','학원','157.83'],['지상','3층','사무소','76.96'],['지상','4층','의원','204.81'],['옥탑','옥탑1층','기계실','28.35']].forEach(r=>addBldRow({'층구분':r[0],'층별':r[1],'용도':r[2],'연면적':r[3]}));
      window.BLD_STATE={0:{reCost:'1000000',life:'50'},1:{reCost:'1500000',life:'50'},2:{reCost:'1500000',life:'50'},3:{reCost:'1500000',life:'50'},4:{reCost:'1500000',life:'50'},5:{reCost:'1500000',life:'50'},6:{reCost:'800000',life:'50'}};
      calcGongsi();renderBldCalc();calcFinal();
    });
    const plain=await page.evaluate(()=>ArapTojiDocuments.statementRows());
    assert.equal(plain.length,1+1+7,'등기 칸이 비면 대장 7줄 그대로');
    const reg='철근콘크리트구조\n(철근)콘크리트지붕 4층\n근린생활시설\n1층 148.26㎡\n2층 234.79㎡\n3층 234.79㎡\n4층 204.81㎡\n지1층 294.39㎡\n옥탑1 28.35㎡';
    const rows=await page.evaluate(t=>{document.getElementById('bt_regText').value=t;document.getElementById('bt_regText').dispatchEvent(new Event('input'));return ArapTojiDocuments.statementRows();},reg);
    console.log(JSON.stringify(rows.slice(1).map(r=>[r['명세_지목용도'],r['명세_지역구조'],r['명세_공부면적'],r['명세_사정면적'],r['명세_단가'],r['명세_평가액']])));
    assert.equal(rows.length,1+1+6);
    assert.equal(rows[1]['명세_지목용도'],'근린생활시설');assert.equal(rows[1]['명세_지역구조'],'철근콘크리트구조\n(철근)콘크리트지붕\n4층');
    assert.deepEqual(rows.slice(2).map(r=>r['명세_지역구조']),['1층','2층','3층','4층','지1층','옥탑1']);
    assert(rows.slice(2).every(r=>r['명세_지목용도']===''),'층별 행 용도 칸은 비움(등기처럼)');
    const r3=rows[4];assert.equal(r3['명세_공부면적'],234.79);assert(Math.abs(r3['명세_사정면적']-234.79)<1e-9);
    assert.equal(r3['명세_평가액'],plain[5]['명세_평가액']+plain[6]['명세_평가액'],'3층 두 줄 합침');
    assert.equal(rows[6]['명세_공부면적'],294.39);assert.equal(rows[6]['명세_단가'],plain[2]['명세_단가'],'지1층 = 대장 지하1층');
    const tot=a=>a.reduce((s,r)=>s+(r['명세_평가액']||0),0);assert.equal(tot(rows),tot(plain),'합계 같음');
    const hint=await page.evaluate(()=>document.getElementById('bt_regHint').textContent);console.log(hint);assert(/옥탑1 28.35/.test(hint));
    // 한 줄로 붙여넣어도(PDF 복사) 같은 결과
    const one=await page.evaluate(()=>ArapTojiDocuments.parseRegBld('철근콘크리트구조 (철근)콘크리트지붕 4층 근린생활시설 1층 148.26㎡ 2층 234.79㎡ 지1층 294.39㎡ 옥탑1 28.35㎡'));
    assert.deepEqual(one.struct,['철근콘크리트구조 (철근)콘크리트지붕 4층']);assert.equal(one.use,'근린생활시설');assert.equal(one.floors.length,4);
    // 등기에 없는 층이 대장에 있으면 막는다
    const err=await page.evaluate(()=>{document.getElementById('bt_regText').value='철근콘크리트구조\n근린생활시설\n1층 148.26㎡';try{ArapTojiDocuments.statementRows();return '';}catch(e){return e.message;}});
    assert(/건물등기 건물내역에 없습니다/.test(err),err);
    await page.evaluate(t=>{document.getElementById('bt_regText').value=t;},reg);
    const dl=page.waitForEvent('download');await page.evaluate(()=>document.getElementById('btnMyeongse').click());
    const file=path.join(out,'명세표_등기.xlsx');await (await dl).saveAs(file);console.log('saved',file);
    assert.deepEqual(errors,[]);
    console.log('PASS');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
