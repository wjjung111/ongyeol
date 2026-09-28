// GitHub 자동 백업(arap_sync.js) 검증 — 가짜 GitHub(Gist API)를 붙여
// ① 토지건물 연결 → 저장건이 Gist(arap_sync_toji.json)에 올라감 ② 크롬 데이터 삭제(localStorage 전부 비움) 뒤 토큰만 다시 넣으면 되살아남
// ③ 집합건물은 같은 Gist를 찾아 자기 파일(arap_sync.json)을 나란히 넣음(토지 파일 안 지움)
// PLAYWRIGHT_MODULE=/path/to/playwright PLAYWRIGHT_CHANNEL=chromium node tests/sync_backup.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':'text/javascript');fs.createReadStream(f).pipe(res);});
// 가짜 Gist 저장소
const gists={};let seq=0;
async function gh(route){const req=route.request(),u=new URL(req.url()),m=req.method();
  const json=(o,st=200)=>route.fulfill({status:st,contentType:'application/json',body:JSON.stringify(o),headers:{'access-control-allow-origin':'*'}});
  if(m==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});
  if(req.headers()['authorization']!=='Bearer TOK')return json({message:'bad'},401);
  if(u.pathname==='/gists'&&m==='GET')return json(u.searchParams.get('page')==='1'?Object.values(gists):[]);
  if(u.pathname==='/gists'&&m==='POST'){const b=JSON.parse(req.postData());const id='g'+(++seq);gists[id]={id,files:{}};for(const[k,v]of Object.entries(b.files))gists[id].files[k]={content:v.content};return json(gists[id],201);}
  const mm=/^\/gists\/(\w+)$/.exec(u.pathname);if(mm&&gists[mm[1]]){const g=gists[mm[1]];
    if(m==='PATCH'){const b=JSON.parse(req.postData());for(const[k,v]of Object.entries(b.files))g.files[k]={content:v.content};}
    return json(g);}
  return json({},404);}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL});
  const ctx=await browser.newContext();const errors=[];
  await ctx.route('**/*',r=>{const u=r.request().url();if((u.includes('arap_access.js')||u.includes('arap_user.js')))return r.fulfill({body:'',contentType:'text/javascript'});
    if(u.startsWith('https://api.github.com/'))return gh(r);if(u.startsWith(base))return r.continue();return r.abort();});
  let page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.goto(base+'/토지건물.html');await page.waitForFunction(()=>window.LAND_SYNC&&window.doSave);
  // 저장건 하나 + 연결
  await page.evaluate(()=>{newCase();document.getElementById('ov_caseNo').value='T-9';STDS=[{'지번':'586'}];renderStds();doSave();toggleCaseList();});
  await page.fill('#caseListPanel .arap-sync-tok','TOK');await page.click('#caseListPanel .arap-sync-go');
  await page.waitForFunction(()=>/백업됨/.test(document.querySelector('#caseListPanel .arap-sync-st').textContent));
  const g=Object.values(gists)[0];assert.ok(g.files['arap_sync_toji.json']);
  assert.equal(JSON.parse(JSON.parse(g.files['arap_sync_toji.json'].content).cases['T-9']).STDS[0]['지번'],'586');
  console.log('① 토지 백업 OK');
  // 저장하면 자동으로 다시 올라감
  await page.evaluate(()=>{STDS=[{'지번':'777'}];renderStds();doSave();});
  await page.waitForFunction(()=>/백업됨/.test(document.querySelector('#caseListPanel .arap-sync-st').textContent)&&true);
  await page.waitForTimeout(3600);
  assert.equal(JSON.parse(JSON.parse(g.files['arap_sync_toji.json'].content).cases['T-9']).STDS[0]['지번'],'777');
  console.log('① 저장 → 자동 백업 OK');
  // ② 크롬 데이터 삭제 흉내
  await page.evaluate(()=>localStorage.clear());await page.reload();await page.waitForFunction(()=>window.LAND_SYNC);
  await page.evaluate(()=>{toggleCaseList();});
  assert.match(await page.textContent('#caseListPanel'),/되살아나요/);
  await page.fill('#caseListPanel .arap-sync-tok','TOK');
  const nav=page.waitForNavigation();await page.click('#caseListPanel .arap-sync-go');await nav;   // 받아온 뒤 새로고침
  await page.waitForFunction(()=>window.getLandList);
  const back=await page.evaluate(()=>({list:getLandList().map(c=>c.id),d:JSON.parse(localStorage.getItem('tojigeonmul-case:T-9')).STDS[0]['지번']}));
  assert.deepEqual(back.list,['T-9']);assert.equal(back.d,'777');
  console.log('② 삭제 후 복구 OK');
  // ③ 집합건물: 같은 토큰(이미 저장됨) → 같은 Gist에 자기 파일
  await page.goto(base+'/s3r86w8a.html?user=wdw');
  await page.waitForFunction(()=>window.ArapSync&&window.ArapSync.token()==='TOK');
  await page.evaluate(()=>{localStorage.setItem('case:J-1',JSON.stringify({ov:{caseNo:'J-1'}}));window.ArapSync.onLocalSave('case:J-1');});
  await page.waitForFunction(()=>/동기화됨|⚠️/.test(window.ArapSync.getStatus()),null,{timeout:15000});
  assert.equal(Object.keys(gists).length,1,'Gist 하나만');
  assert.ok(g.files['arap_sync.json']&&g.files['arap_sync_toji.json'],'두 파일 나란히');
  console.log('③ 집합건물 같은 Gist OK');
  assert.deepEqual(errors,[]);console.log('OK');
  await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1);});
