/*
  온결 사용자 이름 게이트 (arap_name.js)
  - 접속코드 없이 "이름만" 받는 화면(건축물대장·시점수정 계산기)에 붙는다.
  - 브라우저마다 최초 1회 이름을 적으면 저장(localStorage 'arap-user-name')되고 다시 묻지 않는다.
    이름을 적기 전에는 뒤의 화면이 보이지 않아 다음으로 넘어갈 수 없다.
  - 저장 키는 집합건물·입주권 앱과 같은 'arap-user-name' — 그 앱에서 고른 이름이 있으면 여기서도 그대로 통과하고,
    여기서 적은 이름은 시점수정 '접속' 기록에도 그대로 실린다. (집합건물·입주권은 허용 목록 이름만 받으므로 거기선 다시 고르게 됨)
  - 주소 뒤에 ?user=이름 을 붙이면 그 이름으로 바로 저장하고 통과한다.
  - 사용 방법: <body> 바로 다음 줄에  <script src="arap_name.js"></script>
    이름이 확정된 뒤 할 일은  window.arapNameReady(function(name){...})  로 걸어둔다(이미 확정돼 있으면 즉시 실행).
    이름 바꾸기는  window.arapAskName()  (상단바의 이름 표시를 클릭해도 된다: id="arap-name-badge" 요소가 있으면 자동 연결)
*/
(function(){
  var KEY="arap-user-name";
  var readyCbs=[];
  function lsGet(k){try{return localStorage.getItem(k);}catch(e){return null;}}
  function lsSet(k,v){try{localStorage.setItem(k,v);}catch(e){console.error('name save',e);}}
  function clean(s){return String(s||"").replace(/\s+/g," ").trim().slice(0,20);}
  // 옛 자동번호(사용자-XXXX)는 이름으로 치지 않는다
  function valid(n){return !!n&&n.length>=2&&!/^사용자-/.test(n);}

  try{var q=new URLSearchParams(location.search).get("user");if(q&&valid(clean(q)))lsSet(KEY,clean(q));}catch(e){}

  window.arapUserName=function(){var n=clean(lsGet(KEY));return valid(n)?n:"";};
  window.arapNameReady=function(cb){
    if(typeof cb!=="function")return;
    var n=window.arapUserName();
    if(n){try{cb(n);}catch(e){console.error('name ready',e);}}
    else readyCbs.push(cb);
  };
  function fireReady(n){
    var cbs=readyCbs;readyCbs=[];
    for(var i=0;i<cbs.length;i++){try{cbs[i](n);}catch(e){console.error('name ready',e);}}
    updateBadge();
  }
  function updateBadge(){
    var b=document.getElementById("arap-name-badge");
    if(!b)return;
    var n=window.arapUserName();
    b.textContent=n?"🙋 "+n:"🙋 이름 입력";
    b.title="클릭해서 이름 변경";
    b.style.cursor="pointer";
    b.onclick=function(){window.arapAskName();};
  }

  var STYLE_ID="arap-name-style";
  function lock(){
    if(document.getElementById(STYLE_ID))return;
    var style=document.createElement("style");
    style.id=STYLE_ID;
    style.textContent="html.arap-name-locked body>*:not(#arap-name-gate){visibility:hidden!important;}";
    document.head.appendChild(style);
    document.documentElement.classList.add("arap-name-locked");
  }
  function unlock(){
    document.documentElement.classList.remove("arap-name-locked");
    var st=document.getElementById(STYLE_ID);if(st)st.remove();
  }

  // 이름 화면: 화면 전체를 덮고, 뒤의 앱 본체는 이름을 적기 전까지 숨긴다
  window.arapAskName=function(){
    if(document.getElementById("arap-name-gate"))return;
    var current=window.arapUserName();
    var changing=!!current;                       // 이름 변경 모드(이미 이름이 있을 때) — 취소 가능
    if(!changing)lock();
    var gate=document.createElement("div");
    gate.id="arap-name-gate";
    gate.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;width:100%;height:100%;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:linear-gradient(160deg,#0f172a 0%,#1e293b 60%,#0f172a 100%);font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;";
    gate.innerHTML=
      '<div style="text-align:center;max-width:420px;padding:24px;">'+
      '<div style="font-size:34px;letter-spacing:6px;color:#f8fafc;font-weight:700;">온 결</div>'+
      '<div style="font-size:13px;color:#94a3b8;margin:8px 0 34px;letter-spacing:1px;">감정평가 자동화 도구</div>'+
      '<div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:26px 22px;">'+
      '<div style="font-size:13px;color:#cbd5e1;margin-bottom:14px;">'+(changing?'사용하실 이름을 다시 입력해주세요.':'처음 오셨네요! 사용하실 이름을 입력해주세요. <span style="color:#64748b;">(이 기기에서 최초 1회)</span>')+'</div>'+
      '<div style="display:flex;align-items:center;justify-content:center;gap:8px;">'+
      '<span style="color:#94a3b8;font-size:14px;">사용자이름:</span>'+
      '<input id="arap-name-input" type="text" maxlength="20" autocomplete="off" placeholder="이름" value="'+current.replace(/"/g,"&quot;")+'" style="width:190px;padding:9px 10px;font-size:16px;font-weight:700;border:1px solid #475569;border-radius:6px;background:#fff;color:#0f172a;text-align:center;font-family:inherit;">'+
      '</div>'+
      '<div id="arap-name-msg" style="height:18px;margin-top:8px;font-size:12px;color:#f87171;"></div>'+
      '<button id="arap-name-btn" type="button" style="margin-top:10px;width:100%;padding:11px;font-size:15px;font-weight:700;color:#fff;background:#2563eb;border:none;border-radius:8px;cursor:pointer;font-family:inherit;">시작하기</button>'+
      (changing?'<button id="arap-name-cancel" type="button" style="margin-top:10px;width:100%;padding:9px;font-size:13px;color:#94a3b8;background:transparent;border:1px solid #334155;border-radius:8px;cursor:pointer;font-family:inherit;">취소</button>':'')+
      '</div>'+
      '<div style="margin-top:22px;font-size:12px;color:#64748b;">입력한 이름은 이 기기에만 저장되며, 사내 관리 목적의 사용 기록에 표시됩니다.</div>'+
      '</div>';
    function mount(){
      if(!document.body){setTimeout(mount,10);return;}
      document.body.appendChild(gate);
      var input=document.getElementById("arap-name-input");
      var msg=document.getElementById("arap-name-msg");
      function done(){
        var v=clean(input.value);
        if(!valid(v)){msg.textContent=v?"이름을 두 글자 이상 적어주세요.":"이름을 입력해야 사용할 수 있습니다.";input.focus();return;}
        lsSet(KEY,v);
        gate.remove();
        unlock();
        fireReady(v);
      }
      document.getElementById("arap-name-btn").onclick=done;
      input.addEventListener("keydown",function(e){if(e.key==="Enter")done();});
      var cancel=document.getElementById("arap-name-cancel");
      if(cancel)cancel.onclick=function(){gate.remove();updateBadge();};
      setTimeout(function(){try{input.focus();}catch(e){}},100);
    }
    mount();
  };

  // 접속 즉시: 저장된 이름이 없으면 이름 화면, 있으면 그대로 통과
  if(window.arapUserName()){
    if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",updateBadge);else updateBadge();
  }else{
    lock();
    window.arapAskName();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",updateBadge);
})();
