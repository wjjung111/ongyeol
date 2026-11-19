// 등기발급.html 순수 함수 검증: 추출값 요약(DG.summarize) · PC 에이전트 상태 문구(DG.agentView)
// 실행: node tests/deunggi_page.cjs
const fs = require("fs");
const path = require("path");
const assert = require("node:assert/strict");

const html = fs.readFileSync(path.join(__dirname, "..", "등기발급.html"), "utf8");
const m = html.match(/const DG = (\{[\s\S]*?\r?\n\});\r?\nif \(typeof module/);   // 윈도우 체크아웃(CRLF)에서도 찾도록
assert.ok(m, "등기발급.html 에서 DG 객체를 찾지 못함");
const DG = new Function(`const DG = ${m[1]}; return DG;`)();

// 1) 대치동 511 107동 107호 실측 추출값 형태
const f = {
  "고유번호": "1146-1996-098180", "전유면적": 128.01,
  "대지권_분모": 195413.2, "대지권_분자": 78.382,
  "대지권_목록": [{"분모": 195413.2, "분자": 78.382}, {"분모": 157053588.84, "분자": 54389.2698}],
};
const s = Object.fromEntries(DG.summarize(f));
assert.equal(s["고유번호"], "1146-1996-098180");
assert.equal(s["전유면적"], "128.01㎡");
assert.equal(s["대지권 1"], "195,413.2분의 78.382");
assert.equal(s["대지권 2"], "157,053,588.84분의 54,389.2698");

// 2) 대지권 1건(목록 없음)·분자 못 찾음
const one = Object.fromEntries(DG.summarize({"대지권_분모": 289.5, "대지권_분자": null}));
assert.equal(one["대지권"], "289.5분의 ?");
assert.deepEqual(DG.summarize(null), []);

// 3) 에이전트 상태
const now = Date.parse("2026-11-02T19:00:00+09:00");
assert.equal(DG.agentView("2026-11-02 18:59:30", {session: "로그인됨", login_minutes: 125}, now).sub, "로그인 후 2시간 5분째");
assert.equal(DG.agentView("2026-11-02 18:59:30", {session: "로그인 필요"}, now).cls, "need");
assert.equal(DG.agentView("2026-11-02 18:40:00", {session: "로그인됨"}, now).cls, "off");   // 3분 넘게 소식 없음 = 꺼짐
assert.equal(DG.agentView("", null, now).cls, "off");

console.log("deunggi_page: OK");
