# Troubleshooting CloudFormation Deployment

## Error: "Failed to create/update the stack"

This error means CloudFormation encountered an issue during deployment and rolled back all changes.

---

## Error: "Stack is in ROLLBACK_COMPLETE state and can not be updated"

This means a previous deployment failed and left the stack in a failed state. You need to delete the old stack before deploying again.

**Quick Fix (PowerShell):**
```powershell
cd aws-infrastructure\scripts
.\delete-stack.ps1
```

Wait 2-5 minutes for deletion, then redeploy:
```powershell
.\deploy.ps1
```

**Manual Deletion (if script doesn't work):**
```powershell
aws cloudformation delete-stack --stack-name buildertrend-dev --region us-east-1
aws cloudformation wait stack-delete-complete --stack-name buildertrend-dev --region us-east-1
```

---

## Step 1: Check What Went Wrong

Run the diagnostic script:

```powershell
cd aws-infrastructure\scripts
.\check-deployment.ps1
```

This will show you:
- Stack status
- Specific errors that occurred
- Which resources failed
- Deployment bucket status

---

## Common Issues & Solutions

### Issue 1: IAM Permissions

**Error**: "User is not authorized to perform: iam:CreateRole"

**Solution**: Your AWS user needs these permissions:
- CloudFormation (full)
- Lambda (full)
- DynamoDB (full)
- S3 (full)
- IAM (create roles and policies)
- API Gateway (full)
- Secrets Manager (full)

**To check your permissions:**
```powershell
aws iam get-user
aws iam list-attached-user-policies --user-name YOUR_USERNAME
```

**To add permissions** (ask your AWS admin to add `AdministratorAccess` or these specific policies):
- AmazonDynamoDBFullAccess
- AmazonS3FullAccess
- AWSLambda_FullAccess
- IAMFullAccess
- AmazonAPIGatewayAdministrator
- SecretsManagerReadWrite

### Issue 2: Service Limits

**Error**: "Maximum number of tables exceeded"

**Solution**: You've hit AWS service limits. Check:

```powershell
# Check DynamoDB tables
aws dynamodb list-tables

# Check Lambda functions
aws lambda list-functions

# Request limit increase in AWS Console
```

### Issue 3: Resource Already Exists

**Error**: "Table already exists" or "Bucket already exists"

**Solution**: Delete existing resources:

```powershell
# Delete old DynamoDB tables
aws dynamodb delete-table --table-name buildertrend-users-dev
aws dynamodb delete-table --table-name buildertrend-projects-dev

# Delete old S3 buckets (must be empty first)
$BUCKET = "buildertrend-files-dev-YOURACCOUNTID"
aws s3 rm "s3://$BUCKET" --recursive
aws s3 rb "s3://$BUCKET"
```

### Issue 4: Lambda Code Not Found

**Error**: "Could not find S3 object"

**Solution**: Make sure Lambda functions were uploaded:

```powershell
$ACCOUNT_ID = (aws sts get-caller-identity --query Account --output text)
$BUCKET = "buildertrend-deployment-dev-$ACCOUNT_ID"

# Check if files exist
aws s3 ls "s3://$BUCKET/functions/"
```

If files are missing, re-run just the packaging:

```powershell
.\deploy.ps1  # This will re-upload everything
```

---

## Step 2: Try Minimal Stack First

If the full stack fails, try deploying a minimal version to test:

```powershell
# Deploy minimal stack (no Lambda functions)
aws cloudformation deploy `
    --template-file ..\cloudformation\minimal-stack.yaml `
    --stack-name buildertrend-minimal-dev `
    --capabilities CAPABILITY_NAMED_IAM `
    --region us-east-1
```

If this works, the issue is with Lambda functions. If it fails, the issue is with basic permissions or service limits.

**Check the minimal stack:**
```powershell
aws cloudformation describe-stacks --stack-name buildertrend-minimal-dev
```

**Delete the minimal stack when done:**
```powershell
aws cloudformation delete-stack --stack-name buildertrend-minimal-dev
```

---

## Step 3: Clean Up and Retry

If you need to start fresh:

### Delete Failed Stack (if it exists)

```powershell
$StackName = "buildertrend-dev"

# Delete the stack
aws cloudformation delete-stack --stack-name $StackName

# Wait for deletion to complete (takes ~5 minutes)
Write-Host "Waiting for stack deletion..."
aws cloudformation wait stack-delete-complete --stack-name $StackName

Write-Host "Stack deleted successfully!"
```

### Clean Up S3 Buckets

```powershell
$ACCOUNT_ID = (aws sts get-caller-identity --query Account --output text)

# Delete file bucket
$FILE_BUCKET = "buildertrend-files-dev-$ACCOUNT_ID"
if (aws s3 ls "s3://$FILE_BUCKET" 2>&1) {
    aws s3 rm "s3://$FILE_BUCKET" --recursive
    aws s3 rb "s3://$FILE_BUCKET"
}

# Keep deployment bucket (has your Lambda code)
```

### Redeploy

```powershell
cd aws-infrastructure\scripts
.\deploy.ps1
```

---

## Step 4: View Detailed Logs

### Get CloudFormation Events

```powershell
$StackName = "buildertrend-dev"

# Get all events
aws cloudformation describe-stack-events --stack-name $StackName --output table

# Get only failures
aws cloudformation describe-stack-events --stack-name $StackName `
    --query "StackEvents[?ResourceStatus=='CREATE_FAILED']" `
    --output table
```

### Check IAM Role Creation

If the error is related to IAM roles:

```powershell
# Check if role exists
aws iam get-role --role-name buildertrend-lambda-role-dev

# Check role policies
aws iam list-attached-role-policies --role-name buildertrend-lambda-role-dev
```

### Validate CloudFormation Template

```powershell
# Validate the template syntax
aws cloudformation validate-template `
    --template-body file://..\cloudformation\main-stack.yaml
```

---

## Step 5: Alternative - Manual Setup

If CloudFormation continues to fail, you can create resources manually:

### 1. Create DynamoDB Tables

```powershell
# Users table
aws dynamodb create-table `
    --table-name buildertrend-users-dev `
    --attribute-definitions AttributeName=id,AttributeType=S AttributeName=email,AttributeType=S `
    --key-schema AttributeName=id,KeyType=HASH `
    --billing-mode PAY_PER_REQUEST `
    --global-secondary-indexes IndexName=email-index,KeySchema=[{AttributeName=email,KeyType=HASH}],Projection={ProjectionType=ALL}

# Projects table
aws dynamodb create-table `
    --table-name buildertrend-projects-dev `
    --attribute-definitions AttributeName=id,AttributeType=S AttributeName=ownerId,AttributeType=S `
    --key-schema AttributeName=id,KeyType=HASH `
    --billing-mode PAY_PER_REQUEST `
    --global-secondary-indexes IndexName=ownerId-index,KeySchema=[{AttributeName=ownerId,KeyType=HASH}],Projection={ProjectionType=ALL}
```

### 2. Create S3 Bucket

```powershell
$ACCOUNT_ID = (aws sts get-caller-identity --query Account --output text)
$BUCKET = "buildertrend-files-dev-$ACCOUNT_ID"

# Create bucket
aws s3 mb "s3://$BUCKET"

# Enable public access for files
aws s3api put-bucket-policy --bucket $BUCKET --policy file://bucket-policy.json
```

Create `bucket-policy.json`:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::BUCKET_NAME/*"
    }
  ]
}
```

### 3. Create JWT Secret

```powershell
# Generate random secret
$SECRET = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})

# Create secret in Secrets Manager
aws secretsmanager create-secret `
    --name buildertrend/dev/jwt `
    --secret-string "{\"secret\":\"$SECRET\"}"
```

---

## Getting More Help

### Enable CloudFormation Debug Mode

Add this to the top of `main-stack.yaml`:

```yaml
Metadata:
  AWS::CloudFormation::Interface:
    ParameterGroups:
      - Label:
          default: "Debugging"
        Parameters:
          - Environment
```

### Check AWS Service Status

Make sure AWS services are operational:
https://health.aws.amazon.com/health/status

### Contact AWS Support

If you have an AWS support plan:
1. Go to AWS Console → Support Center
2. Create a case
3. Select "Service limit increase" or "Technical support"
4. Describe the CloudFormation error

---

## Quick Reference

**View stack status:**
```powershell
aws cloudformation describe-stacks --stack-name buildertrend-dev
```

**View stack events:**
```powershell
aws cloudformation describe-stack-events --stack-name buildertrend-dev
```

**Delete stack:**
```powershell
aws cloudformation delete-stack --stack-name buildertrend-dev
```

**List all stacks:**
```powershell
aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE DELETE_COMPLETE ROLLBACK_COMPLETE
```

**Validate template:**
```powershell
aws cloudformation validate-template --template-body file://main-stack.yaml
```

---

## Still Having Issues?

Try these steps in order:

1. ✅ Run `.\check-deployment.ps1` to see the error
2. ✅ Check IAM permissions
3. ✅ Try deploying `minimal-stack.yaml`
4. ✅ Clean up and retry with `deploy.ps1`
5. ✅ Check AWS service limits
6. ✅ Validate template syntax
7. ✅ Try manual resource creation
8. ✅ Contact AWS support

The most common issue is **IAM permissions** - make sure your AWS user has full CloudFormation and related service permissions!
