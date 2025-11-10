# Check Lambda function logs from CloudWatch

param(
    [string]$Environment = "dev",
    [string]$Region = "us-east-1",
    [string]$FunctionName = "auth"
)

$ErrorActionPreference = "Stop"
$StackName = "buildertrend-$Environment"

Write-Host "========================================" -ForegroundColor Green
Write-Host "Checking Lambda Logs" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Get Lambda function name from CloudFormation
Write-Host "Step 1: Getting Lambda function name..." -ForegroundColor Yellow

$LogicalId = switch ($FunctionName) {
    "auth" { "AuthFunction" }
    "projects" { "ProjectsFunction" }
    "leads" { "LeadsFunction" }
    "tasks" { "TasksFunction" }
    "budget" { "BudgetFunction" }
    "documents" { "DocumentsFunction" }
    "authorizer" { "ApiAuthorizer" }
    default { "AuthFunction" }
}

try {
    $PhysicalFunctionName = aws cloudformation describe-stack-resources `
        --stack-name $StackName `
        --logical-resource-id $LogicalId `
        --query 'StackResources[0].PhysicalResourceId' `
        --output text `
        --region $Region

    Write-Host "   Function Name: $PhysicalFunctionName" -ForegroundColor Green
} catch {
    Write-Host "   ERROR: Could not find Lambda function" -ForegroundColor Red
    exit 1
}

# Get log group name
$LogGroupName = "/aws/lambda/$PhysicalFunctionName"
Write-Host "   Log Group: $LogGroupName" -ForegroundColor Green

# Get recent log streams
Write-Host ""
Write-Host "Step 2: Getting recent log streams..." -ForegroundColor Yellow

try {
    $logStreams = aws logs describe-log-streams `
        --log-group-name $LogGroupName `
        --order-by LastEventTime `
        --descending `
        --limit 5 `
        --region $Region `
        --query 'logStreams[*].[logStreamName,lastEventTime]' `
        --output json | ConvertFrom-Json

    if ($logStreams.Count -eq 0) {
        Write-Host "   No log streams found. Lambda may not have been invoked yet." -ForegroundColor Yellow
        exit 0
    }

    Write-Host "   Found $($logStreams.Count) recent log streams" -ForegroundColor Green
} catch {
    Write-Host "   ERROR: Could not retrieve log streams" -ForegroundColor Red
    Write-Host "   This might mean the Lambda hasn't been invoked yet" -ForegroundColor Yellow
    exit 0
}

# Get logs from the most recent stream
Write-Host ""
Write-Host "Step 3: Fetching recent logs..." -ForegroundColor Yellow
Write-Host ""

$mostRecentStream = $logStreams[0][0]

try {
    $logs = aws logs get-log-events `
        --log-group-name $LogGroupName `
        --log-stream-name $mostRecentStream `
        --limit 50 `
        --region $Region `
        --query 'events[*].message' `
        --output text

    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "RECENT LOGS FROM: $mostRecentStream" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host $logs
    Write-Host "========================================" -ForegroundColor Cyan
} catch {
    Write-Host "   ERROR: Could not retrieve logs" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "To see more logs, go to AWS Console:" -ForegroundColor Yellow
Write-Host "https://console.aws.amazon.com/cloudwatch/home?region=$Region#logsV2:log-groups/log-group/`$252Faws`$252Flambda`$252F$PhysicalFunctionName" -ForegroundColor Cyan
Write-Host ""
