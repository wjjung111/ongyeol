/* Supplied statement layout; typed cell mapping follows the condominium exporter. */
(function(){
'use strict';
var $=function(id){return document.getElementById(id);},A=window.ArapCheonggu;
// 요항표 토큰 = 요항표 탭 입력칸. 빈 칸은 채우지 않고 양식 표시를 그대로 남긴다(한글에서 직접 작성).
// 양식에는 {{요항_지세}} 뒤에 '한'이 있으므로 완성형 입력의 끝 '한'은 중복하지 않는다.
function yohangMap(){
  return {'소재지_동':cgVal('y_dong'),'인근위치설명':cgVal('y_near'),'요항_교통':cgVal('y_traffic'),
    '요항_지세':cgVal('y_jise').replace(/한$/,''),'토지_형상':cgVal('y_shape'),'요항_이용상황':cgVal('y_use'),
    '요항_도로1방위':cgVal('y_road1dir'),'요항_도로1노폭':cgVal('y_road1w'),
    '요항_도로2방위':cgVal('y_road2dir'),'요항_도로2노폭':cgVal('y_road2w'),
    '요항_건물구조':cgVal('y_struct'),'요항_외벽':cgVal('y_wall'),'요항_창호':cgVal('y_window'),
    '요항_이용상태':usestateItems().length===1?usestateItems()[0]:cgVal('y_usestate')};
}
// {{토큰}}이 든 <hp:p> 문단을 값의 줄 수만큼 복제한다(줄배치 캐시 제거 → 한글이 다시 배치).
// 집합건물 expandYohangPara와 같은 방식. 값이 비면 아무것도 하지 않고 양식 표시를 남긴다.
function expandPara(xmlText,token,value,recolor){
  if(!value)return xmlText;
  var ti=xmlText.indexOf(token);if(ti<0)return xmlText;
  var ps=xmlText.lastIndexOf('<hp:p ',ti),pe=xmlText.indexOf('</hp:p>',ti);
  var esc=function(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');};
  if(ps<0||pe<0)return xmlText.split(token).join(esc(value));
  pe+=7;
  var tpl=xmlText.slice(ps,pe).replace(/<hp:linesegarray>[\s\S]*?<\/hp:linesegarray>/,'');
  Object.keys(recolor||{}).forEach(function(r){tpl=tpl.split('charPrIDRef="'+r+'"').join('charPrIDRef="'+recolor[r]+'"');});
  var clones=String(value).split('\n').map(function(line){return tpl.split(token).join(esc(line));}).join('');
  return xmlText.slice(0,ps)+clones+xmlText.slice(pe);
}
// 접면도로가 한 면뿐이면(요항표 탭 「한 면만 접함」) 양식 문장
//   "본건 ①으로 노폭 약 Nm, ②으로 노폭 약 Mm 내외의 아스팔트 포장도로와 각각 접하고 있음."
// 에서 ", ②으로 노폭 약 Mm" 런 네 개("m, "·②방위·"으로 노폭 약 "·②노폭)를 빼고 "각각 "을 지워
//   "본건 ①으로 노폭 약 Nm 내외의 아스팔트 포장도로와 접하고 있음." 으로 만든다. 줄배치 캐시는 지워 한글이 다시 배치.
function dropSecondRoad(doc){
  if(cgVal('y_roadCnt')!=='1')return;
  var t=Array.from(doc.getElementsByTagNameNS('*','t')).find(function(n){return n.textContent.indexOf('{{요항_도로2방위}}')>=0;});
  if(!t)return;
  var p=t.parentNode;while(p&&p.localName!=='p')p=p.parentNode;
  if(!p)return;
  dropSecondRoadIn(p);
}
function dropSecondRoadIn(p){
  var runs=Array.from(p.children).filter(function(n){return n.localName==='run';});
  var i=runs.findIndex(function(r){return r.textContent.indexOf('{{요항_도로2방위}}')>=0;});
  var w=runs.findIndex(function(r){return r.textContent.indexOf('{{요항_도로2노폭}}')>=0;});
  if(i<1||w<i)return;
  // ②방위 바로 앞 런("m, ")부터 ②노폭 런까지 제거. 앞 런의 "m"은 뒤 런("m 내외의…")이 이미 갖고 있다.
  runs.slice(i-1,w+1).forEach(function(r){r.remove();});
  runs.slice(w+1).forEach(function(r){Array.from(r.getElementsByTagNameNS('*','t')).forEach(function(n){n.textContent=n.textContent.replace('각각 ','');});});
  Array.from(p.getElementsByTagNameNS('*','linesegarray')).forEach(function(n){n.remove();});
}
// 본건 필지가 둘 이상이면(일단지·묶기 아님, 토지건물.html yohangLands) 「Ⅱ. 토지의 개황」 1. 지세 및 형상 · 2. 이용상황 · 3. 접면도로 상황
// 문단을 기호마다 한 문단씩 복제한다: "(1) 기호1 : 인접토지 및 인접도로 대비 …", "(2) 기호2 : …".
// 앞머리는 문단의 검정 런을 복제해 검정으로, 값은 빨강 런 그대로. 접면도로는 "본건 "을 빼고 기호별 접면도로 수대로(한 면이면 ②·'각각' 뺌).
// 값이 빈 칸은 {{토큰#n}}으로 표시해 두었다가(아래 채움 단계가 기호1 값으로 덮지 않게) 마지막에 양식 표시 {{토큰}}로 돌린다.
var LAND_PARAS=[
  {tok:'{{요항_지세}}',keys:{'요항_지세':'jise','토지_형상':'shape'}},
  {tok:'{{요항_이용상황}}',keys:{'요항_이용상황':'use'}},
  {tok:'{{요항_도로1방위}}',keys:{'요항_도로1방위':'road1dir','요항_도로1노폭':'road1w','요항_도로2방위':'road2dir','요항_도로2노폭':'road2w'},road:true}];
function splitLandParas(doc,red){
  var lands=(typeof yohangLands==='function')?yohangLands():[];
  var runsOf=function(p){return Array.from(p.children).filter(function(n){return n.localName==='run';});};
  var tsOf=function(el){return Array.from(el.getElementsByTagNameNS('*','t'));};
  // 앞머리 런: 문단의 첫 검정 런을 복제해 글자를 바꿔 맨 앞에 넣는다(값 칸의 빨강을 물려받지 않게)
  var prefix=function(p,label){
    var black=runsOf(p).find(function(r){return !red.has(r.getAttribute('charPrIDRef'))&&tsOf(r).length;});
    if(!black)return;
    var pre=black.cloneNode(true);
    tsOf(pre).forEach(function(n,j){n.textContent=j?'':label;});
    p.insertBefore(pre,runsOf(p)[0]);
  };
  var dropBon=function(p){var t0=runsOf(p).length?tsOf(runsOf(p)[0])[0]:null;if(t0)t0.textContent=t0.textContent.replace(/^본건\s*/,'');};
  var paraOf=function(tok){
    var t=tsOf(doc).find(function(n){return n.textContent.indexOf(tok)>=0;});
    var p=t&&t.parentNode;while(p&&p.localName!=='p')p=p.parentNode;
    return p||null;
  };
  // 일단지·묶기 여러 필지(yohangCommonLabel) — 문단은 하나 그대로, 1. 지세 및 형상·2. 이용상황 앞에만 "[기호1,2,3 공히] ".
  // 접면도로는 일단지 전체가 접하는 도로라 기호 없이 종전 "본건 …" 문장 그대로(사용자 2026-09-29). 값 채움·한 면 처리는 뒤 단계가 종전대로.
  var common=(typeof yohangCommonLabel==='function')?yohangCommonLabel():'';
  if(common&&lands.length<2){
    LAND_PARAS.forEach(function(spec){
      if(spec.road)return;
      var p=paraOf(spec.tok);if(!p)return;
      prefix(p,common);
      Array.from(p.getElementsByTagNameNS('*','linesegarray')).forEach(function(n){n.remove();});
    });
    return;
  }
  if(lands.length<2)return;
  LAND_PARAS.forEach(function(spec){
    var p=paraOf(spec.tok);if(!p)return;
    lands.forEach(function(ld,i){
      var c=p.cloneNode(true);
      if(spec.road){
        if(ld.roadCnt==='1')dropSecondRoadIn(c);
        dropBon(c);
      }
      tsOf(c).forEach(function(n){n.textContent=n.textContent.replace(/\{\{([^{}]+)\}\}/g,function(full,k){
        if(!Object.prototype.hasOwnProperty.call(spec.keys,k))return full;
        var v=String(ld[spec.keys[k]]||'').trim();if(k==='요항_지세')v=v.replace(/한$/,'');
        return v||'{{'+k+'#'+(i+1)+'}}';
      });});
      prefix(c,'('+(i+1)+') 기호'+(i+1)+' : ');
      Array.from(c.getElementsByTagNameNS('*','linesegarray')).forEach(function(n){n.remove();});
      p.parentNode.insertBefore(c,p);
    });
    p.remove();
  });
}
// 조사 '로/으로' 맞추기 — 채운 값(빨강 런) 바로 뒤 런이 '로'·'으로'로 시작하면 값 끝 글자 받침대로 바꾼다(답로 → 답으로).
// 판단은 토지건물.html josaRo(한글이 아니거나 {{토큰}}이 남은 칸은 양식 그대로).
function fixJosa(doc,red){
  if(typeof josaRo!=='function')return;
  Array.from(doc.getElementsByTagNameNS('*','p')).forEach(function(p){
    var runs=Array.from(p.children).filter(function(n){return n.localName==='run';}),hit=false;
    runs.forEach(function(r,i){
      var nx=runs[i+1];if(!nx||!red.has(r.getAttribute('charPrIDRef'))||red.has(nx.getAttribute('charPrIDRef')))return;
      var t=Array.from(nx.getElementsByTagNameNS('*','t'))[0];if(!t)return;
      var m=t.textContent.match(/^(으로|로)(?![가-힣])/);if(!m)return;
      var j=josaRo(r.textContent);if(!j||j===m[1])return;
      t.textContent=j+t.textContent.slice(m[1].length);hit=true;
    });
    if(hit)Array.from(p.getElementsByTagNameNS('*','linesegarray')).forEach(function(n){n.remove();});
  });
}
// 이용상태 항목(가·나·다) — 요항표 탭 첫 칸 + 추가 항목(y_usestateMore, JSON 배열). 빈 항목은 뺀다.
function usestateItems(){
  var more=[];try{more=JSON.parse(cgVal('y_usestateMore')||'[]');}catch(e){}
  if(!Array.isArray(more))more=[];
  return [cgVal('y_usestate')].concat(more).map(function(v){return String(v==null?'':v).trim();}).filter(Boolean);
}
// 항목이 둘 이상이면 "공부상 {{요항_이용상태}}로 이용 중임." 한 문단을
//   공부상 / 가) 주택 / 나) 차고로 이용 중임.
// 여러 문단으로 나눈다(같은 문단 서식 복제 — 앞 검정 런은 '공부상'·'가) ', 값 런은 빨강, 끝 문구는 마지막 항목에만).
function splitUsestate(doc){
  var items=usestateItems();if(items.length<2)return;
  var tok='{{요항_이용상태}}';
  var t=Array.from(doc.getElementsByTagNameNS('*','t')).find(function(n){return n.textContent.indexOf(tok)>=0;});
  if(!t)return;
  var p=t.parentNode;while(p&&p.localName!=='p')p=p.parentNode;
  if(!p)return;
  var L='가나다라마바사아자차카타파하';
  var make=function(fill){
    var c=p.cloneNode(true),ts=Array.from(c.getElementsByTagNameNS('*','t')),k=ts.findIndex(function(n){return n.textContent.indexOf(tok)>=0;});
    ts.forEach(function(n,i){n.textContent=fill(n.textContent,i,k);});
    Array.from(c.getElementsByTagNameNS('*','linesegarray')).forEach(function(n){n.remove();});
    p.parentNode.insertBefore(c,p);
  };
  make(function(txt,i,k){return i===0&&i<k?txt.replace(/\s+$/,''):'';});
  items.forEach(function(v,j){
    make(function(txt,i,k){
      if(i<k)return i===0?L[j%L.length]+') ':'';
      if(i===k)return txt.split(tok).join(v);
      return j===items.length-1?txt:'';
    });
  });
  p.remove();
}
// 교통상황 문장 "…진출입이 가능하며, 인근에 {{요항_교통}}…"의 '인근에'를 요항표 탭 드롭다운(인근에/근거리에)대로 바꾼다.
function setTrafficNear(doc){
  var near=cgVal('y_trafficNear');if(!near||near==='인근에')return;
  var t=Array.from(doc.getElementsByTagNameNS('*','t')).find(function(n){return /진출입이 가능하며,\s*인근에/.test(n.textContent);});
  if(!t)return;
  t.textContent=t.textContent.replace(/(진출입이 가능하며,\s*)인근에/,'$1'+near);
  var p=t.parentNode;while(p&&p.localName!=='p')p=p.parentNode;
  if(p)Array.from(p.getElementsByTagNameNS('*','linesegarray')).forEach(function(n){n.remove();});
}
// 원본 양식은 보존하고 입지조건의 고정 문구 두 곳만 출력 시 바꾼다.
// 비어 있으면 원래 문단 유지. 여러 줄은 같은 서식의 문단으로 나눠 한글에서도 줄바꿈을 보존한다.
function fillLocationNarrative(doc){
  var paragraphs=Array.from(doc.documentElement.children).filter(function(p){return p.localName==='p';});
  var start=paragraphs.findIndex(function(p){return p.textContent.indexOf('{{소재지_동}}')>=0;});
  if(start<0)return;
  var inEtc=false;
  paragraphs.slice(start+1).some(function(p){
    var plain=p.textContent.trim();
    if(/^Ⅱ/.test(plain))return true;
    if(/^4\.\s*기타사항/.test(plain))inEtc=true;
    var id=plain==='본건 주위는 아파트단지 및 근린생활시설 등이 혼재하는 지대로서, 제반 입지여건 무난한 편임.'?'y_surroundings':
      inEtc&&plain==='해당사항 없음.'?'y_locationEtc':null;
    var value=id?cgVal(id):'';
    if(!value.trim())return false;
    value.split(/\r?\n/).forEach(function(line){
      var clone=p.cloneNode(true),ts=Array.from(clone.getElementsByTagNameNS('*','t'));
      ts.forEach(function(t,i){t.textContent=i===0?line:'';});
      Array.from(clone.getElementsByTagNameNS('*','linesegarray')).forEach(function(n){n.remove();});
      p.parentNode.insertBefore(clone,p);
    });
    p.remove();return false;
  });
}
// ── 토지만 평가(토지건물.html LAND_ONLY) ──
function landOnly(){return typeof LAND_ONLY!=='undefined'&&!!LAND_ONLY;}
// 요항표: 「Ⅲ. 건물의 개황」 제목부터 끝까지 본문 문단을 뺀다(구역 설정·개체가 든 문단은 남김).
function dropBldSection(doc){
  var ps=Array.from(doc.documentElement.children).filter(function(p){return p.localName==='p';});
  var at=ps.findIndex(function(p){return /^Ⅲ\.\s*건물의 개황/.test(p.textContent.trim());});
  if(at<0)return;
  ps.slice(at).forEach(function(p){
    if(p.getElementsByTagNameNS('*','secPr').length||p.getElementsByTagNameNS('*','ctrl').length||p.getElementsByTagNameNS('*','tbl').length)return;
    p.remove();
  });
}
// 괄호감정표(토건 양식) → 토지만: 평가내역의 건물 줄은 지우지 않고 종별 '건물' 글자만 비운다(값 칸은 gwalMap이 빈칸·'-'),
// 목록표시근거에서 일반건축물대장을 뺀다. base64로 돌려준다(토지만 정답 샘플과 같은 모양).
async function landOnlyGwal(b64){
  var entries=await A.parseZip(Uint8Array.from(atob(b64),function(c){return c.charCodeAt(0);}).buffer),dec=new TextDecoder(),enc=new TextEncoder();
  entries.filter(function(e){return /^Contents\/section\d+\.xml$/.test(e.name);}).forEach(function(e){
    var d=xml(dec.decode(e.data));
    Array.from(d.getElementsByTagNameNS('*','tr')).filter(function(tr){return tr.textContent.indexOf('{{괄_건물_')>=0;}).forEach(function(tr){
      Array.from(tr.getElementsByTagNameNS('*','t')).forEach(function(t){if(t.textContent.trim()==='건물')t.textContent='';});});
    Array.from(d.getElementsByTagNameNS('*','t')).forEach(function(t){
      if(t.textContent.indexOf('일반건축물대장')>=0){t.textContent=t.textContent.replace(/,\s*일반건축물대장\s*,\s*/,', ').replace(/일반건축물대장\s*,\s*/,'');
        var p=t.parentNode;while(p&&p.localName!=='p')p=p.parentNode;if(p)Array.from(p.getElementsByTagNameNS('*','linesegarray')).forEach(function(n){n.remove();});}});
    e.data=enc.encode(ser(d));
  });
  var bytes=A.createZipStored(entries);if(bytes instanceof Promise)bytes=await bytes;
  var u=new Uint8Array(bytes.buffer||bytes),s='';for(var i=0;i<u.length;i++)s+=String.fromCharCode(u[i]);
  return btoa(s);
}
async function buildYohang(){
  var b64=await fetchTplB64('템플릿/토건 요항표 템플릿.hwpx');
  var entries=await A.parseZip(Uint8Array.from(atob(b64),function(c){return c.charCodeAt(0);}).buffer);
  var dec=new TextDecoder(),enc=new TextEncoder(),map=yohangMap();
  var headerXml=dec.decode(entries.find(function(e){return e.name==='Contents/header.xml';}).data),header=xml(headerXml);
  var charPrs=Array.from(header.getElementsByTagNameNS('*','charPr'));
  var red=new Set(charPrs.filter(function(p){return (p.getAttribute('textColor')||'').toUpperCase()==='#FF0000';}).map(function(p){return p.getAttribute('id');}));
  // 채운 자리는 **빨강 그대로** 남긴다 — 앱이 채운 곳을 한눈에 보고 한글에서 다듬으라는 뜻(사용자 요청 2026-09-18).
  // 양식에서 검정으로 들어 있는 자리(토지이용계획)는 색만 다른 빨강 쌍둥이 글자모양으로 바꿔 같이 빨갛게 만든다.
  // (글자모양 목록은 건드리지 않는다 — id 불연속·itemCnt 불일치는 한글 글꼴 깨짐의 원인)
  var norm=function(p){return ser(p).replace(/ id="\d+"/,'').replace(/textColor="[^"]*"/,'');};
  var redOf={};charPrs.forEach(function(p){
    if(red.has(p.getAttribute('id')))return;
    var twin=charPrs.find(function(q){return q!==p&&red.has(q.getAttribute('id'))&&norm(q)===norm(p);});
    if(twin)redOf[p.getAttribute('id')]=twin.getAttribute('id');
  });
  var toice=(typeof assembleToice==='function')?assembleToice():'';
  entries.filter(function(e){return /^Contents\/section\d+\.xml$/.test(e.name);}).forEach(function(e){
    var d=xml(dec.decode(e.data));
    if(landOnly())dropBldSection(d);   // 토지만 — 「Ⅲ. 건물의 개황」 절 없음
    fillLocationNarrative(d);
    splitLandParas(d,red);   // 여러 필지면 토지의 개황 1~3항을 기호별 문단으로(이 뒤 dropSecondRoad는 할 일이 없어진다)
    dropSecondRoad(d);
    setTrafficNear(d);
    splitUsestate(d);
    Array.from(d.getElementsByTagNameNS('*','run')).filter(function(r){return red.has(r.getAttribute('charPrIDRef'));}).forEach(function(r){
      Array.from(r.getElementsByTagNameNS('*','t')).forEach(function(t){
        t.textContent=t.textContent.replace(/\{\{([^{}]+)\}\}/g,function(full,k){
          if(!map[k])return full;                       // 안 채운 칸은 양식 표시 그대로
          return map[k];});                             // 채운 값도 빨강 글자모양 그대로 둔다
      });
    });
    fixJosa(d,red);
    var out=ser(d).replace(/\{\{([^{}#]+)#\d+\}\}/g,'{{$1}}');   // 기호2부터 빈 칸 표시를 양식 표시로
    // 토지이용계획은 여러 줄 → 문단을 줄 수만큼 복제하고, 복제본 글자색은 빨강으로(다른 채움 자리와 같게)
    out=expandPara(out,'{{요항_용도지역}}',toice,redOf);
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
  var loc=function(L){return (typeof landLoc==='function')?landLoc(L):String((L||{})['소재지']||'');};
  var rows=LANDS.map(function(l,i){var g=gs.rows[i];return {'명세_기호':String(i+1),'명세_소재지':loc(l),'명세_지번':l['지번']||'','명세_지목용도':l['지목']||'','명세_지역구조':l['용도지역']||'','명세_공부면적':num(l['면적']),'명세_사정면적':landArea(l),'명세_단가':g.apply,'명세_평가액':g.total,'명세_비고':l['비고']||''};});
  var land=LANDS[0]||{};
  // 건물은 발송 양식대로: 「가」 머리행(소재지 + [도로명주소] / 지번은 필지와 같으면 '상동' / 주용도 / 구조·층수)
  // 아래에 층별 행(용도·층·면적·단가·금액·비고, 3행씩)만 이어 붙인다. 동이 여럿이면 동마다 머리행.
  var floors=(typeof floorsText==='function')?floorsText():'';
  var road=cgVal('bt_roadAddr').trim()||String(land.roadAddr||'').trim();   // 칸이 비면 토지 조회 때 받은 도로명주소
  var groups=[];br.rows.filter(function(r){return r.size>0;}).forEach(function(r){
    var dong=String(r.data['동']||'').trim(),g=groups.find(function(x){return x.dong===dong;});
    if(!g){g={dong:dong,rows:[]};groups.push(g);}g.rows.push(r);});
  var marks='가나다라마바사아자차카타파하';
  groups.forEach(function(g,gi){
    var d0=g.rows[0].data,bLoc=(d0['소재지']||'').trim()||loc(land),bJb=(d0['지번']||'').trim()||land['지번']||'';
    var same=bLoc===loc(land)&&String(bJb)===String(land['지번']||'');
    rows.push({'명세_기호':g.dong||marks.charAt(gi)||String(gi+1),'명세_소재지':bLoc+(road?'\n\n[도로명주소]\n'+road:''),'명세_지번':same?'상동':bJb,
      '명세_지목용도':cgVal('bt_purps').trim()||d0['용도']||'','명세_지역구조':[d0['구조']||cgVal('bt_strct'),floors].filter(Boolean).join('\n'),
      '명세_공부면적':null,'명세_사정면적':null,'명세_단가':null,'명세_평가액':0,'명세_비고':'',header:true});
    // 층별 비고는 원가법 근거 두 줄: 재조달원가 / × 잔존연수/내용연수
    g.rows.forEach(function(r){var d=r.data;
      var note=d['비고']||[won(r.reCost),'× '+r.remaining+'/'+r.life].join('\n');
      rows.push({'명세_기호':'','명세_소재지':undefined,'명세_지번':'','명세_지목용도':d['용도']||'','명세_지역구조':d['층별']||'','명세_공부면적':(r.gongbu||r.size),'명세_사정면적':r.size,'명세_단가':r.apply,'명세_평가액':r.total,'명세_비고':note,minRows:3});});   // 층별 행은 3행씩(값·비고 둘째 줄·빈 줄) — 발송 양식 간격
  });
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
  // 토지만 — 제목 「(토지·건물)감정평가명세표」 → 「(토지)감정평가명세표」(앞 공백은 그대로)
  if(landOnly())entries.filter(function(e){return e.name==='xl/sharedStrings.xml';}).forEach(function(e){
    e.data=enc.encode(dec.decode(e.data).split('(토지·건물)감정평가명세표').join('(토지)감정평가명세표'));});
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
  var wide={C:9,E:9,F:12,K:12},numeric={G:1,H:1,I:1},cols=['B','C','D','E','F','G','H','I','J','K'],r=start,total=0,carry=[];
  // C열(소재지)은 "서울특별시 / 강남구 / 신사동"처럼 낱말마다 한 줄. 빈 줄('\n\n')은 그대로 빈 칸 한 줄.
  var locLines=function(v){return String(v||'').split('\n').flatMap(function(line){return line.trim()?line.trim().split(/\s+/):[''];});};
  var newRow=function(n){var row=d.createElementNS(X,'row');row.setAttribute('r',n);rowAttrs.forEach(function(p){row.setAttribute(p[0],p[1]);});return row;};
  original.filter(function(row){var n=+row.getAttribute('r');return n>=start&&n<base;}).forEach(function(row){row.remove();});
  rows.forEach(function(item){
    var split={};cols.forEach(function(c){var k=keys[c];
      if(!k){split[c]=[];return;}
      if(numeric[c]){split[c]=[item['명세_'+k]];return;}
      if(c==='C'){split.C=item['명세_소재지']===undefined?null:locLines(item['명세_소재지']);return;}   // null = 위 머리행 소재지가 흘러내리는 자리
      // 비고에 적은 재조달원가처럼 숫자만 있는 줄은 숫자로 넣어 양식의 천단위 서식을 그대로 받는다
      split[c]=chunks(item['명세_'+k],wide[c]||8).map(function(line){return c==='K'&&/^[\d,]+$/.test(line)?Number(line.replace(/,/g,'')):line;});
    });
    // 블록 높이: 기본 4행(층별 행은 2행). 머리행 소재지가 그보다 길면 남는 줄은 아래 층별 행 옆으로 흘려보낸다(발송 양식과 같게).
    var height=Math.max(item.minRows||4,...cols.filter(function(c){return c!=='C';}).map(function(c){return split[c].length;}));
    if(split.C){carry=split.C.slice(height);split.C=split.C.slice(0,height);}
    else split.C=carry.splice(0,height);
    var hasUnit=item['명세_단가']!=null&&item['명세_단가']!=='';
    for(var j=0;j<height;j++){var row=newRow(r);
      (function(rr,first){cols.forEach(function(c){
        row.append(c==='J'?cell(d,'J'+rr,style.J,null,(first&&hasUnit)?'+I'+rr+'*H'+rr:null):cell(d,c+rr,style[c],split[c][j]));
      });})(r,j===0);
      sd.insertBefore(row,footer);r++;}
    total+=item['명세_평가액']||0;
  });
  // 층별 행이 모자라 못 흘려보낸 소재지 줄은 빈 행에 이어 쓴다
  while(carry.length){var row=newRow(r),line=carry.shift();cols.forEach(function(c){row.append(cell(d,c+r,style[c],c==='C'?line:null));});sd.insertBefore(row,footer);r++;}
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
$('btnMyeongse').onclick=function(){return run(this,async function(){var bytes=await buildStatement(statementRows());A.triggerDownload(bytes,'4. 명세표_'+(cgVal('ov_client')||'의뢰인')+'.xlsx');});};
function downloadYohang(btn,statusId){return run(btn,async function(){var bytes=await buildYohang();A.triggerDownload(bytes,'5. 요항표_'+(cgVal('ov_client')||'의뢰인')+'.hwpx');},statusId);}
$('btnYohang').onclick=function(){return downloadYohang(this);};
if($('btnYohang2'))$('btnYohang2').onclick=function(){return downloadYohang(this,'y_status');};
window.ArapTojiDocuments={statementRows:statementRows,buildStatement:buildStatement,yohangMap:yohangMap,buildYohang:buildYohang,landOnlyGwal:landOnlyGwal};
})();
