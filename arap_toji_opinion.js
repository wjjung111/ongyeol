/* Codex: 토지건물 의견서 자동완성. 원본 hwpx는 보존하고 출력할 때만 반복표를 확장한다. */
(function(){
'use strict';
var HP='http://www.hancom.co.kr/hwpml/2011/paragraph';
var tokenRE=/\{\{([^{}]+)\}\}/g;
var text=function(v){return v==null?'':String(v);};
var money=function(v){return v==null?'':won(v);};
var fixed=function(v,n){return v==null?'':Number(v).toFixed(n);};
var area=function(v){return v==null?'':docArea(num(v));};
var val=function(id){return cgVal(id);};
function address(s){
  var m=text(s).trim().match(/^(.*?)\s+(산\s*\d+(?:-\d+)?|\d+(?:-\d+)?)(?:번지)?$/);
  return m?{loc:m[1],lot:m[2]}:{loc:text(s),lot:''};
}
function factors(prefix,values){
  var m={};['가로','접근','환경','획지','행정','기타'].forEach(function(k,i){m[prefix+'_'+k]=fixed(num(values[i]),2);});return m;
}
function landMap(L,i){
  var m={'토지_번호':i+1,'필지_번호':i+1,'공시개별_번호':i+1};
  ['소재지','지번','지목','용도지역','이용상황','형상','지세','비고'].forEach(function(k){m['토지_'+k]=text(L[k]);});
  m['토지_면적']=area(L['면적']);m['토지_공시지가']=hasV(L['공시지가'])?money(num(L['공시지가'])):'';
  // V-World의 도로교통은 하나의 코드명. 임의로 두 의미로 쪼개지 않는다.
  m['토지_도로']=text(L['도로교통']);m['토지_교통']='';return m;
}
function standardMap(S,i){
  var m={'표준지_기호':String.fromCharCode(65+i)};
  ['소재지','지번','지목','용도지역','형상','이용상황','도로교통','지세'].forEach(function(k){m['표준지_'+k]=text(S[k]);});
  m['표준지_면적']=area(S['면적']);m['표준지_공시지가']=money(num(S['공시지가']));return m;
}
function parcelMap(L,i,gs,ga){
  var g=gs.rows[i],a=(ga.rows||[])[i]||{};
  return Object.assign(landMap(L,i),standardMap(STDS[g.stdIdx]||{},g.stdIdx),factors('공시개별',g.factors),factors('거래개별',a.factors||[]),{
    '공시시점_치':fixed(g.time,5),'공시_지역요인':fixed(g.area,3),'공시개별_계':fixed(g.individual,3),
    '그밖_결정보정치':fixed(g.etc,2),'공시_산정단가':money(g.calculated),'공시_적용단가':money(g.apply),'공시_시산가액':money(g.total),
    '거래_채택단가':money(a.source),'거래_사정':fixed(a.sajeong,3),'거래_시점':fixed(a.time,5),'거래_지역':fixed(a.area,3),
    '거래_개별계':fixed(a.individual,3),'거래_산정단가':money(a.calculated),'거래_결정단가':money(a.apply),'거래_시산가액':money(a.total)
  });
}
function tradeMap(c,n){
  c=c||{};var m={},cal=tradeCalc(c),prefix='거래'+n+'_';
  var fields={소재지:'loc',용도지역:'use',지목:'jimok',승인일:'appr',주구조:'struct',내용연수:'life',거래일:'date'};
  Object.keys(fields).forEach(function(k){m[prefix+k]=text(c[fields[k]]);});
  ['토지면적','건물면적'].forEach(function(k,i){var v=c[i?'bldA':'landA'];m[prefix+k]=hasV(v)?area(v):'';});
  m[prefix+'재조달']=hasV(c.reCost)?money(num(c.reCost)):'';
  m[prefix+'총액']=hasV(c.total)?money(num(c.total)):'';
  m[prefix+'잔존연수']=hasV(c.rest)||cal.restAuto!=null?text(cal.rest):'';
  var active=['loc','total','landA','landUnit'].some(function(k){return hasV(c[k]);});
  var keys={건물단가:'bldUnit',건물금액:'bldAmt',토지금액:'landAmt',토지단가:'landUnit'};
  Object.keys(keys).forEach(function(k){m[prefix+k]=active?money(cal[keys[k]]):'';});return m;
}
function appraisalMap(a){
  var ad=address(a.loc);return {'평사1_기호':text(a.no),'평사1_소재지':ad.loc,'평사1_지번':ad.lot,
    '평사1_지목':text(a.jimok),'평사1_용도지역':text(a.use),'평사1_이용상황':text(a.cond),
    '평사1_단가':hasV(a.unit)?money(num(a.unit)):'','평사1_목적':text(a.purp),'평사1_시점':docDot(a.base)};
}
function floorMap(r){
  var d=r.data;return {'층1_번호':text(d['동'])||'가','층1_해당층':text(d['층별']),'층1_면적':area(r.size),
    '층1_이용상황':text(d['용도']),'층1_구조':text(d['구조']),'층1_구조2':'','층1_재조달':money(r.reCost),
    '층1_내용연수':text(r.life),'층1_경과연수':text(r.elapsed),'층1_잔가율':r.remaining+'/'+r.life,
    '층1_적용단가':money(r.apply),'층1_금액':money(r.total)};
}
function buildingMaps(rows){
  var groups=[];
  rows.forEach(function(r){var key=text(r.data['동'])||'가',g=groups.find(function(x){return x.key===key;});
    if(!g){g={key:key,rows:[]};groups.push(g);}g.rows.push(r);});
  return groups.map(function(g){
    var unique=function(k){return Array.from(new Set(g.rows.map(function(r){return text(r.data[k]);}).filter(Boolean))).join(', ');};
    var ad=address(cheongguAddr());return {'건물_번호':g.key,'건물_소재지':ad.loc,'건물_지번':ad.lot,
      '건물_구조':unique('구조')||val('bt_strct'),'건물_층수':groups.length===1?val('bt_flrs'):unique('층별'),
      '건물_용도':unique('용도')||val('bt_purps'),'건물_면적':area(g.rows.reduce(function(s,r){return s+r.size;},0)),
      '건물_승인일':docDot(val('bt_useApr')),'건물_비고':''};
  });
}
function newCostMaps(){
  var rows=val('op_costRows').split(/\r?\n/).filter(function(s){return s.trim();});
  if(rows.length&&/^(분류(기호)?|기호)$/.test(rows[0].split('\t')[0].trim()))rows.shift();
  return rows.map(function(s){var a=s.split('\t'),m={};
    if(a.length<6||a.length>7)throw new Error('건물신축단가표는 분류기호·용도·구조·급수·표준단가·내용연수(·범위) 6~7열로 붙여넣어 주세요.');
    ['분류','용도','구조','급수','단가','내용연수','범위'].forEach(function(k,i){m['신축1_'+k]=text(a[i]).trim();});return m;
  });
}
function opinionData(){
  var gs=window.GONGSI_RESULT,ga=window.GEORAE_RESULT||{},br=window.BLD_RESULT||{rows:[],total:0,size:0};
  if(!gs||!gs.rows||!gs.rows.length||!gs.total)throw new Error('본건 토지와 공시지가기준법 계산을 먼저 입력해 주세요.');
  var etc=gs.etc,choice=etcCase(),choiceName=ETC.type==='t'?'거래사례 #'+(ETC.idx+1):'평가사례 '+text(choice&&choice.no);
  var tm=etcTimeMeta(),selected=TRADES[GA.idx]||{},gt=(ga.rows||[])[0]||{};
  var date=docDot(val('base_gongsi'));
  var m={
    '소재지_동':address(cheongguAddr()).loc,'인근위치설명':val('op_location')||'[인근 위치 기입]',
    '평가구분':val('ov_kind'),'평가목적':val('ov_purpose'),'기준시점':docDot(val('base_gijun')),'조사기간':docDot(val('base_josa')),
    '공시기준일':date,'공시지가_연도':date.slice(0,4),
    '공시시점_설명':[val('jb_region'),'('+date+'~'+docDot(val('base_gijun'))+')',val('jb_use')].filter(Boolean).join(' '),
    '공시시점_치':fixed(gs.rows[0].time,5),'공시시점_률':fixed((gs.rows[0].time-1)*100,3)+'%',
    '공시개별_의견':val('g_opinion'),'거래개별_의견':val('ga_opinion'),'그밖개별_의견':val('e_opinion'),
    '그밖_채택사례':choiceName,'그밖_사례기호':ETC.type==='t'?'#'+(ETC.idx+1):text(choice&&choice.no),
    '그밖_사례단가':money(etc.source),'그밖_사정':fixed(etc.sajeong,3),'그밖_시점':fixed(etc.time,5),
    '그밖_지역':fixed(etc.area,3),'그밖_개별':fixed(etc.individual,3),'그밖_산출단가':money(etc.out1),
    '그밖_비교치':fixed(etc.ratio,2),'그밖_표준지_시점':fixed(etc.stdTime,5),'그밖_표준지_개별':fixed(etc.stdIndividual,3),
    '그밖_표준지현재':money(etc.out2),'그밖개별_계':fixed(mul('.ef'),3),
    '그밖_시점설명':(tm?timeMetaLabel(tm):'')+') : '+fixed(etc.time,5),
    '거래_채택기호':'#'+(GA.idx+1),'거래_시점설명':timeMetaLabel(selected.timeMeta)||'('+docDot(selected.date)+'~'+docDot(val('base_gijun'))+')',
    '거래_시점률':gt.time==null?'':fixed((gt.time-1)*100,3)+'%','거래_시점':fixed(gt.time,5),
    '공시_시산가액':money(gs.total),'거래_시산가액':money(ga.total),'토지감정평가액':money(window.LAND_FINAL),
    '토지_면적':area(gs.size),'공시_적용단가':gs.rows.every(function(r){return r.apply===gs.rows[0].apply;})?money(gs.applyUnit):'필지별 상이',
    '건물_합계면적':area(br.size),'건물가액':money(br.total),'감정평가액':money((window.LAND_FINAL||0)+br.total)
  };
  Object.assign(m,factors('그밖개별',[1,2,3,4,5,6].map(function(i){return val('e_f'+i);})),standardMap(STDS[etc.stdIdx]||{},etc.stdIdx));
  // 계산표의 수동 공시지가 수정은 그 밖의 요인 표에만 적용한다.
  var detail=Object.assign({},m,{'표준지_공시지가':money(etc.price)});
  var parcels=LANDS.map(function(L,i){return parcelMap(L,i,gs,ga);});
  var standards=STDS.map(function(S,i){return Object.assign(standardMap(S,i),{
    '필지_번호':gs.rows.map(function(r,j){return r.stdIdx===i?j+1:null;}).filter(Boolean).join(', '),
    '그밖_결정보정치':fixed((gs.rows.find(function(r){return r.stdIdx===i;})||{}).etc,2)
  });});
  return {global:m,detail:detail,parcels:parcels,standards:standards,buildings:buildingMaps(br.rows||[]),
    appraisals:APPRS.filter(apprHasData).map(appraisalMap),floors:(br.rows||[]).map(floorMap),newCosts:newCostMaps(),
    trades:TRADES.map(function(c,i){return {data:c,index:i};}),stdSajeong:etc.stdSajeong,stdArea:etc.stdArea};
}
function descendants(el,name){return Array.from(el.getElementsByTagNameNS(HP,name));}
function children(el,name){return Array.from(el.children).filter(function(n){return n.namespaceURI===HP&&n.localName===name;});}
function hasToken(el,k){return el.textContent.indexOf('{{'+k+'}}')>=0;}
function clearLines(el){descendants(el,'linesegarray').forEach(function(n){n.remove();});}
// 행별 토큰을 구분한 뒤 마지막에 한 번만 치환한다. 입력값 속 {{...}}는 재해석하지 않는다.
function scope(el,map,state){
  descendants(el,'t').forEach(function(t){
    t.textContent=t.textContent.replace(tokenRE,function(full,k){
      if(!Object.prototype.hasOwnProperty.call(map,k))return full;
      var key='__op'+(state.seq++);state.map[key]=text(map[k]);return '{{'+key+'}}';
    });
  });
}
function resizeRows(tbl,start,count,blockSize,maps,state){
  var rows=children(tbl,'tr'),oldHeight=Number(children(tbl,'sz')[0].getAttribute('height'));
  var height=function(rs){return rs.reduce(function(sum,r){return sum+Math.max(0,...children(r,'tc').map(function(c){
    return Number(children(c,'cellSz')[0].getAttribute('height'))/Number(children(c,'cellSpan')[0].getAttribute('rowSpan'));
  }));},0);};
  var oldRows=rows.slice(start,start+count),proto=rows.slice(start,start+blockSize),newRows=[];
  if(!maps.length){var empty={};(oldRows[0].textContent.match(tokenRE)||[]).forEach(function(k){empty[k.slice(2,-2)]='';});maps=[empty];}
  maps.forEach(function(map,mi){proto.forEach(function(r,ri){
    var clone=r.cloneNode(true);
    // 개별요인 표의 번호·사례 셀은 마지막 의견 행까지 세로 병합돼 있다.
    // 앞쪽 복제행은 한 행으로 닫고 마지막 복제행만 의견 행과의 병합을 유지한다.
    children(clone,'tc').forEach(function(c){
      var span=children(c,'cellSpan')[0],size=children(c,'cellSz')[0],old=Number(span.getAttribute('rowSpan'));
      if(start+ri+old>start+count&&mi<maps.length-1){var next=blockSize-ri;span.setAttribute('rowSpan',String(next));size.setAttribute('height',String(Math.round(Number(size.getAttribute('height'))*next/old)));}
    });
    scope(clone,map,state);clearLines(clone);tbl.insertBefore(clone,oldRows[0]);newRows.push(clone);
  });});
  oldRows.forEach(function(r){r.remove();});
  var all=children(tbl,'tr');all.forEach(function(r,i){children(r,'tc').forEach(function(c){children(c,'cellAddr')[0].setAttribute('rowAddr',String(i));});});
  tbl.setAttribute('rowCnt',String(all.length));
  children(tbl,'sz')[0].setAttribute('height',String(Math.round(oldHeight-height(oldRows)+height(newRows))));
  var host=tbl.parentNode;while(host&&!(host.namespaceURI===HP&&host.localName==='p'))host=host.parentNode;
  if(host)children(host,'linesegarray').forEach(function(n){n.remove();});
}
function blankMap(el){var m={};(el.textContent.match(tokenRE)||[]).forEach(function(s){m[s.slice(2,-2)]='';});return m;}
function replacePlain(root,from,to){descendants(root,'t').forEach(function(t){if(t.textContent.indexOf(from)>=0)t.textContent=t.textContent.split(from).join(to);});}
function opinionXml(xml,data){
  var doc=new DOMParser().parseFromString(xml,'application/xml');
  if(doc.getElementsByTagName('parsererror').length)throw new Error('의견서 템플릿 XML을 읽을 수 없습니다.');
  var state={seq:0,map:Object.assign({},data.global)},tables=descendants(doc,'tbl');
  // 토큰으로 표를 식별한다. 표 번호나 XML 문자열 위치에 의존하지 않는다.
  tables.forEach(function(tbl){
    var rows=children(tbl,'tr');
    if(hasToken(tbl,'토지_소재지'))resizeRows(tbl,1,1,1,data.parcels,state);
    else if(hasToken(tbl,'건물_소재지'))resizeRows(tbl,1,1,1,data.buildings.length?data.buildings:[blankMap(tbl)],state);
    else if(hasToken(tbl,'표준지_소재지'))resizeRows(tbl,2,2,2,data.standards,state);
    else if(hasToken(tbl,'공시시점_설명'))resizeRows(tbl,1,1,1,data.standards,state);
    else if(hasToken(tbl,'공시개별_번호'))resizeRows(tbl,1,1,1,data.parcels,state);
    else if(hasToken(tbl,'평사1_기호'))resizeRows(tbl,1,3,1,data.appraisals.length?data.appraisals:[blankMap(tbl)],state);
    else if(hasToken(tbl,'그밖_사례단가')){
      scope(tbl,data.detail,state);
      // 템플릿의 '-' 고정칸도 화면에서 바꾼 표준지 사정·지역 보정치와 맞춘다.
      [2,4].forEach(function(col,i){var t=descendants(children(rows[2],'tc')[col],'t')[0];t.textContent=fixed(i?data.stdArea:data.stdSajeong,3);});
    }
    else if(hasToken(tbl,'필지_번호')){
      resizeRows(tbl,1,1,1,hasToken(tbl,'그밖_사례기호')?data.standards:data.parcels,state);
    }
    else if(hasToken(tbl,'층1_번호'))resizeRows(tbl,1,5,1,data.floors.length?data.floors:[blankMap(tbl)],state);
    else if(hasToken(tbl,'신축1_분류')){
      var refs=data.newCosts;
      if(!refs.length){var b=blankMap(tbl);Object.keys(b).forEach(function(k){b[k]='[기입]';});refs=[b];}
      resizeRows(tbl,1,2,1,refs,state);
    }
  });
  // 거래사례는 3열 양식을 유지하고, 4개 이상이면 같은 표를 이어 붙인다. 사례 번호는 원래 번호 보존.
  tables.filter(function(t){return hasToken(t,'거래1_소재지');}).forEach(function(tbl){
    var host=tbl;while(host.parentNode&&!(host.namespaceURI===HP&&host.localName==='p'))host=host.parentNode;
    var last=host,groups=Math.max(1,Math.ceil(data.trades.length/3));
    for(var g=0;g<groups;g++){
      var target=g?host.cloneNode(true):host;
      // 모든 복사본은 값 치환 전 원본을 사용한다(아래에서 일괄 scope).
      if(g){last.parentNode.insertBefore(target,last.nextSibling);last=target;}
    }
    var target=host;
    for(var g=0;g<groups;g++){
      var table=descendants(target,'tbl')[0],map={};
      table.setAttribute('id',String(1900000000+state.seq++));
      for(var c=0;c<3;c++){
        var item=data.trades[g*3+c];Object.assign(map,tradeMap(item&&item.data,c+1));
        var t=descendants(children(children(table,'tr')[0],'tc')[c+1],'t')[0];t.textContent=item?'거래사례#'+(item.index+1):'';
      }
      scope(table,map,state);clearLines(target);target=target.nextSibling;
    }
  });
  // 원본의 고정 샘플 문구 중 이미 앱에서 입력받는 항목을 연결한다. 법령·방법론 본문은 유지.
  replacePlain(doc,'귀 제시일인',val('ov_gijunBasis')||'귀 제시일인');
  replacePlain(doc,'일반거래(시가참고)',val('ov_purpose'));
  replacePlain(doc,'한국부동산원, 2025년',val('op_costSource')||'[건물신축단가표 출처·연도 기입]');
  replacePlain(doc,'헙계','합계');
  if(ETC.type==='a')replacePlain(doc,'상기와 같이 거래사례를 기준한','상기와 같이 평가사례를 기준한');
  descendants(doc,'p').filter(function(p){return p.parentNode===doc.documentElement;}).forEach(function(p){
    if(p.textContent.indexOf('본건은 ')===0&&p.textContent.indexOf('토지 및 건물의 특성')>=0&&val('fn_opinion')){
      var ts=descendants(p,'t');if(ts.length){ts[0].textContent=val('fn_opinion');ts.slice(1).forEach(function(t){t.textContent='';});clearLines(p);}
    }
  });
  var missing=new Set();
  descendants(doc,'t').forEach(function(t){
    var old=t.textContent;
    t.textContent=old.replace(tokenRE,function(full,k){if(!Object.prototype.hasOwnProperty.call(state.map,k)){missing.add(k);return full;}return text(state.map[k]);});
    if(old!==t.textContent){var p=t.parentNode;while(p&&p.localName!=='p')p=p.parentNode;if(p)children(p,'linesegarray').forEach(function(n){n.remove();});}
  });
  if(missing.size)throw new Error('연결되지 않은 의견서 항목: '+Array.from(missing).join(', '));
  return new XMLSerializer().serializeToString(doc);
}
async function buildOpinion(b64,data){
  var A=window.ArapCheonggu,bin=atob(b64),bytes=Uint8Array.from(bin,function(c){return c.charCodeAt(0);});
  var entries=await A.parseZip(bytes.buffer),found=false;
  entries.forEach(function(e){if(/^Contents\/section\d+\.xml$/.test(e.name)){
    e.data=new TextEncoder().encode(opinionXml(new TextDecoder().decode(e.data),data));found=true;
  }});
  if(!found)throw new Error('의견서 본문이 없는 템플릿입니다.');
  // 미리보기에는 원본 템플릿의 토큰이나 예전 샘플이 남지 않게 한다.
  entries=entries.filter(function(e){return e.name!=='Preview/PrvImage.png';});
  var preview=entries.find(function(e){return e.name==='Preview/PrvText.txt';});
  if(preview)preview.data=new TextEncoder().encode('감정평가액의 산출근거 및 결정의견\n감정평가액 '+data.global['감정평가액']+'원');
  var mi=entries.findIndex(function(e){return e.name==='mimetype';});if(mi>0)entries.unshift(entries.splice(mi,1)[0]);
  return A.createZipStored(entries);
}
window.ArapTojiOpinion={data:opinionData,build:buildOpinion,xml:opinionXml};
window.downloadOpinion=async function(){
  var btn=document.getElementById('btnOpinion'),status=document.getElementById('op_status');
  btn.disabled=true;status.textContent='의견서를 만드는 중…';
  try{
    calcGongsi();renderBldCalc();calcFinal();
    var data=opinionData(),b64=await fetchTplB64('템플릿/토건 의견서(산출근거) 템플릿.hwpx');
    var bytes=await buildOpinion(b64,data);
    window.ArapCheonggu.triggerDownload(bytes,'3. 의견서(산출근거)_'+(val('ov_client')||'의뢰인')+'.hwpx');
    status.textContent='의견서를 받았습니다. 한글에서 의견 문구'+(!val('op_location')||!data.newCosts.length?'와 [기입] 표시':'')+'를 확인하세요.';
  }catch(e){console.error('의견서 생성 실패',e);status.textContent='의견서 생성 실패: '+e.message;}
  finally{btn.disabled=false;}
};
})();
