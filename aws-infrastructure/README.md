# BuilderTrend AWS Infrastructure

Complete AWS serverless infrastructure for the BuilderTrend clone application using CloudFormation.

## Architecture Overview

This infrastructure uses a **fully serverless** architecture for cost-efficiency and scalability:

- **API Gateway** - RESTful API endpoints
- **Lambda Functions** - Serverless compute for business logic
- **DynamoDB** - NoSQL database for all data (pay-per-request billing)
- **S3** - File storage for documents, photos, and invoices
- **Secrets Manager** - Secure storage for JWT secrets
- **CloudWatch** - Logging and monitoring

### Why Serverless?

- **Cost**: Pay only for what you use (no idle servers)
- **Scalability**: Automatic scaling from 0 to millions of requests
- **No maintenance**: AWS manages all infrastructure
- **High availability**: Built-in redundancy across multiple AZs

---

## Prerequisites

Before deploying, ensure you have:

1. **AWS Account** - [Create one here](https://aws.amazon.com/)
2. **AWS CLI** - [Installation guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
3. **Node.js 18+** - For packaging Lambda functions
4. **Bash** - The deployment script requires bash (Mac/Linux/WSL)

### Configure AWS CLI

```bash
aws configure
```

Enter your:
- AWS Access Key ID
- AWS Secret Access Key
- Default region (e.g., `us-east-1`)
- Default output format (enter `json`)

**Verify configuration:**
```bash
aws sts get-caller-identity
```

You should see your AWS account ID and user info.

---

## Quick Deployment

### 1. Make the deployment script executable

```bash
cd aws-infrastructure/scripts
chmod +x deploy.sh
```

### 2. Deploy to AWS

```bash
./deploy.sh dev
```

This will:
- Create an S3 bucket for deployments
- Package all Lambda functions
- Upload functions to S3
- Deploy CloudFormation stack
- Create all AWS resources

**Deployment takes approximately 5-10 minutes.**

### 3. Get your API endpoint

After deployment completes, you'll see:

```
API Endpoint: https://xxxxx.execute-api.us-east-1.amazonaws.com/dev
File Storage Bucket: buildertrend-files-dev-xxxxx
```

### 4. Update your web app

Update `web/.env`:

```env
VITE_API_URL=https://xxxxx.execute-api.us-east-1.amazonaws.com/dev
```

---

## What Gets Created

### DynamoDB Tables

| Table | Purpose | Billing |
|-------|---------|---------|
| `buildertrend-users-{env}` | User accounts & authentication | Pay-per-request |
| `buildertrend-projects-{env}` | Project data | Pay-per-request |
| `buildertrend-leads-{env}` | Sales leads | Pay-per-request |
| `buildertrend-tasks-{env}` | Task management | Pay-per-request |
| `buildertrend-invoices-{env}` | Invoice records | Pay-per-request |
| `buildertrend-documents-{env}` | Document metadata | Pay-per-request |

### S3 Buckets

| Bucket | Purpose | Public Access |
|--------|---------|---------------|
| `buildertrend-files-{env}-{account}` | File storage (images, PDFs, documents) | Public read |
| `buildertrend-deployment-{env}-{account}` | Lambda deployment packages | Private |

### Lambda Functions

| Function | Purpose | Memory | Timeout |
|----------|---------|--------|---------|
| `buildertrend-authorizer-{env}` | JWT validation | 128 MB | 10s |
| `buildertrend-auth-{env}` | Login/register | 256 MB | 30s |
| `buildertrend-projects-{env}` | Project CRUD | 256 MB | 30s |
| `buildertrend-file-upload-{env}` | File uploads | 512 MB | 60s |

### API Gateway

- RESTful API with custom authorizer
- CORS enabled
- JWT authentication
- Deployed to `dev`, `staging`, or `prod` stage

---

## Cost Estimate

For a typical usage scenario:

| Service | Monthly Cost (estimate) |
|---------|------------------------|
| **DynamoDB** | $1-5 (pay-per-request, first 25GB free) |
| **Lambda** | $0-2 (1M requests free tier) |
| **API Gateway** | $1-3 (1M requests ≈ $3.50) |
| **S3 Storage** | $0.50-5 (first 5GB ≈ $0.12/month) |
| **CloudWatch Logs** | $0.50-2 |
| **Total** | **$3-17/month** |

**Free tier benefits:**
- DynamoDB: 25GB storage, 25 RCU/WCU
- Lambda: 1M requests + 400,000 GB-seconds compute
- S3: 5GB storage, 20,000 GET requests
- API Gateway: 1M requests (first 12 months)

---

## Environment Setup

### Deploy to Different Environments

```bash
# Development
./deploy.sh dev

# Staging
./deploy.sh staging

# Production
./deploy.sh prod
```

Each environment creates separate resources with isolated data.

### Regions

To deploy to a different region:

```bash
export AWS_REGION=us-west-2
./deploy.sh dev
```

---

## API Endpoints

After deployment, your API will have these endpoints:

### Authentication
- `POST /dev/auth/login` - User login
- `POST /dev/auth/register` - User registration
- `GET /dev/auth/me` - Get current user (requires auth)

### Projects
- `GET /dev/projects` - List all projects
- `GET /dev/projects/{id}` - Get project details
- `POST /dev/projects` - Create project
- `PUT /dev/projects/{id}` - Update project
- `DELETE /dev/projects/{id}` - Delete project

### Files
- `POST /dev/upload/presigned-url` - Get presigned URL for upload
- `POST /dev/upload` - Direct upload (base64)
- `DELETE /dev/upload` - Delete file

---

## Testing Your Deployment

### 1. Test health endpoint

```bash
curl https://YOUR_API_URL/dev/health
```

### 2. Register a user

```bash
curl -X POST https://YOUR_API_URL/dev/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "firstName": "Test",
    "lastName": "User",
    "role": "ADMIN"
  }'
```

### 3. Login

```bash
curl -X POST https://YOUR_API_URL/dev/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

Save the returned token!

### 4. Test authenticated endpoint

```bash
curl https://YOUR_API_URL/dev/projects \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## Monitoring & Logs

### View Lambda Logs

```bash
# View logs for auth function
aws logs tail /aws/lambda/buildertrend-auth-dev --follow

# View logs for projects function
aws logs tail /aws/lambda/buildertrend-projects-dev --follow
```

### CloudWatch Dashboard

1. Go to AWS Console → CloudWatch
2. Navigate to "Dashboards"
3. You'll see metrics for Lambda invocations, errors, duration, etc.

### Cost Monitoring

1. Go to AWS Console → Cost Explorer
2. Filter by service to see breakdown
3. Set up billing alerts in "Billing & Cost Management"

---

## Updating the Stack

### Update Lambda Functions Only

```bash
./deploy.sh dev
```

This updates your Lambda code without recreating infrastructure.

### Update CloudFormation Template

Edit `cloudformation/main-stack.yaml`, then:

```bash
./deploy.sh dev
```

CloudFormation will only update changed resources.

---

## Connecting Your Web App

### Update Environment Variables

Edit `web/.env`:

```env
VITE_API_URL=https://xxxxx.execute-api.us-east-1.amazonaws.com/dev
```

### Update API Client

The API client in `web/src/lib/api.ts` should work automatically with the new endpoint.

### Test the Connection

```bash
cd web
npm run dev
```

Try logging in - it should now use the real AWS backend!

---

## Security Best Practices

### 1. Enable MFA on AWS Account
- Go to IAM → Your account → Security credentials
- Enable Multi-Factor Authentication

### 2. Create IAM User for Deployment
- Don't use root account credentials
- Create IAM user with minimal permissions
- Use AWS CLI profiles

### 3. Rotate Secrets
```bash
aws secretsmanager rotate-secret \
  --secret-id buildertrend/dev/jwt
```

### 4. Enable CloudTrail
- Logs all API calls
- Useful for auditing and security

### 5. Set Up WAF (Optional)
- Protect against common web attacks
- Rate limiting
- IP filtering

---

## Troubleshooting

### "AccessDenied" Error

**Problem:** Don't have permission to create resources

**Solution:**
```bash
# Check your IAM permissions
aws iam get-user

# Ensure you have these permissions:
# - CloudFormation (full)
# - Lambda (full)
# - DynamoDB (full)
# - S3 (full)
# - IAM (create roles)
# - API Gateway (full)
```

### "Stack Already Exists" Error

**Problem:** Stack with same name exists

**Solution:**
```bash
# Delete the existing stack
aws cloudformation delete-stack --stack-name buildertrend-dev

# Wait for deletion
aws cloudformation wait stack-delete-complete --stack-name buildertrend-dev

# Redeploy
./deploy.sh dev
```

### Lambda Function Errors

**Problem:** Function fails with errors

**Solution:**
```bash
# Check logs
aws logs tail /aws/lambda/buildertrend-auth-dev --follow

# Common issues:
# - Missing environment variables
# - DynamoDB permissions
# - Syntax errors in code
```

### High Costs

**Problem:** Unexpected AWS bill

**Solution:**
1. Check CloudWatch Logs retention (change to 7 days)
2. Enable DynamoDB TTL for old data
3. Use S3 lifecycle policies to archive old files
4. Set up billing alerts

---

## Cleanup / Deletion

To delete all AWS resources:

```bash
# Delete CloudFormation stack
aws cloudformation delete-stack --stack-name buildertrend-dev

# Delete S3 buckets (must be empty first)
aws s3 rm s3://buildertrend-files-dev-XXXXX --recursive
aws s3 rb s3://buildertrend-files-dev-XXXXX

aws s3 rm s3://buildertrend-deployment-dev-XXXXX --recursive
aws s3 rb s3://buildertrend-deployment-dev-XXXXX
```

**Note:** This will delete ALL data. Make sure you have backups!

---

## Advanced Configuration

### Custom Domain

1. Register domain in Route 53
2. Request ACM certificate
3. Update CloudFormation template with custom domain
4. Create Route 53 record pointing to API Gateway

### Database Backups

Enable Point-in-Time Recovery for DynamoDB:

```bash
aws dynamodb update-continuous-backups \
  --table-name buildertrend-users-dev \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true
```

### VPC Integration

For enhanced security, you can deploy Lambda in a VPC:
- Edit CloudFormation template
- Add VPC configuration to Lambda functions
- Create NAT Gateway for internet access

---

## Support & Resources

- **AWS Documentation:** https://docs.aws.amazon.com/
- **CloudFormation Reference:** https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/
- **Lambda Best Practices:** https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html
- **DynamoDB Guide:** https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/

---

## Summary

You now have a **production-ready serverless infrastructure** running on AWS! 🎉

**What you've deployed:**
- ✅ RESTful API with authentication
- ✅ Database with all tables
- ✅ File storage with S3
- ✅ Automatic scaling
- ✅ Built-in monitoring
- ✅ Pay-per-use pricing

**Estimated monthly cost:** $3-17 depending on usage

**Next steps:**
1. Test all API endpoints
2. Connect your frontend
3. Deploy frontend to Vercel/Netlify
4. Set up custom domain (optional)
5. Configure monitoring alerts

Enjoy your serverless BuilderTrend clone! 🏗️
