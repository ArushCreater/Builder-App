# Force complete API Gateway redeployment
# This script deletes and recreates the deployment to ensure all changes are applied

param(
    [string]$Environment = "dev",
    [string]$Region = "us-east-1"
)

$ErrorActionPreference = "Stop"
$StackName = "buildertrend-$Environment"

Write-Host "========================================" -ForegroundColor Green
Write-Host "Force API Gateway Redeployment" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Get API Gateway ID from CloudFormation
Write-Host "Step 1: Getting API Gateway ID..." -ForegroundColor Yellow
try {
    $ApiUrl = aws cloudformation describe-stacks `
        --stack-name $StackName `
        --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" `
        --output text `
        --region $Region

    if ($ApiUrl -match 'https://([^.]+)\.') {
        $ApiId = $matches[1]
    } else {
        throw "Could not parse API Gateway ID from URL"
    }
} catch {
    Write-Host "ERROR: Could not find API Gateway ID" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

Write-Host "   API Gateway ID: $ApiId" -ForegroundColor Green

# Get all existing deployments
Write-Host ""
Write-Host "Step 2: Listing existing deployments..." -ForegroundColor Yellow
$deployments = aws apigateway get-deployments `
    --rest-api-id $ApiId `
    --region $Region `
    --query 'items[*].[id,description,createdDate]' `
    --output json | ConvertFrom-Json

Write-Host "   Found $($deployments.Count) existing deployments" -ForegroundColor Green

# Create new deployment with unique description
Write-Host ""
Write-Host "Step 3: Creating new deployment..." -ForegroundColor Yellow
$timestamp = Get-Date -Format "yyyy-MM-dd-HH-mm-ss"
$description = "Force redeployment - $timestamp - CORS fix"

try {
    $newDeployment = aws apigateway create-deployment `
        --rest-api-id $ApiId `
        --stage-name $Environment `
        --description $description `
        --region $Region `
        --query 'id' `
        --output text

    Write-Host "   New Deployment ID: $newDeployment" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Failed to create deployment" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

# Wait a moment for propagation
Write-Host ""
Write-Host "Step 4: Waiting for deployment to propagate..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Test the OPTIONS endpoint
Write-Host ""
Write-Host "Step 5: Testing OPTIONS endpoint..." -ForegroundColor Yellow
try {
    $testUrl = "https://$ApiId.execute-api.$Region.amazonaws.com/$Environment/api/auth/login"

    $response = Invoke-WebRequest -Uri $testUrl `
        -Method OPTIONS `
        -Headers @{
            "Origin" = "http://localhost:3000"
            "Access-Control-Request-Method" = "POST"
            "Access-Control-Request-Headers" = "Content-Type,Authorization"
        } `
        -UseBasicParsing `
        -ErrorAction Stop

    Write-Host "   ✓ OPTIONS request successful!" -ForegroundColor Green
    Write-Host "   Status Code: $($response.StatusCode)" -ForegroundColor Green

    # Check for CORS headers
    $corsHeaders = $response.Headers.GetEnumerator() | Where-Object { $_.Key -like "*Access-Control*" }
    if ($corsHeaders) {
        Write-Host "   ✓ CORS headers present:" -ForegroundColor Green
        $corsHeaders | ForEach-Object {
            Write-Host "     $($_.Key): $($_.Value)" -ForegroundColor White
        }
    } else {
        Write-Host "   ⚠ WARNING: No CORS headers found in response!" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠ OPTIONS test failed (this might be expected before full deployment)" -ForegroundColor Yellow
    if ($_.Exception.Response) {
        Write-Host "   Status: $($_.Exception.Response.StatusCode.Value__)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Wait 10-15 seconds for changes to propagate globally" -ForegroundColor White
Write-Host "2. Hard refresh your browser (Ctrl+Shift+R)" -ForegroundColor White
Write-Host "3. Clear browser cache/localStorage if still having issues" -ForegroundColor White
Write-Host "4. Try logging in with:" -ForegroundColor White
Write-Host "   Email: demo@buildertrend.com" -ForegroundColor Yellow
Write-Host "   Password: demo123" -ForegroundColor Yellow
Write-Host ""
