/* Building standard costs: the saved opinion TSV remains the single source of truth. */
(function(){
'use strict';
var rows=(window.ARAP_BUILDING_COSTS||{}).records||[];
var source='2025년도 적용 건축물 재조달원가 자료집, 건물표준단가';
var el=function(id){return document.getElementById(id);};
function options(id,items,placeholder){
  var select=el(id);select.replaceChildren(new Option(placeholder,''));
  items.forEach(function(x){select.add(new Option(x.label,x.value));});
}
function unique(list){return Array.from(new Set(list));}
function selected(){return rows.find(function(r){return r.id===el('bc_case').value;});}
function line(r){return [r.classificationCode,r.usage,r.structure,r.grade,r.standardUnitCost.toLocaleString('ko-KR'),r.usefulLifeYears,'('+r.usefulLifeMinYears+'~'+r.usefulLifeMaxYears+')'].join('\t');}
function lines(){return el('op_costRows').value.split(/\r?\n/).filter(function(s){return s.trim();});}
function message(s){el('bc_status').textContent=s;}
function save(){el('op_costRows').dispatchEvent(new Event('input',{bubbles:true}));if(window.saveForm)saveForm();refresh();}
function add(){
  var r=selected();if(!r){message('구조·급수별 사례를 선택해 주세요.');return false;}
  var a=lines(),s=line(r);
  if(a.indexOf(s)<0){a.push(s);el('op_costRows').value=a.join('\n');}
  var input=el('op_costSource');
  if(!input.value.trim())input.value=source;
  else if(input.value.indexOf(source)<0)input.value+='; '+source;
  save();message('의견서 단가표에 추가했습니다. 같은 사례는 한 번만 포함됩니다.');return true;
}
function refresh(){
  var body=el('bc_selected');body.replaceChildren();
  lines().forEach(function(s,i){
    var tr=document.createElement('tr'),cells=s.split('\t');
    for(var j=0;j<6;j++){var td=document.createElement('td');td.textContent=cells[j]||'';if(j===5&&cells[6])td.textContent+=' '+cells[6];tr.appendChild(td);}
    var td=document.createElement('td'),btn=document.createElement('button');btn.type='button';btn.className='btn gh sm';btn.textContent='제외';btn.setAttribute('aria-label',(cells[0]||'행')+' '+(i+1)+'번째 사례 제외');
    btn.onclick=function(){var a=lines();a.splice(i,1);el('op_costRows').value=a.join('\n');save();message('의견서 단가표에서 제외했습니다. 층별 계산값은 유지됩니다.');};td.appendChild(btn);tr.appendChild(td);body.appendChild(tr);
  });
  el('bc_count').textContent=lines().length+'건 선택';
}
el('bc_category').onchange=function(){
  options('bc_usage',unique(rows.filter(function(r){return r.category===el('bc_category').value;}).map(function(r){return r.usage;})).map(function(s){return {label:s,value:s};}),'용도 선택');
  options('bc_case',[],'구조·급수별 사례 선택');el('bc_detail').textContent='';
};
el('bc_usage').onchange=function(){
  options('bc_case',rows.filter(function(r){return r.category===el('bc_category').value&&r.usage===el('bc_usage').value;}).map(function(r){return {value:r.id,label:r.structure+' · '+r.grade+'급 · '+r.standardUnitCost.toLocaleString('ko-KR')+'원/㎡ · '+r.sourcePage+'쪽'};}),'구조·급수별 사례 선택');el('bc_detail').textContent='';
};
el('bc_case').onchange=function(){var r=selected();el('bc_detail').textContent=r?r.classificationCode+' | '+r.usage+' | '+r.structure+' | '+r.grade+'급 | '+r.standardUnitCost.toLocaleString('ko-KR')+'원/㎡ | 내용연수 '+r.usefulLifeYears+'년 ('+r.usefulLifeMinYears+'~'+r.usefulLifeMaxYears+') | 원본 '+r.sourcePage+'쪽':'';};
el('bc_add').onclick=add;
el('bc_download').onclick=async function(){
  this.disabled=true;message('의견서를 만드는 중…');
  try{await window.downloadOpinion();message(el('op_status').textContent);}
  finally{this.disabled=false;}
};
el('op_costRows').addEventListener('input',refresh);
options('bc_category',unique(rows.map(function(r){return r.category;})).map(function(s){return {value:s,label:s};}),'대분류 선택');
window.ArapBuildingCost={refresh:refresh,toTsv:line};refresh();
if(!rows.length)message('단가 자료를 불러오지 못했습니다. 새로고침해 주세요.');
})();
