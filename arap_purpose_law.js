/* arap_purpose_law.js — 의견서 「1. 감정평가의 목적」 근거법을 평가목적에 맞추기 (2026-11-15)
 * 템플릿 고정 문구: 「…으로서, 「상속세 및 증여세법」상 {{평가구분}} 재산에 대한 {{평가목적}} 목적의 감정평가임.」
 * 평가목적에 「자산재평가」가 들어가면 → 「…으로서, {{근거법령}}상 {{재평가대상}}에 대한 {{평가목적}} 목적의 감정평가임.」
 *   {{근거법령}} = 「주식회사 등의 외부감사에 관한 법률」, {{재평가대상}} = 유형자산 — 토큰으로 넣어 다른 입력값처럼 검토 색(토건 빨강)이 붙게 함
 *   각 엔진은 토큰 값으로 arapPurposeLaw.VALUES를 맵에 더한다. 평가구분(「일반시가」 등 상속·증여세 개념)은 같이 뺌. 사용자 결정(미결 A12).
 * 평가목적이나 평가구분에 「담보」가 들어가면 → 「…으로서, {{담보목적}} 목적의 감정평가임.」({{담보목적}} = 담보, {{평가목적}} 런 글자모양)
 *   상증세법·평가구분·「재산에 대한」·평가목적을 통째로 뺀다(2026-11-16 사용자 「담보면 상속/증여가 아니라」). 자산재평가가 먼저.
 * arapPurposeDoc(평가목적,평가구분) = 서류에 찍을 평가목적(평가구분 담보 + 평가목적 기본값 → 담보). 각 엔진이 「평가목적」 값으로 씀.
 * 그 밖의 평가목적은 손대지 않는다. 토큰 치환 전 section XML 문자열에 쓴다.
 *   양식 두 가지: 토큰마다 런이 나뉜 것(토건 3종·집건 여러 호수 — 토큰 런 글자모양을 그대로 빌림) / 한 런 안에 다 있는 것(집건 단일)
 * 쓰는 곳: arap_toji_opinion.js(토건 3종), s3r86w8a.html buildEvalHwpxV2(집건 단일), arap_multi_hwpx.js(집건 여러 호수)
 */
(function(g){
  var RE=/「상속세 및 증여세법」상\s*(?:<\/hp:t><\/hp:run><hp:run([^>]*)><hp:t>)?\{\{평가구분\}\}(?:<\/hp:t><\/hp:run><hp:run([^>]*)><hp:t>)?\s*재산에 대한\s*/g;
  var SEP='(?:<\\/hp:t><\\/hp:run><hp:run([^>]*)><hp:t>)?';
  var RE_LOAN=new RegExp('「상속세 및 증여세법」상\\s*'+SEP+'\\{\\{평가구분\\}\\}'+SEP+'\\s*재산에 대한\\s*'+SEP+'\\{\\{평가목적\\}\\}','g');
  var VALUES={'근거법령':'「주식회사 등의 외부감사에 관한 법률」','재평가대상':'유형자산','담보목적':'담보'};
  function isAudit(purpose){return /자산\s*재평가/.test(String(purpose||''));}
  function isLoan(purpose,category){return !isAudit(purpose)&&/담보/.test(String(purpose||'')+' '+String(category||''));}
  function apply(xml,purpose,category){
    if(isLoan(purpose,category))return String(xml).replace(RE_LOAN,function(m,a,b,c){
      return c?'</hp:t></hp:run><hp:run'+c+'><hp:t>{{담보목적}}':'{{담보목적}}';});
    if(!isAudit(purpose))return xml;
    return String(xml).replace(RE,function(m,tok,txt){
      if(tok&&txt){var T='</hp:t></hp:run><hp:run'+tok+'><hp:t>',N='</hp:t></hp:run><hp:run'+txt+'><hp:t>';
        return T+'{{근거법령}}'+N+'상 '+T+'{{재평가대상}}'+N+'에 대한 ';}
      return '{{근거법령}}상 {{재평가대상}}에 대한 ';
    });
  }
  // 서류에 찍을 평가목적 — 평가구분에 「담보」가 있고 평가목적이 비었거나 기본값(일반거래(시가참고))이면 「담보」(2026-11-16 사용자 결정:
  // 평가구분=담보면 평가목적도 담보 — 표지·괄감·의견서 목적 문장·6. 그 밖의 사항이 서로 맞게). dflt = 비었을 때 값(기본 일반거래(시가참고))
  function purposeDoc(purpose,category,dflt){var p=String(purpose||'').trim();
    if(/담보/.test(String(category||''))&&(!p||p==='일반거래(시가참고)'))return '담보';
    return p||(dflt==null?'일반거래(시가참고)':dflt);}
  // 「6. 그 밖의 사항」 「담보나 소송 등 다른 목적」 — 평가목적이 담보·소송이면 그 말을 빼고 일반거래로(arap_etc_items.js otherUse와 같은 규칙)
  function otherUse(purpose){var p=String(purpose||'');if(/담보/.test(p))return '일반거래나 소송 등';if(/소송/.test(p))return '담보나 일반거래 등';return '담보나 소송 등';}
  g.arapPurposeDoc=purposeDoc;apply.purposeDoc=purposeDoc;apply.otherUse=otherUse;
  g.arapPurposeLaw=apply;apply.isAudit=isAudit;apply.isLoan=isLoan;apply.VALUES=VALUES;
})(typeof window!=='undefined'?window:globalThis);
