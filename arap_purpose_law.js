/* arap_purpose_law.js — 의견서 「1. 감정평가의 목적」 근거법을 평가목적에 맞추기 (2026-11-15)
 * 템플릿 고정 문구: 「…으로서, 「상속세 및 증여세법」상 {{평가구분}} 재산에 대한 {{평가목적}} 목적의 감정평가임.」
 * 평가목적에 「자산재평가」가 들어가면 → 「…으로서, 「주식회사 등의 외부감사에 관한 법률」상 유형자산에 대한 {{평가목적}} 목적의 감정평가임.」
 *   (평가구분 「일반시가」 등은 상속·증여세 개념이라 같이 뺌. 사용자 결정, 미결 A12)
 * 그 밖의 평가목적은 손대지 않는다. 토큰 치환 전 section XML 문자열에 쓴다(문구가 런 여러 개로 나뉜 양식도 처리).
 * 쓰는 곳: arap_toji_opinion.js(토건 3종), s3r86w8a.html buildEvalHwpxV2(집건 단일), arap_multi_hwpx.js(집건 여러 호수)
 */
(function(g){
  var RUN='(?:</hp:t></hp:run><hp:run[^>]*><hp:t>)?';
  var RE=new RegExp('「상속세 및 증여세법」상\\s*'+RUN+'\\{\\{평가구분\\}\\}'+RUN+'\\s*재산에 대한\\s*','g');
  var LAW='「주식회사 등의 외부감사에 관한 법률」상 유형자산에 대한 ';
  function isAudit(purpose){return /자산\s*재평가/.test(String(purpose||''));}
  function apply(xml,purpose){return isAudit(purpose)?String(xml).replace(RE,LAW):xml;}
  g.arapPurposeLaw=apply;g.arapPurposeLaw.isAudit=isAudit;g.arapPurposeLaw.LAW=LAW;
})(typeof window!=='undefined'?window:globalThis);
