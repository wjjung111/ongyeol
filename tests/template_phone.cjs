// 표지 전화·팩스 번호가 빈 자리(000-0000)로 나가지 않는지 — 저장소의 모든 한글 템플릿 파일을 열어 확인
//  (2026-11-27 ON261124-7202 송파동 다세대 7개호: 여러 호수 템플릿 표지가 Tel. (02)000-0000 으로 나감)
// node tests/template_phone.cjs
const fs=require('fs'),path=require('path'),zlib=require('zlib'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
function unzip(buf){const out={};let e=buf.length-22;while(buf.readUInt32LE(e)!==0x06054b50)e--;
  let p=buf.readUInt32LE(e+16);const n=buf.readUInt16LE(e+10);
  for(let i=0;i<n;i++){const m=buf.readUInt16LE(p+10),cs=buf.readUInt32LE(p+20),nl=buf.readUInt16LE(p+28),el=buf.readUInt16LE(p+30),cl=buf.readUInt16LE(p+32),off=buf.readUInt32LE(p+42);
    const name=buf.slice(p+46,p+46+nl).toString();const lnl=buf.readUInt16LE(off+26),lel=buf.readUInt16LE(off+28);const data=buf.slice(off+30+lnl+lel,off+30+lnl+lel+cs);
    out[name]=m===8?zlib.inflateRawSync(data):data;p+=46+nl+el+cl;}
  return out;}
const xmlOf=buf=>{const z=unzip(buf);return Object.keys(z).filter(n=>/^Contents\/.*\.xml$/.test(n)).map(n=>z[n].toString('utf8')).join('');};
const TEL='Tel. (02)552-5025',FAX='Fax. (02)6499-5025';
let n=0;
// ① 파일로 있는 템플릿
for(const dir of ['templates','템플릿','.']){
  for(const f of fs.readdirSync(path.join(root,dir)).filter(f=>f.endsWith('.hwpx'))){
    const x=xmlOf(fs.readFileSync(path.join(root,dir,f)));
    assert.ok(!x.includes('000-0000'),dir+'/'+f+': 전화번호 빈 자리(000-0000) 남음');
    if(/Tel\. ?\(/.test(x)){assert.ok(x.includes(TEL)&&x.includes(FAX),dir+'/'+f+': 표지 전화·팩스 번호');n++;}
  }
}
// ② 화면·모듈 안에 넣어 둔 템플릿(base64)
for(const f of fs.readdirSync(root).filter(f=>/\.(html|js)$/.test(f))){
  const s=fs.readFileSync(path.join(root,f),'utf8');
  for(const m of s.matchAll(/UEsDB[A-Za-z0-9+/=]{2000,}/g)){
    let x;try{x=xmlOf(Buffer.from(m[0],'base64'));}catch(e){continue;}
    assert.ok(!x.includes('000-0000'),f+' 내장 템플릿: 전화번호 빈 자리(000-0000) 남음');
    if(/Tel\. ?\(/.test(x)){assert.ok(x.includes(TEL)&&x.includes(FAX),f+' 내장 템플릿: 표지 전화·팩스 번호');n++;}
  }
}
assert.ok(n>=5,'표지가 있는 템플릿을 5개 이상 확인해야 함: '+n);
console.log('PASS 표지 전화·팩스 '+n+'개 템플릿');
