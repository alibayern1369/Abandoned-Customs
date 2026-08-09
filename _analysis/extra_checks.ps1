$ErrorActionPreference = 'Stop'
$outDir = 'D:\نرم افزار متروکه\_analysis'
$enc = New-Object System.Text.UTF8Encoding $true

function Load-Tsv([string]$path) {
  $L = [System.IO.File]::ReadAllLines($path, $enc)
  $H = $L[0].Split("`t")
  $R = New-Object System.Collections.Generic.List[object]
  for ($i = 1; $i -lt $L.Length; $i++) {
    if ([string]::IsNullOrWhiteSpace($L[$i])) { continue }
    $p = $L[$i].Split("`t")
    $o = @{}
    for ($c = 0; $c -lt $H.Length; $c++) {
      $o[$H[$c]] = if ($c -lt $p.Length) { $p[$c] } else { '' }
    }
    $o['_r'] = $i + 1
    [void]$R.Add($o)
  }
  return @{ headers = $H; rows = $R }
}

$s1 = Load-Tsv (Join-Path $outDir 'sheet_1_data.tsv')
$s2 = Load-Tsv (Join-Path $outDir 'sheet_2_data.tsv')
$s3 = Load-Tsv (Join-Path $outDir 'sheet_3_data.tsv')
$rows = $s1.rows
$h = $s1.headers

$cCot = $h[1]
$cDate = $h[2]
$cTar = $h[3]
$cDesc = $h[4]
$cW = $h[5]
$cRial = $h[6]
$cCur = $h[7]
$cWh = $h[8]
$cRights = $h[11]
$cVar = $h[12]
$cStatus = $h[13]
$cAnn = $h[14]
$cExit = $h[15]

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('PAIR_203782')
foreach ($r in $rows) {
  if ($r[$cCot].Trim() -eq '203782') {
    [void]$sb.AppendLine("row=$($r['_r']) tariff=$($r[$cTar]) desc=$($r[$cDesc]) w=$($r[$cW]) rial=$($r[$cRial]) cur=$($r[$cCur]) wh=$($r[$cWh]) rights=$($r[$cRights]) status=$($r[$cStatus]) ann=$($r[$cAnn]) exit=$($r[$cExit])")
  }
}

[void]$sb.AppendLine('STATUS_INCONSISTENT')
$bad = @($rows | Where-Object { $_.$cStatus.Trim() -eq 'خارج نشده' -and $_.$cExit.Trim() -ne 'کالا از گمرک خارج نشده است' })
# hashtable access
$bad = New-Object System.Collections.Generic.List[object]
foreach ($r in $rows) {
  if ($r[$cStatus].Trim() -eq 'خارج نشده' -and $r[$cExit].Trim() -ne 'کالا از گمرک خارج نشده است') {
    [void]$bad.Add($r)
  }
}
[void]$sb.AppendLine("count=$($bad.Count)")
$exitGroups = @{}
foreach ($r in $bad) {
  $e = $r[$cExit].Trim()
  if ($exitGroups.ContainsKey($e)) { $exitGroups[$e]++ } else { $exitGroups[$e] = 1 }
  if ($bad.IndexOf($r) -lt 8) {
    [void]$sb.AppendLine("cotage=$($r[$cCot]) exit=$e ann=$($r[$cAnn])")
  }
}
foreach ($e in $exitGroups.GetEnumerator()) { [void]$sb.AppendLine("badExit|$($e.Key)=$($e.Value)") }

[void]$sb.AppendLine('NUMBER_FORMATS')
$rialComma = 0; $rialPlain = 0; $rialOther = 0
$wDot = 0; $rightsComma = 0; $rightsEmpty = 0
foreach ($r in $rows) {
  $rial = $r[$cRial].Trim()
  if ($rial -match ',') { $rialComma++ }
  elseif ($rial -match '^\d+(\.\d+)?$') { $rialPlain++ }
  else { $rialOther++; [void]$sb.AppendLine("rialOtherSample|$rial") }
  if ($r[$cW] -match '\.') { $wDot++ }
  if ($r[$cRights].Trim() -eq '') { $rightsEmpty++ }
  elseif ($r[$cRights] -match ',') { $rightsComma++ }
}
[void]$sb.AppendLine("rial comma=$rialComma plain=$rialPlain other=$rialOther")
[void]$sb.AppendLine("weightDot=$wDot rightsEmpty=$rightsEmpty rightsComma=$rightsComma")

[void]$sb.AppendLine('DATE_SAMPLES')
$seen = @{}
$count = 0
foreach ($r in $rows) {
  $d = $r[$cDate]
  if (-not $seen.ContainsKey($d)) {
    $seen[$d] = 1
    [void]$sb.AppendLine("date|$d")
    $count++
    if ($count -ge 15) { break }
  }
}

[void]$sb.AppendLine('ANNOUNCE_TOP')
$annG = @{}
foreach ($r in $rows) {
  $a = $r[$cAnn].Trim()
  if ($a -eq '') { continue }
  if ($annG.ContainsKey($a)) { $annG[$a]++ } else { $annG[$a] = 1 }
}
$annG.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 30 | ForEach-Object {
  [void]$sb.AppendLine("$($_.Value)|$($_.Key)")
}

