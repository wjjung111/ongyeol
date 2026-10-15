// 집합건물 저장건 안전장치(window.ArapCaseBak) — 단일 호수(pre "")·여러 호수(pre "v2:") 앱이 같이 쓴다.
//  1) 건별 이전 버전: 자동저장이 건을 덮어쓰기 직전 내용을 `<pre>appraisal-bak:<id>`에 최대 MAX개 보관.
//     담는 경우 = 이 창이 모르는 내용을 덮어쓸 때(다른 창이 저장했거나, 접수번호를 바꿔 이미 있는 건에 겹침)
//               · 사례·전례·채운 칸이 크게 줄 때 · 마지막 보관 뒤 GAP이 지났을 때.
//     모든 건의 이전 버전 합계가 BUDGET을 넘으면 오래된 것부터 버린다(본 저장 공간 보호).
//  2) 목록 보정: 목록(appraisal-case-list)은 늘 저장소에서 읽어 고친다 — 화면이 들고 있던 옛 목록으로 덮어써
//     다른 창에서 만든 건이 목록에서 빠지던 문제(2026-10-15 ON261013-3301 사고) 방지. 목록에 없는 건은 불러올 때 다시 올린다.
// 저장키는 추가만 — 기존 case:/appraisal-case-list 키 형식은 그대로.
(function(){
  var MAX=6,GAP=5*60*1000,BUDGET=1500000;
  var known={};   // 저장키 → 이 창이 마지막으로 읽거나 쓴 내용
  function get(k){try{return localStorage.getItem(k);}catch(e){return null;}}
  function parse(s){try{return JSON.parse(s);}catch(e){return null;}}
  function caseKey(pre,id){return pre+"case:"+id;}
  function bakKey(pre,id){return pre+"appraisal-bak:"+id;}
  function listKey(pre){return pre+"appraisal-case-list";}
  function filled(v){return Array.isArray(v)?v.length>0:(v!=null&&typeof v!=="object"&&String(v).trim()!=="");}
  function score(o){
    if(!o)return 0;var n=(o.cases||[]).length+(o.precs||[]).length,v=o.ov||{};
    Object.keys(v).forEach(function(k){if(k!=="caseNo"&&k!=="autoFields"&&filled(v[k]))n++;});
    (v.units||[]).forEach(function(u){Object.keys(u||{}).forEach(function(k){if(k!=="id"&&filled(u[k]))n++;});});
    return n;
  }
  function summary(raw){
    var o=parse(raw)||{},v=o.ov||{},u=(v.units||[])[0]||{};
    var dong=v.dong||u.dong,ho=v.ho||u.ho;
    var b=[v.buildingName,dong&&dong+"동",ho&&ho+"호"].filter(Boolean).join(" ")||"(물건 칸 비어 있음)";
    return b+" · 사례 "+(o.cases||[]).length+" · 전례 "+(o.precs||[]).length+(v.owner?" · 소유자 "+v.owner:"");
  }
  function ring(pre,id){var a=parse(get(bakKey(pre,id)));return Array.isArray(a)?a:[];}
  // 모든 이전 버전 목록 — [{key,ring,size}]
  function allRings(){
    var out=[];
    try{for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);
      if(/^(v2:)?appraisal-bak:/.test(k)){var s=get(k)||"";var a=parse(s);if(Array.isArray(a))out.push({key:k,ring:a,size:s.length});}}}catch(e){}
    return out;
  }
  // 합계가 BUDGET을 넘으면 가장 오래된 버전부터 버린다(방금 담은 keep 키의 맨 앞 버전은 지키지 않음 — 그건 최신이라 맨 나중에 버려짐)
  function prune(){
    var rs=allRings(),tot=rs.reduce(function(a,r){return a+r.size;},0);
    while(tot>BUDGET){
      var best=null,bi=-1;
      rs.forEach(function(r){if(r.ring.length){var t=r.ring[r.ring.length-1].t||0;if(!best||t<best.t){best={t:t};bi=rs.indexOf(r);}}});
      if(bi<0)break;
      var r=rs[bi];r.ring.pop();
      try{if(r.ring.length)localStorage.setItem(r.key,JSON.stringify(r.ring));else localStorage.removeItem(r.key);}catch(e){}
      var ns=r.ring.length?JSON.stringify(r.ring).length:0;tot-=r.size-ns;r.size=ns;
    }
  }
  function putRing(pre,id,a){
    while(a.length>MAX)a.pop();
    for(var tries=0;tries<30;tries++){
      try{localStorage.setItem(bakKey(pre,id),JSON.stringify(a));prune();return true;}
      catch(e){   // 공간 부족 — 다른 건의 오래된 버전부터, 그다음 이 건의 오래된 버전부터 버리며 다시
        var others=allRings().filter(function(r){return r.key!==bakKey(pre,id)&&r.ring.length;});
        if(others.length){others.sort(function(x,y){return (x.ring[x.ring.length-1].t||0)-(y.ring[y.ring.length-1].t||0);});
          var o=others[0];o.ring.pop();try{if(o.ring.length)localStorage.setItem(o.key,JSON.stringify(o.ring));else localStorage.removeItem(o.key);}catch(e2){}}
        else if(a.length>1)a.pop();
        else return false;
      }
    }
    return false;
  }
  var toastT=null;
  function toast(msg){
    try{var el=document.getElementById("arap-casebak-toast");
      if(!el){el=document.createElement("div");el.id="arap-casebak-toast";el.setAttribute("role","status");
        el.style.cssText="position:fixed;left:50%;bottom:80px;transform:translateX(-50%);z-index:6000;background:#7c2d12;color:#fff;border-radius:8px;padding:10px 14px;font-size:13px;max-width:92vw;box-shadow:0 6px 20px rgba(15,23,42,.3);cursor:pointer";
        el.onclick=function(){el.style.display="none";};document.body.appendChild(el);}
      el.textContent=msg;el.style.display="block";clearTimeout(toastT);toastT=setTimeout(function(){el.style.display="none";},12000);}catch(e){}
  }
  // 이 창이 이 건을 읽었다(불러오기·처음 복원) — 이후 이 내용을 덮어쓰는 건 '아는 내용'이라 경고하지 않음
  function seen(pre,id){var k=caseKey(pre,id);known[k]=get(k);}
  // 자동저장 — setFn(key,raw)로 저장(앱의 storageSet: 동기화 훅 포함). 덮어쓰기 전 내용을 판단해 이전 버전으로 담는다.
  function write(pre,id,raw,setFn){
    var k=caseKey(pre,id),prevRaw=get(k);
    setFn(k,raw);
    var wasKnown=known[k];known[k]=raw;
    if(!prevRaw||prevRaw===raw)return;
    var prev=parse(prevRaw);if(!prev)return;
    var a=ring(pre,id);
    if(a.length&&a[0].raw===prevRaw)return;
    var nw=parse(raw)||{},ps=score(prev);
    var foreign=wasKnown!==prevRaw;
    var shrink=score(nw)<=ps-3||(nw.cases||[]).length<(prev.cases||[]).length||(nw.precs||[]).length<(prev.precs||[]).length;
    var due=!a.length||Date.now()-(a[0].t||0)>=GAP;
    if(!(foreign||shrink||due))return;
    a.unshift({t:Date.now(),raw:prevRaw});
    putRing(pre,id,a);
    if(foreign&&ps>=3)toast("⚠️ "+id+" 번호로 저장돼 있던 다른 내용("+summary(prevRaw)+")을 이 화면 내용으로 덮어썼습니다. 📂 저장된 건 → ↺ 이전 버전에서 되돌릴 수 있습니다.");
  }
  // 이 창이 마지막으로 읽거나 쓴 내용 그대로인가(다른 창이 그 뒤 안 고침)
  function knows(pre,id){var k=caseKey(pre,id),v=get(k);return v!=null&&known[k]===v;}
  // 접수번호를 고친 경우 — 옛 번호의 이전 버전을 새 번호로 옮긴다
  function moveRing(pre,from,to){
    var a=ring(pre,from);if(!a.length)return;
    var b=ring(pre,to).concat(a).sort(function(x,y){return (y.t||0)-(x.t||0);});
    try{localStorage.removeItem(bakKey(pre,from));}catch(e){}
    putRing(pre,to,b);
  }
  function forget(pre,id){delete known[caseKey(pre,id)];}
  function versions(pre,id){return ring(pre,id).map(function(x,i){return {k:i,t:x.t,summary:summary(x.raw)};});}
  // k번째 이전 버전으로 되돌린다 — 지금 내용도 이전 버전 맨 앞에 남겨 다시 되돌릴 수 있게
  function restore(pre,id,k,setFn){
    var a=ring(pre,id),s=a[k];if(!s)return false;
    var key=caseKey(pre,id),cur=get(key);
    a.splice(k,1);
    if(cur&&cur!==s.raw)a.unshift({t:Date.now(),raw:cur});
    var o=parse(s.raw);if(!o)return false;
    o.ov=Object.assign({},o.ov||{},{caseNo:id});var raw=JSON.stringify(o);
    setFn(key,raw);known[key]=raw;putRing(pre,id,a);
    return true;
  }
  // 목록 — 저장소에서 읽는다. heal이면 목록에 없는 저장건(case:*)을 맨 뒤에 다시 올린다
  function readList(pre,heal){
    var L=parse(get(listKey(pre)));if(!Array.isArray(L))L=[];L=L.filter(function(c){return c&&c.id!=null;});
    if(!heal)return L;
    var have={};L.forEach(function(c){have[c.id]=1;});var add=[];
    try{for(var i=0;i<localStorage.length;i++){var key=localStorage.key(i);
      if(key.indexOf(pre+"case:")!==0)continue;var id=key.slice((pre+"case:").length);if(have[id]||!id)continue;
      var o=parse(get(key))||{},v=o.ov||{};have[id]=1;
      add.push({id:id,label:(id+" "+(v.buildingName||"")+" "+(v.dong?v.dong+"동":"")+" "+(v.ho?v.ho+"호":"")).replace(/\s+/g," ").trim(),updated:""});}}catch(e){}
    if(add.length){L=L.concat(add);try{localStorage.setItem(listKey(pre),JSON.stringify(L));}catch(e){}}
    return L;
  }
  // 앱 자동저장 한 번 — 접수번호를 고친 경우(prevId → id)는 새 건을 만들지 않고 「이름 바꾸기」로 옮긴다
  //  · id가 이미 다른 건으로 저장돼 있으면(이 창이 연 건이 아님) 덮어쓰지 않고 {ok:false,exists:true}
  //  · prevId 건이 이 창이 마지막으로 쓴 그대로면 옛 번호 건·메모·이전 버전을 새 번호로 옮기고 목록에서 뺀다
  //  · 목록은 저장소에서 읽어 고친다. 반환 {ok,list,renamed}
  var warned={};
  function autosave(o){
    var pre=o.pre,id=o.id,prevId=o.prevId||null,k=caseKey(pre,id);
    if(id!==prevId&&get(k)!=null&&!knows(pre,id)){
      if(!warned[pre+id]){warned[pre+id]=1;toast("⚠️ "+id+" 접수번호로 저장된 다른 건이 이미 있어 자동저장을 멈췄습니다. 번호를 고치거나 📂 저장된 건에서 그 건을 여세요.");}
      return {ok:false,exists:true};
    }
    warned={};
    // 내용이 저장된 것과 똑같으면 아무것도 안 함 — 화면을 열기만 해도(단일·여러 호수 두 앱이 한 페이지에 함께 떠서 각자 마지막 건을 불러옴)
    // 「최근 수정」 시각이 바뀌어 안 건드린 건이 목록 맨 위로 올라오던 문제(2026-10-15 사용자 제보 ON260914-2003)
    if(prevId===id&&get(k)===o.raw)return {ok:true,list:readList(pre),renamed:false,unchanged:true};
    write(pre,id,o.raw,o.setFn);
    var renamed=false;
    if(prevId&&prevId!==id&&knows(pre,prevId)){
      try{localStorage.removeItem(caseKey(pre,prevId));}catch(e){}
      forget(pre,prevId);
      if(o.memoPrefix){var m=get(o.memoPrefix+prevId);
        if(m!=null){try{if(get(o.memoPrefix+id)==null)localStorage.setItem(o.memoPrefix+id,m);localStorage.removeItem(o.memoPrefix+prevId);}catch(e){}}}
      moveRing(pre,prevId,id);
      renamed=true;
    }
    var L=readList(pre).filter(function(c){return c.id!==id&&!(renamed&&c.id===prevId);});
    L.unshift({id:id,label:o.label||id,updated:new Date().toISOString()});
    o.setFn(listKey(pre),JSON.stringify(L));
    return {ok:true,list:L,renamed:renamed};
  }
  window.ArapCaseBak={autosave:autosave,write:write,seen:seen,knows:knows,moveRing:moveRing,forget:forget,toast:toast,versions:versions,restore:restore,readList:readList,summary:summary,_score:score,MAX:MAX};
})();
