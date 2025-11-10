# Windows Deployment Guide

Complete guide for deploying BuilderTrend to AWS from Windows.

## Prerequisites

1. **AWS Account** - [Sign up here](https://aws.amazon.com/)
2. **AWS CLI for Windows** - [Download installer](https://awscli.amazonaws.com/AWSCLIV2.msi)
3. **Node.js 18+** - [Download installer](https://nodejs.org/)

---

## Step 1: Install AWS CLI

1. Download AWS CLI installer: https://awscli.amazonaws.com/AWSCLIV2.msi
2. Run the installer
3. Restart your terminal/PowerShell

**Verify installation:**
```powershell
aws --version
```

You should see something like: `aws-cli/2.x.x Python/3.x.x Windows/...`

---

## Step 2: Configure AWS CLI

Open PowerShell and run:

```powershell
aws configure
```

Enter your credentials:
```
AWS Access Key ID: YOUR_ACCESS_KEY
AWS Secret Access Key: YOUR_SECRET_KEY
Default region name: us-east-1
Default output format: json
```

### Where to get AWS credentials?

1. Go to [AWS Console](https://console.aws.amazon.com/)
2. Click your name (top right) → Security credentials
3. Scroll to "Access keys"
4. Click "Create access key"
5. Save the Access Key ID and Secret Access Key

**Verify configuration:**
```powershell
aws sts get-caller-identity
```

You should see your AWS account info.

---

## Step 3: Deploy to AWS

### Option 1: Using PowerShell Script (Recommended)

```powershell
cd aws-infrastructure\scripts
.\deploy.ps1
```

**Deploy to specific environment:**
```powershell
.\deploy.ps1 -Environment dev
.\deploy.ps1 -Environment staging
.\deploy.ps1 -Environment prod
```

**Deploy to specific region:**
```powershell
.\deploy.ps1 -Environment dev -Region us-west-2
```

### Option 2: Manual Steps

If the script doesn't work, follow these manual steps:

#### 1. Set variables
```powershell
$env:AWS_REGION = "us-east-1"
$ENVIRONMENT = "dev"
$ACCOUNT_ID = (aws sts get-caller-identity --query Account --output text)
$DEPLOYMENT_BUCKET = "buildertrend-deployment-$ENVIRONMENT-$ACCOUNT_ID"
$STACK_NAME = "buildertrend-$ENVIRONMENT"
```

#### 2. Create deployment bucket
```powershell
aws s3 mb "s3://$DEPLOYMENT_BUCKET" --region us-east-1
```

#### 3. Package Lambda functions

**Create build directory:**
```powershell
New-Item -ItemType Directory -Path "..\..\build" -Force
```

**Package Authorizer:**
```powershell
cd ..\lambda\authorizer
npm install --production
Compress-Archive -Path * -DestinationPath "..\..\build\authorizer.zip" -Force
aws s3 cp "..\..\build\authorizer.zip" "s3://$DEPLOYMENT_BUCKET/functions/authorizer.zip"
cd ..\..\scripts
```

**Package Auth:**
```powershell
cd ..\lambda\auth
npm install --production
Compress-Archive -Path * -DestinationPath "..\..\build\auth.zip" -Force
aws s3 cp "..\..\build\auth.zip" "s3://$DEPLOYMENT_BUCKET/functions/auth.zip"
cd ..\..\scripts
```

**Package Projects:**
```powershell
cd ..\lambda\projects
npm install --production
Compress-Archive -Path * -DestinationPath "..\..\build\projects.zip" -Force
aws s3 cp "..\..\build\projects.zip" "s3://$DEPLOYMENT_BUCKET/functions/projects.zip"
cd ..\..\scripts
```

**Package File Upload:**
```powershell
cd ..\lambda\file-upload
npm install --production
Compress-Archive -Path * -DestinationPath "..\..\build\file-upload.zip" -Force
aws s3 cp "..\..\build\file-upload.zip" "s3://$DEPLOYMENT_BUCKET/functions/file-upload.zip"
cd ..\..\scripts
```

#### 4. Create Lambda layer
```powershell
New-Item -ItemType Directory -Path "..\..\build\layers\nodejs" -Force
Copy-Item "..\lambda\auth\package.json" "..\..\build\layers\nodejs\"
cd ..\..\build\layers\nodejs
npm install --production
cd ..
Compress-Archive -Path "nodejs" -DestinationPath "..\node-modules.zip" -Force
aws s3 cp "..\node-modules.zip" "s3://$DEPLOYMENT_BUCKET/layers/node-modules.zip"
cd ..\..\aws-infrastructure\scripts
```

#### 5. Deploy CloudFormation
```powershell
cd ..\cloudformation
aws cloudformation deploy `
    --template-file main-stack.yaml `
    --stack-name $STACK_NAME `
    --parameter-overrides Environment=$ENVIRONMENT `
    --capabilities CAPABILITY_NAMED_IAM `
    --region us-east-1 `
    --no-fail-on-empty-changeset
```

#### 6. Get API URL
```powershell
$API_URL = aws cloudformation describe-stacks `
    --stack-name $STACK_NAME `
    --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" `
    --output text

Write-Host "API URL: $API_URL"
```

---

## Step 4: Update Your Web App

Edit `web\.env`:

```env
VITE_API_URL=https://xxxxx.execute-api.us-east-1.amazonaws.com/dev
```

Replace `xxxxx` with your actual API Gateway ID from the deployment output.

---

## Step 5: Test Your Deployment

### Test with PowerShell:

**Register a user:**
```powershell
$API_URL = "YOUR_API_URL_HERE"

$body = @{
    email = "test@example.com"
    password = "password123"
    firstName = "Test"
    lastName = "User"
    role = "ADMIN"
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
    -Uri "$API_URL/auth/register" `
    -ContentType "application/json" `
    -Body $body
```

**Login:**
```powershell
$body = @{
    email = "test@example.com"
    password = "password123"
} | ConvertTo-Json

$response = Invoke-RestMethod -Method Post `
    -Uri "$API_URL/auth/login" `
    -ContentType "application/json" `
    -Body $body

$TOKEN = $response.token
Write-Host "Token: $TOKEN"
```

**Get projects (authenticated):**
```powershell
Invoke-RestMethod -Method Get `
    -Uri "$API_URL/projects" `
    -Headers @{Authorization = "Bearer $TOKEN"}
```

---

## Troubleshooting

### "Cannot be loaded because running scripts is disabled"

**Solution:** Enable PowerShell script execution:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Then try running the script again.

### "AWS CLI not found"

**Solution:**
1. Reinstall AWS CLI
2. Restart PowerShell
3. Verify: `aws --version`

### "Access Denied" errors

**Solution:** Check IAM permissions. Your AWS user needs:
- CloudFormation (full access)
- Lambda (full access)
- DynamoDB (full access)
- S3 (full access)
- IAM (create roles)
- API Gateway (full access)
- Secrets Manager (full access)

### "Stack already exists"

**Solution:** Delete the old stack first:

```powershell
aws cloudformation delete-stack --stack-name buildertrend-dev
# Wait 5-10 minutes
aws cloudformation wait stack-delete-complete --stack-name buildertrend-dev
# Then redeploy
.\deploy.ps1
```

### Compress-Archive errors

**Solution:** Make sure you're in the correct directory. Use absolute paths if needed:

```powershell
$zipPath = Resolve-Path "..\..\build\auth.zip"
Compress-Archive -Path * -DestinationPath $zipPath -Force
```

---

## View Logs (PowerShell)

**View Lambda logs:**
```powershell
# Auth function logs
aws logs tail /aws/lambda/buildertrend-auth-dev --follow

# Projects function logs
aws logs tail /aws/lambda/buildertrend-projects-dev --follow
```

**List all log groups:**
```powershell
aws logs describe-log-groups --query "logGroups[?contains(logGroupName, 'buildertrend')].logGroupName" --output table
```

---

## Update Deployment

To deploy updates:

```powershell
cd aws-infrastructure\scripts
.\deploy.ps1
```

The script will:
- Package updated Lambda functions
- Upload to S3
- Update CloudFormation stack
- Only change what's different (fast updates)

---

## Delete Everything

To remove all AWS resources:

```powershell
# Delete CloudFormation stack
aws cloudformation delete-stack --stack-name buildertrend-dev

# Wait for deletion
aws cloudformation wait stack-delete-complete --stack-name buildertrend-dev

# Delete S3 buckets (if needed)
$ACCOUNT_ID = (aws sts get-caller-identity --query Account --output text)
$FILE_BUCKET = "buildertrend-files-dev-$ACCOUNT_ID"
$DEPLOY_BUCKET = "buildertrend-deployment-dev-$ACCOUNT_ID"

# Empty and delete file bucket
aws s3 rm "s3://$FILE_BUCKET" --recursive
aws s3 rb "s3://$FILE_BUCKET"

# Empty and delete deployment bucket
aws s3 rm "s3://$DEPLOY_BUCKET" --recursive
aws s3 rb "s3://$DEPLOY_BUCKET"
```

---

## Using WSL (Alternative)

If you prefer Linux commands, install WSL (Windows Subsystem for Linux):

```powershell
# Install WSL
wsl --install

# Restart computer

# Open Ubuntu
wsl

# Then use the bash script
cd /mnt/c/path/to/Builder-App/aws-infrastructure/scripts
chmod +x deploy.sh
./deploy.sh dev
```

---

## Next Steps

1. ✅ Deploy infrastructure
2. ✅ Update web/.env with API URL
3. ✅ Test locally: `cd web && npm run dev`
4. ✅ Deploy frontend to Vercel/Netlify
5. ✅ Set up monitoring alerts
6. ✅ Configure custom domain (optional)

---

## Getting Help

**AWS CLI Documentation:**
- https://docs.aws.amazon.com/cli/

**PowerShell Documentation:**
- https://docs.microsoft.com/powershell/

**CloudFormation Documentation:**
- https://docs.aws.amazon.com/cloudformation/

**Common Commands Reference:**
```powershell
# Check AWS CLI version
aws --version

# Check AWS credentials
aws sts get-caller-identity

# List CloudFormation stacks
aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE

# List S3 buckets
aws s3 ls

# List Lambda functions
aws lambda list-functions

# List DynamoDB tables
aws dynamodb list-tables
```

---

## Summary

You now have a complete Windows deployment solution! 🎉

**What's included:**
- ✅ PowerShell deployment script
- ✅ Manual step-by-step guide
- ✅ Troubleshooting section
- ✅ Testing commands
- ✅ Windows-specific solutions

**Deployment time:** 5-10 minutes
**Monthly cost:** $3-17 (mostly free tier)

Run `.\deploy.ps1` and you're live on AWS! 🚀
