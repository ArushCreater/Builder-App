#!/bin/bash

# Script to update just the authorizer Lambda function
# This is faster than full CloudFormation deployment

set -e

ENVIRONMENT=${1:-dev}
AWS_REGION=${AWS_REGION:-us-east-1}
STACK_NAME="buildertrend-${ENVIRONMENT}"

echo "========================================"
echo "Update Authorizer Lambda Function"
echo "========================================"
echo ""

# Get AWS Account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
if [ -z "$ACCOUNT_ID" ]; then
    echo "ERROR: Failed to get AWS credentials. Run 'aws configure' first."
    exit 1
fi

echo "AWS Account ID: ${ACCOUNT_ID}"

DEPLOYMENT_BUCKET="buildertrend-deployment-${ENVIRONMENT}-${ACCOUNT_ID}"

# Get paths
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
LAMBDA_DIR="${INFRA_DIR}/lambda"
AUTHORIZER_DIR="${LAMBDA_DIR}/authorizer"
BUILD_DIR="$(dirname "$INFRA_DIR")/build"

# Create build directory if needed
mkdir -p "${BUILD_DIR}"

# Navigate to authorizer Lambda directory
cd "${AUTHORIZER_DIR}"

echo "Step 1: Installing dependencies..."
npm install --production --silent

echo "Step 2: Packaging Lambda function..."
ZIP_FILE="${BUILD_DIR}/authorizer.zip"

# Remove old zip if exists
rm -f "${ZIP_FILE}"

# Create zip file
zip -r "${ZIP_FILE}" . -x "*.git*" "node_modules/aws-sdk/*" > /dev/null

echo "Step 3: Uploading to S3..."
aws s3 cp "${ZIP_FILE}" "s3://${DEPLOYMENT_BUCKET}/functions/authorizer.zip"

echo "Step 4: Getting Lambda function name..."
FUNCTION_NAME=$(aws cloudformation describe-stack-resources \
    --stack-name ${STACK_NAME} \
    --logical-resource-id AuthorizerFunction \
    --query 'StackResources[0].PhysicalResourceId' \
    --output text \
    --region ${AWS_REGION})

if [ -z "$FUNCTION_NAME" ]; then
    echo "ERROR: Could not find Authorizer Lambda function"
    exit 1
fi

echo "Function Name: ${FUNCTION_NAME}"

echo "Step 5: Updating Lambda function code..."
aws lambda update-function-code \
    --function-name ${FUNCTION_NAME} \
    --s3-bucket ${DEPLOYMENT_BUCKET} \
    --s3-key "functions/authorizer.zip" \
    --region ${AWS_REGION} > /dev/null

echo ""
echo "========================================"
echo "Authorizer Lambda Updated Successfully!"
echo "========================================"
echo ""
echo "The authorizer has been updated with the fixed policy generation."
echo "Wait 5-10 seconds for Lambda to update, then try accessing the API."
echo ""
