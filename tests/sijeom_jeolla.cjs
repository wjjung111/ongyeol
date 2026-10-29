// 주거용 시점수정 지역에 전북·전남(2026-10-29) — 실제 지수 파일로 확인.
// 부동산원은 2026년부터 전남·광주를 「전남광주」 아래에 묶어 공표(전남광주>전남>여수시, 전남광주>광주>서구).
// ① 집건(단일·여러호수)·입주권 detectSjRegion: 「전라북도 전주시 완산구」 → 완산구, 구 없는 시(여수시), 지수 없는 군 → 시도 전체,
//    광주 주소 → 전남광주 아래 광주 구(대구 서구와 안 섞임)
// ② 시점수정 계산기(arm_시점수정.html): ① 시도에 전북·전남광주, 산식 지역 표기 「전북 완산구」「전남 여수시」(전남광주 안 붙임)
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');

global.window={};eval(fs.readFileSync(path.join(root,'arap_index_data.js'),'utf8'));
const idxData=()=>window.ARAP_INDEX_DATA;
const regs=idxData().tables['아파트'].regions;
assert.ok(regs['완산구']&&regs['여수시'],'지수 파일에 전북·전남이 없음');
for(const f of ['s3r86w8a.html','입주권.html']){
  const src=fs.readFileSync(path.join(root,f),'utf8');const re=/const detectSjRegion=[\s\S]*?\n  return null;\};/g;let m,n=0;
  while((m=re.exec(src))){n++;const detectSjRegion=eval('('+m[0].replace(/^const detectSjRegion=/,'').replace(/;$/,'')+')');
    const t=(want,...a)=>assert.equal(detectSjRegion(...a),want,`${f}#${n} ${a.join(' / ')}`);
    t('완산구','전라북도 전주시 완산구 서신동 40-4');
    t('완산구','','','40-4','전라북도 전주시 완산구 서신동 일대','전라북도 전주시 완산');   // 입주권: 사례 소재지 없이 사업위치로
    t('덕진구','전북특별자치도 전주시 덕진구 송천동');
    t('군산시','전북 군산시 조촌동');
    t('전북','전라북도 완주군 삼례읍');                 // 완주군 지수 없음 → 전북 전체
    t('여수시','전라남도 여수시 웅천동');
    t('순천시','전남 순천시 조례동');
    t('무안군','전라남도 무안군 삼향읍');
    t('전남','전라남도 해남군 해남읍');                 // 해남군 지수 없음 → 전남(「전남광주」 묶음 아님)
    t('전남광주 서구','광주광역시 서구 치평동');          // 광주 서구 ≠ 대구 서구
    t('광산구','광주광역시 광산구 수완동');
    // 종전 지역은 그대로
    t('대구 중구','대구광역시 중구 동인동1가');
    t('대구 서구','대구광역시 서구 내당동');            // 광주에도 서구가 있어 키가 「대구 서구」
    t('중구','서울특별시 중구 신당동');
    t('중구','중구 신당동');                            // 시도 없으면 서울(맨 이름 키)
    t('장안구','경기도 수원시 장안구 정자동');
    t('과천시','경기도 과천시 별양동');
    t('광주시','경기도 광주시 오포읍');
    t('강남구','서울특별시 강남구 압구정동');
    t(null,'부산광역시 남구 대연동');                   // 부산은 지수 없음
  }
  assert.ok(n>=1,f+' detectSjRegion 없음');console.log(f,'detect',n,'벌 OK');
}

// ② 시점수정 계산기 + 산식 지역 표기
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);
  res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8');
  const f=path.join(root,n.slice(1));if(!fs.existsSync(f)){res.statusCode=404;return res.end();}res.end(fs.readFileSync(f));});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL});try{
  const ctx=await browser.newContext({viewport:{width:1100,height:800}});
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
  await ctx.addInitScript(()=>{try{localStorage.setItem('arap-user-name','테스트');}catch(e){}});
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto(base+'/'+encodeURI('arm_시점수정.html'));await p.waitForSelector('#r1');
  const st=()=>p.evaluate(()=>{const g=id=>document.getElementById(id);const o=s=>[...s.options].map(x=>x.textContent);
    return {r1:g('r1').value,d3:g('r3').disabled,o1:o(g('r1')),o3:o(g('r3')),region:g('region').value};});
  let s=await st();
  assert.deepEqual(s.o1.slice(0,6),['서울','경기','인천','대구','전북','전남광주'],'시도 순서: '+s.o1);
  await p.selectOption('#r1',{label:'전북'});s=await st();assert.equal(s.d3,false);
  for(const g of ['완산구','덕진구','군산시'])assert.ok(s.o3.some(x=>x.includes(g)),'③에 '+g+': '+s.o3);
  await p.selectOption('#r3',{label:s.o3.find(x=>x.includes('완산구'))});s=await st();assert.equal(s.region,'완산구');
  await p.fill('#tradeDate','2025.03.10');await p.fill('#baseDate','2026.08.01');await p.click('#btn-calc');
  assert.match(await p.inputValue('#resultText'),/지역 : 전북 완산구\n/);
  await p.selectOption('#r1',{label:'전남광주'});s=await st();
  assert.ok(s.o3.some(x=>x.includes('여수시')),'③에 여수시: '+s.o3);
  await p.selectOption('#r3',{label:s.o3.find(x=>x.includes('여수시'))});await p.click('#btn-calc');
  assert.match(await p.inputValue('#resultText'),/지역 : 전남 여수시\n/);
  assert.deepEqual(errs,[]);console.log('arm_시점수정 OK');
  console.log('PASS');
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);process.exit(1);});
