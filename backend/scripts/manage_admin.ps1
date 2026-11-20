param(
    [Parameter(Mandatory=$true)][ValidateSet('create','promote')][string]$Action,
    [Parameter(Mandatory=$true)][string]$Email,
    [string]$FullName,
    [string]$PhpBinary = 'C:\xampp\php\php.exe'
)
$ErrorActionPreference = 'Stop'
$adminEmail = $Email.Trim().ToLowerInvariant()
$adminPayload = @{ action=$Action; email=$adminEmail }
$adminSecret = $null
$adminConfirm = $null
$adminPointer = [IntPtr]::Zero
$adminConfirmPointer = [IntPtr]::Zero
$previousEncoding = $OutputEncoding
try {
    if ($Action -eq 'create') {
        if (-not $FullName) { $FullName = Read-Host 'Full name' }
        $adminPayload.full_name = $FullName
        $adminSecret = Read-Host 'Admin password (12-72 UTF-8 bytes)' -AsSecureString
        $adminConfirm = Read-Host 'Confirm password' -AsSecureString
        $adminPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($adminSecret)
        $adminConfirmPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($adminConfirm)
        $adminPayload.password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($adminPointer)
        $adminConfirmation = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($adminConfirmPointer)
        if ($adminPayload.password -cne $adminConfirmation) { throw 'Passwords do not match.' }
    } else {
        $adminPayload.confirm_email = Read-Host "Type $adminEmail to confirm promotion"
    }
    $OutputEncoding = New-Object System.Text.UTF8Encoding($false)
    $adminPayload | ConvertTo-Json -Compress | & $PhpBinary (Join-Path $PSScriptRoot 'admin_account.php')
    if ($LASTEXITCODE -ne 0) { throw 'Admin action failed.' }
} finally {
    if ($adminPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($adminPointer) }
    if ($adminConfirmPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($adminConfirmPointer) }
    if ($adminSecret) { $adminSecret.Dispose() }
    if ($adminConfirm) { $adminConfirm.Dispose() }
    $adminPayload.Clear()
    $adminConfirmation = $null
    $OutputEncoding = $previousEncoding
}
