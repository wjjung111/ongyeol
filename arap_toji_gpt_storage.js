/* GPT 전용 저장공간. 원본 자료는 최초 1회 읽어서 복사만 하며 절대 수정하지 않는다. */
(function(){
  'use strict';
  var source='tojigeonmul-', target='tojigeonmul-gpt-', marker=target+'seeded-v1';
  try {
    if(localStorage.getItem(marker))return;
    var snapshot=[];
    for(var i=0;i<localStorage.length;i++){
      var key=localStorage.key(i);
      if(key.indexOf(source)!==0||key.indexOf(target)===0)continue;
      var dest=target+key.slice(source.length);
      if(localStorage.getItem(dest)===null)snapshot.push([dest,localStorage.getItem(key)]);
    }
    var created=[];
    try {
      snapshot.forEach(function(pair){localStorage.setItem(pair[0],pair[1]);created.push(pair[0]);});
      localStorage.setItem(marker,'1');
    } catch(error) {
      created.forEach(function(key){localStorage.removeItem(key);});
      throw error;
    }
  } catch(error) {
    document.addEventListener('DOMContentLoaded',function(){
      var note=document.createElement('div');
      note.className='note';note.setAttribute('role','status');
      note.textContent='기존 저장자료를 GPT 버전으로 복사하지 못했습니다. 기존 버전의 자료는 그대로 보존되어 있습니다. 브라우저 저장공간을 확인해 주세요.';
      var bar=document.querySelector('.casebar');if(bar)bar.after(note);
    });
  }
})();
