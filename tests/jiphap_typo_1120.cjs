// 집건 템플릿 오타·띄어쓰기·표기 수정 (2026-11-20 ON261117-1632 안산 초지동 롯데캐슬 103동 403호 발송 전 검수 지시서)
//  의견서 1-1~1-14 문구 · 1-11 기호 조사(㉡을) · 개요 구조/용도 중복(「A(A)」「A(A(B))」) · 6 지수 기준월(2026.01=100)
//  요항표 2-1 「입지여건은」 · 2-2~4 토지이용계획 「, 」 하나로 · 2-5 「몰탈 위」 · 2-6 「이용 중임.」
//  청구서 4-1 「입금 시」 · 명세표 5-1 F32 「철근콘크리트조」 · 5-2 기본 보기(pageLayout 아님) · 5-3 합계 캐시 = 실제 금액
//  여러 호수 의견서 템플릿(templates/jiphap_multi_res.hwpx)·토건 청구서 사본(arap_cheonggu.js)도 같은 문구인지 파일로 확인
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/jiphap_typo_1120.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),os=require('os'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
function unzip(buf){const out={},zlib=require('zlib');let e=buf.length-22;while(buf.readUInt32LE(e)!==0x06054b50)e--;
  let p=buf.readUInt32LE(e+16);const n=buf.readUInt16LE(e+10);
  for(let i=0;i<n;i++){const m=buf.readUInt16LE(p+10),cs=buf.readUInt32LE(p+20),nl=buf.readUInt16LE(p+28),el=buf.readUInt16LE(p+30),cl=buf.readUInt16LE(p+32),off=buf.readUInt32LE(p+42);
    const name=buf.slice(p+46,p+46+nl).toString();const lnl=buf.readUInt16LE(off+26),lel=buf.readUInt16LE(off+28);const data=buf.slice(off+30+lnl+lel,off+30+lnl+lel+cs);
    out[name]=m===8?zlib.inflateRawSync(data):data;p+=46+nl+el+cl;}
  return out;}
const secText=z=>{const x=Object.keys(z).filter(n=>/section\d+\.xml$/.test(n)).map(n=>z[n].toString('utf8')).join('');
  return {x,t:x.replace(/<hp:linesegarray>[\s\S]*?<\/hp:linesegarray>/g,'').replace(/<\/hp:p>/g,' ').replace(/<[^>]+>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/[ ]+/g,' ')};};
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');fs.createReadStream(f).pipe(res);});

// 의견서 고정 문구 — 고친 뒤 / 고치기 전
const OPIN_NEW=['기법을 적용하여 감정평가하였음.','「감정평가에 관한 규칙」 제9조에 의거','같은 감정평가방법을 적용함.','“거래사례비교법”','“원가법”','“수익환원법”','구분소유권 감정평가 시 대상의',
  '감정평가하되, 「감정평가에 관한 규칙」','이용상황 등을','물적 동일성이 인정됨.','이용상황 등은','업무 진행 시 참고 바람.','과정을 거쳐','정상화하는 작업으로서','발견할 수 없음.(','인근지역 내 소재하여'];
const OPIN_OLD=['감정평가 하였음','」제9조','같은감정평가','”거래사례비교법“','감정평가시','감정평가 하되','「 감정평가','물적동일성','이용상황등은','업무진행 시','과정을거쳐','정상화 하는','없음,(','인근지역내','베란드'];
const RES_ONLY=['다락·테라스·베란다 등의 유무','노출형 등)'];   // 주거용 개별요인 항목표(비주거 양식엔 없음)

(async()=>{
  // ── 파일로 확인: 여러 호수 템플릿 · 토건 청구서 사본 ──
  { const {t}=secText(unzip(fs.readFileSync(path.join(root,'templates/jiphap_multi_res.hwpx'))));
    for(const s of OPIN_NEW.concat(RES_ONLY))assert.ok(t.includes(s),'여러 호수 의견서: '+s);
    for(const s of OPIN_OLD)assert.ok(!t.includes(s),'여러 호수 의견서 옛 문구 남음: '+s);
    console.log('PASS 여러 호수 의견서 템플릿'); }
  { const src=fs.readFileSync(path.join(root,'arap_cheonggu.js'),'utf8'),b=src.match(/V2CHEONGGU_TPL_B64="([^"]+)"/)[1];
    const {t}=secText(unzip(Buffer.from(b,'base64')));assert.ok(t.includes('수수료 입금 시 입금자')&&!t.includes('입금시'),'토건 청구서 사본');console.log('PASS 토건 청구서 사본'); }

  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined,env:{...process.env,LANG:process.env.LANG||'C.UTF-8'}});
  try{
    for(const propType of ['주거용','비주거용']){
      const ctx=await browser.newContext({acceptDownloads:true,viewport:{width:1600,height:1000}}),page=await ctx.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());page.setDefaultTimeout(60000);
      await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});return u.startsWith(base)?r.continue():r.abort();});
      const kase=(id,sym,sel)=>({id,symbol:sym,location:'초지동',jibun:'666',aptName:'안산롯데캐슬더퍼스트',dong:'101',floor:'10',ho:'100'+sym,exclusiveArea:84.97,price:600000000+Number(sym)*1e7,unitPrice:7061316,tradeDate:'2026.09.1'+sym,approvalDate:'2018.06.29',isShown:true,isSelected:sel,
        extFactor:1,intFactor:1,hoFactor:0.99,etcFactor:1,totalFactor:0.99,noteHo:'거래사례 대비 층별 효용에서 열세함.',timeAdj:1.00998,timeAdjDetail:'아파트\n지역 : 경기 안산시 단원구\n2026.08 : 100.2\n2026.10 : 101.2\n101.2 / 100.2 ≒ 1.00998'});
      const seed={ov:{caseNo:'TYPO1120',client:'검수 의뢰인',owner:'검수 소유자',jibun:'경기도 안산시 단원구 초지동 666',buildingName:'안산롯데캐슬더퍼스트',kind:'아파트',dong:'103',floor:'4',ho:'403',
          area:'84.97',landArea:'40.1',baseDate:'2026.11.17',surveyDate:'2026.11.17',writeDate:'2026.11.17',requestDate:'2026.11.17',purpose:'일반거래(시가참고)',
          structure:'철근콘크리트구조(철근콘크리트구조)',mainUse:'공동주택(공동주택(아파트))',mainUseJeonyu:'아파트',floors:'33/0',approvalDate:'2018.06.29',nearDesc:"'초지역' 북측",
          extWall:'몰탈위 페인팅 마감',windowType:'샷시창호',floorDetail:'1층 1000㎡',landParcels:[{jibun:'666',area:'40000'}],
          toiceRaw:{'666':'도시지역 , 제3종일반주거지역 , 중로2류(폭 15m~20m)(접합)\n다른 법령 등에 따른 지역ㆍ지구등\t가축사육제한구역<가축분뇨의 관리 및 이용에 관한 법률>, 성장관리권역<수도권정비계획법>\n토지거래계약에관한허가구역(허가대상: 아파트)'}},
        cases:[kase('c1','1',false),kase('c2','2',true)],precs:[],propType};
      await page.addInitScript(s=>{if(sessionStorage.getItem('seeded'))return;sessionStorage.setItem('seeded','1');localStorage.setItem('arap-user-name','wdw');
        localStorage.setItem('arap-jiphap-mode','single');sessionStorage.setItem('arap-jiphap-mode','single');
        localStorage.setItem('appraisal-case-list',JSON.stringify([{id:'TYPO1120',label:'검수'}]));localStorage.setItem('case:TYPO1120',s);},JSON.stringify(seed));
      await page.goto(base+'/s3r86w8a.html?last=1');const scope=page.locator('#root');
      await scope.getByText('3. 위치도 · 청구서',{exact:true}).click({timeout:90000});
      const grab=async(name,fn)=>{const btn=scope.getByRole('button',{name,exact:true});await btn.waitFor();for(let i=0;i<40&&await btn.isDisabled();i++)await page.waitForTimeout(500);
        const [dl]=await Promise.all([page.waitForEvent('download',{timeout:60000}),btn.click()]);const f=path.join(process.env.OUT||os.tmpdir(),fn);await dl.saveAs(f);return {name:dl.suggestedFilename(),z:unzip(fs.readFileSync(f))};};
      const tag=propType;

      // ── 의견서 ──
      const op=await grab('의견서','typo_opinion_'+(propType==='주거용'?'res':'nr')+'.hwpx');const {x,t}=secText(op.z);
      assert.ok(await page.evaluate(s=>!new DOMParser().parseFromString(s,'application/xml').getElementsByTagName('parsererror').length,x),tag+' 의견서 XML 정상');
      assert.deepEqual([...new Set(x.match(/\{\{[^}]+\}\}/g)||[])],[],tag+' 남은 토큰 없음');
      for(const s of OPIN_NEW)assert.ok(t.includes(s),tag+' 의견서: '+s);
      for(const s of OPIN_OLD)assert.ok(!t.includes(s),tag+' 의견서 옛 문구 남음: '+s);
      if(propType==='주거용'){for(const s of RES_ONLY)assert.ok(t.includes(s),tag+' '+s);
        assert.ok(t.includes('전국주택가격동향조사(2026.01=100)'),tag+' 지수 기준월 '+(t.match(/동향조사\([^)]*\)/)||[''])[0]);
        assert.ok(!t.includes('2025.03=100'),tag+' 옛 기준월');}
      assert.match(t,/기호 ㉡을 비교사례로 선정하였음/,tag+' 기호 조사 '+(t.match(/기호 \S+ 비교사례로/)||[''])[0]);
      assert.ok(!t.includes('철근콘크리트구조(철근콘크리트구조)')&&!t.includes('공동주택(공동주택'),tag+' 개요 구조·용도 중복');
      assert.ok(t.includes('공동주택(아파트)'),tag+' 개요 용도');
      // ── 요항표 ──
      const yh=await grab('요항표','typo_yohang.hwpx');const Y=secText(yh.z);
      assert.deepEqual([...new Set(Y.x.match(/\{\{[^}]+\}\}/g)||[])],[],tag+' 요항표 토큰');
      assert.ok(Y.t.includes('외벽 : 몰탈 위 페인팅 마감 등'),tag+' 몰탈 위');
      assert.ok(!Y.t.includes('철근콘크리트구조(철근콘크리트구조)'),tag+' 요항표 구조 중복');
      assert.ok(Y.t.includes('도시지역, 제3종일반주거지역, 중로2류(폭 15m~20m)(접합), 가축사육제한구역<가축분뇨의 관리 및 이용에 관한 법률>, 성장관리권역<수도권정비계획법>, 토지거래계약에관한허가구역(허가대상: 아파트)'),
        tag+' 토지이용계획 '+(Y.t.match(/도시지역[^。]{0,220}/)||[''])[0]);
      if(propType==='주거용'){assert.ok(Y.t.includes('제반 입지여건은 무난한 편임.'),tag+' 입지여건은');assert.ok(Y.t.includes('공동주택(아파트)로 이용 중임.'),tag+' 이용 중임 '+(Y.t.match(/\S+ 이용 ?중임/)||[''])[0]);}
      // ── 명세표(5-1·5-2·5-3) ──
      const ms=await grab('명세표(excel)','typo_myeongse.xlsx');const sh=ms.z['xl/worksheets/sheet1.xml'].toString('utf8');
      assert.ok(!/view="pageLayout"/.test(sh),tag+' 명세표 기본 보기');
      assert.ok(!sh.includes('콩크리트')&&!ms.z['xl/sharedStrings.xml'].toString('utf8').includes('콩크리트'),tag+' 콩크리트 오타');
      const tot=sh.match(/<c r="I(\d+)"[^>]*><f>SUM\(I11:I\d+\)<\/f><v>([^<]*)<\/v><\/c>/);assert.ok(tot,tag+' 합계 캐시 있음');
      const amt=sh.match(/<c r="I34"[^>]*><v>([^<]*)<\/v><\/c>/);assert.ok(amt&&+amt[1]>0,tag+' 평가액 칸');
      assert.equal(+tot[2],+amt[1],tag+' 합계 캐시 = 평가액(템플릿 14억 아님)');assert.notEqual(tot[2],'1400000000');
      const f11=(sh.match(/<c r="F11"[^>]*><is><t[^>]*>([^<]*)<\/t>/)||[])[1],f32=(sh.match(/<c r="F32"[^>]*><f>\+F11<\/f><v>([^<]*)<\/v>/)||[])[1];
      assert.ok(f11&&f32===f11,tag+' F32 캐시 = F11 ('+f11+' / '+f32+')');
      // ── 청구서 템플릿(4-1) ──
      const cg=await page.evaluate(async()=>{const b=await window.buildTokenHwpx(window.V2CHEONGGU_TPL_B64,{},window.V2CHEONGGU_BLUE2BLACK);return Array.from(b);});
      const C=secText(unzip(Buffer.from(cg)));assert.ok(C.t.includes('※ 수수료 입금 시 입금자 명의를')&&!C.t.includes('입금시'),tag+' 청구서 입금 시');
      assert.deepEqual(errors,[],tag+' 화면 오류');await ctx.close();console.log('PASS',tag);
    }
    console.log('jiphap_typo_1120 전체 PASS');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
