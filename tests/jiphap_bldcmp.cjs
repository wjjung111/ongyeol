// 집건 「가치형성요인 비교」 건물 비교(arap_bldcmp.js, 2026-11-23) — 본건·사례 표제부 나란히, 본건 기준 ▲우세/▼열세/＝대등
//  1) 계산: 본건 한라쇼핑(서현동 305-5) ↔ 사례 범한프라자(서현동 312-3) 실제 대장 값 → 연면적 2.83배 작음 ▼, 주차 1대당 연면적 1.88배 ▼, 경과연수 0.4년 = 대등
//  2) 의견 초안 문장, 여러 호수 「- 내부요인:」 줄 넣기, 사례 주소에 본건 시·구 붙이기
//  3) 화면: 단일 = 사례 카드 안 표 + 「의견란에 넣기」 → noteInt / 여러 호수 = 적용 사례별 표 + 내부요인 줄
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/jiphap_bldcmp.cjs
const assert=require('assert/strict'),path=require('path'),fs=require('fs'),http=require('http');
const root=path.resolve(__dirname,'..');
global.window=global;require(path.join(root,'arap_bldcmp.js'));
const B=window.ArapBldCmp;
const T_S={regstrGbCdNm:'집합',regstrKindCdNm:'표제부',mainAtchGbCdNm:'주건축물',platPlc:'경기도 성남시 분당구 서현동 305-5번지',bldNm:'한라쇼핑',dongNm:'상가동',mainPurpsCdNm:'제1종근린생활시설',etcPurps:'근린생활시설및 교육연구시설',
  totArea:'3804.04',platArea:'827.6',archArea:'530.44',bcRat:'64.09',vlRat:'298.98',strctCdNm:'철근콘크리트구조',etcStrct:'철근콘크리트',roofCdNm:'(철근)콘크리트',etcRoof:'(철근)콘크리트(슬래브)',
  hoCnt:'55',hhldCnt:'0',useAprDay:'19930914',grndFlrCnt:'5',ugrndFlrCnt:'2',indrAutoUtcnt:'14',indrMechUtcnt:'0',oudrAutoUtcnt:'4',oudrMechUtcnt:'0',rideUseElvtCnt:'1',emgenUseElvtCnt:'0',mgmBldrgstPk:'10891125805'};
const T_C={regstrGbCdNm:'집합',regstrKindCdNm:'표제부',mainAtchGbCdNm:'주건축물',platPlc:'경기도 성남시 분당구 서현동 312-3번지',bldNm:'범한프라자',dongNm:'범한프라자',mainPurpsCdNm:'판매시설',etcPurps:'판매.근린생활시설및교육연구시설',
  totArea:'10775.62',platArea:'2004',archArea:'1118.48',bcRat:'55.81',vlRat:'278.98',strctCdNm:'철근콘크리트구조',etcStrct:'철근콘크리트조',roofCdNm:'(철근)콘크리트',etcRoof:'(철근)콘크리트(콘크리트평지붕)',
  hoCnt:'68',hhldCnt:'0',useAprDay:'19940207',grndFlrCnt:'5',ugrndFlrCnt:'3',indrAutoUtcnt:'85',indrMechUtcnt:'0',oudrAutoUtcnt:'11',oudrMechUtcnt:'0',rideUseElvtCnt:'2',emgenUseElvtCnt:'0',mgmBldrgstPk:'10891125358'};
const st=(t,addr)=>({pnu:'x',addr,titles:[t],recap:null,jijigu:[],dongs:[t.dongNm],isJiphap:true});

