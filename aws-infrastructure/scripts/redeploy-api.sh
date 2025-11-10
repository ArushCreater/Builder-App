#!/bin/bash

# Script to force API Gateway redeployment
# Run this after CloudFormation deployment completes if you're still getting CORS errors

set -e

ENVIRONMENT=${1:-dev}
STACK_NAME="buildertrend-${ENVIRONMENT}"
AWS_REGION=${AWS_REGION:-us-east-1}

echo "Getting API Gateway ID from CloudFormation stack..."
API_ID=$(aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
    --output text \
    --region ${AWS_REGION} | grep -oP 'https://\K[^.]+')

if [ -z "$API_ID" ]; then
    echo "Error: Could not find API Gateway ID"
    exit 1
fi

echo "API Gateway ID: ${API_ID}"
echo "Forcing redeployment to ${ENVIRONMENT} stage..."

# Create a new deployment
DEPLOYMENT_ID=$(aws apigateway create-deployment \
    --rest-api-id ${API_ID} \
    --stage-name ${ENVIRONMENT} \
    --description "Manual redeployment to fix CORS - $(date)" \
    --region ${AWS_REGION} \
    --query 'id' \
    --output text)

echo "Deployment ID: ${DEPLOYMENT_ID}"
echo ""
echo "API Gateway has been redeployed!"
echo "Wait 10-20 seconds, then refresh your web app and try again."
echo "The CORS errors should be fixed now."
