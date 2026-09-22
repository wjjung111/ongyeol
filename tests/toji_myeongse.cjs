// 토지건물 명세표(xlsx) 배치 검증 — 발송 양식대로: 토지 행 → 「가」 머리행(시군구 포함 소재지 + [도로명주소], 지번 '상동', 주용도, 구조·층수) → 층별 행
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_myeongse.cjs
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
    await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js'))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
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
      [['지하1층','일반음식점','108.3'],['1층','일반음식점','71.28'],['2층','사무소','98.98'],['3층','사무소','77.73'],['4층','사무소','56.84']].forEach(r=>addBldRow({'층별':r[0],'용도':r[1],'연면적':r[2]}));
      window.BLD_STATE={0:{reCost:'800000',life:'50'},1:{reCost:'1200000',life:'50'},2:{reCost:'1200000',life:'50'},3:{reCost:'1200000',life:'50'},4:{reCost:'1200000',life:'50'}};
      calcGongsi();renderBldCalc();calcFinal();
    });
    const rows=await page.evaluate(()=>ArapTojiDocuments.statementRows());
    assert.equal(rows.length,7,'토지 1 + 머리행 1 + 층 5');
    assert.equal(rows[0]['명세_소재지'],'서울특별시 강남구 신사동','토지 소재지에 시군구 포함');
    assert.equal(rows[1]['명세_기호'],'가');assert.equal(rows[1]['명세_지번'],'상동');
    assert.equal(rows[1]['명세_소재지'],'서울특별시 강남구 신사동\n\n[도로명주소]\n서울특별시 강남구 압구정로 165');
    assert.equal(rows[1]['명세_지목용도'],'제2종근린생활시설');assert.equal(rows[1]['명세_지역구조'],'철근콘크리트구조\n지하 1층 지상 4층');
    assert.equal(rows[1]['명세_단가'],null);
    assert.equal(rows[2]['명세_기호'],'');assert.equal(rows[2]['명세_소재지'],undefined);assert.equal(rows[2]['명세_지역구조'],'지하1층');assert.equal(rows[2]['명세_지목용도'],'일반음식점');
    assert.equal(rows[2]['명세_비고'],'800,000\n× 31/50');
    const dl=page.waitForEvent('download');await page.evaluate(()=>document.getElementById('btnMyeongse').click());   // 버튼은 다른 탭에 있어 스크립트로 누른다
    const file=path.join(out,'명세표.xlsx');await (await dl).saveAs(file);
    // 시트 셀 읽기(sharedStrings·inlineStr 모두)
    const cells=await page.evaluate(async bytes=>{
      const entries=await ArapCheonggu.parseZip(Uint8Array.from(bytes).buffer),dec=new TextDecoder();
      const sh=new DOMParser().parseFromString(dec.decode(entries.find(e=>/sheet1\.xml$/.test(e.name)).data),'application/xml');
      if(sh.querySelector('parsererror'))throw Error('XML 오류');
      const NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main',o={};
      Array.from(sh.getElementsByTagNameNS(NS,'c')).forEach(c=>{const t=c.getElementsByTagNameNS(NS,'t')[0],v=c.getElementsByTagNameNS(NS,'v')[0],f=c.getElementsByTagNameNS(NS,'f')[0];
        const val=t?t.textContent:v?v.textContent:null;if(val!=null||f)o[c.getAttribute('r')]=f?('='+f.textContent):val;});
      return o;
    },Array.from(fs.readFileSync(file)));
    const col=c=>Object.keys(cells).filter(k=>k.startsWith(c)&&/^[A-Z]\d+$/.test(k)).sort((a,b)=>+a.slice(1)-+b.slice(1)).map(k=>[+k.slice(1),cells[k]]);
    console.log('C열',JSON.stringify(col('C')));console.log('B열',JSON.stringify(col('B')));console.log('E열',JSON.stringify(col('E')));console.log('F열',JSON.stringify(col('F')));console.log('J열',JSON.stringify(col('J')));
    // 토지 행 14~17: 소재지 낱말별 줄
    assert.deepEqual([cells.C14,cells.C15,cells.C16],['서울특별시','강남구','신사동']);
    // 머리행 18~21: 가 / 소재지 3줄 + 빈 줄 / 상동 / 주용도 / 구조·층수. 금액 수식 없음
    assert.equal(cells.B18,'가');assert.deepEqual([cells.C18,cells.C19,cells.C20],['서울특별시','강남구','신사동']);assert.equal(cells.D18,'상동');
    assert.equal(cells.E18,'제2종근린생활시설');assert.equal(cells.F18,'철근콘크리트구조');assert.equal(cells.F19,'지하 1층 지상 4층');
    assert.equal(cells.J18,undefined,'머리행엔 금액 수식 없음');
    // 도로명주소는 머리행 4행을 넘긴 줄부터 층별 행 옆(22행~)으로 흘러내린다
    assert.deepEqual([cells.C22,cells.C23,cells.C24,cells.C25,cells.C26,cells.C27],['[도로명주소]','서울특별시','강남구','압구정로','165',undefined]);
    // 층별 행: 3행씩(22·25·28·31·34), 기호·지번 없음, 용도/층/면적/단가/금액 수식/비고
    assert.equal(cells.B22,undefined);assert.equal(cells.D22,undefined);assert.equal(cells.E22,'일반음식점');assert.equal(cells.F22,'지하1층');assert.equal(cells.G22,'108.3');assert.equal(cells.J22,'=+I22*H22');
    assert.equal(cells.K22,'800000');assert.equal(cells.K23,'× 31/50');assert.equal(cells.K24,undefined,'셋째 줄은 빈 줄');
    assert.equal(cells.E25,'일반음식점');assert.equal(cells.F25,'1층');assert.equal(cells.E34,'사무소');assert.equal(cells.F34,'4층');
    assert.equal(cells.J37,undefined,'층별 행 뒤는 빈 행');
    // 도로명주소 칸을 비우면 토지 조회 때 받은 도로명주소(LANDS[0].roadAddr)를 쓴다
    const fb=await page.evaluate(()=>{document.getElementById('bt_roadAddr').value='';LANDS[0].roadAddr='서울특별시 강남구 논현로 100';return ArapTojiDocuments.statementRows()[1]['명세_소재지'];});
    assert.equal(fb,'서울특별시 강남구 신사동\n\n[도로명주소]\n서울특별시 강남구 논현로 100');
    const sum=Object.entries(cells).find(([k,v])=>typeof v==='string'&&v.startsWith('=SUM('));
    assert(sum,'합계 수식');console.log('합계',sum);
    assert.deepEqual(errors,[]);
    console.log('PASS');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
