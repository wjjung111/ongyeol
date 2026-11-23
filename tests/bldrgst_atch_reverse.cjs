// 건축물대장.html — 관련지번(부속지번)만 넣어도 대표지번 건물이 나오게(2026-11-23 사용자 요청, 포천 소흘읍 고모리 60-3 외 10필지)
// 61(관련지번) 조회 → 대장 없음 → 주변 필지(연속지적도 BOX) 중 대장 관련지번 목록에 61이 있는 60-3을 찾아 다시 조회
// 도로(도)·구거(구) 지목은 건너뜀, 어디에도 없으면 예전처럼 「찾지 못했습니다」
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/bldrgst_atch_reverse.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':'text/javascript');fs.createReadStream(f).pipe(res);});
const hub=arr=>({response:{header:{resultCode:'00'},body:{items:{item:arr},numOfRows:200,pageNo:1,totalCount:arr.length}}});
const P=(bun,ji,san)=>'4165025021'+(san?'2':'1')+String(bun).padStart(4,'0')+String(ji||0).padStart(4,'0');
const MAIN=P(60,3),ME=P(61);
const FEAT=(pnu,jibun)=>({type:'Feature',properties:{pnu,jibun,addr:'경기도 포천시 소흘읍 고모리 '+jibun.replace(/\s*\S$/,'')}});
const AROUND=[FEAT(ME,'61 대'),FEAT(P(59),'59 도'),FEAT(P(61,1),'61-1 구'),FEAT(P(62),'62 전'),FEAT(MAIN,'60-3 대'),FEAT(P(70),'70 대')];
const T={regstrGbCdNm:'일반',regstrKindCdNm:'일반건축물',mainAtchGbCdNm:'주건축물',platPlc:'경기도 포천시 소흘읍 고모리 60-3번지',bun:'0060',ji:'0003',dongNm:'1동',totArea:'363.65',mainPurpsCdNm:'동물및식물관련시설'};
const FLR=[{dongNm:'1동',flrGbCdNm:'지상',flrNo:'1',flrNoNm:'1층',mainAtchGbCdNm:'주건축물',strctCdNm:'일반철골구조',area:'363.65'}];
const ATCH=[{atchBjdongCd:'25021',atchPlatGbCd:'0',atchBun:'0061',atchJi:'0000'},{atchBjdongCd:'25021',atchPlatGbCd:'0',atchBun:'0062',atchJi:'0000'}];
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL});
  try{
    for(const found of [true,false]){
      const ctx=await browser.newContext(),page=await ctx.newPage(),errors=[],atchAsked=[];
      page.on('pageerror',e=>errors.push(e.message));
      await ctx.route('**/*',r=>{const u=r.request().url();
        if(u.startsWith(base))return r.continue();
        if(u.startsWith('https://api.vworld.kr/req/search'))return r.fulfill({json:{response:{status:'OK',result:{items:[{id:ME,title:'경기도 포천시 소흘읍 고모리 61',address:{parcel:'경기도 포천시 소흘읍 고모리 61'}}]}}}});
        if(u.startsWith('https://api.vworld.kr/req/data')){const sp=new URL(u).searchParams;
          if(sp.get('attrFilter'))return r.fulfill({json:{response:{status:'OK',result:{featureCollection:{type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'Polygon',coordinates:[[[127.10,37.80],[127.101,37.80],[127.101,37.801],[127.10,37.801],[127.10,37.80]]]}}]}}}}});
          assert.match(sp.get('geomFilter'),/^BOX\(127\.09\d*,37\.79\d*,127\.102\d*,37\.802\d*\)$/);
          return r.fulfill({json:{response:{status:'OK',result:{featureCollection:{type:'FeatureCollection',features:AROUND}}}}});}
        if(u.includes('workers.dev/bld')){const sp=new URL(u).searchParams,op=sp.get('op'),pnu=sp.get('pnu'),main=found&&pnu===MAIN;
          if(op==='getBrAtchJibunInfo'){atchAsked.push(pnu);return r.fulfill({json:hub(main?ATCH:[])});}
          if(op==='getBrTitleInfo')return r.fulfill({json:hub(main?[T]:[])});
          if(op==='getBrFlrOulnInfo')return r.fulfill({json:hub(main?FLR:[])});
          return r.fulfill({json:hub([])});}
        return r.abort();});
      await page.addInitScript(()=>{try{localStorage.setItem('arap-user-name','wdw');}catch(e){}});
      await page.goto(base+'/건축물대장.html',{waitUntil:'domcontentloaded'});
      await page.fill('#q','고모리 61');
      await page.click('#btnGo');
      await page.waitForFunction(()=>/✅|실패/.test(document.getElementById('status').textContent));
      const st=await page.textContent('#status');
      // 도로(59 도)·구거(61-1 구)는 안 물어봄, 자기 자신도 안 물어봄. 번호가 가까운 필지부터
      assert.ok(!atchAsked.includes(P(59))&&!atchAsked.includes(P(61,1)),'도로·구거 건너뜀 '+atchAsked);
      assert.equal(atchAsked.filter(p=>p===ME).length,1,'자기 자신은 처음 조회 때 한 번만');
      if(found){
        assert.match(st,/✅ 조회 완료 — 경기도 포천시 소흘읍 고모리 60-3/);
        assert.match(st,/입력한 「경기도 포천시 소흘읍 고모리 61」는 이 건물의 관련지번이라 대표지번으로 조회했습니다/);
        assert.equal(await page.$eval('#result',e=>e.style.display),'block');
        assert.match(await page.$eval('#tblInfo',e=>e.innerText),/60-3 외 2필지/);
        assert.match(await page.inputValue('#q'),/고모리 61/,'입력칸은 그대로');
      }else{
        assert.match(st,/실패: 해당 지번의 건축물대장을 찾지 못했습니다/);
        assert.match(st,/관련지번에서도 이 지번을 찾지 못했으니/);
        assert.deepEqual(atchAsked.slice(1).sort(),[MAIN,P(62),P(70)].sort());
      }
      assert.deepEqual(errors,[]);
      await ctx.close();
    }
    console.log('OK bldrgst_atch_reverse');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
