# Check and fix the API Gateway authorizer

param(
    [string]$Environment = "dev",
    [string]$Region = "us-east-1"
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Green
Write-Host "Check and Fix Authorizer" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Get AWS Account ID
try {
    $AccountId = aws sts get-caller-identity --query Account --output text
    Write-Host "AWS Account ID: $AccountId" -ForegroundColor Yellow
} catch {
    Write-Host "ERROR: Failed to get AWS credentials" -ForegroundColor Red
    exit 1
}

$StackName = "buildertrend-$Environment"
$AuthorizerFunctionName = "buildertrend-authorizer-$Environment"

# Check if authorizer function exists
Write-Host ""
Write-Host "Checking authorizer function..." -ForegroundColor Yellow
try {
    $functionInfo = aws lambda get-function `
        --function-name $AuthorizerFunctionName `
        --region $Region 2>&1

    if ($LASTEXITCODE -eq 0) {
        Write-Host "   [OK] Authorizer function exists: $AuthorizerFunctionName" -ForegroundColor Green
        exit 0
    }
} catch {
    Write-Host "   [ERROR] Authorizer function does not exist!" -ForegroundColor Red
}

Write-Host ""
Write-Host "The authorizer function is missing. This causes 403 errors on all API endpoints." -ForegroundColor Yellow
Write-Host ""
Write-Host "Solution: Redeploy the CloudFormation stack to create the authorizer function." -ForegroundColor Cyan
Write-Host ""
Write-Host "Run this command:" -ForegroundColor Green
Write-Host "cd ..\scripts" -ForegroundColor Yellow
Write-Host ".\deploy.ps1 -Environment dev" -ForegroundColor Yellow
Write-Host ""
Write-Host "This will take 5-10 minutes but will fix all 403 permission errors." -ForegroundColor Cyan
Write-Host ""
