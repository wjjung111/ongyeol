// 집합건물 여러 호수 요항표(2026-11-17) — 단일호수 요항표 엔진(window.ArapYohang)으로 호수 전부를 한 장에.
// 1. 건물의 구조 「… 중 제1층 제101호, 제2층 제201호…로서」, 2. 이용상태는 호수 주용도(전유부)별로 묶어 「…는 근린생활시설로, …는 다세대주택으로 이용 중임.」
// 접면도로 입력칸(방향·노폭)도 여러 호수 ② 화면에 생김. 📦 일괄 받기에 요항표 포함. 단일호수 요항표 회귀(조사 「로」 유지)도 확인.
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/jiphap_multi_yohang.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),os=require('os'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
function unzip(buf){const out={},zlib=require('zlib');let e=buf.length-22;while(buf.readUInt32LE(e)!==0x06054b50)e--;
  let p=buf.readUInt32LE(e+16);const n=buf.readUInt16LE(e+10);
  for(let i=0;i<n;i++){const m=buf.readUInt16LE(p+10),cs=buf.readUInt32LE(p+20),nl=buf.readUInt16LE(p+28),el=buf.readUInt16LE(p+30),cl=buf.readUInt16LE(p+32),off=buf.readUInt32LE(p+42);
    const name=buf.slice(p+46,p+46+nl).toString();const lnl=buf.readUInt16LE(off+26),lel=buf.readUInt16LE(off+28);const data=buf.slice(off+30+lnl+lel,off+30+lnl+lel+cs);
    out[name]=m===8?zlib.inflateRawSync(data):data;p+=46+nl+el+cl;}
  return out;}
const textOf=f=>{const z=unzip(fs.readFileSync(f));const x=Object.keys(z).filter(n=>/section\d+\.xml$/.test(n)).map(n=>z[n].toString('utf8')).join('');
  return {x,t:x.replace(/<hp:linesegarray>[\s\S]*?<\/hp:linesegarray>/g,'').replace(/<\/hp:p>/g,' ').replace(/<[^>]+>/g,'').replace(/\s+/g,' ')};};
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':'text/javascript');fs.createReadStream(f).pipe(res);});
const units=[['1','101','67.88','근린생활시설'],['2','201','121.92','근린생활시설'],['3','301','56.16','다세대주택'],['3','302','62.90','다세대주택'],['4','401','51.02','다세대주택'],['4','402','55.96','다세대주택'],['5','501','100.86','다세대주택']];
const ov={caseNo:'TESTMULTI',client:'검증 의뢰인',owner:'검증 소유자',jibun:'서울특별시 강동구 성내동 420-5',kind:'근린생활시설 및 다세대주택',mainUse:'근린생활시설 및 다세대주택',
  structure:'철근콘크리트구조',floors:'5/0',approvalDate:'2003.07.09',nearDesc:"지하철5호선 '둔촌동역' 북서측",extWall:'몰탈위 페인팅 마감',windowType:'샷시 창호',toiceRaw:{'420-5':'제2종일반주거지역'},
  roadDir:'남측',roadWidth:'8',purpose:'일반거래(시가참고)',baseDate:'2026.10.26',units:units.map(([floor,ho,area,mainUseJeonyu])=>({id:'u'+ho,floor,ho,area,mainUseJeonyu}))};
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined,env:{...process.env,LANG:process.env.LANG||'C.UTF-8'}});
  try{
    const ctx=await browser.newContext({acceptDownloads:true,viewport:{width:1500,height:1000}}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
    await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});return u.startsWith(base)||/unpkg|cdnjs|jsdelivr/.test(u)?r.continue():r.abort();});
    const seed=JSON.stringify({ov,cases:[],propType:'주거용',rnd:{uD:'천원',uM:'round',tD:'만원',tM:'round'}});
    await page.addInitScript(s=>{localStorage.setItem('arap-user-name','wdw');if(!localStorage.getItem('v2:case:TESTMULTI')){localStorage.setItem('v2:appraisal-case-list',JSON.stringify([{id:'TESTMULTI',label:'TESTMULTI 검증'}]));localStorage.setItem('v2:case:TESTMULTI',s);}},seed);
    const grab=async(scope,name,fn)=>{const btn=scope.getByRole('button',{name,exact:true});await btn.waitFor();for(let i=0;i<40&&await btn.isDisabled();i++)await page.waitForTimeout(500);
      const [dl]=await Promise.all([page.waitForEvent('download',{timeout:60000}),btn.click()]);const f=path.join(os.tmpdir(),fn);await dl.saveAs(f);return {name:dl.suggestedFilename(),...textOf(f)};};
    await page.goto(base+'/s3r86w8a.html?last=1&mode=multi');const scope=page.locator('#root-multi');
    await scope.getByText('1. 접수 · 대상물건',{exact:true}).click({timeout:90000});
    assert.equal(await scope.locator('input[aria-label="접면도로 방향"]').inputValue(),'남측','여러 호수 접면도로 칸');
    await scope.getByText('3. 위치도 · 청구서',{exact:true}).click();
    const r=await grab(scope,'요항표','multi_yohang.hwpx');
    assert.match(r.name,/^5\. 요항표_검증 의뢰인\.hwpx$/);assert.deepEqual([...new Set(r.x.match(/\{\{[^}]+\}\}/g)||[])],[]);
    assert.ok(r.t.includes('지상5층 중 제1층 제101호, 제2층 제201호, 제3층 제301호, 제3층 제302호, 제4층 제401호, 제4층 제402호, 제5층 제501호로서'),'건물의 구조');
    assert.ok(r.t.includes('제1층 제101호, 제2층 제201호는 근린생활시설로, 제3층 제301호, 제3층 제302호, 제4층 제401호, 제4층 제402호, 제5층 제501호는 다세대주택으로 이용 중임.'),'이용상태');
    assert.ok(r.t.includes('본건 남측으로 노폭 약 8m 내외의 포장도로에 접함.'),'접면도로');
    assert.ok(r.t.includes('본건 주위는 다세대주택, 단독주택 및 근린생활시설 등이 혼재하는 주거지대로서'),'부근상황');
    assert.ok(!/<hp:p [^>]*><hp:run charPrIDRef="\d+"\/>(<hp:linesegarray>(<hp:lineseg [^>]*\/>)*<\/hp:linesegarray>)?<\/hp:p><\/hs:sec>$/.test(r.x),'끝 빈 문단 없음(빈 쪽 방지)');
    const names=[];page.on('download',d=>names.push(d.suggestedFilename()));
    await scope.getByRole('button',{name:'📦 일괄 받기',exact:true}).click();await page.waitForTimeout(8000);
    assert.ok(names.some(n=>n.includes('요항표')),'일괄 받기에 요항표: '+names.join(', '));
    // 단일호수 회귀 — 샘플(아파트) 「공동주택(아파트)로 이용 중임.」
    await page.goto(base+'/s3r86w8a.html?last=1&mode=single');const s1=page.locator('#root');
    await s1.getByText('3. 위치도 · 청구서',{exact:true}).click({timeout:90000});
    const s=await grab(s1,'요항표','single_yohang.hwpx');assert.deepEqual([...new Set(s.x.match(/\{\{[^}]+\}\}/g)||[])],[]);assert.match(s.t,/아파트\)로 이용 중임\./,'단일 조사');
    assert.deepEqual(errors,[]);console.log('PASS');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
