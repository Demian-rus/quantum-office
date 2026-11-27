$ErrorActionPreference='Stop'
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted') { throw 'Disposable GitHub runner only' }
New-Item -ItemType Directory -Force evidence/release044 | Out-Null
$data=Join-Path $env:APPDATA 'com.quantumoffice.desktop'
if (Test-Path $data) { throw 'Existing user data; refuse upgrade test' }
$install=Join-Path $env:LOCALAPPDATA 'Quantum Office Release CI'
$exe=Join-Path $install 'quantum-office.exe'
$old=(Get-Item 'src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/Quantum Office_0.4.3_x64-setup.exe').FullName
$new=(Get-Item 'release-files/Quantum Office_0.4.4_x64-setup.exe').FullName
$policy='HKLM:\SOFTWARE\Policies\Microsoft\Edge\WebView2\AdditionalBrowserArguments'
$name='quantum-office.exe'
if ($null -ne (Get-ItemProperty -Path $policy -Name $name -ErrorAction SilentlyContinue)) { throw 'Existing WebView debug policy' }
function Install-Office($setup,$version) {
 $p=Start-Process -FilePath $setup -ArgumentList "/S /D=$install" -Wait -PassThru
 if ($p.ExitCode -ne 0 -or !(Test-Path $exe)) { throw "Install failed: $($p.ExitCode)" }
 $actual=(Get-Item $exe).VersionInfo.ProductVersion
 if (!$actual.StartsWith($version)) { throw "Installed PE version $actual expected $version" }
 # Independently verify installed executable against NSIS payload.
 $dir=Join-Path $env:RUNNER_TEMP ('qo-release-payload-'+[Guid]::NewGuid().ToString('N'))
 & "$env:ProgramFiles\7-Zip\7z.exe" x -y "-o$dir" $setup | Out-Host
 if ($LASTEXITCODE -ne 0) { throw 'NSIS extraction failed' }
 $payload=@(Get-ChildItem $dir -Recurse -File -Filter 'quantum-office.exe')
 if ($payload.Count -ne 1 -or (Get-FileHash $payload[0].FullName).Hash -ne (Get-FileHash $exe).Hash) { throw 'Installed payload mismatch' }
 Remove-Item $dir -Recurse -Force
 @{version=$actual;setupSha256=(Get-FileHash $setup).Hash;installedSha256=(Get-FileHash $exe).Hash} | ConvertTo-Json | Set-Content "evidence/release044/install-$version.json"
}
function Wait-PortClosed {
 $deadline=(Get-Date).AddSeconds(30)
 while ((Get-NetTCPConnection -LocalPort 9222 -State Listen -ErrorAction SilentlyContinue) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 500 }
 if (Get-NetTCPConnection -LocalPort 9222 -State Listen -ErrorAction SilentlyContinue) { throw 'Previous CDP port still open' }
}
function Test-Stage($stage) {
 Wait-PortClosed
 $p=Start-Process -FilePath $exe -PassThru
 try {
  node tests/release044_native.cjs $stage
  if ($LASTEXITCODE -ne 0) { throw "Native test failed $stage" }
  if (!$p.CloseMainWindow() -or !$p.WaitForExit(20000)) { throw 'Clean close failed' }
  if ($p.ExitCode -ne 0) { throw 'Unexpected app exit' }
 } finally { if (!$p.HasExited) { Stop-Process -Id $p.Id -Force } }
 Wait-PortClosed
}
if (!(Test-Path $policy)) { New-Item -Path $policy -Force | Out-Null }
New-ItemProperty -Path $policy -Name $name -Value '--remote-debugging-port=9222 --remote-debugging-address=127.0.0.1' -PropertyType String -Force | Out-Null
try {
 Install-Office $old '0.4.3'
 Test-Stage 'old'
 if (!(Test-Path (Join-Path $data 'bank.sqlite3'))) { throw 'Old bank missing' }
 Install-Office $new '0.4.4'
 Test-Stage 'new'
 Test-Stage 'restart'
 @{status='PASS';old='0.4.3';new='0.4.4';directory=$data;commit=(git rev-parse HEAD).Trim();nativePrintPreview=$true;nativeLegacyPdfBytes=$true;manualPrintDialog=$false} | ConvertTo-Json | Set-Content evidence/release044/upgrade-report.json
} finally { Remove-ItemProperty -Path $policy -Name $name -ErrorAction Stop }
