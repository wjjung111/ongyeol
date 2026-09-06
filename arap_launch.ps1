# EXACT(구 ARAP) 실행 + 부동산원(R-ONE) 매매가격지수 자동 수신
# - 'EXACT 실행.bat'이 이 파일을 호출한다. 직접 실행해도 된다.
# - 지수 데이터(arap_index_data.js)가 없으면: 먼저 받고 앱을 연다.
# - 있으면: 앱을 먼저 열고, 하루 이상 지난 경우 백그라운드로 새로 받는다.
param([switch]$FetchOnly, [switch]$CapOnly, [switch]$JibyunOnly)   # -CapOnly: 자본수익률(비주거)만 받아 기존 데이터에 병합 / -JibyunOnly: 지가변동률(토지)만 받아 arap_jibyun_data.js 갱신 (테스트·부분갱신용)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$root     = Split-Path -Parent $MyInvocation.MyCommand.Path
$dataFile = Join-Path $root "arap_index_data.js"
$jibyunFile = Join-Path $root "arap_jibyun_data.js"   # 토지 시점수정용 지가변동률(용도지역별 월간) — arm_시점수정.html이 읽음
$htmlFile = Join-Path $root "exact_집합건물v1.0.html"
# API 키는 저장소(공개)에 올리지 않는다 — 환경변수 RONE_API_KEY 또는 로컬파일 arap_apikey.local.txt에서 읽음.
# 두 곳 다 없으면 지수 수신만 생략, 앱은 기존 데이터로 정상 작동.
$apiKey = $env:RONE_API_KEY
if (-not $apiKey) {
  $keyFile = Join-Path $root "arap_apikey.local.txt"
  if (Test-Path $keyFile) { $apiKey = (Get-Content $keyFile -Raw).Trim() }
}
$apiBase  = "https://www.reb.or.kr/r-one/openapi/SttsApiTblData.do"
$listBase = "https://www.reb.or.kr/r-one/openapi/SttsApiTbl.do"   # 통계목록(자본수익률 표 자동탐색용)

# 부동산원 API가 간헐적으로 느림 → 단일 호출 타임아웃(30초)에 걸리면 전체 수신이 중단됐음.
# 타임아웃 60초 + 최대 3회 재시도로 일시적 지연을 흡수한다(주거·비주거 공용).
function Invoke-Rone($url) {
  $attempt = 0
  while ($true) {
    $attempt++
    try { return Invoke-RestMethod -Uri $url -TimeoutSec 60 }
    catch {
      if ($attempt -ge 4) { throw }
      Write-Host ("    (재시도 {0}/3: {1})" -f $attempt, $_.Exception.Message) -ForegroundColor DarkYellow
      Start-Sleep -Seconds ([math]::Min(8, [math]::Pow(2, $attempt)))
    }
  }
}

# 매매가격지수 통계표 (R-ONE STATBL_ID, 고정값) — CLS_ID 없이 표 전체를 페이지로 받아
# CLS_FULLNM 첫 구간(시도)이 roots에 드는 지역만 저장한다. (유효한 키면 전체조회 정상 동작 — 2026-07-30 실행 #12 확인.
# 이전의 '전체조회 거부'는 잘못된 API 키(ERROR-290)가 원인이었음)
# 아파트는 구 단위까지, 연립다세대는 권역 단위까지만 공표됨. 오피스텔은 A_2024_00615 (설계문서 §API 사실관계).
$tables = [ordered]@{
  "아파트"     = @{ id = "A_2024_00045"; roots = @("서울","경기") }
  "연립다세대" = @{ id = "A_2024_00080"; roots = @("서울","경기","인천","수도권") }
  "오피스텔"   = @{ id = "A_2024_00615"; roots = @("서울","경기") }
}

