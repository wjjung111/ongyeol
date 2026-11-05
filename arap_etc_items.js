/* arap_etc_items.js — 집합건물 의견서 「6. 그 밖의 사항」 추가 문구 (2026-11-05)
 * 2. 대상물건개요 탭의 문구 박스에 적은 항목(ov.etcItems: 문자열 배열)을 한글 의견서 그 밖의 사항
 * 맨 끝(라. 또는 지분평가 마. 다음)에 바./사.… 항목으로 그대로 넣는다. 단일호수·여러호수 공용.
 * - Card: React 화면(React.createElement — babel 없이). props {ov,setOv,S,C,BTN,shareText,pushUndo}
 * - insertXml(xml,n,tokenOf): 섹션 XML 문자열의 그 밖의 사항 끝에 빈 줄+항목 n개(본문은 {{토큰}})를 끼운다
 * - texts(ov,shareText): 의견서에 들어갈 문구 목록(지분 문구 먼저, 빈 항목 제외, 줄바꿈은 한 칸)
 * - presets(ov): 자주 쓰는 문구(대지권미등기 등) — 지번·용도지역을 넣어 만든다
 */
(function(g){
'use strict';
var L='가나다라마바사아자차카타파하';
var oneLine=function(s){return String(s==null?'':s).replace(/\s*\n\s*/g,' ').trim();};
function list(ov){return Array.isArray(ov&&ov.etcItems)?ov.etcItems.map(function(x){return String(x==null?'':x);}):[];}
function texts(ov,shareText){var out=[];var s=oneLine(shareText);if(s)out.push(s);list(ov).forEach(function(t){t=oneLine(t);if(t)out.push(t);});return out;}

// 지번에서 도시개발지구 이름·블럭/로트를 뽑는다 — 「경서3구역도시개발지구25블럭1로트」 → 「경서3구역 도시개발지구」·「25블럭 1로트」
function devZone(jibun){
  var s=String(jibun||'').replace(/\s+/g,' ');
  var m=s.match(/([가-힣0-9]*?)\s*((?:도시개발|택지개발|공공주택|산업|구획정리|재개발|재건축)?\s*(?:사업)?\s*지구)\s*([0-9]+[A-Za-z]?\s*(?:블럭|블록|BL)(?:\s*[0-9]+\s*(?:로트|롯트|LT))?)/i);
  if(!m)return null;
  var name=(m[1]?m[1]+' ':'')+m[2].replace(/\s+/g,'');
  var lot=m[3].replace(/\s+/g,'').replace(/(블럭|블록|BL)(\d)/i,'$1 $2');
  return {name:name.trim(),lot:lot};
}
var LAW='「집합건물의 소유 및 관리에 관한 법률」 제20조';
function presets(ov){
  ov=ov||{};var z=devZone(ov.jibun),zn=z?z.name:'○○ 도시개발지구',lot=z?z.lot:'○○블럭 ○로트',zoning=String(ov.zoning||'').trim()||'○○지역';
  return [
    {key:'daeji',label:'대지권미등기',
     text:'본건은 기준시점 현재 등기사항전부증명서상 전유부분의 건물의 표시만 되어 있고 대지권이 미등기되어 있으나, '+LAW+'의 규정에 따라 구분건물과 대지사용권이 일체성을 갖고 전유부분과 분리하여 대지사용권을 처분할 수 없도록 규정하고 있으며 일반적으로 이에 따라 분양 및 거래되므로 추후 적정 대지지분이 이전·취득될 것을 전제로 평가하였으니 업무진행 시 참고 바람.'},
    {key:'daejiDev',label:'대지권미등기 (도시개발지구·지적 미정리)',
     text:'본건은 '+zn+' 내 구분소유건물로서, 기준시점 현재 지적이 미정리된 상태('+lot+')로 등기사항전부증명서상 전유부분의 건물의 표시만 되어 있고 대지권이 미등기되어 있으나, '+LAW+'에 따라 구분건물과 대지사용권이 일체성을 가지며 일반적으로 이에 따라 분양 및 거래되는 바, 추후 적정 대지지분이 이전·취득될 것을 전제로 건물과 대지사용권을 일체로 감정평가하였으니 업무진행 시 참고 바람.'},
    {key:'toice',label:'토지이용계획 발급 불가 (지적 미정리)',
     text:'본건은 기준시점 현재 '+zn+' 내 지적이 미정리된 상태로서 토지이용계획확인서, 토지대장 등의 발급이 불가하며, 집합건축물대장상 본건 대지의 용도지역은 \''+zoning+'\'으로 기재되어 있으니 업무진행 시 참고 바람.'}
  ];
}
// 대지권미등기로 보이는지 — 지번이 블럭·로트이거나, 지번·전유면적은 있는데 대지권비율이 비어 있음
function hint(ov){
  ov=ov||{};if(!String(ov.jibun||'').trim())return '';
  if(/(블럭|블록|로트|롯트)/.test(ov.jibun)||devZone(ov.jibun))return '지번이 「블럭·로트」로 되어 있습니다 — 지적 미정리(대지권미등기) 건일 수 있습니다.';
  var empty=function(v){return !String(v==null?'':v).trim();};
  var noLand=Array.isArray(ov.units)?ov.units.length&&ov.units.every(function(u){return empty(u&&u.landArea);})&&empty(ov.landRatioDenom):(empty(ov.landArea)&&empty(ov.landRatioDenom));
  var hasArea=Array.isArray(ov.units)?ov.units.some(function(u){return !empty(u&&u.area);}):!empty(ov.area);
  return noLand&&hasArea?'대지권비율이 비어 있습니다 — 등기에 「대지권의 표시」가 없는 대지권미등기 건이면 아래 문구를 넣으세요.':'';
}

// 「6. 그 밖의 사항」 맨 끝 항목 다음에 빈 줄 + 다음 글자 항목 n개. 본문 런은 ' {{tokenOf(i)}}' — 값 채우기는 각 앱 치환기가 함(이스케이프 포함)
function insertXml(xml,n,tokenOf){
  if(!n)return xml;
  var h=xml.indexOf('그 밖의 사항'),end=xml.indexOf('Ⅱ. 대상물건 개요',h);if(h<0||end<0)return xml;
  var seg=xml.slice(h,end),re=/<hp:p\b[^>]*>(?:(?!<\/hp:p>)[\s\S])*?<hp:t>([가-하])\.<\/hp:t>[\s\S]*?<\/hp:p>/g,m,last=null;
  while((m=re.exec(seg)))last=m;if(!last)return xml;
  var at=h+last.index+last[0].length,k=L.indexOf(last[1]);
  var pOpen=last[0].match(/^<hp:p\b[^>]*>/)[0],hd=last[0].match(/<hp:run charPrIDRef="(\d+)"><hp:t>[가-하]\.<\/hp:t><\/hp:run>/),bd=last[0].match(/<hp:run charPrIDRef="(\d+)"><hp:t> /);
  if(!hd||!bd)return xml;
  var p='';
  for(var i=0;i<n;i++){var nx=L[k+1+i];if(!nx)break;
    p+=pOpen+'<hp:run charPrIDRef="'+bd[1]+'"/></hp:p>'+pOpen+'<hp:run charPrIDRef="'+hd[1]+'"><hp:t>'+nx+'.</hp:t></hp:run><hp:run charPrIDRef="'+bd[1]+'"><hp:t> {{'+tokenOf(i)+'}}</hp:t></hp:run></hp:p>';}
  return xml.slice(0,at)+p+xml.slice(at);
}

var FIXED=function(ov,kind){return [
  '본건 집합건물'+(kind?'('+kind+')':'')+'은 등기사항전부증명서 및 집합건축물대장상 구조, 전유면적 및 이용상황 등을 종합적으로 검토한 결과 물적동일성이 인정됨.',
  '본건의 위치확인은 외관 탐문 및 출입구 표시부분으로 확인하였음.',
  '본건의 소재지, 지번, 지목, 면적 및 이용상황등은 귀 제시자료 및 관련 공부자료에 의거하였음.',
  '본건은 '+(ov.purpose||'일반거래(시가참고)')+' 목적의 감정평가로서, 담보나 소송 등 다른 목적으로 사용될 수 없으므로 업무진행 시 참고 바람'];};

function Card(props){
  var R=g.React,h=R.createElement,ov=props.ov||{},S=props.S||{},C=props.C||{};
  var BTN=props.BTN||{s:{background:'#fff',color:'#1e293b',border:'1px solid #cbd5e1'}};   // 여러 호수 화면엔 BTN이 없어 집건 보조 버튼 모양을 그대로
  var items=list(ov),share=oneLine(props.shareText);
  var set=function(arr){props.setOv(function(p){var n=Object.assign({},p);n.etcItems=arr;return n;});};
  var add=function(t){set(list(ov).concat([t||'']));};
  var del=function(i){if(props.pushUndo)props.pushUndo('그 밖의 사항 '+L[4+(share?1:0)+i]+'. 삭제됨');var a=list(ov);a.splice(i,1);set(a);};
  var up=function(i){if(!i)return;var a=list(ov),t=a[i];a[i]=a[i-1];a[i-1]=t;set(a);};
  var edit=function(i,v){var a=list(ov);a[i]=v;set(a);};
  var ps=presets(ov),hn=hint(ov),hasDaeji=items.some(function(t){return /대지권이 미등기/.test(t);});
  var gray={fontSize:12,color:'#64748b',lineHeight:1.6,display:'flex',gap:6};
  var lab={fontWeight:700,color:'#334155',minWidth:20};
  var kids=[h('div',{key:'h',style:S.h2},'의견서 문구 — 6. 그 밖의 사항'),
    h('div',{key:'d',style:{fontSize:11,color:'#888',marginBottom:8}},'여기 적은 문구가 감정평가서(의견서) 「6. 그 밖의 사항」에 항목으로 그대로 들어갑니다. 가.~라.는 양식에 고정된 문구입니다.')];
  FIXED(ov,props.kind).forEach(function(t,i){kids.push(h('div',{key:'f'+i,style:gray},h('span',{style:lab},L[i]+'.'),h('span',null,t)));});
  var n=4;
  if(share){kids.push(h('div',{key:'sh',style:gray},h('span',{style:lab},L[n]+'.'),h('span',null,share,h('span',{style:{color:'#94a3b8',fontSize:11}},' (지분평가 문구 — 위 「그 밖의 사항 문구」 칸에서 고칩니다)'))));n++;}
  items.forEach(function(t,i){
    kids.push(h('div',{key:'i'+i,className:'etc-item',style:{display:'flex',gap:6,alignItems:'flex-start',marginTop:6}},
      h('span',{style:Object.assign({},lab,{paddingTop:6})},(L[n+i]||'?')+'.'),
      h('textarea',{'aria-label':'그 밖의 사항 '+(L[n+i]||'')+' 문구',value:t,placeholder:'의견서에 들어갈 문구를 적으세요 (비워 두면 의견서에 안 들어감)',
        onChange:function(e){edit(i,e.target.value);},
        style:Object.assign({},S.inp,{flex:1,minHeight:58,resize:'vertical',fontSize:12,lineHeight:1.5,fontFamily:'inherit',boxSizing:'border-box'})}),
      h('div',{style:{display:'flex',flexDirection:'column',gap:2}},
        i?h('button',{type:'button',title:'위로',onClick:function(){up(i);},style:Object.assign({},S.btn,BTN.s,{padding:'2px 8px',fontSize:11})},'↑'):null,
        h('button',{type:'button',className:'del','aria-label':'그 밖의 사항 '+(L[n+i]||'')+' 삭제',title:'이 항목 삭제',onClick:function(){del(i);},style:Object.assign({},S.btn,BTN.s,{padding:'2px 8px',fontSize:11,color:C.dng||'#dc2626'})},'✕'))));
  });
  if(hn&&!hasDaeji)kids.push(h('div',{key:'hint',className:'etc-hint',style:{marginTop:8,padding:'6px 10px',background:'#fef3c7',border:'1px solid #fde68a',borderRadius:4,fontSize:12,color:'#92400e'}},'ⓘ '+hn));
  kids.push(h('div',{key:'b',style:{display:'flex',gap:6,flexWrap:'wrap',marginTop:8}},
    [h('button',{key:'blank',type:'button',onClick:function(){add('');},style:Object.assign({},S.btn,BTN.s,{fontSize:12})},'+ 빈 항목')].concat(
      ps.map(function(p){return h('button',{key:p.key,type:'button',title:p.text,onClick:function(){add(p.text);},style:Object.assign({},S.btn,BTN.s,{fontSize:12})},'+ '+p.label);}))));
  return h('div',{style:S.card,className:'etc-card'},kids);
}

g.ArapEtcItems={texts:texts,presets:presets,hint:hint,devZone:devZone,insertXml:insertXml,Card:Card,list:list};
})(typeof window!=='undefined'?window:globalThis);
