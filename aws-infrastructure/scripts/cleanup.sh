#!/bin/bash

# Cleanup leftover resources from failed CloudFormation deployment
# Run this before re-deploying if the previous deployment failed

set +e  # Don't exit on errors

ENVIRONMENT=${1:-dev}

echo "======================================"
echo "Cleaning up leftover resources"
echo "Environment: $ENVIRONMENT"
echo "======================================"
echo ""

# Check and delete IAM role
echo "Checking for leftover IAM role..."
if aws iam get-role --role-name buildertrend-lambda-role-${ENVIRONMENT} &>/dev/null; then
    echo "Found existing IAM role. Cleaning up..."

    # Detach managed policies
    ATTACHED_POLICIES=$(aws iam list-attached-role-policies \
        --role-name buildertrend-lambda-role-${ENVIRONMENT} \
        --query 'AttachedPolicies[].PolicyArn' \
        --output text)

    if [ ! -z "$ATTACHED_POLICIES" ]; then
        for policy in $ATTACHED_POLICIES; do
            echo "  Detaching policy: $policy"
            aws iam detach-role-policy \
                --role-name buildertrend-lambda-role-${ENVIRONMENT} \
                --policy-arn $policy
        done
    fi

    # Delete inline policies
    INLINE_POLICIES=$(aws iam list-role-policies \
        --role-name buildertrend-lambda-role-${ENVIRONMENT} \
        --query 'PolicyNames[]' \
        --output text)

    if [ ! -z "$INLINE_POLICIES" ]; then
        for policy in $INLINE_POLICIES; do
            echo "  Deleting inline policy: $policy"
            aws iam delete-role-policy \
                --role-name buildertrend-lambda-role-${ENVIRONMENT} \
                --policy-name $policy
        done
    fi

    # Delete the role
    echo "  Deleting IAM role..."
    aws iam delete-role --role-name buildertrend-lambda-role-${ENVIRONMENT}
    echo "✅ IAM role cleaned up"
else
    echo "✅ No leftover IAM role found"
fi

echo ""

# Check and delete JWT secret
echo "Checking for leftover JWT secret..."
if aws secretsmanager describe-secret --secret-id buildertrend/${ENVIRONMENT}/jwt &>/dev/null; then
    echo "Found existing JWT secret. Deleting..."
    aws secretsmanager delete-secret \
        --secret-id buildertrend/${ENVIRONMENT}/jwt \
        --force-delete-without-recovery
    echo "✅ JWT secret cleaned up"
else
    echo "✅ No leftover JWT secret found"
fi

echo ""

# Check for DynamoDB tables
echo "Checking for leftover DynamoDB tables..."
TABLES=$(aws dynamodb list-tables --query "TableNames[?contains(@, 'buildertrend') && contains(@, '${ENVIRONMENT}')]" --output text)

if [ ! -z "$TABLES" ]; then
    echo "Found existing tables:"
    for table in $TABLES; do
        echo "  - $table"
    done
    read -p "Delete these tables? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        for table in $TABLES; do
            echo "  Deleting $table..."
            aws dynamodb delete-table --table-name $table
        done
        echo "✅ Tables deleted"
    else
        echo "⚠️  Tables kept (deployment may fail if they exist)"
    fi
else
    echo "✅ No leftover DynamoDB tables found"
fi

echo ""

# Check for S3 file storage bucket
echo "Checking for file storage bucket..."
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
FILE_BUCKET="buildertrend-files-${ENVIRONMENT}-${ACCOUNT_ID}"

if aws s3 ls "s3://${FILE_BUCKET}" &>/dev/null; then
    echo "Found existing file storage bucket: $FILE_BUCKET"
    read -p "Delete this bucket and all its contents? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "  Emptying bucket..."
        aws s3 rm "s3://${FILE_BUCKET}" --recursive
        echo "  Deleting bucket..."
        aws s3 rb "s3://${FILE_BUCKET}"
        echo "✅ File storage bucket deleted"
    else
        echo "⚠️  Bucket kept (deployment may fail if it exists)"
    fi
else
    echo "✅ No leftover file storage bucket found"
fi

echo ""
echo "======================================"
echo "Cleanup complete!"
echo "======================================"
echo ""
echo "You can now run the deployment script:"
echo "  ./deploy.sh $ENVIRONMENT"
echo ""
