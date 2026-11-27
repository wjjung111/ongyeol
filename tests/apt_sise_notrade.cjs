// 아파트시점수정.html — 본건 단지에 조회 기간 거래가 없을 때(2026-11-27): 오류로 끝내지 않고 안내 + 「주변 유사 단지」로 이어 간다
// 네트워크 없이: 브이월드(주소 검색, 좌표→주소), 프록시 /rtms /rone /bld, 카카오맵 SDK를 가짜로.
// 본건 삼성동 71-16 (2006년 사용승인, 703호 전용 84.5㎡, 실거래 0건). 반경 1km:
//   가단지 80(2004년, 85㎡, 300m) / 나단지 90(1990년, 84㎡, 500m — 준공 ±5년 밖) / 다단지 95(2008년, 120㎡만 — 면적 밖)
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/apt_sise_notrade.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.css')?'text/css':'text/javascript; charset=utf-8');fs.createReadStream(f).pipe(res);});

const LON=88280,X0=127.05,Y0=37.51,SUBJ='1168010500100710016';
const P={ // 지번 → [PNU, 경도, 위도, 세대수, 최고층]
  '삼성동 71-16':[SUBJ,X0,Y0,120,15],
  '삼성동 80':['1168010500100800000',X0+300/LON,Y0,400,20],
  '삼성동 90':['1168010500100900000',X0-500/LON,Y0,700,15],
  '삼성동 95':['1168010500100950000',X0+600/LON,Y0,250,18],
};
const deal=(ym,d,amt,area,floor,apt,jibun,built)=>{const [b,s]=jibun.split('-');
  return `<item><aptNm>${apt}</aptNm><umdNm>삼성동</umdNm><jibun>${jibun}</jibun><dealYear>${ym.slice(0,4)}</dealYear><dealMonth>${+ym.slice(4)}</dealMonth><dealDay>${d}</dealDay>`
  +`<dealAmount>${amt}</dealAmount><excluUseAr>${area}</excluUseAr><floor>${floor}</floor><buildYear>${built}</buildYear><bonbun>${b.padStart(4,'0')}</bonbun><bubun>${(s||'0').padStart(4,'0')}</bubun><landCd>0</landCd></item>`;};
const RT={
  '11680|202610':[deal('202610',16,'200,000','85',11,'가단지','80',2004),deal('202610',5,'150,000','84',3,'나단지','90',1990),deal('202610',7,'300,000','120',9,'다단지','95',2008)],
  '11680|202605':[deal('202605',20,'196,000','85',3,'가단지','80',2004)],
  '11680|202201':[deal('202201',10,'150,000','84.5',5,'본건단지','71-16',2006)], // 5년 안(3년 밖) 본건 거래
};
const xml=items=>`<?xml version="1.0"?><response><header><resultCode>000</resultCode></header><body><items>${items.join('')}</items><totalCount>${items.length}</totalCount></body></response>`;
const rone=ym=>({SttsApiTblData:[{head:[]},{row:[{CLS_ID:530038,DTA_VAL:ym==='202605'?98:100,CLS_FULLNM:'서울>강남지역>동남권>강남구'},{CLS_ID:500008,DTA_VAL:100,CLS_FULLNM:'서울'}]}]});
const bodyOf=list=>({response:{header:{resultCode:'00'},body:{items:list.length?{item:list}:'',totalCount:list.length,pageNo:1}}});
const byPnu=pnu=>Object.values(P).find(v=>v[0]===pnu);
let recapOn=true; // 본건 총괄표제부(사용승인일) 유무
function bld(u){
  const op=u.searchParams.get('op'),pnu=u.searchParams.get('pnu'),v=byPnu(pnu),ho=u.searchParams.get('hoNm')||'';
  if(!v)return bodyOf([]);
  if(op==='getBrRecapTitleInfo')return bodyOf(pnu===SUBJ&&!recapOn?[]:[{bldNm:pnu===SUBJ?'삼성본건아파트':'',hhldCnt:String(v[3]),useAprDay:pnu===SUBJ?'20060315':''}]);
  if(op==='getBrTitleInfo')return bodyOf([{dongNm:'',bldNm:pnu===SUBJ?'삼성본건아파트':'',hhldCnt:String(v[3]),grndFlrCnt:String(v[4]),ugrndFlrCnt:'2',mainAtchGbCdNm:'주건축물',regstrGbCdNm:'집합',
    useAprDay:pnu===SUBJ&&recapOn?'20060315':'',mgmBldrgstPk:pnu+'0'}]);
  if(op==='getBrExposInfo')return bodyOf(pnu===SUBJ?[{dongNm:'',hoNm:'703호',flrNo:'7',flrGbCdNm:'지상'}]:[]);
  if(op==='getBrExposPubuseAreaInfo')return bodyOf(pnu===SUBJ&&ho==='703호'?[{dongNm:'',hoNm:'703호',exposPubuseGbCdNm:'전유',mainAtchGbCdNm:'주건축물',area:'84.5',flrNo:'7',flrGbCdNm:'지상',mainPurpsCdNm:'공동주택'}]:[]);
  return bodyOf([]);
}
const KAKAO=`window.kakao={maps:{load:function(cb){cb();},LatLng:function(y,x){this.y=y;this.x=x;},
  Map:function(el,o){this.el=el;this.relayout=function(){};this.setCenter=function(){};this.setLevel=function(){};this.addControl=function(){};},
  ZoomControl:function(){},ControlPosition:{RIGHT:1},Circle:function(o){this.setMap=function(){};},
  CustomOverlay:function(o){var c=o.content;if(o.map){var n=o.map.el.querySelectorAll('.npin').length;c.style.position='absolute';c.style.left='60px';c.style.top=(40+n*50)+'px';o.map.el.appendChild(c);}this.setMap=function(m){if(!m&&c.parentNode)c.parentNode.removeChild(c);};}}};`;

