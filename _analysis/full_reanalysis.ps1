# Comprehensive re-analysis of three Excel sources under confirmed business rules
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$outDir = 'D:\نرم افزار متروکه\_analysis'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function Find-SourceDir {
  foreach ($d in [IO.Directory]::GetDirectories('d:\Files\Amar\1405')) {
    $name = [IO.Path]::GetFileName($d)
    if ($name -match 'آپدیت') { return $d }
  }
  throw 'Source directory not found'
}

function Get-SourceFiles([string]$dir) {
  $map = @{}
  foreach ($f in [IO.Directory]::GetFiles($dir)) {
    $fn = [IO.Path]::GetFileName($f)
    if ($fn.StartsWith('~$')) { continue }
    $ext = [IO.Path]::GetExtension($f).ToLowerInvariant()
    $size = [IO.FileInfo]::new($f).Length
    if ($ext -eq '.xlsx' -and $size -gt 100000 -and $fn -match 'کیش') { $map['file1'] = $f }
    elseif ($ext -eq '.xlsx' -and $size -gt 50000 -and $fn -match 'سامانه') { $map['file2'] = $f }
    elseif ($ext -eq '.xls' -and $fn -match 'اتوماسیون') { $map['file3'] = $f }
  }
  # Fallback by size/extension if name match fails due to encoding
  if (-not $map.ContainsKey('file1') -or -not $map.ContainsKey('file2') -or -not $map.ContainsKey('file3')) {
    $xlsx = @(); $xls = @()
    foreach ($f in [IO.Directory]::GetFiles($dir)) {
      $fn = [IO.Path]::GetFileName($f)
      if ($fn.StartsWith('~$')) { continue }
      $ext = [IO.Path]::GetExtension($f).ToLowerInvariant()
      $size = [IO.FileInfo]::new($f).Length
      if ($ext -eq '.xlsx') { $xlsx += [pscustomobject]@{ Path=$f; Size=$size; Name=$fn } }
      if ($ext -eq '.xls') { $xls += [pscustomobject]@{ Path=$f; Size=$size; Name=$fn } }
    }
    $xlsx = $xlsx | Sort-Object Size -Descending
    if (-not $map.ContainsKey('file1') -and $xlsx.Count -ge 1) { $map['file1'] = $xlsx[0].Path }
    if (-not $map.ContainsKey('file2') -and $xlsx.Count -ge 2) {
      # pick سامانه-like: second largest xlsx that isn't the dated "18" file if possible
      foreach ($x in $xlsx) {
        if ($x.Path -ne $map['file1'] -and $x.Size -gt 50000) { $map['file2'] = $x.Path; break }
      }
    }
    if (-not $map.ContainsKey('file3') -and $xls.Count -ge 1) { $map['file3'] = $xls[0].Path }
  }
  return $map
}

function Norm-Digits([string]$s) {
  if ($null -eq $s) { return '' }
  $s = $s.Trim()
  $sb = New-Object System.Text.StringBuilder
  foreach ($ch in $s.ToCharArray()) {
    $code = [int][char]$ch
    if ($code -ge 0x06F0 -and $code -le 0x06F9) { [void]$sb.Append([char](0x30 + ($code - 0x06F0))) }
    elseif ($code -ge 0x0660 -and $code -le 0x0669) { [void]$sb.Append([char](0x30 + ($code - 0x0660))) }
    else { [void]$sb.Append($ch) }
  }
  return $sb.ToString()
}

function Norm-Kootaj([object]$v) {
  if ($null -eq $v) { return '' }
  if ($v -is [double] -or $v -is [decimal] -or $v -is [int] -or $v -is [long]) {
    return ([math]::Truncate([double]$v)).ToString([Globalization.CultureInfo]::InvariantCulture)
  }
  $s = Norm-Digits([string]$v)
  $s = $s -replace '[^\d]', ''
  # strip leading zeros but keep at least one digit if all zeros
  if ($s -match '^0+$') { return '0' }
  $s = $s.TrimStart('0')
  return $s
}

function CellStr([object]$v) {
  if ($null -eq $v) { return '' }
  return ([string]$v).Trim()
}

function IsNumLike([object]$v) {
  if ($null -eq $v) { return $false }
  if ($v -is [double] -or $v -is [decimal] -or $v -is [int] -or $v -is [long]) { return $true }
  $s = (Norm-Digits([string]$v)) -replace ',', '' -replace ' ', ''
  return ($s -match '^-?\d+(\.\d+)?$')
}

