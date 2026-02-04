$naira = [char]0x20A6
$targets = Get-ChildItem -Recurse -File .\src -Include *.ts,*.tsx,*.css -ErrorAction SilentlyContinue

function BackupOnce($path){
  $bak = "$path.bak_encoding"
  if(!(Test-Path -LiteralPath $bak)){
    Copy-Item -LiteralPath $path -Destination $bak -Force
  }
}

$changed = 0

foreach($f in $targets){
  $p = $f.FullName
  $raw = Get-Content -LiteralPath $p -Raw

  $new = $raw
  $new = $new.Replace("â‚¦", $naira)     # broken Naira
  $new = $new.Replace("â€™", "'")        # broken apostrophe
  $new = $new.Replace("â€”", "-")        # broken em dash
  $new = $new.Replace("â€“", "-")        # broken en dash
  $new = $new.Replace("â€¦", "...")      # broken ellipsis
  $new = $new.Replace("Â", "")           # stray Â

  if($new -ne $raw){
    BackupOnce $p
    Set-Content -LiteralPath $p -Value $new -Encoding utf8
    $changed++
    Write-Host ("Fixed encoding: " + $p)
  }
}

Write-Host ("DONE. Files changed: " + $changed)
