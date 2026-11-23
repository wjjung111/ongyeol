// 한글 표 테두리 통일(arap_tbl_border.js) — 사용자가 고친 「평가대상 토지」 표 서식(2026-11-23)이 모든 온결 양식 표에 맞게 나오는지
// node tests/tbl_border.cjs   (Node만, 브라우저 불필요)
const fs=require('fs'),path=require('path'),zlib=require('zlib'),assert=require('assert/strict');
const B=require('../arap_tbl_border.js');
const root=path.resolve(__dirname,'..');
// hwpx(zip)에서 파일 하나 꺼내기(중앙 디렉터리 기준, stored/deflate)
function unzip(buf){const out={};let p=buf.length-22;while(buf.readUInt32LE(p)!==0x06054b50)p--;
  let cd=buf.readUInt32LE(p+16);const n=buf.readUInt16LE(p+10);
  for(let i=0;i<n;i++){const m=buf.readUInt16LE(cd+10),cs=buf.readUInt32LE(cd+20),nl=buf.readUInt16LE(cd+28),el=buf.readUInt16LE(cd+30),cl=buf.readUInt16LE(cd+32),off=buf.readUInt32LE(cd+42);
    const name=buf.slice(cd+46,cd+46+nl).toString('utf8');const ln=buf.readUInt16LE(off+26),le=buf.readUInt16LE(off+28);const data=buf.slice(off+30+ln+le,off+30+ln+le+cs);
    out[name]=m===8?zlib.inflateRawSync(data):data;cd+=46+nl+el+cl;}
  return out;}
