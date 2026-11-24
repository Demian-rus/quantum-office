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
function Save-Diagnostics($stage) {
  $procs = Get-CimInstance Win32_Process -Filter "Name='msedgewebview2.exe' OR Name='quantum-office.exe'" | Select-Object Name,ProcessId,ParentProcessId,ExecutablePath,CommandLine
  $ports = Get-NetTCPConnection -LocalPort 9222 -ErrorAction SilentlyContinue | Select-Object LocalAddress,State,OwningProcess
  @{stage=$stage; processes=@($procs); ports=@($ports)} | ConvertTo-Json -Depth 5 | Set-Content "evidence/native/process-$stage.json"
  $procs | Format-Table Name,ProcessId,ParentProcessId,ExecutablePath | Out-String | Write-Host
  $ports | Format-Table | Out-String | Write-Host
}
$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
$versions = Get-ChildItem "${env:ProgramFiles(x86)}\Microsoft\EdgeWebView\Application" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name
@{administrator=$admin; runtimeFolders=@($versions); commit=$env:GITHUB_SHA; policy=$policy; exe=$exe} | ConvertTo-Json | Set-Content evidence/native/runner.json
# No application config change: documented per-executable machine policy on disposable CI.
New-Item -Path $policy -Force | Out-Null
New-ItemProperty -Path $policy -Name $name -Value '--remote-debugging-port=9222 --remote-debugging-address=127.0.0.1' -PropertyType String -Force | Out-Null
try {
  Install-Office
  for ($i=0; $i -lt 2; $i++) {
    if ($i -eq 1) { Install-Office }
    $stage = @('first','second')[$i]
    $p = Start-Process -FilePath $exe -PassThru
    try {
      $deadline = (Get-Date).AddSeconds(60)
      do { Start-Sleep -Milliseconds 500; $p.Refresh() } until ($p.HasExited -or (($p.MainWindowHandle -ne 0) -and (Test-Path $data)) -or (Get-Date) -gt $deadline)
      if ($p.HasExited -or $p.MainWindowHandle -eq 0 -or !(Test-Path $data)) { throw 'Desktop launch/database creation failed' }
      $header = [IO.File]::ReadAllBytes($data)
      if ([Text.Encoding]::ASCII.GetString($header,0,15) -ne 'SQLite format 3') { throw 'Not SQLite' }
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
    # Avoid reusing the earlier browser process or its CDP port.
    $deadline = (Get-Date).AddSeconds(30)
    while ((Get-NetTCPConnection -LocalPort 9222 -State Listen -ErrorAction SilentlyContinue) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 500 }
    if (Get-NetTCPConnection -LocalPort 9222 -State Listen -ErrorAction SilentlyContinue) { throw 'Previous WebView2 CDP port still open' }
  }
  @{status='PASS'; launchCount=2; installed=$exe; reinstall=$true; database=$data; commit=$env:GITHUB_SHA} | ConvertTo-Json | Set-Content evidence/native/launch.json
} finally {
  Remove-ItemProperty -Path $policy -Name $name -ErrorAction Stop
}
