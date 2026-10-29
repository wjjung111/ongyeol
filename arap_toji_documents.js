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
// ── 요항표 맹지·직접 입력·문장형 이용상황(2026-10-21) ── 토지건물.html 요항표 탭 접면도로 드롭다운 '0' 맹지 / 'free' 직접 입력
function ownRoadText(cnt,free){free=String(free==null?'':free).trim();return cnt==='0'?(free||'맹지임.'):cnt==='free'?free:'';}
function useSentence(v){v=String(v==null?'':v).trim();return /(임|음|함)\.?$|\.$/.test(v);}
// 문단 글자를 한 문장으로 — 값 자리(빨강 런)에 넣고 나머지 글자는 비운다(문단·글자 모양은 양식 그대로)
function oneSentence(p,text,red){
  var runs=Array.from(p.children).filter(function(n){return n.localName==='run';});
  var host=runs.find(function(r){return red.has(r.getAttribute('charPrIDRef'))&&r.getElementsByTagNameNS('*','t').length;})||runs.find(function(r){return r.getElementsByTagNameNS('*','t').length;});
  Array.from(p.getElementsByTagNameNS('*','t')).forEach(function(t){t.textContent='';});
  if(host)host.getElementsByTagNameNS('*','t')[0].textContent=text;
  Array.from(p.getElementsByTagNameNS('*','linesegarray')).forEach(function(n){n.remove();});
}
// 토큰 자리에 값을 넣고 그 뒤 글자(「로 이용중임.」)는 비운다 — 끝에 마침표가 없으면 붙인다
function trimAfter(p,tok,value){
  var ts=Array.from(p.getElementsByTagNameNS('*','t')),k=ts.findIndex(function(t){return t.textContent.indexOf(tok)>=0;});if(k<0)return;
  if(!/\.$/.test(value))value+='.';
  ts[k].textContent=ts[k].textContent.slice(0,ts[k].textContent.indexOf(tok))+value;
  ts.slice(k+1).forEach(function(t){t.textContent='';});
  Array.from(p.getElementsByTagNameNS('*','linesegarray')).forEach(function(n){n.remove();});
}
// 필지가 하나이거나 일단지(기호별로 안 나눔)일 때 — 기호1 칸 값으로 같은 처리
function singleLandSentences(doc,red){
  var paraOf=function(tok){var t=Array.from(doc.getElementsByTagNameNS('*','t')).find(function(n){return n.textContent.indexOf(tok)>=0;});var p=t&&t.parentNode;while(p&&p.localName!=='p')p=p.parentNode;return p||null;};
  var rt=ownRoadText(cgVal('y_roadCnt'),cgVal('y_roadFree')),pr=rt&&paraOf('{{요항_도로1방위}}');
  if(pr)oneSentence(pr,/^본건/.test(rt)?rt:'본건은 '+rt,red);
  var use=cgVal('y_use'),pu=useSentence(use)&&paraOf('{{요항_이용상황}}');
  if(pu)trimAfter(pu,'{{요항_이용상황}}',use.trim());
}
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
        // 맹지·직접 입력 — 정형 문장 대신 그 한 문장(「(2) 기호2 : 맹지임.」)
        var rt=ownRoadText(ld.roadCnt,ld.roadFree);
        if(rt){oneSentence(c,rt,red);prefix(c,'('+(i+1)+') 기호'+(i+1)+' : ');
          Array.from(c.getElementsByTagNameNS('*','linesegarray')).forEach(function(n){n.remove();});p.parentNode.insertBefore(c,p);return;}
        if(ld.roadCnt==='1')dropSecondRoadIn(c);
        dropBon(c);
      }
      // 이용상황을 문장으로 썼으면(「도로임.」) 뒤 「로 이용중임.」을 뺀다
      if(spec.keys['요항_이용상황']&&useSentence(ld.use))trimAfter(c,'{{요항_이용상황}}',String(ld.use).trim());
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
// ── 건물만 평가(토지건물.html BLD_ONLY) ──
function bldOnly(){return typeof BLD_ONLY!=='undefined'&&!!BLD_ONLY;}
// 요항표: 「Ⅱ. 토지의 개황」 제목부터 「Ⅲ. 건물의 개황」 앞까지 본문 문단을 빼고 Ⅲ → Ⅱ로 번호를 당긴다.
function dropLandSection(doc){
  var ps=Array.from(doc.documentElement.children).filter(function(p){return p.localName==='p';});
  var at=ps.findIndex(function(p){return /^Ⅱ\.\s*토지의 개황/.test(p.textContent.trim());});
  var to=ps.findIndex(function(p){return /^Ⅲ\.\s*건물의 개황/.test(p.textContent.trim());});
  if(at<0||to<at)return;
  ps.slice(at,to).forEach(function(p){
    if(p.getElementsByTagNameNS('*','secPr').length||p.getElementsByTagNameNS('*','ctrl').length||p.getElementsByTagNameNS('*','tbl').length)return;
    p.remove();
  });
  Array.from(ps[to].getElementsByTagNameNS('*','t')).some(function(t){
    if(t.textContent.indexOf('Ⅲ.')<0)return false;t.textContent=t.textContent.replace('Ⅲ.','Ⅱ.');return true;});
}
// 괄호감정표(토건 양식) → 건물만: 평가내역 첫 줄(토지 자리)에 건물 값을 넣고, 둘째 줄(건물 자리)은 지우지 않고 비운다
// (빈 줄이 위에 오지 않게 — 토지만은 건물 줄이 아래라 그대로 비웠다). 비운 줄 값은 {{괄_빈_*}} → gwalMap이 빈칸·'-'.
// 목록표시근거에서 토지대장을 뺀다. base64로 돌려준다.
async function bldOnlyGwal(b64){
  var entries=await A.parseZip(Uint8Array.from(atob(b64),function(c){return c.charCodeAt(0);}).buffer),dec=new TextDecoder(),enc=new TextEncoder();
  var lines=function(el){var p=el;while(p&&p.localName!=='p')p=p.parentNode;if(p)Array.from(p.getElementsByTagNameNS('*','linesegarray')).forEach(function(n){n.remove();});};
  entries.filter(function(e){return /^Contents\/section\d+\.xml$/.test(e.name);}).forEach(function(e){
    var d=xml(dec.decode(e.data));
    var trs=Array.from(d.getElementsByTagNameNS('*','tr'));
    var bRow=trs.find(function(tr){return tr.textContent.indexOf('{{괄_건물_')>=0;}),lRow=trs.find(function(tr){return tr.textContent.indexOf('{{괄_토지_')>=0;});
    if(bRow)Array.from(bRow.getElementsByTagNameNS('*','t')).forEach(function(t){
      if(t.textContent.trim()==='건물')t.textContent='';else if(t.textContent.indexOf('{{괄_건물_')>=0){t.textContent=t.textContent.split('{{괄_건물_').join('{{괄_빈_');lines(t);}});
    if(lRow)Array.from(lRow.getElementsByTagNameNS('*','t')).forEach(function(t){
      if(t.textContent.trim()==='토지')t.textContent='건물';else if(t.textContent.indexOf('{{괄_토지_')>=0){t.textContent=t.textContent.split('{{괄_토지_').join('{{괄_건물_');lines(t);}});
    Array.from(d.getElementsByTagNameNS('*','t')).forEach(function(t){
      if(/토지대장\s*,/.test(t.textContent)){t.textContent=t.textContent.replace(/\s*토지대장\s*,/,'');lines(t);}});
    e.data=enc.encode(ser(d));
  });
  var bytes=A.createZipStored(entries);if(bytes instanceof Promise)bytes=await bytes;
  var u=new Uint8Array(bytes.buffer||bytes),s='';for(var i=0;i<u.length;i++)s+=String.fromCharCode(u[i]);
  return btoa(s);
}
// 괄호감정표 — 토지에 감정평가 외 면적(토지건물.html isOut)이 있으면 평가내역 토지 줄 바로 아래에 같은 서식의 줄을 하나 끼운다
// (사용자 샘플: 사정 「토지 1,818 / 655」, 금액 「400,314,000 / 감정평가 외」). 끼운 줄은 종별·공부면적을 비우고 값은 {{괄_토지외_*}}.
// 양식 파일은 그대로, 출력할 때만 줄을 복제한다. base64로 돌려준다.
async function gwalOutRow(b64){
  var entries=await A.parseZip(Uint8Array.from(atob(b64),function(c){return c.charCodeAt(0);}).buffer),dec=new TextDecoder(),enc=new TextEncoder();
  var kids=function(el,n){return Array.from(el.children).filter(function(x){return x.localName===n;});};
  entries.filter(function(e){return /^Contents\/section\d+\.xml$/.test(e.name);}).forEach(function(e){
    var d=xml(dec.decode(e.data));
    var tr=Array.from(d.getElementsByTagNameNS('*','tr')).find(function(t){return t.textContent.indexOf('{{괄_토지_')>=0;});
    if(!tr)return;
    var tbl=tr.parentNode,c=tr.cloneNode(true),h=0;
    Array.from(c.getElementsByTagNameNS('*','t')).forEach(function(t){
      if(t.textContent.trim()==='토지')t.textContent='';
      else if(t.textContent.indexOf('{{괄_토지_')>=0)t.textContent=t.textContent.split('{{괄_토지_').join('{{괄_토지외_');});
    Array.from(c.getElementsByTagNameNS('*','linesegarray')).forEach(function(n){n.remove();});
    kids(c,'tc').forEach(function(tc){var sz=kids(tc,'cellSz')[0],sp=kids(tc,'cellSpan')[0];
      var rs=sp?Number(sp.getAttribute('rowSpan'))||1:1;if(sz)h=Math.max(h,Number(sz.getAttribute('height'))/rs);});
    tbl.insertBefore(c,tr.nextSibling);
    kids(tbl,'tr').forEach(function(r,i){kids(r,'tc').forEach(function(tc){var ad=kids(tc,'cellAddr')[0];if(ad)ad.setAttribute('rowAddr',String(i));});});
    tbl.setAttribute('rowCnt',String(kids(tbl,'tr').length));
    var sz=kids(tbl,'sz')[0];if(sz&&h)sz.setAttribute('height',String(Math.round(Number(sz.getAttribute('height'))+h)));
    var p=tbl.parentNode;while(p&&p.localName!=='p')p=p.parentNode;
    if(p)Array.from(p.getElementsByTagNameNS('*','linesegarray')).forEach(function(n){if(!tbl.contains(n))n.remove();});
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
    if(bldOnly())dropLandSection(d);   // 건물만 — 「Ⅱ. 토지의 개황」 절 없음, 건물의 개황이 Ⅱ
    fillLocationNarrative(d);
    splitLandParas(d,red);   // 여러 필지면 토지의 개황 1~3항을 기호별 문단으로(이 뒤 dropSecondRoad는 할 일이 없어진다)
    singleLandSentences(d,red);   // 남은(1필지·일단지) 문단 — 맹지·직접 입력·문장형 이용상황
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
// 건물등기 표제부 「건물내역」(bt_regText) → {struct:[구조 줄…], use:'용도', floors:[{label:'1층',area:'148.26'},…]}
// 층 줄 = 「층표시 면적㎡」(등기 순서 그대로). 층 줄 앞부분은 구조·지붕·층수 줄까지가 구조, 그 뒤가 용도.
function parseRegBld(text){
  text=String(text||'').replace(/\r/g,'').replace(/m²|m2/g,'㎡');
  var re=/(지하\s*\d+\s*층|지\s*\d+\s*층?|옥탑\s*\d*\s*층?|\d+\s*층|지하층|지층)\s*[:：]?\s*([\d,]+(?:\.\d+)?)\s*㎡/g,m,floors=[],first=-1;
  while((m=re.exec(text))){if(first<0)first=m.index;floors.push({label:m[1].replace(/\s+/g,''),area:m[2].replace(/,/g,'')});}
  var head=(first<0?text:text.slice(0,first)).split('\n').map(function(l){return l.trim();}).filter(Boolean),struct=[],use='';
  if(head.length===1){var h=head[0].match(/^(.*?\d+\s*층)\s+(.+)$/);if(h){struct=[h[1]];use=h[2];}else struct=head;}
  else if(head.length){var k=-1;head.forEach(function(l,i){if(/\d+\s*층$|지붕$|구조$|조$/.test(l))k=i;});if(k<0)k=0;
    struct=head.slice(0,k+1);use=head.slice(k+1).join(' ');}
  return {struct:struct,use:use.trim(),floors:floors};
}
// 층 표시 → 비교 키(지1층·지하1층·지1 → B1, 1층·1 → F1, 옥탑1·옥탑1층 → R1)
function floorKey(t){t=String(t||'').replace(/\s/g,'');var n=(t.match(/\d+/)||[''])[0];
  if(/옥탑|^옥|^PH/i.test(t))return 'R'+(n||'1');if(/지하|^지|^B/i.test(t))return 'B'+(n||'1');return n?'F'+n:t;}
function bldFloorKey(d){var gb=String(d['층구분']||''),nm=String(d['층별']||'');
  return floorKey((/지하/.test(gb)&&!/지|B/i.test(nm)?'지하':'')+(/옥탑/.test(gb)&&!/옥|PH/i.test(nm)?'옥탑':'')+nm);}
// 명세표 칸에 쓰는 용도지역 — 쉼표마다 줄, 「제3종일반주거지역」은 「제3종 / 일반주거지역」(사용자 샘플 2026-10-29, 칸이 좁아 잘림 방지)
function useLines(v){return String(v||'').split(/\s*[,，]\s*/).filter(Boolean).map(function(x){return x.replace(/^(제\d종)\s*/,'$1\n');}).join('\n');}
// 묶음 필지 줄(용도지역별로 나눈 일단지) — k번째 줄 = k번째 묶음 필지 + k번째 구역
function zoneStatementRows(gs,loc){
  var ps=grpIdx().map(function(i){return LANDS[i];}),zs=GZONES,n=Math.max(ps.length,zs.length),out=[];
  var brOf=function(k,len){return len<2||k>=len?null:k===0?'top':k===len-1?'end':'mid';};
  for(var k=0;k<n;k++){var L=ps[k],z=k<zs.length,g=z?(gs.rows.find(function(r){return r.key==='z'+k;})||{}):{};
    var pn=String(L&&L['비고']||'').trim();if(pn==='-')pn='';
    var note=z?[ILDANJI?'일단지':'',useLines(zoneName(k))].filter(Boolean).join('\n'):'';
    if(pn)note=note?note+'\n'+pn:pn;
    // 사정면적 = 구역 평가면적(지분이면 구역 면적 × 지분)
    var o={'명세_사정면적':z?zoneEvalArea(k):null,'명세_단가':z?g.apply:null,'명세_평가액':z?g.total:0,'명세_비고':note,
      gbr:brOf(k,ps.length),hbr:brOf(k,zs.length)};
    if(L)Object.assign(o,{'명세_기호':String(landParcelNo(LANDS.indexOf(L))),'명세_소재지':loc(L),'명세_지번':L['지번']||'','명세_지목용도':L['지목']||'','명세_지역구조':useLines(L['용도지역']),'명세_공부면적':num(L['면적'])});
    else Object.assign(o,{'명세_기호':'','명세_소재지':undefined,'명세_지번':'','명세_지목용도':'','명세_지역구조':'','명세_공부면적':null,minRows:2});
    out.push(o);}
  return out;
}
function statementRows(){
  calcGongsi();renderBldCalc();calcFinal();
  var gs=window.GONGSI_RESULT||{},br=window.BLD_RESULT||{rows:[]};
  if(bldOnly()){if(!br.rows.some(function(r){return r.size>0;}))throw Error('건물평가 탭에서 건물 층별 목록(건축물대장)을 먼저 입력해 주세요.');}
  else if(!gs.rows||!gs.total)throw Error('본건 토지와 공시지가기준법 계산을 먼저 입력해 주세요.');
  if(bldRows().some(function(r){return num(r['연면적'])>0;})&&br.rows.some(function(r){return r.size>0&&!r.reCost;}))throw Error('건물평가 탭에서 모든 층의 재조달원가를 입력해 주세요.');
  var loc=function(L){return (typeof landLoc==='function')?landLoc(L):String((L||{})['소재지']||'');};
  // 건물만 — 토지 행 없이 건물 행만(지번은 '상동' 대신 실제 지번)
  // 구분평가·평가외로 나눈 필지(토지건물.html isSub/isOut): 원 필지 줄 아래 나눈 줄을 같은 기호로 잇는다 — 기호·소재지~공부 칸은 비우고
  // (소재지는 원 필지 줄에서 흘러내림) 사정면적·단가·금액·비고만. 사정면적은 괄호선 ┌ │ └로 묶는다(br). 평가외는 단가 '-', 금액 「감정평가 외」.
  var sub=function(l){return typeof isSub==='function'&&isSub(l);},out=function(l){return typeof isOut==='function'&&isOut(l);};
  // 일단지를 용도지역별로 나눴으면(토지건물.html zoneMode) 필지 줄과 구역 줄을 나란히 — k번째 줄 = k번째 필지(기호~공부면적) +
  // k번째 구역(사정면적·단가·금액·비고 「일단지 / 일반상업지역」). 공부면적·사정면적은 각각 꺾쇠(<, │, >)로 묶는다(사용자 샘플 2026-10-29)
  var zm=!bldOnly()&&typeof zoneMode==='function'&&zoneMode();
  // 묶음 밖 필지는 일반 필지 줄 그대로(묶기 중 일부 필지만 일단지인 건 — 2026-10-29), 묶음 줄은 첫 묶음 필지 자리에
  var zput=false;
  var rows=bldOnly()?[]:[].concat.apply([],LANDS.map(function(l,i){
    if(zm&&grpIn(l)){if(zput)return [];zput=true;return zoneStatementRows(gs,loc);}
    var g=gs.rows.find(function(r){return r.key===i;})||gs.rows[i]||{},hasSub=!sub(l)&&sub(LANDS[i+1]);
    var br=hasSub?'top':sub(l)?(sub(LANDS[i+1])?'mid':'end'):null;
    var note=String(l['비고']||'');if(out(l)&&note.trim()==='-')note='';
    var common={'명세_사정면적':landArea(l),'명세_단가':out(l)?'-':g.apply,'명세_평가액':out(l)?0:g.total,'명세_비고':note,br:br,out:out(l)};
    if(sub(l))return Object.assign(common,{'명세_기호':'','명세_소재지':undefined,'명세_지번':'','명세_지목용도':'','명세_지역구조':'','명세_공부면적':null,minRows:2,drain:br==='end'});
    return Object.assign(common,{'명세_기호':String(typeof landParcelNo==='function'?landParcelNo(i):i+1),'명세_소재지':loc(l),'명세_지번':l['지번']||'','명세_지목용도':l['지목']||'','명세_지역구조':useLines(l['용도지역']),'명세_공부면적':num(l['면적']),minRows:hasSub?2:undefined});}));
  var land=LANDS[0]||{};
  // 건물은 발송 양식대로: 「가」 머리행(소재지 + [도로명주소] / 지번은 필지와 같으면 '상동' / 주용도 / 구조·층수)
  // 아래에 층별 행(용도·층·면적·단가·금액·비고, 3행씩)만 이어 붙인다. 동이 여럿이면 동마다 머리행.
  var floors=(typeof floorsText==='function')?floorsText():'';
  var road=cgVal('bt_roadAddr').trim()||String(land.roadAddr||'').trim();   // 칸이 비면 토지 조회 때 받은 도로명주소
  var groups=[];br.rows.filter(function(r){return r.size>0;}).forEach(function(r){
    var dong=String(r.data['동']||'').trim(),g=groups.find(function(x){return x.dong===dong;});
    if(!g){g={dong:dong,rows:[]};groups.push(g);}g.rows.push(r);});
  var marks='가나다라마바사아자차카타파하';
  // 건물등기 건물내역을 붙여넣었으면(동 하나일 때) 머리행 구조·용도와 층별 행을 등기대로 — 층 표시·순서·공부면적은 등기, 사정면적·단가·금액은 같은 층의 건물평가 값
  var reg=parseRegBld(cgVal('bt_regText'));
  if(reg.floors.length&&groups.length>1)throw Error('건물등기 건물내역은 동이 하나일 때만 명세표에 씁니다. 동이 여럿이면 건물등기 칸을 비워 주세요.');
  var useReg=reg.floors.length&&groups.length===1;
  if(useReg){var used={};
    reg.floors.forEach(function(f){f.rows=groups[0].rows.filter(function(r){return bldFloorKey(r.data)===floorKey(f.label);});
      if(!f.rows.length)throw Error('건물등기의 「'+f.label+'」 층이 건물평가 층별 목록에 없습니다. 층 표시를 확인해 주세요.');
      f.rows.forEach(function(r){used[groups[0].rows.indexOf(r)]=1;});});
    var miss=groups[0].rows.filter(function(r,i){return !used[i];});
    if(miss.length)throw Error('건물평가 층별 목록의 「'+miss.map(function(r){return r.data['층별']||'?';}).join(', ')+'」 층이 건물등기 건물내역에 없습니다.');}
  groups.forEach(function(g,gi){
    var d0=g.rows[0].data,bLoc=(d0['소재지']||'').trim()||loc(land),bJb=(d0['지번']||'').trim()||land['지번']||'';
    var same=!bldOnly()&&bLoc===loc(land)&&String(bJb)===String(land['지번']||'');
    rows.push({'명세_기호':g.dong||marks.charAt(gi)||String(gi+1),'명세_소재지':bLoc+(road?'\n\n[도로명주소]\n'+road:''),'명세_지번':same?'상동':bJb,
      '명세_지목용도':cgVal('bt_purps').trim()||d0['용도']||'','명세_지역구조':[d0['구조']||cgVal('bt_strct'),floors].filter(Boolean).join('\n'),
      '명세_공부면적':null,'명세_사정면적':null,'명세_단가':null,'명세_평가액':0,'명세_비고':'',header:true});
    // 층별 비고는 원가법 근거 두 줄: 재조달원가 / × 잔존연수/내용연수
    var noteOf=function(r){return r.data['비고']||[won(r.reCost),'× '+r.remaining+'/'+r.life].join('\n');};
    if(useReg){var hd=rows[rows.length-1];
      if(reg.struct.length)hd['명세_지역구조']=reg.struct.map(function(l){return l.replace(/\s+(?=\d+\s*층$)/,'\n');}).join('\n');   // 층수는 따로 한 줄(등기처럼 지붕 / 4층)
      if(reg.use)hd['명세_지목용도']=reg.use;
      // 같은 층이 대장에서 여러 줄(용도별)이어도 단가가 같으면 등기처럼 한 줄로 합친다. 단가가 다르면 층 표시를 달고 줄마다.
      reg.floors.forEach(function(f){var rs=f.rows,one=rs.every(function(r){return r.apply===rs[0].apply&&noteOf(r)===noteOf(rs[0]);});
        if(one)rows.push({'명세_기호':'','명세_소재지':undefined,'명세_지번':'','명세_지목용도':'','명세_지역구조':f.label,'명세_공부면적':num(f.area),
          '명세_사정면적':Math.round(rs.reduce(function(a,r){return a+r.size;},0)*1e4)/1e4,'명세_단가':rs[0].apply,'명세_평가액':rs.reduce(function(a,r){return a+r.total;},0),'명세_비고':noteOf(rs[0]),minRows:3});
        else rs.forEach(function(r){rows.push({'명세_기호':'','명세_소재지':undefined,'명세_지번':'','명세_지목용도':'','명세_지역구조':f.label,'명세_공부면적':(r.gongbu||r.size),
          '명세_사정면적':r.size,'명세_단가':r.apply,'명세_평가액':r.total,'명세_비고':noteOf(r),minRows:3});});});
      return;}
    g.rows.forEach(function(r){var d=r.data;
      var note=noteOf(r);
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
// 나눈 필지(구분평가·평가외)의 사정면적 괄호선 서식 — 사정면적 칸 서식(baseId)을 복제해 숫자 서식만 바꾼다:
//   top = "┌"를 칸 왼쪽 끝에 붙인 숫자, mid = "│", end = "└", line = 칸 왼쪽의 "│" 글자(값 줄 사이 빈 줄)
// 숫자는 그대로 숫자라 금액 수식(단가×사정)이 깨지지 않는다. 출력 파일의 서식 목록 끝에만 덧붙이고 기존 서식 번호는 건드리지 않는다.
// 용도지역별로 나눈 일단지(gbase 있음)는 공부면적 칸에도 꺾쇠: gtop = 숫자 뒤 "<", gmid = "│", gend = ">", gline = 칸 오른쪽 "│"
// 사정면적 칸은 htop = 칸 왼쪽 "<", hmid = "│", hend = ">" (사용자 샘플 2026-10-29 광희동2가 247-1·247-3: 45.2< <60.1 / 56.1> >41.2)
function addBracketStyles(entries,baseId,dec,enc,gBaseId){
  var e=entries.find(function(x){return x.name==='xl/styles.xml';});if(!e)return null;
  var d=xml(dec.decode(e.data)),ss=d.documentElement;
  var fmts=nodes(d,'numFmts')[0];
  if(!fmts){fmts=d.createElementNS(X,'numFmts');ss.insertBefore(fmts,ss.firstElementChild);}
  var used=nodes(fmts,'numFmt').map(function(n){return +n.getAttribute('numFmtId');}),next=Math.max(184,...used)+1;
  var xfs=nodes(d,'cellXfs')[0],list=Array.from(xfs.children).filter(function(n){return n.localName==='xf';});
  var base=list[+baseId]||list[0],out={};
  var codeOf=function(b){var f=nodes(fmts,'numFmt').find(function(n){return n.getAttribute('numFmtId')===b.getAttribute('numFmtId');});return f?f.getAttribute('formatCode'):'#,##0.00##';};
  var numCode=codeOf(base);
  var add=function(key,fmtId,left,from){
    var x=(from||base).cloneNode(true);x.setAttribute('numFmtId',String(fmtId));x.setAttribute('applyNumberFormat','1');
    if(left){var al=Array.from(x.children).find(function(n){return n.localName==='alignment';});
      if(!al){al=d.createElementNS(X,'alignment');x.appendChild(al);}al.setAttribute('horizontal',left);x.setAttribute('applyAlignment','1');}
    xfs.appendChild(x);out[key]=String(Array.from(xfs.children).filter(function(n){return n.localName==='xf';}).length-1);
  };
  [['top','┌'],['mid','│'],['end','└']].forEach(function(p){
    var f=d.createElementNS(X,'numFmt');f.setAttribute('numFmtId',String(next));f.setAttribute('formatCode','"'+p[1]+'"* '+numCode);fmts.appendChild(f);
    add(p[0],next,false);next++;});
  add('line',49,'left');
  if(gBaseId!=null){
    var gb=list[+gBaseId]||base,gCode=codeOf(gb);
    [['htop','<'],['hmid','│'],['hend','>']].forEach(function(p){
      var f=d.createElementNS(X,'numFmt');f.setAttribute('numFmtId',String(next));f.setAttribute('formatCode','"'+p[1]+'"* '+numCode);fmts.appendChild(f);
      add(p[0],next,false);next++;});
    [['gtop','<'],['gmid','│'],['gend','>']].forEach(function(p){
      var f=d.createElementNS(X,'numFmt');f.setAttribute('numFmtId',String(next));f.setAttribute('formatCode',gCode+'"'+p[1]+'"');fmts.appendChild(f);
      add(p[0],next,false,gb);next++;});
    add('gline',49,'right',gb);
  }
  fmts.setAttribute('count',String(nodes(fmts,'numFmt').length));
  xfs.setAttribute('count',String(Array.from(xfs.children).filter(function(n){return n.localName==='xf';}).length));
  e.data=enc.encode(ser(d));
  return out;
}
async function buildStatement(rows){
  var raw=await fetchTplB64('템플릿/토건 명세표 템플릿.xlsx'),entries=await A.parseZip(Uint8Array.from(atob(raw),function(c){return c.charCodeAt(0);}).buffer),dec=new TextDecoder(),enc=new TextEncoder();
  // 토지만 — 제목 「(토지·건물)감정평가명세표」 → 「(토지)감정평가명세표」(앞 공백은 그대로)
  if(landOnly())entries.filter(function(e){return e.name==='xl/sharedStrings.xml';}).forEach(function(e){
    e.data=enc.encode(dec.decode(e.data).split('(토지·건물)감정평가명세표').join('(토지)감정평가명세표'));});
  if(bldOnly())entries.filter(function(e){return e.name==='xl/sharedStrings.xml';}).forEach(function(e){
    e.data=enc.encode(dec.decode(e.data).split('(토지·건물)감정평가명세표').join('(건물)감정평가명세표'));});
  var entry=entries.find(function(e){return /^xl\/worksheets\/sheet\d+\.xml$/.test(e.name);}),d=xml(dec.decode(entry.data)),sd=nodes(d,'sheetData')[0],original=nodes(sd,'row');
  // 양식에서 첫 데이터행(플레이스홀더가 있는 행)과 합계행(SUM 수식이 있는 행)을 찾아 쓴다 — 행 번호를 코드에 고정하지 않는다.
  var sample=original.find(function(row){return nodes(row,'t').some(function(t){return /\{\{명세_/.test(t.textContent);});});
  var footer=original.find(function(row){return nodes(row,'f').some(function(f){return /^SUM\(/.test(f.textContent);});});
  if(!sample||!footer)throw Error('명세표 양식에서 플레이스홀더 행 또는 합계행을 찾지 못했습니다.');
  var style={};nodes(sample,'c').forEach(function(c){style[c.getAttribute('r').replace(/\d/g,'')]=c.getAttribute('s');});
  // 구분평가·평가외로 나눈 필지가 있을 때만 — 사정면적 괄호선 서식을 출력 파일의 서식 목록 끝에 덧붙인다(양식 파일·기존 서식은 그대로).
  var zoned=rows.some(function(x){return x.gbr||x.hbr;});
  var brStyle=(zoned||rows.some(function(x){return x.br;}))?addBracketStyles(entries,style.H,dec,enc,zoned?style.G:null):null;
  var start=+sample.getAttribute('r'),base=+footer.getAttribute('r');
  var rowAttrs=['ht','customHeight','spans','x14ac:dyDescent'].map(function(a){return [a,sample.getAttribute(a)];}).filter(function(p){return p[1]!=null;});
  // B~K 열 순서. J(금액)는 값이 아니라 단가×사정면적 수식으로 넣는다(양식과 동일).
  var keys={B:'기호',C:'소재지',D:'지번',E:'지목용도',F:'지역구조',G:'공부면적',H:'사정면적',I:'단가',K:'비고'};
  var wide={C:9,E:9,F:12,K:12},numeric={G:1,H:1,I:1},cols=['B','C','D','E','F','G','H','I','J','K'],r=start,total=0,carry=[];
  // C열(소재지)은 "서울특별시 / 강남구 / 신사동"처럼 낱말마다 한 줄. 빈 줄('\n\n')은 그대로 빈 칸 한 줄.
  var locLines=function(v){return String(v||'').split('\n').flatMap(function(line){return line.trim()?line.trim().split(/\s+/):[''];});};
  var newRow=function(n){var row=d.createElementNS(X,'row');row.setAttribute('r',n);rowAttrs.forEach(function(p){row.setAttribute(p[0],p[1]);});return row;};
  original.filter(function(row){var n=+row.getAttribute('r');return n>=start&&n<base;}).forEach(function(row){row.remove();});
  rows.forEach(function(item,ii){
    // 토지 필지 행(둘째 필지부터)은 위에 빈 줄 한 줄 — 필지 사이 간격(사용자 요청 2026-09-29)
    if(ii>0&&!item.header&&item['명세_기호']&&!carry.length){var gap=newRow(r);cols.forEach(function(c){
        // 용도지역별 일단지 — 꺾쇠가 이어지는 칸은 빈 줄에도 세로선
        if(brStyle&&c==='G'&&item.gbr&&item.gbr!=='top'){gap.append(cell(d,'G'+r,brStyle.gline,'│'));return;}
        if(brStyle&&c==='H'&&item.hbr&&item.hbr!=='top'){gap.append(cell(d,'H'+r,brStyle.line,'│'));return;}
        gap.append(cell(d,c+r,style[c],null));});sd.insertBefore(gap,footer);r++;}
    var split={};cols.forEach(function(c){var k=keys[c];
      if(!k){split[c]=[];return;}
      if(numeric[c]){split[c]=[item['명세_'+k]];return;}
      if(c==='C'){split.C=item['명세_소재지']===undefined?null:locLines(item['명세_소재지']);return;}   // null = 위 머리행 소재지가 흘러내리는 자리
      // 비고에 적은 재조달원가처럼 숫자만 있는 줄은 숫자로 넣어 양식의 천단위 서식을 그대로 받는다
      split[c]=chunks(item['명세_'+k],wide[c]||8).map(function(line){return c==='K'&&/^[\d,]+$/.test(line)?Number(line.replace(/,/g,'')):line;});
    });
    // 블록 높이: 기본 4행(층별 행은 2행). 머리행 소재지가 그보다 길면 남는 줄은 아래 층별 행 옆으로 흘려보낸다(발송 양식과 같게).
    // 나눈 필지의 마지막 나눈 줄(drain)은 원 필지에서 흘러내린 소재지 줄을 다 받을 만큼 늘린다(다음 필지에서 끊기지 않게).
    var height=Math.max(item.minRows||4,...cols.filter(function(c){return c!=='C';}).map(function(c){return split[c].length;}),item.drain?carry.length:0);
    if(split.C){carry=split.C.slice(height);split.C=split.C.slice(0,height);}
    else split.C=carry.splice(0,height);
    var hasUnit=typeof item['명세_단가']==='number';   // 평가외 '-'·머리행 null이면 금액 수식 없음
    for(var j=0;j<height;j++){var row=newRow(r);
      (function(rr,first){cols.forEach(function(c){
        if(c==='J'){row.append(first&&item.out?cell(d,'J'+rr,style.J,'감정평가 외'):cell(d,'J'+rr,style.J,null,(first&&hasUnit)?'+I'+rr+'*H'+rr:null));return;}
        // 사정면적 괄호선: 값 줄은 ┌(원 필지)·│(가운데 나눈 줄)·└(마지막 나눈 줄) 서식, 그 사이 빈 줄은 │
        if(brStyle&&c==='G'&&item.gbr){
          if(first&&split.G[0]!=null){row.append(cell(d,'G'+rr,brStyle['g'+item.gbr],split.G[0]));return;}
          if(item.gbr!=='end'){row.append(cell(d,'G'+rr,brStyle.gline,'│'));return;}
        }
        if(brStyle&&c==='H'&&item.hbr){
          if(first&&split.H[0]!=null){row.append(cell(d,'H'+rr,brStyle['h'+item.hbr],split.H[0]));return;}
          if(item.hbr!=='end'){row.append(cell(d,'H'+rr,brStyle.line,'│'));return;}
        }
        if(c==='H'&&item.br&&brStyle){
          if(first){row.append(cell(d,'H'+rr,brStyle[item.br],split.H[0]));return;}
          if(item.br!=='end'){row.append(cell(d,'H'+rr,brStyle.line,'│'));return;}
        }
        row.append(cell(d,c+rr,style[c],split[c][j]));
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
  // 면적(공부·사정) 열이 좁아 '#####'로 나오던 것 — G·H열을 넓히고 E·F(지목용도·용도지역)를 그만큼 줄여 인쇄 폭 유지
  Array.from(d.getElementsByTagNameNS(X,'col')).forEach(function(c){var mn=+c.getAttribute('min');
    if(mn===7||mn===8)c.setAttribute('width','20');else if(mn===5)c.setAttribute('width','25');});
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
// 건물등기 칸 아래 인식 결과 한 줄
function regHint(){var h=$('bt_regHint');if(!h)return;var t=cgVal('bt_regText').trim();if(!t){h.textContent='';return;}
  var r=parseRegBld(t);h.textContent=r.floors.length?'명세표 건물란 = 등기대로 · 구조 「'+r.struct.join(' ')+'」 · 용도 「'+(r.use||'-')+'」 · 층 '+r.floors.map(function(f){return f.label+' '+f.area;}).join(', '):'⚠ 층별 면적 줄(예: 1층 148.26㎡)을 찾지 못해 건축물대장 목록대로 나갑니다.';}
if($('bt_regText')){$('bt_regText').addEventListener('input',regHint);setTimeout(regHint,0);}
function downloadYohang(btn,statusId){return run(btn,async function(){var bytes=await buildYohang();A.triggerDownload(bytes,'5. 요항표_'+(cgVal('ov_client')||'의뢰인')+'.hwpx');},statusId);}
$('btnYohang').onclick=function(){return downloadYohang(this);};
if($('btnYohang2'))$('btnYohang2').onclick=function(){return downloadYohang(this,'y_status');};
window.ArapTojiDocuments={statementRows:statementRows,parseRegBld:parseRegBld,regHint:regHint,buildStatement:buildStatement,yohangMap:yohangMap,buildYohang:buildYohang,landOnlyGwal:landOnlyGwal,bldOnlyGwal:bldOnlyGwal,gwalOutRow:gwalOutRow};
})();
