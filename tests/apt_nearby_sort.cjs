// 인근 유사 신축 실거래(apt_nearby.html) — 표 머리 클릭 정렬 + 실거래 목록(최저·중위·최고 근거, 거래별 집계 빼기) (2026-11-20)
// 네트워크 없이 예시 결과(R)를 넣고 화면만 본다.
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/apt_nearby_sort.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.css')?'text/css':'text/javascript; charset=utf-8');fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  try{
    const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
    await page.goto(base+'/apt_nearby.html');
    await page.evaluate(()=>{
      const T=(date,price,floor,extra={})=>Object.assign({kind:'매매',date,price:price*1e8,area:59.9,floor,dong:'101',direct:false,cancelled:false},extra);
      R={subject:{addr:'테스트 주소',pnu:'1'},candidates:[],sggs:[{code:'1',name:'성동구'}],warns:[],
        params:{area:59.9,tol:3,age:10,radiusKm:5,months:12,date:'2026-11-20',from:'2025-11-20',minYear:2016},
        complexes:[
          {id:'a',name:'우성에비뉴',sgg:'성동구',umd:'마장동',jibun:'835',built:2017,hhld:60,flr:13,dist:1070,own:false,trades:[T('2025-12-15',8.1,6)]},
          {id:'b',name:'보문파크뷰자이',sgg:'성북구',umd:'보문동6가',jibun:'458',built:2017,hhld:1186,flr:20,dist:3180,own:false,trades:[T('2026-08-11',13.8,9),T('2026-05-01',10.5,3),T('2026-03-01',12.15,12,{direct:true})]},
          {id:'c',name:'트리마제',sgg:'성동구',umd:'성수동1가',jibun:'718',built:2017,hhld:688,flr:47,dist:3190,own:false,trades:[T('2025-10-08',36.5,10),T('2026-01-08',37,20)]},
          {id:'d',name:'현대펠리스',sgg:'광진구',umd:'구의동',jibun:'231-18',built:2022,hhld:27,flr:7,dist:4310,own:false,trades:[]},
        ]};
      document.getElementById('result').classList.remove('hidden');render();
    });
    const col=(sel,j)=>page.$$eval(sel+' tr',(rs,j)=>rs.slice(1).map(r=>r.children[j]?.textContent.trim()),j);
    const big=async()=>(await page.textContent('#big')).replace(/\s+/g,'');

    // 실거래 목록: 집계 5건(직거래 빠짐), 처음엔 거래가 오름차순, 최저·중위·최고 표시
    assert.deepEqual(await col('#trades',9),['8.10','10.50','13.80','36.50','37.00']);
    assert.deepEqual(await col('#trades',12),['최저','','중위','','최고']);
    await page.click('#trades th[data-sk=price]');
    assert.deepEqual(await col('#trades',9),['37.00','36.50','13.80','10.50','8.10']);

    // 단지 목록: 최고 오름 → 내림, 거래 없는 단지(빈 값)는 늘 맨 아래
    await page.click('#list th[data-sk=max]');
    assert.deepEqual(await col('#list',10),['8.10','13.80','37.00','']);
    await page.click('#list th[data-sk=max]');
    assert.deepEqual(await col('#list',10),['37.00','13.80','8.10','']);
    assert.match(await page.textContent('#list th[data-sk=max]'),/▼/);

    // 규모별: 중위 오름
    await page.click('#byScale th[data-sk=mid]');
    assert.deepEqual(await col('#byScale',0),['소규모','대단지']);

    // 거래 하나(37억) 빼면 집계 다시: 4건 중위 = (10.50+13.80)/2 = 12.15, 뺀 줄은 회색으로 남음
    const i=await page.$$eval('#trades tr',rs=>rs.findIndex(r=>r.children[9]?.textContent.trim()==='37.00')-1);
    await page.click(`#trades input[data-ti="${i}"]`);
    assert.match(await big(),/중위\(4건,3개단지\)12\.15억/);
    assert.match(await big(),/최고36\.50억/);
    assert.equal(await page.$$eval('#trades tr.off',rs=>rs.length),1);
    assert.deepEqual(await col('#trades',12),['','최고','중위','중위','최저']);
    // 다시 켜면 원래대로
    await page.click(`#trades input[data-ti="${i}"]`);
    assert.match(await big(),/중위\(5건,3개단지\)13\.80억/);

    // 빠진 거래도 보기: 직거래 줄이 같이 보이고 중위 표시는 안 붙음
    await page.check('#showOff');
    assert.equal((await col('#trades',12)).filter(x=>x==='직거래').length,1);

    // 입주권 환산 표: 입주권 내림
    await page.fill('#kwon','5.4');await page.fill('#bun','4.84');
    await page.click('#ipjT th[data-sk=ipj]');await page.click('#ipjT th[data-sk=ipj]');
    assert.equal((await col('#ipjT',0))[0],'전체 최고');

    assert.deepEqual(errors,[]);
    console.log('apt_nearby_sort OK');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
