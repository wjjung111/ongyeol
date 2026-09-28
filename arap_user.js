/* arap_user.js — 사용자 이름 게이트(허용 목록) + 상단바 🙋 이름 표시
 *
 * 토지건물.html이 `<body>` 바로 아래(arap_access.js 다음)에서 로드한다.
 * 집합건물(s3r86w8a.html)·입주권(입주권.html) 상단 스크립트의 이름 부분과 같은 동작:
 *   - 허용 목록(ARAP_USERS + 숨은 관리자 ARAP_HIDDEN_USERS)의 이름이 저장돼 있지 않으면 온결 첫 화면으로 가리고 드롭다운에서 고르게 한다.
 *   - 저장 키는 집합건물과 같은 `arap-user-name` → 한 앱에서 고르면 다른 앱도 그대로 통과.
 *   - 상단바 `#mb-user` 클릭 = 이름 변경. `?user=이름` 으로 바로 저장.
 * ※ 이름 목록을 바꾸면 s3r86w8a.html · 입주권.html · 이 파일 세 곳을 같은 값으로 맞춘다.
 * 사용 기록 전송(arapUsageLog)은 여기 없다 — 집합건물·입주권만 보낸다.
 */
(function(){
  if(!window.ARAP_USERS)window.ARAP_USERS=["김서연","박찬희","이경민","이선우","최진욱"];   // 첫 화면 드롭다운에 보이는 이름
  if(!window.ARAP_HIDDEN_USERS)window.ARAP_HIDDEN_USERS=["wdw"];                            // 관리자 — 드롭다운엔 안 보임
  window.arapUserAllowed=function(n){return window.ARAP_USERS.includes(n)||window.ARAP_HIDDEN_USERS.includes(n);};
  var lsGet=function(k){try{return localStorage.getItem(k);}catch(e){return null;}};

  window.arapUserName=function(forceAsk){
    try{var q=new URLSearchParams(location.search).get("user");if(q&&window.arapUserAllowed(q))localStorage.setItem("arap-user-name",q);}catch(e){}
    var name=lsGet("arap-user-name")||"";
    if(!window.arapUserAllowed(name))name="";
    var el=document.getElementById("mb-user");if(el)el.textContent=name?"🙋 "+name:"🙋 이름 선택";
    if(forceAsk||!name){try{window.arapShowNameGate(name);}catch(e){console.error('name gate',e);}}
    return name;
  };

  window.arapShowNameGate=function(current){
    if(document.getElementById("arap-name-gate"))return;
    if(!document.body){document.addEventListener("DOMContentLoaded",function(){window.arapShowNameGate(current);});return;}
    var changing=!!current;
    var gate=document.createElement("div");
    gate.id="arap-name-gate";
    var opts=['<option value="">이름을 선택하세요</option>'].concat(
      window.ARAP_USERS.map(function(n){return '<option value="'+n+'"'+(n===current?' selected':'')+'>'+n+'</option>';})).join("");
    gate.innerHTML=
      '<div style="text-align:center;max-width:420px;padding:24px;">'+
      '<div style="font-size:34px;letter-spacing:6px;color:#f8fafc;font-weight:700;">온 결</div>'+
      '<div style="font-size:13px;color:#94a3b8;margin:8px 0 34px;letter-spacing:1px;">감정평가 자동화 도구</div>'+
      '<div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:26px 22px;">'+
      '<div style="font-size:13px;color:#cbd5e1;margin-bottom:14px;">'+(changing?'사용하실 이름을 다시 선택해주세요.':'처음 오셨네요! 사용하실 이름을 선택해주세요. <span style="color:#64748b;">(최초 1회)</span>')+'</div>'+
      '<div style="display:flex;align-items:center;justify-content:center;gap:8px;">'+
      '<span style="color:#94a3b8;font-size:14px;">사용자이름:</span>'+
      '<select id="arap-gate-select" style="width:190px;padding:9px 10px;font-size:16px;font-weight:700;border:1px solid #475569;border-radius:6px;background:#fff;color:#0f172a;text-align:center;font-family:inherit;cursor:pointer;">'+opts+'</select>'+
      '<span style="color:#e2e8f0;font-size:14px;font-weight:600;">감정평가사</span></div>'+
      '<button id="arap-gate-btn" type="button" style="margin-top:18px;width:100%;padding:11px;font-size:15px;font-weight:700;color:#fff;background:#2563eb;border:none;border-radius:8px;cursor:pointer;font-family:inherit;">시작하기</button>'+
      (changing?'<button id="arap-gate-cancel" type="button" style="margin-top:10px;width:100%;padding:9px;font-size:13px;color:#94a3b8;background:transparent;border:1px solid #334155;border-radius:8px;cursor:pointer;font-family:inherit;">취소</button>':'')+
      '</div></div>';
    gate.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;width:100%;height:100%;z-index:99999;display:flex;align-items:center;justify-content:center;background:linear-gradient(160deg,#0f172a 0%,#1e293b 60%,#0f172a 100%);font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;";
    document.body.appendChild(gate);
    var sel=document.getElementById("arap-gate-select");
    var done=function(){
      var v=sel.value;
      if(!window.ARAP_USERS.includes(v)){sel.focus();return;}
      try{localStorage.setItem("arap-user-name",v);}catch(e){console.error('gate name save',e);}
      gate.remove();
      try{window.arapUserName(false);}catch(e){console.error('gate refresh',e);}
    };
    document.getElementById("arap-gate-btn").onclick=done;
    sel.addEventListener("keydown",function(e){if(e.key==="Enter")done();});
    var cancel=document.getElementById("arap-gate-cancel");
    if(cancel)cancel.onclick=function(){gate.remove();};
    setTimeout(function(){try{sel.focus();}catch(e){}},100);
  };

  // 상단바가 그려진 뒤 이름 표시·클릭 연결, 유효한 이름이 없으면 첫 화면
  function init(){
    var el=document.getElementById("mb-user");
    if(el)el.onclick=function(){window.arapUserName(true);};
    try{window.arapUserName(false);}catch(e){console.error('name gate init',e);}
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
