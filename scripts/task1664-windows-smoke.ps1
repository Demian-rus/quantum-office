$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted') { throw 'Disposable GitHub runner only' }
New-Item -ItemType Directory -Force evidence/native | Out-Null
$policy = 'HKLM:\SOFTWARE\Policies\Microsoft\Edge\WebView2\AdditionalBrowserArguments'
$name = 'quantum-office.exe'
$prior = Get-ItemProperty -Path $policy -Name $name -ErrorAction SilentlyContinue
if ($null -ne $prior) { throw 'Existing per-app debug policy; refusing to overwrite' }
$setup = (Get-ChildItem 'src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/*setup.exe' | Select-Object -First 1).FullName
$release = (Resolve-Path 'src-tauri/target/x86_64-pc-windows-msvc/release/quantum-office.exe').Path
$install = Join-Path $env:LOCALAPPDATA 'Quantum Office CI'
$exe = Join-Path $install 'quantum-office.exe'
$data = Join-Path $env:APPDATA 'com.quantumoffice.desktop/bank.sqlite3'
if (Test-Path $data) { throw 'CI bank not empty before installation' }
function Install-Office {
  $p = Start-Process -FilePath $setup -ArgumentList "/S /D=$install" -Wait -PassThru
  if ($p.ExitCode -ne 0 -or !(Test-Path $exe)) { throw "Installer failed: $($p.ExitCode)" }
  if ((Get-FileHash $exe).Hash -ne (Get-FileHash $release).Hash) { throw 'Installed binary differs from release' }
}
function Wait-Office($p) {
  $deadline = (Get-Date).AddSeconds(60)
  do { Start-Sleep -Milliseconds 500; $p.Refresh() } until ($p.HasExited -or (($p.MainWindowHandle -ne 0) -and (Test-Path $data)) -or (Get-Date) -gt $deadline)
  if ($p.HasExited -or $p.MainWindowHandle -eq 0 -or !(Test-Path $data)) { throw 'Desktop launch/database creation failed' }
  $header = [IO.File]::ReadAllBytes($data)
  if ([Text.Encoding]::ASCII.GetString($header,0,15) -ne 'SQLite format 3') { throw 'Not SQLite' }
}
function Wait-PortClosed {
  $deadline = (Get-Date).AddSeconds(30)
  while ((Get-NetTCPConnection -LocalPort 9222 -State Listen -ErrorAction SilentlyContinue) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 500 }
  if (Get-NetTCPConnection -LocalPort 9222 -State Listen -ErrorAction SilentlyContinue) { throw 'Previous WebView2 CDP port still open' }
}
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class QOWindowSize {
 [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left,Top,Right,Bottom; }
 [DllImport("user32.dll", SetLastError=true)] public static extern bool GetWindowRect(IntPtr h, out RECT r);
 [DllImport("user32.dll", SetLastError=true)] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
}
'@
function Resize-Office($p) {
  $results = @()
  foreach ($size in @(@{w=1000;h=740},@{w=1200;h=800})) {
    if (![QOWindowSize]::SetWindowPos($p.MainWindowHandle,[IntPtr]::Zero,0,0,$size.w,$size.h,0x16)) { throw 'SetWindowPos failed' }
    Start-Sleep -Milliseconds 500
    $rect = New-Object QOWindowSize+RECT
    if (![QOWindowSize]::GetWindowRect($p.MainWindowHandle,[ref]$rect)) { throw 'GetWindowRect failed' }
    $w = $rect.Right-$rect.Left; $h = $rect.Bottom-$rect.Top
    if ($w -ne $size.w -or $h -ne $size.h) { throw "Window size mismatch: $w x $h" }
    $results += @{width=$w;height=$h}
  }
  @{status='PASS';sizes=$results} | ConvertTo-Json -Depth 4 | Set-Content evidence/native/resize.json
}
function Save-Diagnostics($stage) {
  $procs = Get-CimInstance Win32_Process -Filter "Name='msedgewebview2.exe' OR Name='quantum-office.exe'" | Select-Object Name,ProcessId,ParentProcessId,ExecutablePath,CommandLine
  $ports = Get-NetTCPConnection -LocalPort 9222 -ErrorAction SilentlyContinue | Select-Object LocalAddress,State,OwningProcess
  @{stage=$stage; processes=@($procs); ports=@($ports)} | ConvertTo-Json -Depth 5 | Set-Content "evidence/native/process-$stage.json"
  if (@($ports | Where-Object { $_.State -eq 'Listen' -and $_.LocalAddress -notin @('127.0.0.1','::1') }).Count -gt 0) { throw 'Unexpected non-loopback CDP listener' }
  $procs | Format-Table Name,ProcessId,ParentProcessId,ExecutablePath | Out-String | Write-Host
  $ports | Format-Table | Out-String | Write-Host
}
$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
$versions = Get-ChildItem "${env:ProgramFiles(x86)}\Microsoft\EdgeWebView\Application" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name
@{administrator=$admin; runtimeFolders=@($versions); commit=$env:GITHUB_SHA; policy=$policy; exe=$exe} | ConvertTo-Json | Set-Content evidence/native/runner.json
# Reproduce original environment-only attempt with the same release executable.
Install-Office
Wait-PortClosed
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = '--remote-debugging-port=9222 --remote-debugging-address=127.0.0.1'
$p = Start-Process -FilePath $exe -PassThru
try {
  Wait-Office $p
  Start-Sleep -Seconds 5
  Save-Diagnostics 'env-only'
  try {
    $probe = Invoke-RestMethod -Uri 'http://127.0.0.1:9222/json/version' -TimeoutSec 3
    @{reachable=$true; version=$probe} | ConvertTo-Json -Depth 5 | Set-Content evidence/native/env-only.json
  } catch {
    @{reachable=$false; error=$_.Exception.Message} | ConvertTo-Json | Set-Content evidence/native/env-only.json
  }
  if (!$p.CloseMainWindow() -or !$p.WaitForExit(15000)) { throw 'Baseline process did not close' }
} finally {
  if (!$p.HasExited) { Stop-Process -Id $p.Id -Force }
  Remove-Item Env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS -ErrorAction SilentlyContinue
}
Wait-PortClosed
# Per-executable HKLM policy ONLY on isolated CI; never bundled into the app.
if (!(Test-Path $policy)) { New-Item -Path $policy -Force | Out-Null }
New-ItemProperty -Path $policy -Name $name -Value '--remote-debugging-port=9222 --remote-debugging-address=127.0.0.1' -PropertyType String -Force | Out-Null
try {
  for ($i=0; $i -lt 2; $i++) {
    if ($i -eq 1) { Install-Office }
    $stage = @('first','second')[$i]
    $p = Start-Process -FilePath $exe -PassThru
    try {
      Wait-Office $p
      $env:QO_NATIVE_PID = [string]$p.Id
      if ($i -eq 0) { Resize-Office $p }
      Save-Diagnostics $stage
      node tests/task1664_native.cjs $stage
      if ($LASTEXITCODE -ne 0) { throw 'Native WebView integration failed' }
      if ($i -eq 1) { node tests/task1664_scale.cjs; if ($LASTEXITCODE -ne 0) { throw 'Native comparative benchmark failed' } }
      if (!$p.CloseMainWindow()) { throw 'Window close failed' }
      if (!$p.WaitForExit(15000)) { throw 'Clean close timed out' }
      if ($p.ExitCode -ne 0) { throw "Unexpected exit $($p.ExitCode)" }
    } finally {
      Save-Diagnostics "$stage-final"
      if (!$p.HasExited) { Stop-Process -Id $p.Id -Force }
    }
    Wait-PortClosed
  }
  @{status='PASS'; launchCount=2; installed=$exe; reinstall=$true; database=$data; commit=$env:GITHUB_SHA} | ConvertTo-Json | Set-Content evidence/native/launch.json
} finally {
  Remove-ItemProperty -Path $policy -Name $name -ErrorAction Stop
}

# Verify the actual portable copy launches after removing the CI debug policy.
Wait-PortClosed
$p = Start-Process -FilePath (Resolve-Path 'portable/quantum-office.exe') -PassThru
try {
  Wait-Office $p
  Start-Sleep -Seconds 3
  Save-Diagnostics 'portable-no-policy'
  if (Get-NetTCPConnection -LocalPort 9222 -State Listen -ErrorAction SilentlyContinue) { throw 'Unexpected debug listener in portable release' }
  if (!$p.CloseMainWindow() -or !$p.WaitForExit(15000)) { throw 'Portable close failed' }
  @{status='PASS'; executable='portable/quantum-office.exe'; noCdpListener=$true; commit=$env:GITHUB_SHA} | ConvertTo-Json | Set-Content evidence/native/portable-launch.json
} finally { if (!$p.HasExited) { Stop-Process -Id $p.Id -Force } }