function ToNum([object]$v) {
  if ($null -eq $v -or (CellStr $v) -eq '') { return $null }
  if ($v -is [double] -or $v -is [decimal] -or $v -is [int] -or $v -is [long]) { return [double]$v }
  $s = (Norm-Digits([string]$v)) -replace ',', '' -replace ' ', ''
  $n = 0.0
  if ([double]::TryParse($s, [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref]$n)) { return $n }
  return $null
}

function Read-Sheet($ws) {
  $used = $ws.UsedRange
  if ($null -eq $used) {
    return @{ name=$ws.Name; rows=0; cols=0; headers=@(); data=@() }
  }
  $rowCount = [int]$used.Rows.Count
  $colCount = [int]$used.Columns.Count
  $vals = $used.Value2
  $headers = @()
  for ($c=1; $c -le $colCount; $c++) {
    $h = $vals[1,$c]
    if ($null -eq $h) { $headers += "BLANK_$c" } else { $headers += ([string]$h).Trim() }
  }
  $data = New-Object System.Collections.Generic.List[object]
  for ($r=2; $r -le $rowCount; $r++) {
    $row = [ordered]@{}
    $empty = $true
    for ($c=1; $c -le $colCount; $c++) {
      $v = $vals[$r,$c]
      $row[$headers[$c-1]] = $v
      if ($null -ne $v -and (CellStr $v) -ne '') { $empty = $false }
    }
    if (-not $empty) { $data.Add($row) }
  }
  return @{ name=$ws.Name; rows=$data.Count; cols=$colCount; headers=$headers; data=$data }
}

function Find-Col([string[]]$headers, [string[]]$candidates) {
  foreach ($cand in $candidates) {
    for ($i=0; $i -lt $headers.Count; $i++) {
      if ($headers[$i] -eq $cand -or $headers[$i] -like "*$cand*") { return $headers[$i] }
    }
  }
  return $null
}

function Analyze-Duplicates($rows, [string]$keyCol, [string[]]$compareCols) {
  $groups = @{}
  foreach ($row in $rows) {
    $k = Norm-Kootaj $row[$keyCol]
    if ($k -eq '') { continue }
    if (-not $groups.ContainsKey($k)) { $groups[$k] = New-Object System.Collections.Generic.List[object] }
    $groups[$k].Add($row)
  }
  $multi = $groups.GetEnumerator() | Where-Object { $_.Value.Count -gt 1 } | Sort-Object { $_.Value.Count } -Descending
  $result = [ordered]@{
    totalRows = $rows.Count
    uniqueKeys = ($groups.Keys | Measure-Object).Count
    dupKeyCount = ($multi | Measure-Object).Count
    examples = @()
    fieldBehavior = @{}
  }
  foreach ($col in $compareCols) {
    $result.fieldBehavior[$col] = [ordered]@{
      sameAcrossDupRows = 0
      differAcrossDupRows = 0
      allEqualInGroup_examples = @()
      differInGroup_examples = @()
      sumVsFirstEqual = 0
      sumVsFirstDiffer = 0
      maxVsFirstEqual = 0
    }
  }
  $shown = 0
  foreach ($g in $multi) {
    $k = $g.Key
    $list = $g.Value
    if ($shown -lt 8) {
      $ex = [ordered]@{ kootaj=$k; count=$list.Count; rows=@() }
      foreach ($r in $list) {
        $snap = [ordered]@{}
        foreach ($c in $compareCols) { $snap[$c] = CellStr $r[$c] }
        $ex.rows += $snap
      }
      $result.examples += $ex
      $shown++
    }
    foreach ($col in $compareCols) {
      $vals = @()
      foreach ($r in $list) { $vals += ,(CellStr $r[$col]) }
      $uniq = ($vals | Select-Object -Unique)
      if ($uniq.Count -le 1) {
        $result.fieldBehavior[$col].sameAcrossDupRows++
      } else {
        $result.fieldBehavior[$col].differAcrossDupRows++
        if ($result.fieldBehavior[$col].differInGroup_examples.Count -lt 3) {
          $result.fieldBehavior[$col].differInGroup_examples += [ordered]@{ kootaj=$k; values=$uniq }
        }
      }
      # numeric aggregation checks
      $nums = @()
      foreach ($r in $list) {
        $n = ToNum $r[$col]
        if ($null -ne $n) { $nums += $n }
      }
      if ($nums.Count -eq $list.Count -and $nums.Count -gt 1) {
        $first = $nums[0]
        $sum = ($nums | Measure-Object -Sum).Sum
        $max = ($nums | Measure-Object -Maximum).Maximum
        $allSame = ($nums | Select-Object -Unique).Count -eq 1
        if ($allSame) {
          # repeated total pattern: first == each == max, and sum != first (unless zero)
          $result.fieldBehavior[$col].maxVsFirstEqual++
        } else {
          # varying values: check if first equals sum? (unlikely)
          if ([math]::Abs($sum - $first) -lt 0.0001) { $result.fieldBehavior[$col].sumVsFirstEqual++ }
          else { $result.fieldBehavior[$col].sumVsFirstDiffer++ }
        }
      }
    }
  }
  return $result
}