(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  try{
    const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const cors={'Access-Control-Allow-Origin':'*'};
    const J=(r,o)=>r.fulfill({headers:cors,contentType:'application/json',body:JSON.stringify(o)});
    await page.route('**/*',r=>{
      const url=r.request().url();
      if(url.startsWith(base))return r.continue();
      const u=new URL(url);
      if(u.hostname==='dapi.kakao.com')return r.fulfill({headers:cors,contentType:'text/javascript',body:KAKAO});
      if(u.hostname==='api.vworld.kr'&&u.pathname==='/req/address')return J(r,{response:{status:'OK',result:[{structure:{level4LC:'1168010500',level4L:'삼성동'}}]}});
      if(u.hostname==='api.vworld.kr'){
        const q=u.searchParams.get('query'),k=Object.keys(P).sort((a,b)=>b.length-a.length).find(k=>q.includes(k));
        return J(r,{response:{status:'OK',result:{items:k?[{id:P[k][0],address:{parcel:'서울특별시 강남구 '+k},point:{x:String(P[k][1]),y:String(P[k][2])}}]:[]}}});
      }
      if(u.pathname==='/rone')return J(r,rone(u.searchParams.get('WRTTIME_IDTFR_ID')));
      if(u.pathname==='/rtms')return r.fulfill({headers:cors,contentType:'application/xml',body:xml(RT[u.searchParams.get('LAWD_CD')+'|'+u.searchParams.get('DEAL_YMD')]||[])});
      if(u.pathname==='/bld')return J(r,bld(u));
      return r.abort();
    });
    await page.goto(base+'/아파트시점수정.html');
    const fill=async(id,v)=>{await page.fill('#'+id,'');if(v)await page.type('#'+id,v);};
    const idle=()=>page.waitForFunction(()=>document.getElementById('go').textContent==='계산',null,{timeout:20000});
    const found=()=>page.waitForFunction(()=>document.getElementById('nGo').textContent==='주변 단지 찾기'&&/단지 \d+곳/.test(document.getElementById('nInfo').textContent),null,{timeout:30000});
    const names=()=>page.$$eval('#nList tbody tr',rs=>rs.map(r=>r.children[1].textContent.trim().split(' ')[0]+'|'+r.children[2].textContent.trim()));

    // 1) 본건 거래 0건 → 오류 대신 안내, 최저/중간/최고와 거래표는 숨기고 주변 유사 단지가 바로 뜸(누르지 않아도)
    await fill('address','강남구 삼성동 71-16');await fill('ho','703');await fill('wdate','20261127');
    await page.click('#go');await idle();
    assert.ok(!(await page.$('#msg .msg.err')),'오류로 끝나지 않음: '+await page.textContent('#msg'));
    assert.match(await page.textContent('#noTrade'),/본건 단지는 최근 3년 안에 신고된 매매 실거래가 없어요/);
    assert.match(await page.textContent('#noTrade'),/5년까지/);
    assert.equal(await page.inputValue('#area'),'84.5','호로 건축물대장 전용면적');
    assert.match(await page.textContent('#msg'),/건축물대장 703호 전용면적 84\.5㎡를 넣었어요\.$/);
    for(const sel of ['#result>.big','#mainTbl','#copy','#subline'])assert.ok(await page.isHidden(sel),sel+' 숨김');
    assert.ok(await page.isVisible('#nearBox'));
    await found();
    assert.match(await page.textContent('#cinfo'),/사용승인\s*2006\.03\.15/);
    assert.equal(await page.inputValue('#nBuilt'),'2006','본건 준공연도 = 대장 사용승인 연도');
    assert.equal(await page.inputValue('#nAge'),'5','본건 거래가 없으면 준공 ±5년부터');
    assert.deepEqual(await names(),['본건|2006','가단지|2004'],'준공 ±5년, 면적 ±10% 안 단지만');
    assert.match(await page.textContent('#nInfo'),/단지 1곳 · 강남구 · .*준공 2001~2011년/);
    assert.match(await page.$eval('#nList tbody tr',r=>r.textContent),/삼성본건아파트[\s\S]*거래 없음/);
    assert.equal(await page.$$eval('#nMap .npin',e=>e.length),2);
    assert.match(await page.textContent('#nMap .npin.subj'),/본건 · 삼성본건아파트최근 거래 없음/);
    // 단지 상세: 본건 면적(84.5) 환산, 본건 대비 %는 없음
    await page.click('#nList tr:has-text("가단지")');
    const exp=[200000e4,196000e4*100/98].map(p=>p/85*84.5).sort((a,b)=>a-b);
    assert.equal((await page.textContent('#nDetail .b.min .v')).trim(),await page.evaluate(v=>ArapAptSise.fmtWon(v),(exp[0]+exp[1])/2));
    assert.ok(!/본건 중간보다/.test(await page.textContent('#nDetail')));
    await page.click('#nClose');

    // 2) 준공 「전체」로 바꿔 다시 찾으면 1990년 단지도, 면적 밖(120㎡)은 여전히 없음. 직접 바꾼 값은 다시 계산해도 그대로
    await page.selectOption('#nAge','all');await page.click('#nGo');await found();
    assert.deepEqual(await names(),['본건|2006','가단지|2004','나단지|1990']);
    // 본건 준공연도를 직접 1992로 고치고 ±5년 → 나단지만
    await page.selectOption('#nAge','5');await fill('nBuilt','1992');await page.click('#nGo');await found();
    assert.deepEqual(await names(),['본건|1992','나단지|1990']);
    await page.click('#go');await idle();
    assert.equal(await page.inputValue('#nBuilt'),'1992','같은 단지를 다시 계산하면 고친 연도 유지');
    await fill('nBuilt','');

    // 3) 「5년까지」를 체크하면 본건 거래(2022.01)가 나와 보통 화면으로
    await page.check('#long5');await page.click('#go');await idle();
    assert.ok(await page.isHidden('#noTrade'));
    assert.ok(await page.isVisible('#mainTbl'));
    assert.notEqual((await page.textContent('#vMid')).trim(),'-');
    assert.equal(await page.inputValue('#nBuilt'),'2006','실거래 건축년도');
    await page.uncheck('#long5');

    // 4) 대장에 사용승인일이 없으면 준공 조건을 못 건다고 알려 줌(칸에 직접 넣으라고)
    recapOn=false;
    await page.reload();await page.uncheck('#long5'); // 새로고침하면 마지막 계산 때 「5년까지」가 되살아남
    await fill('address','강남구 삼성동 71-16');await fill('ho','');await fill('area','84.5');await fill('wdate','20261127');
    await page.click('#go');await idle();
    await found();
    assert.equal(await page.inputValue('#nBuilt'),'');
    assert.match(await page.textContent('#nMsg'),/본건 준공연도를 몰라 준공 조건은 걸지 못했어요/);
    assert.deepEqual(await names(),['본건|','가단지|2004','나단지|1990']);

    // 5) 면적도 호도 없으면: 안내만(전용면적을 넣으라고), 찾기 버튼 막힘
    await fill('area','');await page.click('#go');await idle();
    assert.match(await page.textContent('#noTrade'),/본건 전용면적\(또는 호\)을 넣고 다시 계산/);
    assert.ok(await page.isDisabled('#nGo'));

    // 6) 지번 없이 단지명만 넣어 거래가 없으면 예전처럼 오류(위치를 몰라 주변을 못 찾음)
    await fill('address','강남구 삼성동 없는단지');await page.click('#go');await idle();
    assert.match(await page.textContent('#msg .msg.err'),/계산할 거래가 없어요/);

    assert.deepEqual(errors,[]);
    if(process.env.SHOT){recapOn=true;await page.reload();await page.uncheck('#long5');await fill('area','');await fill('address','강남구 삼성동 71-16');await fill('ho','703');await fill('wdate','20261127');await page.click('#go');await idle();await found();
      await page.screenshot({path:process.env.SHOT,fullPage:true});}
    console.log('apt_sise_notrade: OK');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
