// 평가전례(KAPA) 붙여넣기 — 윈도 줄바꿈(\r\n) 머리글 검증(2026-11-19)
//  사고: 머리글 "평가액\r\n(개별)"이 「평가액\r (개별)」로 읽혀 개별 평가액을 못 찾고 감정평가총액(건물 전체 1,695억)이 사례가격으로 들어감
//  기대: 서울고속버스터미날 본관동 7/198 → 사례가격 83,840,000원(개별), 단가 23,288,889
// node tests/kapa_paste_crlf.cjs
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
function grab(src,name,from){const i=src.indexOf('function '+name+'(',from);assert.ok(i>=0,name+' 없음');let d=0,j=src.indexOf('{',i);for(;j<src.length;j++){if(src[j]==='{')d++;else if(src[j]==='}'){d--;if(!d)break;}}return{code:src.slice(i,j+1),end:j};}
const H=['Is Selected','평가목적','복사','연도','물건','소재지','지번(*)','지번','전용면적','대지권면적','건물명','동층호','"지목/\r\n건물용도"','"용도지역\r\n/구조"','평가액/면적','기준시점','"평가액\r\n(개별)"','감정평가총액','"(개별)\r\n공시연도"','사용승인일'];
const R=['Unchecked','시가참고','','2025.0','건물','서울특별시 서초구 반포동','    19-    *','    19-   4','3.6','1','서울고속버스터미날','본관동 7 198','점포','철근콘크리트구조','23288889','2025-05-08','83,840,000','169,546,800,000','2025','20110304'];
const text=H.join('\t')+'\r\n'+R.join('\t')+'\r\n';
const pre='const pNum=v=>{if(v==null)return null;const n=parseFloat(String(v).replace(/,/g,"").trim());return isNaN(n)?null:n;};const pStr=v=>v==null?"":String(v).trim();';
let n=0;
for(const f of ['s3r86w8a.html','입주권.html']){
  const src=fs.readFileSync(path.join(root,f),'utf8');let from=0;
  while(true){const k=src.indexOf('function parseKapaRow(',from);if(k<0)break;
    const a=grab(src,'preTSV',src.lastIndexOf('function preTSV(',k)),b=grab(src,'parseTSV',src.lastIndexOf('function parseTSV(',k)),c=grab(src,'parseKapaRow',k);
    const fn=new Function(pre+a.code+b.code+c.code+';return parseKapaRow;')();
    const r=fn(text,0)[0];
    assert.equal(r.appraiseAmount,83840000,f+' 사례가격(개별)');assert.equal(r.unitPrice,23288889,f+' 단가');
    assert.equal(r.exclusiveArea,3.6);assert.equal(r.dong,'본관동');assert.equal(r.ho,'198');assert.equal(r.jibun,'19-4');
    n++;from=c.end;}
}
assert.equal(n,3,'parseKapaRow 3벌(집건 단일·여러호수, 입주권)');
// 개별 칸이 없으면 단가×면적(건물 전체 총액은 마지막 수단)
const src=fs.readFileSync(path.join(root,'s3r86w8a.html'),'utf8');const k=src.indexOf('function parseKapaRow(');
const fn=new Function(pre+grab(src,'preTSV',0).code+grab(src,'parseTSV',0).code+grab(src,'parseKapaRow',k).code+';return parseKapaRow;')();
const H2=H.filter(h=>!h.includes('(개별)"')),R2=R.filter((_,i)=>!H[i].includes('(개별)"'));
assert.equal(fn(H2.join('\t')+'\r\n'+R2.join('\t'),0)[0].appraiseAmount,Math.round(23288889*3.6));
// arap_kais.js parseTSV 머리글도 같은 정리
global.window={};require(path.join(root,'arap_kais.js'));
console.log('OK kapa_paste_crlf');
