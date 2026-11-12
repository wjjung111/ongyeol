/* arap_filebak.js — 저장건 「백업 파일」 내려받기 / 불러오기 (window.ArapFileBak)
 * - GitHub 자동 백업(arap_sync.js)과 별개의 두 번째 백업. 파일 하나(.json)를 받아 구글 드라이브 등에 직접 넣어 두는 용도.
 * - 이 주소(집합건물·입주권·토지건물·위치도 공용 저장공간)의 저장건·메모·목록·이전 버전·휴지통을 한 파일에 담는다.
 *   토큰·API 키·접속코드 통과값·사용기록 대기줄·다시 받으면 되는 임시 칸·내장 템플릿 캐시는 담지 않는다(SKIP).
 * - 불러오기: 파일에만 있는 것은 그대로 들여오고, 목록은 번호별로 합친다. 양쪽에 다 있고 내용이 다른 건은 물어본 뒤
 *   「파일 내용으로 바꾸기 / 지금 것 유지」. 지금 저장공간에만 있는 건은 건드리지 않는다(지우지 않음).
 * - 화면: ArapFileBak.mount(el) — 순수 DOM 한 줄. 집건(단일·여러 호수)·입주권은 React ref로, 토건은 #syncBar 아래에 붙인다.
 * 검증 tests/filebak.cjs
 */
