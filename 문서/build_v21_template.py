#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
exact v2.1 감정평가서 템플릿 빌더 (한글 .hwpx)

v2.0 템플릿(표지+감정평가표+산출근거 = section0·1)에
사용자가 제공한 원본 감정평가서의 뒤쪽 4개 섹션을 붙여 6섹션 템플릿을 만든다.

  section2 = (구분건물)감정평가명세표  → 표 셀을 전부 비움 (앱이 셀좌표로 기입)
  section3 = (구분건물)감정평가요항표  → 값 부분을 {{토큰}}으로 치환
  section4 = 광역위치도              → 소재지 한 줄만 {{건명}} 토큰
  section5 = 현황사진                → 손대지 않음 (사진은 한글에서 직접 붙임)

주의(하드코딩된 전제 — 원본이 바뀌면 검증 필요):
  · v2.0 헤더와 원본 헤더는 charPr 0~49 / borderFill 1~43 / paraPr / style이 동일.
    charPr 50~55만 정의가 달라(v2.0은 파란 표시용 클론) 새 id 58~63으로 복제 후 참조 리맵.
  · borderFill 44~59, 즉 뒤쪽 섹션 전용 테두리는 v2.0 헤더에 없어 그대로 추가.
  · 명세표의 FORMULA 필드 3개는 제거 (한글이 재계산하며 앱이 넣은 값을 덮어쓰기 때문).
