// arap_toji_upload.js — 토지건물: 공부서류(토지·건물 등기 PDF)·접수내용 캡처 업로드 → 자동 인식 (2026-11-03)
// 집합건물 ② 「공부서류 PDF 업로드」와 같은 방식: 브라우저에서 Anthropic API를 직접 부르고, 키는 집건과 같은 저장키(v2:appraisal-api-key)를 쓴다.
// 읽는 것: 접수번호·의뢰인·의뢰일·기준시점·평가구분(상속/증여만)·착수금·특용비·요율 / 소유자 / 토지 등기 필지 / 건물 등기 건물내역·도로명주소.
// 토지 필지는 읽은 주소로 「본건 토지 조회」(브이월드)를 그대로 돌려 공시지가·용도지역 등까지 채운다(조회 실패 시 등기 지목·면적만).
// 평가사 판단(탁상가격·기준시점근거·지분 사정면적)은 채우지 않고 결과 요약에 메모로만 보여 준다.
(function(root){
'use strict';
var KEY_STORAGE='v2:appraisal-api-key';   // 집건과 같은 키 — 개명 금지
var MODEL='claude-opus-4-8';

var PROMPT=[
'아래 문서들은 한국 감정평가(토지·건물) 의뢰 건의 공부서류(토지 등기사항전부증명서, 건물 등기사항전부증명서, 토지대장·토지이용계획확인원 등)와 접수내용 캡처 이미지입니다.',
'다음 정보를 추출해 JSON으로만 응답하세요. 마크다운 백틱 없이 순수 JSON만 출력합니다. 없는 값은 null(배열은 []).',
'',
'{',
'  "caseNo": "감정서번호/접수번호 (예: HI260305-2601) — 접수내용 캡처 이미지에만 있음",',
'  "client": "의뢰인 성명 — 접수내용 캡처 이미지 기준",',
'  "baseDate": "기준시점(가격시점) — 접수내용 이미지에 날짜가 명시된 경우만 YYYY.MM.DD",',
'  "evalCategory": "평가구분 — 접수내용에서 \'상속\' 또는 \'증여\'가 명확할 때만 그 한 단어. 매매·담보 등이거나 애매하면 null",',
'  "feeDownPayment": "기납부 착수금 (원 단위 숫자만, 예: 착수금 100만원 → 1000000). 접수내용 이미지에만 있음",',
'  "feeSpecial": "특별용역비(특용비) (원 단위 숫자만, \'특용비 없음\'이면 0). 접수내용 이미지에만 있음",',
'  "feeBasis": "수수료 요율 — 하한요율이면 \'하한\', 기준요율이면 \'기준\', 상한요율이면 \'상한\'. 접수내용 이미지에만 있음",',
'  "ownerLand": "토지 등기 갑구의 현재 소유자 성명(최종 소유권이전 기준, 말소된 사람 제외). 공유면 콤마로 (예: 홍길동, 김철수)",',
'  "ownerBld": "건물 등기 갑구의 현재 소유자 성명(같은 방식)",',
'  "ownerShares": "공유인 경우 현재 공유자별 지분을 원문대로 (예: 홍길동 2분의 1, 김철수 2분의 1). 단독 소유면 null",',
'  "landParcels": [{"addr":"토지 등기 표제부(토지의 표시) 소재지번 전체 주소 (예: 경기도 안양시 동안구 관양동 1443-5) — 표시번호가 여러 개면 말소되지 않은 최종 표시 기준","jimok":"지목 (예: 대)","area":"면적 ㎡ 숫자만(소수점 그대로)"}],',
'  "bldSiteAddrs": ["건물 등기 표제부(건물의 표시) 소재지번 칸의 지번 주소 전부 — 여러 필지면 각각 전체 주소로 (예: 경기도 안양시 동안구 관양동 1443-5)"],',
'  "roadAddr": "건물 등기 표제부의 도로명주소 (예: 경기도 안양시 동안구 관악대로 123). [도로명주소] 표기는 빼고 주소만",',
'  "bldRegText": "건물 등기 표제부 \'건물내역\' 칸 전체를 원문 줄바꿈(\\\\n) 그대로 — 말소되지 않은 최종 표시번호 기준. 구조·지붕·층수 줄, 용도 줄, 층별 면적 줄(예: 1층 148.26㎡)을 등기 순서·소수 자릿수 그대로. 건축물대장 값 사용 금지"',
'}',
'',
'주의사항:',
'- 접수번호·의뢰인·기준시점·평가구분·착수금·특용비·요율은 접수내용 캡처 이미지에서만 추출하고, 등기에서 추측하지 말 것. 탁상가격(예상가액)은 이미지에 있어도 절대 추출하지 말 것',
'- landParcels는 토지 등기(토지의 표시)가 여러 통이면 통마다 한 원소씩, 빠짐없이. 토지 등기가 없으면 []',
'- 등기 표제부·갑구에 밑줄(말소) 처리된 옛 내용은 쓰지 말고 현재 유효한 내용만',
'- 소유자는 \'소유자\'·\'공유자\' 기재의 성명만(주소·주민번호 제외). 소유권이 여러 번 이전됐으면 마지막 소유자',
'- 건물 등기가 없으면 bldSiteAddrs는 [], roadAddr·bldRegText는 null'
].join('\n');

// ── 순수 함수(테스트용) ──
function s(v){return v==null?'':String(v).trim();}
function digits(v){var n=String(v==null?'':v).replace(/[^0-9.]/g,'');return n;}
function dotDate(v){var m=s(v).match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);return m?m[1]+'.'+('0'+m[2]).slice(-2)+'.'+('0'+m[3]).slice(-2):'';}
// 접수번호 날짜 6자리 → 의뢰일(청구서용, 2026/03/05)
function orderDayFromCaseNo(no){var m=s(no).match(/[A-Za-z]+(\d{2})(\d{2})(\d{2})/);return m?('20'+m[1]+'/'+m[2]+'/'+m[3]):'';}
function uniqNames(list){var out=[];list.forEach(function(x){s(x).split(/\s*[,，、]\s*/).forEach(function(n){n=n.trim();if(n&&out.indexOf(n)<0)out.push(n);});});return out;}
// 주소 끝 「○○동 123-4」 / 「○○리 산12」 → {dong, jibun}
function splitAddr(addr){
  var t=s(addr).replace(/\s+외\s*\d*\s*필지\s*$/,'').split(/\s+/),jb='',dong='';
  for(var i=t.length-1;i>=0;i--){
    if(!jb&&/^산?\s*\d+(-\d+)?(번지)?$/.test(t[i])){jb=t[i].replace(/번지$/,'');if(i>0&&t[i-1]==='산'){jb='산'+jb;i--;}dong=t[i-1]||'';break;}
  }
  return {dong:dong,jibun:jb.replace(/\s+/g,'')};
}
function parcelKey(dong,jibun){return s(dong)+'|'+s(jibun).replace(/\s+/g,'').replace(/번지$/,'');}

// API 응답(JSON) → 화면에 넣을 값 묶음
function normalize(r){
  r=r||{};var notes=[];
  var ov={};
  if(s(r.caseNo))ov.ov_caseNo=s(r.caseNo);
  if(s(r.client))ov.ov_client=s(r.client);
  var od=orderDayFromCaseNo(r.caseNo);if(od)ov.ov_orderDay=od;
  var bd=dotDate(r.baseDate);if(bd)ov.base_gijun=bd;
  var ec=s(r.evalCategory);if(/^(상속|증여)$/.test(ec))ov.ov_kind=ec;
  var oL=uniqNames([r.ownerLand]),oB=uniqNames([r.ownerBld]),owners=uniqNames([r.ownerLand,r.ownerBld]);
  if(owners.length)ov.ov_owner=owners.join(', ');
  if(oL.length&&oB.length&&oL.slice().sort().join()!==oB.slice().sort().join())notes.push('⚠️ 토지 소유자('+oL.join(', ')+')와 건물 소유자('+oB.join(', ')+')가 다릅니다 — 소유자 칸에 둘 다 넣었으니 확인하세요.');
  if(s(r.ownerShares))notes.push('ℹ️ 공유 지분: '+s(r.ownerShares)+' — 지분 평가면 본건 토지·건물 표의 사정면적 「지분입력」으로 넣으세요(자동 반영 안 함).');
  var cg={};
  var dp=digits(r.feeDownPayment);if(dp!=='')cg.cg_downPayment=Number(dp).toLocaleString('ko-KR');
  var sp=digits(r.feeSpecial);if(sp!==''){cg.cg_specialMode='직접입력';cg.cg_special=Number(sp).toLocaleString('ko-KR');}
  var fb=s(r.feeBasis).replace(/요율$/,'');if(/^(하한|기준|상한)$/.test(fb))cg.cg_feeBasis=fb;
  var parcels=[],seen={};
  (Array.isArray(r.landParcels)?r.landParcels:[]).forEach(function(p){if(!p)return;var a=splitAddr(p.addr);if(!a.jibun)return;var k=parcelKey(a.dong,a.jibun);if(seen[k])return;seen[k]=1;
    parcels.push({addr:s(p.addr).replace(/\s+외\s*\d*\s*필지\s*$/,''),dong:a.dong,jibun:a.jibun,jimok:s(p.jimok),area:digits(p.area),src:'토지등기'});});
  if(!parcels.length)(Array.isArray(r.bldSiteAddrs)?r.bldSiteAddrs:[]).forEach(function(addr){var a=splitAddr(addr);if(!a.jibun)return;var k=parcelKey(a.dong,a.jibun);if(seen[k])return;seen[k]=1;
    parcels.push({addr:s(addr),dong:a.dong,jibun:a.jibun,jimok:'',area:'',src:'건물등기'});});
  var bt={};
  if(s(r.bldRegText))bt.bt_regText=String(r.bldRegText).replace(/\r/g,'').replace(/\\n/g,'\n').trim();
  if(s(r.roadAddr))bt.bt_roadAddr=s(r.roadAddr).replace(/^\[?도로명주소\]?\s*/,'');
  return {ov:ov,cg:cg,bt:bt,parcels:parcels,notes:notes};
}
// 본건 토지 표(LANDS)와 읽은 필지 대조 → 'replace'(다른 물건 — 표를 새로) | 'add'(빠진 필지만 추가)
function planParcels(lands,parcels){
  var have=(lands||[]).filter(function(L){return L&&!L.sub&&s(L['지번']);});
  var keys=have.map(function(L){return parcelKey(L['소재지'],L['지번']);});
  var missing=parcels.filter(function(p){return keys.indexOf(parcelKey(p.dong,p.jibun))<0;});
  var mode=!parcels.length?'none':(have.length&&missing.length===parcels.length)?'replace':'add';
  return {mode:mode,add:mode==='replace'?parcels.slice():missing,existing:have.length};
}

var API={PROMPT:PROMPT,normalize:normalize,planParcels:planParcels,splitAddr:splitAddr,orderDayFromCaseNo:orderDayFromCaseNo,KEY_STORAGE:KEY_STORAGE};
root.ArapTojiUpload=API;
if(typeof module!=='undefined'&&module.exports)module.exports=API;
if(typeof document==='undefined'||!document.getElementById('upCard'))return;

// ── 화면 ──
var $=function(id){return document.getElementById(id);};
var FILES=[],BUSY=false;
function getApiKey(){try{return localStorage.getItem(KEY_STORAGE)||'';}catch(e){return '';}}
function setApiKey(k){try{localStorage.setItem(KEY_STORAGE,k);}catch(e){}}
function keyState(){$('up_keyState').innerHTML=getApiKey()?'<span style="color:#059669">✅</span>':'<span style="color:#f59e0b">⚠️ 필요</span>';}
function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;');}
function renderFiles(){
  $('up_list').innerHTML=FILES.map(function(f,i){return '<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 10px;background:#fff;border:1px solid #ddd;border-radius:12px;font-size:11px">📎 '+esc(f.name)+
    ' <span class="del" data-i="'+i+'" style="cursor:pointer;color:#dc2626;font-weight:700" title="빼기">✕</span></span>';}).join('');
  $('up_run').disabled=BUSY||!FILES.length;
}
function addFiles(list){
  if(BUSY)return;var inc=Array.prototype.slice.call(list||[]),ok=inc.filter(function(f){return /\.(pdf|png|jpe?g|webp)$/i.test(f.name);});
  status(ok.length<inc.length?'PDF, PNG, JPG, WEBP 파일만 추가할 수 있습니다.':'',ok.length<inc.length);
  FILES=FILES.concat(ok);renderFiles();
}
function status(t,err){var el=$('up_status');el.className='status'+(err?' err':'');el.textContent=t||'';}
function toB64(f){return new Promise(function(res,rej){var r=new FileReader();r.onload=function(){res(String(r.result).split(',')[1]);};r.onerror=function(){rej(new Error('파일 읽기 실패: '+f.name));};r.readAsDataURL(f);});}

async function recognize(files){
  var key=getApiKey();if(!key)throw new Error('API 키가 없습니다. 위 🔑 칸에 Anthropic API 키를 넣으세요(집합건물과 같은 키).');
  var content=[];
  for(var i=0;i<files.length;i++){var f=files[i],b=await toB64(f);
    if(/^image\//.test(f.type)||/\.(png|jpe?g|webp)$/i.test(f.name)){var mt=f.type||('image/'+(/\.png$/i.test(f.name)?'png':/\.webp$/i.test(f.name)?'webp':'jpeg'));content.push({type:'image',source:{type:'base64',media_type:mt,data:b}});}
    else content.push({type:'document',source:{type:'base64',media_type:'application/pdf',data:b}});}
  content.push({type:'text',text:PROMPT});
  var resp;
  for(var a=1;a<=4;a++){
    resp=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({model:MODEL,max_tokens:8192,messages:[{role:'user',content:content}]})});
    if(resp.status===529&&a<4){status('서버가 바빠 '+(a*8)+'초 뒤 다시 시도합니다…');await new Promise(function(r){setTimeout(r,a*8000);});continue;}
    break;
  }
  if(!resp.ok){var t=await resp.text().catch(function(){return '';});throw new Error('API 오류 '+resp.status+': '+t.slice(0,200));}
  var data=await resp.json();if(data.error)throw new Error('API 응답 오류: '+(data.error.message||JSON.stringify(data.error)));
  var text=(data.content||[]).map(function(c){return c.type==='text'?c.text:'';}).join('');
  if(!text)throw new Error('API 응답이 비어 있습니다.');
  var clean=text.replace(/```json|```/g,'').trim(),m=clean.match(/\{[\s\S]*\}/);
  try{return JSON.parse(m?m[0]:clean);}catch(e){throw new Error('JSON 해석 실패: '+clean.slice(0,200));}
}