function Analyze-NumericLevel($rows, [string]$keyCol, [string]$numCol) {
  $groups = @{}
  foreach ($row in $rows) {
    $k = Norm-Kootaj $row[$keyCol]
    if ($k -eq '') { continue }
    if (-not $groups.ContainsKey($k)) { $groups[$k] = New-Object System.Collections.Generic.List[object] }
    $groups[$k].Add($row)
  }
  $multi = $groups.GetEnumerator() | Where-Object { $_.Value.Count -gt 1 }
  $stats = [ordered]@{
    multiGroups = ($multi | Measure-Object).Count
    allRowsSameValue = 0
    rowsDiffer = 0
    pattern_repeated_total = 0
    pattern_row_specific = 0
    pattern_mixed_empty = 0
    examples_same = @()
    examples_differ = @()
  }
  foreach ($g in $multi) {
    $nums = @()
    $raws = @()
    $empties = 0
    foreach ($r in $g.Value) {
      $raw = CellStr $r[$numCol]
      $raws += $raw
      if ($raw -eq '') { $empties++; continue }
      $n = ToNum $r[$numCol]
      if ($null -ne $n) { $nums += $n } else { $nums += $null }
    }
    $nonEmptyRaw = $raws | Where-Object { $_ -ne '' } | Select-Object -Unique
    if ($empties -gt 0 -and $empties -lt $g.Value.Count) {
      $stats.pattern_mixed_empty++
    }
    if ($nonEmptyRaw.Count -le 1) {
      $stats.allRowsSameValue++
      $stats.pattern_repeated_total++
      if ($stats.examples_same.Count -lt 5) {
        $stats.examples_same += [ordered]@{ kootaj=$g.Key; count=$g.Value.Count; value=$nonEmptyRaw[0] }
      }
    } else {
      $stats.rowsDiffer++
      $stats.pattern_row_specific++
      if ($stats.examples_differ.Count -lt 5) {
        $stats.examples_differ += [ordered]@{ kootaj=$g.Key; count=$g.Value.Count; values=$nonEmptyRaw }
      }
    }
  }
  return $stats
}

function Extract-KootajPatterns([string]$text) {
  $t = Norm-Digits $text
  $patterns = [ordered]@{
    raw = $text
    normalized = $t
    matches = @()
  }
  $regexes = @(
    @{ name='کوتاژ_digit'; rx='کوتاژ\s*[:：]?\s*(\d{4,10})' },
    @{ name='کوتاز_digit'; rx='کوتاز\s*[:：]?\s*(\d{4,10})' },
    @{ name='cotage_digit'; rx='(?i)cotage\s*[:：]?\s*(\d{4,10})' },
    @{ name='kootaj_digit'; rx='(?i)kootaj\s*[:：]?\s*(\d{4,10})' },
    @{ name='شماره_کوتاژ'; rx='شماره\s*کوتاژ\s*[:：]?\s*(\d{4,10})' },
    @{ name='standalone_6digit'; rx='(?<!\d)(\d{5,7})(?!\d)' }
  )
  foreach ($rg in $regexes) {
    $ms = [regex]::Matches($t, $rg.rx)
    foreach ($m in $ms) {
      $patterns.matches += [ordered]@{ pattern=$rg.name; value=$m.Groups[1].Value; full=$m.Value }
    }
  }
  return $patterns
}

$srcDir = Find-SourceDir
$files = Get-SourceFiles $srcDir
$report = New-Object System.Text.StringBuilder
function W([string]$s) { [void]$report.AppendLine($s) }

W "SOURCE_DIR=$srcDir"
W "FILE1=$($files['file1'])"
W "FILE2=$($files['file2'])"
W "FILE3=$($files['file3'])"
W ""

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$excel.ScreenUpdating = $false