# 비주거용(상업용) 시점수정용 — 상업용부동산 임대동향조사 '자본수익률'(분기)을 자동수신.
# 통계표 ID를 하드코딩하지 않고 통계목록(SttsApiTbl)에서 이름으로 자동탐색한다(오탐 방지·유지보수 용이).
# 결과 구조: capReturn.types.{유형}.regions.{지역}.{YYYYQ} = 자본수익률(%, 예 0.56). 앱 buildNrCapText가 /100 하여 복리산식에 사용.
# ※ 앱은 이 데이터가 없어도 정상 동작(자동계산만 비활성) → 실패해도 매매지수는 그대로 저장한다.
function Get-CapType($nm) {
  if ($nm -match "집합")   { return "집합상가" }
  if ($nm -match "중대형") { return "중대형상가" }
  if ($nm -match "소규모") { return "소규모상가" }
  if ($nm -match "오피스텔") { return $null }      # 오피스텔은 주택계열 — 상업용 자본수익률 아님
  if ($nm -match "오피스") { return "오피스" }
  return $null
}
function ConvertTo-QKey($w) {
  $s = ([string]$w) -replace '[^0-9A-Za-z]',''            # 2026.2 / 2026-Q2 → 20262 / 2026Q2
  if ($s -match '^(\d{4})[Qq]?0?([1-4])$')      { return "$($matches[1])$($matches[2])" }   # 20261 / 2026Q1 / 2026Q01
  if ($s -match '^(\d{4})(0[1-9]|1[0-2])$')      { $mm=[int]$matches[2]; $q=[math]::Ceiling($mm/3.0); return "$($matches[1])$q" }  # 202603(분기말월)→20261
  return $null
}
function Fetch-CapReturn {
  Write-Host "상업용부동산 자본수익률(분기) 수신 중..." -ForegroundColor Cyan
  try {
    $lurl = "{0}?Type=json&pIndex=1&pSize=1000&KEY={1}" -f $listBase, $apiKey
    $lj = Invoke-Rone $lurl
    $all = $lj.SttsApiTbl[1].row
  } catch { Write-Host "  통계목록 조회 실패(자본수익률 생략): $_" -ForegroundColor Yellow; return $null }
  if (-not $all) { Write-Host "  통계목록 비어있음 — 자본수익률 생략"; return $null }
  # 2024Q3 통계개편으로 표가 세대교체됨: 구세대는 "임대동향 자본수익률(…)", 신세대(2024년3분기~)는 "임대동향 수익률(분기)(…)"
  # 이름에 '자본수익률'만 매칭하면 신세대(최신 분기)를 놓침 → '임대동향'+'수익률'로 넓게 잡고, 행 단위 ITM_NM 필터가 자본수익률만 골라냄
  $cands = @($all | Where-Object { $_.STATBL_NM -match "임대동향" -and $_.STATBL_NM -match "수익률" })
  Write-Host ("  임대동향 수익률 통계표 후보 {0}건" -f $cands.Count)
  foreach ($c in $cands) { Write-Host ("    [{0}] {1} ({2})" -f $c.STATBL_ID, $c.STATBL_NM, $c.DTACYCLE_NM) }
  # 후보 표는 연도구간별로 쪼개져 있음(2022~, 2021, 2020, …) → 유형별로 모든 기간표를 병합해 전체 이력 확보.
  # 주기는 반드시 QY(분기)로 조회한다(목록의 DTACYCLE_CD는 '매년,분기' 복합값이라 그대로 쓰면 조회가 비어 SttsApiTblData=null).
  $byType = [ordered]@{}
  foreach ($c in $cands) {
    $kind = Get-CapType $c.STATBL_NM
    if (-not $kind) { continue }
    if (-not $byType.Contains($kind)) { $byType[$kind] = New-Object System.Collections.ArrayList }
    [void]$byType[$kind].Add([string]$c.STATBL_ID)
  }
  $types = [ordered]@{}
  $diagShown = $false
  foreach ($kind in $byType.Keys) {
    $regions = [ordered]@{}
    $latest = ""
    foreach ($sid in $byType[$kind]) {
      # 한 표가 지역 300개↑ × 분기 수십 개라 1,000행/페이지를 넘음 → 페이지를 끝까지 넘긴다 (안 그러면 최신 분기가 잘림)
      for ($pg = 1; $pg -le 40; $pg++) {
        try {
          $durl = "{0}?STATBL_ID={1}&DTACYCLE_CD=QY&Type=json&pIndex={2}&pSize=1000&KEY={3}" -f $apiBase, $sid, $pg, $apiKey
          $dj = Invoke-Rone $durl
        } catch { Write-Host ("    {0} {1} p{2} 호출실패: {3}" -f $kind, $sid, $pg, $_) -ForegroundColor Yellow; break }
        $rows = if ($dj.SttsApiTblData -and @($dj.SttsApiTblData).Count -ge 2) { $dj.SttsApiTblData[1].row } else { $null }
        if (-not $diagShown) {
          $diagShown = $true
          if ($rows -and @($rows).Count -ge 1) {
            $r0 = @($rows)[0]
            Write-Host ("    [진단] {0} 첫행: WRTTIME={1} CLS_NM={2} CLS_FULLNM={3} ITM_NM={4} DTA_VAL={5}" -f $sid, $r0.WRTTIME_IDTFR_ID, $r0.CLS_NM, $r0.CLS_FULLNM, $r0.ITM_NM, $r0.DTA_VAL) -ForegroundColor Cyan
          } else {
            $raw = ($dj | ConvertTo-Json -Depth 4 -Compress); if (-not $raw) { $raw = "(null)" }
            Write-Host ("    [진단] {0} 응답(앞400자): {1}" -f $sid, $raw.Substring(0, [math]::Min(400, $raw.Length))) -ForegroundColor Yellow
          }
        }
        if (-not $rows) { break }
        foreach ($r in $rows) {
          if ($r.ITM_NM -and ($r.ITM_NM -notmatch "자본수익률")) { continue }   # 한 표에 여러 항목(투자/소득/자본)이 섞임 — 자본수익률만
          $q = ConvertTo-QKey $r.WRTTIME_IDTFR_ID
          if (-not $q) { continue }
          # 지역은 시도 단위까지만(전체·서울·부산…). 상권 단위 300개↑는 시점수정에 안 쓰고 파일만 커짐
          $fullParts = @(([string]$r.CLS_FULLNM) -split ">")
          if ($fullParts.Count -gt 2) { continue }
          $reg = if ($r.CLS_NM) { [string]$r.CLS_NM } elseif ($r.CLS_FULLNM) { $fullParts[-1] } else { "전국" }
          $reg = $reg.Trim()
          if (-not $regions.Contains($reg)) { $regions[$reg] = [ordered]@{} }
          $regions[$reg][$q] = [math]::Round([double]$r.DTA_VAL, 2)   # 공표 자본수익률(%)은 소수 2자리
          if ($q -gt $latest) { $latest = $q }
        }
        if (@($rows).Count -lt 1000) { break }   # 마지막 페이지
      }
    }
    if ($regions.Count -eq 0) { Write-Host ("    {0} 자료없음" -f $kind) -ForegroundColor Yellow; continue }
    $types[$kind] = [ordered]@{ latest = $latest; regions = $regions }
    $sample = @($regions.Keys)[0]
    Write-Host ("    {0}: 지역 {1}개, 최신 {2}분기 (예: {3} {4}개분기)" -f $kind, $regions.Count, $latest, $sample, $regions[$sample].Count) -ForegroundColor Green
  }
  if ($types.Count -eq 0) { Write-Host "  자본수익률 표를 찾지 못함 — 앱은 수동입력으로 동작"; return $null }
  return [ordered]@{
    fetchedAt = (Get-Date -Format "yyyy-MM-dd HH:mm")
    source    = "한국부동산원 R-ONE 상업용부동산 임대동향조사 (분기) — 자본수익률"
    types     = $types
  }
}

