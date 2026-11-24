param([int]$ProcessId,[string]$Report)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$p=Get-Process -Id $ProcessId
$root=[System.Windows.Automation.AutomationElement]::FromHandle($p.MainWindowHandle)
$deadline=(Get-Date).AddSeconds(30)
$visible=$false
do{
 $elements=$root.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)
 foreach($element in $elements){try{if($element.Current.Name -like '*TASK1664 Sheets*'){$visible=$true;break}}catch{}}
 if(!$visible){Start-Sleep -Milliseconds 500}
}until($visible -or (Get-Date) -gt $deadline)
@{sheetTitleAccessible=$visible;scope='real Windows accessibility tree, no CDP'}|ConvertTo-Json|Set-Content $Report -Encoding UTF8
if(!$visible){exit 1}
