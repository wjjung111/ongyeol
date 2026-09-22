/* 집합건물 여러 호수 감정평가명세표(xlsx) — 시트 1개, 한 장으로 이어지는 형식.
 * 단일호수 명세표 템플릿(MYEONGSE_TPL_B64, s3r86w8a.html)의 행 서식을 그대로 빌려 아래 순서로 행을 쌓는다.
 *   [1동의 건물 표시] 소재지·지번(외 N필지·건물명·제N동)·용도·구조·층수 / [도로명주소]·층별면적
 *   [대지권의 목적인 토지] 필지마다 한 줄(한 줄 띄움) — F열에 용도지역
 *   [호수 블록 반복] (내) / 기호·구조·전유(공부·사정)·감정평가액·비준가액 / 층호·(공용면적 / 포함) / 대지권 3줄(단일호수 원본과 같게: 「1 소유권 대지권」 분자 / 「분모 ×----」 산식·사정 / 분모)
 *   [합계] SUM / 이하여백
 * 동이 다른 호수가 섞이면 동마다 [1동의 건물 표시]+[토지]를 다시 쓴다.
 * 호별 금액은 화면·한글과 같은 ArapMultiHwpx.calculateUnit 결과(결정단가×사정면적, 반올림 설정 적용)를 쓴다. */
