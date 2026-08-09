# Read-only Excel structure and data-quality analysis
$ErrorActionPreference = 'Stop'
$path = 'D:\Files\Amar\1405\متروکه آپدیت شده\متروکه گمرک کیش .xlsx'
$outDir = 'D:\نرم افزار متروکه\_analysis'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$excel.ScreenUpdating = $false

try {
  $wb = $excel.Workbooks.Open($path, 0, $true) # UpdateLinks=0, ReadOnly=true
  $summary = [ordered]@{
    file = $path
    sheetCount = $wb.Sheets.Count
    sheets = @()
  }

  foreach ($ws in $wb.Sheets) {
    $used = $ws.UsedRange
    if ($null -eq $used) {
      $summary.sheets += [ordered]@{
        name = $ws.Name
        rows = 0
        cols = 0
        note = 'empty sheet'
      }
      continue
    }

    $rowCount = [int]$used.Rows.Count
    $colCount = [int]$used.Columns.Count
    $startRow = [int]$used.Row
    $startCol = [int]$used.Column

    # Read all values into a 2D array via Value2 (faster)
    $vals = $used.Value2
    $headers = @()
    for ($c = 1; $c -le $colCount; $c++) {
      $h = $vals[1, $c]
      if ($null -eq $h) { $h = "(blank_header_col_$c)" }
      else { $h = [string]$h }
      $headers += $h.Trim()
    }

    $sheetInfo = [ordered]@{
      name = $ws.Name
      usedStartRow = $startRow
      usedStartCol = $startCol
      usedRows = $rowCount
      usedCols = $colCount
      dataRows = [Math]::Max(0, $rowCount - 1)
      headers = $headers
      columns = @()
    }

    # Per-column analysis
    for ($c = 1; $c -le $colCount; $c++) {
      $header = $headers[$c - 1]
      $nonEmpty = 0
      $unique = @{}
      $uniqueNormalized = @{}
      $types = [ordered]@{
        nullEmpty = 0
        number = 0
        dateSerial = 0
        text = 0
        bool = 0
        other = 0
      }
      $samples = New-Object System.Collections.Generic.List[string]
      $hasPersianDigits = $false
      $hasArabicYeKe = $false
      $hasLatinDigits = $false
      $hasLeadingTrailingSpace = $false
      $hasInternalMultiSpace = $false
      $minLen = [int]::MaxValue
      $maxLen = 0
      $numericAsText = 0
      $dateLikeText = 0
      $valueLengths = @{}

      for ($r = 2; $r -le $rowCount; $r++) {
        $v = $vals[$r, $c]
        if ($null -eq $v -or ($v -is [string] -and $v.Trim() -eq '')) {
          $types.nullEmpty++
          continue
        }
        $nonEmpty++
        $s = [string]$v
        $trimmed = $s.Trim()

        if ($s -ne $trimmed -or $s.StartsWith(' ') -or $s.EndsWith(' ')) { $hasLeadingTrailingSpace = $true }
        if ($trimmed -match '\s{2,}') { $hasInternalMultiSpace = $true }
        if ($trimmed -match '[۰-۹]') { $hasPersianDigits = $true }
        if ($trimmed -match '[0-9]') { $hasLatinDigits = $true }
        if ($trimmed -match '[ي]|[ك]') { $hasArabicYeKe = $true } # Arabic ye/kaf

        $len = $trimmed.Length
        if ($len -lt $minLen) { $minLen = $len }
        if ($len -gt $maxLen) { $maxLen = $len }

        # uniqueness raw and trimmed
        $unique[$s] = $true
        $uniqueNormalized[$trimmed] = $true

        # type detection
        if ($v -is [double] -or $v -is [decimal] -or $v -is [int] -or $v -is [long] -or $v -is [single]) {
          # Excel dates are doubles; check if header suggests date or value in typical OADate range with fractional day
          $d = [double]$v
          if ($d -ge 1 -and $d -le 100000 -and ($header -match 'تاریخ|تاريخ|date|زمان') ) {
            $types.dateSerial++
          } elseif ($d -ge 30000 -and $d -le 60000 -and ($d -ne [Math]::Floor($d) -or $header -match 'تاریخ|تاريخ|date')) {
            # heuristic: serial dates often in this range for modern dates
            if ($header -match 'تاریخ|تاريخ|date|زمان') { $types.dateSerial++ } else { $types.number++ }
          } else {
            $types.number++
          }
        } elseif ($v -is [bool]) {
          $types.bool++
        } elseif ($v -is [string]) {
          $types.text++
          if ($trimmed -match '^[0-9۰-۹,\./\-]+$') { $numericAsText++ }
          if ($trimmed -match '\d{4}[/\-]\d{1,2}[/\-]\d{1,2}|\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}|[۰-۹]{4}') { $dateLikeText++ }
        } else {
          $types.other++
        }

        if ($samples.Count -lt 12) {
          $disp = $trimmed
          if ($disp.Length -gt 80) { $disp = $disp.Substring(0, 80) + '...' }
          if (-not $samples.Contains($disp)) { $samples.Add($disp) }
        }
      }

      if ($minLen -eq [int]::MaxValue) { $minLen = 0 }
      $dataRowCount = [Math]::Max(0, $rowCount - 1)
      $fillRate = if ($dataRowCount -gt 0) { [Math]::Round(100.0 * $nonEmpty / $dataRowCount, 2) } else { 0 }

      $colInfo = [ordered]@{
        index = $c
        header = $header
        nonEmpty = $nonEmpty
        empty = $types.nullEmpty
        fillRatePct = $fillRate
        uniqueRaw = $unique.Count
        uniqueTrimmed = $uniqueNormalized.Count
        isUniqueAmongNonEmpty = ($nonEmpty -gt 0 -and $unique.Count -eq $nonEmpty)
        isUniqueAmongAllRows = ($dataRowCount -gt 0 -and $unique.Count -eq $dataRowCount -and $types.nullEmpty -eq 0)
        types = $types
        minLen = $minLen
        maxLen = $maxLen
        hasPersianDigits = $hasPersianDigits
        hasLatinDigits = $hasLatinDigits
        hasArabicYeOrKaf = $hasArabicYeKe
        hasLeadingTrailingSpace = $hasLeadingTrailingSpace
        hasInternalMultiSpace = $hasInternalMultiSpace
        numericAsTextCount = $numericAsText
        dateLikeTextCount = $dateLikeText
        samples = @($samples)
      }
      $sheetInfo.columns += $colInfo
    }

    # Duplicate row detection on full row signature (trimmed string join)
    $rowSigs = @{}
    $dupExamples = New-Object System.Collections.Generic.List[object]
    for ($r = 2; $r -le $rowCount; $r++) {
      $parts = New-Object System.Collections.Generic.List[string]
      for ($c = 1; $c -le $colCount; $c++) {
        $v = $vals[$r, $c]
        if ($null -eq $v) { $parts.Add('') } else { $parts.Add(([string]$v).Trim()) }
      }
      $sig = [string]::Join("`t", $parts)
      if ($rowSigs.ContainsKey($sig)) {
        $rowSigs[$sig]++
        if ($dupExamples.Count -lt 5) {
          $dupExamples.Add([ordered]@{ row = $r; firstSeenCount = $rowSigs[$sig]; preview = ($parts[0..([Math]::Min(4, $parts.Count-1))] -join ' | ') })
        }
      } else {
        $rowSigs[$sig] = 1
      }
    }
    $dupGroups = ($rowSigs.GetEnumerator() | Where-Object { $_.Value -gt 1 }).Count
    $dupRowsExtra = 0
    foreach ($e in $rowSigs.GetEnumerator()) { if ($e.Value -gt 1) { $dupRowsExtra += ($e.Value - 1) } }

    $sheetInfo.exactDuplicateRowGroups = $dupGroups
    $sheetInfo.exactDuplicateExtraRows = $dupRowsExtra
    $sheetInfo.duplicateExamples = @($dupExamples)

    # Also dump first 3 data rows for inspection
    $previewRows = @()
    for ($r = 1; $r -le [Math]::Min(4, $rowCount); $r++) {
      $rowObj = [ordered]@{}
      for ($c = 1; $c -le $colCount; $c++) {
        $v = $vals[$r, $c]
        $key = $headers[$c - 1]
        if ($null -eq $v) { $rowObj[$key] = $null }
        else { $rowObj[$key] = [string]$v }
      }
      $previewRows += $rowObj
    }
    $sheetInfo.previewFirstRows = $previewRows

    $summary.sheets += $sheetInfo

    # Write per-sheet detailed JSON
    $safeName = ($ws.Name -replace '[\\/:*?"<>|]', '_')
    $sheetJsonPath = Join-Path $outDir ("sheet_$safeName.json")
    ($sheetInfo | ConvertTo-Json -Depth 8 -Compress:$false) | Out-File -FilePath $sheetJsonPath -Encoding UTF8
  }

  $summaryPath = Join-Path $outDir 'summary.json'
  ($summary | ConvertTo-Json -Depth 6 -Compress:$false) | Out-File -FilePath $summaryPath -Encoding UTF8

  Write-Host "DONE sheets=$($wb.Sheets.Count)"
  Write-Host "OUT=$outDir"
}
finally {
  if ($wb) { $wb.Close($false) | Out-Null }
  $excel.Quit() | Out-Null
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
