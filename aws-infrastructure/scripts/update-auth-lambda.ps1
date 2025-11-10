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

# Create zip file
Compress-Archive -Path * -DestinationPath $ZipFile -Force

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