(function(g){'use strict';
const enc=new TextEncoder(),dec=new TextDecoder();
const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const num=v=>{if(v==null||String(v).trim()==='')return null;const n=Number(String(v).replace(/,/g,''));return Number.isFinite(n)?n:null;};
const txt=v=>v==null?'':String(v).trim();
const SYM='가나다라마바사아자차카타파하거너더러머버서어저처커터퍼허그느드르므브스으즈츠크트프흐';
const sym=i=>SYM[i]||String(i+1);
const roundArea=(v,dp,m)=>{const f=Math.pow(10,dp);const x=v*f+1e-7;return (m==='floor'?Math.floor(x):Math.round(x))/f;};
const stripUnit=(v,re)=>txt(v).replace(re,'');
const floorHo=u=>{const f=stripUnit(u.floor,/^제|층$/g),h=stripUnit(u.ho,/^제|호$/g);return [f?'제'+f+'층':'',h?'제'+h+'호':''].filter(Boolean).join(' ');};
const dongKey=u=>stripUnit(u.dong,/^제|동$/g);
const bldName=s=>g.ArapBldrgst?g.ArapBldrgst.buildingNameOnly(s):txt(s).replace(/\s*제?\s*\d+[A-Za-z가-힣]?\s*동\s*$/,'').trim();

/* ── 입력 정리 ── */
function parcelsOf(ov){
 let ps=(Array.isArray(ov.landParcels)?ov.landParcels:[]).filter(p=>p&&txt(p.jibun)).map(p=>({jibun:txt(p.jibun),area:num(p.area)}));
 if(!ps.length){const jn=txt(ov.jibun).split(/\s+/).find(t=>/^\d+(-\d+)?$/.test(t));if(jn)ps=[{jibun:jn,area:num(ov.landAreaTotal)}];}
 return ps;
}
function addrTokens(ov){const t=txt(ov.jibun).split(/\s+/).filter(Boolean);while(t.length&&/^(\d[\d-]*,?|외|\d+필지)$/.test(t[t.length-1]))t.pop();return t;}
function useLines(ov){const use=txt(ov.mainUse),i=use.indexOf('('),out=[];let rest=use;if(i>0){out.push(use.slice(0,i));rest=use.slice(i);}while(rest.length){out.push(rest.slice(0,6));rest=rest.slice(6);}return out;}   // E열 너비(11)에 6자까지 — '(오피스텔)'이 한 줄
function floorLines(s){return txt(s).split('\n').map(x=>x.trim()).filter(Boolean).map(line=>{const p=line.split(/\s+/),last=p[p.length-1];return /^\d[\d,]*(\.\d+)?$/.test(last)&&p.length>1?{name:p.slice(0,-1).join(' '),area:last}:{name:line,area:''};});}

/* 호수를 동별로 묶는다(등장 순서 유지). 동마다 구조·층별면적은 그 동 호수에 적힌 값 → 없으면 건물 공통값 */
function groups(ov,units){
 const out=[];
 units.forEach((u,i)=>{const k=dongKey(u);let gr=out.find(x=>x.dong===k);if(!gr){gr={dong:k,units:[]};out.push(gr);}gr.units.push({u,i});});
 for(const gr of out){
  const pick=key=>{const hit=gr.units.map(x=>txt(x.u[key])).find(Boolean);return hit||txt(ov[key]);};
  gr.regStructure=pick('regStructure')||txt(ov.structure);gr.floorDetail=pick('floorDetail');gr.landRatioDenom=num(gr.units.map(x=>x.u.landRatioDenom).find(v=>num(v))||ov.landRatioDenom);
 }
 return out;
}

/* ── 계산 모델(화면·한글과 같은 함수) ── */
function model(input,h){
 const {ov,cases=[]}=input,units=(ov.units||[]).filter(u=>u&&(txt(u.ho)||txt(u.dong)||txt(u.floor)||num(u.area)>0));
 if(!units.length)throw Error('② 대상물건개요에 호수를 입력하세요.');
 const parcels=parcelsOf(ov),landTot=parcels.reduce((s,p)=>s+(p.area||0),0)||num(ov.landAreaTotal)||0;
 const rows=units.map((u,i)=>{const c=g.ArapMultiHwpx.resolveCase(u,cases),cal=g.ArapMultiHwpx.calculateUnit(u,c,input,h);
  const area=num(u.area),ua=cal.ua,la=num(u.landArea);
  // 면적은 입력 문자열 그대로 적는다(29.983처럼 소수 셋째 자리도 보존 — 숫자로 넣으면 셀서식 0.00이 잘라낸다). 사정 칸의 계산값만 숫자
  return {u,i,symbol:sym(i),area,areaText:area==null?'':txt(u.area).replace(/,/g,''),ua,adjusted:ua!=null&&area!=null&&ua!==area,landArea:la,landText:la==null?'':txt(u.landArea).replace(/,/g,''),amount:cal.ready?cal.finalAmt:null,ready:cal.ready};});
 const total=rows.every(r=>r.ready)?rows.reduce((s,r)=>s+r.amount,0):null;
 return {ov,units,rows,parcels,landTot,groups:groups(ov,units),total};
}

/* ── 시트 행 생성: 템플릿 행을 본떠(서식 유지) 값만 바꾼다 ── */
function protoRows(sheetXml){const m={};sheetXml.replace(/<row r="(\d+)"[^>]*>[\s\S]*?<\/row>/g,(row,r)=>{m[+r]=row;return row;});return m;}
function cellXml(ref,style,v){
 const s=style?' s="'+style+'"':'';
 if(v==null||v==='')return '<c r="'+ref+'"'+s+'/>';
 if(typeof v==='number')return '<c r="'+ref+'"'+s+'><v>'+v+'</v></c>';
 if(typeof v==='string'&&v.charAt(0)==='=')return '<c r="'+ref+'"'+s+' t="str"><f>'+esc(v.slice(1))+'</f></c>';
 return '<c r="'+ref+'"'+s+' t="inlineStr"><is><t xml:space="preserve">'+esc(v)+'</t></is></c>';
}
/* proto 행의 셀 서식(s=)만 남기고 값·수식을 지운 뒤 vals{열:값}로 채운다 */
function makeRow(proto,r,vals){
 vals=vals||{};
 const head=proto.match(/^<row [^>]*>/)[0].replace(/ r="\d+"/,' r="'+r+'"');
 const cells=[];proto.replace(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>[\s\S]*?<\/c>)/g,(c,col,attrs)=>{const sm=attrs.match(/ s="(\d+)"/);cells.push(cellXml(col+r,sm?sm[1]:'',vals[col]));return c;});
 return head+cells.join('')+'</row>';
}

function render(entries,m,h){
 const byName=new Map(entries.map(e=>[e.name,e])),read=n=>dec.decode(byName.get(n).data),write=(n,s)=>{byName.get(n).data=enc.encode(s);};
 const sheet=read('xl/worksheets/sheet1.xml'),P=protoRows(sheet),out=[];
 for(let r=1;r<=10;r++)if(P[r])out.push(P[r]);           // 제목·머리행은 템플릿 그대로
 let r=11;const push=(proto,vals)=>{out.push(makeRow(P[proto],r,vals));return r++;};
 const braces=[],unitRows=[];let amountFrom=11;
 const addr=addrTokens(m.ov),uses=useLines(m.ov),road=txt(m.ov.road).split(/\s+/).filter(Boolean),fl=txt(m.ov.floors).split('/').map(s=>s.trim());
 const name=bldName(m.ov.buildingName);
 for(const gr of m.groups){
  /* [1동의 건물 표시] — 템플릿 11~16행 */
  const jib=[m.parcels[0]?m.parcels[0].jibun:'',m.parcels.length>1?'외 '+(m.parcels.length-1)+'필지':'',name,gr.dong?'제'+gr.dong+'동':''].filter(Boolean);
  const st=gr.regStructure.split(/\s+/).filter(Boolean),stL=[st[0]||'',st.slice(1).join(' '),fl[0]?fl[0]+'층':''];
  const bld=[];for(let k=0;k<6;k++)bld.push({C:k<3?(k===2?addr.slice(2).join(' '):addr[k]||''):'',D:jib[k]||'',E:k<4?(uses[k]||''):(k===4?uses.slice(4).join(''):''),F:stL[k]||''});
  bld.forEach((v,k)=>push(11+k,v));
  /* [도로명주소]·층별면적 — 템플릿 17~22행, 층이 6줄 넘으면 19행 서식으로 늘림 */
  const floors=floorLines(gr.floorDetail),roadL=['[도로명주소]',road[0]||'',road[1]||'',road[2]||'',road[3]||'',road.slice(4).join(' ')];
  const n=Math.max(6,floors.length);
  for(let k=0;k<n;k++)push(k<6?17+k:19,{C:roadL[k]||'',F:floors[k]?floors[k].name:'',G:floors[k]?floors[k].area:''});
  push(23);push(24);
  /* [대지권의 목적인 토지] — 필지마다 한 줄, 사이 한 줄 띄움 */
  m.parcels.forEach((p,k)=>{if(k)push(26);push(25,{B:k+1,C:'동소',D:p.jibun,E:'대',F:txt(m.ov.zoning),G:p.area==null?'':p.area});});
  push(30);
  /* [호수 블록] */
  const denom=gr.landRatioDenom,np=m.parcels.length,label=np?(np>=3?'1~'+np:Array.from({length:np},(_,k)=>k+1).join(', '))+' 소유권 대지권':'소유권 대지권';   // 단일호수와 같은 표기(1 / 1, 2 / 1~N)
  for(const {u,i} of gr.units){
   const row=m.rows[i];
   push(31,{F:'(내)'});
   const r1=push(34,{B:row.symbol,F:stL[0],G:row.areaText,H:row.adjusted?row.ua:'=+G'+r,I:row.amount==null?'':row.amount,J:'비준가액'});
   if(stL[1])push(35,{F:stL[1],J:'(공용면적'});
   push(35,{F:floorHo(u),J:stL[1]?'포함)':'(공용면적'});
   if(!stL[1])push(36,{J:'포함)'});
   let r4=null;
   if(row.landArea!=null){
    const dec_=Math.max(2,(String(u.landArea||'').split('.')[1]||'').length);
    const adj=denom&&m.landTot?roundArea(m.landTot*row.landArea/denom,dec_,m.ov.areaRound||'round'):row.landArea;
    // 단일호수 템플릿 37~39행 그대로: 분자 / 「분모 ×----」(수식)·사정 / 분모
    push(37,{F:label,G:row.landText});
    r4=push(38,{G:'=+G'+(r+1)+'&" ×----"',H:adj});
    push(39,{G:denom!=null?String(denom):m.landTot?String(Number(m.landTot.toFixed(4))):''});   // 문자열로 — 셀서식(#,##0)이 1064.5를 1,065로 보이게 하므로
   }
   push(40);
   if(r4)braces.push([r1,r4]);unitRows.push({symbol:row.symbol,row:r1});   // 중괄호는 전유행~대지권 산식행(원본과 같음, 대지권 없는 호는 생략)
  }
 }
 const lastAmount=r-1;for(let k=41;k<=47;k++)push(k);
 const totalRow=push(48,{C:'합  계',I:'=SUM(I'+amountFrom+':I'+lastAmount+')'});
 for(let k=49;k<=53;k++)push(k);
 const last=r-1;
 let x=sheet.replace(/(<sheetData>)[\s\S]*?(<\/sheetData>)/,(s,a,b)=>a+out.join('')+b).replace(/<dimension ref="[^"]*"\/>/,'<dimension ref="B3:J'+last+'"/>');
 x=x.replace(/<pageSetup[^>]*\/>/,'<pageSetup paperSize="9" scale="57" fitToHeight="0" orientation="portrait" r:id="rId1"/>');
 write('xl/worksheets/sheet1.xml',x);
 /* 도형: 감정평가액 중괄호는 호수마다 복제, 「이하여백」 상자는 합계 아래로 */
 let dr=read('xl/drawings/drawing1.xml');const anchors=dr.match(/<xdr:twoCellAnchor>[\s\S]*?<\/xdr:twoCellAnchor>/g)||[];
 const setRows=(a,from,to)=>{let k=0;return a.replace(/<xdr:row>\d+<\/xdr:row>/g,()=>'<xdr:row>'+(k++===0?from:to)+'</xdr:row>');};
 const rebuilt=[];
 for(const a of anchors){
  if(a.includes('name="자유형: 도형 2"')){braces.forEach(([f,t],k)=>{let c=setRows(a,f-1,t-1).replace(/<a:extLst>[\s\S]*?<\/a:extLst>/,'').replace(/<xdr:cNvPr id="\d+"/,'<xdr:cNvPr id="'+(100+k)+'"');rebuilt.push(c);});}
  else if(a.includes('name="Text Box 17"'))rebuilt.push(setRows(a,totalRow,totalRow+4));
  else rebuilt.push(a);
 }
 write('xl/drawings/drawing1.xml',dr.replace(/<xdr:twoCellAnchor>[\s\S]*<\/xdr:twoCellAnchor>/,rebuilt.join('')));
 /* 통합문서: 인쇄영역·반복 머리행·열 때 재계산 */
 let wb=read('xl/workbook.xml').replace(/(\$B\$\d+:\$J\$)\d+/,'$1'+last).replace(/<calcPr/,'<calcPr fullCalcOnLoad="1"');
 if(!wb.includes('_xlnm.Print_Titles'))wb=wb.replace('</definedNames>','<definedName name="_xlnm.Print_Titles" localSheetId="0">Sheet2!$3:$9</definedName></definedNames>');
 write('xl/workbook.xml',wb);
 const ct=byName.get('[Content_Types].xml');ct.data=enc.encode(dec.decode(ct.data).replace(/<Override PartName="\/xl\/calcChain.xml"[^>]*\/>/,''));
 const rel=byName.get('xl/_rels/workbook.xml.rels');rel.data=enc.encode(dec.decode(rel.data).replace(/<Relationship[^>]*Target="calcChain.xml"[^>]*\/>/,''));
 return {entries:entries.filter(e=>e.name!=='xl/calcChain.xml'),unitRows,totalRow,last};
}

async function build(input,h){
 const m=model(input,h),b64=g.ArapSingleDocuments&&g.ArapSingleDocuments.MYEONGSE_TPL_B64;
 if(!b64)throw Error('명세표 템플릿을 찾지 못했습니다.');
 const bin=atob(b64),buf=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)buf[i]=bin.charCodeAt(i);
 const entries=await h.parseZip(buf.buffer);if(!entries.length)throw Error('명세표 템플릿 파싱 실패');
 const r=render(entries,m,h);
 return {bytes:h.createZipStored(r.entries),model:m,unitRows:r.unitRows,totalRow:r.totalRow,last:r.last};
}
g.ArapMultiMyeongse={build,model};
})(window);