(function(){
  if(window.ArapFileBak)return;
  var LAST_KEY='arap-filebak-last',WARN_DAYS=7;
  var SKIP=[/^arap-gh-/,/api-key/i,/^exact-vworld-key$/,/^arap-access/,/^arap-usage/,/^arap-filebak-/,/^arap-link/,
    /^arm-jb-(rates|prep)-v\d+$/,/^tj-rone-/,/^appraisal-tpl-(nr-)?docx/];
  var LIST=/case-list$|^tojigeonmul-list$/;          // 건 목록(배열, 항목마다 id) — 번호별로 합친다
  var CASE=/(^|[:-])case:/;                             // 건 본문
  function skip(k){return SKIP.some(function(r){return r.test(k);});}
  function get(k){try{return localStorage.getItem(k);}catch(e){return null;}}
  function set(k,v){try{localStorage.setItem(k,v);return true;}catch(e){console.error('filebak set',k,e);return false;}}
  function arr(s){try{var a=JSON.parse(s||'[]');return Array.isArray(a)?a:null;}catch(e){return null;}}
  function p2(n){return (n<10?'0':'')+n;}

  // 지금 저장공간 → 백업 객체
  function collect(){
    var data={},cases=0;
    try{for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k==null||skip(k))continue;
      var v=localStorage.getItem(k);if(v==null)continue;data[k]=v;if(CASE.test(k))cases++;}}catch(e){console.error('filebak collect',e);}
    return {app:'ongyeol-backup',ver:1,savedAt:new Date().toISOString(),cases:cases,data:data};
  }
  function fileName(d){d=d||new Date();
    return '온결백업_'+d.getFullYear()+p2(d.getMonth()+1)+p2(d.getDate())+'_'+p2(d.getHours())+p2(d.getMinutes())+'.json';}
  function download(){
    var snap=collect();
    var blob=new Blob([JSON.stringify(snap)],{type:'application/json'});
    var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=fileName();
    document.body.appendChild(a);a.click();
    setTimeout(function(){try{URL.revokeObjectURL(a.href);a.remove();}catch(e){}},1500);
    set(LAST_KEY,String(Date.now()));refresh();
    return snap;
  }

  // 백업 파일 내용과 지금 저장공간 비교 — 새로 들어올 것 / 내용이 다른 것
  function plan(snap){
    var out={ok:false,newKeys:[],diffKeys:[],newCases:0,diffCases:0,same:0};
    if(!snap||snap.app!=='ongyeol-backup'||!snap.data||typeof snap.data!=='object')return out;
    out.ok=true;
    Object.keys(snap.data).forEach(function(k){
      var v=snap.data[k];if(skip(k)||typeof v!=='string'||LIST.test(k))return;
      var cur=get(k);
      if(cur==null){out.newKeys.push(k);if(CASE.test(k))out.newCases++;}
      else if(cur===v)out.same++;
      else{out.diffKeys.push(k);if(CASE.test(k))out.diffCases++;}
    });
    return out;
  }
  // 들여오기. overwrite=true면 내용이 다른 것도 파일 내용으로 바꾼다. 돌려주는 값: 쓴 칸 수·못 쓴 칸 수
  function apply(snap,overwrite){
    var pl=plan(snap),wrote=0,failed=0;if(!pl.ok)return {ok:false,wrote:0,failed:0};
    pl.newKeys.concat(overwrite?pl.diffKeys:[]).forEach(function(k){set(k,snap.data[k])?wrote++:failed++;});
    Object.keys(snap.data).forEach(function(k){
      if(!LIST.test(k)||skip(k))return;
      var f=arr(snap.data[k]);if(!f)return;
      var cur=get(k),l=arr(cur)||[],by={},order=[];
      l.forEach(function(it){if(it&&it.id!=null){by[it.id]=it;order.push(it.id);}});
      f.forEach(function(it){if(!it||it.id==null)return;
        if(!(it.id in by)){by[it.id]=it;order.push(it.id);}else if(overwrite)by[it.id]=it;});
      var merged=order.map(function(id){return by[id];});
      merged.sort(function(a,b){return String(b.updated||'').localeCompare(String(a.updated||''));});
      var s=JSON.stringify(merged);if(s!==cur)set(k,s)?wrote++:failed++;
    });
    return {ok:true,wrote:wrote,failed:failed,plan:pl};
  }
  // 파일 고르기 → 확인 → 들여오기 → 새로고침
  function restoreFile(file){
    var rd=new FileReader();
    rd.onerror=function(){alert('파일을 읽지 못했습니다.');};
    rd.onload=function(){
      var snap=null;try{snap=JSON.parse(String(rd.result||''));}catch(e){}
      var pl=plan(snap);
      if(!pl.ok){alert('온결 백업 파일이 아닙니다.\n「백업 파일 내려받기」로 받은 온결백업_….json 파일을 골라 주세요.');return;}
      if(!pl.newKeys.length&&!pl.diffKeys.length){alert('이 파일의 내용은 이미 전부 들어 있습니다. 바뀐 것이 없습니다.');return;}
      var when=String(snap.savedAt||'').slice(0,16).replace('T',' ');
      var etc=pl.newKeys.length-pl.newCases;
      var head='백업 파일('+when+' 저장)을 불러옵니다.\n\n· 새로 들어올 건: '+pl.newCases+'건'+(etc?' (메모·이전 버전 등 '+etc+'칸 포함)':'')+
        '\n· 지금 것과 내용이 다른 건: '+pl.diffCases+'건\n· 지금 저장공간에만 있는 건은 그대로 둡니다(지우지 않음).';
      var overwrite=false;
      if(pl.diffKeys.length){
        overwrite=confirm(head+'\n\n내용이 다른 건을 어떻게 할까요?\n[확인] 파일 내용으로 바꾸기\n[취소] 지금 것 유지 (새 건만 들여옴)');
        if(!overwrite&&!pl.newKeys.length){alert('지금 것을 유지했습니다. 바뀐 것이 없습니다.');return;}
      }else if(!confirm(head+'\n\n계속할까요?'))return;
      var r=apply(snap,overwrite);
      alert((r.failed?'⚠️ '+r.failed+'칸을 쓰지 못했습니다(저장공간 부족일 수 있음). 나머지 ':'')+r.wrote+'칸을 불러왔습니다. 새로고침합니다.');
      location.reload();
    };
    rd.readAsText(file);
  }

  // ── 화면 한 줄 ──
  var mounts=[];
  function statusText(){
    var t=parseInt(get(LAST_KEY)||'0',10)||0;
    if(!t)return {warn:true,text:'아직 파일 백업을 받은 적이 없어요'};
    var d=new Date(t),days=Math.floor((Date.now()-t)/86400000);
    var when=d.getFullYear()+'.'+p2(d.getMonth()+1)+'.'+p2(d.getDate());
    if(days>=WARN_DAYS)return {warn:true,text:'마지막 파일 백업 '+days+'일 전('+when+') — 다시 받아 두세요'};
    return {warn:false,text:'마지막 파일 백업 '+when+(days?' ('+days+'일 전)':' (오늘)')};
  }
  function refresh(){mounts=mounts.filter(function(el){return el.isConnected;});
    mounts.forEach(function(el){var st=el.querySelector('.arap-filebak-st');if(!st)return;var s=statusText();
      st.textContent=s.text;st.style.color=s.warn?'#dc2626':'#64748b';});}
  function mount(el){
    if(!el||el.getAttribute('data-filebak'))return;el.setAttribute('data-filebak','1');
    var B='font-family:inherit;font-size:11px;padding:4px 10px;border-radius:4px;cursor:pointer;';
    el.innerHTML='<div class="arap-filebak" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:8px;">'+
      '<b style="font-size:12px;color:#1a2744;">💾 파일 백업</b>'+
      '<button type="button" class="arap-filebak-down" style="'+B+'background:#2563eb;color:#fff;border:1px solid #2563eb;font-weight:700;" title="집합건물·입주권·토지건물 저장건 전체를 파일 하나로 받습니다">백업 파일 내려받기</button>'+
      '<button type="button" class="arap-filebak-up" style="'+B+'background:#fff;color:#334155;border:1px solid #cbd5e1;" title="전에 받아 둔 온결백업_….json 파일을 골라 저장건을 되살립니다">백업 파일 불러오기</button>'+
      '<input type="file" class="arap-filebak-file" accept=".json,application/json" style="display:none;">'+
      '<span class="arap-filebak-st" style="font-size:11px;"></span></div>'+
      '<div style="font-size:10.5px;color:#94a3b8;margin-top:3px;">집합건물·입주권·토지건물 저장건과 메모가 파일 하나에 담겨요. 받은 파일을 구글 드라이브에 넣어 두면 GitHub 백업과 별개로 한 벌 더 남습니다. 불러오기는 토큰 없이 됩니다.</div>';
    var inp=el.querySelector('.arap-filebak-file');
    el.querySelector('.arap-filebak-down').addEventListener('click',function(){download();});
    el.querySelector('.arap-filebak-up').addEventListener('click',function(){inp.value='';inp.click();});
    inp.addEventListener('change',function(){if(inp.files&&inp.files[0])restoreFile(inp.files[0]);});
    mounts.push(el);refresh();
  }
  window.ArapFileBak={mount:mount,download:download,collect:collect,plan:plan,apply:apply,restoreFile:restoreFile,fileName:fileName,_skip:skip};
})();