function MakeKey($r) {
  return (@($r[$cCot], $r[$cTar], $r[$cDesc], $r[$cW], $r[$cRial], $r[$cWh]) -join '||')
}
$set23 = @{}
foreach ($r in $s2.rows) { $set23[(MakeKey $r)] = 1 }
foreach ($r in $s3.rows) { $set23[(MakeKey $r)] = 1 }
$only = New-Object System.Collections.Generic.List[object]
foreach ($r in $rows) {
  if (-not $set23.ContainsKey((MakeKey $r))) { [void]$only.Add($r) }
}
[void]$sb.AppendLine("ONLY_S1 count=$($only.Count)")
$st = @{}; $years = @{}; $annE = 0; $exNE = 0; $riE = 0
foreach ($r in $only) {
  $s = $r[$cStatus].Trim()
  if ($st.ContainsKey($s)) { $st[$s]++ } else { $st[$s] = 1 }
  if ($r[$cAnn].Trim() -eq '') { $annE++ }
  if ($r[$cExit].Trim() -eq 'کالا از گمرک خارج نشده است') { $exNE++ }
  if ($r[$cRights].Trim() -eq '') { $riE++ }
  if ($r[$cDate] -match '^(\d{4})') {
    $y = $Matches[1]
    if ($years.ContainsKey($y)) { $years[$y]++ } else { $years[$y] = 1 }
  }
}
foreach ($e in $st.GetEnumerator()) { [void]$sb.AppendLine("onlyStatus|$($e.Key)=$($e.Value)") }
foreach ($e in $years.GetEnumerator()) { [void]$sb.AppendLine("onlyYear|$($e.Key)=$($e.Value)") }
[void]$sb.AppendLine("only annEmpty=$annE exitNE=$exNE rightsEmpty=$riE")

[void]$sb.AppendLine('YE_KE_STATS')
$arabYe = 0; $persYe = 0; $arabKe = 0; $persKe = 0
foreach ($r in $rows) {
  $d = $r[$cDesc]
  if ($d.Contains([char]0x064A)) { $arabYe++ }
  if ($d.Contains([char]0x06CC)) { $persYe++ }
  if ($d.Contains([char]0x0643)) { $arabKe++ }
  if ($d.Contains([char]0x06A9)) { $persKe++ }
}
[void]$sb.AppendLine("desc arabicYeRows=$arabYe persianYeRows=$persYe arabicKeRows=$arabKe persianKeRows=$persKe")

[void]$sb.AppendLine('VARIZI')
$vg = @{}
foreach ($r in $rows) {
  $v = $r[$cVar].Trim()
  if ($vg.ContainsKey($v)) { $vg[$v]++ } else { $vg[$v] = 1 }
}
foreach ($e in $vg.GetEnumerator()) { [void]$sb.AppendLine("varizi|$($e.Key)=$($e.Value)") }

[void]$sb.AppendLine('S2_S3_STATUS')
$g2 = @{}; foreach ($r in $s2.rows) { $s=$r[$cStatus].Trim(); if ($g2.ContainsKey($s)){$g2[$s]++}else{$g2[$s]=1} }
$g3 = @{}; foreach ($r in $s3.rows) { $s=$r[$cStatus].Trim(); if ($g3.ContainsKey($s)){$g3[$s]++}else{$g3[$s]=1} }
foreach ($e in $g2.GetEnumerator()) { [void]$sb.AppendLine("s2|$($e.Key)=$($e.Value)") }
foreach ($e in $g3.GetEnumerator()) { [void]$sb.AppendLine("s3|$($e.Key)=$($e.Value)") }

# Check if rial values with commas are the only-in-S1 rows
$onlyComma = 0; $onlyPlain = 0
foreach ($r in $only) {
  if ($r[$cRial] -match ',') { $onlyComma++ } else { $onlyPlain++ }
}
[void]$sb.AppendLine("onlyRial comma=$onlyComma plain=$onlyPlain")
$mainComma = 0; $mainPlain = 0
foreach ($r in $rows) {
  if ($set23.ContainsKey((MakeKey $r))) {
    if ($r[$cRial] -match ',') { $mainComma++ } else { $mainPlain++ }
  }
}
[void]$sb.AppendLine("in23Rial comma=$mainComma plain=$mainPlain")

# Persian digits scan all fields
$pdRows = 0
foreach ($r in $rows) {
  $hit = $false
  foreach ($k in $h) {
    if ($r[$k] -match '[۰-۹]') { $hit = $true; break }
  }
  if ($hit) { $pdRows++ }
}
[void]$sb.AppendLine("rowsWithPersianDigits=$pdRows")

# Leading zeros / alphanumeric warehouse
[void]$sb.AppendLine('WAREHOUSE_NONNUMERIC')
foreach ($r in $rows) {
  $w = $r[$cWh].Trim()
  if ($w -notmatch '^\d+$') {
    [void]$sb.AppendLine("wh=$w cotage=$($r[$cCot])")
  }
}

[System.IO.File]::WriteAllText((Join-Path $outDir 'extra_checks.txt'), $sb.ToString(), $enc)
Write-Host 'EXTRA DONE'
