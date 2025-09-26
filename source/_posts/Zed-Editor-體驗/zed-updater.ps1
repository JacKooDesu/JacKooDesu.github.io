function Entry {
    Write-Host "##### Zed Updater #####"
    Write-Host "1. Download from source"
    Write-Host "2. Revert version"
    Write-Host "3. Create menu shortcut"
    Write-Host "4. Remove zed"
    Write-Host "5. Exit"
    Write-Host "#######################"

    $choice = Read-Host "Enter your choice"

    $url = "https://github.com/deevus/zed-windows-builds/releases/latest/download/zed.exe"
    $zedRoot = "$Env:LocalAppData\Programs\Zed\"
    $binaryName = "zed.exe"
    $binaryPath = "$zedRoot\$binaryName"
    $bakName = "zed.old.exe"
    $oldBinaryPath = "$zedRoot\$bakName"

    $shortcutPath = "$Env:AppData\Microsoft\Windows\Start Menu\Programs\Zed.lnk"

    if ($choice -eq "1") {
        Pull-From-Source
    } elseif ($choice -eq "2") {
        Revert-Version
    } elseif ($choice -eq "3") {
        Create-Menu-Shortcut
    } elseif ($choice -eq "4") {
        Remove-Zed
    }else{
        Exit
    }
}

function Pull-From-Source {
    if (-Not (Test-Path $zedRoot)) {
        New-Item -ItemType Directory -Path $zedRoot
    }

    if (Test-Path $binaryPath) {
        if(Test-Path $oldBinaryPath) {
            Remove-Item $oldBinaryPath
        }
        Rename-Item $binaryPath -NewName $bakName
    }

    Invoke-WithoutProgress {
        Invoke-WebRequest -Uri $url -OutFile $binaryPath
    }
}

function Revert-Version {
    if (-Not (Test-Path $oldBinaryPath)) {
        Write-Host "`($oldBinaryPath)` not found"
        return
    }

    if(Test-Path $binaryPath) {
        Remove-Item $binaryPath
        Write-Host "Removed latest version..."
    }

    Rename-Item $oldBinaryPath -NewName $binaryName
    Write-Host "Removed latest version..."
}

function Remove-Zed {
    if (Test-Path $oldBinaryPath) {
        Remove-Item $oldBinaryPath
        Write-Host "Zed.old removed successfully!"
    }

    if (Test-Path $binaryPath) {
        Remove-Item $binaryPath
        Write-Host "Zed removed successfully!"
    }

    if(Test-Path $shortcutPath) {
        Remove-Item $shortcutPath
        Write-Host "Shortcut removed successfully!"
    }
}

function Create-Menu-Shortcut {
    $targetPath = $binaryPath

    $WshShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut($shortcutPath)
    $Shortcut.TargetPath = $targetPath
    $Shortcut.IconLocation = ("$binaryPath, 0")
    $Shortcut.Save()

    Write-Host "Shortcut created successfully!"
}

# 使用 SilentlyContinue 提升效能
$null = New-Module {
    function Invoke-WithoutProgress {
        [CmdletBinding()]
        param(
            [Parameter(Mandatory=$true)]
            [scriptblock]$ScriptBlock
        )

        $prevProgressPreference = $global:ProgressPreference

        try {
            $global:ProgressPreference = 'SilentlyContinue'

            . $ScriptBlock
        }
        finally {
            $global:ProgressPreference = $prevProgressPreference
        }
    }
}

while(1) {
    Entry
}
