# Script to update just the auth Lambda function
# This is faster than full CloudFormation deployment

param(
    [string]$Environment = "dev",
    [string]$Region = "us-east-1"
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Green
Write-Host "Update Auth Lambda Function" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Get AWS Account ID
try {
    $AccountId = aws sts get-caller-identity --query Account --output text
    Write-Host "AWS Account ID: $AccountId" -ForegroundColor Yellow
} catch {
    Write-Host "ERROR: Failed to get AWS credentials. Run 'aws configure' first." -ForegroundColor Red
    exit 1
}

$StackName = "buildertrend-$Environment"
$DeploymentBucket = "buildertrend-deployment-$Environment-$AccountId"

# Get absolute paths
$ScriptDir = $PSScriptRoot
$InfraDir = Split-Path -Parent $ScriptDir
$LambdaDir = Join-Path $InfraDir "lambda"
$AuthDir = Join-Path $LambdaDir "auth"
$BuildDir = Join-Path (Split-Path -Parent $InfraDir) "build"

# Create build directory if needed
if (-not (Test-Path $BuildDir)) {
    New-Item -ItemType Directory -Path $BuildDir | Out-Null
}

# Navigate to auth Lambda directory
Push-Location $AuthDir

Write-Host "Step 1: Installing dependencies..." -ForegroundColor Green
npm install --production --silent

Write-Host "Step 2: Packaging Lambda function..." -ForegroundColor Green
$ZipFile = Join-Path $BuildDir "auth.zip"

# Remove old zip if exists
if (Test-Path $ZipFile) {
    Remove-Item $ZipFile -Force
}

# Check if zip command is available (from Git Bash or similar)
$zipCommand = Get-Command zip -ErrorAction SilentlyContinue
if ($zipCommand) {
    Write-Host "   Using zip command for packaging..." -ForegroundColor Cyan
    # Use zip command (better for Lambda) - creates proper structure
    & zip -r $ZipFile . -x "*.git*" "*.zip" 2>&1 | Out-Null
} else {
    Write-Host "   Using PowerShell Compress-Archive..." -ForegroundColor Cyan

    # PowerShell Compress-Archive from current directory
    # Get all items except git and zip files
    $filesToZip = @()

    # Add index.js (required)
    $indexJs = Join-Path $AuthDir "index.js"
    if (Test-Path $indexJs) {
        $filesToZip += $indexJs
    }

    # Add package.json (required)
    $packageJson = Join-Path $AuthDir "package.json"
    if (Test-Path $packageJson) {
        $filesToZip += $packageJson
    }

    # Add package-lock.json if exists
    $packageLock = Join-Path $AuthDir "package-lock.json"
    if (Test-Path $packageLock) {
        $filesToZip += $packageLock
    }

    # Add node_modules directory (required)
    $nodeModulesPath = Join-Path $AuthDir "node_modules"
    if (Test-Path $nodeModulesPath) {
        $filesToZip += $nodeModulesPath
        Write-Host "   Found node_modules folder" -ForegroundColor Cyan
    } else {
        Write-Host "   [ERROR] node_modules folder not found!" -ForegroundColor Red
        Write-Host "   Run 'npm install --production' in the auth directory first" -ForegroundColor Red
        Pop-Location
        exit 1
    }

    Write-Host "   Files to zip: $($filesToZip.Count) items" -ForegroundColor Cyan
    Compress-Archive -Path $filesToZip -DestinationPath $ZipFile -Force
}

Write-Host "   Zip file created: $ZipFile" -ForegroundColor Green
Write-Host "   Zip file size: $([math]::Round((Get-Item $ZipFile).Length / 1MB, 2)) MB" -ForegroundColor Green

# Verify zip contents
Write-Host "   Verifying zip contents..." -ForegroundColor Cyan
try {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead($ZipFile)
    $hasIndexJs = $zip.Entries | Where-Object { $_.FullName -eq "index.js" } | Select-Object -First 1
    $hasNodeModules = $zip.Entries | Where-Object { $_.FullName -like "node_modules/*" } | Select-Object -First 1
    $zip.Dispose()

    if ($hasIndexJs) {
        Write-Host "   [OK] index.js found at root" -ForegroundColor Green
    } else {
        Write-Host "   [WARNING] index.js not at root!" -ForegroundColor Yellow
    }

    if ($hasNodeModules) {
        Write-Host "   [OK] node_modules folder found" -ForegroundColor Green
    } else {
        Write-Host "   [WARNING] node_modules folder missing!" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   Could not verify zip contents" -ForegroundColor Yellow
}

Write-Host "Step 3: Uploading to S3..." -ForegroundColor Green
aws s3 cp $ZipFile "s3://$DeploymentBucket/functions/auth.zip"

Write-Host "Step 4: Getting Lambda function name..." -ForegroundColor Green
$FunctionName = aws cloudformation describe-stack-resources `
    --stack-name $StackName `
    --logical-resource-id AuthFunction `
    --query 'StackResources[0].PhysicalResourceId' `
    --output text `
    --region $Region

if ([string]::IsNullOrEmpty($FunctionName)) {
    Write-Host "ERROR: Could not find Auth Lambda function" -ForegroundColor Red
    Pop-Location
    exit 1
}

Write-Host "Function Name: $FunctionName" -ForegroundColor Yellow

Write-Host "Step 5: Updating Lambda function code..." -ForegroundColor Green
aws lambda update-function-code `
    --function-name $FunctionName `
    --s3-bucket $DeploymentBucket `
    --s3-key "functions/auth.zip" `
    --region $Region | Out-Null

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Auth Lambda Updated Successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "You can now log in with demo credentials:" -ForegroundColor Green
Write-Host "Email: demo@buildertrend.com" -ForegroundColor Yellow
Write-Host "Password: demo123" -ForegroundColor Yellow
Write-Host ""
Write-Host "Wait 5-10 seconds for Lambda to update, then try logging in." -ForegroundColor Cyan

Pop-Location
