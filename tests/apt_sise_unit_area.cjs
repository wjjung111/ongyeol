// 아파트시점수정.html — 본건 전용면적을 비우면 동, 호로 건축물대장 전유면적을 찾아 면적 칸에 넣고 같은 면적 칩을 골라 둔다 (2026-11-23)
// 네트워크 없이: V-World 주소 검색, 프록시 /rtms /rone /bld 를 가짜 응답으로 바꿔 화면만 본다.
// 10동은 369-1 필지 대장에 있음. 주소에 지번이 있으면 그 필지, 단지명만 넣으면 실거래 「현대2차(10,11동)」 거래의 필지에서 찾는지까지 확인.
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/apt_sise_unit_area.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.css')?'text/css':'text/javascript; charset=utf-8');fs.createReadStream(f).pipe(res);});

const PNU_ADDR='1168011000103690000',PNU_UNIT='1168011000103690001';
const deal=(d,amt,area,floor,apt,bubun)=>`<item><aptNm>${apt}</aptNm><umdNm>압구정동</umdNm><jibun>369${bubun?'-'+bubun:''}</jibun><dealYear>2026</dealYear><dealMonth>10</dealMonth><dealDay>${d}</dealDay>`
  +`<dealAmount>${amt}</dealAmount><excluUseAr>${area}</excluUseAr><floor>${floor}</floor><sggCd>11680</sggCd><umdCd>11000</umdCd><landCd>0</landCd><bonbun>0369</bonbun><bubun>${String(bubun||0).padStart(4,'0')}</bubun></item>`;
const RTMS_202610=[deal(16,'900,000','160.28',11,'현대2차(10,11동)',1),deal(9,'880,000','160.28',5,'현대2차(10,11동)',1),deal(3,'660,000','131.48',3,'현대2차(10,11동)',1),
  deal(2,'700,000','160.29',7,'현대1차(12,13동)',0)];
const xml=items=>`<?xml version="1.0"?><response><header><resultCode>000</resultCode><resultMsg>OK</resultMsg></header><body><items>${items.join('')}</items><totalCount>${items.length}</totalCount></body></response>`;
const bodyOf=list=>({response:{header:{resultCode:'00'},body:{items:list.length?{item:list}:'',totalCount:list.length,pageNo:1}}});
// 건축물대장: 주소 필지(369)는 12, 13동 / 실거래 필지(369-1)는 제10동, 제11동
const TITLES={[PNU_ADDR]:['제12동','제13동'],[PNU_UNIT]:['제10동','제11동']};
const UNITS={[PNU_UNIT+'|제10동']:[{hoNm:'203호',flrNo:'2'},{hoNm:'204호',flrNo:'2'},{hoNm:'1204호',flrNo:'12'}]};
function bld(u){
  const op=u.searchParams.get('op'),pnu=u.searchParams.get('pnu'),dong=u.searchParams.get('dongNm')||'',ho=u.searchParams.get('hoNm')||'';
  if(op==='getBrTitleInfo')return bodyOf((TITLES[pnu]||[]).map(d=>({dongNm:d,mainAtchGbCdNm:'주건축물',regstrGbCdNm:'집합',platPlc:'서울특별시 강남구 압구정동 369'})));
  if(op==='getBrExposInfo')return bodyOf((UNITS[pnu+'|'+dong]||[]).map(x=>Object.assign({dongNm:dong,flrGbCdNm:'지상'},x)));
  if(op==='getBrExposPubuseAreaInfo'){
    if(pnu===PNU_UNIT&&dong==='제10동'&&ho==='204호')return bodyOf([
      {dongNm:'제10동',hoNm:'204호',exposPubuseGbCdNm:'전유',mainAtchGbCdNm:'주건축물',area:'160.28',flrNo:'2',flrGbCdNm:'지상',mainPurpsCdNm:'공동주택'},
      {dongNm:'제10동',hoNm:'204호',exposPubuseGbCdNm:'공용',mainAtchGbCdNm:'주건축물',area:'25.1',flrNo:'2',flrGbCdNm:'지상'}]);
    return bodyOf([]);
  }
  return bodyOf([]);
}
const RONE={SttsApiTblData:[{head:[]},{row:[{CLS_ID:530038,DTA_VAL:100,CLS_FULLNM:'서울>강남지역>동남권>강남구'},{CLS_ID:500008,DTA_VAL:100,CLS_FULLNM:'서울'}]}]};

