// 아파트시점수정.html — 거래표 「가치형성요인」 칸 + 「요인 반영가격」(= 기준시점 거래가격 x 요인) (2026-11-26)
// 네트워크 없이: 브이월드, 프록시 /rtms /rone /bld를 가짜로 바꿔 화면만 본다. 본건 압구정동 369-1, 160.28㎡
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/apt_sise_factor.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.css')?'text/css':'text/javascript; charset=utf-8');fs.createReadStream(f).pipe(res);});
const deal=(ym,d,amt,area,floor,dong='')=>`<item><aptNm>현대2차</aptNm><umdNm>압구정동</umdNm><jibun>369-1</jibun><dealYear>${ym.slice(0,4)}</dealYear><dealMonth>${+ym.slice(4)}</dealMonth><dealDay>${d}</dealDay>`
  +`<dealAmount>${amt}</dealAmount><excluUseAr>${area}</excluUseAr><floor>${floor}</floor><buildYear>1976</buildYear><aptDong>${dong}</aptDong><bonbun>0369</bonbun><bubun>0001</bubun><landCd>0</landCd></item>`;
const RT={'11680|202610':[deal('202610',16,'900,000','160.28',11,'10'),deal('202610',9,'880,000','160.28',5)],
  '11680|202605':[deal('202605',20,'860,000','160.28',3),deal('202605',3,'440,000','106',2)]};
const xml=items=>`<?xml version="1.0"?><response><header><resultCode>000</resultCode></header><body><items>${items.join('')}</items><totalCount>${items.length}</totalCount></body></response>`;
const rone=ym=>({SttsApiTblData:[{head:[]},{row:[{CLS_ID:530038,DTA_VAL:ym==='202605'?98:100,CLS_FULLNM:'서울>강남지역>동남권>강남구'},{CLS_ID:500008,DTA_VAL:100,CLS_FULLNM:'서울'}]}]});
const empty={response:{header:{resultCode:'00'},body:{items:'',totalCount:0,pageNo:1}}};

