// 집합건물 1. 접수 · 대상물건 「의견서 문구 — 6. 그 밖의 사항」 박스 (arap_etc_items.js, 2026-11-05)
//  ① 단일호수: 대지권미등기 문구 버튼(지번의 도시개발지구·블럭로트 자동) + 빈 항목 직접 입력 → 의견서 라. 다음 마./바. (지분평가면 지분 문구 마. 다음 바./사.)
//  ② 여러호수: 같은 박스가 보이고, ArapMultiHwpx 의견서에도 마.·바.로 들어감
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/jiphap_etc_items.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict'),os=require('os');
const root=path.resolve(__dirname,'..');
function unzip(buf){const out={},zlib=require('zlib');let e=buf.length-22;while(buf.readUInt32LE(e)!==0x06054b50)e--;
  let p=buf.readUInt32LE(e+16);const n=buf.readUInt16LE(e+10);
  for(let i=0;i<n;i++){const m=buf.readUInt16LE(p+10),cs=buf.readUInt32LE(p+20),nl=buf.readUInt16LE(p+28),el=buf.readUInt16LE(p+30),cl=buf.readUInt16LE(p+32),off=buf.readUInt32LE(p+42);
    const name=buf.slice(p+46,p+46+nl).toString();const lnl=buf.readUInt16LE(off+26),lel=buf.readUInt16LE(off+28);const data=buf.slice(off+30+lnl+lel,off+30+lnl+lel+cs);
    out[name]=m===8?zlib.inflateRawSync(data):data;p+=46+nl+el+cl;}
  return out;}
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  let data=fs.readFileSync(f);
  if(f.endsWith('s3r86w8a.html'))data=data.toString().replace("ReactDOM.createRoot(document.getElementById('root-multi'))","window.multiHelpers={applyR,getUV,parseTimeAdjDetail,numberToKoreanMoney,assembleToice,parseZip,createZipStored};ReactDOM.createRoot(document.getElementById('root-multi'))");
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');res.end(data);});
const T=x=>(x.match(/<hp:t>[^<]*<\/hp:t>/g)||[]).map(s=>s.slice(6,-7)).join('|');
const JIBUN='인천광역시 서해구 경서동 경서3구역도시개발지구25블럭1로트';
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  try{
    // 순수 함수
    { const ctx=await browser.newContext(),page=await ctx.newPage();await page.goto(base+'/arap_etc_items.js');await page.addScriptTag({path:path.join(root,'arap_etc_items.js')});
      const r=await page.evaluate(j=>{const E=window.ArapEtcItems;return {z:E.devZone(j),z2:E.devZone('서울특별시 강남구 압구정동 456'),
        h1:E.hint({jibun:j}),h2:E.hint({jibun:'서울 강남구 압구정동 456',area:'84',landArea:'',landRatioDenom:''}),h3:E.hint({jibun:'서울 강남구 압구정동 456',area:'84',landArea:'50.1'}),
        t:E.texts({etcItems:['  가\n나 ','',' ']},'지분 문구'),p:E.presets({jibun:j,zoning:'준주거지역'}).map(x=>x.text)};},JIBUN);
      assert.deepEqual(r.z,{name:'경서3구역 도시개발지구',lot:'25블럭 1로트'});assert.equal(r.z2,null);
      assert.ok(r.h1&&r.h2&&!r.h3,'대지권미등기 안내 조건');
      assert.deepEqual(r.t,['지분 문구','가 나'],'빈 항목 빼고 한 줄로');
      assert.ok(r.p[1].includes('본건은 경서3구역 도시개발지구 내 구분소유건물로서, 기준시점 현재 지적이 미정리된 상태(25블럭 1로트)로'),'도시개발 문구');
      assert.ok(r.p[2].includes("용도지역은 '준주거지역'으로"),'토지이용계획 문구');
      await ctx.close();console.log('함수 OK');}

    // ① 단일호수 — 화면 박스 → 의견서
    for(const share of [false,true]){
      const ctx=await browser.newContext({acceptDownloads:true,viewport:{width:1300,height:900}}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
      await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});return u.startsWith(base)?r.continue():r.abort();});
      await page.addInitScript(()=>{localStorage.setItem('arap-user-name','wdw');(localStorage.setItem('arap-jiphap-mode','single'),sessionStorage.setItem('arap-jiphap-mode','single'));});
      await page.goto(base+'/s3r86w8a.html?last=1');const scope=page.locator('#root');
      await scope.getByText('1. 접수 · 대상물건',{exact:true}).click({timeout:60000});
      const card=scope.locator('.etc-card');await card.waitFor();
      assert.ok((await card.innerText()).includes('6. 그 밖의 사항'),'박스 제목');
      assert.equal(await card.locator('.etc-hint').count(),0,'대지권 있는 샘플은 안내 없음');
      // 지번을 블럭·로트로 → 안내 → 문구 버튼
      const jb=page.locator('#root span:text-is("지번주소") + input:visible').first();
      await jb.fill(JIBUN);
      await card.locator('.etc-hint').waitFor();
      if(share){
        await scope.locator('select').filter({has:page.locator('option[value="share"]')}).first().selectOption('share');
        await scope.locator('input[placeholder="분자"]').fill('1');await scope.locator('input[placeholder="분모"]').fill('2');
        await scope.getByLabel('지분평가 그 밖의 사항 문구').fill('지분 문구');
        assert.ok((await card.innerText()).includes('지분 문구'),'박스에 지분 문구 마. 표시');
      }
      const L0=share?'바':'마',L1=share?'사':'바';
      await card.getByRole('button',{name:'+ 대지권미등기 (도시개발지구·지적 미정리)',exact:true}).click();
      assert.equal(await card.locator('.etc-hint').count(),0,'문구 넣으면 안내 사라짐');
      assert.match(await card.getByLabel('그 밖의 사항 '+L0+' 문구').inputValue(),/^본건은 경서3구역 도시개발지구 내 구분소유건물로서/);
      await card.getByRole('button',{name:'+ 빈 항목',exact:true}).click();
      await card.getByLabel('그 밖의 사항 '+L1+' 문구').fill('직접 쓴 문구 & <확인>\n둘째 줄');
      // 세 번째 항목을 넣었다가 ✕로 지움
      await card.getByRole('button',{name:'+ 대지권미등기',exact:true}).click();
      assert.equal(await card.locator('.etc-item').count(),3);
      await card.getByLabel('그 밖의 사항 '+(share?'아':'사')+' 삭제').click();
      assert.equal(await card.locator('.etc-item').count(),2);
      await scope.getByText('3. 위치도 · 청구서',{exact:true}).click();
      const btn=scope.getByRole('button',{name:'의견서',exact:true});await btn.waitFor();for(let i=0;i<30&&await btn.isDisabled();i++)await page.waitForTimeout(500);
      const [dl]=await Promise.all([page.waitForEvent('download',{timeout:60000}),btn.click()]);const file=path.join(process.env.OUT||os.tmpdir(),'etc_items_'+(share?'share':'plain')+'.hwpx');await dl.saveAs(file);
      const x=unzip(fs.readFileSync(file))['Contents/section0.xml'].toString('utf8');
      assert.ok(await page.evaluate(s=>!new DOMParser().parseFromString(s,'application/xml').getElementsByTagName('parsererror').length,x),'XML 정상');
      assert.deepEqual([...new Set(x.match(/\{\{[^}]+\}\}/g)||[])],[],'남은 토큰 없음');
      const t=T(x).replace(/\| \|/g,'| '),k=t.indexOf('업무진행 시 참고 바람');
      const after=t.slice(k,t.indexOf('대상물건 개요',k));
      const want=(share?'|마.| 지분 문구':'')+'|'+L0+'.| 본건은 경서3구역 도시개발지구 내 구분소유건물로서';
      assert.ok(after.startsWith('업무진행 시 참고 바람'+want),'그 밖의 사항 순서 '+after.slice(0,160));
      assert.ok(after.includes('|'+L1+'.| 직접 쓴 문구 &amp; &lt;확인&gt; 둘째 줄|'),'직접 쓴 문구 그대로(줄바꿈은 한 칸) '+after.slice(0,600));
      assert.ok(!after.includes(share?'|아.|':'|사.|'),'지운 항목 없음');
      // 저장 → 새로고침해도 남음
      await page.reload();await scope.getByText('1. 접수 · 대상물건',{exact:true}).click();
      assert.equal(await scope.locator('.etc-card .etc-item').count(),2,'새로고침 후 유지');
      assert.deepEqual(errors,[]);await ctx.close();console.log('단일호수 '+(share?'지분':'일반')+' OK');
    }

    // ② 여러호수 — 박스 표시 + 엔진
    { const ctx=await browser.newContext({viewport:{width:1300,height:900}}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
      await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});return u.startsWith(base)?r.continue():r.abort();});
      await page.addInitScript(()=>{localStorage.setItem('arap-user-name','wdw');(localStorage.setItem('arap-jiphap-mode','multi'),sessionStorage.setItem('arap-jiphap-mode','multi'));});
      await page.goto(base+'/s3r86w8a.html');await page.waitForFunction(()=>window.multiHelpers,null,{timeout:60000});
      const scope=page.locator('#root-multi');await scope.getByText('1. 접수 · 대상물건',{exact:true}).click();
      const card=scope.locator('.etc-card');await card.waitFor();
      await card.getByRole('button',{name:'+ 대지권미등기',exact:true}).click();
      assert.match(await card.getByLabel('그 밖의 사항 마 문구').inputValue(),/^본건은 기준시점 현재 등기사항전부증명서상 전유부분의 건물의 표시만/);
      const r=await page.evaluate(async()=>{
        const cases=[0,1].map(i=>({id:'c'+i,symbol:i+1,isShown:true,isSelected:true,location:'서울특별시 영등포구 당산동6가',jibun:'100-'+i,aptName:'검증 오피스텔',dong:'101',floor:'3',ho:String(301+i),exclusiveArea:30,price:150000000,unitPrice:5000000,tradeDate:'2026.02.10',approvalDate:'2022.11.07',timeAdj:1.02,timeAdjDetail:'오피스텔\n지역 : 서울 서남권\n매매가격지수 : 2026.01 ~ 2026.08\n시점수정치 : 102.00/100.00≒1.02000'}));
        const ov={caseNo:'SYN',client:'검증',jibun:'서울특별시 영등포구 당산동6가 280-1',buildingName:'검증건물',kind:'오피스텔',purpose:'일반거래(시가참고)',baseDate:'2026.09.21',writeDate:'2026.09.21',
          etcItems:['첫째 문구 & 확인','','둘째 문구'],units:[{id:1,dong:'101',floor:'3',ho:'301',area:'30',commonArea:'10',landArea:'12',extFactor:'1',intFactor:'1',hoFactor:'1',etcFactor:'1',appliedSymbol:'1'}]};
        const h=window.multiHelpers,res=await ArapMultiHwpx.build({ov,cases,uD:'천원',uM:'round',tD:'만원',tM:'round'},h,'opinion');
        const es=await h.parseZip(res.bytes.buffer);const x=new TextDecoder().decode(es.find(e=>e.name==='Contents/section0.xml').data);
        return {x,ok:!new DOMParser().parseFromString(x,'application/xml').getElementsByTagName('parsererror').length};});
      assert.ok(r.ok,'여러호수 XML 정상');
      const t=T(r.x).replace(/\| \|/g,'| '),k=t.indexOf('업무진행 시 참고 바람');
      assert.ok(t.slice(k).startsWith('업무진행 시 참고 바람|마.| 첫째 문구 &amp; 확인|바.| 둘째 문구|'),'여러호수 그 밖의 사항 '+t.slice(k,k+120));
      assert.deepEqual([...new Set(r.x.match(/\{\{그밖의[^}]+\}\}/g)||[])],[],'여러호수 남은 토큰 없음');
      assert.deepEqual(errors,[]);await ctx.close();console.log('여러호수 OK');}
    console.log('PASS');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
