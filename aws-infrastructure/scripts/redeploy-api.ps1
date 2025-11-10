# Script to force API Gateway redeployment
# Run this after CloudFormation deployment completes if you're still getting CORS errors

param(
    [string]$Environment = "dev",
    [string]$Region = "us-east-1"
)

$ErrorActionPreference = "Stop"

$StackName = "buildertrend-$Environment"

Write-Host "Getting API Gateway ID from CloudFormation stack..." -ForegroundColor Yellow

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
    Write-Host "Error: Could not find API Gateway ID" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

Write-Host "API Gateway ID: $ApiId" -ForegroundColor Green
Write-Host "Forcing redeployment to $Environment stage..." -ForegroundColor Yellow

$Description = "Manual redeployment to fix CORS - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

try {
    $DeploymentId = aws apigateway create-deployment `
        --rest-api-id $ApiId `
        --stage-name $Environment `
        --description $Description `
        --region $Region `
        --query 'id' `
        --output text

    Write-Host "Deployment ID: $DeploymentId" -ForegroundColor Green
    Write-Host ""
    Write-Host "API Gateway has been redeployed!" -ForegroundColor Green
    Write-Host "Wait 10-20 seconds, then refresh your web app and try again." -ForegroundColor Yellow
    Write-Host "The CORS errors should be fixed now." -ForegroundColor Green
} catch {
    Write-Host "Error during redeployment:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
