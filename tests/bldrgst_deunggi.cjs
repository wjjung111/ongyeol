// 건축물대장.html 「이 호 등기 열람 요청」 — 호를 고른 뒤 버튼 → PC 접수 창구(127.0.0.1:8790)에 주소·동·호 숫자로 요청,
// 결과(고유번호·대지권·대장 전유와 비교)가 같은 카드에 보임. 창구가 꺼져 있으면 3_에이전트.bat 안내.
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/bldrgst_deunggi.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':'text/javascript');fs.createReadStream(f).pipe(res);});
const ADDR='경기도 부천시 원미구 상동 528-3',PNU='4119510900105280003';
const hub=arr=>({response:{header:{resultCode:'00'},body:{items:{item:arr},numOfRows:200,pageNo:1,totalCount:arr.length}}});
const T=d=>({regstrGbCdNm:'집합',regstrKindCdNm:'표제부',mainAtchGbCdNm:'주건축물',platPlc:ADDR+'번지',bun:'0528',ji:'0003',bldNm:'라일락 마을',dongNm:d,totArea:'12128.19',grndFlrCnt:'15',ugrndFlrCnt:'1',hhldCnt:'84',hoCnt:'0',useAprDay:'20020527',mainPurpsCdNm:'공동주택'});
const RECAP={regstrGbCdNm:'집합',regstrKindCdNm:'총괄표제부',platPlc:ADDR+'번지',bun:'0528',ji:'0003',bldNm:'라일락 마을',platArea:'31953',archArea:'5373.97',bcRat:'16.82',totArea:'85145.886',vlRat:'209.82',mainPurpsCdNm:'공동주택',hhldCnt:'454',fmlyCnt:'0',hoCnt:'0',mainBldCnt:'9',atchBldCnt:'7',atchBldArea:'14374.38',totPkngCnt:'778',useAprDay:'',mgmBldrgstPk:'10971496'};
const HO=[{dongNm:'2325동',hoNm:'0902호',flrNo:'9',flrGbCdNm:'지상',exposPubuseGbCdNm:'전유',mainAtchGbCdNm:'주건축물',mainPurpsCdNm:'아파트',area:'112.155',mgmBldrgstPk:'10971135442'},
          {dongNm:'2325동',hoNm:'0902호',flrNo:'1',flrGbCdNm:'지상',exposPubuseGbCdNm:'공용',mainAtchGbCdNm:'주건축물',mainPurpsCdNm:'계단실',area:'60.094'}];
const FIELDS={'고유번호':'1241-1996-012345','전유면적':112.2,'대지권_분모':31953,'대지권_분자':44.3,'확인필요':['대지권 2건 중 첫 건 표시']};
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL});
  try{
    for(const agentOn of [true,false]){
      const ctx=await browser.newContext(),page=await ctx.newPage(),errors=[],posted=[];
      page.on('pageerror',e=>errors.push(e.message));
      await ctx.route('**/*',r=>{const u=r.request().url();
        if(u.startsWith(base))return r.continue();
        if(u.startsWith('https://api.vworld.kr'))return r.fulfill({json:{response:{status:'OK',result:{items:[{id:PNU,title:ADDR,address:{parcel:ADDR}}]}}}});
        if(u.includes('workers.dev/bld')){const sp=new URL(u).searchParams,op=sp.get('op');
          if(op==='getBrTitleInfo')return r.fulfill({json:hub([T('2325동'),T('2326동')])});
          if(op==='getBrRecapTitleInfo')return r.fulfill({json:hub([RECAP])});
          if(op==='getBrExposInfo')return r.fulfill({json:hub([{dongNm:sp.get('dongNm'),hoNm:'0902호',flrNo:'9',flrGbCdNm:'지상'}])});
          if(op==='getBrExposPubuseAreaInfo')return r.fulfill({json:hub(HO)});
          return r.fulfill({json:hub([])});}
        if(u.startsWith('http://127.0.0.1:8790/')){
          if(!agentOn)return r.abort('connectionrefused');
          const action=new URL(u).searchParams.get('action');
          assert.equal(r.request().headers()['origin'],base);           // 창구가 Origin으로 거르므로 반드시 붙어야 함
          if(action==='add'){posted.push(JSON.parse(r.request().postData()));return r.fulfill({json:{ok:true,id:'T-1'}});}
          if(action==='list')return r.fulfill({json:{ok:true,agent_last_seen:'',agent_state:{},jobs:posted.length?[{id:'T-1',status:'완료',fields:FIELDS,file:'C:\\registration coding\\output\\x.pdf',error:''}]:[]}});
        }
        return r.abort();});
      await page.addInitScript(()=>{try{localStorage.setItem('arap-user-name','wdw');}catch(e){}});
      await page.goto(base+'/건축물대장.html',{waitUntil:'domcontentloaded'});
      await page.fill('#q','부천시 상동 528-3');
      await page.click('#btnGo');
      await page.waitForSelector('#hoPanel',{state:'visible'});
      await page.waitForFunction(()=>document.querySelectorAll('#hoSel option').length>1);
      // 호를 고르기 전엔 버튼이 안 보임(호 결과 안에 있음) → 호 선택 → 버튼
      assert.equal(await page.$eval('#hoResult',e=>e.style.display),'none');
      await page.selectOption('#hoSel','0902호');
      await page.waitForSelector('#hoResult',{state:'visible'});
      await page.click('#btnDeunggi');
      if(agentOn){
        await page.waitForFunction(()=>/요청됨 T-1/.test(document.getElementById('dgStatus').textContent));
        assert.deepEqual(posted,[{address:ADDR,dong:'2325',ho:'902',rtype:'집합건물',doc_type:'열람',record_type:'전부(말소사항 포함)',memo:'건축물대장에서 요청'}]);
        await page.waitForSelector('#dgResult',{state:'visible',timeout:15000});   // 4초 뒤 목록 조회 → 완료 표시
        const t=await page.$eval('#tblDg',e=>e.innerText),st=await page.$eval('#dgStatus',e=>e.textContent);
        assert.match(st,/열람 완료/);
        assert.match(t,/1241-1996-012345/);assert.match(t,/31,953분의 44\.3/);assert.match(t,/112\.2㎡/);
        assert.match(t,/건축물대장 전유 112\.155㎡ ≠ 등기 112\.2㎡/);   // 대장과 0.01㎡ 이상 다르면 바로 보임
        assert.match(t,/대지권 2건 중/);assert.match(t,/output\\x\.pdf/);
        // 호를 바꾸면 전 호의 등기 표시는 지워짐
        await page.selectOption('#hoSel','');
        assert.equal(await page.$eval('#dgResult',e=>e.style.display),'none');
        assert.equal(await page.$eval('#dgStatus',e=>e.textContent),'');
      }else{
        await page.waitForFunction(()=>/3_에이전트\.bat/.test(document.getElementById('dgStatus').textContent));
        assert.equal(posted.length,0);
      }
      assert.deepEqual(errors,[]);
      await ctx.close();
    }
    console.log('OK bldrgst_deunggi');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