# -CapOnly: 주거 매매지수는 그대로 두고 자본수익률만 새로 받아 기존 파일에 병합 (테스트 1회 2~3분)
# ── 토지 시점수정용 지가변동률(용도지역별 월간) — arm_시점수정.html 토지 탭이 접속할 때 프록시로 한 달씩 받던 것을 매일 파일로 미리 받아 둔다.
#    표 구조 판별·지역/용도 나누기는 arm_시점수정.html의 jbDetect/jbSplit과 같은 규칙 (수정 시 양쪽 함께).
#    결과: { fetchedAt, tbl:{id,name}, latestYm, months:[YYYYMM…], uses:[…], regs:[…], rates:{ 지역:{ 용도:{ YYYYMM: 변동률(%) } } } }
#    ※ 실패해도 매매지수·자본수익률 저장에는 영향 없음(파일이 없으면 앱은 종전대로 프록시로 받는다).
$JB_USE_RE = "주거|상업|녹지|공업|관리지역|농림|자연환경|용도"
$JB_MONTHS = 36   # 최근 36개월 (거래사례 대부분이 3년 안쪽)
function Get-JbField($r, $f) { $v = [string]$r.($f + "_NM"); if (-not $v) { $v = [string]$r.($f + "_FULLNM") }; return $v.Trim() }
function Get-JbFull($r, $f)  { $v = [string]$r.($f + "_FULLNM"); if (-not $v) { $v = [string]$r.($f + "_NM") }; return $v.Trim() }
function Get-JbRows($tblId, $ym) {
  $all = New-Object System.Collections.ArrayList
  for ($pg = 1; $pg -le 10; $pg++) {
    $url = "{0}?STATBL_ID={1}&DTACYCLE_CD=MM&WRTTIME_IDTFR_ID={2}&Type=json&pIndex={3}&pSize=1000&KEY={4}" -f $apiBase, $tblId, $ym, $pg, $apiKey
    $j = Invoke-Rone $url
    $rows = if ($j.SttsApiTblData -and @($j.SttsApiTblData).Count -ge 2) { $j.SttsApiTblData[1].row } else { $null }
    if (-not $rows) { break }
    foreach ($r in @($rows)) { [void]$all.Add($r) }
    if (@($rows).Count -lt 1000) { break }
  }
  return $all
}
function Add-Months([int]$ym, [int]$n) { $y = [math]::Floor($ym / 100); $m = ($ym % 100) + $n; $y += [math]::Floor(($m - 1) / 12); $m = ((($m - 1) % 12) + 12) % 12 + 1; return [int]($y * 100 + $m) }
function Fetch-Jibyun {
  Write-Host "지가변동률(용도지역별 월간) 수신 중..." -ForegroundColor Cyan
  # 1) 통계표: 이름에 '지가변동률'+월간, '용도지역' 들어간 것 우선. 최근 달 자료에 용도 항목이 실제로 있는 첫 표를 채택
  $lj = Invoke-Rone ("{0}?STATBL_NM={1}&Type=json&pIndex=1&pSize=500&KEY={2}" -f $listBase, [uri]::EscapeDataString("지가변동률"), $apiKey)
  $cands = @($lj.SttsApiTbl[1].row | Where-Object { $_.STATBL_NM -match "지가변동률" -and $_.DTACYCLE_NM -match "월" })
  $cands = @($cands | Sort-Object { if ($_.STATBL_NM -match "용도지역") { 0 } else { 1 } })
  foreach ($c in $cands) { Write-Host ("  [지가변동률 표 후보] {0} {1} ({2})" -f $c.STATBL_ID, $c.STATBL_NM, $c.DTACYCLE_NM) }
  if ($cands.Count -eq 0) { throw "월간 지가변동률 표를 찾지 못함" }
  $now = Get-Date; $thisYm = [int]($now.Year * 100 + $now.Month)
  $tbl = $null; $latestYm = 0; $latestRows = $null
  foreach ($c in @($cands | Select-Object -First 6)) {
    for ($back = 0; $back -le 9; $back++) {
      $ym = Add-Months $thisYm (-$back)
      $rows = Get-JbRows ([string]$c.STATBL_ID) $ym
      if ($rows.Count -eq 0) { continue }
      $hasUse = $false
      foreach ($r in $rows) { if (((Get-JbField $r "ITM") + (Get-JbFull $r "ITM") + (Get-JbFull $r "CLS")) -match $JB_USE_RE) { $hasUse = $true; break } }
      if ($hasUse) { $tbl = @{ id = [string]$c.STATBL_ID; name = [string]$c.STATBL_NM }; $latestYm = $ym; $latestRows = $rows }
      break   # 자료가 있는 가장 최근 달 하나로 판단 (용도 없으면 다음 후보 표)
    }
    if ($tbl) { break }
  }
  if (-not $tbl) { throw "용도지역별 지가변동률 표를 확정하지 못함" }
  Write-Host ("  표 확정: {0} {1} · 최신 {2}" -f $tbl.id, $tbl.name, $latestYm) -ForegroundColor Cyan
  # 2) 표 구조: 용도가 든 필드(GRP/CLS/ITM 중 용도 문구가 가장 많은 것), 지역 필드(나머지 중 값 종류가 가장 많은 것)
  $fields = @("GRP", "CLS", "ITM")
  $useF = "ITM"; $bestN = -1
  foreach ($f in $fields) { $n = @($latestRows | Where-Object { (Get-JbField $_ $f) -match $JB_USE_RE }).Count; if ($n -gt $bestN) { $bestN = $n; $useF = $f } }
  $regF = $null; $regN = -1
  foreach ($f in $fields) {
    if ($f -eq $useF) { continue }
    $set = @{}; foreach ($r in $latestRows) { $v = Get-JbFull $r $f; if ($v) { $set[$v] = 1 } }
    if ($set.Count -gt $regN) { $regN = $set.Count; $regF = $f }
  }
  $regFromUsePath = (-not $regF) -or ($regN -le 1)
  function Split-JbRow($r) {
    $use = Get-JbField $r $useF
    if ($use -notmatch $JB_USE_RE) {
      $m = @(((Get-JbFull $r $useF) -split ">") | ForEach-Object { $_.Trim() } | Where-Object { $_ -match $JB_USE_RE })
      if ($m.Count -gt 0) { $use = $m[-1] }
    }
    if ($regFromUsePath) { $reg = ((((Get-JbFull $r $useF) -split ">") | ForEach-Object { $_.Trim() } | Where-Object { $_ -and $_ -ne $use }) -join " > ") }
    else { $reg = ((((Get-JbFull $r $regF) -split ">") | ForEach-Object { $_.Trim() } | Where-Object { $_ }) -join " > ") }
    return @{ reg = $reg; use = $use }
  }
  # 3) 최근 N개월 값 수집
  $rates = [ordered]@{}; $regs = New-Object System.Collections.ArrayList; $uses = New-Object System.Collections.ArrayList; $months = New-Object System.Collections.ArrayList
  for ($back = 0; $back -lt $JB_MONTHS; $back++) {
    $ym = Add-Months $latestYm (-$back)
    $rows = if ($back -eq 0) { $latestRows } else { Get-JbRows $tbl.id $ym }
    if ($rows.Count -eq 0) { Write-Host ("    {0}: 자료 없음" -f $ym) -ForegroundColor Yellow; continue }
    $cnt = 0
    foreach ($r in $rows) {
      $x = Split-JbRow $r
      if (-not $x.reg -or -not $x.use) { continue }
      $v = [string]$r.DTA_VAL; if ($v -eq "") { continue }
      if (-not $rates.Contains($x.reg)) { $rates[$x.reg] = [ordered]@{}; [void]$regs.Add($x.reg) }
      if (-not $rates[$x.reg].Contains($x.use)) { $rates[$x.reg][$x.use] = [ordered]@{} }
      $rates[$x.reg][$x.use][[string]$ym] = [double]$v
      if (-not $uses.Contains($x.use)) { [void]$uses.Add($x.use) }
      $cnt++
    }
    [void]$months.Add([string]$ym)
    Write-Host ("    {0}: {1}행" -f $ym, $cnt)
  }
  if ($regs.Count -eq 0) { throw "지가변동률 표 구조를 해석하지 못함" }
  $out = [ordered]@{
    fetchedAt = (Get-Date -Format "yyyy-MM-dd HH:mm")
    source    = "한국부동산원 R-ONE 지가변동률 (용도지역별 월간)"
    tbl       = [ordered]@{ id = $tbl.id; name = $tbl.name }
    latestYm  = $latestYm
    months    = @($months | Sort-Object)
    uses      = @($uses)
    regs      = @($regs)
    rates     = $rates
  }
  $json = $out | ConvertTo-Json -Depth 8 -Compress
  $tmp = $jibyunFile + ".tmp"
  [IO.File]::WriteAllText($tmp, "window.ARAP_JIBYUN_DATA=" + $json + ";", (New-Object Text.UTF8Encoding($false)))
  Move-Item -Force $tmp $jibyunFile
  Write-Host ("완료: {0} (지역 {1}개 · 용도 {2}개 · {3}개월 · 최신 {4})" -f (Split-Path -Leaf $jibyunFile), $regs.Count, $uses.Count, $months.Count, $latestYm) -ForegroundColor Green
}

