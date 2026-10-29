param(
    [Parameter(Mandatory=$true)][string]$DiskPath,
    [string]$IsoPath,
    [string]$OutputRoot = (Join-Path $PSScriptRoot '..\out\VirtualBox'),
    [string]$Name = 'BoralancesOS'
)
$ErrorActionPreference = 'Stop'
$virtualBoxExecutable = Join-Path $env:ProgramFiles 'Oracle\VirtualBox\VBoxManage.exe'
if (!(Test-Path -LiteralPath $virtualBoxExecutable)) { throw 'Oracle VirtualBox is not installed.' }
$resolvedDisk = (Resolve-Path -LiteralPath $DiskPath).Path
$resolvedOutput = [IO.Path]::GetFullPath($OutputRoot)
$machineDirectory = Join-Path $resolvedOutput $Name
if (Test-Path -LiteralPath (Join-Path $machineDirectory ($Name + '.vbox'))) {
    throw 'This VM configuration already exists. Choose another name instead of overwriting it.'
}
function Invoke-VBox([string[]]$Arguments) {
    & $virtualBoxExecutable @Arguments
    if ($LASTEXITCODE -ne 0) { throw "VirtualBox command failed: $($Arguments[0])" }
}
New-Item -ItemType Directory -Force -Path $resolvedOutput | Out-Null
Invoke-VBox -Arguments @('createvm','--name',$Name,'--basefolder',$resolvedOutput,'--ostype','Linux_64','--register')
Invoke-VBox -Arguments @('modifyvm',$Name,'--memory','4096','--cpus','2','--firmware','efi',
    '--paravirt-provider','kvm','--hpet','off',
    '--graphicscontroller','vmsvga','--vram','128','--accelerate-3d','on',
    '--boot1','disk','--boot2','dvd','--boot3','none','--boot4','none',
    '--audio-enabled','on','--audio-driver','default','--audio-controller','hda','--audio-out','on','--audio-in','off',
    '--clipboard-mode','bidirectional','--drag-and-drop','disabled','--nic1','nat')
Invoke-VBox -Arguments @('setextradata',$Name,'VBoxInternal2/EfiGraphicsResolution','1280x800')
Invoke-VBox -Arguments @('setextradata',$Name,'GUI/LastGuestSizeHint','1280,800')
Invoke-VBox -Arguments @('setextradata',$Name,'GUI/AutoresizeGuest','false')
Invoke-VBox -Arguments @('storagectl',$Name,'--name','SATA','--add','sata','--controller','IntelAhci','--portcount','2','--bootable','on')
Invoke-VBox -Arguments @('storageattach',$Name,'--storagectl','SATA','--port','0','--device','0','--type','hdd','--medium',$resolvedDisk)
if ($IsoPath) {
    $resolvedIso = (Resolve-Path -LiteralPath $IsoPath).Path
    Invoke-VBox -Arguments @('storageattach',$Name,'--storagectl','SATA','--port','1','--device','0','--type','dvddrive','--medium',$resolvedIso)
}
Invoke-VBox -Arguments @('modifyvm',$Name,'--description','BoralancesOS with Desktop Experience 0.3. UEFI / VMSVGA 3D / 4 GB RAM / 2 CPUs / KVM clock provider. Set the bora password at first boot. Built from the included locked NixOS configuration.')
Write-Output (Join-Path $machineDirectory ($Name + '.vbox'))