// ── 1) 계산 ──
const s=B.summarize(st(T_S,'경기도 성남시 분당구 서현동 305-5'),'상가동',false),c=B.summarize(st(T_C,'경기도 성남시 분당구 서현동 312-3'),'범한프라자',false);
assert.equal(s.park,18);assert.equal(c.park,96);assert.equal(s.pkIn,14);assert.equal(c.pkOut,11);
const rows=B.compare(s,c,{resi:false,baseDate:'2026.11.23'}),R=Object.fromEntries(rows.map(r=>[r.id,r]));
assert.equal(R.strct.v,'eq');
assert.equal(R.age.v,'eq');assert.equal(R.age.s,'1993.09.14 · 33.2년');assert.equal(R.age.c,'1994.02.07 · 32.8년');assert.equal(R.age.note,'본건이 0.4년 더 오래됨');
assert.equal(R.totArea.v,'dn');assert.equal(R.totArea.note,'2.83배 작음 (사례의 0.35배)');assert.equal(R.totArea.s,'3,804.04');
assert.equal(R.platArea.v,'dn');assert.ok(R.platArea.note.startsWith('2.42배 작음'));
assert.equal(R.ratio.v,'ref');assert.equal(R.ratio.note,'+8.3 / +20.0%p');
assert.equal(R.ho.v,'ref');assert.ok(R.ho.note.startsWith('1.24배 적음'));
assert.equal(R.floors.v,'ref');assert.equal(R.floors.note,'지하 1층 적음');
assert.equal(R.elev.v,'dn');assert.equal(R.elev.note,'2.00배 적음');
assert.equal(R.elevPer.v,'dn');assert.equal(R.elevPer.note,'1.62배 많음 · 승강기 붐빔');assert.equal(R.elevPer.s,'55호');assert.equal(R.elevPer.c,'34호');
assert.equal(R.park.v,'dn');assert.equal(R.park.note,'5.33배 적음');assert.equal(R.park.s,'18대 (14 / 4)');
assert.equal(R.parkArea.v,'dn');assert.equal(R.parkArea.note,'1.88배 큼 · 주차 여유 부족');assert.equal(R.parkArea.s,'211.3㎡');assert.equal(R.parkArea.c,'112.2㎡');
assert.equal(R.parkHo.v,'dn');assert.ok(R.parkHo.note.startsWith('4.31배 적음'));
// 반대로(사례가 본건이면) ▲ 우세
const rev=Object.fromEntries(B.compare(c,s,{baseDate:'2026.11.23'}).map(r=>[r.id,r]));
assert.equal(rev.totArea.v,'up');assert.equal(rev.parkArea.v,'up');assert.ok(rev.parkArea.note.includes('주차 여유'));
// 10% 이내 = 대등, 경과 1년 이상 = 노후/신축
const s2={...s,totArea:3804},c2={...s,totArea:4100,useApr:'2003.05.01'};
const R2=Object.fromEntries(B.compare(s2,c2,{baseDate:'2026.11.23'}).map(r=>[r.id,r]));
assert.equal(R2.totArea.v,'eq');assert.equal(R2.totArea.note,'차이 8% (사례의 0.93배)');assert.equal(R2.age.v,'dn');assert.ok(R2.age.note.includes('9.6년 더 노후'));
// 대장 값 없으면 na
assert.equal(Object.fromEntries(B.compare({...s,park:0},c,{}).map(r=>[r.id,r])).park.v,'na');

// ── 2) 의견 초안·주소 ──
const D='본건은 사례 대비 구조(철근콘크리트구조)·사용승인 시기(1993년 / 1994년)는 대등하고, 연면적(3,804㎡ / 10,776㎡)·승강기(1대 / 2대)·주차대수(18대 / 96대)는 열세함.';
assert.equal(B.draftText(rows,[]),D);
assert.equal(B.draftText(rows,[{label:'공실 현황',s:'2개 호 공실',c:'공실 없음',v:'dn'},{label:'임대료 수준',s:'',c:'',v:''}]),
  '본건은 사례 대비 구조(철근콘크리트구조)·사용승인 시기(1993년 / 1994년)는 대등하고, 연면적(3,804㎡ / 10,776㎡)·승강기(1대 / 2대)·주차대수(18대 / 96대)·공실 현황(2개 호 공실 / 공실 없음)은 열세함.');
