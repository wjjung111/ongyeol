/**
 * 온결 v1.0 — 관리자 사용기록 수신함 (구글 앱스 스크립트)
 *
 * 하는 일
 *  - 앱(집합건물.html)이 보낸 건 요약을 구글 시트에 한 줄씩 쌓는다.
 *  - 관리자.html이 비밀번호를 들고 오면 시트 전체를 JSON으로 돌려준다.
 *
 * 설치·배포 방법은 문서/관리자_수신함_설정.md 참고.
 * 비밀번호는 이 파일에 쓰지 말고 스크립트 속성(ADMIN_PW)에 넣는다.
 */

var SHEET_NAME = '기록';
var HEADER = ['시각', '사용자', '접수번호', '물건', '유형', '시산가액', '동작'];
// 시점수정 페이지 접속 기록 — 별도 탭. IP·지역은 브라우저가 IP 조회 서비스에서 받아 보낸 값(앱스 스크립트는 접속자 IP를 알 수 없음)
var VISIT_SHEET = '접속';
var VISIT_HEADER = ['시각', '사용자', '페이지', '동작', '기기', '브라우저', 'IP', '지역', '통신사', '상세'];

function _sheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  // '기록' 탭이 없으면: 시트가 하나뿐인 문서면 그걸 그대로 쓰고(기존 데이터 보존), 여러 개면 새로 만든다
  if (!sh) {
    var all = ss.getSheets();
    sh = (all.length === 1) ? all[0] : ss.insertSheet(SHEET_NAME);
  }
  if (sh.getLastRow() === 0) sh.appendRow(HEADER);
  return sh;
}

function _visitSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(VISIT_SHEET) || ss.insertSheet(VISIT_SHEET);
  if (sh.getLastRow() === 0) sh.appendRow(VISIT_HEADER);
  return sh;
}

/** 접속 기록 한 줄 추가 (?visit=1&page=...&...) */
function _writeVisit(p) {
  var page = String(p.page || '').trim();
  if (!page) return { ok: false, error: '페이지 없음' };
  _visitSheet().appendRow([
    new Date(),
    String(p.user || ''),
    page,
    String(p.action || ''),
    String(p.device || ''),
    String(p.browser || ''),
    String(p.ip || ''),
    String(p.region || ''),
    String(p.isp || ''),
    String(p.detail || '')
  ]);
  return { ok: true };
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function _adminPw() {
  return PropertiesService.getScriptProperties().getProperty('ADMIN_PW') || '';
}

/** 기록 한 줄 추가 */
function _write(p) {
  var caseNo = String(p.caseNo || '').trim();
  if (!caseNo) return { ok: false, error: '접수번호 없음' };
  if (/^SAMPLE/i.test(caseNo)) return { ok: true, skipped: '샘플 건' };
  _sheet().appendRow([
    new Date(),
    String(p.user || ''),
    caseNo,
    String(p.addr || ''),
    String(p.kind || ''),
    String(p.amount || ''),
    String(p.action || '')
  ]);
  return { ok: true };
}

/**
 * GET — 네 가지 용도
 *  ?ping=1            연결 점검 (관리자.html의 '연결 점검' 버튼)
 *  ?caseNo=...&...    기록 전송 (앱). 응답을 읽을 수 있어야 앱이 성공 여부를 안다.
 *  ?visit=1&page=...  접속 기록 전송 (시점수정 페이지 등) → '접속' 탭
 *  ?pw=...            기록 조회 (관리자.html). 비밀번호 틀리면 빈 배열.
 *  ?pw=...&sheet=접속 접속 기록 조회 (관리자.html '시점수정 접속' 탭)
 */
function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    if (p.ping) return _json({ ok: true, rows: Math.max(0, _sheet().getLastRow() - 1), visits: Math.max(0, _visitSheet().getLastRow() - 1) });
    if (p.visit) return _json(_writeVisit(p));
    if (p.caseNo) return _json(_write(p));
    if (p.pw && p.pw === _adminPw()) {
      if (p.sheet === VISIT_SHEET) return _json(_visitSheet().getDataRange().getValues());
      return _json(_sheet().getDataRange().getValues());
    }
    return _json([]);
  } catch (err) {
    return _json({ ok: false, error: String(err) });
  }
}

/** POST — 구버전 앱(JSON 본문) 호환용. 새 앱은 GET을 쓴다. */
function doPost(e) {
  try {
    var p = {};
    if (e && e.postData && e.postData.contents) p = JSON.parse(e.postData.contents);
    return _json(_write(p));
  } catch (err) {
    return _json({ ok: false, error: String(err) });
  }
}