(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  try{
    const page=await browser.newPage({viewport:{width:1500,height:1000},deviceScaleFactor:process.env.SHOT?2:1}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const cors={'Access-Control-Allow-Origin':'*'};
    const J=(r,o)=>r.fulfill({headers:cors,contentType:'application/json',body:JSON.stringify(o)});
    await page.route('**/*',r=>{
      const url=r.request().url();
      if(url.startsWith(base))return r.continue();
      const u=new URL(url);
      if(u.hostname==='api.vworld.kr'&&u.pathname==='/req/address')return J(r,{response:{status:'OK',result:[{structure:{level4LC:'1168011000',level4L:'압구정동'}}]}});
      if(u.hostname==='api.vworld.kr')return J(r,{response:{status:'OK',result:{items:[{id:'1168011000103690001',address:{parcel:'서울특별시 강남구 압구정동 369-1'},point:{x:'127.03',y:'37.53'}}]}}});
      if(u.pathname==='/rone')return J(r,rone(u.searchParams.get('WRTTIME_IDTFR_ID')));
      if(u.pathname==='/rtms')return r.fulfill({headers:cors,contentType:'application/xml',body:xml(RT[u.searchParams.get('LAWD_CD')+'|'+u.searchParams.get('DEAL_YMD')]||[])});
      if(u.pathname==='/bld')return J(r,empty);
      return r.abort();
    });
    await page.goto(base+'/아파트시점수정.html');
    const fill=async(id,v)=>{await page.fill('#'+id,'');if(v)await page.type('#'+id,v);};
    const idle=()=>page.waitForFunction(()=>document.getElementById('go').textContent==='계산',null,{timeout:20000});
    const won=v=>page.evaluate(v=>ArapAptSise.fmtWon(v),v);
    await fill('address','서울 강남구 압구정동 369-1');await fill('dong','10');await fill('ho','204');await fill('area','160.28');await fill('wdate','20261123');
    await page.click('#go');await idle();

    // 1) 머리줄: 기준시점 거래가격 바로 뒤에 가치형성요인, 요인 반영가격
    const heads=await page.$$eval('#mainTbl thead th',t=>t.map(x=>x.textContent.trim()));
    const iS=heads.indexOf('기준시점 거래가격');
    assert.deepEqual(heads.slice(iS,iS+4),['기준시점 거래가격','가치형성요인','요인 반영가격','면적대'],heads.join('|'));
    const rows=()=>page.$$eval('#tbody tr',(rs,i)=>rs.map(r=>({d:r.children[1].textContent.trim(),sp:+r.children[i].dataset.v,f:r.children[i+1].querySelector('input').value,bad:r.children[i+1].querySelector('input').classList.contains('bad'),fp:r.children[i+2].textContent.trim(),fv:r.children[i+2].dataset.v})),iS);
    let R=await rows();
    assert.equal(R.length,3,'160.28㎡ 3건(106㎡는 숨김)');
    assert.ok(R.every(x=>x.f===''&&x.fp===''),'처음엔 빈 칸, 자동으로 채우지 않음');
    const mid0=(await page.textContent('#vMid')).trim();

    // 2) 0.9를 치면 바로 기준시점 거래가격 x 0.90, 칸을 나가면 0.90으로 보임
    const fin=n=>page.locator('#tbody tr').nth(n).locator('.facin');
    await fin(0).click();await page.keyboard.type('0.9');
    R=await rows();
    assert.equal(R[0].fv,String(Math.round(R[0].sp*0.9)),'치는 동안 바로 계산');
    assert.equal(R[0].fp,await won(R[0].sp*0.9));
    assert.equal(R[0].d,'2026.10.16');assert.equal(R[0].sp,9000000000);assert.equal(R[0].fp,'81억원');
    await page.keyboard.press('Enter');
    R=await rows();
    assert.equal(R[0].f,'0.90','0.9 → 0.90');
    assert.ok(await fin(1).evaluate(e=>e===document.activeElement),'Enter = 아랫줄 요인 칸');
    await page.keyboard.type('1.055');await page.keyboard.press('Enter');
    R=await rows();
    assert.equal(R[1].f,'1.055');assert.equal(R[1].fv,String(Math.round(R[1].sp*1.055)));
    // 퍼센트, 잘못 넣은 값, 지우기
    await page.keyboard.type('95%');await page.keyboard.press('Tab');
    R=await rows();
    assert.equal(R[2].f,'0.95');assert.equal(R[2].fv,String(Math.round(R[2].sp*0.95)));
    await fin(2).fill('abc');R=await rows();assert.ok(R[2].bad,'숫자가 아니면 빨간 칸');assert.equal(R[2].fp,'');
    await fin(2).fill('');await fin(2).blur();R=await rows();assert.ok(!R[2].bad);assert.equal(R[2].fp,'');
    assert.equal((await page.textContent('#vMid')).trim(),mid0,'최저, 중간, 최고는 그대로');

    // 3) 정렬해도 넣은 값 유지, 요인 반영가격으로도 정렬(빈 칸은 맨 아래)
    await page.click('#mainTbl th[data-k=factorPrice]');
    R=await rows();
    assert.deepEqual(R.map(x=>x.f),['0.90','1.055',''],R.map(x=>x.d+':'+x.f).join(' '));
    await page.click('#mainTbl th[data-k=factorPrice]');
    R=await rows();assert.deepEqual(R.map(x=>x.f),['1.055','0.90','']);

    // 4) 줄 선택 복사: 넣은 요인과 반영가격(원 단위)이 칸 맞춰 나감
    const g=await page.evaluate(()=>{const t=document.querySelector('#mainTbl table');return ArapTblCopy.grab(t,[...t.tBodies[0].rows]);});
    const iF=g.head.indexOf('가치형성요인');
    assert.equal(g.head[iF+1],'요인 반영가격(원)');assert.equal(g.kind[iF],'num');assert.equal(g.kind[iF+1],'won');
    assert.equal(g.rows[1][iF],'0.90');assert.equal(g.rows[1][iF+1],'8,100,000,000');assert.equal(g.rows[2][iF],'');assert.equal(g.rows[2][iF+1],'');

    // 5) 칩을 눌러 다시 계산해도(같은 단지, 같은 본건) 넣은 값 유지
    await page.click('#areaPick .chips button:has-text("160.28")');await idle();
    R=await rows();
    assert.deepEqual(R.map(x=>x.d+' '+x.f).sort(),['2026.05.20 ','2026.10.09 1.055','2026.10.16 0.90'].sort(),'다시 계산 뒤에도 유지');

    // 6) 새로 고쳐도 조회 기록에서 되살아남
    await page.reload();
    await page.click('#histList .hopen');
    R=await rows();
    assert.deepEqual(R.map(x=>x.d+' '+x.f).sort(),['2026.05.20 ','2026.10.09 1.055','2026.10.16 0.90'].sort(),'조회 기록에 저장');
    assert.equal(R.find(x=>x.d==='2026.10.16').fp,'81억원');
    if(process.env.SHOT)await page.screenshot({path:process.env.SHOT}); // 화면 모양 확인용 캡처

    // 7) 본건(동, 호)을 바꾸면 요인은 넘기지 않음
    await fill('ho','304');await page.click('#go');await idle();
    R=await rows();assert.ok(R.every(x=>x.f===''),'다른 본건이면 빈 칸부터');

    // 화면 깨짐: 입력칸이 줄 높이를 크게 키우지 않고, 표가 가로로 넘치지 않음
    const box=await page.$eval('#tbody tr',r=>({h:r.getBoundingClientRect().height,w:r.querySelector('.facin').getBoundingClientRect().width}));
    assert.ok(box.h<40,'줄 높이 '+box.h);assert.ok(box.w>=56&&box.w<=70,'입력칸 폭 '+box.w);
    assert.deepEqual(errors,[]);
    console.log('apt_sise_factor OK');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