assert.equal(B.setNoteLine('','내부요인','X'),'- 외부요인:\n- 내부요인: X\n- 호별요인:\n- 기타요인:');
assert.equal(B.setNoteLine('- 외부요인: 역세권\n- 내부요인: 옛 글\n- 호별요인:','내부요인','새 글'),'- 외부요인: 역세권\n- 내부요인: 새 글\n- 호별요인:');
assert.equal(B.setNoteLine('자유 문장','내부요인','X'),'자유 문장\n- 내부요인: X');
const OV={jibun:'경기도 성남시 분당구 서현동 305-5, 305-6',dong:'상가'};
assert.equal(B.subjAddr(OV),'경기도 성남시 분당구 서현동 305-5');
assert.equal(B.caseAddr({location:'서현동',jibun:'312-3'},OV),'경기도 성남시 분당구 서현동 312-3');
assert.equal(B.caseAddr({location:'분당구 서현동',jibun:'312-3번지'},OV),'경기도 성남시 분당구 서현동 312-3');
assert.equal(B.caseAddr({location:'서울특별시 강남구 압구정동',jibun:'426'},OV),'서울특별시 강남구 압구정동 426');
assert.equal(B.caseAddr({location:'서현동',jibun:'312-3',bcAddr:'성남시 분당구 서현동 263'},OV),'성남시 분당구 서현동 263');
assert.equal(B.sggOf('서울특별시 강남구 압구정동 456'),'서울특별시 강남구');
assert.equal(B.pickDong(['상가동','101동'],'상가',''),'상가동');
assert.equal(B.pickDong(['A동','범한프라자'],'','범한프라자 범한프라자동 2층 204호'),'범한프라자');
assert.ok(B.sameComplex({location:'서현동',jibun:'305-5'},OV));assert.ok(!B.sameComplex({location:'서현동',jibun:'312-3'},OV));
// 주거: 세대수·세대당 주차, 단지 주차는 총괄표제부
const A1={...T_S,dongNm:'101동',mainPurpsCdNm:'공동주택',hhldCnt:'120',hoCnt:'0',indrAutoUtcnt:'0',oudrAutoUtcnt:'0',rideUseElvtCnt:'2'};
const rs=B.summarize({pnu:'x',addr:'a',titles:[A1,{...A1,dongNm:'102동',mgmBldrgstPk:'2'}],recap:{hhldCnt:'240',mainBldCnt:'2',indrAutoUtcnt:'300',oudrAutoUtcnt:'12'},jijigu:[],dongs:['101동','102동']},'101동',true);
assert.equal(rs.hhld,240);assert.equal(rs.park,312);assert.equal(rs.pkScope,'단지');
const rr=Object.fromEntries(B.compare(rs,{...rs,hhld:480,park:480},{resi:true}).map(r=>[r.id,r]));
assert.equal(rr.hhld.v,'dn');assert.equal(rr.parkPer.v,'up');assert.equal(rr.elevPer.s,'60세대');
console.log('계산 OK');

