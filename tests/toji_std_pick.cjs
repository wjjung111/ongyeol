// 비교표준지 둘 이상일 때 의견서: 선정한 표준지 행 굵게, 선정사유에 「표준지 A」(굵게·밑줄), 그 밖의 요인 보정치 결정 표는 선정한 표준지만.
// PLAYWRIGHT_MODULE=/path/to/playwright PLAYWRIGHT_CHANNEL=chromium node tests/toji_std_pick.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');
  fs.createReadStream(f).pipe(res);});
// stds: 표준지 수, picks: 필지별 stdIdx
async function fixture(page,stds,picks){return page.evaluate(({stds,picks})=>{
  const set=(k,v)=>document.getElementById(k).value=String(v);
  LANDS=picks.map((si,i)=>({소재지:'검증동',지번:(10+i)+'-1',지목:'대',면적:'100',용도지역:'일반상업',공시지가:'800000',도로교통:'광대한면',형상:'정방형',지세:'평지',stdIdx:si,gf:[1,1,1,1,1,1],gaf:[1,1,1,1,1,1]}));
  STDS=Array.from({length:stds},(_,i)=>({소재지:'표준동',지번:(20+i)+'-1',지목:'대',면적:'150',공시지가:String(1000000+i*100000),용도지역:'일반상업',etcDecide:String(2+i)}));
  TRADES=[{loc:'거래동 30-1',use:'일반상업',jimok:'대',landA:'100',bldA:'0',total:'200000000',date:'2025.01.01',landUnit:'2000000'}];
  APPRS=[];ETC={type:'t',idx:0};GA={idx:0};renderStds();renderLands();
  for(const [k,v] of Object.entries({ov_client:'표준지 검증',ov_caseNo:'STD-TEST',base_gijun:'2026.01.01',base_gongsi:'2026.01.01',base_josa:'2026.01.02',bt_useApr:'2018.01.01',bt_strct:'철근콘크리트',bt_purps:'근린생활시설',bt_flrs:'지상 1층',jb_factor:'1.02',jb_region:'검증시',jb_use:'상업',eTime:'1.02',eArea:'1',eSaj1:'1',eSaj2:'1',eArea2:'1',eInd2:'1',ga_time:'1.03',ga_area:'1',ga_sajeong:'1',op_location:'검증초 북측',op_costSource:'검증 단가표, 2026년',op_costRows:'검증분류\t점포\t철근콘크리트\t3\t1,500,000\t50\t(45~55)'}))set(k,v);
  for(let i=1;i<=6;i++)set('e_f'+i,1);
  document.getElementById('bldBody').innerHTML='';addBldRow({'동':'가','구분':'주','층구분':'지상','층별':'1층','구조':'철근콘크리트','용도':'점포','연면적':'200'});
  window.BLD_STATE={0:{reCost:'1500000',life:'50'}};
  calcGongsi();renderBldCalc();calcFinal();
},{stds,picks});}
async function build(page){return page.evaluate(async()=>{
  const bytes=await ArapTojiOpinion.build(await fetchTplB64('템플릿/토건 의견서(산출근거) 템플릿.hwpx'),ArapTojiOpinion.data());
  const entries=await ArapCheonggu.parseZip(bytes.buffer),HP='http://www.hancom.co.kr/hwpml/2011/paragraph',HH='http://www.hancom.co.kr/hwpml/2011/head';
  const xml=new TextDecoder().decode(entries.find(e=>e.name==='Contents/section0.xml').data),doc=new DOMParser().parseFromString(xml,'application/xml');
  const hd=new DOMParser().parseFromString(new TextDecoder().decode(entries.find(e=>e.name==='Contents/header.xml').data),'application/xml');
  if(doc.querySelector('parsererror')||hd.querySelector('parsererror'))throw Error('XML 오류');
  const cpl=hd.getElementsByTagNameNS(HH,'charProperties')[0],cps=Array.from(cpl.getElementsByTagNameNS(HH,'charPr'));
  const pr={};cps.forEach(c=>pr[c.getAttribute('id')]={bold:!!c.getElementsByTagNameNS(HH,'bold').length,ul:(c.getElementsByTagNameNS(HH,'underline')[0]||{getAttribute(){return '';}}).getAttribute('type'),color:(c.getAttribute('textColor')||'').toUpperCase(),height:c.getAttribute('height')});
  const tbls=Array.from(doc.getElementsByTagNameNS(HP,'tbl'));
  const rowsOf=t=>Array.from(t.children).filter(n=>n.localName==='tr');
  const std=tbls.find(t=>t.textContent.includes('공시지가')&&rowsOf(t)[0].textContent.replace(/\s/g,'').startsWith('일련번호소재지면적'));
  const stdRows=rowsOf(std).slice(2).map(r=>({text:r.textContent.replace(/\s+/g,' ').trim(),prs:Array.from(r.getElementsByTagNameNS(HP,'run')).filter(x=>x.getElementsByTagNameNS(HP,'t').length).map(x=>x.getAttribute('charPrIDRef'))}));
  const etc=tbls.find(t=>rowsOf(t)[0].textContent.replace(/\s/g,'')==='비교표준지사례토지기호그밖의요인보정치적용대상토지(일련번호)');
  const etcRows=rowsOf(etc).slice(1).map(r=>Array.from(r.getElementsByTagNameNS(HP,'tc')).map(c=>c.textContent.trim()));
  const reason=Array.from(doc.documentElement.children).filter(n=>n.localName==='p').find(p=>p.textContent.includes('비교표준지로 선정하였음'));
  const runs=Array.from(reason.getElementsByTagNameNS(HP,'run')).map(r=>({t:r.textContent,pr:r.getAttribute('charPrIDRef')}));
  return {header:{itemCnt:Number(cpl.getAttribute('itemCnt')),count:cps.length,contiguous:cps.every((c,i)=>c.getAttribute('id')===String(i))},pr,stdRows,etcRows,etcRowCnt:etc.getAttribute('rowCnt'),reason:reason.textContent,runs,left:(xml.match(/TW:/g)||[]).length,tokens:(xml.match(/\{\{[^}]+\}\}/g)||[]).length};
});}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
  const errs=[];
  try{
    const ctx=await browser.newContext();const page=await ctx.newPage();
    page.on('pageerror',e=>errs.push(e.message));page.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text());});
    await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js'))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
    await page.goto(base+'/토지건물.html',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.ArapTojiOpinion);

    // ① 표준지 1개: 종전과 같다 — 굵게·문장 변경 없음, 글자모양 목록 그대로
    await fixture(page,1,[0]);
    const one=await build(page);
    console.log('① 표준지 1개',one.stdRows.map(r=>r.prs.join('/')),one.etcRows,one.reason.slice(-30),one.header);
    assert.ok(one.reason.endsWith('같거나 비슷하여 비교표준지로 선정하였음'));
    assert.equal(one.runs.length,1);
    assert.ok(one.stdRows.every(r=>r.prs.every(p=>p==='28')),'양식 글자모양 그대로');
    assert.deepEqual(one.etcRows,[['A','#1','2.00','1']]);
    assert.equal(one.tokens,0);assert.equal(one.left,0);
    const tplCount=one.header.count;

    // ② 표준지 2개, 필지 1개가 A 선정: A 행 굵게, B 행 그대로 / 선정사유 「표준지 A」 굵게+밑줄 / 그밖 결정표에 A만
    await fixture(page,2,[0]);
    const two=await build(page);
    console.log('② 2개 중 A',two.stdRows.map(r=>r.text.slice(0,20)+' '+r.prs.join('/')),two.etcRows,two.reason.slice(-40),two.runs,two.header);
    assert.equal(two.stdRows.length,4,'표준지 2개 × 2행');
    const aPr=two.stdRows[0].prs[0];
    assert.ok(two.stdRows.slice(0,2).every(r=>r.prs.every(p=>p===aPr)),'A 두 행은 같은 쌍둥이');
    assert.ok(two.pr[aPr].bold&&!two.pr['28'].bold&&two.pr[aPr].height===two.pr['28'].height&&two.pr[aPr].ul==='NONE','A = 28의 굵은 쌍둥이');
    assert.ok(two.stdRows.slice(2).every(r=>r.prs.every(p=>p==='28')),'B 행은 양식 글자모양(보통)');
    assert.ok(two.reason.endsWith('같거나 비슷한 표준지 A를 비교표준지로 선정하였음'),two.reason);
    const mid=two.runs.find(r=>r.t==='표준지 A');assert.ok(mid,'「표준지 A」 런');
    assert.ok(two.pr[mid.pr].bold&&two.pr[mid.pr].ul==='BOTTOM'&&two.pr[mid.pr].color==='#000000','굵게+밑줄, 검정');
    assert.equal(two.runs.length,3);assert.equal(two.runs[0].pr,'36');assert.equal(two.runs[2].pr,'36');
    assert.deepEqual(two.etcRows,[['A','#1','2.00','1']],'그 밖의 요인 결정표는 선정한 표준지만');
    assert.equal(two.etcRowCnt,'2');
    assert.equal(two.header.count,tplCount+2,'쌍둥이 2개(굵게 / 굵게+밑줄)');
    assert.equal(two.header.itemCnt,two.header.count);assert.ok(two.header.contiguous);
    assert.equal(two.tokens,0);assert.equal(two.left,0);

    // ③ 필지 2개가 A·B를 각각 선정: 둘 다 굵게, 「표준지 A, B」, 결정표 2행
    await fixture(page,2,[0,1]);
    const both=await build(page);
    console.log('③ A·B 모두',both.stdRows.map(r=>r.prs.join('/')),both.etcRows,both.reason.slice(-40));
    assert.ok(both.stdRows.every(r=>r.prs.every(p=>both.pr[p].bold)));
    assert.ok(both.reason.endsWith('같거나 비슷한 표준지 A, B를 비교표준지로 선정하였음'));
    assert.deepEqual(both.etcRows,[['A','#1','2.00','1'],['B','#1','3.00','2']]);

    // ④ 표준지 2개, 필지가 B 선정: B만 굵게, 「표준지 B」, 결정표에 B만
    await fixture(page,2,[1]);
    const b=await build(page);
    console.log('④ 2개 중 B',b.stdRows.map(r=>r.prs.join('/')),b.etcRows,b.reason.slice(-40));
    assert.ok(b.stdRows.slice(0,2).every(r=>r.prs.every(p=>p==='28')));
    assert.ok(b.stdRows.slice(2).every(r=>r.prs.every(p=>b.pr[p].bold)));
    assert.ok(b.reason.endsWith('표준지 B를 비교표준지로 선정하였음'));
    assert.deepEqual(b.etcRows,[['B','#1','3.00','1']]);

    assert.deepEqual(errs,[]);
    console.log('toji_std_pick OK');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
