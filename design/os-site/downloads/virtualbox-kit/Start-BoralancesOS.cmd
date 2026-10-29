@echo off
setlocal
set "VBOX=%ProgramFiles%\Oracle\VirtualBox\VBoxManage.exe"
set "VM_NAME=BoralancesOS V1"
set "ISO_FILE=%~1"
if not defined ISO_FILE set "ISO_FILE=%~dp0BoralancesOS-V1-Live-Installer-x86_64.iso"
if not exist "%VBOX%" (
  echo Install Oracle VirtualBox from https://www.virtualbox.org/ first.
  pause
  exit /b 1
)
if not exist "%ISO_FILE%" (
  echo Drag the assembled BoralancesOS V1 ISO onto this file.
  echo Alternatively, place the ISO beside this file and run it again.
  pause
  exit /b 1
)
"%VBOX%" showvminfo "%VM_NAME%" >nul 2>&1
if not errorlevel 1 (
  echo A VM named BoralancesOS V1 already exists. Open it in VirtualBox.
  echo Nothing has been overwritten.
  pause
  exit /b 1
)
"%VBOX%" import "%~dp0BoralancesOS-V1-VirtualBox.ova" --options importtovdi --vsys 0 --vmname "%VM_NAME%"
if errorlevel 1 goto failed
"%VBOX%" modifyvm "%VM_NAME%" --memory 4096 --cpus 2 --paravirt-provider kvm --hpet off --graphicscontroller vmsvga --vram 128 --accelerate-3d on --usb-xhci on --audio-in on
if errorlevel 1 goto failed
"%VBOX%" storageattach "%VM_NAME%" --storagectl SATA --port 1 --device 0 --type dvddrive --medium "%ISO_FILE%"
if errorlevel 1 goto failed
"%VBOX%" setextradata "%VM_NAME%" GUI/AutoresizeGuest false
"%VBOX%" setextradata "%VM_NAME%" GUI/LastGuestSizeHint 1280,800
"%VBOX%" startvm "%VM_NAME%" --type gui
if errorlevel 1 goto failed
exit /b 0
:failed
echo Setup did not complete. Review the message above in VirtualBox.
echo Existing VMs and disks have not been removed.
pause
exit /b 1
