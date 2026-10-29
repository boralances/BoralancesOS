param([string]$OutputDirectory=(Join-Path $PSScriptRoot '..\out\V1'))
$ErrorActionPreference='Stop'
$vbox=Join-Path $env:ProgramFiles 'Oracle\VirtualBox\VBoxManage.exe'
if(!(Test-Path -LiteralPath $vbox)){throw 'Oracle VirtualBox is required.'}
$workspace=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$output=[IO.Path]::GetFullPath($OutputDirectory)
$build=Join-Path $workspace ('.cache\build\v1-vbox-template-'+[Guid]::NewGuid().ToString('N').Substring(0,8))
$name='BoralancesOS V1 Template '+[Guid]::NewGuid().ToString('N').Substring(0,8)
$ova=Join-Path $output 'BoralancesOS-V1-VirtualBox.ova'
$zip=Join-Path $output 'BoralancesOS-V1-VirtualBox-Kit.zip'
if((Test-Path -LiteralPath $ova) -or (Test-Path -LiteralPath $zip)){throw 'V1 kit artifacts already exist; preserve them or choose another output folder.'}
[void][IO.Directory]::CreateDirectory($output)
function Invoke-VBox([string[]]$Arguments){
  $ErrorActionPreference='Continue'
  $result=& $vbox @Arguments 2>&1
  if($LASTEXITCODE -ne 0){throw ($result -join "`n")}
  return $result
}
[void](Invoke-VBox -Arguments @('createvm','--name',$name,'--basefolder',$build,'--ostype','Linux_64','--register'))
$registered=$true
try {
  $machine=Join-Path $build $name;$disk=Join-Path $machine 'BoralancesOS-V1-Blank.vdi'
  [void](Invoke-VBox -Arguments @('createmedium','disk','--filename',$disk,'--size','40960','--format','VDI','--variant','Standard'))
  [void](Invoke-VBox -Arguments @('modifyvm',$name,'--memory','4096','--cpus','2','--firmware','efi','--paravirt-provider','kvm','--hpet','off','--graphicscontroller','vmsvga','--vram','128','--accelerate-3d','on','--boot1','disk','--boot2','dvd','--boot3','none','--boot4','none','--audio-enabled','on','--audio-driver','default','--audio-controller','hda','--audio-out','on','--audio-in','on','--usb-xhci','on','--nic1','nat','--clipboard-mode','bidirectional','--drag-and-drop','disabled','--description','BoralancesOS V1 install kit. Blank 40 GiB disk. Attach the V1 ISO and choose your own account during installation.'))
  [void](Invoke-VBox -Arguments @('setextradata',$name,'VBoxInternal2/EfiGraphicsResolution','1280x800'))
  [void](Invoke-VBox -Arguments @('setextradata',$name,'GUI/LastGuestSizeHint','1280,800'))
  [void](Invoke-VBox -Arguments @('setextradata',$name,'GUI/AutoresizeGuest','false'))
  [void](Invoke-VBox -Arguments @('storagectl',$name,'--name','SATA','--add','sata','--controller','IntelAhci','--portcount','2','--bootable','on'))
  [void](Invoke-VBox -Arguments @('storageattach',$name,'--storagectl','SATA','--port','0','--device','0','--type','hdd','--medium',$disk,'--nonrotational','on','--discard','on'))
  [void](Invoke-VBox -Arguments @('storageattach',$name,'--storagectl','SATA','--port','1','--device','0','--type','dvddrive','--medium','emptydrive'))
  [void](Invoke-VBox -Arguments @('export',$name,'--output',$ova,'--ovf20','--manifest','--vsys','0','--vmname','BoralancesOS V1','--product','BoralancesOS V1 install kit','--version','1.0.0'))
  $package=Join-Path $build 'package';[void][IO.Directory]::CreateDirectory($package)
  Copy-Item -LiteralPath $ova -Destination $package
  Copy-Item -Path (Join-Path $workspace 'design\os-site\downloads\virtualbox-kit\*') -Destination $package
  Compress-Archive -Path (Join-Path $package '*') -DestinationPath $zip -CompressionLevel Optimal
  if((Get-Item -LiteralPath $zip).Length -ge 25000000){throw 'The kit exceeds the requested 25 MB file limit.'}
  Get-FileHash -LiteralPath $ova,$zip -Algorithm SHA256 | Select-Object Path,Hash
} finally {
  if($registered){[void](Invoke-VBox -Arguments @('unregistervm',$name))}
}
