$ErrorActionPreference = "Stop"
$outDir = "D:\نرم افزار متروکه\_analysis"
$enc = New-Object System.Text.UTF8Encoding $true
function Load($n) {
  $L=[System.IO.File]::ReadAllLines((Join-Path $outDir $n),$enc)
  $H=$L[0].Split("`t"); $R=@()
  for($i=1;$i -lt $L.Length;$i++){
    $p=$L[$i].Split("`t"); $o=@{}
    for($c=0;$c -lt $H.Length;$c++){ $o[$c]= if($c -lt $p.Length){$p[$c]} else {""} }
    $R += ,$o
  }
  ,$R
}
# column indexes: 13 status, 15 exit
$s1=Load "sheet_1_data.tsv"
$s2=Load "sheet_2_data.tsv"
$s3=Load "sheet_3_data.tsv"
$sb = New-Object System.Text.StringBuilder
# S2 all have exit codes?
$s2NE=0; foreach($r in $s2){ if($r[15].Trim() -eq "کالا از گمرک خارج نشده است"){ $s2NE++ } }
$s3Ex=0; foreach($r in $s3){ if($r[15].Trim() -ne "کالا از گمرک خارج نشده است"){ $s3Ex++ } }
[void]$sb.AppendLine("s2_with_not_exited_text=$s2NE / $($s2.Count)")
[void]$sb.AppendLine("s3_with_exit_code=$s3Ex / $($s3.Count)")
# S1 partition by exit text
$s1NE=0; $s1EX=0
foreach($r in $s1){ if($r[15].Trim() -eq "کالا از گمرک خارج نشده است"){$s1NE++} else {$s1EX++} }
[void]$sb.AppendLine("s1_not_exited_text=$s1NE exited_like=$s1EX")
[void]$sb.AppendLine("expected: s2=$($s2.Count) should match s1EX if only_s1 are all not exited: s1EX=$s1EX")
# Cotage length 5 vs 6 - older vs newer?
$len5=0;$len6=0
foreach($r in $s1){ $l=$r[1].Trim().Length; if($l -eq 5){$len5++} elseif($l -eq 6){$len6++} }
[void]$sb.AppendLine("cotageLen5=$len5 len6=$len6")
[System.IO.File]::WriteAllText((Join-Path $outDir "partition_check.txt"), $sb.ToString(), $enc)
Write-Host $sb.ToString()