# Check CloudFormation deployment status and errors
param(
    [string]$Environment = "dev",
    [string]$Region = "us-east-1"
)

$StackName = "buildertrend-$Environment"

Write-Host "Checking stack status..." -ForegroundColor Yellow

# Try to get stack status
$StackStatus = aws cloudformation describe-stacks `
    --stack-name $StackName `
    --region $Region `
    --query "Stacks[0].StackStatus" `
    --output text 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "Stack does not exist or has been deleted (likely rolled back due to error)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Checking CloudFormation events for errors..." -ForegroundColor Yellow

    # List all recent stacks to find deleted ones
    $AllStacks = aws cloudformation list-stacks `
        --stack-status-filter DELETE_COMPLETE ROLLBACK_COMPLETE CREATE_FAILED `
        --region $Region `
        --query "StackSummaries[?StackName=='$StackName']" `
        --output json | ConvertFrom-Json

    if ($AllStacks) {
        Write-Host "Found stack in $($AllStacks[0].StackStatus) status" -ForegroundColor Yellow
        Write-Host ""

        # Get stack events to see what failed
        Write-Host "Last events (showing failures):" -ForegroundColor Red
        aws cloudformation describe-stack-events `
            --stack-name $StackName `
            --region $Region `
            --query "StackEvents[?ResourceStatus=='CREATE_FAILED' || ResourceStatus=='ROLLBACK_IN_PROGRESS'].{Time:Timestamp,Resource:LogicalResourceId,Status:ResourceStatus,Reason:ResourceStatusReason}" `
            --output table
    } else {
        Write-Host "No stack found with name: $StackName" -ForegroundColor Red
    }
} else {
    Write-Host "Stack Status: $StackStatus" -ForegroundColor Green

    Write-Host ""
    Write-Host "Recent stack events:" -ForegroundColor Yellow
    aws cloudformation describe-stack-events `
        --stack-name $StackName `
        --region $Region `
        --max-items 20 `
        --query "StackEvents[].{Time:Timestamp,Resource:LogicalResourceId,Status:ResourceStatus,Reason:ResourceStatusReason}" `
        --output table
}

Write-Host ""
Write-Host "Checking if deployment bucket exists..." -ForegroundColor Yellow
$AccountId = aws sts get-caller-identity --query Account --output text
$DeploymentBucket = "buildertrend-deployment-$Environment-$AccountId"

try {
    aws s3 ls "s3://$DeploymentBucket" 2>&1 | Out-Null
    Write-Host "✅ Deployment bucket exists: $DeploymentBucket" -ForegroundColor Green

    Write-Host ""
    Write-Host "Checking uploaded Lambda functions..." -ForegroundColor Yellow
    aws s3 ls "s3://$DeploymentBucket/functions/" --recursive
} catch {
    Write-Host "❌ Deployment bucket not found" -ForegroundColor Red
}

Write-Host ""
Write-Host "Common issues:" -ForegroundColor Yellow
Write-Host "1. Check IAM permissions - need CloudFormation, Lambda, DynamoDB, S3, IAM, Secrets Manager"
Write-Host "2. Check AWS service limits (Lambda function count, DynamoDB table count)"
Write-Host "3. Template validation errors"
Write-Host "4. Resource name conflicts"
