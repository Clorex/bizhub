$log="gentle_terms_patch_log.txt"
Remove-Item $log -ErrorAction SilentlyContinue
function Log($t){ $t | Out-File $log -Append -Encoding utf8 }

function BackupOnce($path){
  if(Test-Path -LiteralPath $path){
    $bak="$path.bak_gentle_terms"
    if(!(Test-Path -LiteralPath $bak)){
      Copy-Item -LiteralPath $path -Destination $bak -Force
      Log "BACKUP: $bak"
    }
  }
}

function Patch($path, $find, $replace){
  if(!(Test-Path -LiteralPath $path)){ return }
  $raw = Get-Content -LiteralPath $path -Raw
  if($raw -notlike "*$find*"){ return }  # idempotent
  BackupOnce $path
  $new = $raw.Replace($find, $replace)
  Set-Content -LiteralPath $path -Value $new -Encoding utf8
  Log "PATCH: $path | '$find' -> '$replace'"
}

Log "== Gentle UI terms patch =="
Log ("Date: " + (Get-Date))

# 1) Vendor balance page: remove visible "Escrow" wording (UI sentence only)
Patch "src/app/vendor/wallet/page.tsx" `
"Escrow orders move from Pending to Available after the hold time if there’s no dispute." `
"Paystack payments may stay in Pending briefly before moving to Available (unless a dispute is raised)."

# 2) Payment pages: user-visible wording only
Patch "src/app/payment/callback/page-client.tsx" "Escrow hold" "Payment holding"
Patch "src/app/payment/promotion/callback/page-client.tsx" "Escrow hold" "Payment holding"
Patch "src/app/payment/subscription/callback/page-client.tsx" "Escrow hold" "Payment holding"

Patch "src/app/payment/callback/page-client.tsx" "Reference:" "Payment ID:"
Patch "src/app/payment/promotion/callback/page-client.tsx" "Reference:" "Payment ID:"
Patch "src/app/payment/subscription/callback/page-client.tsx" "Reference:" "Payment ID:"

# Fix broken dash text if present (use normal hyphen to avoid encoding issues)
Patch "src/app/payment/callback/page-client.tsx" "â€”" "-"
Patch "src/app/payment/promotion/callback/page-client.tsx" "â€”" "-"
Patch "src/app/payment/subscription/callback/page-client.tsx" "â€”" "-"

# 3) Register page: "slug" label shown to users
Patch "src/app/account/register/page-client.tsx" "Business slug (optional)" "Store link name (optional)"
Patch "src/app/account/register/page-client.tsx" "/b/your-slug" "/b/your-store-link"

# 4) Account opt-out UI (if visible to users)
Patch "src/app/account/page.tsx" "Enter store slug" "Enter store link name"
Patch "src/app/account/page.tsx" "Opted out from" "Muted messages from"
Patch "src/app/account/page.tsx" "Opt-in restored for" "Messages enabled for"

Write-Host "DONE. See gentle_terms_patch_log.txt"
