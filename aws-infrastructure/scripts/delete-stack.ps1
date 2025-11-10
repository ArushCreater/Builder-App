# Delete CloudFormation Stack
# Run this if deployment fails and stack is in ROLLBACK_COMPLETE state

param(
    [string]$Environment = "dev",
    [string]$Region = "us-east-1"
)

$StackName = "buildertrend-$Environment"

Write-Host "========================================" -ForegroundColor Yellow
Write-Host "Deleting CloudFormation Stack" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "Stack Name: $StackName" -ForegroundColor Yellow
Write-Host "Region: $Region" -ForegroundColor Yellow
Write-Host ""

# Check if stack exists
Write-Host "Checking stack status..." -ForegroundColor Green
$StackStatus = aws cloudformation describe-stacks `
    --stack-name $StackName `
    --region $Region `
    --query "Stacks[0].StackStatus" `
    --output text 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "Stack does not exist or has already been deleted." -ForegroundColor Green
    exit 0
}

Write-Host "Current stack status: $StackStatus" -ForegroundColor Yellow

if ($StackStatus -eq "ROLLBACK_COMPLETE" -or $StackStatus -eq "CREATE_FAILED") {
    Write-Host ""
    Write-Host "Stack is in $StackStatus state and needs to be deleted before redeploying." -ForegroundColor Yellow
    Write-Host ""

    $confirmation = Read-Host "Delete stack? (y/N)"
    if ($confirmation -ne 'y' -and $confirmation -ne 'Y') {
        Write-Host "Cancelled." -ForegroundColor Red
        exit 1
    }
}

# Delete the stack
Write-Host ""
Write-Host "Deleting stack..." -ForegroundColor Green
aws cloudformation delete-stack --stack-name $StackName --region $Region

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to initiate stack deletion!" -ForegroundColor Red
    exit 1
}

Write-Host "Stack deletion initiated. Waiting for completion..." -ForegroundColor Yellow
Write-Host "This typically takes 2-5 minutes." -ForegroundColor Yellow
Write-Host ""

# Wait for deletion to complete
aws cloudformation wait stack-delete-complete --stack-name $StackName --region $Region

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "Stack Deleted Successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "You can now redeploy:" -ForegroundColor Green
    Write-Host "  .\deploy.ps1" -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "Stack deletion may have failed. Check AWS Console for details." -ForegroundColor Red
    Write-Host ""
}
