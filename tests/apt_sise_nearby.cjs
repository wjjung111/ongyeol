// 아파트시점수정.html — 주변 유사 단지(지도 + 핀 누르면 그 단지 시점수정 + 목록) + 본건 거래표 접기 (2026-11-23)
// 네트워크 없이: 브이월드(주소 검색, 좌표→주소), 프록시 /rtms /rone /bld, 카카오맵 SDK를 가짜로 바꿔 화면만 본다.
// 본건 압구정동 369-1 (127.0300, 37.5300). 반경 1km:
//   한양1차 413 서쪽 400m(강남구) / 신현대 494 동쪽 620m(강남구) / 신반포2차 잠원동 72 서쪽 900m(서초구 — 서초구 지수)
//   미성 512 남쪽 2km(반경 밖) / 99번지 84㎡만(면적 범위 밖) → 목록에 없어야 함
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/apt_sise_nearby.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.css')?'text/css':'text/javascript; charset=utf-8');fs.createReadStream(f).pipe(res);});

const LON=88280,LAT=111320,X0=127.03,Y0=37.53;
const P={ // 지번 → [PNU, 경도, 위도, 세대수, 최고층]
  '압구정동 369-1':['1168011000103690001',X0,Y0,3036,14],
  '압구정동 413':['1168011000104130000',X0-400/LON,Y0,936,13],
  '압구정동 494':['1168011000104940000',X0+620/LON,Y0,1924,15],
  '압구정동 512':['1168011000105120000',X0,Y0-2000/LAT,911,15],
  '압구정동 99':['1168011000100990000',X0+300/LON,Y0,500,12],
  '잠원동 72':['1165010600100720000',X0-900/LON,Y0,1572,12],
};
const deal=(ym,d,amt,area,floor,apt,umd,jibun,built,dong='')=>{const [b,s]=jibun.split('-');
  return `<item><aptNm>${apt}</aptNm><umdNm>${umd}</umdNm><jibun>${jibun}</jibun><dealYear>${ym.slice(0,4)}</dealYear><dealMonth>${+ym.slice(4)}</dealMonth><dealDay>${d}</dealDay>`
  +`<dealAmount>${amt}</dealAmount><excluUseAr>${area}</excluUseAr><floor>${floor}</floor><buildYear>${built}</buildYear><aptDong>${dong}</aptDong><bonbun>${b.padStart(4,'0')}</bonbun><bubun>${(s||'0').padStart(4,'0')}</bubun><landCd>0</landCd></item>`;};
const RT={
  '11680|202610':[deal('202610',16,'900,000','160.28',11,'현대2차(10,11동)','압구정동','369-1',1976,'10'),deal('202610',9,'880,000','160.29',5,'현대2차(10,11동)','압구정동','369-1',1976),
    deal('202610',2,'850,000','163.58',8,'한양1','압구정동','413',1977),deal('202610',5,'450,000','106',3,'한양1','압구정동','413',1977),
    deal('202610',7,'950,000','171.4',9,'신현대','압구정동','494',1982),deal('202610',8,'800,000','160',5,'미성','압구정동','512',1987),
    deal('202610',9,'300,000','84.9',5,'작은단지','압구정동','99',1990)],
  '11680|202605':[deal('202605',20,'860,000','160.28',3,'현대2차(10,11동)','압구정동','369-1',1976),
    deal('202605',27,'800,000','163.58',6,'한양1','압구정동','413',1977),deal('202605',11,'790,000','163.58',3,'한양1','압구정동','413',1977),
    deal('202605',3,'440,000','106',2,'한양1','압구정동','413',1977),deal('202605',12,'920,000','171.4',4,'신현대','압구정동','494',1982)],
  '11650|202610':[deal('202610',12,'750,000','156',7,'신반포2','잠원동','72',1978)],
  '11650|202605':[deal('202605',15,'700,000','156',4,'신반포2','잠원동','72',1978)],
};
const xml=items=>`<?xml version="1.0"?><response><header><resultCode>000</resultCode></header><body><items>${items.join('')}</items><totalCount>${items.length}</totalCount></body></response>`;
const IDX={'530038|202605':98,'530040|202605':96};
const rone=ym=>({SttsApiTblData:[{head:[]},{row:[
  {CLS_ID:530038,DTA_VAL:IDX['530038|'+ym]||100,CLS_FULLNM:'서울>강남지역>동남권>강남구'},
  {CLS_ID:530040,DTA_VAL:IDX['530040|'+ym]||100,CLS_FULLNM:'서울>강남지역>동남권>서초구'},
  {CLS_ID:500008,DTA_VAL:100,CLS_FULLNM:'서울'}]}]});
