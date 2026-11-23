// 기준시가.html 건물 탭 — 여러 동 건물(김포 통진읍 옹정리 336 공장 가·나·다동) + 층별개요가 아직 없는 신축
// ① 동 드롭다운이 뜨고 동마다 표제부·층별개요로 따로 계산 — 결과 표는 동마다 한꺼번에, 📋 표 복사 ② 층별개요가 없으면 표제부 연면적으로 1행 + 노란(경고) 안내, ✅ 아님
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/gjs_bld_multidong.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.css')?'text/css':'text/javascript');fs.createReadStream(f).pipe(res);});
const hub=arr=>({response:{header:{resultCode:'00'},body:{items:{item:arr},numOfRows:200,pageNo:1,totalCount:arr.length}}});
const T=(d,area,roof,fl)=>({regstrGbCdNm:'일반',regstrKindCdNm:'일반건축물',mainAtchGbCdNm:'주건축물',dongNm:d,bldNm:'',totArea:String(area),platArea:'11423',grndFlrCnt:String(fl),strctCdNm:'일반철골구조',roofCdNm:'기타지붕',etcRoof:roof,mainPurpsCdNm:'공장',etcPurps:'',useAprDay:'20260903'});
const TITLES=[T('다동',621.14,'준불연판넬지붕',2),T('가동',800,'불연판넬지붕',1),T('나동',740,'불연판넬지붕',1)];
const F=(d,no,area)=>({dongNm:d,flrGbCd:'20',flrGbCdNm:'지상',flrNo:String(no),flrNoNm:no+'층',mainPurpsCdNm:'공장',etcPurps:'',area:String(area),mainAtchGbCdNm:'주건축물',strctCdNm:'일반철골구조'});
let FLOORS=[];
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL});
  try{
    const ctx=await browser.newContext(),pg=await ctx.newPage(),errors=[];
    pg.on('pageerror',e=>errors.push(e.message));
    await ctx.route('**/*',r=>{const u=r.request().url();
      if(u.startsWith(base))return r.continue();
      if(u.includes('/req/search'))return r.fulfill({json:{response:{status:'OK',result:{items:[{id:'4157025624103360000',title:'옹정리 336',address:{parcel:'경기도 김포시 통진읍 옹정리 336'}}]}}}});
      if(u.includes('getLandCharacteristics'))return r.fulfill({json:{landCharacteristicss:{field:[{stdrYear:'2026',pblntfPclnd:'300000',lndpclAr:'11423'}]}}});
      if(u.includes('getIndvdHousingPriceAttr'))return r.fulfill({json:{indvdHousingPrices:{field:[]}}});
      if(u.includes('workers.dev/bld')){const op=new URL(u).searchParams.get('op');
        if(op==='getBrTitleInfo')return r.fulfill({json:hub(TITLES)});
        if(op==='getBrFlrOulnInfo')return r.fulfill({json:hub(FLOORS)});
        return r.fulfill({json:hub([])});}
      return r.abort();});
    await pg.addInitScript(()=>{try{localStorage.setItem('arap-user-name','wdw');}catch(e){}
      window.__clip=[];Object.defineProperty(navigator,'clipboard',{value:{writeText:t=>{window.__clip.push(t);return Promise.resolve();}}});});
    await pg.goto(base+'/기준시가.html',{waitUntil:'domcontentloaded'});
    // ── 1) 신축: 층별개요 없음 ──
    await pg.fill('#qDate','2026-11-02');
    await pg.fill('#qAddr','김포시 통진읍 옹정리 336');
    await pg.click('#qGo');
    await pg.waitForSelector('#qDongRow',{state:'visible'});
    // 동 순서: 가·나·다(이름순), 첫 동 자동
    assert.deepEqual(await pg.$$eval('#qDong option',a=>a.map(o=>o.textContent.split(' · ')[0])),['가동','나동','다동']);
    const st1=await pg.textContent('#qStatus');
    assert.match(st1,/층별개요가 공공 API에 아직 없습니다/);assert.doesNotMatch(st1,/✅/);
    assert.equal(await pg.$eval('#qStatus',e=>e.className),'status err');
    let R=await pg.evaluate(()=>rows.map(r=>({area:+r.area,label:r.label})));
    assert.equal(R.length,1);assert.equal(R[0].area,800);assert.match(R[0].label,/가동 전체 공장/);
    assert.equal(await pg.$eval('#builtYear',e=>e.value),'2026');
    // 기타지붕 + 불연판넬지붕 → 판넬 0.8, 전체 한 줄엔 상가 1층 조정 없음
    assert.equal(await pg.$eval('#roof',e=>e.value),'0.8');
    assert.equal(await pg.evaluate(()=>rows[0].ftype),'none');
    assert.match(await pg.$eval('#siteName',e=>e.value),/가동$/);
    // 📄 건축물대장 보기 → 아래로 펼침, 고른 동 표제부·동 목록·층별개요 없음 안내
    assert.equal(await pg.isVisible('#toggleBld'),true);
    assert.equal(await pg.$eval('#qBldWrap',e=>e.classList.contains('open')),false);
    await pg.click('#toggleBld');
    assert.equal(await pg.$eval('#qBldWrap',e=>e.classList.contains('open')),true);
    assert.match(await pg.textContent('#toggleBld'),/접기/);
    let bt=await pg.textContent('#qBld');
    assert.match(bt,/건축물대장 · 가동/);assert.match(bt,/2026-09-03/);assert.match(bt,/기타지붕 \(불연판넬지붕\)/);assert.match(bt,/층별개요가 공공 API에 없습니다/);
    assert.equal(await pg.$$eval('#qBld > .tw:first-of-type tbody tr',a=>a.length),3);   // 동 목록 3동
    // 다동으로 바꾸면 621.14㎡·지상 2층
    await pg.selectOption('#qDong','2');
    R=await pg.evaluate(()=>rows.map(r=>+r.area));
    assert.deepEqual(R,[621.14]);
    assert.equal(await pg.$eval('#topFloor',e=>e.value),'2');
    assert.match(await pg.textContent('#qStatus'),/다동/);
    assert.match(await pg.textContent('#qBld'),/건축물대장 · 다동/);   // 펼친 대장도 그 동으로
    // ── 2) 층별개요가 있으면 고른 동 것만 ──
    FLOORS=[F('가동',1,800),F('나동',1,740),F('다동',1,400),F('다동',2,221.14)];
    await pg.click('#qGo');
    await pg.waitForFunction(()=>/✅/.test(document.getElementById('qStatus').textContent));
    R=await pg.evaluate(()=>rows.map(r=>+r.area));
    assert.deepEqual(R,[800]);
    await pg.selectOption('#qDong','2');
    R=await pg.evaluate(()=>rows.map(r=>+r.area));
    assert.deepEqual(R,[400,221.14]);
    assert.match(await pg.textContent('#qStatus'),/✅ 불러옴: .*다동 · 층 2개/);
    // 층별현황: 위층부터, 합계
    assert.deepEqual(await pg.$$eval('#qBld > .tw:last-of-type tbody tr td:first-child',a=>a.map(x=>x.textContent)),['2층','1층','합계']);
    assert.match(await pg.$eval('#qBld > .tw:last-of-type tbody tr:last-child',e=>e.textContent),/621\.14/);
    // ── 2-1) 동마다 결과 표를 한꺼번에(2026-11-23 사용자 요청) — 동 블록 3개 + 전체 요약, 고른 동(다동) 테두리 ──
    const blk=()=>pg.$$eval('#qResult .qdong',a=>a.map(d=>({nm:d.querySelector('.qhead b').textContent,amt:+(d.querySelector('.qhead .amt')||{textContent:'0'}).textContent.replace(/\D/g,''),cur:d.classList.contains('cur'),rows:d.querySelectorAll('table tr').length})));
    let B=await blk();
    assert.deepEqual(B.map(b=>b.nm),['가동','나동','다동']);
    assert.deepEqual(B.map(b=>b.cur),[false,false,true]);
    assert.deepEqual(B.map(b=>b.rows),[3,3,4]);   // 머리글 + 층 + 합계
    // 고른 동 금액 = 그 동을 단독으로 계산한 값, 다른 동도 골라 보면 같은 값
    assert.equal(B[2].amt,await pg.evaluate(()=>window.__calc.totSJ));
    await pg.selectOption('#qDong','0');
    assert.equal(B[0].amt,await pg.evaluate(()=>window.__calc.totSJ));
    const all=+(await pg.$eval('#qResult .qall .qhead .amt',e=>e.textContent)).replace(/\D/g,'');
    assert.equal(all,B[0].amt+B[1].amt+B[2].amt);
    // 「이 동 상세 수정」 → 그 동이 골라지고 상세 입력이 열림
    await pg.click('#qResult [data-qedit="2"]');
    assert.equal(await pg.$eval('#qDong',e=>e.value),'2');
    assert.equal(await pg.isVisible('#detail'),true);
    // 상세에서 고친 값은 그 동에 남음(다른 동 골랐다 와도)
    await pg.fill('#rowsBody input[data-k="area"][data-i="0"]','500');
    const edited=(await blk())[2].amt;assert.ok(edited>B[2].amt,'면적 늘리면 금액도');
    await pg.selectOption('#qDong','1');
    assert.equal((await blk())[2].amt,edited);
    await pg.selectOption('#qDong','2');
    assert.deepEqual(await pg.evaluate(()=>rows.map(r=>+r.area)),[500,221.14]);
    // 📋 표 복사 — 동별 요약 + 빈 줄 + 동 칸 붙은 층 내역(숫자는 쉼표 없이)
    await pg.click('#qResult [data-qcopy]');
    const clip=(await pg.evaluate(()=>window.__clip)).pop().split('\n');
    assert.equal(clip[0],'동\t주용도\t연면적(㎡)\t기준시가(상속·증여용)\t양도용(조정률 없음)');
    assert.match(clip[1],/^가동\t공장\t800\t\d+\t\d+$/);
    assert.match(clip[4],/^합계\t\t2261\.14\t\d+\t\d+$/);   // 다동 1층을 500㎡로 고친 뒤
    assert.equal(clip[5],'');
    assert.equal(clip[6],'동\t층 (용도)\t구조\t용도\t잔가율\t조정률\t㎡당(절사)\t면적(㎡)\t기준시가(원)');
    assert.equal(clip.filter(l=>l.startsWith('다동\t')).length,4);   // 요약 1줄 + 다동 2층 + 합계
    assert.match(await pg.textContent('#qCopyMsg'),/복사됨/);
    // ── 3) 한 동짜리면 드롭다운 없음 ──
    TITLES.splice(1);FLOORS=[F('다동',1,400),F('다동',2,221.14)];
    await pg.click('#qGo');
    await pg.waitForFunction(()=>document.getElementById('qDongRow').hidden&&/✅/.test(document.getElementById('qStatus').textContent));
    assert.deepEqual(await pg.evaluate(()=>rows.map(r=>+r.area)),[400,221.14]);
    assert.equal(await pg.$$eval('#qResult .qdong',a=>a.length),0,'한 동이면 예전 화면');
    await pg.click('#qResult [data-qcopy]');
    const one=(await pg.evaluate(()=>window.__clip)).pop().split('\n');
    assert.equal(one[0],'층 (용도)\t구조\t용도\t잔가율\t조정률\t㎡당(절사)\t면적(㎡)\t기준시가(원)');
    assert.equal(one.length,4);assert.match(one[3],/^건물 합계 \(상속·증여용\)\t\t\t\t\t\t621\.14\t\d+$/);
    assert.deepEqual(errors,[]);
    console.log('OK gjs_bld_multidong');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