function Update-CapReturnOnly {
  if (-not $apiKey) { throw "API 키가 없습니다. (환경변수 RONE_API_KEY 또는 arap_apikey.local.txt)" }
  if (-not (Test-Path $dataFile)) { throw "기존 arap_index_data.js가 없습니다. 전체 수신(-FetchOnly)을 먼저 실행하세요." }
  $txt = [IO.File]::ReadAllText($dataFile)
  $json = $txt -replace '^\s*window\.ARAP_INDEX_DATA\s*=\s*', ''
  $json = $json.TrimEnd().TrimEnd(';')
  $out = $json | ConvertFrom-Json
  $cap = Fetch-CapReturn
  if (-not $cap) { throw "자본수익률 수신 실패 — 기존 파일은 그대로 둠" }
  $out | Add-Member -NotePropertyName capReturn -NotePropertyValue $cap -Force
  $js = "window.ARAP_INDEX_DATA=" + ($out | ConvertTo-Json -Depth 8 -Compress) + ";"
  $tmp = $dataFile + ".tmp"
  [IO.File]::WriteAllText($tmp, $js, (New-Object Text.UTF8Encoding($false)))
  Move-Item -Force $tmp $dataFile
  Write-Host ("완료(자본수익률만 갱신): {0}" -f (@($cap.types.Keys) -join "/")) -ForegroundColor Green
}

