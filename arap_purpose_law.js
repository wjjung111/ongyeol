/* arap_purpose_law.js — 의견서 「1. 감정평가의 목적」 근거법을 평가목적에 맞추기 (2026-11-15)
 * 템플릿 고정 문구: 「…으로서, 「상속세 및 증여세법」상 {{평가구분}} 재산에 대한 {{평가목적}} 목적의 감정평가임.」
 * 평가목적에 「자산재평가」가 들어가면 → 「…으로서, {{근거법령}}상 {{재평가대상}}에 대한 {{평가목적}} 목적의 감정평가임.」
 *   {{근거법령}} = 「주식회사 등의 외부감사에 관한 법률」, {{재평가대상}} = 유형자산 — 토큰으로 넣어 다른 입력값처럼 검토 색(토건 빨강)이 붙게 함
 *   각 엔진은 토큰 값으로 arapPurposeLaw.VALUES를 맵에 더한다. 평가구분(「일반시가」 등 상속·증여세 개념)은 같이 뺌. 사용자 결정(미결 A12).
 * 그 밖의 평가목적은 손대지 않는다. 토큰 치환 전 section XML 문자열에 쓴다.
 *   양식 두 가지: 토큰마다 런이 나뉜 것(토건 3종·집건 여러 호수 — 토큰 런 글자모양을 그대로 빌림) / 한 런 안에 다 있는 것(집건 단일)
 * 쓰는 곳: arap_toji_opinion.js(토건 3종), s3r86w8a.html buildEvalHwpxV2(집건 단일), arap_multi_hwpx.js(집건 여러 호수)
 */
(function(g){
  var RE=/「상속세 및 증여세법」상\s*(?:<\/hp:t><\/hp:run><hp:run([^>]*)><hp:t>)?\{\{평가구분\}\}(?:<\/hp:t><\/hp:run><hp:run([^>]*)><hp:t>)?\s*재산에 대한\s*/g;
  var VALUES={'근거법령':'「주식회사 등의 외부감사에 관한 법률」','재평가대상':'유형자산'};
  function isAudit(purpose){return /자산\s*재평가/.test(String(purpose||''));}
  function apply(xml,purpose){
    if(!isAudit(purpose))return xml;
    return String(xml).replace(RE,function(m,tok,txt){
      if(tok&&txt){var T='</hp:t></hp:run><hp:run'+tok+'><hp:t>',N='</hp:t></hp:run><hp:run'+txt+'><hp:t>';
        return T+'{{근거법령}}'+N+'상 '+T+'{{재평가대상}}'+N+'에 대한 ';}
      return '{{근거법령}}상 {{재평가대상}}에 대한 ';
    });
  }
  g.arapPurposeLaw=apply;apply.isAudit=isAudit;apply.VALUES=VALUES;
})(typeof window!=='undefined'?window:globalThis);
