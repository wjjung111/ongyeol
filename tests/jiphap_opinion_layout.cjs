// 집건 단일호수 의견서(주거·비주거) 서식 — 2026-11-03 사용자 수정본 기준
//  ① 머릿글 여백 13500(빈 줄 5개로 위 여백 내던 방식 폐지) ② 본문 줄간격 210%(220·180 없음)
//  ③ 시점수정 표 제목줄 2835 ④ 개별요인 첫 표 3118 ⑤ 「Ⅲ. 거래사례비교법」 앞 쪽나눔 ⑥ 앱 내장본 = 템플릿 파일
// node tests/jiphap_opinion_layout.cjs
const fs=require('fs'),path=require('path'),zlib=require('zlib'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
function unzip(buf){const out={};let e=buf.length-22;while(buf.readUInt32LE(e)!==0x06054b50)e--;
  let p=buf.readUInt32LE(e+16);const n=buf.readUInt16LE(e+10);
  for(let i=0;i<n;i++){const m=buf.readUInt16LE(p+10),cs=buf.readUInt32LE(p+20),nl=buf.readUInt16LE(p+28),el=buf.readUInt16LE(p+30),cl=buf.readUInt16LE(p+32),off=buf.readUInt32LE(p+42);
    const name=buf.slice(p+46,p+46+nl).toString();const lnl=buf.readUInt16LE(off+26),lel=buf.readUInt16LE(off+28);const data=buf.slice(off+30+lnl+lel,off+30+lnl+lel+cs);
    out[name]=(m===8?zlib.inflateRawSync(data):data).toString('utf8');p+=46+nl+el+cl;}
  return out;}
const html=fs.readFileSync(path.join(root,'s3r86w8a.html'),'utf8');
const cases=[
  {name:'주거',file:'exact v2.0 의견서 템플릿_주거용+단일호수.hwpx',b64:'V2OPIN_TPL_B64',ids:'V2_IDS_OPIN'},
  {name:'비주거',file:'exact v2.0 의견서 템플릿_비주거용+단일호수.hwpx',b64:'V2NROPIN_TPL_B64',ids:'V2_IDS_NR'},
];
for(const c of cases){
  const buf=fs.readFileSync(path.join(root,'템플릿',c.file));
  const emb=html.match(new RegExp('const '+c.b64+'="([^"]+)"'))[1];
  assert.equal(Buffer.from(emb,'base64').compare(buf),0,c.name+' 앱 내장본 = 템플릿 파일');
  const z=unzip(buf),x=z['Contents/section0.xml'],h=z['Contents/header.xml'];
  // ① 머릿글 여백
  assert.match(x,/<hp:margin header="13500"/,c.name+' 머릿글 여백');
  // 문단모양 표
  const pp={};for(const m of h.matchAll(/<hh:paraPr id="(\d+)"[\s\S]*?<\/hh:paraPr>/g))pp[m[1]]=[...m[0].matchAll(/<hh:lineSpacing type="PERCENT" value="(\d+)"/g)].map(v=>v[1]);
  const ids=Object.keys(pp).map(Number);assert.deepEqual(ids,[...ids.keys()],c.name+' 문단모양 번호 연속');
  assert.equal(+h.match(/<hh:paraProperties itemCnt="(\d+)"/)[1],ids.length,c.name+' 문단모양 itemCnt');
  // ② 본문(맨 바깥 문단, 표 밖) 줄간격 — 220·180 남지 않음
  const top=[];let depth=0;
  for(const m of x.matchAll(/<hp:p\b[^>]*paraPrIDRef="(\d+)"[^>]*>|<\/hp:p>|<hp:tbl\b|<\/hp:tbl>|<hp:subList\b|<\/hp:subList>/g)){
    const t=m[0];if(t.startsWith('<hp:subList')||t.startsWith('<hp:tbl'))depth++;else if(t.startsWith('</hp:subList')||t.startsWith('</hp:tbl'))depth--;
    else if(t.startsWith('<hp:p')&&depth===0)top.push({pp:m[1],open:t,at:m.index});}
  const bad=top.filter(p=>pp[p.pp].some(v=>v==='220'||v==='180'));
  assert.deepEqual(bad.map(p=>p.pp),[],c.name+' 본문 220%/180% 없음');
  assert.ok(top.filter(p=>pp[p.pp].includes('210')).length>50,c.name+' 본문 210%');
  // 엔진 주석 문단(V2_IDS.para)도 210%
  const para=eval('({'+html.match(new RegExp('const '+c.ids+'=\\{\\.\\.\\.V2_IDS_SPLIT,([^}]*)\\}'))[1]+'})').para;
  assert.deepEqual([...new Set(pp[para])],['210'],c.name+' 결정표 주석 문단모양 '+para+' = 210%');
  // 빈 줄 5개로 위 여백 만들던 묶음이 없음 — 쪽·단 나눔 문단 바로 다음은 글이 있는 문단(제목)
  const isEmpty=p=>{const body=x.slice(p.at,x.indexOf('</hp:p>',p.at));return !/<hp:t>|<hp:tbl/.test(body);};
  const brk=top.map((p,i)=>i).filter(i=>/(pageBreak|columnBreak)="1"/.test(top[i].open));
  assert.ok(brk.length>=4,c.name+' 쪽·단 나눔 '+brk.length);
  for(const i of brk)assert.ok(top[i+1]&&!isEmpty(top[i+1]),c.name+' 나눔 뒤 빈 줄 없음 #'+i);
  assert.ok(!isEmpty(top[1])||!isEmpty(top[2]),c.name+' 첫 쪽 위 빈 줄 묶음 없음');
  // ⑤ Ⅲ. 거래사례비교법 앞 쪽나눔
  const i3=top.findIndex(p=>x.slice(p.at,x.indexOf('</hp:p>',p.at)).includes('Ⅲ. 거래사례비교법에 의한 시산가액'));
  assert.ok(i3>0&&/pageBreak="1"/.test(top[i3-1].open),c.name+' Ⅲ 앞 쪽나눔');
  // ③④ 표 줄 높이 — 시점수정 표 제목줄, 개별요인 첫 표
  const tbls=[...x.matchAll(/<hp:tbl\b[\s\S]*?<\/hp:tbl>/g)].map(m=>m[0]);
  const rowH=t=>[...t.matchAll(/<hp:tc\b[\s\S]*?<\/hp:tc>/g)].map(m=>m[0]).filter(s=>/rowSpan="1"/.test(s)).map(s=>[+s.match(/rowAddr="(\d+)"/)[1],+s.match(/<hp:cellSz [^>]*height="(\d+)"/)[1]]);
  const txt=t=>t.replace(/<[^>]+>/g,'');
  const sj=tbls.find(t=>txt(t).startsWith('사례기호'));assert.ok(sj,c.name+' 시점수정 표');
  assert.deepEqual([...new Set(rowH(sj).filter(r=>r[0]===0).map(r=>r[1]))],[2835],c.name+' 시점수정 표 제목줄 2835');
  const gb=tbls.find(t=>txt(t).startsWith('조건'));assert.ok(gb,c.name+' 개별요인 표');
  const hs=new Set(rowH(gb).map(r=>r[1]));assert.ok(hs.has(3118)&&!hs.has(3401),c.name+' 개별요인 첫 표 3118 '+[...hs]);
  console.log('PASS',c.name,'— 문단',top.length,'· 결정표 주석 문단모양',para);
}
