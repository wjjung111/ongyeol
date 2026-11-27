/*
  온결 사용자 차단 (arap_block.js) — 관리자가 지정한 사람만 화면을 못 쓰게 막는다.
  - 판정: ① 저장된 사용자 이름(arap-user-name) ② 접속 IP — 둘 중 하나라도 목록에 있으면 차단.
  - 이름·IP는 원문을 두지 않고 해시(SHA-256, 앞에 'arap-block|')만 둔다(공개 주소라 소스를 누구나 볼 수 있음).
    해시 만들기:  node -e 'console.log(require("crypto").createHash("sha256").update("arap-block|"+"이름또는IP").digest("hex"))'
  - 한 번 걸리면 그 브라우저에 표시(arap-blk)를 남겨, 이름을 바꾸거나 다른 망(휴대폰 데이터)으로 들어와도 계속 차단.
    목록에서 지우면 표시도 다음 접속 때 저절로 풀린다.
  - IP 판정은 페이지가 IP를 알아낸 뒤  window.arapBlockIp(ip)  로 부른다(arm_시점수정.html 접속 기록 쪽).
  - 차단되면 window.arapVisitLog('차단', ...)으로 관리자 수신함 '접속' 탭에 한 줄 남긴다.
  - 사용: <body> 바로 다음, arap_name.js 앞에  <script src="arap_block.js"></script>
*/
(function(){
  var NAMES=[
    '24c83d5643779d52895aa44403b7e88184c96524e2078b108ad1361e9b1dd53d'   // 2026-11-27 관리자 지정
  ];
  var IPS=[
    '3a6a8f339c829b57af74eff62d42b8cf746d25d471e25ea2bb1e280d553d15ba'   // 2026-11-27 관리자 지정(위 사람의 IP, 9월부터 같은 값)
  ];
  var FLAG='arap-blk';
  function lsGet(k){try{return localStorage.getItem(k);}catch(e){return null;}}
  function lsSet(k,v){try{localStorage.setItem(k,v);}catch(e){}}
  function lsDel(k){try{localStorage.removeItem(k);}catch(e){}}
  function hash(s){
    try{
      if(!(window.crypto&&crypto.subtle&&window.TextEncoder))return Promise.resolve('');
      return crypto.subtle.digest('SHA-256',new TextEncoder().encode('arap-block|'+s)).then(function(b){
        return Array.prototype.map.call(new Uint8Array(b),function(x){return ('0'+x.toString(16)).slice(-2);}).join('');
      }).catch(function(){return '';});
    }catch(e){return Promise.resolve('');}
  }
  function normName(s){return String(s||'').replace(/\s+/g,'');}

  var blocked=false;
  function showBlock(){
    if(document.getElementById('arap-block')) return;
    var g=document.getElementById('arap-name-gate');if(g)g.remove();
    var d=document.createElement('div');
    d.id='arap-block';
    d.style.cssText='position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;background:#f8fafc;font-family:Pretendard,"Malgun Gothic","Apple SD Gothic Neo",sans-serif;color:#0f172a;text-align:center;';
    d.innerHTML='<div style="max-width:360px"><div style="font-size:40px;margin-bottom:14px">🔒</div>'+
      '<div style="font-size:20px;font-weight:800;margin-bottom:10px">사용할 수 없는 페이지입니다</div>'+
      '<div style="font-size:14px;color:#64748b;line-height:1.6">이 기기에서는 접근이 제한되었습니다.</div></div>';
    document.documentElement.style.overflow='hidden';
    (document.body||document.documentElement).appendChild(d);
  }
  function block(key){
    if(blocked) return;
    blocked=true;
    lsSet(FLAG,key);
    function go(){showBlock();}
    if(document.body)go();else document.addEventListener('DOMContentLoaded',go);
    // 관리자 기록(접속 기록 함수가 준비된 뒤)
    var tries=0;(function log(){
      if(typeof window.arapVisitLog==='function'){try{window.arapVisitLog('차단',key.split(':')[0]==='ip'?'IP 일치':'이름 일치');}catch(e){}return;}
      if(++tries<50)setTimeout(log,200);
    })();
  }
  window.arapIsBlocked=function(){return blocked;};

  // ① 이전에 걸린 브라우저 — 표시가 아직 목록에 있으면 즉시 차단, 목록에서 빠졌으면 표시 지움
  var f=lsGet(FLAG);
  if(f){
    var kind=f.split(':')[0],h=f.slice(kind.length+1);
    if((kind==='name'&&NAMES.indexOf(h)>=0)||(kind==='ip'&&IPS.indexOf(h)>=0))block(f);
    else lsDel(FLAG);
  }
  // ② 저장된 이름
  function checkName(n){
    n=normName(n);if(!n||blocked)return;
    hash(n).then(function(h){if(h&&NAMES.indexOf(h)>=0)block('name:'+h);});
  }
  checkName(lsGet('arap-user-name'));
  // 이름을 새로 적었을 때도 확인(arap_name.js가 뒤에 로드됨)
  var poll=0;(function hook(){
    if(typeof window.arapNameReady==='function'){window.arapNameReady(checkName);return;}
    if(++poll<100)setTimeout(hook,50);
  })();
  // ③ IP — 페이지가 IP를 알아낸 뒤 부른다
  window.arapBlockIp=function(ip){
    ip=String(ip||'').trim();if(!ip||blocked)return;
    hash(ip).then(function(h){if(h&&IPS.indexOf(h)>=0)block('ip:'+h);});
  };
})();
