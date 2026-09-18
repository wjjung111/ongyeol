// 그 밖의 사항(의견서 Ⅰ. 6항) — 첫 탭 목록: 기본 가·나·다, 사이에 끼워 넣으면 가·나·다·라 재부여, 저장·복원, 의견서 6항 문단 갈아 끼우기.
// PLAYWRIGHT_MODULE=/path/to/playwright PLAYWRIGHT_CHANNEL=chromium node tests/toji_etc_items.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');
  fs.createReadStream(f).pipe(res);});
async function fixture(page){return page.evaluate(()=>{
  const set=(k,v)=>document.getElementById(k).value=String(v);
  LANDS=[{소재지:'검증동',지번:'10-1',지목:'대',면적:'100',용도지역:'일반상업',공시지가:'800000',도로교통:'광대한면',형상:'정방형',지세:'평지',stdIdx:0,gf:[1,1,1,1,1,1],gaf:[1,1,1,0.95,1.05,1]}];
  STDS=[{소재지:'표준동',지번:'20-1',지목:'대',면적:'150',공시지가:'1000000',용도지역:'일반상업',etcDecide:'2'}];
  TRADES=Array.from({length:3},(_,i)=>({loc:'거래동 '+(30+i)+'-1',use:'일반상업',jimok:'대',landA:'100',bldA:'0',total:'200000000',date:'2025.01.01',landUnit:'2000000'}));
  APPRS=[{no:'a',loc:'평가동 40-1',use:'일반상업',jimok:'대',cond:'상업용',unit:'2100000',base:'2025.02.01',purp:'시가참고'}];
  ETC={type:'t',idx:0};GA={idx:0};renderStds();renderLands();
  for(const [k,v] of Object.entries({ov_client:'검증 의뢰인',ov_caseNo:'ETC-TEST',ov_purpose:'담보',base_gijun:'2026.01.01',base_gongsi:'2026.01.01',base_josa:'2026.01.02',bt_useApr:'2018.01.01',bt_strct:'철근콘크리트',bt_purps:'근린생활시설',bt_flrs:'지상 2층',jb_factor:'1.02',jb_region:'검증시 검증구',jb_use:'상업',eTime:'1.02',eArea:'1',eSaj1:'1',eSaj2:'1',eArea2:'1',eInd2:'1',ga_time:'1.03',ga_area:'1',ga_sajeong:'1',op_location:'검증초등학교 북측',op_costSource:'검증용 단가표, 2026년',op_costRows:'검증분류\t점포\t철근콘크리트\t3\t1,500,000\t50\t(45~55)'}))set(k,v);
  for(let i=1;i<=6;i++)set('e_f'+i,1);
  document.getElementById('bldBody').innerHTML='';addBldRow({'동':'가','구분':'주','층구분':'지상','층별':'1층','구조':'철근콘크리트','용도':'점포','연면적':'200'});
  window.BLD_STATE={0:{reCost:'1500000',life:'50'}};
  calcGongsi();renderBldCalc();calcFinal();
});}
// 의견서를 만들어 6항 본문(제목 다음 ~ Ⅱ. 대상물건 개요 전)의 문단 텍스트 목록을 돌려준다
async function etcSection(page){return page.evaluate(async()=>{
  const bytes=await ArapTojiOpinion.build(await fetchTplB64('템플릿/토건 의견서(산출근거) 템플릿.hwpx'),ArapTojiOpinion.data());
  const entries=await ArapCheonggu.parseZip(bytes.buffer),sec=entries.find(e=>e.name==='Contents/section0.xml');
  const xml=new TextDecoder().decode(sec.data),doc=new DOMParser().parseFromString(xml,'application/xml');
  if(doc.querySelector('parsererror'))throw Error('XML 오류');
  const HP='http://www.hancom.co.kr/hwpml/2011/paragraph';
  const ps=Array.from(doc.documentElement.children).filter(n=>n.namespaceURI===HP&&n.localName==='p');
  const h=ps.findIndex(p=>/^6\.\s*그 밖의 사항/.test(p.textContent.trim()));
  const out=[];let lines=0;const pr0=ps[h+1].getAttribute('paraPrIDRef');
  for(let i=h+1;i<ps.length;i++){const p=ps[i];if(/^Ⅱ/.test(p.textContent.trim())||p.getAttribute('paraPrIDRef')!==pr0)break;   // 6항 본문 = 같은 문단모양이 이어지는 동안(그 뒤 빈 줄은 절 간격)
    if(p.getElementsByTagNameNS(HP,'lineseg').length)lines++;
    const runs=Array.from(p.children).filter(n=>n.localName==='run').map(r=>({pr:r.getAttribute('charPrIDRef'),t:Array.from(r.getElementsByTagNameNS(HP,'t')).map(t=>t.textContent).join('')}));
    out.push({pr:p.getAttribute('paraPrIDRef'),text:p.textContent,runs});}
  return {paras:out,lines,tokens:(xml.match(/\{\{[^}]+\}\}/g)||[]).length};
});}
const items=()=>Array.from(document.querySelectorAll('#etcItemsBox .etc-item')).map(d=>({lab:d.querySelector('.lab').textContent,val:d.querySelector('textarea').value}));
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
  const errs=[];
  try{
    const ctx=await browser.newContext();const page=await ctx.newPage();
    page.on('pageerror',e=>errs.push(e.message));page.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text());});
    await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js'))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
    page.on('dialog',d=>d.accept());
    await page.goto(base+'/토지건물.html',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.ArapTojiOpinion&&window.renderEtcItems);
    await fixture(page);

    // ① 첫 탭 맨 아래에 양식 기본 문구 가·나·다가 보인다
    const init=await page.evaluate(items);
    console.log('① 기본',init.map(x=>x.lab+' '+x.val.slice(0,12)));
    assert.deepEqual(init.map(x=>x.lab),['가.','나.','다.']);
    assert.ok(init[0].val.startsWith('본건 토지와 건물에 대하여 공부'));
    assert.ok(init[2].val.includes('업무진행시 참고바람.'));
    assert.ok(await page.evaluate(()=>{const c=document.getElementById('etcItemsCard');return !!c&&c.closest('.tab').id==='tab-daesang'&&c.parentElement.lastElementChild===c;}),'첫 탭 맨 아래 카드');

    // ② 양식 그대로일 때 의견서 6항 = 가·빈줄·나·빈줄·다 (양식과 같은 구조, 줄배치 캐시는 제거)
    const plain=await etcSection(page);
    const texts=s=>s.paras.map(p=>p.text.trim()).filter(Boolean);
    console.log('② 기본 의견서',texts(plain).map(t=>t.slice(0,14)));
    assert.deepEqual(texts(plain).map(t=>t.slice(0,2)),['가.','나.','다.']);
    assert.equal(plain.tokens,0);
    assert.equal(plain.paras.filter(p=>p.text.trim()).map(p=>p.runs.length).join(','),'2,2,2','번호 런 + 본문 런');
    assert.equal(plain.paras.filter(p=>p.text.trim()).map(p=>p.runs.map(r=>r.pr).join('/')).join(' '),'32/36 32/36 32/36','양식과 같은 글자모양');
    assert.ok(texts(plain)[2].includes('본건은 담보 목적의 감정평가로서'),'평가목적 치환이 항목에도 적용');
    assert.ok(!texts(plain)[0].includes('현황      토지'),'양식의 정렬용 여러 칸 공백은 한 칸으로');

    // ③ 가 아래에 새 항목을 끼워 넣으면 가·나·다·라로 다시 매겨진다 (새 항목이 '나')
    await page.evaluate(()=>{etcItemAdd(0);const ta=document.querySelector('#etcItemsBox .etc-item[data-i="1"] textarea');ta.value='본건 건물은 현황 무허가 증축 부분이 있으며 평가에서 제외하였음.';ta.dispatchEvent(new Event('input',{bubbles:true}));});
    const four=await page.evaluate(items);
    console.log('③ 끼워넣기',four.map(x=>x.lab+' '+x.val.slice(0,10)));
    assert.deepEqual(four.map(x=>x.lab),['가.','나.','다.','라.']);
    assert.ok(four[1].val.startsWith('본건 건물은 현황'));
    assert.ok(four[2].val.startsWith('본건의 소재지'),'원래 나가 다로');
    const sec4=await etcSection(page);
    console.log('③ 의견서',texts(sec4).map(t=>t.slice(0,14)));
    assert.deepEqual(texts(sec4).map(t=>t.slice(0,2)),['가.','나.','다.','라.']);
    assert.ok(texts(sec4)[1].startsWith('나. 본건 건물은 현황 무허가'));
    assert.equal(sec4.paras.length,7,'항목 4 + 사이 빈 줄 3');
    assert.equal(sec4.lines,0,'갈아 끼운 문단은 줄배치 캐시 없음');
    assert.ok(sec4.paras.every(p=>p.pr==='39'),'문단모양은 양식 그대로');

    // ④ 저장·복원: 새로고침해도 네 항목 그대로
    await page.waitForTimeout(600);
    await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.renderEtcItems);
    const back=await page.evaluate(items);
    console.log('④ 복원',back.map(x=>x.lab));
    assert.deepEqual(back.map(x=>x.lab+'|'+x.val.slice(0,8)),four.map(x=>x.lab+'|'+x.val.slice(0,8)));

    // ⑤ 한 항목 안 줄바꿈 → 번호 없는 이어지는 문단 / ▼ 이동 / ✕ 삭제 재부여
    await page.evaluate(()=>{const ta=document.querySelector('#etcItemsBox .etc-item[data-i="1"] textarea');ta.value='첫 줄\n둘째 줄';ta.dispatchEvent(new Event('input',{bubbles:true}));});
    await fixture(page);
    const ml=await etcSection(page);
    const mlTexts=texts(ml);
    console.log('⑤ 줄바꿈',mlTexts.map(t=>t.slice(0,10)));
    assert.equal(mlTexts[1],'나. 첫 줄');assert.equal(mlTexts[2],'둘째 줄');assert.ok(mlTexts[3].startsWith('다.'));
    await page.evaluate(()=>etcItemMove(1,1));
    let mv=await page.evaluate(items);assert.deepEqual(mv.map(x=>x.lab),['가.','나.','다.','라.']);assert.ok(mv[2].val.startsWith('첫 줄'));assert.ok(mv[1].val.startsWith('본건의 소재지'));
    await page.evaluate(()=>etcItemDel(2));
    mv=await page.evaluate(items);assert.deepEqual(mv.map(x=>x.lab),['가.','나.','다.']);assert.ok(!mv.some(x=>x.val.startsWith('첫 줄')));

    // ⑥ 모두 지우면 제목만 남고, 기본 문구로 되돌리기
    await page.evaluate(()=>{ETC_ITEMS.length=0;renderEtcItems();etcItemsChanged();});
    const none=await etcSection(page);
    assert.equal(texts(none).length,0,'항목 없음 → 6항 본문 없음');
    await page.evaluate(()=>etcItemsReset());
    assert.deepEqual((await page.evaluate(items)).map(x=>x.lab),['가.','나.','다.']);

    // ⑦ 새 건(newCase) → 기본 문구, 옛 저장(etcItems 없음) 복원 → 기본 문구
    await page.evaluate(()=>{ETC_ITEMS[0]='바뀐 문구';renderEtcItems();etcItemsChanged();newCase();});
    assert.ok((await page.evaluate(items))[0].val.startsWith('본건 토지와 건물'),'새 건은 기본 문구');
    await page.evaluate(()=>{const o=collect();delete o.etcItems;ETC_ITEMS.length=0;applyForm(o);});
    assert.deepEqual((await page.evaluate(items)).map(x=>x.lab),['가.','나.','다.'],'옛 저장은 기본 문구');

    assert.deepEqual(errs,[]);
    console.log('toji_etc_items OK');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