const bodyOf=list=>({response:{header:{resultCode:'00'},body:{items:list.length?{item:list}:'',totalCount:list.length,pageNo:1}}});
const byPnu=pnu=>Object.values(P).find(v=>v[0]===pnu);
// 카카오맵 가짜: 핀(CustomOverlay content)을 지도 상자에 그대로 붙인다
const KAKAO=`window.kakao={maps:{load:function(cb){cb();},LatLng:function(y,x){this.y=y;this.x=x;},
  Map:function(el,o){this.el=el;this.relayout=function(){};this.setCenter=function(){};this.setLevel=function(){};this.addControl=function(){};},
  ZoomControl:function(){},ControlPosition:{RIGHT:1},
  Circle:function(o){this.setMap=function(){};},
  CustomOverlay:function(o){var c=o.content;if(o.map){var n=o.map.el.querySelectorAll('.npin').length;c.style.position='absolute';c.style.left='60px';c.style.top=(40+n*50)+'px';o.map.el.appendChild(c);}this.setMap=function(m){if(!m&&c.parentNode)c.parentNode.removeChild(c);};}}};`;

(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  try{
    const page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[],calls={rtms:[],rev:0,search:[]};page.on('pageerror',e=>errors.push(e.message));
    const cors={'Access-Control-Allow-Origin':'*'};
    const J=(r,o)=>r.fulfill({headers:cors,contentType:'application/json',body:JSON.stringify(o)});
    await page.route('**/*',r=>{
      const url=r.request().url();
      if(url.startsWith(base))return r.continue();
      const u=new URL(url);
      if(u.hostname==='dapi.kakao.com')return r.fulfill({headers:cors,contentType:'text/javascript',body:KAKAO});
      if(u.hostname==='api.vworld.kr'&&u.pathname==='/req/address'){
        calls.rev++;const [x]=u.searchParams.get('point').split(',').map(Number);
        const w=x<127.022;return J(r,{response:{status:'OK',result:[{structure:{level4LC:w?'1165010600':'1168011000',level4L:w?'잠원동':'압구정동'}}]}});
      }
      if(u.hostname==='api.vworld.kr'){
        const q=u.searchParams.get('query');calls.search.push(q);
        const k=Object.keys(P).find(k=>q.includes(k));
        return J(r,{response:{status:'OK',result:{items:k?[{id:P[k][0],address:{parcel:'서울특별시 '+(k.startsWith('잠원')?'서초구 ':'강남구 ')+k},point:{x:String(P[k][1]),y:String(P[k][2])}}]:[]}}});
      }
      if(u.pathname==='/rone')return J(r,rone(u.searchParams.get('WRTTIME_IDTFR_ID')));
      if(u.pathname==='/rtms'){const k=u.searchParams.get('LAWD_CD')+'|'+u.searchParams.get('DEAL_YMD');calls.rtms.push(k);return r.fulfill({headers:cors,contentType:'application/xml',body:xml(RT[k]||[])});}
      if(u.pathname==='/bld'){const op=u.searchParams.get('op'),v=byPnu(u.searchParams.get('pnu'));
        if(!v)return J(r,bodyOf([]));
        if(op==='getBrRecapTitleInfo')return J(r,bodyOf([{hhldCnt:String(v[3])}]));
        if(op==='getBrTitleInfo')return J(r,bodyOf([{dongNm:'101동',hhldCnt:'0',grndFlrCnt:String(v[4]),mainAtchGbCdNm:'주건축물'}]));
        return J(r,bodyOf([]));}
      return r.abort();
    });
    await page.goto(base+'/아파트시점수정.html');
    const fill=async(id,v)=>{await page.fill('#'+id,'');if(v)await page.type('#'+id,v);};
    const copySel=(sel,from,to,fc=1,tc=4)=>page.evaluate(([sel,from,to,fc,tc])=>{
      const rs=document.querySelectorAll(sel+' tbody tr'),r=document.createRange();
      r.setStart(rs[from].children[fc].firstChild||rs[from].children[fc],0);
      const e=rs[to].children[tc];r.setEnd(e.firstChild||e,(e.firstChild||e).textContent.length?1:0);
      const s=getSelection();s.removeAllRanges();s.addRange(r);
      const dt=new DataTransfer();document.dispatchEvent(new ClipboardEvent('copy',{clipboardData:dt,bubbles:true,cancelable:true}));
      return {txt:dt.getData('text/plain'),html:dt.getData('text/html')};
    },[sel,from,to,fc,tc]);
    const idle=()=>page.waitForFunction(()=>document.getElementById('go').textContent==='계산',null,{timeout:20000});
    const nearIdle=()=>page.waitForFunction(()=>document.getElementById('nGo').textContent==='주변 단지 찾기',null,{timeout:30000});
    await fill('address','서울 강남구 압구정동 369-1');await fill('dong','10');await fill('ho','204');await fill('area','160.28');await fill('wdate','20261123');
    await page.click('#go');await idle();
    assert.notEqual((await page.textContent('#vMid')).trim(),'-');
    assert.ok(await page.isVisible('#nearBox'),'주변 유사 단지 구역');
    assert.ok(await page.isHidden('#nMapWrap'),'찾기 전엔 지도 없음(버튼 눌러야)');
    assert.match(await page.textContent('#nTolHint'),/144\.3 ~ 176\.3㎡/);

    // 1) 주변 단지 찾기 → 반경 안, 면적 맞는 단지만 거리순
    await page.click('#nGo');await nearIdle();
    assert.equal(await page.textContent('#nMsg'),'',await page.textContent('#nMsg'));
    const names=await page.$$eval('#nList tbody tr',rs=>rs.map(r=>r.children[1].textContent.trim()));
    assert.match(names[0],/^본건 단지/);
    assert.equal(await page.$eval('#nList tbody tr',r=>r.children[3].textContent.trim()),'3,036','본건 단지 세대수');
    assert.deepEqual(names.slice(1).map(n=>n.split(' ')[0]),['한양1','신현대','신반포2'],names.join(' | '));
    assert.match(names[3],/잠원동 72, 서초구/);
    assert.ok(calls.rtms.includes('11650|202605'),'반경에 걸친 서초구 실거래도 받음');
    assert.match(await page.textContent('#nInfo'),/단지 3곳 · 강남구, 서초구/);
    // 지도 핀: 본건 ★ + 3곳
    assert.equal(await page.$$eval('#nMap .npin',e=>e.length),4);
    assert.equal(await page.$$eval('#nMap .npin.subj',e=>e.length),1);
    // 세대수, 본건 대비
    const row=n=>page.$$eval('#nList tbody tr',(rs,n)=>{const r=rs.find(r=>r.children[1].textContent.includes(n));return [...r.children].map(td=>td.textContent.trim());},n);
    const hy=await row('한양1');
    assert.equal(hy[3],'936');assert.equal(hy[4],'3','본건 ±10% 면적(163.58)만 집계');assert.equal(hy[0],'400m');

    // 2) 핀 누르면 그 단지 시점수정 상세
    await page.click('#nMap .npin:has-text("한양1") .lab');
    assert.ok(await page.isVisible('#nDetail'));
    assert.match(await page.textContent('#nDetail .t'),/한양1/);
    assert.deepEqual(await page.$$eval('#nChips button',bs=>bs.map(b=>b.textContent+(b.classList.contains('on')?'*':''))),['106㎡ (2건)','163.58㎡ (3건)*']);
    const exp=[850000e4*1,800000e4*100/98,790000e4*100/98].map(p=>p/163.58*160.28).sort((a,b)=>a-b);
    assert.equal((await page.textContent('#nDetail .b.min .v')).trim(),await page.evaluate(v=>ArapAptSise.fmtWon(v),exp[1]),'중간 = 본건 면적 환산 중위');
    assert.equal((await page.textContent('#nDetail .b:first-child .v')).trim(),await page.evaluate(v=>ArapAptSise.fmtWon(v),exp[0]));
    assert.equal(await page.$$eval('#nTbody tr',r=>r.length),5);
    assert.equal(await page.$$eval('#nTbody tr:not(.off)',r=>r.length),3);
    assert.ok(await page.$('#nMap .npin.sel'),'누른 핀 강조');
    assert.ok(await page.$('#nList tr.sel'),'목록 줄도 강조');
    // 면적 칩 106 켜면 집계 늘어남
    await page.click('#nChips button:has-text("106㎡")');
    assert.equal(await page.$$eval('#nTbody tr:not(.off)',r=>r.length),5);
    assert.equal((await row('한양1'))[4],'5');
    await page.click('#nChips button:has-text("106㎡")');
    // 체크 하나 끄면 다시 계산
    await page.click('#nTbody tr:not(.off) input');
    assert.equal((await row('한양1'))[4],'2');
    // 상세 거래표 정렬(본건 표와 같게): 거래가 오름 → 내림, 다른 단지를 열어도 정렬 유지
    const prices=()=>page.$$eval('#nTbody tr',rs=>rs.map(r=>r.children[5].textContent.trim()));
    await page.click('#nDetail th[data-dk=price]');
    assert.deepEqual(await prices(),['44억원','45억원','79억원','80억원','85억원']);
    assert.match(await page.textContent('#nDetail th[data-dk=price]'),/▲/);
    await page.click('#nDetail th[data-dk=price]');
    assert.deepEqual(await prices(),['85억원','80억원','79억원','45억원','44억원']);
    await page.click('#nDetail th[data-dk=include]');
    assert.deepEqual(await page.$$eval('#nTbody tr',rs=>rs.map(r=>r.classList.contains('off'))),[false,false,true,true,true],'집계 먼저');
    await page.click('#nDetail th[data-dk=date]');await page.click('#nDetail th[data-dk=date]');
    // 닫기
    await page.click('#nClose');assert.ok(await page.isHidden('#nDetail'));

    // 3) 목록 줄 누르면 같은 상세 — 서초구 단지는 서초구 지수(2026.05 = 96 → 100/96)
    await page.click('#nList tr:has-text("신반포2")');
    assert.match(await page.textContent('#nDetail .t'),/신반포2/);
    const ratios=await page.$$eval('#nTbody tr',rs=>rs.map(r=>r.children[6].textContent.trim()));
    assert.deepEqual(ratios,['1.00000',(100/96).toFixed(5)]);
    assert.match(await page.textContent('#nDetail'),/지수 서초구/);

    // 4) 세대수 1000 이상만 → 한양1(936) 빠짐(지도, 목록)
    await fill('nMinH','1000');
    assert.deepEqual((await page.$$eval('#nList tbody tr',rs=>rs.map(r=>r.children[1].textContent.trim().split(' ')[0]))).slice(1),['신현대','신반포2']);
    assert.equal(await page.$$eval('#nMap .npin',e=>e.length),3);
    await fill('nMinH','0');

    // 5) 목록 정렬: 본건 면적 환산 중간 높은 순
    await page.click('#nList th[data-nk=mid]');await page.click('#nList th[data-nk=mid]');
    const mids=await page.$$eval('#nList tbody tr',rs=>rs.slice(1).map(r=>parseFloat(r.children[6].textContent)));
    assert.deepEqual(mids,[...mids].sort((a,b)=>b-a));
    // 주변 단지 목록 표도 드래그 복사(머리줄 + 행, 정렬 표시 빠짐)
    const c3=await copySel('#nList',0,1,0,2);
    assert.match(c3.txt.split('\r\n')[0],/^거리\t단지\t준공/);
    assert.equal(c3.txt.split('\r\n').length,3);
    assert.ok(!/[▲▼]/.test(c3.txt),'정렬 표시 빠짐');
    await page.evaluate(()=>getSelection().removeAllRanges());

    // 6) 본건 칩만 바꾸면(같은 주소, 면적) 찾아 둔 주변 단지 유지, 작성일을 바꿔 다시 계산하면 비움
    const nRt=calls.rtms.length;
    await page.click('#areaPick button:has-text("160.29")');await idle();
    assert.ok(await page.isVisible('#nListWrap'),'칩만 바꾸면 유지');
    assert.equal(calls.rtms.filter(k=>k.startsWith('11650')).length,calls.rtms.slice(0,nRt).filter(k=>k.startsWith('11650')).length,'다시 받지 않음');
    await fill('wdate','20261120');await page.click('#go');await idle();
    assert.ok(await page.isHidden('#nListWrap'),'작성일이 바뀌면 다시 찾아야 함');

    // 7) 본건 거래표 접기 → 새로고침해도 접힘, 펴기
    assert.ok(await page.isVisible('#mainTbl'));
    await page.click('#foldTbl');
    assert.ok(await page.isHidden('#mainTbl'));
    assert.match(await page.textContent('#foldTbl'),/펴기 \(\d+건\)/);
    await page.reload();await page.click('#go');await idle();
    assert.ok(await page.isHidden('#mainTbl'),'접은 상태 기억');
    await page.click('#foldTbl');assert.ok(await page.isVisible('#mainTbl'));

    // 7-1) 표 여러 행 드래그 → Ctrl+C: 머리줄 + 고른 행, 금액은 원 숫자(arap_tblcopy.js, 2026-11-24)
    const c1=await copySel('#mainTbl',0,1);
    const L=c1.txt.split('\r\n').map(l=>l.split('\t'));
    assert.deepEqual(L[0],['집계','계약일','동','층','전용(㎡)','거래가(원)','시점수정치','시점수정 ㎡단가','기준시점 거래가격(원)','면적대','비고'],L[0].join('|'));
    assert.equal(L.length,3,'머리줄 + 2행');
    const tr0=await page.$$eval('#tbody tr',rs=>[...rs[0].children].map(td=>td.textContent.trim()));
    assert.equal(L[1][1],tr0[1]);assert.match(L[1][0],/^(○|제외)$/);
    assert.equal(L[1][5],(await page.evaluate(t=>ArapTblCopy.wonOf(t),tr0[5])).toLocaleString('en-US'),'거래가 원 단위 숫자');assert.match(L[1][5],/^\d{1,3}(,\d{3})+$/);
    const sp0=await page.$eval('#tbody tr',tr=>tr.children[8].dataset.v);assert.equal(L[1][8],(+sp0).toLocaleString('en-US'),'기준시점 거래가격은 만원 반올림 말고 원 단위 정확한 값');
    assert.match(c1.html,/<table[\s\S]*<th[^>]*>거래가\(원\)<\/th>[\s\S]*mso-number-format/);
    // 한 칸 안만 고르면 기본 복사(가로채지 않음)
    const c2=await page.evaluate(()=>{const td=document.querySelector('#tbody tr').children[5],r=document.createRange();r.selectNodeContents(td);
      const s=getSelection();s.removeAllRanges();s.addRange(r);const dt=new DataTransfer();
      const ev=new ClipboardEvent('copy',{clipboardData:dt,bubbles:true,cancelable:true});document.dispatchEvent(ev);return ev.defaultPrevented;});
    assert.equal(c2,false,'한 칸 선택은 기본 복사');
    await page.evaluate(()=>getSelection().removeAllRanges());

    // 7-0) 동 칸(국토부 aptDong, 층 왼쪽): 신고된 거래만 「10동」, 나머지 빈칸
    const dongs=await page.$$eval('#tbody tr',rs=>rs.map(r=>r.children[2].textContent.trim()));
    assert.ok(dongs.includes('10동'),dongs.join('|'));assert.ok(dongs.includes(''),'동 없는 거래는 빈칸');
    assert.equal(await page.textContent('#mainTbl th[data-k=dong]').then(t=>t.replace(/[▲▼]/g,'').trim()),'동');
    // 7-2) 줄 선택(2판): 줄 누르면 선택, Shift+누르기 범위 → 아래 막대 「📋 복사」 = 제목 줄 + 고른 줄
    await page.evaluate(()=>{window.__clip={};const o=DataTransfer.prototype.setData;DataTransfer.prototype.setData=function(k,v){window.__clip[k]=v;return o.call(this,k,v);};});
    assert.ok(await page.isHidden('#arapRowBar').catch(()=>true),'고르기 전엔 막대 없음');
    const rowN=await page.$$eval('#tbody tr',r=>r.length);
    await page.click('#tbody tr:nth-child(1) td:nth-child(3)');
    await page.click('#tbody tr:nth-child(3) td:nth-child(5)',{modifiers:['Shift']});
    assert.equal(await page.$$eval('#tbody tr.rsel',r=>r.length),3,'Shift 범위');
    assert.ok(await page.isVisible('#arapRowBar'));
    assert.match(await page.textContent('#arapRowBar .n'),/^3줄 선택$/);
    await page.click('#tbody tr:nth-child(2) td:nth-child(2)'); // 다시 누르면 해제
    assert.equal(await page.$$eval('#tbody tr.rsel',r=>r.length),2);
    const inc0=await page.$eval('#tbody tr:nth-child(2) input',i=>i.checked);
    await page.click('#tbody tr:nth-child(2) input'); // 집계 체크는 원래 동작(선택 안 됨)
    assert.equal(await page.$eval('#tbody tr:nth-child(2) input',i=>i.checked),!inc0);
    assert.equal(await page.$$eval('#tbody tr.rsel',r=>r.length),2);
    await page.click('#tbody tr:nth-child(2) input');
    await page.click('#arapRowBar button[data-a=copy]');
    const B=(await page.evaluate(()=>window.__clip['text/plain'])||'').split('\r\n').map(l=>l.split('\t'));
    assert.equal(B.length,3,'제목 줄 + 2줄');assert.equal(B[0][5],'거래가(원)');assert.equal(B[0][2],'동');
    const d13=await page.$$eval('#tbody tr',rs=>[rs[0],rs[2]].map(r=>r.children[1].textContent.trim()));
    assert.deepEqual(B.slice(1).map(r=>r[1]),d13);
    assert.match(await page.evaluate(()=>window.__clip['text/html']),/<th[^>]*>집계<\/th>/);
    assert.match(await page.textContent('#arapRowBar .n'),/2줄 복사됨/);
    // Ctrl+C로도 / 전체 선택 / Esc 해제
    await page.click('#arapRowBar button[data-a=all]');
    assert.equal(await page.$$eval('#tbody tr.rsel',r=>r.length),rowN);
    await page.evaluate(()=>{window.__clip={};});
    await page.keyboard.press('Control+C');
    assert.equal((await page.evaluate(()=>window.__clip['text/plain'])||'').split('\r\n').length,rowN+1,'Ctrl+C = 제목 + 전체');
    await page.keyboard.press('Escape');
    assert.equal(await page.$$eval('#tbody tr.rsel',r=>r.length),0);
    await page.waitForFunction(()=>document.getElementById('arapRowBar').hidden,null,{timeout:4000});

    // 8) 조회 기록을 열면 주변 단지 찾기 막고 안내
    await page.click('#histList .hopen');
    assert.ok(await page.isDisabled('#nGo'));
    assert.match(await page.textContent('#nInfo'),/다시 조회/);

    assert.deepEqual(errors,[]);
    console.log('apt_sise_nearby: OK');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
