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
  // '기록' 탭이 없으면: '접속' 탭을 뺀 나머지가 하나뿐이면(예: 기본 이름 '시트1') 그걸 그대로 쓰고(기존 데이터 보존), 여러 개면 새로 만든다
  if (!sh) {
    var rest = ss.getSheets().filter(function (s) { return s.getName() !== VISIT_SHEET; });
    sh = (rest.length === 1) ? rest[0] : ss.insertSheet(SHEET_NAME);
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
  if (String(p.action || '') === '차단') _notifyBlock(p);
  return { ok: true };
}

/**
 * 차단 시도 메일 알림 (2026-11-27) — arap_block.js가 동작 '차단'을 보내면 이 스크립트 주인 계정으로 메일.
 * 같은 IP(없으면 같은 이름)는 10분에 한 번만 보낸다(새로고침 연타로 메일 폭탄 방지). 메일 실패해도 기록은 이미 남음.
 */
function _notifyBlock(p) {
  try {
    var who = String(p.ip || p.user || '');
    var key = 'blk_' + who.replace(/[^0-9A-Za-z.:_-]/g, '').slice(0, 200);
    var cache = CacheService.getScriptCache();
    if (cache.get(key)) return;
    cache.put(key, '1', 600);
    var to = Session.getEffectiveUser().getEmail();
    if (!to) return;
    var t = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy.MM.dd HH:mm:ss');
    MailApp.sendEmail(to, '[온결] 차단된 사용자 접근 시도 — ' + String(p.page || ''), [
      '차단된 사용자가 접속을 시도했습니다(화면은 막혔습니다).',
      '',
      '시각(한국): ' + t,
      '페이지: ' + String(p.page || ''),
      '입력 이름: ' + String(p.user || '(없음)'),
      '판정: ' + String(p.detail || ''),
      '기기: ' + String(p.device || '') + ' · ' + String(p.browser || ''),
      'IP: ' + String(p.ip || '') + ' (' + String(p.region || '') + ', ' + String(p.isp || '') + ')',
      '',
      '같은 IP는 10분에 한 번만 메일이 갑니다. 전체 기록은 시트 「접속」 탭(동작 = 차단).'
    ].join('\n'));
  } catch (err) {
    console.error('notifyBlock', err);
  }
}

/** 편집기에서 한 번 실행 → 메일 권한 승인 + 시험 메일 1통 (배포 전에) */
function testBlockMail() {
  CacheService.getScriptCache().remove('blk_0.0.0.0');
  _notifyBlock({ page: '시점수정(시험)', user: '시험', detail: '시험 메일', device: 'PC', browser: '크롬', ip: '0.0.0.0', region: '시험', isp: '시험' });
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
