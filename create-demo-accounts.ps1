# =============================================================================
# SahiKaarigar — create two dummy accounts (customer + kaarigar) via the real
# production API, using the passwordless phone-OTP flow (SMS_PROVIDER=console,
# so the OTP comes back in the signinup response as `userInputCode`).
#
# Usage:  pwsh -File create-demo-accounts.ps1
# =============================================================================

$ErrorActionPreference = 'Stop'
$api = 'https://sahikaarigar-auth.onrender.com'

function Get-Session($phone) {
    # 1) ask for an OTP
    $r1 = Invoke-WebRequest -Uri "$api/auth/signinup/code" -Method Post `
        -ContentType 'application/json' `
        -Body (@{ phoneNumber = $phone } | ConvertTo-Json) -TimeoutSec 90
    $j = $r1.Content | ConvertFrom-Json
    if ($j.status -ne 'OK') { throw "OTP request failed for $phone : $($j.message)" }

    # 2) consume it -> we get a bearer access token in the st-access-token header
    $r2 = Invoke-WebRequest -Uri "$api/auth/signinup/code/consume" -Method Post `
        -ContentType 'application/json' `
        -Body (@{ preAuthSessionId = $j.preAuthSessionId; deviceId = $j.deviceId; userInputCode = $j.userInputCode } | ConvertTo-Json) `
        -TimeoutSec 90
    $at = $r2.Headers['st-access-token']
    if (-not $at) { throw "No access token returned for $phone" }
    return @{ headers = @{ Authorization = "Bearer $at" } }
}

# --- Account 1 : CUSTOMER (role stays employer) ------------------------------
$cust = Get-Session '+919999900002'
$me1 = Invoke-RestMethod -Uri "$api/me" -Headers $cust.headers -TimeoutSec 30
Invoke-RestMethod -Uri "$api/profile" -Method Post -Headers $cust.headers `
    -ContentType 'application/json' -TimeoutSec 30 `
    -Body (@{ name='Test Customer'; locationArea='Mehdipatnam'; locationCity='Hyderabad' } | ConvertTo-Json) | Out-Null
$chk1 = Invoke-RestMethod -Uri "$api/me" -Headers $cust.headers -TimeoutSec 30
Write-Output "CUSTOMER  phone=9999900002  id=$($chk1.user.id)  name=$($chk1.user.name)  role=$($chk1.user.role)  area=$($chk1.user.location_area)  city=$($chk1.user.location_city)"

# --- Account 2 : KAARIGAR (employer login + register-worker profile) ----------
$kar = Get-Session '+919999900003'
Invoke-RestMethod -Uri "$api/profile" -Method Post -Headers $kar.headers `
    -ContentType 'application/json' -TimeoutSec 30 `
    -Body (@{ name='Ramesh Kumar'; locationArea='Tolichowki'; locationCity='Hyderabad' } | ConvertTo-Json) | Out-Null
# /register-worker expects a NESTED `profile` object (index.js: req.body?.profile)
$reg = Invoke-RestMethod -Uri "$api/register-worker" -Method Post -Headers $kar.headers `
    -ContentType 'application/json' -TimeoutSec 30 `
    -Body (@{
        name = 'Ramesh Kumar'
        profile = @{
            skills       = @('plumbing','electrical')
            experience   = 8
            hourlyRate   = 300
            description  = 'Experienced plumber and electrician. 8 years working in Tolichowki area.'
            availability = 'available'
            serviceAreas = @('Tolichowki','Mehdipatnam','Chandrayangutta')
        }
    } | ConvertTo-Json -Depth 6)
$chk2 = Invoke-RestMethod -Uri "$api/me" -Headers $kar.headers -TimeoutSec 30
Write-Output "KAARIGAR  phone=9999900003  id=$($chk2.user.id)  name=$($chk2.user.name)  role=$($chk2.user.role)  area=$($chk2.user.location_area)  city=$($chk2.user.location_city)"
$wp = $reg.workerProfile
Write-Output "WORKER PROFILE: id=$($wp.id)  skills=$($wp.skills -join '/')  rate=$($wp.hourlyRate)  approved=$($wp.isApproved)  available=$($wp.availability)"

Write-Output ""
Write-Output "DONE - both accounts ready. NOTE: kaarigar profile is_approved=false, so it won't appear in public search until an admin approves it."
