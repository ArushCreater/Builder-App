# Manual Lambda packaging and deployment using .NET compression
# This works around PowerShell Compress-Archive limitations

param(
    [string]$Environment = "dev",
    [string]$Region = "us-east-1"
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Green
Write-Host "Package and Deploy Auth Lambda" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Get paths
$ScriptDir = $PSScriptRoot
$InfraDir = Split-Path -Parent $ScriptDir
$AuthDir = Join-Path $InfraDir "lambda\auth"
$BuildDir = Join-Path (Split-Path -Parent $InfraDir) "build"

# Create build directory
if (-not (Test-Path $BuildDir)) {
    New-Item -ItemType Directory -Path $BuildDir | Out-Null
}

$ZipFile = Join-Path $BuildDir "auth-manual.zip"

# Remove old zip
if (Test-Path $ZipFile) {
    Remove-Item $ZipFile -Force
}

Write-Host "Step 1: Installing dependencies..." -ForegroundColor Yellow
Push-Location $AuthDir
npm install --production --silent
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: npm install failed" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location

Write-Host "Step 2: Creating zip file using .NET..." -ForegroundColor Yellow

# Load compression assembly
Add-Type -AssemblyName System.IO.Compression.FileSystem

try {
    # Create zip file
    $zip = [System.IO.Compression.ZipFile]::Open($ZipFile, 'Create')

    # Add index.js
    $indexPath = Join-Path $AuthDir "index.js"
    if (Test-Path $indexPath) {
        $entry = $zip.CreateEntry("index.js")
        $entryStream = $entry.Open()
        $fileStream = [System.IO.File]::OpenRead($indexPath)
        $fileStream.CopyTo($entryStream)
        $fileStream.Close()
        $entryStream.Close()
        Write-Host "   Added: index.js" -ForegroundColor Cyan
    }

    # Add package.json
    $packagePath = Join-Path $AuthDir "package.json"
    if (Test-Path $packagePath) {
        $entry = $zip.CreateEntry("package.json")
        $entryStream = $entry.Open()
        $fileStream = [System.IO.File]::OpenRead($packagePath)
        $fileStream.CopyTo($entryStream)
        $fileStream.Close()
        $entryStream.Close()
        Write-Host "   Added: package.json" -ForegroundColor Cyan
    }

    # Add package-lock.json
    $packageLockPath = Join-Path $AuthDir "package-lock.json"
    if (Test-Path $packageLockPath) {
        $entry = $zip.CreateEntry("package-lock.json")
        $entryStream = $entry.Open()
        $fileStream = [System.IO.File]::OpenRead($packageLockPath)
        $fileStream.CopyTo($entryStream)
        $fileStream.Close()
        $entryStream.Close()
        Write-Host "   Added: package-lock.json" -ForegroundColor Cyan
    }

    # Add all node_modules files
    $nodeModulesPath = Join-Path $AuthDir "node_modules"
    if (Test-Path $nodeModulesPath) {
        Write-Host "   Adding node_modules..." -ForegroundColor Cyan
        $files = Get-ChildItem -Path $nodeModulesPath -Recurse -File
        $count = 0
        foreach ($file in $files) {
            $relativePath = $file.FullName.Substring($AuthDir.Length + 1).Replace('\', '/')
            $entry = $zip.CreateEntry($relativePath)
            $entryStream = $entry.Open()
            $fileStream = [System.IO.File]::OpenRead($file.FullName)
            $fileStream.CopyTo($entryStream)
            $fileStream.Close()
            $entryStream.Close()
            $count++
            if ($count % 100 -eq 0) {
                Write-Host "   Added $count files..." -ForegroundColor Gray
            }
        }
        Write-Host "   Added $count files from node_modules" -ForegroundColor Green
    } else {
        Write-Host "   ERROR: node_modules not found!" -ForegroundColor Red
        $zip.Dispose()
        exit 1
    }

    $zip.Dispose()
    Write-Host "   Zip file created successfully" -ForegroundColor Green

} catch {
    Write-Host "ERROR: Failed to create zip file" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    if ($zip) { $zip.Dispose() }
    exit 1
}

$zipSize = [math]::Round((Get-Item $ZipFile).Length / 1MB, 2)
Write-Host "   Zip file size: $zipSize MB" -ForegroundColor Green

# Get AWS Account ID
Write-Host ""
Write-Host "Step 3: Getting AWS credentials..." -ForegroundColor Yellow
try {
    $AccountId = aws sts get-caller-identity --query Account --output text
    Write-Host "   AWS Account ID: $AccountId" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Could not get AWS credentials" -ForegroundColor Red
    exit 1
}

$StackName = "buildertrend-$Environment"
$DeploymentBucket = "buildertrend-deployment-$Environment-$AccountId"

# Upload to S3
Write-Host ""
Write-Host "Step 4: Uploading to S3..." -ForegroundColor Yellow
aws s3 cp $ZipFile "s3://$DeploymentBucket/functions/auth.zip"
Write-Host "   Uploaded to S3" -ForegroundColor Green

# Get Lambda function name
Write-Host ""
Write-Host "Step 5: Getting Lambda function name..." -ForegroundColor Yellow
$FunctionName = aws cloudformation describe-stack-resources `
    --stack-name $StackName `
    --logical-resource-id AuthFunction `
    --query 'StackResources[0].PhysicalResourceId' `
    --output text `
    --region $Region

if ([string]::IsNullOrEmpty($FunctionName)) {
    Write-Host "ERROR: Could not find Lambda function" -ForegroundColor Red
    exit 1
}

Write-Host "   Function Name: $FunctionName" -ForegroundColor Green

# Update Lambda
Write-Host ""
Write-Host "Step 6: Updating Lambda function code..." -ForegroundColor Yellow
aws lambda update-function-code `
    --function-name $FunctionName `
    --s3-bucket $DeploymentBucket `
    --s3-key "functions/auth.zip" `
    --region $Region | Out-Null

Write-Host "   Lambda function updated" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Login with demo credentials:" -ForegroundColor Cyan
Write-Host "  Email: demo@buildertrend.com" -ForegroundColor Yellow
Write-Host "  Password: demo123" -ForegroundColor Yellow
Write-Host ""
Write-Host "Wait 10-15 seconds for Lambda to update, then try logging in." -ForegroundColor Cyan
Write-Host ""
