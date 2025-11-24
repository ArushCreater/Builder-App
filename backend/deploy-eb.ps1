param(
  [string]$AppPath = ".",                        # Path to your API root (package.json lives here)
  [string]$TerraformPath = ".\\terraform",       # Path to the Terraform folder
  [string]$S3Bucket = "",                        # Required: S3 bucket for the bundle
  [string]$S3KeyPrefix = "api",                  # S3 key prefix (folder) for the bundle
  [string]$BundleName = "api-bundle.zip"         # Bundle file name (will be time-stamped)
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Require-Command($cmd) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    throw "Missing required command: $cmd"
  }
}

Require-Command npm
Require-Command aws
Require-Command Compress-Archive

if (-not (Test-Path $AppPath)) { throw "AppPath not found: $AppPath" }
if (-not (Test-Path $TerraformPath)) { throw "Terraform path not found: $TerraformPath" }
if ([string]::IsNullOrWhiteSpace($S3Bucket)) { throw "S3Bucket is required." }

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$bundleFile = "$($timestamp)-$BundleName"
$staging = Join-Path $env:TEMP "eb-stage-$timestamp"

Write-Host "Staging at $staging"
New-Item -ItemType Directory -Path $staging | Out-Null

Push-Location $AppPath
try {
Write-Host "Installing dependencies..."
npm install --no-fund --no-audit

Write-Host "Building app (if build script exists)..."
npm run build --if-present
}
finally {
  Pop-Location
}

# Copy core files (exclude heavy/irrelevant items)
$pathsToCopy = @(
  "package.json",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "Procfile",
  "dist",
  "build",
  "src",
  ".npmrc"
) | Where-Object { Test-Path (Join-Path $AppPath $_) }

foreach ($p in $pathsToCopy) {
  $source = Join-Path $AppPath $p
  $dest = Join-Path $staging $p
  if (Test-Path $source) {
    Write-Host "Copying $p"
    Copy-Item -Path $source -Destination $dest -Recurse -Force
  }
}

# Remove node_modules if copied
$nm = Join-Path $staging "node_modules"
if (Test-Path $nm) {
  Remove-Item -Recurse -Force $nm
}

# Create zip bundle with forward slashes (Python)
$bundlePath = Join-Path $staging "..\$bundleFile"
Write-Host "Creating bundle $bundleFile via Python"
$py = @"
import os, zipfile
staging = r'$($staging)'
bundle = r'$($bundlePath)'
with zipfile.ZipFile(bundle, 'w', zipfile.ZIP_DEFLATED) as z:
    for root, _, files in os.walk(staging):
        for f in files:
            full = os.path.join(root, f)
            rel = os.path.relpath(full, staging)
            z.write(full, rel.replace(os.sep, "/"))
"@
$py | python -

# Upload to S3
$s3Key = "$S3KeyPrefix/$bundleFile"
Write-Host "Uploading to s3://$S3Bucket/$s3Key"
aws s3 cp $bundlePath "s3://$S3Bucket/$s3Key" | Write-Host

Write-Host "`nBundle uploaded. To deploy via Terraform:"
Write-Host "  cd $TerraformPath"
Write-Host "  terraform apply -var=\"deploy_with_s3=true\" -var=\"app_version_bucket=$S3Bucket\" -var=\"app_version_key=$s3Key\""

Write-Host "`nOutputs to watch:"
Write-Host "  - alb_url (API base)"
Write-Host "  - rds_endpoint"
