/* Supplied statement layout; typed cell mapping follows the condominium exporter. */
(function(){
'use strict';
var $=function(id){return document.getElementById(id);},A=window.ArapCheonggu;
function yohangMap(){
  var l=LANDS[0]||{};
  return {'소재지_동':l['소재지']||'','인근위치설명':cgVal('op_location'),
    '요항_지세':l['지세']==='평지'?'평탄':'','토지_형상':l['형상']||'',
    '요항_이용상황':l['이용상황']||'','요항_건물구조':[cgVal('bt_strct'),cgVal('bt_flrs')].filter(Boolean).join(' '),
    '요항_이용상태':cgVal('bt_purps')};
}
async function buildYohang(){
  var b64=await fetchTplB64('템플릿/토건 요항표 템플릿.hwpx');
  var entries=await A.parseZip(Uint8Array.from(atob(b64),function(c){return c.charCodeAt(0);}).buffer);
  var dec=new TextDecoder(),enc=new TextEncoder(),map=yohangMap();
  var header=xml(dec.decode(entries.find(function(e){return e.name==='Contents/header.xml';}).data));
  var red=new Set(Array.from(header.getElementsByTagNameNS('*','charPr')).filter(function(p){return (p.getAttribute('textColor')||'').toUpperCase()==='#FF0000';}).map(function(p){return p.getAttribute('id');}));
  entries.filter(function(e){return /^Contents\/section\d+\.xml$/.test(e.name);}).forEach(function(e){
    var d=xml(dec.decode(e.data));
    Array.from(d.getElementsByTagNameNS('*','run')).filter(function(r){return red.has(r.getAttribute('charPrIDRef'));}).forEach(function(r){
      Array.from(r.getElementsByTagNameNS('*','t')).forEach(function(t){t.textContent=t.textContent.replace(/\{\{([^{}]+)\}\}/g,function(full,k){return map[k]||full;});});
    });
    e.data=enc.encode(ser(d));
  });
  // Rebuild previews so the original placeholder preview is not mistaken for output.
  entries=entries.filter(function(e){return !/^Preview\//.test(e.name);});
  var mi=entries.findIndex(function(e){return e.name==='mimetype';});if(mi>0)entries.unshift(entries.splice(mi,1)[0]);
  return A.createZipStored(entries);
}
function statementRows(){
  calcGongsi();renderBldCalc();calcFinal();
  var gs=window.GONGSI_RESULT||{},br=window.BLD_RESULT||{rows:[]};
  if(!gs.rows||!gs.total)throw Error('본건 토지와 공시지가기준법 계산을 먼저 입력해 주세요.');
  if(bldRows().some(function(r){return num(r['연면적'])>0;})&&br.rows.some(function(r){return r.size>0&&!r.reCost;}))throw Error('건물평가 탭에서 모든 층의 재조달원가를 입력해 주세요.');
  var rows=LANDS.map(function(l,i){var g=gs.rows[i];return {'명세_기호':String(i+1),'명세_소재지':l['소재지']||'','명세_지번':l['지번']||'','명세_지목용도':l['지목']||'','명세_지역구조':l['용도지역']||'','명세_공부면적':num(l['면적']),'명세_사정면적':num(l['면적']),'명세_단가':g.apply,'명세_평가액':g.total,'명세_비고':l['비고']||''};});
  var land=LANDS[0]||{};
  // 건물 비고는 원가법 근거 두 줄: 재조달원가 / x 잔존연수·내용연수
  br.rows.filter(function(r){return r.size>0;}).forEach(function(r){var d=r.data;
    var note=d['비고']||[won(r.reCost),'x '+r.remaining+'/'+r.life].join('\n');
    rows.push({'명세_기호':d['동']||'가','명세_소재지':d['소재지']||land['소재지']||'','명세_지번':d['지번']||land['지번']||'','명세_지목용도':[d['용도'],d['층별']].filter(Boolean).join('\n'),'명세_지역구조':d['구조']||cgVal('bt_strct'),'명세_공부면적':r.size,'명세_사정면적':r.size,'명세_단가':r.apply,'명세_평가액':r.total,'명세_비고':note});});
  return rows;
}
var X='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
function xml(s){var d=new DOMParser().parseFromString(s,'application/xml');if(d.querySelector('parsererror'))throw Error('양식 XML 오류');return d;}
function nodes(d,n){return Array.from(d.getElementsByTagNameNS(X,n));}
function ser(d){return new XMLSerializer().serializeToString(d);}
function cell(doc,ref,style,value,formula){var c=doc.createElementNS(X,'c');c.setAttribute('r',ref);if(style!=null)c.setAttribute('s',style);
  if(formula){var f=doc.createElementNS(X,'f');f.textContent=formula;c.append(f);}
  if(typeof value==='number'){var v=doc.createElementNS(X,'v');v.textContent=value;c.append(v);}
  else if(value!=null&&value!==''){c.setAttribute('t','inlineStr');var is=doc.createElementNS(X,'is'),t=doc.createElementNS(X,'t');t.textContent=String(value);is.append(t);c.append(is);}return c;
}
// 셀 줄바꿈: 괄호 앞에서 먼저 끊고(다가구주택 / (1가구)), 그래도 길면 n글자로 자른다
function chunks(v,n){return String(v||'').split('\n').flatMap(function(line){
  var out=[],cur='';
  (line.match(/\([^)]*\)?|[^(]+/g)||['']).forEach(function(part){
    while(part.length){
      if(!cur&&part.length<=n){cur=part;part='';}
      else if(cur&&cur.length+part.length<=n){cur+=part;part='';}
      else if(cur){out.push(cur);cur='';}
      else{out.push(part.slice(0,n));part=part.slice(n);}
    }
  });
  if(cur)out.push(cur);
  return out.length?out:[''];
});}
async function buildStatement(rows){
  var raw=await fetchTplB64('템플릿/토건 명세표 템플릿.xlsx'),entries=await A.parseZip(Uint8Array.from(atob(raw),function(c){return c.charCodeAt(0);}).buffer),dec=new TextDecoder(),enc=new TextEncoder();
  var entry=entries.find(function(e){return /^xl\/worksheets\/sheet\d+\.xml$/.test(e.name);}),d=xml(dec.decode(entry.data)),sd=nodes(d,'sheetData')[0],original=nodes(sd,'row');
  // 양식에서 첫 데이터행(플레이스홀더가 있는 행)과 합계행(SUM 수식이 있는 행)을 찾아 쓴다 — 행 번호를 코드에 고정하지 않는다.
  var sample=original.find(function(row){return nodes(row,'t').some(function(t){return /\{\{명세_/.test(t.textContent);});});
  var footer=original.find(function(row){return nodes(row,'f').some(function(f){return /^SUM\(/.test(f.textContent);});});
  if(!sample||!footer)throw Error('명세표 양식에서 플레이스홀더 행 또는 합계행을 찾지 못했습니다.');
  var style={};nodes(sample,'c').forEach(function(c){style[c.getAttribute('r').replace(/\d/g,'')]=c.getAttribute('s');});
  var start=+sample.getAttribute('r'),base=+footer.getAttribute('r');
  var rowAttrs=['ht','customHeight','spans','x14ac:dyDescent'].map(function(a){return [a,sample.getAttribute(a)];}).filter(function(p){return p[1]!=null;});
  // B~K 열 순서. J(금액)는 값이 아니라 단가×사정면적 수식으로 넣는다(양식과 동일).
  var keys={B:'기호',C:'소재지',D:'지번',E:'지목용도',F:'지역구조',G:'공부면적',H:'사정면적',I:'단가',K:'비고'};
  var wide={C:9,F:12,K:12},numeric={G:1,H:1,I:1},cols=['B','C','D','E','F','G','H','I','J','K'],r=start,total=0;
  var newRow=function(n){var row=d.createElementNS(X,'row');row.setAttribute('r',n);rowAttrs.forEach(function(p){row.setAttribute(p[0],p[1]);});return row;};
  original.filter(function(row){var n=+row.getAttribute('r');return n>=start&&n<base;}).forEach(function(row){row.remove();});
  rows.forEach(function(item){
    var split={};cols.forEach(function(c){var k=keys[c];
      if(!k){split[c]=[];return;}
      if(numeric[c]){split[c]=[item['명세_'+k]];return;}
      // 비고에 적은 재조달원가처럼 숫자만 있는 줄은 숫자로 넣어 양식의 천단위 서식을 그대로 받는다
      split[c]=chunks(item['명세_'+k],wide[c]||8).map(function(line){return c==='K'&&/^[\d,]+$/.test(line)?Number(line.replace(/,/g,'')):line;});
    });
    var height=Math.max(4,...cols.map(function(c){return split[c].length;}));
    for(var j=0;j<height;j++){var row=newRow(r);
      (function(rr,first){cols.forEach(function(c){
        row.append(c==='J'?cell(d,'J'+rr,style.J,null,first?'+I'+rr+'*H'+rr:null):cell(d,c+rr,style[c],split[c][j]));
      });})(r,j===0);
      sd.insertBefore(row,footer);r++;}
    total+=item['명세_평가액'];
  });
  var end=Math.max(base,r+1),shift=end-base;
  for(var blank=r;blank<end;blank++){var empty=newRow(blank);cols.forEach(function(c){empty.append(cell(d,c+blank,style[c],null));});sd.insertBefore(empty,footer);}
  // Keep the full body and move totals/print area for additional parcels and floors.
  original.filter(function(row){return +row.getAttribute('r')>=base;}).forEach(function(row){var nr=+row.getAttribute('r')+shift;row.setAttribute('r',nr);nodes(row,'c').forEach(function(c){c.setAttribute('r',c.getAttribute('r').replace(/\d+$/,nr));});});
  var old=nodes(footer,'c').find(function(c){return c.getAttribute('r')==='J'+end;});var sum=cell(d,'J'+end,old&&old.getAttribute('s'),total,'SUM(J'+start+':J'+(end-1)+')');if(old)old.replaceWith(sum);else footer.append(sum);
  var dim=nodes(d,'dimension')[0];if(dim&&/\d+$/.test(dim.getAttribute('ref')||''))dim.setAttribute('ref',dim.getAttribute('ref').replace(/\d+$/,function(n){return +n+shift;}));
  // 인쇄 설정(배율·용지)은 양식 그대로 두고, 행이 늘어난 만큼 인쇄범위 끝만 밀어 준다.
  entry.data=enc.encode(ser(d));
  var book=entries.find(function(e){return e.name==='xl/workbook.xml';}),bd=xml(dec.decode(book.data));
  nodes(bd,'definedName').forEach(function(n){if(n.getAttribute('name')==='_xlnm.Print_Area'&&shift)n.textContent=n.textContent.replace(/\d+$/,function(v){return +v+shift;});});
  var cp=nodes(bd,'calcPr')[0]||bd.documentElement.appendChild(bd.createElementNS(X,'calcPr'));cp.setAttribute('fullCalcOnLoad','1');book.data=enc.encode(ser(bd));
  if(shift)entries.filter(function(e){return /^xl\/drawings\/drawing\d+\.xml$/.test(e.name);}).forEach(function(e){var drawing=xml(dec.decode(e.data));Array.from(drawing.getElementsByTagNameNS('*','row')).forEach(function(n){if(+n.textContent>=base-1)n.textContent=String(+n.textContent+shift);});e.data=enc.encode(ser(drawing));});
  return A.createZipStored(entries);
}
async function run(button,action){button.disabled=true;$('doc_status').textContent='문서를 만드는 중…';try{await action();$('doc_status').textContent='파일을 받았습니다.';}catch(e){$('doc_status').textContent=e.message;console.error(e);}finally{button.disabled=false;}}
$('btnMyeongse').onclick=function(){return run(this,async function(){var bytes=await buildStatement(statementRows());A.triggerDownload(bytes,'5. 명세표_'+(cgVal('ov_client')||'의뢰인')+'.xlsx');});};
$('btnYohang').onclick=function(){return run(this,async function(){var bytes=await buildYohang();A.triggerDownload(bytes,'4. 요항표_'+(cgVal('ov_client')||'의뢰인')+'.hwpx');});};
window.ArapTojiDocuments={statementRows:statementRows,buildStatement:buildStatement,yohangMap:yohangMap,buildYohang:buildYohang};
})();