function mark(el){if(!el)return;el.classList.add('up-auto');}
function setField(id,v){var el=$(id);if(!el)return false;
  if(el.tagName==='SELECT'&&![].some.call(el.options,function(o){return o.value===v;}))return false;
  el.value=v;mark(el);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));return true;}
// 손으로 고치면 연노랑 표시를 지운다
document.addEventListener('input',function(e){if(e.isTrusted&&e.target&&e.target.classList)e.target.classList.remove('up-auto');},true);

var LABEL={ov_caseNo:'접수번호',ov_client:'의뢰인',ov_orderDay:'의뢰일',base_gijun:'기준시점',ov_kind:'평가구분',ov_owner:'소유자',
  cg_downPayment:'기납부착수금',cg_special:'특별용역비',cg_feeBasis:'수수료 요율',cg_specialMode:null,bt_regText:'건물등기 건물내역',bt_roadAddr:'도로명주소'};

async function apply(n){
  var done=[],notes=n.notes.slice();
  Object.keys(n.ov).forEach(function(id){if(setField(id,n.ov[id]))done.push(LABEL[id]+' '+n.ov[id]);});
  ['cg_specialMode','cg_special','cg_downPayment','cg_feeBasis'].forEach(function(id){if(n.cg[id]==null)return;if(setField(id,n.cg[id])&&LABEL[id])done.push(LABEL[id]+' '+n.cg[id]+(id==='cg_feeBasis'?'요율':''));});
  if(typeof CG_SPECIAL_MANUAL!=='undefined'&&n.cg.cg_special!=null)try{CG_SPECIAL_MANUAL=false;}catch(e){}
  if(n.bt.bt_regText){setField('bt_regText',n.bt.bt_regText);done.push('건물등기 건물내역');}
  if(n.bt.bt_roadAddr){setField('bt_roadAddr',n.bt.bt_roadAddr);done.push('도로명주소 '+n.bt.bt_roadAddr);}
  if(n.ov.ov_caseNo)notes.unshift('💾 접수번호는 위 「💾 저장」을 눌러야 확정·저장이 시작됩니다.');
  // 토지 필지
  var plan=planParcels(LANDS,n.parcels);
  if(plan.mode==='replace'){
    var cur=LANDS.filter(function(L){return L&&!L.sub&&s(L['지번']);}).map(function(L){return s(L['소재지'])+' '+s(L['지번']);}).join(', ');
    if(confirm('본건 토지 표의 필지('+cur+')가 등기 필지('+n.parcels.map(function(p){return p.dong+' '+p.jibun;}).join(', ')+')와 다릅니다.\n\n본건 토지 표를 등기 필지로 새로 채울까요?\n(취소하면 표는 그대로 두고 등기 필지를 뒤에 추가하지 않습니다)')){
      SAJ_MODE.land='direct';GROUP_AREA='';ILDANJI=false;GZONES=[];GROUP_SHARE='';LANDS=[{}];renderLands();
    }else plan.add=[];
  }
  var nOk=0,fail=[];
  for(var i=0;i<plan.add.length;i++){var p=plan.add[i];
    status('본건 토지 조회 중… ('+(i+1)+'/'+plan.add.length+') '+p.addr);
    try{var out=await queryParcel(p.addr,getKey());var v=extract(out);var idx=landFromQuery(v,out);nOk++;
      var L=LANDS[idx];if(p.area&&L&&Math.abs(num(L['면적'])-num(p.area))>0.0001)notes.push('⚠️ '+p.dong+' '+p.jibun+' 면적: 토지대장(조회) '+L['면적']+'㎡ ↔ 등기 '+p.area+'㎡ — 표엔 토지대장 값이 들어갔습니다.');
    }catch(e){console.warn('등기 필지 조회 실패',p.addr,e);
      var j=fillOrPush(LANDS,LAND_COLS,{소재지:p.dong,지번:p.jibun,지목:p.jimok,면적:p.area,비고:'-'});LANDS[j].fullAddr=p.addr;
      if(isLandGroup())recalcGroupArea();renderLands();calcGongsi();saveForm();sd();
      fail.push(p.dong+' '+p.jibun);}
  }
  if(plan.add.length)done.push('본건 토지 '+plan.add.length+'필지'+(n.parcels[0]&&n.parcels[0].src==='건물등기'?'(건물등기 소재지번)':'')+(fail.length?' (조회 실패 '+fail.length+')':''));
  else if(n.parcels.length&&plan.mode==='add')done.push('본건 토지 — 등기 필지가 이미 표에 다 있음');
  if(fail.length)notes.push('⚠️ 토지 조회 실패: '+fail.join(', ')+' — 등기의 지목·면적만 넣었습니다. 「조회」로 다시 불러오세요.');
  // 건물: 표가 비어 있고 건물을 평가하는 건이면 건축물대장도 바로 불러온다
  var bldEmpty=typeof bldRows==='function'&&!bldRows().some(function(r){return s(r['연면적'])||s(r['층별']);});
  if(n.bt.bt_regText&&bldEmpty&&typeof evalKind==='function'&&evalKind()!=='land'&&LANDS.some(function(L){return L.pnu;})){
    try{fetchBuilding();done.push('건축물대장 불러오기 시작');}catch(e){console.warn(e);}
  }
  try{if(window.ArapTojiDocuments&&ArapTojiDocuments.regHint)ArapTojiDocuments.regHint();}catch(e){}
  saveForm();sd();try{renderCaseBar();}catch(e){}
  return {done:done,notes:notes};
}

