// 집합건물 여러호수(#root-multi) 블록에 BTN(버튼 색) 상수가 없어 GitHub 백업 연결된 사용자가
//   「저장된 건」을 열면 📱 폰 연결 링크 버튼에서 ReferenceError로 화면이 죽던 문제 (2026-11-05)
//  ① 정적 검사: babel 블록 두 개 각각, 다른 블록에만 선언된 이름을 쓰지 않는지 (내장 Babel로 자유 변수 분석)
//  ② 화면: 여러호수 + 토큰 연결 상태 → 저장된 건 → 📱 버튼 보이고 pageerror 없음, 버튼 색이 단일호수와 같음
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/jiphap_multi_btn.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'s3r86w8a.html'),'utf8');

// ① 정적 검사
{ const s=html.indexOf('<script data-src="https://unpkg.com/@babel/standalone/babel.min.js">');
  const code=html.slice(html.indexOf('>',s)+1,html.indexOf('</script>',s));
  const sb={self:{},window:{},console:{...console,warn(){},log(){}}};sb.globalThis=sb;vm.createContext(sb);vm.runInContext(code,sb);
  const Babel=sb.Babel||sb.window.Babel||sb.self.Babel;assert.ok(Babel,'내장 Babel');
  const blocks=[...html.matchAll(/<script type="text\/babel">([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  assert.equal(blocks.length,2,'babel 블록 두 개');
  const info=blocks.map(src=>{const free=new Set(),decl=new Set();
    Babel.transform(src,{presets:['react'],compact:true,plugins:[()=>({visitor:{Program(p){
      Object.keys(p.scope.globals).forEach(k=>free.add(k));
      Object.keys(p.scope.bindings).forEach(k=>decl.add(k));   // 블록 맨 위 + IIFE 바로 안쪽에 선언된 이름
      p.traverse({Function(f){if(!f.getFunctionParent())Object.keys(f.scope.bindings).forEach(k=>decl.add(k));}});}}})]});
    assert.ok(decl.size>50,'선언 수집');
    return {free,decl};});
  for(let i=0;i<2;i++){const other=info[1-i];
    const bad=[...info[i].free].filter(k=>other.decl.has(k));
    assert.deepEqual(bad,[],`블록 ${i+1}이 블록 ${2-i}에만 선언된 이름을 씀`);}
  console.log('정적 검사 OK');
}

// ② 화면
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':'text/javascript');fs.createReadStream(f).pipe(res);});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  try{
    const colors={};
    for(const mode of ['multi','single']){
      const ctx=await browser.newContext({viewport:{width:1300,height:900}}),page=await ctx.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
      // GitHub API는 빈 Gist 목록으로 답하고, 그 밖의 바깥 주소는 막음
      await ctx.route('**/*',r=>{const u=r.request().url();
        if(u.includes('arap_access.js')||u.includes('arap_user.js'))return r.fulfill({body:'',contentType:'text/javascript'});
        if(u.startsWith('https://api.github.com/'))return r.fulfill({status:200,contentType:'application/json',body:'[]',headers:{'access-control-allow-origin':'*'}});
        return u.startsWith(base)?r.continue():r.abort();});
      await page.addInitScript(m=>{localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-gh-token','TOK');(localStorage.setItem('arap-jiphap-mode',m),sessionStorage.setItem('arap-jiphap-mode',m));},mode);
      await page.goto(base+'/s3r86w8a.html');
      const scope=page.locator(mode==='multi'?'#root-multi':'#root');
      await scope.getByText('1. 접수 · 대상물건',{exact:true}).first().waitFor({timeout:60000});
      assert.ok(await page.evaluate(()=>!!(window.ArapSync&&window.ArapSync.token()&&window.ArapSync.phoneLink)),'연결 상태');
      await scope.locator('button',{hasText:'저장된 건'}).first().click();
      const phone=scope.locator('button',{hasText:'📱 폰 연결 링크'});await phone.waitFor({timeout:10000});
      assert.ok(await scope.locator('button',{hasText:/^(지금 동기화|연결)$/}).count()>0,'동기화 버튼');
      colors[mode]=await scope.locator('button').filter({hasText:/^(지금 동기화|연결|📱 폰 연결 링크)$/}).evaluateAll(bs=>bs.map(b=>b.textContent+':'+getComputedStyle(b).backgroundColor+'/'+getComputedStyle(b).color));
      assert.deepEqual(errors,[],mode+' pageerror 없음');
      await ctx.close();console.log(mode+' OK');
    }
    assert.deepEqual(colors.multi,colors.single,'두 블록 동기화 버튼 색이 같음');
    console.log('PASS');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
