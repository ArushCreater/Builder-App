#!/bin/bash

# BuilderTrend AWS Deployment Script
# This script deploys the entire infrastructure to AWS

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-dev}
AWS_REGION=${AWS_REGION:-us-east-1}
STACK_NAME="buildertrend-${ENVIRONMENT}"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}BuilderTrend AWS Deployment${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "Environment: ${YELLOW}${ENVIRONMENT}${NC}"
echo -e "Region: ${YELLOW}${AWS_REGION}${NC}"
echo -e "Stack Name: ${YELLOW}${STACK_NAME}${NC}"
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}ERROR: AWS CLI not found. Please install it first.${NC}"
    exit 1
fi

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}WARNING: jq not found. Some features may not work.${NC}"
fi

# Get AWS Account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo -e "AWS Account ID: ${YELLOW}${AWS_ACCOUNT_ID}${NC}"
echo ""

# Create deployment bucket if it doesn't exist
DEPLOYMENT_BUCKET="buildertrend-deployment-${ENVIRONMENT}-${AWS_ACCOUNT_ID}"

echo -e "${GREEN}Step 1: Checking deployment bucket...${NC}"
if ! aws s3 ls "s3://${DEPLOYMENT_BUCKET}" 2>&1 > /dev/null; then
    echo "Creating deployment bucket: ${DEPLOYMENT_BUCKET}"
    aws s3 mb "s3://${DEPLOYMENT_BUCKET}" --region ${AWS_REGION}
    aws s3api put-bucket-versioning \
        --bucket ${DEPLOYMENT_BUCKET} \
        --versioning-configuration Status=Enabled
else
    echo "Deployment bucket already exists: ${DEPLOYMENT_BUCKET}"
fi
echo ""

# Package Lambda functions
echo -e "${GREEN}Step 2: Packaging Lambda functions...${NC}"

cd ../lambda

# Package Authorizer
echo "Packaging authorizer function..."
cd authorizer
npm install --production
zip -r ../../../build/authorizer.zip . -x "*.git*" -x "*node_modules/.cache*"
aws s3 cp ../../../build/authorizer.zip "s3://${DEPLOYMENT_BUCKET}/functions/authorizer.zip"
cd ..

# Package Auth
echo "Packaging auth function..."
cd auth
npm install --production
zip -r ../../../build/auth.zip . -x "*.git*" -x "*node_modules/.cache*"
aws s3 cp ../../../build/auth.zip "s3://${DEPLOYMENT_BUCKET}/functions/auth.zip"
cd ..

# Package Projects
echo "Packaging projects function..."
cd projects
npm install --production
zip -r ../../../build/projects.zip . -x "*.git*" -x "*node_modules/.cache*"
aws s3 cp ../../../build/projects.zip "s3://${DEPLOYMENT_BUCKET}/functions/projects.zip"
cd ..

# Package File Upload
echo "Packaging file-upload function..."
cd file-upload
npm install --production
zip -r ../../../build/file-upload.zip . -x "*.git*" -x "*node_modules/.cache*"
aws s3 cp ../../../build/file-upload.zip "s3://${DEPLOYMENT_BUCKET}/functions/file-upload.zip"
cd ..

cd ../scripts

echo -e "${GREEN}Lambda functions packaged and uploaded!${NC}"
echo ""

# Create node_modules layer
echo -e "${GREEN}Step 3: Creating Lambda layer...${NC}"
mkdir -p ../../build/layers/nodejs
cd ../lambda/auth
cp package.json ../../build/layers/nodejs/
cd ../../build/layers/nodejs
npm install --production
cd ../
zip -r ../node-modules.zip nodejs
aws s3 cp ../node-modules.zip "s3://${DEPLOYMENT_BUCKET}/layers/node-modules.zip"
cd ../../scripts
echo -e "${GREEN}Lambda layer created!${NC}"
echo ""

# Deploy CloudFormation stack
echo -e "${GREEN}Step 4: Deploying CloudFormation stack...${NC}"

aws cloudformation deploy \
    --template-file ../cloudformation/main-stack.yaml \
    --stack-name ${STACK_NAME} \
    --parameter-overrides \
        Environment=${ENVIRONMENT} \
        DeploymentBucketName=${DEPLOYMENT_BUCKET} \
    --capabilities CAPABILITY_NAMED_IAM \
    --region ${AWS_REGION} \
    --no-fail-on-empty-changeset

if [ $? -eq 0 ]; then
    echo -e "${GREEN}CloudFormation stack deployed successfully!${NC}"
else
    echo -e "${RED}CloudFormation deployment failed!${NC}"
    exit 1
fi
echo ""

# Get stack outputs
echo -e "${GREEN}Step 5: Getting stack outputs...${NC}"

API_URL=$(aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
    --output text \
    --region ${AWS_REGION})

FILE_BUCKET=$(aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --query "Stacks[0].Outputs[?OutputKey=='FileStorageBucketName'].OutputValue" \
    --output text \
    --region ${AWS_REGION})

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}API Endpoint:${NC} ${API_URL}"
echo -e "${YELLOW}File Storage Bucket:${NC} ${FILE_BUCKET}"
echo ""
echo -e "Update your web app's .env file with:"
echo -e "${YELLOW}VITE_API_URL=${API_URL}${NC}"
echo ""
echo -e "${GREEN}Next steps:${NC}"
echo "1. Update web/.env with the API URL above"
echo "2. Deploy your frontend to a hosting service (Vercel, Netlify, etc.)"
echo "3. Test the integration"
echo ""
