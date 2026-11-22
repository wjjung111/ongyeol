// 토지건물 지가변동률 — 파일(arap_jibyun_data.js) 시작월보다 오래된 거래(예 2021.06)가 신설 구(화성시 효행구, 2026.02 신설)에 있을 때
// 프록시로 받은 그 달 표에 효행구가 없으면 같은 표의 상위 지역(화성시) 값을 써야 한다.
// 전에는 상위 지역을 파일에서만 찾아 「2021.06월 변동률이 없습니다」로 멈췄다(2026-11-22 사용자 제보, 정남면 괘랑리 1061-2 사례).
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_jibyun_oldmonth.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');
  fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'msedge':undefined)});
  const ctx=await browser.newContext();const page=await ctx.newPage();const errs=[];
  page.on('pageerror',e=>errs.push(e.message));
  await ctx.route('**/*',r=>{const u=r.request().url();
    if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});
    if(u.startsWith(base))return r.continue();return r.abort();});
  await page.goto(base+'/토지건물.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.roneCumulative&&window.ARAP_JIBYUN_DATA);
  const MOCK=0.1;   // 파일 밖 달에 프록시가 돌려줄 화성시 주거지역 변동률(%) — 효행구 줄은 없음(신설 전)
  const r=await page.evaluate(async MOCK=>{
    const F=ARAP_JIBYUN_DATA,first=+F.months[0],asked=[];
    jbState.latestYm=+F.latestYm;jbState.tbl=F.tbl;jbState.useF=null;
    window.jbMonthRows=async(id,ym)=>{asked.push(ym);
      if(ym>=first)throw new Error('파일 안 달은 통신하면 안 됨 '+ym);
      // 실제 표처럼 지역이 여럿이어야 표 구조 판별(jbDetect)이 지역 칸을 찾는다 — 수원시는 다른 값(섞이면 안 됨)
      return [['화성시',MOCK],['수원시',9]].flatMap(([sg,v])=>['주거지역','상업지역'].map(u=>({ITM_NM:u,ITM_FULLNM:u,CLS_NM:sg,CLS_FULLNM:'경기>'+sg,GRP_NM:'',GRP_FULLNM:'',DTA_VAL:String(v)})));};
    const g={y:2021,mo:6,d:25},e={y:2026,mo:11,d:22};
    let factor=null,err=null;
    try{factor=(await roneCumulative('경기 > 화성시 > 효행구','주거지역',g,e)).toFixed(5);}catch(x){err=x.message;}
    return {factor,err,asked,first};
  },MOCK);
  console.log({factor:r.factor,err:r.err,asked:r.asked.length+'개월',first:r.first});
  assert.equal(r.err,null,'오류 없이 계산돼야 함');
  // 기대값: 2021.06(25~30일 일할)~파일 시작 전 달 = 화성시(프록시), 파일 안 달 = 효행구(없으면 화성시), 최신 공표월 뒤는 마지막 변동률 일할
  const exp=(()=>{const w={};new Function('window',fs.readFileSync(path.join(root,'arap_jibyun_data.js'),'utf8'))(w);
    const F=w.ARAP_JIBYUN_DATA,latest=+F.latestYm,first=+F.months[0],days=(y,m)=>new Date(y,m,0).getDate();
    const own=(F.rates['경기 > 화성시 > 효행구']||{})['주거지역']||{},par=F.rates['경기 > 화성시']['주거지역'];
    const add=ym=>{let y=Math.floor(ym/100),m=ym%100+1;if(m>12){y++;m=1;}return y*100+m;};
    let f=1,last=null;
    for(let ym=202106;ym<=202611;ym=add(ym)){const y=Math.floor(ym/100),m=ym%100;
      if(ym>latest){const d0=new Date(y,m-1,1),d=Math.round((new Date(2026,10,22)-d0)/864e5)+1;f*=1+last.r/100*d/days(Math.floor(last.ym/100),last.ym%100);break;}
      const v=ym<first?MOCK:(own[ym]!=null?own[ym]:par[ym]);
      const D=days(y,m),d1=ym===202106?25:1,d2=ym===202611?22:D,fr=(d2-d1+1)/D;
      f*=fr>=1?1+v/100:1+v/100*fr;last={r:v,ym};}
    return f.toFixed(5);})();
  assert.equal(r.factor,exp,'시점수정치');
  assert.ok(r.asked.length>0&&r.asked.every(ym=>ym<r.first),'파일 밖 달만 통신');
  assert.deepEqual(errs,[]);
  console.log('✅ 모두 통과');
  await browser.close();server.close();
})().catch(e=>{console.error('❌',e);process.exit(1);});
