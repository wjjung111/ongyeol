/* Supplied statement layout; typed cell mapping follows the condominium exporter. */
(function(){
'use strict';
var $=function(id){return document.getElementById(id);},A=window.ArapCheonggu;
// 요항표 토큰 = 요항표 탭 입력칸. 빈 칸은 채우지 않고 양식 표시를 그대로 남긴다(한글에서 직접 작성).
function yohangMap(){
  return {'소재지_동':cgVal('y_dong'),'인근위치설명':cgVal('y_near'),'요항_교통':cgVal('y_traffic'),
    '요항_지세':cgVal('y_jise'),'토지_형상':cgVal('y_shape'),'요항_이용상황':cgVal('y_use'),
    '요항_도로1방위':cgVal('y_road1dir'),'요항_도로1노폭':cgVal('y_road1w'),
    '요항_도로2방위':cgVal('y_road2dir'),'요항_도로2노폭':cgVal('y_road2w'),
    '요항_건물구조':cgVal('y_struct'),'요항_외벽':cgVal('y_wall'),'요항_창호':cgVal('y_window'),
    '요항_이용상태':cgVal('y_usestate')};
}
// {{토큰}}이 든 <hp:p> 문단을 값의 줄 수만큼 복제한다(줄배치 캐시 제거 → 한글이 다시 배치).
// 집합건물 expandYohangPara와 같은 방식. 값이 비면 아무것도 하지 않고 양식 표시를 남긴다.
function expandPara(xmlText,token,value,black){
  if(!value)return xmlText;
  var ti=xmlText.indexOf(token);if(ti<0)return xmlText;
  var ps=xmlText.lastIndexOf('<hp:p ',ti),pe=xmlText.indexOf('</hp:p>',ti);
  var esc=function(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');};
  if(ps<0||pe<0)return xmlText.split(token).join(esc(value));
  pe+=7;
  var tpl=xmlText.slice(ps,pe).replace(/<hp:linesegarray>[\s\S]*?<\/hp:linesegarray>/,'');
  Object.keys(black||{}).forEach(function(r){tpl=tpl.split('charPrIDRef="'+r+'"').join('charPrIDRef="'+black[r]+'"');});
  var clones=String(value).split('\n').map(function(line){return tpl.split(token).join(esc(line));}).join('');
  return xmlText.slice(0,ps)+clones+xmlText.slice(pe);
}
async function buildYohang(){
  var b64=await fetchTplB64('템플릿/토건 요항표 템플릿.hwpx');
  var entries=await A.parseZip(Uint8Array.from(atob(b64),function(c){return c.charCodeAt(0);}).buffer);
  var dec=new TextDecoder(),enc=new TextEncoder(),map=yohangMap();
  var headerXml=dec.decode(entries.find(function(e){return e.name==='Contents/header.xml';}).data),header=xml(headerXml);
  var charPrs=Array.from(header.getElementsByTagNameNS('*','charPr'));
  var red=new Set(charPrs.filter(function(p){return (p.getAttribute('textColor')||'').toUpperCase()==='#FF0000';}).map(function(p){return p.getAttribute('id');}));
  // 채운 글자는 검정으로 — 빨강 글자모양과 색만 다른 쌍둥이 글자모양을 찾아 쓴다(글자모양 목록은 건드리지 않음)
  var norm=function(p){return ser(p).replace(/ id="\d+"/,'').replace(/textColor="[^"]*"/,'');};
  var black={};charPrs.forEach(function(p){
    if(!red.has(p.getAttribute('id')))return;
    var twin=charPrs.find(function(q){return q!==p&&(q.getAttribute('textColor')||'').toUpperCase()==='#000000'&&norm(q)===norm(p);});
    if(twin)black[p.getAttribute('id')]=twin.getAttribute('id');
  });
  var toice=(typeof assembleToice==='function')?assembleToice():'';
  entries.filter(function(e){return /^Contents\/section\d+\.xml$/.test(e.name);}).forEach(function(e){
    var d=xml(dec.decode(e.data));
    Array.from(d.getElementsByTagNameNS('*','run')).filter(function(r){return red.has(r.getAttribute('charPrIDRef'));}).forEach(function(r){
      var filled=false;
      Array.from(r.getElementsByTagNameNS('*','t')).forEach(function(t){
        t.textContent=t.textContent.replace(/\{\{([^{}]+)\}\}/g,function(full,k){
          if(!map[k])return full;                       // 안 채운 칸은 양식 표시 그대로
          filled=true;return map[k];});
      });
      if(filled&&black[r.getAttribute('charPrIDRef')])r.setAttribute('charPrIDRef',black[r.getAttribute('charPrIDRef')]);
    });
    var out=ser(d);
    // 토지이용계획은 여러 줄 → 문단을 줄 수만큼 복제하고, 복제본 글자색도 검정으로
    out=expandPara(out,'{{요항_용도지역}}',toice,black);
    e.data=enc.encode(out);
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
async function run(button,action,statusId){var st=$(statusId||'doc_status');button.disabled=true;if(st)st.textContent='문서를 만드는 중…';
  try{await action();if(st)st.textContent='파일을 받았습니다.';}catch(e){if(st)st.textContent=e.message;console.error(e);}finally{button.disabled=false;}}
$('btnMyeongse').onclick=function(){return run(this,async function(){var bytes=await buildStatement(statementRows());A.triggerDownload(bytes,'5. 명세표_'+(cgVal('ov_client')||'의뢰인')+'.xlsx');});};
function downloadYohang(btn,statusId){return run(btn,async function(){var bytes=await buildYohang();A.triggerDownload(bytes,'4. 요항표_'+(cgVal('ov_client')||'의뢰인')+'.hwpx');},statusId);}
$('btnYohang').onclick=function(){return downloadYohang(this);};
if($('btnYohang2'))$('btnYohang2').onclick=function(){return downloadYohang(this,'y_status');};
window.ArapTojiDocuments={statementRows:statementRows,buildStatement:buildStatement,yohangMap:yohangMap,buildYohang:buildYohang};
})();