// ── 3) 화면 ──
const html=fs.readFileSync(path.join(root,'s3r86w8a.html'),'utf8');
assert.ok(html.includes('<script src="arap_bldcmp.js" defer>'));
assert.equal((html.match(/<ArapBldCmp\.Panel /g)||[]).length,2,'단일·여러 호수 둘 다');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':'text/javascript');fs.createReadStream(f).pipe(res);});
const hub=arr=>({response:{header:{resultCode:'00'},body:{items:{item:arr},numOfRows:200,pageNo:1,totalCount:arr.length}}});
const PNU_S='4113510900103050005',PNU_C='4113510900103120003';
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
  try{
    for(const mode of ['single','multi']){
      const ctx=await browser.newContext({viewport:{width:2000,height:1000}}),page=await ctx.newPage(),errors=[],queries=[];
      page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(60000);
      await ctx.route('**/*',r=>{const u=r.request().url();
        if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});
        if(u.startsWith(base))return r.continue();
        if(u.startsWith('https://api.vworld.kr')){const q=new URL(u).searchParams.get('query');queries.push(q);const pnu=/305-5/.test(q)?PNU_S:PNU_C;
          return r.fulfill({json:{response:{status:'OK',result:{items:[{id:pnu,title:q,address:{parcel:q}}]}}}});}
        if(u.includes('workers.dev/bld')){const p=new URL(u).searchParams,op=p.get('op'),pnu=p.get('pnu');
          if(op==='getBrTitleInfo')return r.fulfill({json:hub([pnu===PNU_S?T_S:T_C])});
          return r.fulfill({json:hub([])});}
        return r.abort();});
      await page.addInitScript(({mode})=>{
        localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-jiphap-mode',mode);sessionStorage.setItem('arap-jiphap-mode',mode);const pre=mode==='multi'?'v2:':'';
        const cs=[{id:'c1',symbol:'1',location:'서현동',jibun:'312-3',aptName:'범한프라자 범한프라자동 2층 204호',dong:'',floor:'2',ho:'204',exclusiveArea:46.91,price:210000000,unitPrice:4476657,tradeDate:'2026.02.09',timeAdj:1.00514,isSelected:true,
          extFactor:1,intFactor:1,hoFactor:1,etcFactor:1,totalFactor:1,noteExt:'',noteInt:'',noteHo:'',noteEtc:''}];
        localStorage.setItem(pre+'appraisal-case-list',JSON.stringify([{id:'T',label:'t'}]));
        localStorage.setItem(pre+'case:T',JSON.stringify({ov:{caseNo:'T',jibun:'경기도 성남시 분당구 서현동 305-5',dong:'상가',floor:'4',ho:'402',area:'290.72',units:[{id:1,dong:'상가',floor:'4',ho:'402',area:'290.72',appliedSymbol:'1'}],baseDate:'2026.11.23',writeDate:'2026.11.23',client:'테스트'},cases:cs,precs:[],propType:'비주거용'}));
      },{mode});
      await page.goto(base+'/s3r86w8a.html?last=1');
      const scope=page.locator(mode==='single'?'#root':'#root-multi');
      await scope.locator('.js-tab').nth(1).click();
      const panel=scope.locator('details.bldcmp').first();
      await panel.locator('text=본건 기준 비교').waitFor({timeout:20000});
      const txt=await panel.innerText();
      for(const w of ['한라쇼핑','범한프라자','3,804.04','10,775.62','2.83배 작음','▼ 열세','＝ 대등','211.3㎡','112.2㎡','주차 여유 부족','1993.09.14 · 33.2년','공실 현황'])assert.ok(txt.includes(w),mode+' 표에 '+w);
      assert.ok(queries.includes('경기도 성남시 분당구 서현동 312-3'),'사례 주소에 본건 시·구: '+queries.join(' | '));
      assert.equal(await panel.locator('[data-bldcmp-draft]').innerText(),D);
      // 현장조사 칸: 사례 공실 + 열세 → 초안에 붙음
      await panel.locator('input[aria-label="본건 공실 현황"]').fill('2개 호 공실');
      await panel.locator('input[aria-label="사례 공실 현황"]').fill('공실 없음');
      await panel.locator('select[aria-label="공실 현황 우열"]').selectOption('dn');
      await page.waitForTimeout(200);
      assert.ok((await panel.locator('[data-bldcmp-draft]').innerText()).includes('공실 현황(2개 호 공실 / 공실 없음)은 열세함'));
      await panel.locator('button:has-text("넣기")').click();await page.waitForTimeout(300);
      if(mode==='single'){
        const ta=scope.locator('tr:has(td:text-is("단지 내부요인")) textarea');
        assert.ok((await ta.inputValue()).startsWith('본건은 사례 대비 구조'),'단일: 단지 내부요인 의견란');
        // 저장된 건에도 남는지(사례·본건 현장조사 칸)
      }else{
        const ta=scope.locator('textarea[aria-label="호별 비교 의견 1"]');
        const v=await ta.inputValue();assert.ok(/^- 외부요인:.*\n- 내부요인: 본건은 사례 대비 구조/.test(v),'여러 호수: 내부요인 줄 '+v);
      }
      // 접기/펼치기
      await panel.locator('summary').click();await page.waitForTimeout(150);assert.equal(await panel.locator('text=본건 기준 비교').count(),0);
      await panel.locator('summary').click();await panel.locator('text=본건 기준 비교').waitFor();
      if(process.env.SHOT)await panel.screenshot({path:process.env.SHOT+'_'+mode+'.png'});
      assert.deepEqual(errors,[]);
      console.log(mode+' 화면 OK');
      await ctx.close();
    }
    console.log('PASS jiphap_bldcmp');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error('FAIL',e);process.exit(1);});
