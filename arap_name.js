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
    이름 화면 부제목은 arap_name.js 앞에서  <script>window.ARAP_NAME_SUB='건축물대장 간편조회';</script>  로 페이지마다 지정.
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
    gate.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;width:100%;height:100%;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;background:#fff radial-gradient(900px 420px at 50% -8%,#eaf1ff 0%,rgba(255,255,255,0) 70%);font-family:'Pretendard','Malgun Gothic','Apple SD Gothic Neo',sans-serif;color:#0f172a;";
    if(!document.getElementById("arap-name-gate-css")){
      var gcss=document.createElement("style");gcss.id="arap-name-gate-css";
      gcss.textContent=
        "#arap-name-gate *{box-sizing:border-box;}"+
        "#arap-name-gate .ng-wrap{width:100%;max-width:400px;text-align:center;}"+
        "#arap-name-gate .ng-icon{width:60px;height:60px;margin:0 auto 18px;border-radius:18px;display:flex;align-items:center;justify-content:center;font-size:28px;background:linear-gradient(145deg,#eff6ff,#dbeafe);box-shadow:inset 0 0 0 1px #dbeafe,0 6px 16px rgba(37,99,235,.12);}"+
        "#arap-name-gate .ng-title{font-size:26px;font-weight:800;letter-spacing:-.5px;margin:0;}"+
        "#arap-name-gate .ng-desc{font-size:14px;color:#64748b;margin:10px 0 28px;line-height:1.6;word-break:keep-all;}"+
        "#arap-name-gate .ng-card{background:#fff;border:1px solid #e5e9f0;border-radius:18px;padding:28px 26px 26px;text-align:left;box-shadow:0 1px 2px rgba(15,23,42,.04),0 12px 32px rgba(15,23,42,.08);}"+
        "#arap-name-gate .ng-label{display:block;font-size:13px;font-weight:700;color:#334155;margin-bottom:8px;}"+
        "#arap-name-gate .ng-input{width:100%;height:48px;padding:0 14px;font-size:16px;font-weight:600;color:#0f172a;background:#f8fafc;border:1px solid #d6dde7;border-radius:12px;outline:none;font-family:inherit;transition:border-color .15s,box-shadow .15s,background .15s;}"+
        "#arap-name-gate .ng-input::placeholder{color:#a0aec0;font-weight:500;}"+
        "#arap-name-gate .ng-input:focus{background:#fff;border-color:#2563eb;box-shadow:0 0 0 4px rgba(37,99,235,.14);}"+
        "#arap-name-gate .ng-msg{min-height:18px;margin:8px 2px 0;font-size:12px;color:#dc2626;}"+
        "#arap-name-gate .ng-btn{margin-top:8px;width:100%;height:50px;font-size:15px;font-weight:700;color:#fff;background:linear-gradient(180deg,#3b82f6,#2563eb);border:none;border-radius:12px;cursor:pointer;font-family:inherit;box-shadow:0 6px 16px rgba(37,99,235,.28);transition:transform .1s,box-shadow .15s;}"+
        "#arap-name-gate .ng-btn:hover{box-shadow:0 8px 20px rgba(37,99,235,.36);}"+
        "#arap-name-gate .ng-btn:active{transform:translateY(1px);}"+
        "#arap-name-gate .ng-cancel{margin-top:10px;width:100%;height:42px;font-size:13px;color:#64748b;background:#fff;border:1px solid #d6dde7;border-radius:12px;cursor:pointer;font-family:inherit;}"+
        "#arap-name-gate .ng-foot{position:absolute;left:16px;right:16px;bottom:24px;text-align:center;font-size:12px;color:#94a3b8;}";
      document.head.appendChild(gcss);
    }
    function h(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;");}
    gate.innerHTML=
      '<div class="ng-wrap">'+
      '<div class="ng-icon">'+h(window.ARAP_NAME_ICON||'👋')+'</div>'+
      '<h1 class="ng-title">'+h(window.ARAP_NAME_SUB||'감정평가 자동화 도구')+'</h1>'+
      '<p class="ng-desc">'+(changing?'사용하실 이름을 다시 입력해주세요.':'처음 오셨네요! 사용하실 이름을 입력해주세요.<br>이 기기에서 최초 1회만 입력합니다.')+'</p>'+
      '<div class="ng-card">'+
      '<label class="ng-label" for="arap-name-input">사용자이름</label>'+
      '<input id="arap-name-input" class="ng-input" type="text" maxlength="20" autocomplete="off" placeholder="이름을 입력하세요" value="'+h(current)+'">'+
      '<div id="arap-name-msg" class="ng-msg"></div>'+
      '<button id="arap-name-btn" class="ng-btn" type="button">시작하기</button>'+
      (changing?'<button id="arap-name-cancel" class="ng-cancel" type="button">취소</button>':'')+
      '</div>'+
      '</div>'+
      '<div class="ng-foot">🔒 입력한 이름은 사용자 기기에만 저장됩니다.</div>';
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