function Fetch-IndexData {
  if (-not $apiKey) {
    throw "API 키가 없습니다. 같은 폴더에 'arap_apikey.local.txt' 파일을 만들고 부동산원 R-ONE 인증키를 한 줄로 넣으세요. (환경변수 RONE_API_KEY 로 넣어도 됨)"
  }
  Write-Host "부동산원 매매가격지수 수신 중..." -ForegroundColor Cyan
  # 오피스텔 지역별 표 자동 탐색 — 이름만으론 구분 불가(#16: '매매가격지수(시계열)' A_2024_00615가 실제론 전국 규모별 표).
  # 월간 오피스텔 표 후보를 하나씩 열어 서울/경기 지역이 실제로 들어있는 첫 표를 채택한다. 없으면 오피스텔은 생략.
  try {
    $lj = Invoke-Rone ("{0}?Type=json&pIndex=1&pSize=1000&KEY={1}" -f $listBase, $apiKey)
    $cands = @($lj.SttsApiTbl[1].row | Where-Object { $_.STATBL_NM -match "오피스텔" -and $_.DTACYCLE_NM -match "월" })
    foreach ($c in $cands) { Write-Host ("  [오피스텔 표 후보] {0} {1} ({2})" -f $c.STATBL_ID, $c.STATBL_NM, $c.DTACYCLE_NM) }
    $found = $null
    foreach ($c in $cands) {
      if ($c.STATBL_NM -match "전세|월세|수급|거래|규모별") { continue }   # 매매가격지수 계열만
      $j = Invoke-Rone ("{0}?STATBL_ID={1}&DTACYCLE_CD=MM&Type=json&pIndex=1&pSize=1000&KEY={2}" -f $apiBase, $c.STATBL_ID, $apiKey)
      $rows = if ($j.SttsApiTblData -and @($j.SttsApiTblData).Count -ge 2) { $j.SttsApiTblData[1].row } else { $null }
      $regionNames = [ordered]@{}
      $ok = $false
      if ($rows) {
        foreach ($r in $rows) {
          $fn = [string]$r.CLS_FULLNM
          if ($regionNames.Count -lt 15 -and -not $regionNames.Contains($fn)) { $regionNames[$fn] = 1 }
          foreach ($sg in ($fn -split ">")) { $s = $sg.Trim(); if ($s -like "서울*" -or $s -like "경기*") { $ok = $true; break } }
          if ($ok) { break }
        }
      }
      Write-Host ("  [오피스텔 후보검사] {0} → 서울/경기 {1} (지역 예: {2})" -f $c.STATBL_ID, $(if ($ok) { "있음" } else { "없음" }), (@($regionNames.Keys) -join " | "))
      if ($ok) { $found = [string]$c.STATBL_ID; break }
    }
    if ($found) {
      if ($found -ne $tables["오피스텔"].id) { Write-Host ("  오피스텔 표 확정: {0}" -f $found) -ForegroundColor Cyan }
      $tables["오피스텔"].id = $found
    } else {
      Write-Host "  오피스텔 지역별 월간 표를 찾지 못함 — 오피스텔 생략" -ForegroundColor Yellow
      $tables.Remove("오피스텔")
    }
  } catch { Write-Host "  오피스텔 표 탐색 실패(기존 ID로 진행): $_" -ForegroundColor Yellow }
  $out = [ordered]@{
    fetchedAt = (Get-Date -Format "yyyy-MM-dd HH:mm")
    source    = "한국부동산원 R-ONE 전국주택가격동향조사 (월간)"
    tables    = [ordered]@{}
  }
  foreach ($kind in $tables.Keys) {
    $t = $tables[$kind]
    $byFull = [ordered]@{}   # CLS_FULLNM → {cls, full, s}
    $latest = ""
    Write-Host ("  {0} ({1}) 전체 수신·필터링..." -f $kind, ($t.roots -join "/"))
    $gotRows = $false
    $firstRow = $null       # 전부 걸러졌을 때 원인 진단용 샘플
    $distinctCls = [ordered]@{}   # 전부 걸러졌을 때 지역명 목록 출력용 (최대 25개)
    for ($pg = 1; $pg -le 150; $pg++) {
      $url = "{0}?STATBL_ID={1}&DTACYCLE_CD=MM&Type=json&pIndex={2}&pSize=1000&KEY={3}" -f $apiBase, $t.id, $pg, $apiKey
      $j = Invoke-Rone $url
      $rows = if ($j.SttsApiTblData -and @($j.SttsApiTblData).Count -ge 2) { $j.SttsApiTblData[1].row } else { $null }
      if (-not $rows) {
        # 빈 응답의 원문을 표당 1회 출력 — RESULT 코드(337 트래픽 제한, 290 키 무효 등)가 그대로 보임
        if ($pg -eq 1) {
          $raw = ($j | ConvertTo-Json -Depth 5 -Compress); if (-not $raw) { $raw = "(null)" }
          Write-Host ("    [빈응답 원문] {0}" -f $raw.Substring(0, [math]::Min(600, $raw.Length))) -ForegroundColor Yellow
        }
        break
      }
      $gotRows = $true
      if (-not $firstRow -and @($rows).Count -ge 1) { $firstRow = @($rows)[0] }
      foreach ($r in $rows) {
        if ($r.ITM_NM -and ($r.ITM_NM -notmatch "지수")) { continue }       # 표에 지수 외 항목이 섞여도 지수만
        if ($r.ITM_NM -and ($r.ITM_NM -match "전세|월세")) { continue }     # 매매가격지수만 (오피스텔 표 대비)
        $full = [string]$r.CLS_FULLNM
        if ($distinctCls.Count -lt 25 -and -not $distinctCls.Contains($full)) { $distinctCls[$full] = 1 }
        # 시도 판정: 경로 어느 구간이든 roots로 시작하면 채택 — 표마다 '수도권>서울', '서울특별시' 등 표기가 제각각(#14·#15)
        $hit = $false
        foreach ($sg in ($full -split ">")) {
          $sgt = $sg.Trim()
          foreach ($rt in $t.roots) { if ($sgt -like ($rt + "*")) { $hit = $true; break } }
          if ($hit) { break }
        }
        if (-not $hit) { continue }
        if (-not $byFull.Contains($full)) {
          $cid = 0; if ($r.PSObject.Properties["CLS_ID"] -and $r.CLS_ID) { $cid = [int]$r.CLS_ID }
          $byFull[$full] = [ordered]@{ cls = $cid; full = $full; s = [ordered]@{} }
        }
        $ym = [string]$r.WRTTIME_IDTFR_ID
        # 공표 지수는 소수 1자리 — 산식 표기와 일치하도록 반올림 저장
        $byFull[$full].s[$ym] = [math]::Round([double]$r.DTA_VAL, 1)
        if ($ym -gt $latest) { $latest = $ym }
      }
      if (@($rows).Count -lt 1000) { break }
    }
    if (-not $gotRows -or $byFull.Count -eq 0) {
      Write-Host ("    {0} 자료없음 — 이 표는 생략" -f $kind) -ForegroundColor Yellow
      if ($firstRow) { Write-Host ("    [샘플행] CLS_FULLNM={0} ITM_NM={1} WRTTIME={2}" -f $firstRow.CLS_FULLNM, $firstRow.ITM_NM, $firstRow.WRTTIME_IDTFR_ID) -ForegroundColor Yellow }
      if ($distinctCls.Count -gt 0) { Write-Host ("    [지역명 목록] {0}" -f (@($distinctCls.Keys) -join " | ")) -ForegroundColor Yellow }
      continue
    }
    # 표시명 = 마지막 구간. 시도 간 동명(예: 서울 중구/인천 중구) 충돌 시 '시도 이름'으로 구분
    $regions = [ordered]@{}
    foreach ($full in $byFull.Keys) {
      $parts = $full -split ">"
      $name = $parts[-1].Trim()
      if ($regions.Contains($name)) { $name = "{0} {1}" -f $parts[0].Trim(), $name }
      $regions[$name] = $byFull[$full]
    }
    Write-Host ("    {0}: 지역 {1}개, 최신 {2}" -f $kind, $regions.Count, $latest) -ForegroundColor Green
    $out.tables[$kind] = [ordered]@{ statblId = $t.id; latest = $latest; regions = $regions }
  }
  if (-not $out.tables.Contains("아파트")) { throw "아파트 지수 수신 실패 — 기존 파일 유지" }
  # 비주거용 자본수익률(분기) — 실패해도 매매지수는 정상 저장
  try { $cap = Fetch-CapReturn; if ($cap) { $out.capReturn = $cap } }
  catch { Write-Host "자본수익률 수신 실패(매매지수는 정상 저장): $_" -ForegroundColor Yellow }
  $json = $out | ConvertTo-Json -Depth 8 -Compress
  $js = "window.ARAP_INDEX_DATA=" + $json + ";"
  $tmp = $dataFile + ".tmp"
  [IO.File]::WriteAllText($tmp, $js, (New-Object Text.UTF8Encoding($false)))
  Move-Item -Force $tmp $dataFile
  $capNote = if ($out.capReturn) { "자본수익률 " + (@($out.capReturn.types.Keys) -join "/") } else { "자본수익률 없음" }
  Write-Host ("완료: {0} (매매지수 최신 {1} · {2})" -f (Split-Path -Leaf $dataFile), $out.tables["아파트"].latest, $capNote) -ForegroundColor Green
}

