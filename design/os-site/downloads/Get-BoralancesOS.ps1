param(
  [string]$ManifestUri,
  [ValidateSet('iso','virtualbox')][string]$Artifact='iso',
  [string]$OutputDirectory='.'
)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Net.Http
[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
$client=[Net.Http.HttpClient]::new()
$client.Timeout=[TimeSpan]::FromSeconds(180)
$client.DefaultRequestHeaders.UserAgent.ParseAdd('BoralancesOS-V1-Downloader')
function Assert-Name([string]$Value) {
  if($Value -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]*$'){throw 'Unsafe release filename.'}
}
function Assert-Hash([string]$Value) {
  if($Value -notmatch '^[0-9a-fA-F]{64}$'){throw 'Invalid SHA-256 checksum.'}
}
function Read-Remote([string]$Url,[int]$Limit) {
  $uri=[Uri]$Url
  if($uri.Scheme -ne 'https' -and !($uri.Scheme -eq 'http' -and $uri.IsLoopback)){throw 'Downloads require HTTPS.'}
  $response=$client.GetAsync($uri,[Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
  try {
    [void]$response.EnsureSuccessStatusCode()
    $stream=$response.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
    $memory=[IO.MemoryStream]::new();$buffer=[byte[]]::new(65536)
    try {
      while(($read=$stream.Read($buffer,0,$buffer.Length)) -gt 0) {
        if($memory.Length+$read -gt $Limit){throw 'The server returned more data than expected.'}
        $memory.Write($buffer,0,$read)
      }
      return ,$memory.ToArray()
    } finally {$memory.Dispose();$stream.Dispose()}
  } finally {$response.Dispose()}
}
function Get-BytesHash([byte[]]$Bytes) {
  $sha=[Security.Cryptography.SHA256]::Create()
  try {return ([BitConverter]::ToString($sha.ComputeHash($Bytes))).Replace('-','').ToLowerInvariant()} finally {$sha.Dispose()}
}
try {
  if(!$ManifestUri){
    $local=Join-Path $PSScriptRoot 'boralancesos-v1.json'
    $ManifestUri=if(Test-Path -LiteralPath $local){$local}else{'https://github.com/boralances/web1/releases/download/boralancesos-v1/boralancesos-v1.json'}
  }
  $base=$null
  if($ManifestUri -match '^https?://'){$manifestText=[Text.Encoding]::UTF8.GetString((Read-Remote $ManifestUri 2000000))}
  else {$manifestPath=(Resolve-Path -LiteralPath $ManifestUri).Path;$base=Split-Path -Parent $manifestPath;$manifestText=[IO.File]::ReadAllText($manifestPath)}
  $manifest=$manifestText | ConvertFrom-Json
  $item=@($manifest.artifacts | Where-Object {$_.id -eq $Artifact})
  if($item.Count -ne 1 -or !$item[0].ready){throw 'The requested artifact is not ready.'}
  $item=$item[0];Assert-Name $item.file;Assert-Hash $item.sha256
  if($item.parts.Count -lt 1 -or $item.parts.Count -gt 1000){throw 'Invalid release part count.'}
  $names=@{};$total=[long]0
  foreach($part in $item.parts){
    Assert-Name $part.name;Assert-Hash $part.sha256
    if($names.ContainsKey($part.name) -or [long]$part.bytes -le 0 -or [long]$part.bytes -ge 25000000){throw 'Invalid or duplicate release part.'}
    $names[$part.name]=$true;$total+=[long]$part.bytes
  }
  if($total -ne [long]$item.bytes){throw 'Part sizes do not match the complete file.'}
  $output=[IO.Path]::GetFullPath($OutputDirectory)
  [void][IO.Directory]::CreateDirectory($output)
  $target=Join-Path $output $item.file
  if(Test-Path -LiteralPath $target){
    if((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -ieq $item.sha256){Write-Output "Already verified: $target";return}
    throw "A different file exists at $target. Move it before retrying."
  }
  $partial=$target+'.partial';$marker=$partial+'.json';$complete=0
  if((Test-Path -LiteralPath $partial) -and !(Test-Path -LiteralPath $marker)){throw 'An unrecognized partial file exists; it will not be overwritten.'}
  if(Test-Path -LiteralPath $marker){if(([IO.File]::ReadAllText($marker) | ConvertFrom-Json).sha256 -ine $item.sha256){throw 'The partial download belongs to another release.'}}
  else {[IO.File]::WriteAllText($marker,(@{file=$item.file;sha256=$item.sha256} | ConvertTo-Json))}
  if(Test-Path -LiteralPath $partial){
    $source=[IO.File]::OpenRead($partial)
    try {
      foreach($part in $item.parts){
        if($source.Position -eq $source.Length){break}
        $data=[byte[]]::new([int]$part.bytes);$offset=0
        while($offset -lt $data.Length){$read=$source.Read($data,$offset,$data.Length-$offset);if(!$read){break};$offset+=$read}
        if($offset -ne $data.Length -or (Get-BytesHash $data) -ine $part.sha256){throw 'The partial file is damaged. Move it and its marker before retrying.'}
        $complete++
      }
      if($source.Position -ne $source.Length){throw 'The partial file is larger than this release.'}
    } finally {$source.Dispose()}
  }
  $drive=[IO.DriveInfo]::new([IO.Path]::GetPathRoot($output))
  $existing=if(Test-Path -LiteralPath $partial){(Get-Item -LiteralPath $partial).Length}else{0}
  if($drive.AvailableFreeSpace -lt $total-$existing+25000000){throw 'Not enough free space for the assembled file.'}
  $destination=[IO.File]::Open($partial,[IO.FileMode]::Append,[IO.FileAccess]::Write,[IO.FileShare]::None)
  try {
    for($index=$complete;$index -lt $item.parts.Count;$index++){
      $part=$item.parts[$index];Write-Output ('Downloading {0}/{1}: {2}' -f ($index+1),$item.parts.Count,$part.name)
      $localPart=if($base){Join-Path $base $part.name}else{$null}
      if($localPart -and (Test-Path -LiteralPath $localPart)){$data=[IO.File]::ReadAllBytes($localPart)}
      else {if(!$manifest.published){throw 'Remote release assets are not published yet.'};$data=Read-Remote $part.url ([int]$part.bytes)}
      if($data.Length -ne [long]$part.bytes -or (Get-BytesHash $data) -ine $part.sha256){throw ('Checksum or size mismatch for '+$part.name)}
      $destination.Write($data,0,$data.Length);$destination.Flush($true)
    }
  } finally {$destination.Dispose()}
  if((Get-FileHash -LiteralPath $partial -Algorithm SHA256).Hash -ine $item.sha256){throw 'The final file checksum did not match; the partial file has been retained.'}
  Move-Item -LiteralPath $partial -Destination $target
  Remove-Item -LiteralPath $marker
  Write-Output ('SHA-256 verified: '+$item.sha256)
  Write-Output "Ready: $target"
} finally {$client.Dispose()}
