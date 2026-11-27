// 시점수정 계산기 사용자 차단(arap_block.js, 2026-11-27) — 관리자 지정 이름·IP(해시)면 화면을 덮고 '차단' 기록.
// 실제 이름·IP는 저장소에 두지 않음: 환경변수 ARAP_BLOCK_TEST_NAME / ARAP_BLOCK_TEST_IP 를 주면 그 값으로도 확인.
// 확인: 일반 사용자 통과 · 이전 차단 표시(arap-blk) → 즉시 차단 + 이름 바꿔도 유지 · 목록에 없는 표시는 지워짐 · (옵션) 실제 이름/IP 차단
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const src=fs.readFileSync(path.join(root,'arap_block.js'),'utf8');
const ipHash=(src.match(/var IPS=\[\s*'([0-9a-f]{64})'/)||[])[1];assert.ok(ipHash,'IP 해시 목록');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8');fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true});
  async function open({name,ip,flag}){
    const ctx=await browser.newContext({viewport:{width:1200,height:900}});
    const logs=[];
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>{
      const u=r.request().url();
      if(/ipwho\.is/.test(u))return r.fulfill({contentType:'application/json',body:JSON.stringify({success:true,ip:ip||'1.2.3.4',country:'South Korea',region:'Seoul',city:'Seoul',connection:{isp:'TEST'}})});
      if(/script\.google\.com/.test(u)){logs.push(Object.fromEntries(new URL(u).searchParams));return r.fulfill({contentType:'application/json',body:'{"ok":true}'});}
      return r.abort();
    });
    await ctx.addInitScript(([n,f])=>{try{if(n)localStorage.setItem('arap-user-name',n);if(f)localStorage.setItem('arap-blk',f);}catch(e){}},[name||'',flag||'']);
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(base+'/'+encodeURI('arm_시점수정.html'));await p.waitForSelector('#btn-calc',{state:'attached'});
    await p.waitForTimeout(1200);
    return {ctx,p,logs,errs};
  }
  try{
    // ① 일반 사용자 — 통과
    let t=await open({name:'홍길동',ip:'1.2.3.4'});
    assert.equal(await t.p.locator('#arap-block').count(),0,'일반 사용자 통과');
    assert.ok(t.logs.some(l=>l.action==='접속'),'접속 기록');assert.ok(!t.logs.some(l=>l.action==='차단'));
    assert.deepEqual(t.errs,[]);await t.ctx.close();
    // ② 이전에 걸린 브라우저(표시 남음) — 이름이 달라도 즉시 차단, 기록
    t=await open({name:'다른이름',ip:'1.2.3.4',flag:'ip:'+ipHash});
    assert.equal(await t.p.isVisible('#arap-block'),true,'표시로 차단');
    assert.match(await t.p.locator('#arap-block').textContent(),/사용할 수 없는 페이지/);
    assert.equal(await t.p.locator('#arap-name-gate').count(),0,'이름 화면 없음');
    assert.ok(t.logs.some(l=>l.action==='차단'),'차단 기록');
    await t.p.screenshot({path:path.join(process.env.SHOT_DIR||require('os').tmpdir(),'arm_block.png')});
    await t.ctx.close();
    // ③ 목록에 없는 옛 표시 — 지워지고 통과
    t=await open({name:'홍길동',ip:'1.2.3.4',flag:'ip:'+'0'.repeat(64)});
    assert.equal(await t.p.locator('#arap-block').count(),0,'옛 표시 무시');
    assert.equal(await t.p.evaluate(()=>localStorage.getItem('arap-blk')),null,'옛 표시 지움');
    await t.ctx.close();
    // ④ (옵션) 실제 대상 — IP만 / 이름만
    if(process.env.ARAP_BLOCK_TEST_IP){
      t=await open({name:'아무개',ip:process.env.ARAP_BLOCK_TEST_IP});
      assert.equal(await t.p.isVisible('#arap-block'),true,'IP로 차단');
      assert.match(await t.p.evaluate(()=>localStorage.getItem('arap-blk')),/^ip:/);await t.ctx.close();
      t=await open({name:'홍길동',ip:'5.6.7.8'});assert.equal(await t.p.locator('#arap-block').count(),0,'같은 화면 다른 IP 통과');await t.ctx.close();
    }
    if(process.env.ARAP_BLOCK_TEST_NAME){
      t=await open({name:process.env.ARAP_BLOCK_TEST_NAME,ip:'5.6.7.8'});
      assert.equal(await t.p.isVisible('#arap-block'),true,'이름으로 차단');
      assert.match(await t.p.evaluate(()=>localStorage.getItem('arap-blk')),/^name:/);await t.ctx.close();
    }
    console.log('PASS');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
