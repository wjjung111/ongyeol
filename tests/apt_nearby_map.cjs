// 인근 유사 신축 실거래(apt_nearby.html) — 지도(카카오맵 핀) (2026-11-26)
// 네트워크 없이 예시 결과(R) + 가짜 카카오맵으로 핀 개수·색·누르면 목록 펼침을 본다.
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/apt_nearby_map.cjs  (SHOT=파일.png 이면 화면 캡처)
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.css')?'text/css':'text/javascript; charset=utf-8');fs.createReadStream(f).pipe(res);});
// 카카오맵 가짜: 핀(CustomOverlay content)을 지도 상자에 그대로 붙인다(apt_sise_nearby.cjs와 같음)
const KAKAO=`window.kakao={maps:{load:function(cb){cb();},LatLng:function(y,x){this.y=y;this.x=x;},
  Map:function(el,o){this.el=el;el.style.position='relative';this.relayout=function(){};this.setCenter=function(){};this.setLevel=function(){};this.addControl=function(){};},
  ZoomControl:function(){},ControlPosition:{RIGHT:1},
  Circle:function(o){this.setMap=function(){};},
  CustomOverlay:function(o){var c=o.content;if(o.map){var n=o.map.el.querySelectorAll('.npin').length;c.style.position='absolute';c.style.left=(60+(n%2)*300)+'px';c.style.top=(40+n*50)+'px';o.map.el.appendChild(c);}this.setMap=function(m){if(!m&&c.parentNode)c.parentNode.removeChild(c);};}}};`;
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',r=>{const u=r.request().url();if(u.startsWith(base))return r.continue();
      if(u.includes('dapi.kakao.com'))return r.fulfill({contentType:'text/javascript',body:KAKAO});return r.abort();});
    await page.goto(base+'/apt_nearby.html');
    await page.evaluate(()=>{
      const T=(date,price,floor,extra={})=>Object.assign({kind:'매매',date,price:price*1e8,area:59.9,floor,dong:'101',direct:false,cancelled:false},extra);
      R={subject:{addr:'서울 성동구 마장동 800',pnu:'1',x:127.04,y:37.566},candidates:[],sggs:[{code:'1',name:'성동구'}],warns:[],
        params:{area:59.9,tol:3,age:10,radiusKm:2,months:12,date:'2026-11-26',from:'2025-11-26',minYear:2016},
        complexes:[
          {id:'a',name:'우성에비뉴',sgg:'성동구',umd:'마장동',jibun:'835',built:2017,hhld:60,flr:13,dist:1070,own:false,x:127.03,y:37.57,trades:[T('2025-12-15',8.1,6)]},
          {id:'b',name:'보문파크뷰자이',sgg:'성북구',umd:'보문동6가',jibun:'458',built:2017,hhld:1186,flr:20,dist:1580,own:false,x:127.02,y:37.58,trades:[T('2026-08-11',13.8,9),T('2026-05-01',10.5,3)]},
          {id:'c',name:'트리마제(성수)',sgg:'성동구',umd:'성수동1가',jibun:'718',built:2017,hhld:688,flr:47,dist:1900,own:false,x:127.05,y:37.55,trades:[T('2025-10-08',36.5,10)]},
          {id:'d',name:'현대펠리스',sgg:'광진구',umd:'구의동',jibun:'231-18',built:2022,hhld:27,flr:7,dist:1990,own:false,x:127.06,y:37.56,trades:[]},
        ]};
      document.getElementById('result').classList.remove('hidden');render();
    });
    await page.waitForSelector('#nMap .npin',{state:'attached'});
    // 단지 4 + 본건 별 1
    assert.equal(await page.$$eval('#nMap .npin',e=>e.length),5);
    assert.equal(await page.$$eval('#nMap .npin.subj',e=>e.length),1);
    // 거래 없는 단지는 회색(off), 이름표에 중위
    assert.equal(await page.$$eval('#nMap .npin.off',e=>e.length),1);
    assert.match(await page.textContent('#nMap .npin:has-text("보문파크뷰자이")'),/중위 12\.15억 · 2건/);
    assert.match(await page.textContent('#nMap'),/트리마제/);
    assert.doesNotMatch(await page.textContent('#nMap'),/\(성수\)/,'괄호 뗀 짧은 이름');
    // 핀 누르면 강조 + 목록에서 거래 내역 펼침
    await page.click('#nMap .npin:has-text("보문파크뷰자이") .lab');
    assert.ok(await page.$('#nMap .npin.sel:has-text("보문파크뷰자이")'));
    assert.ok(await page.$('#list tr.cx.sel[data-id="b"]'));
    assert.equal(await page.$$eval('#list tr.tr',e=>e.length),2);
    if(process.env.SHOT) await page.screenshot({path:process.env.SHOT,fullPage:false,clip:{x:0,y:250,width:1280,height:700}});
    // 다시 누르면 닫힘
    await page.click('#nMap .npin.sel .lab');
    assert.equal(await page.$$eval('#list tr.tr',e=>e.length),0);
    assert.equal(await page.$$eval('#nMap .npin.sel',e=>e.length),0);
    // 단지 체크 풀면 그 핀 회색
    await page.click('#list input[data-ck="a"]');
    assert.equal(await page.$$eval('#nMap .npin.off',e=>e.length),2);
    assert.match(await page.textContent('#nMap .npin:has-text("우성에비뉴")'),/집계에서 뺀 단지/);
    assert.deepEqual(errors,[]);
    console.log('apt_nearby_map OK');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
