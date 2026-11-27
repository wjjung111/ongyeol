// 비교표준지 「선택」(2026-11-27) — 표준지 A·B를 조회해 두고 쓸 것만 체크
//  ① 둘 다 선택: 종전대로 사례 표 「선정」이 표준지 고르기(A/B), 필지마다 적용 표준지
//  ② B만 선택: 모든 필지가 B, 사례 표는 라디오(표준지 안 고름) → 고른 사례가 자동으로 B와 짝, 그 밖의 요인 블록 하나
//  ③ 표준지별로 골라 둔 사례는 하나만 남길 때 위 선정으로 넘어감 · 마지막 하나는 끌 수 없음 · 다시 켜면 둘 다
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_std_pick.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');
  fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true});const ctx=await browser.newContext({viewport:{width:1700,height:1000}});const page=await ctx.newPage();
  const errs=[],dialogs=[];page.on('pageerror',e=>errs.push(e.message));page.on('dialog',d=>{dialogs.push(d.message());d.accept();});
  await ctx.route('**/*',r=>{const u=r.request().url();if((u.includes('arap_access.js')||u.includes('arap_user.js')))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
  await page.goto(base+'/토지건물.html?mode=land',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.renderLands&&window.calcGongsi&&window.togStd);
  await page.evaluate(()=>{
    const set=(k,v)=>{const el=document.getElementById(k);if(el)el.value=String(v);};
    const tm=f=>({reg:'대구 동구',use:'준주거',from:'25.01.01',to:'26.03.31',factor:f});
    LANDS=[{소재지:'율암동',지번:'1103-1',지목:'장',면적:'1000',용도지역:'준주거',공시지가:'800000',비고:'-',stdIdx:0,gf:['1','1','1','1','1','1'],gaf:['1','1','1','1','1','1']},
           {소재지:'율암동',지번:'1103-2',지목:'장',면적:'500',용도지역:'준주거',공시지가:'800000',비고:'-',stdIdx:1,gf:['1','1','1','1','1','1'],gaf:['1','1','1','1','1','1']}];
    STDS=[{소재지:'상매동',지번:'515-8',지목:'공장용지',면적:'1819.2',공시지가:'861300',용도지역:'준주거'},
          {소재지:'율암동',지번:'1143',지목:'공장용지',면적:'10169.8',공시지가:'846100',용도지역:'준주거'}];
    TRADES=[{loc:'율암동 10',use:'준주거',jimok:'장',date:'2025.01.01',landA:'1000',total:'1000000000',timeMeta:tm('1.01000')},
            {loc:'율암동 20',use:'준주거',jimok:'장',date:'2025.01.01',landA:'1000',total:'1200000000',timeMeta:tm('1.02000')},{}];
    APPRS=[];ETC={type:'t',idx:0,std:0};GA={idx:0};
    for(const [k,v] of Object.entries({base_gijun:'2026.03.31',base_gongsi:'2026.01.01',jb_factor:'1',eTime:'1.01',eArea:'1',eSaj1:'1',eSaj2:'1',eArea2:'1',eInd2:'1',ga_time:'1.01',ga_sajeong:'1',ga_area:'1'}))set(k,v);
    for(let i=1;i<=6;i++)set('e_f'+i,'1.00');
    renderStds();renderLands();renderTrade();renderAppr();syncPick();calcGongsi();
    // 표준지 B에 거래사례 #2를 따로 골라 둠
    setStdCase('etc','t',1,'1');
  });
  const st=()=>page.evaluate(()=>({multi:stdMulti(),act:stdAct(),rowStd:GONGSI_RESULT.rows.map(r=>r.stdIdx),
    tradeSel:document.querySelectorAll('#tblTrade select.std-pick').length,tradeRadio:document.querySelectorAll('#tblTrade input[name="pickTrade"]').length,
    landSel:document.querySelectorAll('#landTbl select, #landBody select').length,
    chk:[...document.querySelectorAll('#stdTbl input[type=checkbox]')].map(c=>c.checked),
    etc:ETC.type+ETC.idx,blocks:ETC_BLOCKS.length,price:GONGSI_RESULT.rows.map(r=>r.price)}));
  const s1=await st();console.log('① 둘 다',s1);
  assert.equal(s1.multi,true);assert.deepEqual(s1.rowStd,[0,1]);assert.ok(s1.tradeSel>0);assert.deepEqual(s1.chk,[true,true]);
  // ② A 끄기 → B만
  const tog=(j,on)=>page.evaluate(([j,on])=>{const c=document.querySelectorAll('#stdTbl input[type=checkbox]')[j];c.checked=on;c.dispatchEvent(new Event('change'));},[j,on]);
  await tog(0,false);
  const s2=await st();console.log('② B만',s2);
  assert.equal(s2.multi,false);assert.deepEqual(s2.act,[1]);assert.deepEqual(s2.rowStd,[1,1]);
  assert.equal(s2.tradeSel,0);assert.ok(s2.tradeRadio>0);assert.deepEqual(s2.chk,[false,true]);
  assert.equal(s2.etc,'t1');   // B에 골라 둔 거래사례 #2가 위 선정으로
  assert.ok(s2.blocks<=1);
  const cid=await page.evaluate(()=>STDS.some(S=>S.etcCid||S.gaCid)||LANDS.some(L=>L.etcPick||L.gaPick));assert.equal(cid,false);
  // 라디오로 다른 사례 고르면 그대로 B와 짝
  const s2b=await page.evaluate(()=>{togEtc('t',0);return {etc:ETC.type+ETC.idx,std:etcStdIdx()};});assert.deepEqual(s2b,{etc:'t0',std:1});
  // ③ 마지막 하나는 끌 수 없음
  await tog(1,false);
  const s3=await st();assert.deepEqual(s3.chk,[false,true]);assert.equal(dialogs.length,1);
  await page.evaluate(()=>{try{showTab('gongsi');}catch(e){}});
  if(process.env.TOJI_OUT)await page.locator('#stdTbl').screenshot({path:path.join(process.env.TOJI_OUT,'toji_std_pick.png')});
  // 의견서 표준지 목록에는 둘 다 남고 B만 선정
  const op=await page.evaluate(()=>ArapTojiOpinion.data().standards.map(x=>[x['표준지_기호'],x._selected]));
  console.log('의견서',op);assert.deepEqual(op,[['A',false],['B',true]]);
  // 다시 켜면 둘 다
  await tog(0,true);
  const s4=await st();assert.equal(s4.multi,true);assert.deepEqual(s4.chk,[true,true]);
  // 저장·복원
  const saved=await page.evaluate(()=>{STDS[0].off=true;const o=JSON.parse(JSON.stringify(collect()));return o.STDS.map(S=>!!S.off);});assert.deepEqual(saved,[true,false]);
  assert.deepEqual(errs,[]);console.log('✅ toji_std_pick 통과');
  await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1);});
