/* 여러 호수의 별도 요항표/명세표. 단일호수 원본 양식과 계산 엔진을 공유한다. */
(function(g){'use strict';
const enc=new TextEncoder(),dec=new TextDecoder(),HP='http://www.hancom.co.kr/hwpml/2011/paragraph';
const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const read=e=>dec.decode(e.data),entry=(name,s)=>({name,data:enc.encode(s)});
const parse=s=>{const d=new DOMParser().parseFromString(s,'application/xml');if(d.querySelector('parsererror'))throw Error('문서 구조 오류');return d;};
function unitOv(ov,u){const v={...ov,...u};for(const k of ['regStructure','floorDetail','structure','floors','approvalDate'])v[k]=u[k]||ov[k]||'';v.mainUse=u.mainUseJeonyu||ov.mainUse||ov.kind||'';
 if(!v.landParcels?.length){const numbers=(ov.jibun||'').match(/(?:^|\s|,)\s*(\d+(?:-\d+)?)(?=\s|,|$)/g)||[];v.landParcels=numbers.map(n=>({jibun:n.replace(/^[\s,]+/,''),area:numbers.length===1?ov.landAreaTotal:''}));}
 return v;
}
async function yohang(input,h){
 const m=g.ArapMultiHwpx.model(input,h),single=g.ArapSingleDocuments;
 const bytes=Uint8Array.from(atob(single.YOHANG_TPL_B64),c=>c.charCodeAt(0));const entries=await h.parseZip(bytes.buffer);
 for(const e of entries){if(!/^Contents\/section\d+\.xml$/.test(e.name))continue;
  let s=single.expandYohangPara(read(e),'{{요항_토지이용계획}}',h.assembleToice(input.ov));const d=parse(s);
  const ps=Array.from(d.getElementsByTagNameNS(HP,'p')).filter(p=>!p.getElementsByTagNameNS(HP,'tbl').length);
  for(const p of ps){const txt=p.textContent;if(!txt.includes('{{요항_층호}}')&&!txt.includes('{{요항_이용용도}}'))continue;
   for(const row of m.rows){const clone=p.cloneNode(true),ov=unitOv(input.ov,row.u),map=single.buildYohangTokenMap(ov);map['요항_층호']=[ov.dong?'제'+ov.dong+'동':'',map['요항_층호']].filter(Boolean).join(' ');
    const ts=Array.from(clone.getElementsByTagNameNS(HP,'t'));let prefixed=false;for(const t of ts){if(!prefixed&&t.textContent.trim()){t.textContent='기호 '+row.values['일련번호']+': '+t.textContent;prefixed=true;}t.textContent=t.textContent.replace(/\{\{([^}]+)\}\}/g,(_,k)=>map[k]??'');}
    Array.from(clone.getElementsByTagNameNS(HP,'linesegarray')).forEach(n=>n.remove());p.parentNode.insertBefore(clone,p);
   }p.remove();
  }
  const map=single.buildYohangTokenMap(input.ov);map['요항_접면도로']=input.ov.accessRoad||'대상 건물 진입도로를 통해 외곽 공도와 연계됨.';
  for(const t of Array.from(d.getElementsByTagNameNS(HP,'t')))if(t.textContent.includes('{{')){t.textContent=t.textContent.replace(/\{\{([^}]+)\}\}/g,(_,k)=>map[k]??'');const p=t.closest('p')||t.parentNode.parentNode;Array.from(p.getElementsByTagNameNS(HP,'linesegarray')).forEach(n=>n.remove());}
  e.data=enc.encode(new XMLSerializer().serializeToString(d));
 }
 const prev=entries.find(e=>e.name==='Preview/PrvText.txt');if(prev)prev.data=enc.encode('여러 호수 감정평가요항표');
 return {bytes:h.createZipStored(entries),model:m};
}
// Refresh formula caches inherited from the template so viewers never display sample amounts.
function refreshSheet(e,shared){
 const strings=Array.from(parse(read(shared)).getElementsByTagNameNS("*","si")).map(n=>n.textContent);
 const d=parse(read(e)),cells=new Map(Array.from(d.getElementsByTagNameNS('*','c')).map(c=>[c.getAttribute('r'),c]));
 const value=ref=>{const c=cells.get(ref);if(!c)return '';const f=c.getElementsByTagNameNS('*','f')[0];if(f)return calc(c,f.textContent);const t=c.getElementsByTagNameNS('*','t')[0],v=c.getElementsByTagNameNS('*','v')[0];return t?t.textContent:v?(c.getAttribute('t')==='s'?strings[Number(v.textContent)]||'':c.getAttribute('t')==='str'?v.textContent:Number(v.textContent)):'';};
 const calc=(c,f)=>{let result='',q=f.replace(/^\+/,''),m;if((m=q.match(/^([A-Z]+\d+)$/)))result=value(m[1]);else if((m=q.match(/^SUM\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)$/i))&&m[1]===m[3]){let nums=[];for(let i=+m[2];i<=+m[4];i++){const v=value(m[1]+i);if(typeof v==='number')nums.push(v);}result=nums.length?nums.reduce((a,b)=>a+b,0):'';}else if((m=q.match(/^([A-Z]+\d+)&"([^"]*)"$/)))result=value(m[1])+m[2];
  Array.from(c.children).filter(n=>['v','is'].includes(n.localName)).forEach(n=>n.remove());c.removeAttribute('t');if(result!==''){if(typeof result!=='number')c.setAttribute('t','str');const v=d.createElementNS(d.documentElement.namespaceURI,'v');v.textContent=String(result);c.appendChild(v);}return result;};
 for(const c of cells.values()){const f=c.getElementsByTagNameNS('*','f')[0];if(f)calc(c,f.textContent);}
 // The printed amount sum stays blank until an assessed amount exists.
 for(const c of cells.values()){const f=c.getElementsByTagNameNS('*','f')[0];if(f&&/^I/.test(c.getAttribute('r'))&&/^SUM\(/.test(f.textContent)){const range=f.textContent.slice(4,-1);f.textContent='IF(COUNT('+range+')=0,"",SUM('+range+'))';}}
 e.data=enc.encode(new XMLSerializer().serializeToString(d));return e;
}
async function myeongse(input,h){
 const m=g.ArapMultiHwpx.model(input,h),packs=[];
 for(const r of m.rows){const ov=unitOv(input.ov,r.u),tokens=(ov.jibun||'').split(/\s+/),di=tokens.findIndex(t=>/(동|리|가)$/.test(t));
  const cells={B34:r.values['일련번호'],H34:r.area??'',I34:r.amount??'',C13:di>=2?tokens.slice(2,di+1).join(' '):''};
  packs.push(await g.ArapSingleDocuments.downloadMyeongseXlsx(ov,r.amount,{returnEntries:true,cells}));
 }
 for(const pack of packs)refreshSheet(pack.find(e=>e.name==='xl/worksheets/sheet1.xml'),pack.find(e=>e.name==='xl/sharedStrings.xml'));
 const perPart=n=>/^xl\/(worksheets|drawings|media|printerSettings)\//.test(n),rename=(n,i)=>n.replace(/^xl\//,'xl/unit'+i+'/');
 const entries=packs[0].filter(e=>!perPart(e.name)&&!['xl/workbook.xml','xl/_rels/workbook.xml.rels','[Content_Types].xml','docProps/app.xml'].includes(e.name));
 let ct=read(packs[0].find(e=>e.name==='[Content_Types].xml')).replace(/<Override[^>]*PartName="\/xl\/(?:worksheets|drawings|media|printerSettings)\/[^>]*\/>/g,'');
 const sheets=[],rels=[],names=[],summaryRows=[];
 const cell=(ref,v,formula)=>`<c r="${ref}"${typeof v==='number'?'':' t="inlineStr"'}>${formula?'<f>'+esc(formula)+'</f>':''}${typeof v==='number'?'<v>'+v+'</v>':'<is><t>'+esc(v)+'</t></is>'}</c>`;
 const labels=['기호','동','층','호','전유면적(㎡)','사정면적(㎡)','대지권(㎡)','감정평가액(원)'];
 summaryRows.push('<row r="1">'+cell('A1','감정평가명세표 총괄')+'</row>','<row r="2">'+cell('A2',input.ov.jibun||'')+'</row>','<row r="4">'+labels.map((v,i)=>cell(String.fromCharCode(65+i)+'4',v)).join('')+'</row>');
 for(let i=0;i<packs.length;i++){
  const pack=packs[i],r=m.rows[i],idx=i+1,name=(r.values['일련번호']+'_'+[r.u.dong,r.u.ho].filter(Boolean).join('_')).replace(/[\\/*?:\[\]]/g,'').slice(0,31),id='unit'+idx;
  for(const e of pack.filter(e=>perPart(e.name))){let data=e.data;if(e.name.endsWith('.rels'))data=enc.encode(read(e).replace(/Target="\/xl\//g,'Target="/xl/unit'+idx+'/'));entries.push({name:rename(e.name,idx),data});}
  const overrides=read(pack.find(e=>e.name==='[Content_Types].xml')).match(/<Override[^>]*PartName="\/xl\/(?:worksheets|drawings|media|printerSettings)\/[^>]*\/>/g)||[];ct=ct.replace('</Types>',overrides.map(s=>s.replace('/xl/','/xl/unit'+idx+'/')).join('')+'</Types>');
  sheets.push(`<sheet name="${esc(name)}" sheetId="${idx+1}" r:id="${id}"/>`);rels.push(`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="unit${idx}/worksheets/sheet1.xml"/>`);
  const wb=read(pack.find(e=>e.name==='xl/workbook.xml')),range=wb.match(/name="_xlnm.Print_Area"[^>]*>[^!]+!([^<]+)/)?.[1]||'$B$3:$J$52';names.push(`<definedName name="_xlnm.Print_Area" localSheetId="${idx}">'${esc(name)}'!${range}</definedName>`);
  const sheet=read(pack.find(e=>e.name==='xl/worksheets/sheet1.xml')); // summary is linked to the actual adjusted template row below.
  const ov=unitOv(input.ov,r.u),floorOff=Math.max(0,ov.floorDetail.split('\n').filter(s=>s.trim()).length-6),n=ov.landParcels.length,offset=floorOff+(n>3?2*(n-3)-1:0),areaRow=34+offset;
  const vals=[r.values['일련번호'],r.u.dong||'',r.u.floor||'',r.u.ho||'',Number(r.u.area)||0,r.area??'',r.u.landArea===''||r.u.landArea==null?'':Number(r.u.landArea),r.amount??''];
  summaryRows.push(`<row r="${i+5}">`+vals.map((v,j)=>cell(String.fromCharCode(65+j)+(i+5),v,typeof v==='number'&&[4,5,7].includes(j)?`'${name.replace(/'/g,"''")}'!${{4:'G',5:'H',7:'I'}[j]}${areaRow}`:null)).join('')+'</row>');
 }
 const end=m.rows.length+4;summaryRows.push(`<row r="${end+1}">`+cell('A'+(end+1),'합계')+cell('H'+(end+1),m.total??'',m.total==null?null:`IF(COUNT(H5:H${end})=${m.rows.length},SUM(H5:H${end}),"")`)+'</row>');
 const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
 entries.push(entry('xl/worksheets/summary.xml',`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${ns}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="4" width="12" customWidth="1"/><col min="5" max="7" width="18" customWidth="1"/><col min="8" max="8" width="24" customWidth="1"/></cols><sheetData>${summaryRows.join('')}</sheetData><pageMargins left="0.3" right="0.3" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/></worksheet>`));
 entries.push(entry('xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets><sheet name="총괄" sheetId="1" r:id="summary"/>${sheets.join('')}</sheets><definedNames>${names.join('')}</definedNames><calcPr fullCalcOnLoad="1"/></workbook>`));
 let wr=read(packs[0].find(e=>e.name==='xl/_rels/workbook.xml.rels')).replace(/<Relationship[^>]*Type="[^"]*\/worksheet"[^>]*\/>/g,'');wr=wr.replace('</Relationships>',`<Relationship Id="summary" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/summary.xml"/>${rels.join('')}</Relationships>`);entries.push(entry('xl/_rels/workbook.xml.rels',wr));
 ct=ct.replace('</Types>','<Override PartName="/xl/worksheets/summary.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');entries.push(entry('[Content_Types].xml',ct));
 // Keep the existing package metadata relationship valid without stale template sheet names.
 entries.push(entry('docProps/app.xml','<?xml version="1.0" encoding="UTF-8"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Ongyeol</Application></Properties>'));
 return {bytes:h.createZipStored(entries),model:m};
}
g.ArapMultiDocuments={yohang,myeongse};
})(window);
