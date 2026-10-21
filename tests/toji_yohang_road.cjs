// 요항표 — 도로·맹지 필지(사용자 제보 2026-10-21): 이용상황 「도로임.」 뒤에 「로 이용중임.」이 붙고, 맹지·도로 필지는
// 접면도로 문장(…으로 노폭 약 …m … 접하고 있음)을 쓸 수 없던 문제.
//  · 이용상황을 문장(임·마침표로 끝)으로 쓰면 「로 이용중임.」을 뺀다
//  · 접면도로 드롭다운 「맹지」(→ 맹지임.)·「직접 입력」(자유 문장)
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/toji_yohang_road.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,n);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream');
  fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  const ctx=await browser.newContext();const page=await ctx.newPage();const errs=[];
  page.on('pageerror',e=>errs.push(e.message));
  await ctx.route('**/*',r=>{const u=r.request().url();if((u.includes('arap_access.js')||u.includes('arap_user.js')))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
  await page.goto(base+'/토지건물.html?mode=land',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.renderLands&&window.ArapTojiDocuments);
  const plainOf=async()=>page.evaluate(async()=>{const bytes=await ArapTojiDocuments.buildYohang();
    const ents=await ArapCheonggu.parseZip((bytes.buffer||bytes));const x=new TextDecoder().decode(ents.find(e=>/section0\.xml$/.test(e.name)).data);
    return x.replace(/<hp:p [^>]*>/g,'\n').replace(/<[^>]+>/g,'');});

  // 여러 필지(화성 샘플): 1 공업용 건부지(두 면) / 2 자연림임.(맹지) / 3 도로임.(직접 입력) / 4 도로임.(직접 입력)
  await page.evaluate(()=>{
    LANDS=[1,2,3,4].map(n=>({소재지:'화산리',지번:'664-'+n,면적:'100',stdIdx:0}));renderLands();
    const v=(id,x)=>{document.getElementById(id).value=x;};
    v('y_use','공업용 건부지');v('y_roadCnt','2');v('y_road1dir','북서측');v('y_road1w','20');v('y_road2dir','북동측');v('y_road2w','6');
    LANDS[1].yh={use:'자연림임.',roadCnt:'0'};LANDS[2].yh={use:'도로임.',roadCnt:'free',roadFree:'지목 및 현황 도로임.'};LANDS[3].yh={use:'도로임',roadCnt:'free',roadFree:'지목 및 현황 도로임.'};
    applyRoadCnt();renderYohangLands();
  });
  const ui=await page.evaluate(()=>({tails:[...document.querySelectorAll('.y-usetail')].map(s=>s.style.display),
    free:[...document.querySelectorAll('#y_landMore3 .y-roadfree')].map(s=>s.style.display)}));
  console.log('화면',ui);
  assert.deepEqual(ui.tails,['','none','none','none']);   // 문장으로 쓴 기호2~4는 「로 이용중임.」 숨김
  assert.deepEqual(ui.free,['','','']);
  const t=await plainOf();
  const lines=t.split('\n').filter(l=>/기호\d/.test(l));
  console.log(lines.join('\n'));
  assert.ok(t.includes('(1) 기호1 : 공업용 건부지로 이용중임.'));
  assert.ok(t.includes('(2) 기호2 : 자연림임.')&&!t.includes('자연림임.로'));
  assert.ok(t.includes('(3) 기호3 : 도로임.')&&!t.includes('도로임.로'));
  assert.ok(t.includes('(4) 기호4 : 도로임.'));   // 마침표 없이 써도 붙여 준다
  assert.ok(t.includes('(2) 기호2 : 맹지임.'));
  assert.ok(t.includes('(3) 기호3 : 지목 및 현황 도로임.')&&t.includes('(4) 기호4 : 지목 및 현황 도로임.'));
  assert.ok(/\(1\) 기호1 : 북서측으로 노폭 약 20m, 북동측으로 노폭 약 6m/.test(t));

  // 한 필지 — 맹지면 「본건은 맹지임.」, 이용상황 문장 그대로
  await page.evaluate(()=>{LANDS=[LANDS[0]];renderLands();document.getElementById('y_use').value='도로임.';document.getElementById('y_roadCnt').value='0';document.getElementById('y_roadFree').value='';applyRoadCnt();renderYohangLands();});
  const t1=await plainOf();
  assert.ok(t1.includes('본건은 맹지임.'),'한 필지 맹지');
  assert.ok(t1.includes('도로임.')&&!t1.includes('도로임.로'),'한 필지 이용상황 문장');
  assert.ok(!/노폭 약/.test(t1.split('3. 접면도로')[1]||''),'맹지면 노폭 문장 없음');

  assert.deepEqual(errs,[],'페이지 오류: '+errs.join(' / '));
  console.log('\n✅ 요항표 도로·맹지 필지 검증 통과');
  await browser.close();server.close();
})().catch(e=>{console.error('❌',e);process.exit(1);});
