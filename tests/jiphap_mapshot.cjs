// 집합건물 ③ 위치도 「📸 위치도 확정 → 한글」 — 빨간 틀 캡처 1장 → 6. 위치도 hwpx(소재지 = 건명 풀네임) (2026-11-24, 단일·여러 호수)
// 화면 공유는 가짜 스트림(틀 자리만 빨강) → 잘린 그림이 전부 빨강이어야 정확. 지도 타일은 오프라인이라 안 그려져도 됨.
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/jiphap_mapshot.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict'),zlib=require('zlib');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');fs.createReadStream(f).pipe(res);});
function unzip(buf){const out={};let o=0;while(buf.readUInt32LE(o)===0x04034b50){const m=buf.readUInt16LE(o+8),cs=buf.readUInt32LE(o+18),nl=buf.readUInt16LE(o+26),el=buf.readUInt16LE(o+28);
  const name=buf.slice(o+30,o+30+nl).toString(),d=buf.slice(o+30+nl+el,o+30+nl+el+cs);out[name]=m===8?zlib.inflateRawSync(d):d;o+=30+nl+el+cs;}return out;}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  try{
    for(const mode of ['single','multi']){
      const ctx=await browser.newContext({viewport:{width:1600,height:1000},acceptDownloads:true}),page=await ctx.newPage(),errors=[];
      page.on('pageerror',e=>{if(!/\bL is not defined|kakao|leaflet/i.test(e.message))errors.push(e.message);});page.on('dialog',d=>d.accept());page.setDefaultTimeout(20000);
      await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});return u.startsWith(base)?r.continue():r.abort();});
      await page.addInitScript(({mode})=>{localStorage.setItem('arap-user-name','wdw');(localStorage.setItem('arap-jiphap-mode',mode),sessionStorage.setItem('arap-jiphap-mode',mode));
        navigator.mediaDevices.getDisplayMedia=async function(o){window.__opt=o;const k=1.25,c=document.createElement('canvas');c.width=Math.round(innerWidth*k);c.height=Math.round(innerHeight*k);
          const fr=[...document.querySelectorAll('[id^="mapFrame"]')].find(e=>!/Lab/.test(e.id)&&e.getBoundingClientRect().width>0);
          const x=c.getContext('2d'),paint=()=>{const r=fr.getBoundingClientRect();x.fillStyle='#0000ff';x.fillRect(0,0,c.width,c.height);x.fillStyle='#ff0000';x.fillRect(r.left*k,r.top*k,r.width*k,r.height*k);};
          paint();const s=c.captureStream(10),iv=setInterval(paint,50),t=s.getVideoTracks()[0],stop=t.stop.bind(t);t.stop=()=>{clearInterval(iv);stop();};return s;};
      },{mode});
      await page.goto(base+'/s3r86w8a.html');
      const scope=page.locator(mode==='single'?'#root':'#root-multi');
      const fld=lab=>scope.locator(`xpath=.//span[normalize-space(text())="${lab}"]/following-sibling::input[1]`).first();
      await fld('지번주소').waitFor({timeout:60000});
      await fld('의뢰인').fill('홍길동');
      await fld('지번주소').fill('서울특별시 강동구 성내동 219-12 외 1필지');
      await fld('건물명').fill('해인하우스14차');
      if(mode==='single'){await fld('층').fill('2');await fld('호').fill('202');}
      await scope.getByText('2. 사례 · 가격산출',{exact:true}).click();
      await scope.getByText('3. 위치도 · 청구서',{exact:false}).first().click();
      const btn=scope.getByRole('button',{name:'위치도 확정'});await btn.waitFor();
      await page.waitForFunction(()=>[...document.querySelectorAll('[id^="mapFrame"]')].some(e=>!/Lab/.test(e.id)&&e.getBoundingClientRect().height>100),null,{timeout:10000}).catch(async()=>{
        console.log('dbg',await page.evaluate(()=>[...document.querySelectorAll('[id^="mapWrap"]')].map(w=>[w.id,w.clientWidth,w.clientHeight,!!window.ArapMapShot])));});
      // 틀: 한글 그림 칸 비율, 버튼은 지도 위
      const geo=await btn.evaluate(b=>{const root=b.closest('#root,#root-multi'),f=[...root.querySelectorAll('[id^="mapFrame"]')].find(e=>!/Lab/.test(e.id)),bx=[...root.querySelectorAll('[id^="mapBox"]')][0];
        const fr=f.getBoundingClientRect(),mb=bx.getBoundingClientRect(),br=b.getBoundingClientRect();return {ratio:fr.height/fr.width,inside:fr.left>=mb.left&&fr.right<=mb.right+1,above:br.bottom<=mb.top+1,fh:fr.height};});
      console.log(mode,'틀',geo);
      assert.ok(Math.abs(geo.ratio-56000/50228)<0.01&&geo.inside&&geo.above);
      await page.evaluate(()=>{window.__names=[];const o=URL.createObjectURL;URL.createObjectURL=function(b){window.__blob=b;return o.call(URL,b);};});
      const [dl]=await Promise.all([page.waitForEvent('download',{timeout:20000}),btn.click()]);
      const z=unzip(fs.readFileSync(await dl.path()));
      assert.ok(z['BinData/image1.png'],'그림');assert.equal(Object.keys(z)[0],'mimetype');
      const x=z['Contents/section0.xml'].toString();
      const t=x.match(/<hp:t>[^<]*<\/hp:t>/g).map(s=>s.replace(/<[^>]+>/g,''));
      console.log(mode,'글자',t);
      if(mode==='single')assert.equal(t[4],'서울특별시 강동구 성내동 219-12 외 1필지 해인하우스14차 제2층 제202호');
      else assert.ok(t[4].startsWith('서울특별시 강동구 성내동 219-12 외 1필지 해인하우스14차'),t[4]);
      assert.ok(x.includes('binaryItemIDRef="image1"')&&/<hp:curSz width="50228" height="56000"\/>/.test(x));
      // 잘린 그림 = 틀 자리(전부 빨강)
      const px=await page.evaluate(async b64=>{const im=new Image();im.src='data:image/png;base64,'+b64;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const g=c.getContext('2d');g.drawImage(im,0,0);
        return [[1,1],[im.width-2,1],[1,im.height-2],[im.width-2,im.height-2]].map(([a,b])=>Array.from(g.getImageData(a,b,1,1).data).slice(0,3));},z['BinData/image1.png'].toString('base64'));
      px.forEach(c=>assert.ok(c[0]>200&&c[2]<60,'틀만 잘림 '+c));
      const msg=await scope.locator('[aria-label="위치도 캡처 안내"]').innerText();assert.ok(/받았습니다/.test(msg),msg);
      assert.deepEqual(errors,[]);
      if(mode==='single')await page.screenshot({path:process.env.SHOT||'/tmp/jiphap_mapshot.png'});
      await ctx.close();
    }
    console.log('PASS');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