"""
import re, sys, zipfile, os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V20 = os.path.join(BASE, "템플릿", "exact v2.0 감정평가서 템플릿_주거용+단일호수.hwpx")
OUT = os.path.join(BASE, "템플릿", "exact v2.1 감정평가서 템플릿_주거용+단일호수.hwpx")

# charPr 리맵: 원본(뒤 섹션)에서 쓰는 50~55 → 새로 추가할 58~63
CHAR_REMAP = {50: 58, 51: 59, 52: 60, 53: 61, 54: 62, 55: 63}

# 명세표에서 값이 아니라 서식·고정문구라 남겨둘 텍스트
KEEP_LITERALS = {"[도로명주소]", "합계", "￦", ".-"}

# 요항표 문장 → 토큰 (원본 샘플값 그대로가 key)
YOHANG_REPL = [
    ("본건은 성남시 분당구 정자동 소재 '탄천초등학교' 북동측에 위치하고 있음.",
     "본건은 {{요항_소재지}} 소재 {{인근위치설명}}에 위치하고 있음."),
    ("본건 주위는 아파트단지 및 근린생활시설 등이 혼재하는 지대로서, 제반 입지여건 무난한 편임.",
     "{{요항_부근상황}}"),
    ("본건까지 차량의 진출입이 가능하며, 인근에 버스정류장이 소재하는 등 대중교통 상황은 보통임.",
     "{{요항_교통상황}}"),
    ("아파트단지 내 포장도로가 개설되어 있으며, 이를 통해 외곽 공도와 연계됨.",
     "{{요항_접면도로}}"),
    ("철근콘크리트조 경사슬래브지붕 지하1층/지상21층 중 제7층 제702호로서, (사용승인일 : 1995.06.03.) ",
     "{{요항_구조}} 지하{{지하층수}}층/지상{{지상층수}}층 중 제{{층}}층 제{{호수}}호로서, (사용승인일 : {{사용승인일}}.)"),
    ("- 외벽 : 몰탈위 페인팅 마감 등", "- 외벽 : {{요항_외벽}}"),
    ("- 창호 : 샷시 창호 등임.", "- 창호 : {{요항_창호}}"),
    ("아파트로 이용중임.", "{{요항_이용상태}}"),
    ("기본적인 위생설비, 급배수˙급탕설비, 난방설비, 승강기설비, 소방설비 등이 구비되어 있음. ",
     "{{요항_설비}}"),
]
# 토지이용계획(원본 값이 길고 지역마다 달라 앞부분만 매칭) + "해당사항 없음." 4곳은 순서로 구분
YOHANG_TOICE_PREFIX = "도시지역, 제3종일반주거지역, 개발행위허가제한지역"
YOHANG_NONE_TOKENS = ["{{요항_기타사항1}}", "{{요항_부합물}}", "{{요항_공부차이}}", "{{요항_기타사항2}}"]

PARA_RE = re.compile(r"<hp:p\b[^>]*>[\s\S]*?</hp:p>")
RUN_RE = re.compile(r"<hp:run\b[^>]*(?:/>|>[\s\S]*?</hp:run>)")
# <hp:t ...> 만 잡는다 — [^>]* 만 쓰면 <hp:tc ...>까지 삼켜 셀 구조가 깨짐(첫 빌드 때 실제로 깨졌음)
T_RE = re.compile(r"<hp:t(?=[ >])[^>]*>[\s\S]*?</hp:t>")
TC_RE = re.compile(r"<hp:tc\b[\s\S]*?</hp:tc>")
LINESEG_RE = re.compile(r"<hp:linesegarray>[\s\S]*?</hp:linesegarray>")


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def para_text(p):
    return "".join(re.findall(r"<hp:t[^>]*>([^<]*)</hp:t>", p))


def set_para_text(p, text, drop_lineseg=True):
    """문단의 첫 런에 text를 넣고 나머지 런의 텍스트는 제거. 줄배치 캐시는 기본 제거."""
    out = LINESEG_RE.sub("", p) if drop_lineseg else p
    state = {"first": True}

    def repl(m):
        run = T_RE.sub("", m.group(0))
        if not state["first"]:
            return run
        state["first"] = False
        if not text:
            return run
        body = "<hp:t>%s</hp:t>" % esc(text)
        if run.endswith("/>"):
            return run[:-2] + ">" + body + "</hp:run>"
        return run[: -len("</hp:run>")] + body + "</hp:run>"

    return RUN_RE.sub(repl, out)


def merge_header(cur_header, full_header):
    def block(h, tag, i):
        m = re.search(r'<hh:%s id="%d"[\s\S]*?</hh:%s>' % (tag, i, tag), h)
        if not m:
            raise SystemExit("헤더에서 %s id=%d 를 못 찾음" % (tag, i))
        return m.group(0)

    # 1) charPr 50~55 → 58~63 로 복제 추가
    add = ""
    for src, dst in sorted(CHAR_REMAP.items()):
        b = block(full_header, "charPr", src)
        add += re.sub(r'id="%d"' % src, 'id="%d"' % dst, b, count=1)
    cnt = int(re.search(r'<hh:charProperties itemCnt="(\d+)">', cur_header).group(1))
    if cnt != 58:
        raise SystemExit("v2.0 charPr 개수가 58이 아님(%d) — 리맵 대상 id를 다시 확인" % cnt)
    cur_header = cur_header.replace("</hh:charProperties>", add + "</hh:charProperties>", 1)
    cur_header = cur_header.replace('<hh:charProperties itemCnt="58">',
                                    '<hh:charProperties itemCnt="%d">' % (cnt + len(CHAR_REMAP)), 1)

    # 2) borderFill 44~59 추가 (뒤 섹션 표 테두리)
    have = set(map(int, re.findall(r'<hh:borderFill id="(\d+)"', cur_header)))
    need = [i for i in map(int, re.findall(r'<hh:borderFill id="(\d+)"', full_header)) if i not in have]
    if need:
        addbf = "".join(block(full_header, "borderFill", i) for i in need)
        bcnt = int(re.search(r'<hh:borderFills itemCnt="(\d+)">', cur_header).group(1))
        cur_header = cur_header.replace("</hh:borderFills>", addbf + "</hh:borderFills>", 1)
        cur_header = cur_header.replace('<hh:borderFills itemCnt="%d">' % bcnt,
                                        '<hh:borderFills itemCnt="%d">' % (bcnt + len(need)), 1)
    return cur_header, need


def remap_charpr(xml):
    return re.sub(r'charPrIDRef="(\d+)"',
                  lambda m: 'charPrIDRef="%d"' % CHAR_REMAP.get(int(m.group(1)), int(m.group(1))),
                  xml)


def strip_formula_fields(xml):
    """표 계산식 필드 제거 — 남겨두면 한글이 재계산하며 앱이 넣은 값을 캐시값으로 덮어씀."""
    n0 = xml.count("fieldBegin")
    xml = re.sub(r"<hp:ctrl><hp:fieldBegin\b[\s\S]*?</hp:fieldBegin></hp:ctrl>", "", xml)
    xml = re.sub(r"<hp:ctrl><hp:fieldEnd\b[^>]*/></hp:ctrl>", "", xml)
    return xml, n0


def blank_myeongse(xml):
    """명세표 본문(2행 이후) 셀을 비우고 줄배치 캐시 제거 — 값은 앱이 셀좌표로 채운다."""
    tbls = list(re.finditer(r"<hp:tbl\b[^>]*>[\s\S]*?</hp:tbl>", xml))
    if not tbls:
        raise SystemExit("명세표 표를 못 찾음")
    tbl = max(tbls, key=lambda m: m.group(0).count("<hp:tr>"))
    cleared = [0]

    def do_tc(m):
        tc = m.group(0)
        a = re.search(r'colAddr="(\d+)" rowAddr="(\d+)"', tc)
        if not a or int(a.group(2)) < 2:
            return tc
        texts = re.findall(r"<hp:t[^>]*>([^<]*)</hp:t>", tc)
        if not any(t.strip() for t in texts):
            return LINESEG_RE.sub("", tc)
        if all(t.strip() in KEEP_LITERALS or not t.strip() for t in texts):
            return LINESEG_RE.sub("", tc)  # 고정문구(합계·[도로명주소])는 유지
        # ￦ … .- 처럼 리터럴과 값이 한 셀에 섞인 경우: 값만 비움
        def one(mm):
            inner = re.search(r"<hp:t[^>]*>([^<]*)</hp:t>", mm.group(0))
            txt = inner.group(1) if inner else ""
            if txt.strip() in KEEP_LITERALS:
                return mm.group(0)
            cleared[0] += 1
            return ""
        return LINESEG_RE.sub("", T_RE.sub(one, tc))

    new_tbl = TC_RE.sub(do_tc, tbl.group(0))
    return xml[: tbl.start()] + new_tbl + xml[tbl.end():], cleared[0]


def tokenize_yohang(xml):
    hit = {"n": 0, "none": 0, "toice": 0}

    def do_p(m):
        p = m.group(0)
        txt = para_text(p)
        for old, new in YOHANG_REPL:
            if txt == old:
                hit["n"] += 1
                return set_para_text(p, new)
        if txt.startswith(YOHANG_TOICE_PREFIX):
            hit["toice"] += 1
            return set_para_text(p, "{{요항_토지이용계획}}")
        if txt == "해당사항 없음.":
            i = hit["none"]
            hit["none"] += 1
            if i < len(YOHANG_NONE_TOKENS):
                return set_para_text(p, YOHANG_NONE_TOKENS[i])
        return p

    return PARA_RE.sub(do_p, xml), hit


def tokenize_wide_map(xml):
    n = [0]

    def do_p(m):
        p = m.group(0)
        txt = para_text(p)
        if "정든마을" in txt and "제702호" in txt:
            n[0] += 1
            return set_para_text(p, "{{건명}}")
        return p

    return PARA_RE.sub(do_p, xml), n[0]


def main(full_path):
    zc = zipfile.ZipFile(V20)
    zf = zipfile.ZipFile(full_path)
    cur = {n: zc.read(n) for n in zc.namelist()}
    order = list(zc.namelist())

    header, added_bf = merge_header(cur["Contents/header.xml"].decode("utf-8"),
                                   zf.read("Contents/header.xml").decode("utf-8"))
    cur["Contents/header.xml"] = header.encode("utf-8")
    print("헤더 병합: charPr +%d(58~63), borderFill +%d %s" % (len(CHAR_REMAP), len(added_bf), added_bf))

    for i in (2, 3, 4, 5):
        name = "Contents/section%d.xml" % i
        xml = remap_charpr(zf.read(name).decode("utf-8"))
        if i == 2:
            xml, nf = strip_formula_fields(xml)
            xml, nc = blank_myeongse(xml)
            print("section2 명세표: FORMULA 필드 %d개 제거, 값셀 %d개 비움" % (nf, nc))
        elif i == 3:
            xml, hit = tokenize_yohang(xml)
            print("section3 요항표: 문장 %d개 토큰화 + 토지이용계획 %d + 해당사항없음 %d"
                  % (hit["n"], hit["toice"], min(hit["none"], len(YOHANG_NONE_TOKENS))))
            if hit["n"] != len(YOHANG_REPL):
                raise SystemExit("요항표 문장 매칭 실패 — 원본 문구가 바뀐 듯. 대조 후 YOHANG_REPL 수정")
        elif i == 4:
            xml, n = tokenize_wide_map(xml)
            print("section4 광역위치도: 소재지 %d곳 → {{건명}}" % n)
        left = set(re.findall(r'charPrIDRef="(\d+)"', xml)) & {str(k) for k in CHAR_REMAP}
        if left:
            raise SystemExit("charPr 리맵 누락: %s" % left)
        cur[name] = xml.encode("utf-8")
        order.insert(order.index("Contents/section1.xml") + (i - 1), name)

    hpf = zf.read("Contents/content.hpf").decode("utf-8")
    cur["Contents/content.hpf"] = hpf.replace("BinData/image1.png", "BinData/image1.PNG").encode("utf-8")

    with zipfile.ZipFile(OUT, "w") as zo:
        for n in order:
            # hwpx는 mimetype이 압축 없이 첫 항목이어야 함
            zo.writestr(n, cur[n], zipfile.ZIP_STORED if n == "mimetype" else zipfile.ZIP_DEFLATED)
    print("생성:", OUT, os.path.getsize(OUT), "bytes,", len(order), "entries")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit("사용법: build_v21_template.py <사용자가 준 원본 6섹션 hwpx>")
    main(sys.argv[1])
