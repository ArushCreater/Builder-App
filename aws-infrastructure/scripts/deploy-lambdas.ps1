# Simple script to update all Lambda functions and redeploy API Gateway
param([string]$Environment = "dev")

$ErrorActionPreference = "Stop"
$AWS_REGION = if ($env:AWS_REGION) { $env:AWS_REGION } else { "us-east-1" }
$STACK_NAME = "buildertrend-$Environment"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Lambda Update & API Gateway Redeploy" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Get AWS Account ID
$ACCOUNT_ID = aws sts get-caller-identity --query Account --output text
if (!$ACCOUNT_ID) {
    Write-Host "ERROR: Failed to get AWS credentials" -ForegroundColor Red
    exit 1
}

Write-Host "Account: $ACCOUNT_ID" -ForegroundColor Green
Write-Host "Environment: $Environment" -ForegroundColor Green
Write-Host "Region: $AWS_REGION`n" -ForegroundColor Green

$DEPLOYMENT_BUCKET = "buildertrend-deployment-$Environment-$ACCOUNT_ID"
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$INFRA_DIR = Split-Path -Parent $SCRIPT_DIR
$LAMBDA_DIR = Join-Path $INFRA_DIR "lambda"
$BUILD_DIR = Join-Path (Split-Path -Parent $INFRA_DIR) "build"

if (!(Test-Path $BUILD_DIR)) {
    New-Item -ItemType Directory -Path $BUILD_DIR | Out-Null
}

# Lambda functions to update
$FUNCTIONS = @{
    "authorizer" = "AuthorizerFunction"
    "auth" = "AuthFunction"
    "projects" = "ProjectsFunction"
    "leads" = "LeadsFunction"
    "tasks" = "TasksFunction"
    "budget" = "BudgetFunction"
    "documents" = "DocumentsFunction"
    "file-upload" = "FileUploadFunction"
}

$SUCCESS_COUNT = 0
$FAILED = @()

foreach ($funcName in $FUNCTIONS.Keys) {
    $logicalId = $FUNCTIONS[$funcName]
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "Updating: $funcName" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow

    $FUNC_DIR = Join-Path $LAMBDA_DIR $funcName
    if (!(Test-Path $FUNC_DIR)) {
        Write-Host "  WARNING: Directory not found, skipping`n" -ForegroundColor Yellow
        continue
    }

    Push-Location $FUNC_DIR
    try {
        Write-Host "  [1/5] Installing dependencies..." -ForegroundColor Cyan
        npm install --production --silent 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "npm install failed" }

        Write-Host "  [2/5] Packaging Lambda..." -ForegroundColor Cyan
        $ZIP_FILE = Join-Path $BUILD_DIR "$funcName.zip"
        if (Test-Path $ZIP_FILE) { Remove-Item $ZIP_FILE -Force }

        # Create zip
        $items = Get-ChildItem -Path . -Recurse | Where-Object {
            $_.FullName -notlike "*\.git*" -and $_.FullName -notlike "*\node_modules\aws-sdk\*"
        }
        if ($items) {
            Compress-Archive -Path $items.FullName -DestinationPath $ZIP_FILE -Force
        }

        Write-Host "  [3/5] Uploading to S3..." -ForegroundColor Cyan
        aws s3 cp $ZIP_FILE "s3://$DEPLOYMENT_BUCKET/functions/$funcName.zip" --quiet
        if ($LASTEXITCODE -ne 0) { throw "S3 upload failed" }

        Write-Host "  [4/5] Getting Lambda function name..." -ForegroundColor Cyan
        $PHYSICAL_NAME = aws cloudformation describe-stack-resources --stack-name $STACK_NAME --logical-resource-id $logicalId --query 'StackResources[0].PhysicalResourceId' --output text --region $AWS_REGION 2>&1
        if ($LASTEXITCODE -ne 0 -or !$PHYSICAL_NAME -or $PHYSICAL_NAME -eq "None") {
            Write-Host "  WARNING: Function not found in stack`n" -ForegroundColor Yellow
            $FAILED += $funcName
            Pop-Location
            continue
        }

        Write-Host "  [5/5] Updating Lambda code..." -ForegroundColor Cyan
        aws lambda update-function-code --function-name $PHYSICAL_NAME --s3-bucket $DEPLOYMENT_BUCKET --s3-key "functions/$funcName.zip" --region $AWS_REGION | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Lambda update failed" }

        Write-Host "  SUCCESS!`n" -ForegroundColor Green
        $SUCCESS_COUNT++
    }
    catch {
        Write-Host "  ERROR: $_`n" -ForegroundColor Red
        $FAILED += $funcName
    }
    finally {
        Pop-Location
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Successfully updated: $SUCCESS_COUNT functions" -ForegroundColor Green
if ($FAILED.Count -gt 0) {
    Write-Host "Failed: $($FAILED.Count) - $($FAILED -join ', ')" -ForegroundColor Red
}

# Redeploy API Gateway
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "API Gateway Redeployment" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

try {
    Write-Host "Getting API Gateway ID..." -ForegroundColor Cyan
    $API_ID = aws cloudformation describe-stack-resources --stack-name $STACK_NAME --logical-resource-id RestApi --query 'StackResources[0].PhysicalResourceId' --output text --region $AWS_REGION
    if (!$API_ID -or $API_ID -eq "None") { throw "API Gateway not found" }
    Write-Host "API ID: $API_ID`n" -ForegroundColor Green

    Write-Host "Creating new deployment..." -ForegroundColor Cyan
    $TIMESTAMP = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    aws apigateway create-deployment --rest-api-id $API_ID --stage-name $Environment --description "Redeploy - $TIMESTAMP" --region $AWS_REGION | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Deployment failed" }

    Write-Host "SUCCESS!`n" -ForegroundColor Green
}
catch {
    Write-Host "ERROR: $_" -ForegroundColor Red
    Write-Host "You may need to manually redeploy in AWS Console`n" -ForegroundColor Yellow
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "COMPLETE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "  1. Wait 10-15 seconds" -ForegroundColor White
Write-Host "  2. Clear browser cache (Ctrl+Shift+R)" -ForegroundColor White
Write-Host "  3. Delete auth_token from localStorage" -ForegroundColor White
Write-Host "  4. Login and test`n" -ForegroundColor White
Write-Host "API: https://$API_ID.execute-api.$AWS_REGION.amazonaws.com/$Environment/api`n" -ForegroundColor Cyan
