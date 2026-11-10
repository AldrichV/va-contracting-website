$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$output = Join-Path $root ('dist-pages-export-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
$server = Join-Path $root 'dist/server'
$client = Join-Path $root 'dist/client'
foreach ($file in @("$server/index.js", "$client/assets")) {
    if (!(Test-Path -LiteralPath $file)) { throw 'Run npm run build first.' }
}
New-Item -ItemType Directory -Path $output | Out-Null
Get-ChildItem -LiteralPath $server | Where-Object Name -in @('index.js', 'ssr', '__vite_rsc_assets_manifest.js', 'assets') | Copy-Item -Destination $output -Recurse
Get-ChildItem -LiteralPath $client | Copy-Item -Destination $output -Recurse -Force
Copy-Item -LiteralPath (Join-Path $root 'worker/pages-worker.js') -Destination (Join-Path $output '_worker.js')
$output