(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  try{
    const page=await browser.newPage(),errors=[],bldCalls=[];page.on('pageerror',e=>errors.push(e.message));
    const cors={'Access-Control-Allow-Origin':'*'};
    await page.route('**/*',r=>{
      const url=r.request().url();
      if(url.startsWith(base))return r.continue();
      const u=new URL(url);
      if(u.hostname==='api.vworld.kr')return r.fulfill({headers:cors,contentType:'application/json',
        body:JSON.stringify({response:{status:'OK',result:{items:[/369-1/.test(u.searchParams.get('query'))?{id:PNU_UNIT,address:{parcel:'서울특별시 강남구 압구정동 369-1'}}:{id:PNU_ADDR,address:{parcel:'서울특별시 강남구 압구정동 369'}}]}}})});
      if(u.pathname==='/rone')return r.fulfill({headers:cors,contentType:'application/json',body:JSON.stringify(RONE)});
      if(u.pathname==='/rtms')return r.fulfill({headers:cors,contentType:'application/xml',body:xml(u.searchParams.get('DEAL_YMD')==='202610'?RTMS_202610:[])});
      if(u.pathname==='/bld'){bldCalls.push(u.searchParams.get('op')+' '+u.searchParams.get('pnu'));return r.fulfill({headers:cors,contentType:'application/json',body:JSON.stringify(bld(u))});}
      return r.abort();
    });
    await page.goto(base+'/아파트시점수정.html');
    const fill=async(id,v)=>{await page.fill('#'+id,'');if(v)await page.type('#'+id,v);};
    const run=async()=>{await page.click('#go');await page.waitForFunction(()=>document.getElementById('go').textContent==='계산',null,{timeout:20000});};
    await fill('address','서울 강남구 압구정동 369-1');await fill('dong','10');await fill('ho','204');await fill('area','');await fill('wdate','20261123');

    // 1) 면적 비움 → 대장에서 160.28 → 칸에 넣고 160.28 칩 골라 집계
    await run();
    assert.equal(await page.inputValue('#area'),'160.28');
    assert.equal(await page.inputValue('#floor'),'2');
    assert.match(await page.textContent('#msg'),/건축물대장 10동 204호 전용면적 160\.28㎡를 넣었어요\. 실거래 160\.28㎡ 거래를 같은 면적으로 골랐습니다/);
    assert.ok(await page.$('#msg .msg.ok'));
    assert.deepEqual(await page.$$eval('#areaPick button.on',bs=>bs.map(b=>b.textContent)),['160.28㎡ (2건)']);
    assert.notEqual((await page.textContent('#vMid')).trim(),'-');
    assert.match(await page.textContent('#subline'),/집계 <?b?>?2/);
    assert.equal(bldCalls[0],'getBrTitleInfo '+PNU_UNIT,'주소로 찾은 필지 대장');
    assert.ok(bldCalls.includes('getBrExposPubuseAreaInfo '+PNU_UNIT));

    // 2) 칩 하나 더 고르면 면적 칸(대장값) 그대로, 대장 다시 안 부름
    let n=bldCalls.length;
    await page.click('#areaPick button:has-text("131.48㎡")');
    await page.waitForFunction(()=>document.getElementById('go').textContent==='계산');
    assert.equal(await page.inputValue('#area'),'160.28');
    assert.equal(bldCalls.length,n);

    // 3) 호를 바꾸면 자동 면적은 비워짐 → 없는 호는 안내만 하고 면적 고르기로
    await fill('ho','999');
    assert.equal(await page.inputValue('#area'),'','자동 면적은 호를 바꾸면 비움');
    await run();
    assert.equal(await page.inputValue('#area'),'');
    assert.match(await page.textContent('#msg'),/건축물대장에서 10동 999호 전용면적을 못 찾았어요/);
    assert.ok(await page.$('#areaPick:not(.hidden)'));
    assert.equal((await page.textContent('#vMid')).trim(),'-');

    // 4) 직접 친 면적은 호를 바꿔도 그대로, 대장 조회 안 함
    await fill('area','131.48');await fill('ho','204');
    assert.equal(await page.inputValue('#area'),'131.48');
    n=bldCalls.length;await run();
    assert.equal(bldCalls.length,n,'면적을 넣었으면 대장 조회 안 함');
    assert.equal(await page.inputValue('#area'),'131.48');

    // 5) 새로고침해도 자동값 표시가 이어짐: 면적 비우고 계산 → F5 → 호 바꾸면 비워짐
    await fill('area','');await run();
    assert.equal(await page.inputValue('#area'),'160.28');
    await page.reload();
    assert.equal(await page.inputValue('#area'),'160.28');
    await fill('ho','205');
    assert.equal(await page.inputValue('#area'),'');

    // 6) 단지명만(지번 없음) → 단지 후보에서 현대2차 → 주소 필지 없음 → 실거래 「현대2차(10,11동)」 거래 필지(369-1)에서 찾음
    await fill('address','강남구 압구정동 현대');await fill('ho','204');await fill('area','');
    n=bldCalls.length;await run();
    assert.equal(bldCalls.length,n,'단지 고르기 전엔 대장 안 부름');
    await page.click('#pick button:has-text("현대2차")');
    await page.waitForFunction(()=>document.getElementById('go').textContent==='계산');
    assert.equal(await page.inputValue('#area'),'160.28');
    assert.equal(bldCalls[n],'getBrTitleInfo '+PNU_UNIT,'실거래 거래의 필지번호로 대장 조회');

    assert.deepEqual(errors,[]);
    console.log('apt_sise_unit_area: OK');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
