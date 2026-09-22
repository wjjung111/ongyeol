/**
 * Ongyeol — 국세청 건물 기준시가 계산 엔진 (단일 소스)
 *
 * 기준시가.html(계산기 앱)과 토지건물.html(ARM 건물평가 탭)이 이 파일 하나를 공유한다.
 * 아티팩트(claude.ai) 버전은 빌드 스크립트가 이 파일을 인라인해서 만든다 — 여기만 고치면 세 곳이 같이 바뀐다.
 *
 * 근거: 국세청 건물 기준시가 계산방법 고시(제2024-38호 2025년 / 제2026-39호 2026년) 및 2026년 해설서.
 *  - ㎡당 = 신축가격기준액 × 구조지수 × 용도지수 × 위치지수 × 경과연수별잔가율 × 개별건물특성조정률(상속·증여만) → 1,000원 미만 절사 → × 면적
 *  - 조정률Ⅱ(연면적)·Ⅲ(단독주택 면적)은 건물 전체가 아니라 해당 "부분"(비주거 본체 / 주택 본체 / 부속) 면적으로 판단 — 해설서 계산사례 p.68~69 방식
 *  - 부속부분(주차장·기계실·옥탑·부속창고 등)은 주용도의 용도지수를 적용한 뒤 조정률Ⅳ 60을 곱한다 — 적용요령 (6)
 *  - 주거용은 아파트에 한해 최고층수만 적용, 연면적·인텔리전트 조정률 미적용 — 적용요령 (3)(4). 통나무조는 조정률Ⅱ 적용 제외 (p.39 비고)
 *  - 내용연수 그룹은 구조지수 번호가 아니라 구조 자체로 정한다 — 4번 중 목조·ALC·스틸하우스는 Ⅱ, 6번 중 시멘트블록·황토는 Ⅲ (p.34, 계산사례 p.66)
 *  - 리모델링 할증 잔가율은 상속·증여에만, 양도는 신축연도 잔가율 그대로 (p.30 (3))
 * 검증: tests/gijunsiga.cjs — 해설서 계산사례 p.54~74 원 단위 대조 (Node 없으면 tests/run.html을 브라우저로)
 */
