/**
 * 온결 — 클라우드플레어 Worker 프록시
 *
 * 하는 일
 *  - 브라우저에서 직접 못 부르는(CORS 차단) 공공 API를 대신 호출해서 결과를 돌려준다.
 *  - API 키는 이 서버 안(환경변수)에만 있어 페이지에 노출되지 않는다.
 *
 * 지원 경로
 *  /bld?pnu=41173...0005              건축물대장 층별개요 (국토부 건축HUB, op 생략 시 기본)
 *  /bld?op=getBrTitleInfo&pnu=...      건축물대장 표제부 (구조·주용도·사용승인일·층수)
 *  /bld?op=getBrFlrOulnInfo&pnu=...    건축물대장 층별개요 (명시적으로 지정할 때)
 *  /rone?...                          부동산원 R-ONE (지가변동률 등 — 쿼리 그대로 전달)
 *
 * 설치법: 문서/클라우드플레어_프록시_설정.md 참고.
 * 환경변수(Settings → Variables and Secrets):
 *  DATAGO_KEY  공공데이터포털 일반 인증키(Decoding 아닌 원문 그대로. %2B 등 인코딩된 형태면 그대로 넣기)
 *  RONE_KEY    부동산원 R-ONE 키 (지가변동률 붙일 때 추가 — 없으면 /rone만 비활성)
 */

// 우리 페이지에서만 쓰도록 허용할 출처(Origin) 목록
const ALLOW_ORIGINS = [
  "https://wjjung111.github.io",
];

function corsHeaders(origin) {
  const ok = ALLOW_ORIGINS.includes(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin : ALLOW_ORIGINS[0],
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    try {
      // ── 건축물대장: /bld?pnu=<19자리 PNU>&op=<오퍼레이션, 생략 시 층별개요> ──
      if (url.pathname === "/bld") {
        const pnu = String(url.searchParams.get("pnu") || "");
        if (!/^\d{19}$/.test(pnu)) return json({ error: "pnu 19자리 필요" }, 400, cors);
        if (!env.DATAGO_KEY) return json({ error: "서버에 DATAGO_KEY 미설정" }, 500, cors);
        const ALLOWED_OPS = ["getBrFlrOulnInfo", "getBrTitleInfo"];
        const op = ALLOWED_OPS.includes(url.searchParams.get("op")) ? url.searchParams.get("op") : "getBrFlrOulnInfo";
        const sigungu = pnu.slice(0, 5), bjdong = pnu.slice(5, 10);
        const platGb = pnu.charAt(10) === "2" ? "1" : "0"; // 필지구분(1일반/2산)→대장(0대지/1산)
        const bun = pnu.slice(11, 15), ji = pnu.slice(15, 19);
        // 키가 이미 URL인코딩된 형태(%2B 포함 등)면 그대로, 아니면 인코딩해서 붙임
        const key = /%[0-9A-Fa-f]{2}/.test(env.DATAGO_KEY) ? env.DATAGO_KEY : encodeURIComponent(env.DATAGO_KEY);
        const target = `https://apis.data.go.kr/1613000/BldRgstHubService/${op}`
          + `?sigunguCd=${sigungu}&bjdongCd=${bjdong}&platGbCd=${platGb}&bun=${bun}&ji=${ji}`
          + `&numOfRows=200&pageNo=1&_type=json&serviceKey=${key}`;
        const r = await fetch(target);
        const body = await r.text();
        return new Response(body, { status: r.status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } });
      }

      // ── R-ONE 프록시 (쿼리 그대로 전달, KEY만 서버가 주입) ──
      //  /rone      자료조회  SttsApiTblData.do  (예: STATBL_ID=..&DTACYCLE_CD=MM&WRTTIME_IDTFR_ID=202501)
      //  /rone-list 통계목록  SttsApiTbl.do      (예: STATBL_NM=지가변동률)
      if (url.pathname === "/rone" || url.pathname === "/rone-list") {
        if (!env.RONE_KEY) return json({ error: "서버에 RONE_KEY 미설정" }, 500, cors);
        const qs = new URLSearchParams(url.searchParams);
        qs.set("KEY", env.RONE_KEY);
        if (!qs.get("Type")) qs.set("Type", "json");
        const api = url.pathname === "/rone" ? "SttsApiTblData.do" : "SttsApiTbl.do";
        const target = "https://www.reb.or.kr/r-one/openapi/" + api + "?" + qs.toString();
        const r = await fetch(target);
        const body = await r.text();
        return new Response(body, { status: r.status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } });
      }

      // ── 상태 확인: / ──
      return json({ ok: true, service: "ongyeol-proxy", paths: ["/bld?pnu=", "/rone?..."] }, 200, cors);
    } catch (e) {
      return json({ error: String(e && e.message || e) }, 502, cors);
    }
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
  });
}