try {
  # ========== FILE 1 ==========
  W "========== FILE1 =========="
  $wb1 = $excel.Workbooks.Open($files['file1'], 0, $true)
  W "sheetCount=$($wb1.Sheets.Count)"
  $file1Sheets = @()
  foreach ($ws in $wb1.Sheets) {
    $sh = Read-Sheet $ws
    $file1Sheets += $sh
    W "SHEET|$($sh.name)|rows=$($sh.rows)|cols=$($sh.cols)"
    W ("HEADERS|" + ($sh.headers -join '||'))
  }
  # Combine all sheets for master analysis, also per-sheet
  $all1 = New-Object System.Collections.Generic.List[object]
  foreach ($sh in $file1Sheets) {
    foreach ($r in $sh.data) {
      $r2 = [ordered]@{}
      foreach ($k in $r.Keys) { $r2[$k] = $r[$k] }
      $r2['_sheet'] = $sh.name
      $all1.Add($r2)
    }
  }
  $h1 = $file1Sheets[0].headers
  $kootajCol1 = Find-Col $h1 @('شماره کوتاژ','کوتاژ')
  $whCol1 = Find-Col $h1 @('شماره قبض انبار','قبض انبار')
  $tariffCol1 = Find-Col $h1 @('کد تعرفه')
  $descCol1 = Find-Col $h1 @('شرح کالا')
  $weightCol1 = Find-Col $h1 @('وزن ناخالص','وزن')
  $rialCol1 = Find-Col $h1 @('ارزش ریالی')
  $curCol1 = Find-Col $h1 @('ارزش ارزی')
  $rightsCol1 = Find-Col $h1 @('حقوق استنباطی')
  $statusCol1 = Find-Col $h1 @('وضعیت کالا')
  $annCol1 = Find-Col $h1 @('تاریخ اعلام')
  $exitCol1 = Find-Col $h1 @('تاریخ خروج')
  $dateCol1 = Find-Col $h1 @('تاریخ کوتاژ')
  $evalCol1 = Find-Col $h1 @('محل ارزیابی')
  $stageCol1 = Find-Col $h1 @('مرحله اظهارنامه')
  $variziCol1 = Find-Col $h1 @('واریزی')
  $radifCol1 = Find-Col $h1 @('ردیف')

  W "KOOTAJ_COL=$kootajCol1 WH=$whCol1 TARIFF=$tariffCol1"
  $cmp1 = @($kootajCol1,$dateCol1,$tariffCol1,$descCol1,$weightCol1,$rialCol1,$curCol1,$whCol1,$evalCol1,$stageCol1,$rightsCol1,$variziCol1,$statusCol1,$annCol1,$exitCol1) | Where-Object { $_ }
  $dup1 = Analyze-Duplicates $all1 $kootajCol1 $cmp1
  W "FILE1_DUP|total=$($dup1.totalRows)|unique=$($dup1.uniqueKeys)|dupKeys=$($dup1.dupKeyCount)"
  foreach ($ex in $dup1.examples) {
    W "DUP_EX|kootaj=$($ex.kootaj)|count=$($ex.count)"
    $i=0
    foreach ($r in $ex.rows) {
      $i++
      W ("  R$i|" + (($r.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join ' || '))
    }
  }
  foreach ($col in $cmp1) {
    $fb = $dup1.fieldBehavior[$col]
    W "FIELD_BEHAVIOR|$col|sameGroups=$($fb.sameAcrossDupRows)|differGroups=$($fb.differAcrossDupRows)"
    foreach ($d in $fb.differInGroup_examples) {
      W "  DIFFER|$($d.kootaj)|values=$($d.values -join ' ;; ')"
    }
  }
  foreach ($numCol in @($weightCol1,$rialCol1,$curCol1,$rightsCol1)) {
    if (-not $numCol) { continue }
    $ns = Analyze-NumericLevel $all1 $kootajCol1 $numCol
    W "NUM_LEVEL|$numCol|multi=$($ns.multiGroups)|same=$($ns.allRowsSameValue)|differ=$($ns.rowsDiffer)|repeatedTotal=$($ns.pattern_repeated_total)|rowSpecific=$($ns.pattern_row_specific)|mixedEmpty=$($ns.pattern_mixed_empty)"
    foreach ($e in $ns.examples_same) { W "  SAME_EX|$($e.kootaj)|n=$($e.count)|v=$($e.value)" }
    foreach ($e in $ns.examples_differ) { W "  DIFF_EX|$($e.kootaj)|n=$($e.count)|v=$($e.values -join ' ;; ')" }
  }

  # Check multi warehouse per kootaj
  $kw = @{}
  foreach ($r in $all1) {
    $k = Norm-Kootaj $r[$kootajCol1]
    $w = CellStr $r[$whCol1]
    if ($k -eq '') { continue }
    if (-not $kw.ContainsKey($k)) { $kw[$k] = @{} }
    if ($w -ne '') { $kw[$k][$w] = $true }
  }
  $multiWh = ($kw.GetEnumerator() | Where-Object { $_.Value.Keys.Count -gt 1 })
  W "MULTI_WH_PER_KOOTAJ=$($multiWh.Count)"
  $shown=0
  foreach ($g in ($multiWh | Sort-Object { $_.Value.Keys.Count } -Descending)) {
    if ($shown -ge 10) { break }
    W "MULTI_WH|$($g.Key)|whCount=$($g.Value.Keys.Count)|whs=$($g.Value.Keys -join ',')"
    $shown++
  }

  # Digit format stats file1
  $persianDigits=0; $arabicIndic=0; $latinOnly=0; $excelNum=0; $withSpace=0
  foreach ($r in $all1) {
    $v = $r[$kootajCol1]
    if ($v -is [double] -or $v -is [decimal] -or $v -is [int] -or $v -is [long]) { $excelNum++; continue }
    $s = [string]$v
    if ($s -ne $s.Trim() -or $s -match '\s') { $withSpace++ }
    if ($s -match '[۰-۹]') { $persianDigits++ }
    elseif ($s -match '[٠-٩]') { $arabicIndic++ }
    elseif ($s -match '[0-9]') { $latinOnly++ }
  }
  W "KOOTAJ_FORMAT|excelNum=$excelNum|latinText=$latinOnly|persianDigits=$persianDigits|arabicIndic=$arabicIndic|withSpace=$withSpace"

  # Status / letter related columns in file1
  W "STATUS_VALUES"
  $st = @{}
  foreach ($r in $all1) {
    $s = CellStr $r[$statusCol1]
    if (-not $st.ContainsKey($s)) { $st[$s]=0 }
    $st[$s]++
  }
  foreach ($e in ($st.GetEnumerator() | Sort-Object Value -Descending)) { W "  STATUS|$($e.Key)=$($e.Value)" }

  $wb1.Close($false)
  [void][Runtime.InteropServices.Marshal]::ReleaseComObject($wb1)

  # ========== FILE 2 ==========
  W ""
  W "========== FILE2 =========="
  $wb2 = $excel.Workbooks.Open($files['file2'], 0, $true)
  W "sheetCount=$($wb2.Sheets.Count)"
  $file2Sheets = @()
  foreach ($ws in $wb2.Sheets) {
    $sh = Read-Sheet $ws
    $file2Sheets += $sh
    W "SHEET|$($sh.name)|rows=$($sh.rows)|cols=$($sh.cols)"
    W ("HEADERS|" + ($sh.headers -join '||'))
  }
  # Use first non-empty sheet or combine
  $all2 = New-Object System.Collections.Generic.List[object]
  foreach ($sh in $file2Sheets) {
    foreach ($r in $sh.data) {
      $r2 = [ordered]@{}
      foreach ($k in $r.Keys) { $r2[$k] = $r[$k] }
      $r2['_sheet'] = $sh.name
      $all2.Add($r2)
    }
  }
  $h2 = $file2Sheets[0].headers
  # dump first 3 rows raw
  W "FILE2_SAMPLE_ROWS"
  for ($i=0; $i -lt [Math]::Min(3,$all2.Count); $i++) {
    $r = $all2[$i]
    W ("ROW$i|" + (($r.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join ' || '))
  }

  $kootajCol2 = Find-Col $h2 @('شماره کوتاژ','کوتاژ','شماره اظهارنامه','شماره اظهار')
  $whCol2 = Find-Col $h2 @('شماره قبض انبار','قبض انبار','قبض')
  $tariffCol2 = Find-Col $h2 @('کد تعرفه','تعرفه')
  $descCol2 = Find-Col $h2 @('شرح کالا','شرح')
  $weightCol2 = Find-Col $h2 @('وزن ناخالص','وزن')
  $qtyCol2 = Find-Col $h2 @('تعداد','مقدار','تعداد کالا')
  $rialCol2 = Find-Col $h2 @('ارزش ریالی','ارزش')
  $curCol2 = Find-Col $h2 @('ارزش ارزی')
  $rightsCol2 = Find-Col $h2 @('حقوق استنباطی','حقوق')
  $radifCol2 = Find-Col $h2 @('ردیف')
  $dateCol2 = Find-Col $h2 @('تاریخ کوتاژ','تاریخ اظهار')

  W "FILE2_KEYCOLS|kootaj=$kootajCol2|wh=$whCol2|tariff=$tariffCol2|weight=$weightCol2|qty=$qtyCol2|rial=$rialCol2|rights=$rightsCol2|radif=$radifCol2"

  # If kootaj not found, list all headers with sample uniqueness
  if (-not $kootajCol2) {
    W "FILE2_NO_KOOTAJ_COL_FOUND - analyzing all columns for uniqueness"
    foreach ($col in $h2) {
      $set = @{}
      foreach ($r in $all2) {
        $v = Norm-Kootaj $r[$col]
        if ($v -eq '') { $v = CellStr $r[$col] }
        if ($v -ne '') { $set[$v] = $true }
      }
      W "COL_UNIQ|$col|unique=$($set.Keys.Count)|rows=$($all2.Count)"
    }
  } else {
    $cmp2 = @($h2)
    $dup2 = Analyze-Duplicates $all2 $kootajCol2 $cmp2
    W "FILE2_DUP|total=$($dup2.totalRows)|unique=$($dup2.uniqueKeys)|dupKeys=$($dup2.dupKeyCount)"
    foreach ($ex in $dup2.examples) {
      W "DUP_EX|kootaj=$($ex.kootaj)|count=$($ex.count)"
      $i=0
      foreach ($r in $ex.rows) {
        $i++
        # show key numeric/detail fields
        $parts = @()
        foreach ($c in @($radifCol2,$whCol2,$tariffCol2,$descCol2,$weightCol2,$qtyCol2,$rialCol2,$curCol2,$rightsCol2,$dateCol2)) {
          if ($c) { $parts += "$c=$($r[$c])" }
        }
        W ("  R$i|" + ($parts -join ' || '))
      }
    }
    foreach ($col in $h2) {
      $fb = $dup2.fieldBehavior[$col]
      if ($null -eq $fb) { continue }
      W "FIELD_BEHAVIOR|$col|sameGroups=$($fb.sameAcrossDupRows)|differGroups=$($fb.differAcrossDupRows)"
      foreach ($d in $fb.differInGroup_examples) {
        W "  DIFFER|$($d.kootaj)|values=$($d.values -join ' ;; ')"
      }
    }
    foreach ($numCol in @($weightCol2,$qtyCol2,$rialCol2,$curCol2,$rightsCol2)) {
      if (-not $numCol) { continue }
      $ns = Analyze-NumericLevel $all2 $kootajCol2 $numCol
      W "NUM_LEVEL|$numCol|multi=$($ns.multiGroups)|same=$($ns.allRowsSameValue)|differ=$($ns.rowsDiffer)|repeatedTotal=$($ns.pattern_repeated_total)|rowSpecific=$($ns.pattern_row_specific)|mixedEmpty=$($ns.pattern_mixed_empty)"
      foreach ($e in $ns.examples_same) { W "  SAME_EX|$($e.kootaj)|n=$($e.count)|v=$($e.value)" }
      foreach ($e in $ns.examples_differ) { W "  DIFF_EX|$($e.kootaj)|n=$($e.count)|v=$($e.values -join ' ;; ')" }
    }

    # Cross with file1
    $set1 = @{}
    foreach ($r in $all1) { $set1[(Norm-Kootaj $r[$kootajCol1])] = $true }
    $inBoth=0; $only2=0; $only2Examples=@()
    $set2 = @{}
    foreach ($r in $all2) {
      $k = Norm-Kootaj $r[$kootajCol2]
      if ($k -eq '') { continue }
      $set2[$k] = $true
    }
    foreach ($k in $set2.Keys) {
      if ($set1.ContainsKey($k)) { $inBoth++ } else {
        $only2++
        if ($only2Examples.Count -lt 20) { $only2Examples += $k }
      }
    }
    W "CROSS_F1_F2|file1Unique=$($set1.Keys.Count)|file2Unique=$($set2.Keys.Count)|inBoth=$inBoth|onlyInFile2=$only2"
    W ("ONLY2_EX|" + ($only2Examples -join ','))
  }

  $wb2.Close($false)
  [void][Runtime.InteropServices.Marshal]::ReleaseComObject($wb2)

  # ========== FILE 3 ==========
  W ""
  W "========== FILE3 =========="
  $wb3 = $excel.Workbooks.Open($files['file3'], 0, $true)
  W "sheetCount=$($wb3.Sheets.Count)"
  $file3Sheets = @()
  foreach ($ws in $wb3.Sheets) {
    $sh = Read-Sheet $ws
    $file3Sheets += $sh
    W "SHEET|$($sh.name)|rows=$($sh.rows)|cols=$($sh.cols)"
    W ("HEADERS|" + ($sh.headers -join '||'))
  }
  $all3 = New-Object System.Collections.Generic.List[object]
  foreach ($sh in $file3Sheets) {
    foreach ($r in $sh.data) {
      $r2 = [ordered]@{}
      foreach ($k in $r.Keys) { $r2[$k] = $r[$k] }
      $r2['_sheet'] = $sh.name
      $all3.Add($r2)
    }
  }
  $h3 = $file3Sheets[0].headers
  W "FILE3_SAMPLE_ROWS"
  for ($i=0; $i -lt [Math]::Min(5,$all3.Count); $i++) {
    $r = $all3[$i]
    W ("ROW$i|" + (($r.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join ' || '))
  }

  $letterNoCol = Find-Col $h3 @('شماره نامه','شماره نامه')
  $letterDateCol = Find-Col $h3 @('تاریخ نامه')
  $descCol3 = Find-Col $h3 @('توضیحات','شرح','موضوع')
  $kootajCol3 = Find-Col $h3 @('شماره کوتاژ','کوتاژ')

  # broader search for letter columns
  W "FILE3_COL_CANDIDATES"
  foreach ($col in $h3) {
    $nonEmpty=0
    $samples=@()
    foreach ($r in $all3) {
      $v = CellStr $r[$col]
      if ($v -eq '') { continue }
      $nonEmpty++
      if ($samples.Count -lt 3) { $samples += $v.Substring(0, [Math]::Min(120,$v.Length)) }
    }
    W "COL|$col|nonEmpty=$nonEmpty|samples=$($samples -join ' ;; ')"
  }

  W "LETTER_COLS|number=$letterNoCol|date=$letterDateCol|desc=$descCol3|kootaj=$kootajCol3"

  # Analyze description for kootaj extraction
  if ($descCol3) {
    $extractStats = [ordered]@{
      total = $all3.Count
      emptyDesc = 0
      extracted = 0
      noExtract = 0
      multiCandidate = 0
      patternCounts = @{}
      matchedInFile1 = 0
      unmatched = 0
      failExamples = @()
      successExamples = @()
      multiExamples = @()
    }
    $set1b = @{}
    foreach ($r in $all1) { $set1b[(Norm-Kootaj $r[$kootajCol1])] = $true }

    foreach ($r in $all3) {
      $desc = CellStr $r[$descCol3]
      if ($desc -eq '') { $extractStats.emptyDesc++; continue }
      $ex = Extract-KootajPatterns $desc
      # Prefer labeled patterns over standalone
      $labeled = $ex.matches | Where-Object { $_.pattern -ne 'standalone_6digit' }
      $standalone = $ex.matches | Where-Object { $_.pattern -eq 'standalone_6digit' }
      $chosen = @()
      if (($labeled | Measure-Object).Count -gt 0) {
        $chosen = $labeled | ForEach-Object { $_.value } | Select-Object -Unique
        foreach ($m in $labeled) {
          if (-not $extractStats.patternCounts.ContainsKey($m.pattern)) { $extractStats.patternCounts[$m.pattern]=0 }
          $extractStats.patternCounts[$m.pattern]++
        }
      } elseif (($standalone | Measure-Object).Count -gt 0) {
        $chosen = $standalone | ForEach-Object { $_.value } | Select-Object -Unique
        if (-not $extractStats.patternCounts.ContainsKey('standalone_6digit')) { $extractStats.patternCounts['standalone_6digit']=0 }
        $extractStats.patternCounts['standalone_6digit']++
      }

      if ($chosen.Count -eq 0) {
        $extractStats.noExtract++
        if ($extractStats.failExamples.Count -lt 15) {
          $lnFail = ''
          $ldFail = ''
          if ($letterNoCol) { $lnFail = CellStr $r[$letterNoCol] }
          if ($letterDateCol) { $ldFail = CellStr $r[$letterDateCol] }
          $extractStats.failExamples += [ordered]@{
            letter=$lnFail
            date=$ldFail
            desc=$desc.Substring(0,[Math]::Min(200,$desc.Length))
          }
        }
      } elseif ($chosen.Count -gt 1) {
        $extractStats.multiCandidate++
        $extractStats.extracted++
        if ($extractStats.multiExamples.Count -lt 10) {
          $extractStats.multiExamples += [ordered]@{ desc=$desc.Substring(0,[Math]::Min(200,$desc.Length)); candidates=($chosen -join ',') }
        }
        # check if any match
        $any=false
        foreach ($c in $chosen) { if ($set1b.ContainsKey((Norm-Kootaj $c))) { $any=$true } }
        if ($any) { $extractStats.matchedInFile1++ } else { $extractStats.unmatched++ }
      } else {
        $extractStats.extracted++
        $nk = Norm-Kootaj $chosen[0]
        if ($set1b.ContainsKey($nk)) { $extractStats.matchedInFile1++ } else { $extractStats.unmatched++ }
        if ($extractStats.successExamples.Count -lt 15) {
          $lnOk = ''
          $ldOk = ''
          if ($letterNoCol) { $lnOk = CellStr $r[$letterNoCol] }
          if ($letterDateCol) { $ldOk = CellStr $r[$letterDateCol] }
          $extractStats.successExamples += [ordered]@{
            kootaj=$nk
            letter=$lnOk
            date=$ldOk
            desc=$desc.Substring(0,[Math]::Min(180,$desc.Length))
            inF1=$set1b.ContainsKey($nk)
          }
        }
      }
    }
    W "EXTRACT_STATS|total=$($extractStats.total)|empty=$($extractStats.emptyDesc)|extracted=$($extractStats.extracted)|noExtract=$($extractStats.noExtract)|multi=$($extractStats.multiCandidate)|matchedF1=$($extractStats.matchedInFile1)|unmatched=$($extractStats.unmatched)"
    foreach ($p in $extractStats.patternCounts.GetEnumerator()) { W "PATTERN|$($p.Key)=$($p.Value)" }
    W "EXTRACT_SUCCESS_EX"
    foreach ($e in $extractStats.successExamples) { W "  OK|k=$($e.kootaj)|letter=$($e.letter)|date=$($e.date)|inF1=$($e.inF1)|desc=$($e.desc)" }
    W "EXTRACT_FAIL_EX"
    foreach ($e in $extractStats.failExamples) { W "  FAIL|letter=$($e.letter)|date=$($e.date)|desc=$($e.desc)" }
    W "EXTRACT_MULTI_EX"
    foreach ($e in $extractStats.multiExamples) { W "  MULTI|cands=$($e.candidates)|desc=$($e.desc)" }
  }

  # Letter uniqueness vs kootaj if extractable
  if ($letterNoCol) {
    $letterSet = @{}
    $dupLetters = 0
    foreach ($r in $all3) {
      $ln = CellStr $r[$letterNoCol]
      if ($ln -eq '') { continue }
      if ($letterSet.ContainsKey($ln)) { $dupLetters++ } else { $letterSet[$ln]=1 }
    }
    W "LETTER_NUM|unique=$($letterSet.Keys.Count)|duplicateOccurrences=$dupLetters"
  }

  # Check if letter number/date already in dedicated cols vs buried in desc
  if ($letterNoCol -and $descCol3) {
    $letterInDesc=0; $letterNotInDesc=0; $dateInDesc=0
    foreach ($r in $all3) {
      $ln = CellStr $r[$letterNoCol]
      $ld = CellStr $r[$letterDateCol]
      $d = CellStr $r[$descCol3]
      if ($ln -ne '' -and $d.Contains($ln)) { $letterInDesc++ } elseif ($ln -ne '') { $letterNotInDesc++ }
      if ($ld -ne '' -and $d.Contains($ld)) { $dateInDesc++ }
    }
    W "LETTER_IN_DESC|numberAlsoInDesc=$letterInDesc|numberNotInDesc=$letterNotInDesc|dateAlsoInDesc=$dateInDesc"
  }

  $wb3.Close($false)
  [void][Runtime.InteropServices.Marshal]::ReleaseComObject($wb3)

} finally {
  $excel.Quit()
  [void][Runtime.InteropServices.Marshal]::ReleaseComObject($excel)
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}

$outPath = Join-Path $outDir 'full_reanalysis.txt'
[IO.File]::WriteAllText($outPath, $report.ToString(), [Text.Encoding]::UTF8)
Write-Host "WROTE $outPath"
Write-Host "LEN=$($report.Length)"
