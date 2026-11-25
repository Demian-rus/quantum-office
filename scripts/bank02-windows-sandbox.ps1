[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$Executable,
    [string]$Fixture
)

$ErrorActionPreference = 'Stop'
$binary = Get-Item -LiteralPath $Executable
if ($binary.PSIsContainer -or $binary.Extension -ne '.exe') {
    throw 'Specify the locally compiled Windows executable.'
}

$session = Join-Path ([IO.Path]::GetTempPath()) "QuantumOffice-BANK02-$([guid]::NewGuid())"
$inputFolder = Join-Path $session 'input'
New-Item -ItemType Directory -Path $inputFolder -Force | Out-Null
Copy-Item -LiteralPath $binary.FullName -Destination (Join-Path $inputFolder 'quantum-office.exe')

if ($Fixture) {
    $archive = Get-Item -LiteralPath $Fixture
    if ($archive.PSIsContainer -or $archive.Extension -ne '.qwbank') {
        throw 'Specify the synthetic QWBANK test fixture.'
    }
    Copy-Item -LiteralPath $archive.FullName -Destination (Join-Path $inputFolder 'fixture.qwbank')
}

$hostFolder = [Security.SecurityElement]::Escape($inputFolder)
$config = Join-Path $session 'QuantumOffice-BANK02.wsb'
@"
<Configuration>
  <Networking>Disable</Networking>
  <ClipboardRedirection>Disable</ClipboardRedirection>
  <MappedFolders>
    <MappedFolder>
      <HostFolder>$hostFolder</HostFolder>
      <SandboxFolder>C:\Bank02Input</SandboxFolder>
      <ReadOnly>true</ReadOnly>
    </MappedFolder>
  </MappedFolders>
  <LogonCommand>
    <Command>C:\Bank02Input\quantum-office.exe</Command>
  </LogonCommand>
</Configuration>
"@ | Set-Content -LiteralPath $config -Encoding UTF8
Get-Item -LiteralPath $config
