// 집합건물(단일 호수) 명세표 xlsx — 대지권 분모·소수 자릿수 검증
// ① 필지 2개(15382.5 + 724.9)면 분모 기본 = 대지면적 합 16107.4, 소수 1자리 서식(#,##0.0)으로 표시(15,383처럼 반올림 X)
// ② 입력된 분모가 합과 다르면 확인창: [확인]=합 / [취소]=입력 분모 그대로(4700분의 16.8 같은 건)
// ③ 전유·분자·필지 면적은 등기 원문 자릿수 그대로(29.983 → 3자리 서식)
// PLAYWRIGHT_MODULE=/path/to/playwright PLAYWRIGHT_CHANNEL=chromium node tests/jiphap_myeongse_land.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict'),zlib=require('zlib');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
  let s=fs.readFileSync(f);
  if(f.endsWith('s3r86w8a.html'))s=s.toString().replace('async function downloadMyeongseXlsx(','window.__dlMS=(...a)=>downloadMyeongseXlsx(...a);async function downloadMyeongseXlsx(');
  res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':'text/javascript');res.end(s);});
// 최소 zip 읽기(중앙 디렉터리)
function unzip(buf){const out={};let e=buf.length-22;while(buf.readUInt32LE(e)!==0x06054b50)e--;
  let p=buf.readUInt32LE(e+16);const n=buf.readUInt16LE(e+10);
  for(let i=0;i<n;i++){const m=buf.readUInt16LE(p+10),cs=buf.readUInt32LE(p+20),nl=buf.readUInt16LE(p+28),el=buf.readUInt16LE(p+30),cl=buf.readUInt16LE(p+32),off=buf.readUInt32LE(p+42);
    const name=buf.slice(p+46,p+46+nl).toString();const lnl=buf.readUInt16LE(off+26),lel=buf.readUInt16LE(off+28);const d=buf.slice(off+30+lnl+lel,off+30+lnl+lel+cs);
    out[name]=m===8?zlib.inflateRawSync(d):d;p+=46+nl+el+cl;}return out;}
const cell=(x,r)=>{const m=new RegExp('<c r="'+r+'"([^>]*?)(?:/>|>([\\s\\S]*?)</c>)').exec(x);return m?{s:(/ s="(\d+)"/.exec(m[1])||[])[1],v:(/<v>([^<]*)<\/v>/.exec(m[2]||"")||[])[1],f:(/<f>([^<]*)<\/f>/.exec(m[2]||"")||[])[1]}:null;};
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL});
  const ctx=await browser.newContext({acceptDownloads:true});const page=await ctx.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  let answer=true;const msgs=[];page.on('dialog',d=>{msgs.push(d.message());answer&&d.type()==='confirm'?d.accept():(d.type()==='confirm'?d.dismiss():d.accept());});
  await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js'))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
  await page.addInitScript(()=>{localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-jiphap-mode','single');});
  await page.goto(base+'/s3r86w8a.html');await page.waitForFunction(()=>window.__dlMS);
  const ov={jibun:'서울특별시 강남구 삼성동 14-1 외 1필지',road:'서울특별시 강남구 학동로68길 30',dong:'101',floor:'16',ho:'1601',area:'152.983',
    landArea:'69.49',landRatioDenom:'15382.5',mainUse:'공동주택(아파트)',regStructure:'철근콘크리트구조 (철근)콘크리트경사지붕',floors:'18/3',floorDetail:'지1층 107.228\n1층 764.858',
    landParcels:[{jibun:'14-1',area:'15382.5'},{jibun:'14-5',area:'724.9'}],areaOption:'none'};
  async function run(){const [dl]=await Promise.all([page.waitForEvent('download'),page.evaluate(o=>window.__dlMS(o,3940000000),ov)]);
    const b=fs.readFileSync(await dl.path());if(process.env.SAVE)fs.writeFileSync(process.env.SAVE+(answer?'_sum':'_den')+'.xlsx',b);return unzip(b)['xl/worksheets/sheet1.xml'].toString();}
  // ① 확인 = 대지면적 합
  answer=true;let x=await run();
  assert.match(msgs.join('\n'),/대지면적 합[^\n]*16,107\.4/);
  let g39=cell(x,'G39');console.log('① G39',g39);
  assert.ok(g39.f&&/SUM\(G25:G29\)/.test(g39.f),'분모 = 필지 합 수식');assert.equal(g39.s,'24','소수 1자리 서식');
  assert.equal(cell(x,'G25').s,'24');assert.equal(cell(x,'G27').v,'724.9');
  assert.equal(cell(x,'G34').v,'152.983');assert.equal(cell(x,'G34').s,'21','전유 3자리');assert.equal(cell(x,'H34').s,'21');
  assert.equal(cell(x,'G37').s,'18');
  const h38=cell(x,'H38');console.log('  H38',h38);assert.ok(h38.f==='+G37'||h38.v==='69.49','사정 = 분자 그대로');
  // ② 취소 = 입력 분모 그대로
  answer=false;msgs.length=0;x=await run();
  g39=cell(x,'G39');console.log('② G39',g39,'H38',cell(x,'H38'));
  assert.equal(g39.v,'15382.5');assert.equal(g39.s,'24');assert.equal(cell(x,'H38').v,'72.76');
  assert.deepEqual(errors,[]);console.log('OK');
  await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1);});
