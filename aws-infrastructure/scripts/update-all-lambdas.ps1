# Script to update all Lambda functions
# Uses .NET compression to properly package node_modules

param(
    [string]$Environment = "dev",
    [string]$Region = "us-east-1"
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Green
Write-Host "Update All Lambda Functions" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

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
$LambdaDir = Join-Path $InfraDir "lambda"
$BuildDir = Join-Path (Split-Path -Parent $InfraDir) "build"

# Create build directory if needed
if (-not (Test-Path $BuildDir)) {
    New-Item -ItemType Directory -Path $BuildDir | Out-Null
}

# Load compression assembly
Add-Type -AssemblyName System.IO.Compression.FileSystem

# Function to package and deploy a Lambda function
function Update-LambdaFunction {
    param(
        [string]$FunctionName,
        [string]$LogicalResourceId
    )

    Write-Host ""
    Write-Host "==================== $FunctionName ====================" -ForegroundColor Cyan
    Write-Host ""

    $FunctionDir = Join-Path $LambdaDir $FunctionName
    $ZipFile = Join-Path $BuildDir "$FunctionName.zip"

    # Check if function directory exists
    if (-not (Test-Path $FunctionDir)) {
        Write-Host "   [SKIP] Function directory not found: $FunctionDir" -ForegroundColor Yellow
        return
    }

    # Install dependencies
    Write-Host "   1. Installing dependencies..." -ForegroundColor Yellow
    Push-Location $FunctionDir
    npm install --production --silent 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   [ERROR] npm install failed" -ForegroundColor Red
        Pop-Location
        return
    }

    # Remove old zip
    if (Test-Path $ZipFile) {
        Remove-Item $ZipFile -Force
    }

    # Create zip file using .NET
    Write-Host "   2. Creating zip file..." -ForegroundColor Yellow
    try {
        $zip = [System.IO.Compression.ZipFile]::Open($ZipFile, 'Create')

        # Get all files in the function directory
        $files = Get-ChildItem -Path $FunctionDir -Recurse -File | Where-Object {
            # Exclude git files and existing zip files
            $_.FullName -notlike "*.git*" -and $_.Extension -ne ".zip"
        }

        $count = 0
        foreach ($file in $files) {
            $relativePath = $file.FullName.Substring($FunctionDir.Length + 1).Replace('\', '/')
            $entry = $zip.CreateEntry($relativePath)
            $entryStream = $entry.Open()
            $fileStream = [System.IO.File]::OpenRead($file.FullName)
            $fileStream.CopyTo($entryStream)
            $fileStream.Close()
            $entryStream.Close()
            $count++
        }

        $zip.Dispose()
        $zipSize = [math]::Round((Get-Item $ZipFile).Length / 1MB, 2)
        Write-Host "   [OK] Packaged $count files ($zipSize MB)" -ForegroundColor Green

    } catch {
        Write-Host "   [ERROR] Failed to create zip: $($_.Exception.Message)" -ForegroundColor Red
        if ($zip) { $zip.Dispose() }
        Pop-Location
        return
    }

    Pop-Location

    # Upload to S3
    Write-Host "   3. Uploading to S3..." -ForegroundColor Yellow
    aws s3 cp $ZipFile "s3://$DeploymentBucket/functions/$FunctionName.zip" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   [ERROR] S3 upload failed" -ForegroundColor Red
        return
    }
    Write-Host "   [OK] Uploaded to S3" -ForegroundColor Green

    # Get Lambda function name from CloudFormation
    Write-Host "   4. Getting Lambda function name..." -ForegroundColor Yellow
    try {
        $PhysicalFunctionName = aws cloudformation describe-stack-resources `
            --stack-name $StackName `
            --logical-resource-id $LogicalResourceId `
            --query 'StackResources[0].PhysicalResourceId' `
            --output text `
            --region $Region 2>&1

        if ([string]::IsNullOrEmpty($PhysicalFunctionName) -or $PhysicalFunctionName -like "*error*") {
            Write-Host "   [ERROR] Could not find Lambda function" -ForegroundColor Red
            return
        }
    } catch {
        Write-Host "   [ERROR] Could not find Lambda function" -ForegroundColor Red
        return
    }

    # Update Lambda function code
    Write-Host "   5. Updating Lambda function..." -ForegroundColor Yellow
    $updateOutput = aws lambda update-function-code `
        --function-name $PhysicalFunctionName `
        --s3-bucket $DeploymentBucket `
        --s3-key "functions/$FunctionName.zip" `
        --region $Region 2>&1

    if ($LASTEXITCODE -eq 0) {
        Write-Host "   [SUCCESS] $FunctionName updated!" -ForegroundColor Green
    } else {
        Write-Host "   [ERROR] Lambda update failed:" -ForegroundColor Red
        Write-Host "   $updateOutput" -ForegroundColor Red
    }
}

# Update all Lambda functions
Write-Host "Starting Lambda updates..." -ForegroundColor Green
Write-Host ""

Update-LambdaFunction -FunctionName "authorizer" -LogicalResourceId "ApiAuthorizer"
Update-LambdaFunction -FunctionName "auth" -LogicalResourceId "AuthFunction"
Update-LambdaFunction -FunctionName "projects" -LogicalResourceId "ProjectsFunction"
Update-LambdaFunction -FunctionName "leads" -LogicalResourceId "LeadsFunction"
Update-LambdaFunction -FunctionName "tasks" -LogicalResourceId "TasksFunction"
Update-LambdaFunction -FunctionName "budget" -LogicalResourceId "BudgetFunction"
Update-LambdaFunction -FunctionName "documents" -LogicalResourceId "DocumentsFunction"
Update-LambdaFunction -FunctionName "file-upload" -LogicalResourceId "FileUploadFunction"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "All Lambda Functions Updated!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Wait 10-15 seconds for all Lambdas to update, then test your app." -ForegroundColor Cyan
Write-Host ""
Write-Host "Login with demo credentials:" -ForegroundColor Green
Write-Host "  Email: demo@buildertrend.com" -ForegroundColor Yellow
Write-Host "  Password: demo123" -ForegroundColor Yellow
Write-Host ""