(function(root){
  var BASE={2025:850000,2026:860000};
  var STRUCT=[[1,"통나무조",135],[2,"목구조",120],[3,"철골(철골철근)콘크리트조",110],[4,"철근콘크리트조·석조·PC조·목조·라멘조·ALC조·스틸하우스조",100],
    [5,"연와조·철골조·보강콘크리트조·보강블록조",95],[6,"시멘트벽돌조·황토조·시멘트블록조·와이어패널조",90],[7,"철골조 중 조립식패널(EPS)",85],
    [8,"조립식패널조",80],[9,"경량철골조",79],[10,"석회·흙벽돌조, 돌담·토담조",60],[11,"철파이프조·컨테이너건물",59]];
  var STRUCT_OVR={2026:{2:115}};
  var GROUP_OF={1:1,2:1,3:1,4:1,5:2,6:2,7:2,8:3,9:3,10:3,11:4};
  var LIFE={1:50,2:40,3:30,4:20};
  var USE=[
    ["Ⅰ 주거용",[[1,"아파트",110],[2,"단독·다중·다가구·연립·다세대·기숙사·도시형생활주택",100]]],
    ["숙박시설",[[3,"관광호텔(5성·4성)",140],[4,"호텔·관광호텔(3성이하)·가족호텔·호스텔·콘도·펜션·생활숙박시설",130],[5,"외국인관광 도시민박·한옥체험시설",120],[6,"여관(모텔 포함)",112],[7,"다중생활시설(근생 해당분 제외)",105],[8,"여인숙",100]]],
    ["판매시설",[[9,"백화점",135],[10,"대형마트·전문점(3,000㎡↑)·쇼핑센터·복합쇼핑몰·기타 대규모점포",125],[11,"일반상점(1,000~3,000㎡)·기타 판매 및 영업시설",95],[12,"도매시장·전통시장·공판장·경매장",85]]],
    ["운수·위락",[[13,"여객터미널·철도·공항·항만시설",120],[14,"무도장",140],[15,"유흥주점·카지노",130],[16,"유원시설업(테마파크) 시설",120],[17,"단란주점(풍속영업 제외)",115],[18,"무도학원",90]]],
    ["문화·집회·종교·운동",[[19,"집회장(장외발매소·전화투표소)",130],[20,"예식장·공연장·집회장(근생 제외)",115],[21,"동물원·식물원·수족관·전시장",110],[22,"관람장(경마장·경기장 등 1,000㎡↑)",105],[23,"종교시설(근생 제외)",100],[24,"골프장·스키장·수영장·볼링장·종합체육시설",125],[25,"기타 체육시설",105]]],
    ["의료·업무·방송·관광휴게",[[26,"종합병원",125],[27,"일반·치과·한방·정신·요양병원",110],[28,"오피스텔",135],[29,"사무소·금융업소 등 업무시설(근생 제외)",115],[30,"방송국·촬영소·전신전화국·통신용시설",110],[31,"야외음악당·휴게소·공원·관광지 부수시설",110]]],
    ["교육·노유자·수련",[[32,"학원·교습소(근생 제외)",107],[33,"학교·교육원·직업훈련소·연구소·도서관",100],[34,"아동·노인복지·사회복지·근로복지시설",109],[35,"고아원·양로원·경로당 등",83],[36,"청소년수련시설",110]]],
    ["근린생활시설",[[37,"목욕장 3,000㎡↑",130],[38,"목욕장 1,000~3,000㎡",115],[39,"목욕장 1,000㎡ 미만",110],[40,"풍속영업시설(단란주점150㎡↓·PC방500㎡↑·게임제공업·복합유통게임·노래연습장·안마시술소·비디오감상실)",105],[41,"제1종·제2종 근린생활시설 일반(소매점·음식점·의원·사무소·학원·PC방500㎡↓·기타)",95]]],
    ["묘지·장례",[[42,"화장시설·봉안당·묘지 부속건축물",130],[43,"동물화장·동물납골시설",105],[44,"장례식장",115],[45,"동물 전용 장례식장",105]]],
    ["Ⅲ 공장·발전·창고",[[46,"지식산업센터(아파트형공장)",115],[47,"냉동공장·반도체·평면디스플레이 공장",100],[48,"기타 공장",78],[49,"원자력 발전시설",300],[50,"발전소",90],[51,"냉동·냉장창고",105],[52,"일반창고·하역장·물류터미널·집배송시설",75]]],
    ["위험물·자원순환·자동차·동식물",[[53,"주유소·가스충전소·위험물저장처리시설",90],[54,"하수처리·고물상·폐기물시설",80],[55,"자동차매매장·운전학원·정비학원",75],[56,"세차장·폐차장·검사장·정비공장·차고",67],[57,"주차장(자주식 주차전용빌딩)·전기차충전소(근생 제외)",60],[58,"가축용운동시설·관리사·동물검역소 등",70],[59,"축사·가축시설·도축장·작물재배사",55],[60,"온실·기타 식물관련시설",50]]]
  ];
  var USE_OVR={2026:{33:102,35:85}};
  var LOC=[[20000,78],[30000,83],[50000,85],[70000,86],[100000,87],[130000,88],[150000,89],[180000,90],[200000,91],[300000,92],
    [350000,93],[500000,94],[650000,97],[800000,100],[1000000,102],[1200000,105],[1600000,108],[2000000,111],[2500000,114],
    [3000000,116],[3500000,118],[4000000,120],[4500000,122],[5000000,124],[5500000,126],[6000000,128],[7000000,130],[8000000,132],
    [9000000,134],[10000000,137],[15000000,140],[20000000,143],[25000000,146],[30000000,149],[35000000,152],[40000000,155],
    [45000000,158],[50000000,161],[55000000,164],[60000000,167],[65000000,170],[70000000,173],[75000000,176],[80000000,179],[Infinity,182]];
  var LOC_OVR={2026:{15:104,16:106,17:108}};   // 0-based index: 16번=15, 17번=16, 18번=17
  // [키, 표시, 조정률(Ⅲ 또는 Ⅳ), 주거용 여부, 부속 여부]
  var FLOORTYPE=[
    ["none","일반 (조정 없음)",1,false,false],
    ["shop1","상가 1층 (120)",1.2,false,false],
    ["shop2","상가 2층 (105)",1.05,false,false],
    ["b1","지하1층 · 최고층수 5층 이하 (80)",0.8,false,false],
    ["b2","지하2층 이상 · 최고층수 5층 이하 (70)",0.7,false,false],
    ["park","부속 주차장·기계실·보일러실·옥탑·물탱크실 (60)",0.6,false,true],
    ["res","주거용 · 다가구·다중·기숙사·도시형 (Ⅱ·Ⅲ 미적용)",1,true,false],
    ["res_s1","주거용 · 단독주택 연면적 264~331㎡ (120)",1.2,true,false],
    ["res_s2","주거용 · 단독주택 연면적 331㎡↑ (140)",1.4,true,false],
    ["res_c1","주거용 · 공동주택 전유 149~215㎡ (120)",1.2,true,false],
    ["res_c2","주거용 · 공동주택 전유 215㎡↑ (140)",1.4,true,false],
    ["apt","주거용 · 아파트 (최고층수 조정만)",1,true,false],
    ["res_att","주거용 부속 · 옥탑·계단실·기계실·부속창고 (60)",0.6,true,true],
    ["shed","주택 간이부속건물 · 창고·화장실 (60)",0.6,true,true]];
  var EXTRA=[["1","없음",1],["1.1","일부개축 1회 (110)",1.1],["1.2","일부개축 2회↑ (120)",1.2],
    ["0.8","무벽 1/4~2/4 (80)",0.8],["0.7","무벽 2/4~3/4 (70)",0.7],["0.6","무벽 3/4↑ (60)",0.6],
    ["0.9","안전진단 B급 (90)",0.9],["0.8b","안전진단 C급 (80)",0.8],["0.6b","안전진단 D급 (60)",0.6],["0.3","안전진단 E급·철거대상 사용중 (30)",0.3],["0","철거대상 미사용 (0)",0]];
  var ATT_RE=/부속|주차장|기계실|보일러|옥탑|물탱크|대피소|전기실|펌프실|계단|승강기|엘리베이터/;

  function ft(key){for(var i=0;i<FLOORTYPE.length;i++)if(FLOORTYPE[i][0]===key)return FLOORTYPE[i];return FLOORTYPE[0];}
  function ex(key){for(var i=0;i<EXTRA.length;i++)if(EXTRA[i][0]===key)return EXTRA[i];return EXTRA[0];}
  function noticeYear(y){y=+y||new Date().getFullYear();return BASE[y]?y:(y>2026?2026:2025);}
  function structIdx(year,no){var o=STRUCT_OVR[year]&&STRUCT_OVR[year][no];if(o)return o;for(var i=0;i<STRUCT.length;i++)if(STRUCT[i][0]===no)return STRUCT[i][2];return 100;}
  function useIdx(year,no){var o=USE_OVR[year]&&USE_OVR[year][no];if(o)return o;for(var g=0;g<USE.length;g++)for(var i=0;i<USE[g][1].length;i++)if(USE[g][1][i][0]===no)return USE[g][1][i][2];return 100;}
  function locIdx(year,price){if(!(price>0))return null;for(var i=0;i<LOC.length;i++){if(price<LOC[i][0]){var v=(LOC_OVR[year]&&LOC_OVR[year][i])||LOC[i][1];return {no:i+1,idx:v,lo:i?LOC[i-1][0]:0,hi:LOC[i][0]};}}return null;}
  function residual(year,built,group,remodel){var N=LIFE[group]||50;if(!(built>0))return null;var n=year-built;if(n<=0)return 1;
    if(remodel>built&&remodel<=year){var nn=Math.min(remodel-built,N),eff=n-0.3*nn;if(eff>N)return 0.1;return Math.max(0.1,1-0.9*eff/N);}
    return n>=N?0.1:Math.round((1-0.9*n/N)*10000)/10000;}
  // 내용연수 그룹: 기본은 구조번호, 4·6번은 한 번호 안에 그룹이 갈리므로 구조 텍스트로 가른다
  function structGroup(no,text){var t=String(text||"");
    if(no===4&&/목조|ALC|스틸하우스/i.test(t)&&!/철근|콘크리트|석조|라멘|PC/i.test(t))return 2;
    if(no===6&&/블록|블럭|황토/.test(t))return 3;
    return GROUP_OF[no]||1;}
  function floorK(x){return Math.floor(x/1000)*1000;}
  function areaIdx(a){return a<1000?0.9:a<5000?1:a<10000?1.1:a<50000?1.2:1.3;}
  function floorsIdx(top){return top<=0?null:top<=5?0.9:top<=10?1:top<=15?1.1:top<=20?1.2:1.3;}

  // ── 대장 텍스트 → 고시 지수 매핑 ──
  function mapStructure(t){t=t||"";
    if(/통나무/.test(t))return [1,"통나무조 135"];
    if(/철골철근|철골.*콘크리트|SRC/i.test(t))return [3,"철골(철골철근)콘크리트조 110"];
    if(/경량철골/.test(t))return [9,"경량철골조 79"];
    if(/목구조/.test(t))return [2,"목구조 120 (2026년 115)"];
    if(/철근콘크리트|철근콘트리트|RC|라멘|프리캐스트|PC조|석조/i.test(t))return [4,"철근콘크리트조 등 100"];
    if(/ALC|스틸하우스|목조/i.test(t))return [4,"목조·ALC·스틸하우스 100 (내용연수 Ⅱ그룹 40년)"];
    if(/보강블록|보강콘크리트/.test(t))return [5,"보강블록·보강콘크리트조 95"];
    if(/시멘트블록|시멘트블럭|블록조|블럭조|황토/.test(t))return [6,"시멘트블록·황토조 90 (내용연수 Ⅲ그룹 30년)"];
    if(/시멘트벽돌|와이어패널/.test(t))return [6,"시멘트벽돌조 90"];
    if(/연와|벽돌|보강콘크리트|보강블록|철골|강구조/.test(t))return [5,"연와조·철골조 95"];
    if(/조립식|패널|판넬/.test(t))return [8,"조립식패널조 80"];
    if(/컨테이너|파이프/.test(t))return [11,"철파이프·컨테이너 59"];
    if(/흙|돌담|토담|석회/.test(t))return [10,"흙벽돌·토담조 60"];
    return [4,"구조 미상 → 100 임시 적용 (확인 필요)"];}
  function mapRoof(t){t=t||"";if(/함석|천막|초가|썬라이트|너와/.test(t))return "0.6";if(/패널|판넬|유리|슬레이트|FRP|폴리카보/i.test(t))return "0.8";return "1";}
  function mapUse(txt,area){var t=(txt||"").replace(/\s/g,""),near=/근린생활/.test(t);area=+area||0;
    function R(no,why){return {use:no,why:why};}
    if(/아파트/.test(t))return R(1,"아파트 110");
    if(/다가구|다세대|연립|단독주택|다중주택|기숙사|도시형생활|^주택$/.test(t))return R(2,"주거용 100");
    if(/관광호텔|호텔|콘도|펜션|생활숙박/.test(t))return R(4,"호텔·생활숙박 130 (5·4성 관광호텔이면 3번 140)");
    if(/여관|모텔/.test(t))return R(6,"여관·모텔 112"); if(/여인숙/.test(t))return R(8,"여인숙 100"); if(/민박|게스트하우스|한옥체험/.test(t))return R(5,"도시민박·한옥체험 120");
    if(/백화점/.test(t))return R(9,"백화점 135"); if(/대형마트|쇼핑센터|복합쇼핑|대규모점포/.test(t))return R(10,"대형점·쇼핑센터 125"); if(/도매시장|전통시장|재래시장|공판장|경매장/.test(t))return R(12,"도매·전통시장 85");
    if(/터미널|철도|공항|항만/.test(t))return R(13,"운수시설 120"); if(/무도장/.test(t))return R(14,"무도장 140"); if(/유흥주점|카지노/.test(t))return R(15,"유흥주점·카지노 130");
    if(/단란주점/.test(t))return area<150?R(40,"단란주점 150㎡ 미만 → 풍속영업 105"):R(17,"단란주점 115"); if(/무도학원/.test(t))return R(18,"무도학원 90");
    if(/노래연습장|노래방|안마시술소|비디오물감상|게임제공업|복합유통|사행/.test(t))return R(40,"풍속영업시설 105");
    if(/인터넷컴퓨터게임|멀티미디어|PC방/i.test(t))return area>=500?R(40,"PC방 500㎡ 이상 → 풍속영업 105"):R(41,"PC방 500㎡ 미만 → 근생 95");
    if(/목욕장|사우나|찜질/.test(t))return area>=3000?R(37,"목욕장 3천㎡↑ 130"):area>=1000?R(38,"목욕장 1천~3천㎡ 115"):R(39,"목욕장 1천㎡ 미만 110");
    if(/종합병원/.test(t))return R(26,"종합병원 125"); if(/병원/.test(t))return R(27,"병원 110"); if(/의원|치과|한의원|산후조리|조산원|접골|침술/.test(t))return R(41,"의원 등 근생 95");
    if(/오피스텔/.test(t))return R(28,"오피스텔 135"); if(/사무소|업무시설|금융|은행|출판사|신문사|소개업/.test(t))return (near||area<500)?R(41,"사무소 500㎡ 미만 근생 95"):R(29,"업무시설 115");
    if(/방송|촬영소|전신전화|통신용/.test(t))return R(30,"방송통신 110"); if(/학원|교습소/.test(t))return (near||area<500)?R(41,"학원 500㎡ 미만 근생 95"):R(32,"학원 107");
    if(/학교|교육원|연수원|연구소|도서관|직업훈련/.test(t))return R(33,"교육연구시설"); if(/경로당|양로|고아원/.test(t))return R(35,"양로원·경로당");
    if(/어린이집|노인|복지|아동/.test(t))return near?R(41,"근생 해당 아동시설 95"):R(34,"노유자시설 109"); if(/수련|유스호스텔|청소년/.test(t))return R(36,"수련시설 110");
    if(/장례식장/.test(t))return R(44,"장례식장 115"); if(/화장시설|봉안|납골/.test(t))return R(42,"묘지관련 130"); if(/지식산업센터|아파트형공장/.test(t))return R(46,"지식산업센터 115");
    if(/냉동공장|반도체|디스플레이/.test(t))return R(47,"냉동·반도체 공장 100"); if(/공장|제조|수리점/.test(t))return (near||area<500)?R(41,"제조업소·수리점 근생 95"):R(48,"공장 78"); if(/발전/.test(t))return R(50,"발전소 90");
    if(/냉동창고|냉장창고/.test(t))return R(51,"냉동·냉장창고 105"); if(/창고|물류|하역|집배송/.test(t))return R(52,"창고 75"); if(/주유소|충전소|가스|위험물|석유/.test(t))return near?R(41,"근생 해당 95"):R(53,"위험물저장처리 90");
    if(/폐기물|고물상|하수/.test(t))return R(54,"자원순환 80"); if(/자동차매매|운전학원|정비학원/.test(t))return R(55,"자동차매매장·운전학원 75"); if(/세차|폐차|정비|검사장|차고/.test(t))return R(56,"세차·정비·차고 67");
    if(/축사|가축|도축|재배사|양돈|양계/.test(t))return R(59,"축사 등 55"); if(/온실|식물/.test(t))return R(60,"온실·식물관련 50"); if(/관리사|검역|마사/.test(t))return R(58,"동물관련 70");
    if(/종교|교회|성당|사찰|법당|기도원/.test(t))return (near||area<500)?R(41,"종교집회장 500㎡ 미만 근생 95"):R(23,"종교시설 100");
    if(/공연장|극장|영화관|집회장|예식장|회의장/.test(t))return (near||area<500)?R(41,"공연·집회 500㎡ 미만 근생 95"):R(20,"공연장·집회장 115");
    if(/전시장|박물관|미술관|동물원|식물원|수족관/.test(t))return R(21,"전시·동식물원 110"); if(/경기장|관람장|경마|경륜/.test(t))return R(22,"관람장 105");
    if(/골프장|스키장|수영장|볼링장|승마|스케이트|종합체육/.test(t))return R(24,"골프장 등 125"); if(/체육|운동|헬스|체력단련|당구|탁구|골프연습|테니스|에어로빅|낚시터/.test(t))return (near||area<500)?R(41,"체육시설 500㎡ 미만 근생 95"):R(25,"운동시설 105");
    if(near||/소매점|음식점|휴게음식|제과|이용원|미용|세탁|사진관|부동산|중개|기원|서점|독서실|동물병원|장의사|의약품|편의점|슈퍼|상점|판매/.test(t))return R(41,"근생 일반 95");
    return R(41,"매핑 실패 → 근생 95 임시 적용 (확인 필요)");}

  // 부속부분 판정: 용도 텍스트가 부속·주차장·기계실 등이면 true. '창고'는 주용도가 주거일 때만 부속(비주거 건물의 창고는 52번 창고시설).
  function isAttachedText(txt,mainUse,isRoofFloor){var t=String(txt||"");if(isRoofFloor)return true;if(ATT_RE.test(t))return true;
    if(/창고|차고/.test(t)&&(mainUse===1||mainUse===2))return true;return false;}

  /**
   * 건축물대장 층별 항목 → 계산기 행. item: {gb:'지하|지상|옥탑', no:층번호, name:'지1층', purps:'제2종근린생활시설(사무소)', area, attach:'주건축물|부속건축물', strct}
   * mainPurps: 표제부 주용도 텍스트, top: 지상 최고층수, mainArea: 건물 연면적(주용도 면적요건 판단용). 반환 행에 use/ftype/note가 채워진다.
   */
  function rowFromRegister(item,mainPurps,top,mainArea){
    var area=+item.area||0,txt=String(item.purps||""),roof=/옥탑/.test(String(item.gb||""))||/옥탑/.test(String(item.name||""));
    var mainM=mainPurps?mapUse(mainPurps,+mainArea||0):null;   // 주용도 지수는 건물 연면적 기준(사무소 500㎡ 등 면적 요건)
    var att=isAttachedText(txt,mainM?mainM.use:null,roof);
    var m=(att&&mainM)?{use:mainM.use,why:"부속부분 → 주용도("+mainPurps+") 지수 "+mainM.use+"번 적용 후 조정률 60"}:mapUse(txt,area);
    var res=(m.use===1||m.use===2),ug=/지하/.test(String(item.gb||""))||/^지/.test(String(item.name||"")),n=+item.no||parseInt((String(item.name||"").match(/\d+/)||["0"])[0],10);
    var ftype;
    if(res)ftype=att?"res_att":(m.use===1?"apt":"res");
    else if(att)ftype="park";
    else if(ug)ftype=top<=5?(n<=1?"b1":"b2"):"none";
    else ftype=n===1?"shop1":n===2?"shop2":"none";
    var flag=/확인|미상|임시/.test(m.why);
    return {floor:String(item.name||"")+(/부속/.test(String(item.attach||""))?"(부속)":""),use:m.use,useOvr:"",area:area,ftype:ftype,extra:"1",note:flag?m.why:"",why:m.why,strctNo:item.strct?mapStructure(item.strct)[0]:null,strctText:item.strct||""};
  }
  /** 단독주택(다가구·다중 제외)이면 주택 본체 면적으로 조정률Ⅲ(res_s1/res_s2) 자동 지정. 반환: 안내문 또는 null */
  function applyDandok(rows,mainPurps){
    var mp=String(mainPurps||"");
    if(!/단독주택/.test(mp)||/다가구|다중|다세대|연립|기숙사/.test(mp))return null;
    var resMain=0;rows.forEach(function(r){if(r.ftype==="res")resMain+=(+r.area||0);});
    var st=resMain>=331?"res_s2":resMain>=264?"res_s1":"res";
    rows.forEach(function(r){if(r.ftype==="res")r.ftype=st;});
    return "단독주택 주택 부분 "+resMain.toLocaleString("ko-KR",{maximumFractionDigits:2})+"㎡ → 조정률Ⅲ "+(st==="res_s2"?"140":st==="res_s1"?"120":"해당 없음(264㎡ 미만)")+" (부속 부분 제외, Ⅱ 미적용)";
  }

  /**
   * 계산. input: {year, structNo, structText?(대장 구조 텍스트 — 내용연수 그룹 판정), group?(그룹 직접 지정 1~4), built, remodel, top, landPrice, roof('1'|'0.8'|'0.6'), intel(0|1.1|1.2),
   *              rows:[{floor,use,useOvr,area,ftype,extra,strctNo?,strctText?}]}
   * 반환: {ready, missing[], year, base, sIdx, group, rr(상속·증여, 리모델링 할증 포함), rrYD(양도, 할증 없음), loc, fIdx, adjIInon, adjIIatt, nonArea, attArea, resArea, areaAll,
   *        lines:[{floor,use,u,area,sIdx,group,rr,rrYD,isRes,isAtt,adjI,adjII,ftAdj,exAdj,adj,unitSJ,unitYD,vSJ,vYD}],
   *        totSJ,totYD,resSJ,resYD,nonresSJ,nonresYD}
   */
  function compute(input){
    var year=noticeYear(input.year),base=BASE[year];
    var sNo=+input.structNo||4,sIdx=structIdx(year,sNo),sTxt=input.structText||"";
    var group=(+input.group>=1&&+input.group<=4)?+input.group:structGroup(sNo,sTxt);
    var built=+input.built||0,remodel=+input.remodel||0,top=+input.top||0;
    var loc=locIdx(year,+input.landPrice),rr=residual(year,built,group,remodel),rrYD=residual(year,built,group,0);
    var roof=+input.roof||1,intel=+input.intel||0;
    var rows=input.rows||[];
    var missing=[];if(!rows.length)missing.push("층별 면적");if(!built)missing.push("신축연도");if(!loc)missing.push("개별공시지가");
    var ready=!missing.length;
    var fIdx=floorsIdx(top),areaAll=0,nonArea=0,attArea=0,resArea=0;
    rows.forEach(function(r){var a=+r.area||0,f=ft(r.ftype);areaAll+=a;if(f[3])resArea+=a;else if(f[4])attArea+=a;else nonArea+=a;});
    var adjIInon=Math.max(fIdx||0,areaIdx(nonArea),intel||0),adjIIatt=Math.max(fIdx||0,areaIdx(attArea),intel||0);
    var lines=[],totSJ=0,totYD=0,resSJ=0,resYD=0,nonresSJ=0,nonresYD=0;
    rows.forEach(function(r,i){
      var f=ft(r.ftype),e=ex(r.extra),area=+r.area||0;
      var rsNo=r.strctNo||sNo,rsIdx=structIdx(year,rsNo);
      var rgrp=(rsNo===sNo&&!r.strctText)?group:structGroup(rsNo,r.strctText!=null&&r.strctText!==""?r.strctText:(rsNo===sNo?sTxt:""));
      var rrr=residual(year,built,rgrp,remodel),rrrYD=residual(year,built,rgrp,0);
      var u=(r.useOvr!==""&&r.useOvr!=null&&!isNaN(+r.useOvr))?+r.useOvr:useIdx(year,r.use);
      var isRes=f[3],isAtt=f[4];
      var adjI=rsIdx<100?roof:1;
      var adjII=isRes?(r.ftype==="apt"?(fIdx||1):1):(rsNo===1?1:(isAtt?adjIIatt:adjIInon));   // 통나무조는 Ⅱ 제외
      var adj=adjI*adjII*f[2]*e[2];
      var unitYD=ready?floorK(base*(rsIdx/100)*(u/100)*(loc.idx/100)*rrrYD):0;
      var unitSJ=ready?floorK(base*(rsIdx/100)*(u/100)*(loc.idx/100)*rrr*adj):0;
      var vSJ=unitSJ*area,vYD=unitYD*area;
      totSJ+=vSJ;totYD+=vYD;if(isRes){resSJ+=vSJ;resYD+=vYD;}else{nonresSJ+=vSJ;nonresYD+=vYD;}
      lines.push({floor:r.floor||("행"+(i+1)),use:r.use,u:u,area:area,sIdx:rsIdx,group:rgrp,rr:rrr,rrYD:rrrYD,isRes:isRes,isAtt:isAtt,adjI:adjI,adjII:adjII,ftAdj:f[2],exAdj:e[2],adj:adj,unitSJ:unitSJ,unitYD:unitYD,vSJ:vSJ,vYD:vYD,ftype:r.ftype});
    });
    return {ready:ready,missing:missing,year:year,base:base,sIdx:sIdx,group:group,rr:rr,rrYD:rrYD,loc:loc,fIdx:fIdx,top:top,adjIInon:adjIInon,adjIIatt:adjIIatt,
      nonArea:nonArea,attArea:attArea,resArea:resArea,areaAll:areaAll,lines:lines,totSJ:totSJ,totYD:totYD,resSJ:resSJ,resYD:resYD,nonresSJ:nonresSJ,nonresYD:nonresYD};
  }

  root.ArapGijunsiga={BASE:BASE,STRUCT:STRUCT,STRUCT_OVR:STRUCT_OVR,GROUP_OF:GROUP_OF,LIFE:LIFE,USE:USE,USE_OVR:USE_OVR,LOC:LOC,LOC_OVR:LOC_OVR,FLOORTYPE:FLOORTYPE,EXTRA:EXTRA,
    noticeYear:noticeYear,structIdx:structIdx,useIdx:useIdx,locIdx:locIdx,residual:residual,structGroup:structGroup,floorK:floorK,areaIdx:areaIdx,floorsIdx:floorsIdx,
    mapStructure:mapStructure,mapRoof:mapRoof,mapUse:mapUse,isAttachedText:isAttachedText,rowFromRegister:rowFromRegister,applyDandok:applyDandok,compute:compute};
})(typeof window!=="undefined"?window:this);