async function run(){
  if(!FILES.length){status('파일을 먼저 추가하세요.',true);return;}
  BUSY=true;renderFiles();$('up_run').textContent='🔄 인식 중…';$('up_result').innerHTML='';status('문서를 읽는 중입니다… (보통 20~60초)');
  try{
    var r=await recognize(FILES);var n=normalize(r);var res=await apply(n);
    status('✅ 인식 완료 — 연노랑 칸은 자동으로 채운 값이니 확인하세요.');
    $('up_result').innerHTML=(res.done.length?'<div><b>채운 칸</b> · '+res.done.map(esc).join(' · ')+'</div>':'<div>채울 값을 찾지 못했습니다.</div>')+
      res.notes.map(function(t){return '<div>'+esc(t)+'</div>';}).join('');
  }catch(e){console.error('자동 인식',e);status('인식 실패: '+e.message,true);}
  finally{BUSY=false;$('up_run').textContent='🤖 자동 인식';renderFiles();}
}

$('up_apiKey').value=getApiKey();keyState();
$('up_apiKey').addEventListener('input',function(){setApiKey(this.value.trim());keyState();});
$('up_keyShow').onclick=function(){var k=$('up_apiKey');k.type=k.type==='password'?'text':'password';this.textContent=k.type==='password'?'보기':'숨김';};
$('up_files').addEventListener('change',function(){addFiles(this.files);this.value='';});
$('up_list').addEventListener('click',function(e){var t=e.target.closest('[data-i]');if(!t||BUSY)return;FILES.splice(+t.getAttribute('data-i'),1);renderFiles();});
$('up_run').onclick=run;
var card=$('upCard'),depth=0;
card.addEventListener('dragenter',function(e){if([].indexOf.call(e.dataTransfer.types||[],'Files')<0)return;e.preventDefault();depth++;card.classList.add('drag');$('up_dropHint').textContent='여기에 놓으면 파일이 추가됩니다';});
card.addEventListener('dragleave',function(e){e.preventDefault();depth=Math.max(0,depth-1);if(!depth){card.classList.remove('drag');$('up_dropHint').textContent='PDF·이미지를 이 칸에 끌어다 놓거나 Ctrl+V로 붙여넣어도 됩니다';}});
card.addEventListener('dragover',function(e){if([].indexOf.call(e.dataTransfer.types||[],'Files')<0)return;e.preventDefault();e.dataTransfer.dropEffect=BUSY?'none':'copy';});
card.addEventListener('drop',function(e){if(!e.dataTransfer.files||!e.dataTransfer.files.length)return;e.preventDefault();depth=0;card.classList.remove('drag');$('up_dropHint').textContent='PDF·이미지를 이 칸에 끌어다 놓거나 Ctrl+V로 붙여넣어도 됩니다';addFiles(e.dataTransfer.files);});
// Ctrl+V로 캡처 이미지 붙여넣기(2026-11-13, 집건과 같은 규칙) — 업로드 칸이 보일 때만, 다른 입력칸에 커서가 있으면 가로채지 않음
var pasteSeq=0,pasteTm=null;
document.addEventListener('paste',function(e){
  if(!card.offsetParent||BUSY)return;
  var t=e.target,inBox=!!(t&&card.contains(t));
  if(t&&!inBox&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT'||t.isContentEditable))return;
  var fs=[].slice.call((e.clipboardData&&e.clipboardData.files)||[]).filter(function(f){return /^image\/(png|jpe?g|webp)$/.test(f.type)||f.type==='application/pdf';});
  if(!fs.length)return;
  e.preventDefault();
  var d=new Date(),hm=('0'+d.getHours()).slice(-2)+('0'+d.getMinutes()).slice(-2)+('0'+d.getSeconds()).slice(-2);
  addFiles(fs.map(function(f){var ext=f.type==='application/pdf'?'pdf':f.type==='image/jpeg'?'jpg':f.type.split('/')[1];pasteSeq++;return new File([f],'붙여넣은캡처_'+hm+(pasteSeq>1?'_'+pasteSeq:'')+'.'+ext,{type:f.type});}));
  $('up_dropHint').textContent='📋 붙여넣은 이미지 '+fs.length+'개를 추가했습니다';clearTimeout(pasteTm);
  pasteTm=setTimeout(function(){$('up_dropHint').textContent='PDF·이미지를 이 칸에 끌어다 놓거나 Ctrl+V로 붙여넣어도 됩니다';},4000);
});
API._apply=apply;API._addFiles=addFiles;
})(typeof window!=='undefined'?window:globalThis);
