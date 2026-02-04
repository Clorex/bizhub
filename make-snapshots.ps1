$ErrorActionPreference = "Stop"

$Root = Get-Location
$OutDir = Join-Path $Root "snapshots"

# Delete past snapshots + recreate
if (Test-Path $OutDir) { Remove-Item -Recurse -Force $OutDir }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$TargetWords  = 10000
$BudgetWords  = 9200    # keep content under this, then pad to exactly 10k
$MaxFileBytes = 160kb   # skip huge files

function Get-WordCount([string]$Text) {
  ($Text -split '\s+' | Where-Object { $_ -and $_.Trim().Length -gt 0 }).Count
}

function Is-IgnoredPath([string]$FullName) {
  $p = ($FullName -replace '/', '\').ToLowerInvariant()
  return ($p -match '\\node_modules\\|\\\.next\\|\\dist\\|\\out\\|\\coverage\\|\\\.git\\|\\snapshots\\')
}

function Get-ExplicitFiles([string[]]$Paths) {
  $out = New-Object System.Collections.Generic.List[string]
  foreach ($p in $Paths) {
    $abs = Join-Path $Root $p
    if (Test-Path $abs) { $out.Add((Resolve-Path $abs).Path) }
  }
  $out | Sort-Object -Unique
}

function Find-CoreFilesByRegex([string[]]$Roots, [string]$Regex) {
  $extOk = @('.ts','.tsx','.js','.jsx','.mjs','.cjs','.json','.md','.prisma','.sql','.yml','.yaml','.css','.scss')
  $all = New-Object System.Collections.Generic.List[string]

  foreach ($r in $Roots) {
    $abs = Join-Path $Root $r
    if (-not (Test-Path $abs)) { continue }

    Get-ChildItem -Path $abs -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object {
      if (Is-IgnoredPath $_.FullName) { return }
      if ($_.Name -match '\.min\.') { return }
      if ($_.Length -gt $MaxFileBytes) { return }
      if ($extOk -notcontains $_.Extension.ToLowerInvariant()) { return }

      $fullLower = $_.FullName.ToLowerInvariant()
      if ($fullLower -match $Regex) { $all.Add($_.FullName) }
    }
  }

  $all | Sort-Object -Unique
}

function Try-AppendFileWithinBudget([string]$OutPath, [string]$FilePath, [int]$Budget) {
  if (-not (Test-Path $FilePath)) { return $false }

  $currentText = Get-Content -Path $OutPath -Raw
  $currentWords = Get-WordCount $currentText
  if ($currentWords -ge $Budget) { return $false }

  $marker = @(
    ""
    ("=" * 90)
    ("FILE: " + $FilePath)
    ("=" * 90)
  ) -join "`r`n"
  $markerWords = Get-WordCount $marker

  try {
    $fileText = Get-Content -Path $FilePath -Raw -ErrorAction Stop
  } catch {
    return $false
  }
  $fileWords = Get-WordCount $fileText

  if (($currentWords + $markerWords + $fileWords) -gt $Budget) { return $false }

  Add-Content -Path $OutPath -Value $marker -Encoding UTF8
  Add-Content -Path $OutPath -Value $fileText -Encoding UTF8
  return $true
}

function Build-Snapshot([string]$OutPath, [string]$Title, [string[]]$CandidateFiles) {
  $now = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  $header = @(
    "SNAPSHOT TITLE: $Title"
    "GENERATED: $now"
    "PROJECT ROOT: $Root"
    "NOTE: Core files only; padded to exactly 10,000 words."
    ""
  ) -join "`r`n"
  Set-Content -Path $OutPath -Value $header -Encoding UTF8

  foreach ($f in ($CandidateFiles | Where-Object { $_ } | Select-Object -Unique)) {
    $ok = Try-AppendFileWithinBudget -OutPath $OutPath -FilePath $f -Budget $BudgetWords
    if (-not $ok) { continue }
    $cw = Get-WordCount (Get-Content -Path $OutPath -Raw)
    if ($cw -ge $BudgetWords) { break }
  }
}

function Pad-To-ExactWords([string]$Path, [int]$ExactWords) {
  $text = Get-Content -Path $Path -Raw
  $wc = Get-WordCount $text
  if ($wc -gt $ExactWords) { throw "Snapshot exceeded target words ($wc > $ExactWords): $Path" }

  $need = $ExactWords - $wc
  if ($need -le 0) { return }

  Add-Content -Path $Path -Value "" -Encoding UTF8
  while ($need -gt 0) {
    $take = [Math]::Min(5000, $need)
    $line = (@("PADWORD") * $take) -join " "
    Add-Content -Path $Path -Value $line -Encoding UTF8
    $need -= $take
  }
}

# ---- Core candidate lists ----
$explicitConfig = Get-ExplicitFiles @(
  "package.json","next.config.js","next.config.mjs","next.config.ts",
  "tsconfig.json","jsconfig.json",
  "middleware.ts","middleware.js","src\middleware.ts","src\middleware.js",
  "README.md",".env.example"
)

$c1 = @()
$c1 += $explicitConfig
$c1 += Find-CoreFilesByRegex -Roots @(".") -Regex '(\\|/)(eslint|prettier)(\.|$)|pnpm-lock\.yaml|yarn\.lock|package-lock\.json'
$c1 = $c1 | Select-Object -Unique

$c2 = Find-CoreFilesByRegex -Roots @("src","app","pages","components") -Regex '(\\|/)(checkout|cart|payment|paystack|flutterwave|pricing|plan|subscription|billing|order).*'
$c2 = $c2 | Sort-Object { $_.Length }

$c3 = Find-CoreFilesByRegex -Roots @("src","app","pages","lib","server","services","utils") -Regex '(\\|/)(api)(\\|/)|webhook|paystack|flutterwave|payment|transaction|billing|invoice'
$c3 = $c3 | Sort-Object { $_.Length }

$c4 = Find-CoreFilesByRegex -Roots @("src","app","pages","lib","components") -Regex 'subscription|plan|pricing|tier|entitlement|feature-flag|featureflag|access|gate|billing'
$c4 = $c4 | Sort-Object { $_.Length }

$c5 = @()
$c5 += Find-CoreFilesByRegex -Roots @("src","app","pages","components") -Regex 'admin|settings|toggle|switch|feature-flag|featureflag|payment'
$c5 += Find-CoreFilesByRegex -Roots @("prisma","db","database","supabase") -Regex 'schema|migration|prisma|db'
$c5 = $c5 | Select-Object -Unique | Sort-Object { $_.Length }

# ---- Build 5 snapshots ----
Build-Snapshot (Join-Path $OutDir "snapshot-1.txt") "Snapshot 1 — core project/config" $c1
Build-Snapshot (Join-Path $OutDir "snapshot-2.txt") "Snapshot 2 — core checkout/payment UI" $c2
Build-Snapshot (Join-Path $OutDir "snapshot-3.txt") "Snapshot 3 — core payment APIs/server" $c3
Build-Snapshot (Join-Path $OutDir "snapshot-4.txt") "Snapshot 4 — core subscription/plans/gating" $c4
Build-Snapshot (Join-Path $OutDir "snapshot-5.txt") "Snapshot 5 — core admin/toggles/db" $c5

# Pad to EXACTLY 10,000 words each
Get-ChildItem -Path $OutDir -Filter "snapshot-*.txt" | ForEach-Object {
  Pad-To-ExactWords $_.FullName $TargetWords
}

# Verify equal lengths
$final = Get-ChildItem -Path $OutDir -Filter "snapshot-*.txt" | Sort-Object Name | ForEach-Object {
  [pscustomobject]@{ file=$_.Name; words=(Get-WordCount (Get-Content -Path $_.FullName -Raw)) }
}
$final | Format-Table -AutoSize
if ((($final.words | Select-Object -Unique).Count) -ne 1) { throw "Not equal word counts. Paste the table output here." }

Write-Host "Done. Send me snapshots\snapshot-1.txt first."
