# Script to update just the authorizer Lambda function
# This is faster than full CloudFormation deployment

param(
    [string]$Environment = "dev"
)

$ErrorActionPreference = "Stop"

$AWS_REGION = if ($env:AWS_REGION) { $env:AWS_REGION } else { "us-east-1" }
$STACK_NAME = "buildertrend-$Environment"

Write-Host "========================================"
Write-Host "Update Authorizer Lambda Function"
Write-Host "========================================"
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

Write-Host "AWS Account ID: $ACCOUNT_ID"

$DEPLOYMENT_BUCKET = "buildertrend-deployment-$Environment-$ACCOUNT_ID"

# Get paths
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$INFRA_DIR = Split-Path -Parent $SCRIPT_DIR
$LAMBDA_DIR = Join-Path $INFRA_DIR "lambda"
$AUTHORIZER_DIR = Join-Path $LAMBDA_DIR "authorizer"
$BUILD_DIR = Join-Path (Split-Path -Parent $INFRA_DIR) "build"

# Create build directory if needed
if (-not (Test-Path $BUILD_DIR)) {
    New-Item -ItemType Directory -Path $BUILD_DIR | Out-Null
}

# Navigate to authorizer Lambda directory
Push-Location $AUTHORIZER_DIR

try {
    Write-Host "Step 1: Installing dependencies..."
    npm install --production --silent
    if ($LASTEXITCODE -ne 0) {
        throw "npm install failed"
    }

    Write-Host "Step 2: Packaging Lambda function..."
    $ZIP_FILE = Join-Path $BUILD_DIR "authorizer.zip"

    # Remove old zip if exists
    if (Test-Path $ZIP_FILE) {
        Remove-Item $ZIP_FILE -Force
    }

    # Create zip file (excluding git files and aws-sdk)
    $filesToZip = Get-ChildItem -Path . -Recurse -Exclude @("*.git*", "node_modules\aws-sdk") |
                  Where-Object { $_.FullName -notlike "*\node_modules\aws-sdk\*" }

    Compress-Archive -Path $filesToZip -DestinationPath $ZIP_FILE -Force

    Write-Host "Step 3: Uploading to S3..."
    aws s3 cp $ZIP_FILE "s3://$DEPLOYMENT_BUCKET/functions/authorizer.zip"
    if ($LASTEXITCODE -ne 0) {
        throw "S3 upload failed"
    }

    Write-Host "Step 4: Getting Lambda function name..."
    $FUNCTION_NAME = aws cloudformation describe-stack-resources `
        --stack-name $STACK_NAME `
        --logical-resource-id AuthorizerFunction `
        --query 'StackResources[0].PhysicalResourceId' `
        --output text `
        --region $AWS_REGION

    if (-not $FUNCTION_NAME -or $FUNCTION_NAME -eq "None") {
        throw "Could not find Authorizer Lambda function in stack $STACK_NAME"
    }

    Write-Host "Function Name: $FUNCTION_NAME"

    Write-Host "Step 5: Updating Lambda function code..."
    aws lambda update-function-code `
        --function-name $FUNCTION_NAME `
        --s3-bucket $DEPLOYMENT_BUCKET `
        --s3-key "functions/authorizer.zip" `
        --region $AWS_REGION | Out-Null

    if ($LASTEXITCODE -ne 0) {
        throw "Lambda update failed"
    }

    Write-Host ""
    Write-Host "========================================"
    Write-Host "Authorizer Lambda Updated Successfully!" -ForegroundColor Green
    Write-Host "========================================"
    Write-Host ""
    Write-Host "The authorizer has been updated with the fixed policy generation."
    Write-Host "Wait 5-10 seconds for Lambda to update, then try accessing the API."
    Write-Host ""

} catch {
    Write-Host ""
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Pop-Location
    exit 1
} finally {
    Pop-Location
}
