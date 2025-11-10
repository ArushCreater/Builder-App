# Comprehensive script to update all Lambda functions and force API Gateway redeploy
# This ensures all CORS and authorization issues are resolved

param(
    [string]$Environment = "dev"
)

$ErrorActionPreference = "Stop"

$AWS_REGION = if ($env:AWS_REGION) { $env:AWS_REGION } else { "us-east-1" }
$STACK_NAME = "buildertrend-$Environment"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Complete Lambda Update & API Redeploy" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get AWS Account ID
try {
    $ACCOUNT_ID = (aws sts get-caller-identity --query Account --output text)
    if (-not $ACCOUNT_ID) {
        Write-Host "ERROR: Failed to get AWS credentials. Run 'aws configure' first." -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "ERROR: Failed to get AWS credentials. Run 'aws configure' first." -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

Write-Host "AWS Account ID: $ACCOUNT_ID" -ForegroundColor Green
Write-Host "Environment: $Environment" -ForegroundColor Green
Write-Host "Region: $AWS_REGION" -ForegroundColor Green
Write-Host ""

$DEPLOYMENT_BUCKET = "buildertrend-deployment-$Environment-$ACCOUNT_ID"

# Get paths
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$INFRA_DIR = Split-Path -Parent $SCRIPT_DIR
$LAMBDA_DIR = Join-Path $INFRA_DIR "lambda"
$BUILD_DIR = Join-Path (Split-Path -Parent $INFRA_DIR) "build"

# Create build directory if needed
if (-not (Test-Path $BUILD_DIR)) {
    New-Item -ItemType Directory -Path $BUILD_DIR | Out-Null
}

# Define Lambda functions to update
$FunctionNames = @("authorizer", "auth", "projects", "leads", "tasks", "budget", "documents", "file-upload")
$LogicalIds = @("AuthorizerFunction", "AuthFunction", "ProjectsFunction", "LeadsFunction", "TasksFunction", "BudgetFunction", "DocumentsFunction", "FileUploadFunction")

$SUCCESS_COUNT = 0
$FAILED_FUNCTIONS = @()

for ($i = 0; $i -lt $FunctionNames.Length; $i++) {
    $funcName = $FunctionNames[$i]
    $logicalId = $LogicalIds[$i]

    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "Updating: $funcName" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow

    $FUNC_DIR = Join-Path $LAMBDA_DIR $funcName

    if (-not (Test-Path $FUNC_DIR)) {
        Write-Host "WARNING: Directory not found for $funcName, skipping..." -ForegroundColor Yellow
        continue
    }

    Push-Location $FUNC_DIR

    try {
        # Install dependencies
        Write-Host "  [1/5] Installing dependencies..." -ForegroundColor Cyan
        npm install --production --silent 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "npm install failed for $funcName"
        }

        # Package Lambda
        Write-Host "  [2/5] Packaging Lambda..." -ForegroundColor Cyan
        $ZIP_FILE = Join-Path $BUILD_DIR "$funcName.zip"

        if (Test-Path $ZIP_FILE) {
            Remove-Item $ZIP_FILE -Force
        }

        # Get all files except git-related and aws-sdk
        $items = Get-ChildItem -Path . -Recurse | Where-Object {
            $path = $_.FullName
            -not ($path -like "*\.git*") -and
            -not ($path -like "*\node_modules\aws-sdk\*")
        }

        if ($items) {
            Compress-Archive -Path $items.FullName -DestinationPath $ZIP_FILE -Force
        }

        # Upload to S3
        Write-Host "  [3/5] Uploading to S3..." -ForegroundColor Cyan
        aws s3 cp $ZIP_FILE "s3://$DEPLOYMENT_BUCKET/functions/$funcName.zip" --quiet
        if ($LASTEXITCODE -ne 0) {
            throw "S3 upload failed for $funcName"
        }

        # Get physical function name
        Write-Host "  [4/5] Getting Lambda function name..." -ForegroundColor Cyan
        $PHYSICAL_NAME = aws cloudformation describe-stack-resources `
            --stack-name $STACK_NAME `
            --logical-resource-id $logicalId `
            --query 'StackResources[0].PhysicalResourceId' `
            --output text `
            --region $AWS_REGION 2>&1

        if ($LASTEXITCODE -ne 0 -or -not $PHYSICAL_NAME -or $PHYSICAL_NAME -eq "None") {
            Write-Host "  WARNING: Could not find Lambda function $logicalId in stack" -ForegroundColor Yellow
            $FAILED_FUNCTIONS += $funcName
            Pop-Location
            continue
        }

        # Update Lambda code
        Write-Host "  [5/5] Updating Lambda function code..." -ForegroundColor Cyan
        aws lambda update-function-code `
            --function-name $PHYSICAL_NAME `
            --s3-bucket $DEPLOYMENT_BUCKET `
            --s3-key "functions/$funcName.zip" `
            --region $AWS_REGION | Out-Null

        if ($LASTEXITCODE -ne 0) {
            throw "Lambda update failed for $funcName"
        }

        Write-Host "  ✓ $funcName updated successfully!" -ForegroundColor Green
        $SUCCESS_COUNT++

    } catch {
        Write-Host "  ✗ ERROR updating $funcName : $($_.Exception.Message)" -ForegroundColor Red
        $FAILED_FUNCTIONS += $funcName
    } finally {
        Pop-Location
    }

    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Lambda Update Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Successfully updated: $SUCCESS_COUNT functions" -ForegroundColor Green
if ($FAILED_FUNCTIONS.Count -gt 0) {
    Write-Host "Failed to update: $($FAILED_FUNCTIONS.Count) functions" -ForegroundColor Red
    Write-Host "  - $($FAILED_FUNCTIONS -join ', ')" -ForegroundColor Red
}
Write-Host ""

# Force API Gateway redeploy
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Force API Gateway Redeployment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

try {
    Write-Host "Step 1: Getting API Gateway ID..." -ForegroundColor Cyan
    $API_ID = aws cloudformation describe-stack-resources `
        --stack-name $STACK_NAME `
        --logical-resource-id RestApi `
        --query 'StackResources[0].PhysicalResourceId' `
        --output text `
        --region $AWS_REGION

    if (-not $API_ID -or $API_ID -eq "None") {
        throw "Could not find API Gateway in stack $STACK_NAME"
    }

    Write-Host "API Gateway ID: $API_ID" -ForegroundColor Green

    Write-Host ""
    Write-Host "Step 2: Creating new deployment..." -ForegroundColor Cyan
    $TIMESTAMP = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $DEPLOY_RESULT = aws apigateway create-deployment `
        --rest-api-id $API_ID `
        --stage-name $Environment `
        --description "Redeployment after Lambda updates - $TIMESTAMP" `
        --region $AWS_REGION

    if ($LASTEXITCODE -ne 0) {
        throw "API Gateway deployment failed"
    }

    Write-Host "  ✓ API Gateway redeployed successfully!" -ForegroundColor Green

} catch {
    Write-Host ""
    Write-Host "ERROR: API Gateway redeploy failed - $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "You may need to manually redeploy the API Gateway in AWS Console" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Wait 10-15 seconds for changes to propagate" -ForegroundColor White
Write-Host "  2. Clear your browser cache (Ctrl+Shift+R)" -ForegroundColor White
Write-Host "  3. Delete auth_token from localStorage" -ForegroundColor White
Write-Host "  4. Login again with fresh credentials" -ForegroundColor White
Write-Host "  5. Test all functionality" -ForegroundColor White
Write-Host ""
Write-Host "API Endpoint: https://$API_ID.execute-api.$AWS_REGION.amazonaws.com/$Environment/api" -ForegroundColor Cyan
Write-Host ""
