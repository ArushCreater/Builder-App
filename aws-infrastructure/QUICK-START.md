# Quick Start Guide - Deploy to AWS in 5 Minutes

## Prerequisites

✅ AWS Account
✅ AWS CLI installed
✅ Node.js 18+ installed

---

## Step 1: Configure AWS CLI

```bash
aws configure
```

Enter your AWS credentials when prompted.

---

## Step 2: Deploy Infrastructure

### 🪟 Windows (PowerShell)

```powershell
cd aws-infrastructure\scripts
.\deploy.ps1
```

**See [WINDOWS-DEPLOY.md](WINDOWS-DEPLOY.md) for detailed Windows guide**

### 🐧 Mac/Linux (Bash)

```bash
cd aws-infrastructure/scripts
chmod +x deploy.sh
./deploy.sh dev
```

Wait 5-10 minutes for deployment to complete.

---

## Step 3: Get Your API URL

After deployment, you'll see output like:

```
API Endpoint: https://abc123.execute-api.us-east-1.amazonaws.com/dev
File Storage Bucket: buildertrend-files-dev-123456789
```

**Copy the API Endpoint URL!**

---

## Step 4: Update Your Web App

Edit `web/.env`:

```env
VITE_API_URL=https://YOUR_API_URL_HERE
```

---

## Step 5: Test It!

```bash
cd web
npm run dev
```

Go to http://localhost:3000 and register a new account. It now uses your real AWS backend!

---

## That's It! 🎉

You now have a fully functional serverless backend on AWS.

**Monthly Cost:** ~$3-17 (mostly free tier eligible)

---

## Useful Commands

### View Logs
```bash
aws logs tail /aws/lambda/buildertrend-auth-dev --follow
```

### Delete Everything
```bash
aws cloudformation delete-stack --stack-name buildertrend-dev
```

### Deploy Updates
```bash
./deploy.sh dev
```

---

## Troubleshooting

**"AccessDenied" error?**
- Make sure you have IAM permissions for CloudFormation, Lambda, DynamoDB, S3

**"Stack already exists" error?**
```bash
aws cloudformation delete-stack --stack-name buildertrend-dev
# Wait a few minutes, then redeploy
./deploy.sh dev
```

**Lambda errors?**
```bash
aws logs tail /aws/lambda/buildertrend-auth-dev --follow
```

---

## Next Steps

- ✅ Your backend is live on AWS
- ✅ Deploy your frontend to Vercel/Netlify
- ✅ Connect everything together
- ✅ Start building!

For detailed documentation, see [README.md](./README.md)
