$path = "src/app/vendor/wallet/page.tsx"
if (!(Test-Path -LiteralPath $path)) { Write-Host "Missing: $path"; exit 1 }

$bak = "$path.bak_fix_naira_encoding"
Copy-Item -LiteralPath $path -Destination $bak -Force
Write-Host "Backup created: $bak"

$raw = Get-Content -LiteralPath $path -Raw
$new = $raw

# Fix common broken encoding sequences (safe)
$new = $new.Replace("â‚¦", "\u20A6")   # broken ₦ -> unicode escape
$new = $new.Replace("₦", "\u20A6")     # even if ₦ is present, normalize to escape
$new = $new.Replace("â€™", " is ")     # avoid apostrophe entirely
$new = $new.Replace("there’s", "there is")
$new = $new.Replace("there’s", "there is")
$new = $new.Replace("thereâ€™s", "there is")
$new = $new.Replace("â€”", "-")
$new = $new.Replace("â€“", "-")
$new = $new.Replace("â€¦", "...")
$new = $new.Replace("Â", "")

# Also remove the word Escrow (UI-visible only) -> Held balance
$new = [regex]::Replace($new, "(?i)\bescrow\b", "Held balance")

Set-Content -LiteralPath $path -Value $new -Encoding utf8
Write-Host "Patched: fixed ₦ + apostrophes + Escrow in $path"
