// 집합건물(단일 호수) 명세표 xlsx — 1동 표시 칸(소재지·지번·지목용도) 발송 양식대로 (2026-10-19 잠실 제이타워 건)
// ① 소재지 C11~C13 = 시·구·동만(「175-6,」처럼 콤마 붙은 지번도 뗌)
// ② 지번 D열 = 한 줄에 하나씩 콤마 없이 + 동이 이름이면 건물명(제이타워), 숫자 동이면 「제101동」
// ③ 지목·용도 E열 = 등기 건물내역 용도(regUse) 우선, 낱말 경계(근린/생활시설)에서 줄바꿈 / 비우면 주용도
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/jiphap_myeongse_bldg.cjs
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
const txt=(x,r)=>{const m=new RegExp('<c r="'+r+'"[^>]*?(?:/>|>([\\s\\S]*?)</c>)').exec(x);if(!m||!m[1])return '';const t=/<t[^>]*>([^<]*)<\/t>/.exec(m[1]);return t?t[1]:'';};
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL});
  const ctx=await browser.newContext({acceptDownloads:true});const page=await ctx.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('arap_access.js'))return r.fulfill({body:'',contentType:'text/javascript'});if(u.startsWith(base))return r.continue();return r.abort();});
  await page.addInitScript(()=>{localStorage.setItem('arap-user-name','wdw');localStorage.setItem('arap-jiphap-mode','single');});
  await page.goto(base+'/s3r86w8a.html');await page.waitForFunction(()=>window.__dlMS);
  const run=async ov=>{const [dl]=await Promise.all([page.waitForEvent('download'),page.evaluate(o=>window.__dlMS(o,935000000),ov)]);
    const b=fs.readFileSync(await dl.path());if(process.env.SAVE&&!run.saved){fs.writeFileSync(process.env.SAVE,b);run.saved=1;}return unzip(b)['xl/worksheets/sheet1.xml'].toString();};
  const col=(x,c,a,b)=>{const o=[];for(let r=a;r<=b;r++)o.push(txt(x,c+r));return o;};
  const jt={jibun:'서울특별시 송파구 잠실동 175-6, 175-7',road:'서울특별시 송파구 올림픽로 76',buildingName:'제이타워',dong:'J타워',floor:'1',ho:'104-1',area:'32.7',
    landArea:'16',landRatioDenom:'4700',mainUse:'의료시설(의료시설 외4)',regUse:'업무시설 및 제1종근린생활시설 및 제2종근린생활시설 및 교육연구시설 및 운동시설',
    regStructure:'철근콘크리트구조 (철근)콘크리트지붕',floors:'14/3',floorDetail:'지3층 508.62\n지2층 307.62\n지1층 594.54\n1층 521.95\n2층 549.10\n3층~14층(각) 534.86',
    landParcels:[{jibun:'175-6',area:'480'},{jibun:'175-7',area:'471.6'}],areaOption:'none'};
  let x=await run(jt);
  const C=col(x,'C',11,13),D=col(x,'D',11,14),E=col(x,'E',11,23).filter(Boolean);console.log('C',C,'\nD',D,'\nE',E);
  assert.deepEqual(C,['서울특별시','송파구','잠실동'],'① 소재지');
  assert.deepEqual(D,['175-6','175-7','제이타워',''],'② 지번·건물명');
  assert.deepEqual(E,['업무시설 및','제1종근린','생활시설 및','제2종근린','생활시설 및','교육연구','시설 및','운동시설'],'③ 용도');
  // 아파트(숫자 동·용도 비움) — 제101동·주용도 그대로
  x=await run({...jt,jibun:'서울특별시 강남구 삼성동 14-1 외 1필지',buildingName:'래미안',dong:'101',regUse:'',mainUse:'공동주택(아파트)',landParcels:[{jibun:'14-1',area:'15382.5'},{jibun:'14-5',area:'724.9'}]});
  assert.deepEqual(col(x,'C',11,13),['서울특별시','강남구','삼성동']);
  assert.deepEqual(col(x,'D',11,13),['14-1','14-5','제101동']);
  assert.deepEqual(col(x,'E',11,13),['공동주택','(아파트)','']);
  // 필지가 많아 한 줄에 둘씩 묶이면 「, 」로 잇고 줄 끝에 콤마
  x=await run({...jt,landParcels:['1','2','3','4','5'].map(j=>({jibun:j,area:'10'}))});
  assert.deepEqual(col(x,'D',11,14),['1, 2,','3, 4,','5','제이타워']);
  assert.deepEqual(errors,[]);console.log('PASS');
  await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1);});
