# BuilderTrend AWS Deployment Script (PowerShell)
# This script deploys the entire infrastructure to AWS

param(
    [string]$Environment = "dev",
    [string]$Region = "us-east-1"
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Green
Write-Host "BuilderTrend AWS Deployment" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "Environment: $Environment" -ForegroundColor Yellow
Write-Host "Region: $Region" -ForegroundColor Yellow
Write-Host ""

# Check if AWS CLI is installed
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: AWS CLI not found. Please install it first." -ForegroundColor Red
    Write-Host "Download from: https://aws.amazon.com/cli/" -ForegroundColor Yellow
    exit 1
}

# Get AWS Account ID
try {
    $AccountId = aws sts get-caller-identity --query Account --output text
    Write-Host "AWS Account ID: $AccountId" -ForegroundColor Yellow
    Write-Host ""
} catch {
    Write-Host "ERROR: Failed to get AWS credentials. Run 'aws configure' first." -ForegroundColor Red
    exit 1
}

$StackName = "buildertrend-$Environment"
$DeploymentBucket = "buildertrend-deployment-$Environment-$AccountId"

# Create build directory if it doesn't exist
$BuildDir = "..\..\build"
if (-not (Test-Path $BuildDir)) {
    New-Item -ItemType Directory -Path $BuildDir | Out-Null
}
if (-not (Test-Path "$BuildDir\layers")) {
    New-Item -ItemType Directory -Path "$BuildDir\layers" | Out-Null
}

# Create deployment bucket if it doesn't exist
Write-Host "Step 1: Checking deployment bucket..." -ForegroundColor Green
try {
    aws s3 ls "s3://$DeploymentBucket" 2>&1 | Out-Null
    Write-Host "Deployment bucket already exists: $DeploymentBucket"
} catch {
    Write-Host "Creating deployment bucket: $DeploymentBucket"
    aws s3 mb "s3://$DeploymentBucket" --region $Region
    aws s3api put-bucket-versioning --bucket $DeploymentBucket --versioning-configuration Status=Enabled
}
Write-Host ""

# Package Lambda functions
Write-Host "Step 2: Packaging Lambda functions..." -ForegroundColor Green

Push-Location ..\lambda

# Helper function to package Lambda
function Package-Lambda {
    param($FunctionName)

    Write-Host "Packaging $FunctionName function..."
    Push-Location $FunctionName

    # Install dependencies
    if (Test-Path "package.json") {
        npm install --production --silent
    }

    # Create zip file
    $ZipFile = "..\..\build\$FunctionName.zip"
    if (Test-Path $ZipFile) {
        Remove-Item $ZipFile
    }

    # Use PowerShell's Compress-Archive
    Get-ChildItem -Path . -Recurse -Exclude @("*.git*", "node_modules\.cache*") |
        Compress-Archive -DestinationPath $ZipFile -Force

    # Upload to S3
    aws s3 cp $ZipFile "s3://$DeploymentBucket/functions/$FunctionName.zip"

    Pop-Location
}

# Package all functions
Package-Lambda "authorizer"
Package-Lambda "auth"
Package-Lambda "projects"
Package-Lambda "file-upload"

Pop-Location

Write-Host "Lambda functions packaged and uploaded!" -ForegroundColor Green
Write-Host ""

# Create Lambda layer
Write-Host "Step 3: Creating Lambda layer..." -ForegroundColor Green

$LayerDir = "$BuildDir\layers\nodejs"
if (Test-Path $LayerDir) {
    Remove-Item -Recurse -Force $LayerDir
}
New-Item -ItemType Directory -Path $LayerDir -Force | Out-Null

# Copy package.json and install dependencies
Copy-Item "..\lambda\auth\package.json" $LayerDir
Push-Location $LayerDir
npm install --production --silent
Pop-Location

# Create layer zip
Push-Location "$BuildDir\layers"
if (Test-Path "..\node-modules.zip") {
    Remove-Item "..\node-modules.zip"
}
Compress-Archive -Path "nodejs" -DestinationPath "..\node-modules.zip" -Force
aws s3 cp "..\node-modules.zip" "s3://$DeploymentBucket/layers/node-modules.zip"
Pop-Location

Write-Host "Lambda layer created!" -ForegroundColor Green
Write-Host ""

# Deploy CloudFormation stack
Write-Host "Step 4: Deploying CloudFormation stack..." -ForegroundColor Green
Write-Host "This may take 5-10 minutes..." -ForegroundColor Yellow
Write-Host ""

Push-Location ..\cloudformation

aws cloudformation deploy `
    --template-file main-stack.yaml `
    --stack-name $StackName `
    --parameter-overrides Environment=$Environment `
    --capabilities CAPABILITY_NAMED_IAM `
    --region $Region `
    --no-fail-on-empty-changeset

if ($LASTEXITCODE -eq 0) {
    Write-Host "CloudFormation stack deployed successfully!" -ForegroundColor Green
} else {
    Write-Host "CloudFormation deployment failed!" -ForegroundColor Red
    Pop-Location
    exit 1
}

Pop-Location
Write-Host ""

# Get stack outputs
Write-Host "Step 5: Getting stack outputs..." -ForegroundColor Green

$ApiUrl = aws cloudformation describe-stacks `
    --stack-name $StackName `
    --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" `
    --output text `
    --region $Region

$FileBucket = aws cloudformation describe-stacks `
    --stack-name $StackName `
    --query "Stacks[0].Outputs[?OutputKey=='FileStorageBucketName'].OutputValue" `
    --output text `
    --region $Region

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "API Endpoint: $ApiUrl" -ForegroundColor Yellow
Write-Host "File Storage Bucket: $FileBucket" -ForegroundColor Yellow
Write-Host ""
Write-Host "Update your web app's .env file with:" -ForegroundColor Green
Write-Host "VITE_API_URL=$ApiUrl" -ForegroundColor Yellow
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Green
Write-Host "1. Update web/.env with the API URL above"
Write-Host "2. Deploy your frontend to a hosting service (Vercel, Netlify, etc.)"
Write-Host "3. Test the integration"
Write-Host ""
