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

# Get absolute paths
$ScriptDir = $PSScriptRoot
$InfraDir = Split-Path -Parent $ScriptDir
$RootDir = Split-Path -Parent $InfraDir
$BuildDir = Join-Path $RootDir "build"
$LambdaDir = Join-Path $InfraDir "lambda"

# Create build directory if it doesn't exist
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

# Helper function to package Lambda
function Package-Lambda {
    param($FunctionName)

    Write-Host "Packaging $FunctionName function..."

    $FunctionDir = Join-Path $LambdaDir $FunctionName
    $ZipFile = Join-Path $BuildDir "$FunctionName.zip"

    # Navigate to function directory
    Push-Location $FunctionDir

    # Install dependencies
    if (Test-Path "package.json") {
        npm install --production --silent
    }

    # Remove old zip if exists
    if (Test-Path $ZipFile) {
        Remove-Item $ZipFile -Force
    }

    # Create zip file - compress all files in current directory
    Compress-Archive -Path * -DestinationPath $ZipFile -Force

    # Upload to S3
    aws s3 cp $ZipFile "s3://$DeploymentBucket/functions/$FunctionName.zip"

    Pop-Location
}

# Package all functions
Package-Lambda "authorizer"
Package-Lambda "auth"
Package-Lambda "projects"
Package-Lambda "file-upload"
Package-Lambda "leads"

Write-Host "Lambda functions packaged and uploaded!" -ForegroundColor Green
Write-Host ""

# Create Lambda layer
Write-Host "Step 3: Creating Lambda layer..." -ForegroundColor Green

$LayersDir = Join-Path $BuildDir "layers"
$LayerDir = Join-Path $LayersDir "nodejs"
$LayerZip = Join-Path $BuildDir "node-modules.zip"

if (Test-Path $LayerDir) {
    Remove-Item -Recurse -Force $LayerDir
}
New-Item -ItemType Directory -Path $LayerDir -Force | Out-Null

# Copy package.json and install dependencies
$AuthPackageJson = Join-Path $LambdaDir "auth\package.json"
Copy-Item $AuthPackageJson $LayerDir
Push-Location $LayerDir
npm install --production --silent
Pop-Location

# Create layer zip
if (Test-Path $LayerZip) {
    Remove-Item $LayerZip -Force
}
Push-Location $LayersDir
Compress-Archive -Path "nodejs" -DestinationPath $LayerZip -Force
Pop-Location

# Upload layer to S3
aws s3 cp $LayerZip "s3://$DeploymentBucket/layers/node-modules.zip"

Write-Host "Lambda layer created!" -ForegroundColor Green
Write-Host ""

# Deploy CloudFormation stack
Write-Host "Step 4: Deploying CloudFormation stack..." -ForegroundColor Green
Write-Host "This may take 5-10 minutes..." -ForegroundColor Yellow
Write-Host ""

$CloudFormationDir = Join-Path $InfraDir "cloudformation"
$TemplateFile = Join-Path $CloudFormationDir "main-stack.yaml"

aws cloudformation deploy `
    --template-file $TemplateFile `
    --stack-name $StackName `
    --parameter-overrides Environment=$Environment DeploymentBucketName=$DeploymentBucket `
    --capabilities CAPABILITY_NAMED_IAM `
    --region $Region `
    --no-fail-on-empty-changeset

if ($LASTEXITCODE -eq 0) {
    Write-Host "CloudFormation stack deployed successfully!" -ForegroundColor Green
} else {
    Write-Host "CloudFormation deployment failed!" -ForegroundColor Red
    exit 1
}
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
