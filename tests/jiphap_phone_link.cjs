// 집합건물 📱 폰 연결 링크 — PC(토큰 연결된 상태)에서 만든 링크를 새 기기(폰 흉내, 빈 브라우저)에서 열면
//   접속코드·이름 입력 없이 바로 열리고, PC 저장건을 GitHub 백업에서 받아와 보여 주는지. 링크 값은 주소창에서 지워지는지
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/jiphap_phone_link.cjs
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
  try{
  const route=ctx=>ctx.route('**/*',r=>{const u=r.request().url();if(u.startsWith('https://api.github.com/'))return gh(r);if(u.startsWith(base))return r.continue();return r.abort();});
  const ACC=fs.readFileSync(path.join(root,'arap_access.js'),'utf8').match(/ARAP_ACCESS_HASH="([0-9a-f]+)"/)[1];
  // ── PC: 접속코드 통과·이름·토큰이 있는 상태 + PC에서 만든 저장건
  const pc=await browser.newContext({viewport:{width:1300,height:900}});await route(pc);
  await pc.addInitScript(a=>{if(!sessionStorage.getItem('init')){sessionStorage.setItem('init','1');localStorage.setItem('arap-access-ok',a);localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-gh-token','TOK');localStorage.setItem('arap-jiphap-mode','single');}},ACC);
  const p1=await pc.newPage();const e1=[];p1.on('pageerror',e=>e1.push(e.message));p1.on('dialog',d=>d.accept());
  await p1.goto(base+'/s3r86w8a.html');await p1.locator('#root').getByText('2. 대상물건개요',{exact:true}).waitFor({timeout:60000});
  await p1.evaluate(()=>{const L=JSON.parse(localStorage.getItem('v2:appraisal-case-list')||'[]');L.unshift({id:'PC-3004',updated:'2099-01-01T00:00:00'});
    localStorage.setItem('v2:appraisal-case-list',JSON.stringify(L));localStorage.setItem('v2:case:PC-3004',JSON.stringify({ov:{caseNo:'PC-3004',client:'김정기'}}));});
  await p1.evaluate(()=>window.ArapSync.syncNow());
  assert.ok(Object.values(gists)[0],'PC 백업 올라감');
  // 버튼이 저장건 패널에 있음 → 링크
  await p1.locator('#root button',{hasText:'저장된 건'}).first().click();
  await p1.locator('#root button',{hasText:'📱 폰 연결 링크'}).first().waitFor();
  const link=await p1.evaluate(()=>window.ArapSync.phoneLink());
  assert.match(link,/#arap-link=[A-Za-z0-9_-]+$/);assert.ok(!link.includes('TOK'),'토큰이 그대로 보이지 않게 인코딩');
  // ── 폰: 아무것도 없는 새 브라우저에서 링크 열기 (진짜 접속코드 잠금 파일 사용)
  const ph=await browser.newContext({viewport:{width:390,height:844}});await route(ph);
  const p2=await ph.newPage();const e2=[];p2.on('pageerror',e=>e2.push(e.message));p2.on('dialog',d=>d.accept());
  await p2.goto(link.replace(/^https?:\/\/[^/]+/,base));
  await p2.waitForFunction(()=>localStorage.getItem('v2:case:PC-3004'),null,{timeout:20000});   // 받아옴(뒤이어 새로고침)
  await p2.waitForLoadState('load');await p2.waitForTimeout(1500);
  assert.equal(new URL(p2.url()).hash,'','주소창에서 링크 값 지움');
  const st=await p2.evaluate(()=>({name:localStorage.getItem('arap-user-name'),tok:localStorage.getItem('arap-gh-token'),list:JSON.parse(localStorage.getItem('v2:appraisal-case-list')||'[]').map(x=>x.id)}));
  assert.equal(st.name,'wdw');assert.equal(st.tok,'TOK');assert.ok(st.list.includes('PC-3004'),'PC 저장건 목록에 있음');
  const txt=await p2.evaluate(()=>document.body.innerText);
  assert.ok(!/접속코드/.test(txt),'접속코드 화면 없음');assert.ok(!/이름을 선택|사용자를 선택/.test(txt),'이름 선택 화면 없음');
  assert.ok(/2\. 대상물건개요/.test(txt),'앱 화면이 바로 열림');
  assert.deepEqual(e1,[]);assert.deepEqual(e2,[]);
  console.log('PASS');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
