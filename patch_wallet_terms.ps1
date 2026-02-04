$path = "src/app/vendor/wallet/page.tsx"
if (!(Test-Path -LiteralPath $path)) { Write-Host "Missing: $path"; exit 1 }

$bak = "$path.bak_wallet_terms"
Copy-Item -LiteralPath $path -Destination $bak -Force
Write-Host "Backup created: $bak"

$naira = [char]0x20A6
$raw = Get-Content -LiteralPath $path -Raw

# Fix common broken encoding visible to users (safe)
$new = $raw
$new = $new.Replace("â‚¦", $naira)
$new = $new.Replace("â€™", "'")
$new = $new.Replace("â€”", "-")
$new = $new.Replace("â€“", "-")
$new = $new.Replace("â€¦", "...")
$new = $new.Replace("Â", "")

# Replace UI term Escrow -> Held balance (word only, won't touch escrowStatus)
$new = [regex]::Replace($new, "(?i)\bescrow\b", "Held balance")

# If a sentence becomes weird like "Held balance orders move...", normalize it
$new = $new -replace "Held balance orders move from Pending to Available", "Some payments move from Pending to Available"
$new = $new -replace "Held balance hold", "Held balance"

Set-Content -LiteralPath $path -Value $new -Encoding utf8

Write-Host "Patched: removed 'Escrow' (UI word) -> 'Held balance' in $path"
Write-Host "Done."
