// 브라우저 저장공간 가득 참(QuotaExceededError) 대비 — 집합건물·토지건물·입주권이 맨 앞에서 로드(window.ArapStorage).
// localStorage.setItem 이 공간 부족으로 실패하면 그 자리에서
//   ① 다시 받으면 되는 임시 칸(시점수정 계산기 지가변동률 등)을 비우고
//   ② 그래도 모자라면 다른 건의 「이전 버전」을 오래된 것부터 하나씩 버리며
// 다시 저장한다. 저장된 건·메모·목록·토큰·템플릿은 절대 지우지 않는다.
// 끝내 못 쓰면(건·메모 저장일 때) 화면 맨 위에 빨간 띠 + 「📥 지금 내용 파일로 받기」(못 쓴 내용 그대로 .json).
// 2026-10-28 토건 ON261027-35011 저장 실패(전체 약 10MB 중 시점수정 임시 2.8MB·큰 이미지 메모 4MB) 뒤 도입. 검증 tests/storage_quota.cjs
(function(){
  if(window.ArapStorage||typeof Storage==='undefined')return;
  var proto=Storage.prototype,rawSet=proto.setItem;
  var CACHE=[/^arm-jb-rates-v\d+$/,/^arm-jb-prep-v\d+$/];                       // 다시 받으면 되는 임시 칸
  var BAK=/^(v2:|ipj:)?appraisal-bak:|^tojigeonmul-bak:/;                      // 건별 이전 버전(배열, 새 것이 앞·항목마다 t)
  var MAIN=/(^|:)case:|case-list$|^tojigeonmul-(v\d|case:|list$)|memo:/;        // 못 쓰면 사용자에게 알려야 하는 칸
  var failed={};                                                                 // 키 → 못 쓴 값(파일로 받기용)
  function isQuota(e){return e&&(e.name==='QuotaExceededError'||e.name==='NS_ERROR_DOM_QUOTA_REACHED'||e.code===22||e.code===1014);}
  function keys(st){var a=[];try{for(var i=0;i<st.length;i++)a.push(st.key(i));}catch(e){}return a;}
  function rm(st,k){try{st.removeItem(k);return true;}catch(e){return false;}}
  // 다른 건의 이전 버전 중 가장 오래된 것 하나를 버린다. 버릴 게 없으면 false
  function dropOldestBak(st,skip){
    var best=null;
    keys(st).forEach(function(k){if(k===skip||!BAK.test(k))return;
      var a;try{a=JSON.parse(st.getItem(k)||'[]');}catch(e){a=null;}
      if(!Array.isArray(a)||!a.length){rm(st,k);return;}
      var t=(a[a.length-1]||{}).t||0;if(!best||t<best.t)best={k:k,a:a,t:t};});
    if(!best)return false;
    best.a.pop();
    if(!best.a.length)return rm(st,best.k);
    try{rawSet.call(st,best.k,JSON.stringify(best.a));}catch(e){rm(st,best.k);}
    return true;
  }
  function tryOnce(st,k,v){try{rawSet.call(st,k,v);return true;}catch(e){if(!isQuota(e))throw e;return false;}}
  proto.setItem=function(k,v){
    k=String(k);v=String(v);
    var st=this;
    if(st!==window.localStorage)return rawSet.call(st,k,v);
    if(tryOnce(st,k,v)){if(failed[k]!=null){delete failed[k];render();}return;}
    // ① 임시 칸
    var freed=[];
    keys(st).forEach(function(x){if(x!==k&&CACHE.some(function(re){return re.test(x);})&&rm(st,x))freed.push(x);});
    if(freed.length&&tryOnce(st,k,v)){note(k,freed);return;}
    // ② 다른 건의 이전 버전(오래된 것부터)
    if(!BAK.test(k))for(var n=0;n<200&&dropOldestBak(st,k);n++){if(tryOnce(st,k,v)){note(k,freed.concat(['이전 버전 '+(n+1)+'개']));return;}}
    if(MAIN.test(k)){failed[k]=v;render();}
    var err;try{rawSet.call(st,k,v);}catch(e){err=e;}if(!err)return;   // 마지막 한 번(그 사이 다른 칸이 비었을 수도)
    throw err;
  };
  function note(k,what){try{console.warn('[저장공간] '+k+' 저장 위해 비움:',what.join(', '));}catch(e){}}
  // 저장공간 사용량(글자 수 → 대략 바이트×2) 큰 순서
  function usage(){var st=window.localStorage,tot=0,list=[];
    keys(st).forEach(function(k){var n=(k.length+(st.getItem(k)||'').length)*2;tot+=n;list.push([k,n]);});
    list.sort(function(a,b){return b[1]-a[1];});return {total:tot,top:list};}
  function kb(n){return n>=1048576?(n/1048576).toFixed(1)+'MB':Math.round(n/1024)+'KB';}
  function download(k){var v=failed[k];if(v==null)return;
    try{var b=new Blob([v],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(b);
      a.download='긴급백업_'+k.replace(/[\\/:*?"<>|]/g,'_')+'.json';document.body.appendChild(a);a.click();
      setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},1000);}catch(e){alert('파일로 받기 실패: '+e.message);}}
  function render(){
    if(!document.body){document.addEventListener('DOMContentLoaded',render);return;}
    var bar=document.getElementById('arap-storage-bar'),ks=Object.keys(failed);
    if(!ks.length){if(bar)bar.remove();return;}
    if(!bar){bar=document.createElement('div');bar.id='arap-storage-bar';bar.setAttribute('role','alert');
      bar.style.cssText='position:fixed;left:0;right:0;top:0;z-index:99999;background:#b91c1c;color:#fff;padding:10px 14px;font:13px/1.6 sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.3)';
      document.body.appendChild(bar);}
    var u=usage(),top=u.top.slice(0,4).map(function(x){return x[0]+' '+kb(x[1]);}).join(' · ');
    bar.innerHTML='<b>⚠️ 브라우저 저장공간이 가득 차 저장하지 못했습니다 — 이 탭을 닫거나 새로고침하지 마세요.</b> '
      +'먼저 아래 버튼으로 지금 내용을 파일로 받아 두고, 큰 이미지 메모·안 쓰는 건을 지운 뒤 칸을 아무거나 고치면 다시 저장됩니다.<br>'
      +'<span style="opacity:.85">사용 약 '+kb(u.total)+' · 큰 항목: '+top.replace(/</g,'&lt;')+'</span><br>'
      +ks.map(function(k,i){return '<button type="button" data-i="'+i+'" style="margin:6px 6px 0 0;background:#fff;color:#b91c1c;border:0;border-radius:4px;padding:4px 10px;font-weight:700;cursor:pointer">📥 지금 내용 파일로 받기 ('+k.replace(/</g,'&lt;')+')</button>';}).join('');
    Array.prototype.forEach.call(bar.querySelectorAll('button[data-i]'),function(b){b.onclick=function(){download(ks[+b.getAttribute('data-i')]);};});
  }
  // 켤 때: 기한(24시간) 지난 시점수정 임시 칸은 미리 비운다(읽을 때도 버리는 값이라 남겨 둘 이유가 없음)
  try{CACHE.forEach(function(re){keys(localStorage).forEach(function(k){if(!re.test(k))return;
    var m=/^\{"t":(\d+)/.exec((localStorage.getItem(k)||'').slice(0,40));if(!m||Date.now()-(+m[1])>24*3600*1000)rm(localStorage,k);});});}catch(e){}
  window.ArapStorage={usage:usage,failed:function(){return Object.keys(failed);},download:download};
})();
