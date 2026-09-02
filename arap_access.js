/*
  온결 접속코드 잠금 (arap_access.js)
  - 온결 감정평가사만 쓰는 화면(허브·집합건물·입주권·토지건물·건축물대장·토지조회·개발허브)에 공통으로 붙는다.
  - 브라우저마다 최초 1회 접속코드를 맞히면 저장(localStorage 'arap-access-ok')되고 다시 묻지 않는다.
  - 코드 원문은 파일에 넣지 않고 SHA-256 해시만 둔다. 코드를 바꾸려면 아래 ARAP_ACCESS_HASH 값을 새 코드의 해시로 교체.
    (해시 만들기: 이 파일이 로드된 페이지의 개발자도구 콘솔에서  arapSha256("새코드").then(console.log) )
  - arm_시점수정.html(외부 공개)과 관리자.html(수신함이 비밀번호 검증)에는 붙이지 않는다.
  - 사용 방법: <body> 바로 다음 줄에  <script src="arap_access.js"></script>
*/
(function(){
  var ARAP_ACCESS_HASH="b512d3c5b704463be22b9038d5c78fe3b0bf8d545f1be7af4d798e64d50eeb6b";
  var KEY="arap-access-ok";

  // ── 순수 JS SHA-256 (crypto.subtle이 없는 환경·file:// 열기에서도 동작) ──
  function sha256(str){
    var utf8=unescape(encodeURIComponent(str));
    var K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    var H=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    var l=utf8.length,words=[],i;
    for(i=0;i<l;i++)words[i>>2]|=utf8.charCodeAt(i)<<(24-(i%4)*8);
    words[l>>2]|=0x80<<(24-(l%4)*8);
    words[((l+8>>6)<<4)+15]=l*8;
    var W=new Array(64);
    function rotr(x,n){return (x>>>n)|(x<<(32-n));}
    for(var j=0;j<words.length;j+=16){
      var a=H[0],b=H[1],c=H[2],d=H[3],e=H[4],f=H[5],g=H[6],h=H[7];
      for(i=0;i<64;i++){
        if(i<16)W[i]=words[j+i]|0;
        else{
          var s0=rotr(W[i-15],7)^rotr(W[i-15],18)^(W[i-15]>>>3);
          var s1=rotr(W[i-2],17)^rotr(W[i-2],19)^(W[i-2]>>>10);
          W[i]=(W[i-16]+s0+W[i-7]+s1)|0;
        }
        var S1=rotr(e,6)^rotr(e,11)^rotr(e,25);
        var ch=(e&f)^(~e&g);
        var t1=(h+S1+ch+K[i]+W[i])|0;
        var S0=rotr(a,2)^rotr(a,13)^rotr(a,22);
        var maj=(a&b)^(a&c)^(b&c);
        var t2=(S0+maj)|0;
        h=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;
      }
      H[0]=(H[0]+a)|0;H[1]=(H[1]+b)|0;H[2]=(H[2]+c)|0;H[3]=(H[3]+d)|0;
      H[4]=(H[4]+e)|0;H[5]=(H[5]+f)|0;H[6]=(H[6]+g)|0;H[7]=(H[7]+h)|0;
    }
    var out="";
    for(i=0;i<8;i++)out+=("00000000"+(H[i]>>>0).toString(16)).slice(-8);
    return out;
  }
  window.arapSha256=function(s){return Promise.resolve(sha256(String(s)));};

  function lsGet(k){try{return localStorage.getItem(k);}catch(e){return null;}}
  function lsSet(k,v){try{localStorage.setItem(k,v);}catch(e){console.error('access save',e);}}

  // 이미 이 브라우저에서 코드를 맞힌 적이 있으면 통과
  if(lsGet(KEY)===ARAP_ACCESS_HASH)return;

  // 잠금 화면: 화면 전체를 덮고, 뒤의 앱 본체는 통과 전까지 숨긴다 (구형 브라우저 호환을 위해 inset 대신 top/left/right/bottom)
  var style=document.createElement("style");
  style.id="arap-access-style";
  style.textContent="html.arap-locked body>*:not(#arap-access-gate){visibility:hidden!important;}";
  document.head.appendChild(style);
  document.documentElement.classList.add("arap-locked");

  var gate=document.createElement("div");
  gate.id="arap-access-gate";
  gate.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;width:100%;height:100%;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:linear-gradient(160deg,#0f172a 0%,#1e293b 60%,#0f172a 100%);font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;";
  gate.innerHTML=
    '<div style="text-align:center;max-width:420px;padding:24px;">'+
    '<div style="font-size:34px;letter-spacing:6px;color:#f8fafc;font-weight:700;">온 결</div>'+
    '<div style="font-size:13px;color:#94a3b8;margin:8px 0 34px;letter-spacing:1px;">온결감정평가법인 내부용 도구</div>'+
    '<div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:26px 22px;">'+
    '<div style="font-size:13px;color:#cbd5e1;margin-bottom:14px;">접속코드를 입력해주세요. <span style="color:#64748b;">(이 기기에서 최초 1회)</span></div>'+
    '<input id="arap-access-input" type="password" autocomplete="off" style="width:200px;padding:9px 10px;font-size:16px;font-weight:700;border:1px solid #475569;border-radius:6px;background:#fff;color:#0f172a;text-align:center;font-family:inherit;">'+
    '<div id="arap-access-msg" style="height:18px;margin-top:8px;font-size:12px;color:#f87171;"></div>'+
    '<button id="arap-access-btn" type="button" style="margin-top:10px;width:100%;padding:11px;font-size:15px;font-weight:700;color:#fff;background:#2563eb;border:none;border-radius:8px;cursor:pointer;font-family:inherit;">입장</button>'+
    '</div>'+
    '<div style="margin-top:22px;font-size:12px;color:#64748b;">온결 감정평가사 전용 화면입니다. 시점수정 계산기는 <a href="arm_시점수정.html" style="color:#60a5fa;text-decoration:none;">여기</a>에서 누구나 쓸 수 있습니다.</div>'+
    '</div>';
  function mount(){
    if(!document.body){setTimeout(mount,10);return;}
    document.body.appendChild(gate);
    var input=document.getElementById("arap-access-input");
    var msg=document.getElementById("arap-access-msg");
    var tries=0;
    function done(){
      var v=(input.value||"").trim();
      if(!v){input.focus();return;}
      if(sha256(v)===ARAP_ACCESS_HASH){
        lsSet(KEY,ARAP_ACCESS_HASH);
        document.documentElement.classList.remove("arap-locked");
        gate.remove();
        var st=document.getElementById("arap-access-style");if(st)st.remove();
      }else{
        tries++;
        msg.textContent="접속코드가 맞지 않습니다.";
        input.value="";input.focus();
      }
    }
    document.getElementById("arap-access-btn").onclick=done;
    input.addEventListener("keydown",function(e){if(e.key==="Enter")done();});
    setTimeout(function(){try{input.focus();}catch(e){}},100);
  }
  mount();
})();