function fills(h){const f={};for(const m of h.matchAll(/<hh:borderFill id="(\d+)"[\s\S]*?<\/hh:borderFill>/g)){const x=m[0],s={};
  for(const k of ['left','right','top','bottom']){const r=x.match(new RegExp('<hh:'+k+'Border type="([^"]*)" width="([^"]*)" color="([^"]*)"'));s[k]=r[1]==='NONE'?'NONE':r[1]+' '+r[2]+' '+r[3];}
  s.face=(x.match(/faceColor="([^"]*)"/)||[])[1]||'';f[m[1]]=s;}return f;}
function tables(sec){return [...sec.matchAll(/<hp:tbl [\s\S]*?<\/hp:tbl>/g)].map(m=>{const t=m[0],rc=t.match(/rowCnt="(\d+)" colCnt="(\d+)"/);
  return {rows:+rc[1],cols:+rc[2],cells:[...t.matchAll(/<hp:tc [^>]*borderFillIDRef="(\d+)"[^>]*>[\s\S]*?<hp:cellAddr colAddr="(\d+)" rowAddr="(\d+)"\/><hp:cellSpan colSpan="(\d+)" rowSpan="(\d+)"\/>/g)].map(c=>({bf:c[1],c:+c[2],r:+c[3],cs:+c[4],rs:+c[5]}))};});}
// 규칙 검사 — 표 하나
function check(t,F,label){
  const grid=[];t.cells.forEach((c,i)=>{for(let r=c.r;r<c.r+c.rs;r++)for(let k=c.c;k<c.c+c.cs;k++)(grid[r]=grid[r]||[])[k]=i;});
  const head=i=>F[t.cells[i].bf].face==='#521414';let n=0;
  t.cells.forEach((c,i)=>{const f=F[c.bf];
    for(const side of ['top','bottom','left','right']){const v=f[side];if(v==='NONE')continue;
      const vert=side==='left'||side==='right',nb=[];
      if(!vert){const r=side==='top'?c.r-1:c.r+c.rs;if(grid[r])for(let k=c.c;k<c.c+c.cs;k++)nb.push(grid[r][k]);}
      else{const col=side==='left'?c.c-1:c.c+c.cs;for(let r=c.r;r<c.r+c.rs;r++)if(grid[r]&&grid[r][col]!=null)nb.push(grid[r][col]);}
      const at=label+' r'+c.r+'c'+c.c+' '+side;
      if(!nb.length){if(!vert)assert.equal(v,'SOLID 0.4 mm #BFBFBF',at+' 표 겉 가로선');continue;}
      const me=head(i),hs=nb.map(head);
      if(me&&hs.every(Boolean))assert.equal(v,'SOLID 0.1 mm #BFBFBF',at+' 머리줄끼리');
      else if(!me&&!hs.some(Boolean))assert.equal(v,vert?'SOLID 0.1 mm #A6A6A6':'SOLID 0.12 mm #A6A6A6',at+' 본문');
      else assert.equal(v,'SOLID 0.1 mm #A6A6A6',at+' 머리줄↔본문');
      n++;}});
  return n;}
function headerOk(h){const ids=[...h.matchAll(/<hh:borderFill id="(\d+)"/g)].map(m=>+m[1]);
  assert.deepEqual(ids,ids.map((_,i)=>i+1),'borderFill 번호 1부터 연속');
  assert.equal(+h.match(/<hh:borderFills itemCnt="(\d+)"/)[1],ids.length,'itemCnt = 개수');}

// ① 토건·토지·건물 의견서, 표지, 괄호감정표 양식 — 온결 양식 표는 모두 규칙대로, 그 밖의 표는 그대로
for(const name of ['토건 의견서(산출근거) 템플릿','토지 의견서(산출근거) 템플릿','건물 의견서(산출근거) 템플릿','토건 괄호감정표 템플릿','토건 표지 템플릿']){
  const z=unzip(fs.readFileSync(path.join(root,'템플릿',name+'.hwpx')));
  const h0=z['Contents/header.xml'].toString('utf8'),s0=z['Contents/section0.xml'].toString('utf8');
  const r=B.apply(h0,[s0]);headerOk(r.header);
  const F=fills(r.header),F0=fills(h0),T=tables(r.sections[0]),T0=tables(s0);let edges=0,fam=0;
  T.forEach((t,ti)=>{const family=T0[ti].cells.some(c=>F0[c.bf].face==='#521414'||Object.values(F0[c.bf]).includes('SOLID 0.5 mm #BFBFBF'));
    if(family){fam++;edges+=check(t,F,name+' 표'+ti);}
    else assert.deepEqual(t.cells.map(c=>c.bf),T0[ti].cells.map(c=>c.bf),name+' 표'+ti+' 온결 양식 표 아님 → 그대로');});
  assert.equal(r.sections[0].replace(/borderFillIDRef="\d+"/g,''),s0.replace(/borderFillIDRef="\d+"/g,''),name+' 칸 번호 말고 바뀐 것 없음');
  console.log('①',name,'양식 표',fam,'개 · 선',edges,'· 새 borderFill',r.added);
  assert.ok(fam>0);
}

// ② 줄을 늘린 표(필지 2개를 묶은 「평가대상 토지」) — 복제한 줄에 남은 0.5mm 아래선이 가운데 0.12mm로, 맨 아래만 0.4mm
{
  const z=unzip(fs.readFileSync(path.join(root,'템플릿','토건 의견서(산출근거) 템플릿.hwpx')));
  const h0=z['Contents/header.xml'].toString('utf8');let s0=z['Contents/section0.xml'].toString('utf8');
  const i=s0.indexOf('<hp:tbl id="1149461199"'),j=s0.indexOf('</hp:tbl>',i)+9,t=s0.slice(i,j);
  const tr=[...t.matchAll(/<hp:tr>[\s\S]*?<\/hp:tr>/g)].map(m=>m[0]);
  // 둘째 줄 = 첫 본문 줄 복제(같은 borderFill — 0.5mm 아래선 그대로), 소재지~공부면적(1~3열)만 새 줄, 나머지 열은 첫 줄에서 세로로 합침
  const cells=[...tr[1].matchAll(/<hp:tc [\s\S]*?<\/hp:tc>/g)].map(m=>m[0]);
  const merged=cells.map(c=>{const col=+c.match(/colAddr="(\d+)"/)[1];return col>=1&&col<=3?c:c.replace('rowSpan="1"','rowSpan="2"');}).join('');
  const second=cells.filter(c=>{const col=+c.match(/colAddr="(\d+)"/)[1];return col>=1&&col<=3;}).map(c=>c.replace('rowAddr="1"','rowAddr="2"')).join('');
  const t2=t.replace('rowCnt="2"','rowCnt="3"').replace(tr[1],'<hp:tr>'+merged+'</hp:tr><hp:tr>'+second+'</hp:tr>');
  s0=s0.slice(0,i)+t2+s0.slice(j);
  const r=B.apply(h0,[s0]),F=fills(r.header),T=tables(r.sections[0]).find(x=>x.rows===3&&x.cols===10);
  headerOk(r.header);check(T,F,'늘린 표');
  const at=(row,col)=>F[T.cells.find(c=>c.r===row&&c.c===col).bf];
  assert.equal(at(1,1).bottom,'SOLID 0.12 mm #A6A6A6','필지 사이 가운데 선 0.12mm');
  assert.equal(at(2,1).top,'SOLID 0.12 mm #A6A6A6');
  assert.equal(at(2,1).bottom,'SOLID 0.4 mm #BFBFBF','맨 아래 0.4mm');
  assert.equal(at(1,4).bottom,'SOLID 0.4 mm #BFBFBF','세로로 합친 칸 아래도 0.4mm');
  assert.equal(at(1,0).left,'NONE','표 왼쪽 끝 선 없음 그대로');
  assert.equal(at(0,1).bottom,'SOLID 0.1 mm #A6A6A6','머리줄 아래 0.1mm 회색');
  assert.equal(at(0,1).right,'SOLID 0.1 mm #BFBFBF','머리줄 세로선 그대로');
  assert.equal(at(1,2).left,'SOLID 0.1 mm #A6A6A6','본문 세로선 회색');
  console.log('② 늘린 표 — 가운데',at(1,1).bottom,'/ 맨 아래',at(2,1).bottom);
}
console.log('✅ 표 테두리 통일 검증 통과');
