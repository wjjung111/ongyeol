$ErrorActionPreference='Stop'
$tokens=$null;$errors=$null
$ast=[System.Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot '..\arap_launch.ps1'),[ref]$tokens,[ref]$errors)
if($errors.Count){throw ($errors|Out-String)}
$loop=$ast.FindAll({param($n) $n -is [System.Management.Automation.Language.ForEachStatementAst] -and $n.Extent.Text.StartsWith('foreach ($r in $rows)') -and $n.Extent.Text.Contains('$precision = if ($kind')},$true)
if($loop.Count -ne 1){throw 'monthly collector not found'}
$kind='오피스텔';$t=@{roots=@('서울','경기')};$byFull=[ordered]@{};$distinctCls=[ordered]@{};$latest=''
$rows=@(
 [pscustomobject]@{ITM_NM='지수';CLS_NM='전체';GRP_FULLNM='서울>서남권';CLS_FULLNM='전체';WRTTIME_IDTFR_ID='202608';DTA_VAL='100.5812'},
 [pscustomobject]@{ITM_NM='지수';CLS_NM='40㎡이하';GRP_FULLNM='서울>서남권';CLS_FULLNM='40㎡이하';WRTTIME_IDTFR_ID='202608';DTA_VAL='999'},
 [pscustomobject]@{ITM_NM='전세지수';CLS_NM='전체';GRP_FULLNM='서울>서남권';CLS_FULLNM='전체';WRTTIME_IDTFR_ID='202609';DTA_VAL='999'}
)
. ([scriptblock]::Create($loop[0].Extent.Text))
if($byFull.Count -ne 1 -or $byFull['서울>서남권'].s['202608'] -ne 100.58 -or $latest -ne '202608'){throw 'wrong office region/size/precision'}
Write-Output 'PASS launcher officetel: regional overall-sale series and two decimal precision'