if ($CapOnly) { Update-CapReturnOnly; exit 0 }
if ($JibyunOnly) { if (-not $apiKey) { throw "API 키가 없습니다 (RONE_API_KEY)" }; Fetch-Jibyun; exit 0 }

$hasData = Test-Path $dataFile

if (-not $FetchOnly -and $hasData) {
  # 앱부터 즉시 열고, 데이터가 하루 이상 묵었으면 조용히 갱신 (다음 새로고침/실행부터 반영)
  Start-Process $htmlFile
  $ageDays = ((Get-Date) - (Get-Item $dataFile).LastWriteTime).TotalDays
  if ($ageDays -gt 1) {
    try { Fetch-IndexData } catch { Write-Host "지수 갱신 실패(오프라인?) — 기존 데이터 사용: $_" -ForegroundColor Yellow }
  }
}
else {
  # 첫 실행(데이터 없음) 또는 FetchOnly: 받고 나서 연다
  try { Fetch-IndexData }
  catch {
    Write-Host "지수 수신 실패: $_" -ForegroundColor Red
    if ($FetchOnly) { exit 1 }   # Actions에서는 실패를 빨간불로 표시 (조용한 실패가 키 오류를 나흘간 가림 — #1~#8)
    Write-Host "인터넷 연결을 확인하세요. 데이터 없이 앱만 엽니다. (자동계산 버튼은 비활성 안내가 뜹니다)"
    Start-Sleep -Seconds 3
  }
  # 토지 시점수정용 지가변동률 — 실패해도 매매지수 저장에는 영향 없음
  if ($FetchOnly) { try { Fetch-Jibyun } catch { Write-Host "지가변동률 수신 실패(매매지수는 정상 저장): $_" -ForegroundColor Yellow } }
  if (-not $FetchOnly) { Start-Process $htmlFile }
}
