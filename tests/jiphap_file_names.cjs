// 집건 다운로드 파일 이름 번호 — 4. 명세표 / 7. 청구서 (2026-11-03 사용자 요청)
const fs=require('fs'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','s3r86w8a.html'),'utf8');
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++;};
const cnt=re=>(src.match(re)||[]).length;
ok(cnt(/`4\. 명세표_\$\{ov\.client\|\|"의뢰인"\}\.xlsx`/g)===2,'명세표 = 「4. 명세표_…」 (단일·여러 호수 2곳)');
ok(cnt(/`7\. 청구서_\$\{ov\.client\|\|"의뢰인"\}\.hwpx`/g)===2,'청구서 = 「7. 청구서_…」 (단일·여러 호수 2곳)');
ok(!/`8\. 청구서_/.test(src),'옛 「8. 청구서」 이름 없음');
if(fail){console.log(fail+' 실패');process.exit(1);}console.log('모두 통과');
