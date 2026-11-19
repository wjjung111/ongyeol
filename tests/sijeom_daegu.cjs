// 주거용 시점수정 지역에 대구(2026-10-28) — 지수 파일에 대구가 들어오면 바로 쓰이는지.
// ① 집건(단일·여러호수)·입주권 detectSjRegion: 대구 주소 → 대구 구(「대구 중구」 ≠ 서울 중구, 달성군), 서울 주소는 종전대로
// ② 시점수정 계산기(arm_시점수정.html): 지역 표에 대구 구·계산, 연립은 대구 전체 지수
// 대구가 아직 지수 파일에 없을 수 있어 가짜 대구 지역을 덧붙여 확인한다.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const S={};for(let y=2020;y<=2026;y++)for(let m=1;m<=12;m++)S[`${y}${String(m).padStart(2,'0')}`]=100+m;
const addDaegu=D=>{const a=D.tables['아파트'].regions;
  a['대구']={cls:1,full:'대구',s:S};a['대구 중구']={cls:2,full:'대구>중구',s:S};a['수성구']={cls:3,full:'대구>수성구',s:S};a['달성군']={cls:4,full:'대구>달성군',s:S};a['남구']={cls:5,full:'대구>남구',s:S};
  D.tables['연립다세대'].regions['대구']={cls:6,full:'대구',s:S};};
const PATCH=`;(function(){var S=${JSON.stringify(S)};(${addDaegu.toString().replace(/\bS\b/g,'S')})(window.ARAP_INDEX_DATA);})();`;

// ① 앱 세 벌의 detectSjRegion을 그대로 떼어 와 실행
global.window={};eval(fs.readFileSync(path.join(root,'arap_index_data.js'),'utf8'));addDaegu(window.ARAP_INDEX_DATA);
const idxData=()=>window.ARAP_INDEX_DATA;
for(const f of ['s3r86w8a.html','입주권.html']){
  const src=fs.readFileSync(path.join(root,f),'utf8');const re=/const detectSjRegion=[\s\S]*?return null;\};/g;let m,n=0;
  while((m=re.exec(src))){n++;const detectSjRegion=eval('('+m[0].replace(/^const detectSjRegion=/,'').replace(/;$/,'')+')');
    const t=(want,...a)=>assert.equal(detectSjRegion(...a),want,`${f}#${n} ${a.join(' / ')}`);
    t('대구 중구','대구광역시 중구 동인동1가','');
    t('대구 중구','대구 중구 대봉동');
    t('수성구','대구광역시 수성구 범어동');
    t('수성구','','대구광역시 수성구 범어동 123');
    t('달성군','대구광역시 달성군 다사읍');
    t('대구 남구','대구광역시 남구 대명동');   // 2026-10-29 광주(전남광주) 남구가 들어와 키가 「대구 남구」
    t('중구','서울특별시 중구 신당동');
    t('강남구','서울특별시 강남구 압구정동');
    t('분당구','경기도 성남시 분당구 정자동');
    t('수성구','수성구 범어동');               // 시도 없이 구만
    t('부산 남구','부산광역시 남구 대연동');          // 2026-10-29 전국 확대로 부산도 지수 있음
  }
  assert.ok(n>=1,f+' detectSjRegion 없음');console.log(f,'detect',n,'벌 OK');
}

// ② 시점수정 계산기
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);
  res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8');
  const f=path.join(root,n.slice(1));if(!fs.existsSync(f)){res.statusCode=404;return res.end();}
  let body=fs.readFileSync(f);if(n==='/arap_index_data.js')body=body.toString()+PATCH;res.end(body);});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL});try{
  const ctx=await browser.newContext({viewport:{width:1100,height:800}});
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
  await ctx.addInitScript(()=>{try{localStorage.setItem('arap-user-name','테스트');}catch(e){}});
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto(base+'/'+encodeURI('arm_시점수정.html'));await p.waitForSelector('#landRegBody tr[data-key]');
  const keys=()=>p.locator('#landRegBody tr[data-key]').evaluateAll(t=>t.map(x=>x.dataset.key));
  const pick=async k=>{await p.fill('#landRegQ','');await p.click(`#landRegBody tr[data-key="${k}"]`);assert.equal(await p.inputValue('#region'),k);};
  const ks=await keys();assert.ok(ks.indexOf('대구')>ks.indexOf('부산')&&ks.indexOf('대구')<ks.indexOf('수성구'),'대구 줄 순서');
  await p.fill('#landRegQ','대구');const dk=await keys();for(const g of ['수성구','달성군','대구 중구'])assert.ok(dk.includes(g),'대구 검색에 '+g+': '+dk);
  await pick('수성구');
  await p.fill('#tradeDate','2025.03.10');await p.fill('#baseDate','2026.08.01');await p.click('#btn-calc');
  assert.match(await p.inputValue('#resultText'),/지역 : 대구 수성구/);
  await pick('대구 중구');await p.click('#btn-calc');assert.match(await p.inputValue('#resultText'),/지역 : 대구 중구/);
  // 연립다세대: 대구 전체만 공표 → 저장된 대구 중구는 「대구」 줄이 선택으로, 대구 지수로 계산
  await p.selectOption('#kind','연립다세대');assert.equal(await p.inputValue('#region'),'대구');
  assert.match(await p.locator('#landRegSel').textContent(),/\(대구 중구 — 연립다세대 지수는 이 단위로 공표\)/);
  await p.click('#btn-calc');assert.match(await p.inputValue('#resultText'),/지역 : 대구\n/);
  assert.deepEqual(errs,[]);console.log('arm_시점수정 OK');
  console.log('PASS');
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);process.exit(1);});
