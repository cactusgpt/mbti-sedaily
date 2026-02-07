#!/bin/bash

# S3 + CloudFront Deploy Script for MBTI News Service
# Usage: ./deploy-s3.sh

set -e

# Configuration
S3_BUCKET="sedaily-mbti-frontend-dev"
CLOUDFRONT_DISTRIBUTION_ID="E1QS7PY350VHF6"
AWS_REGION="us-east-1"

echo "=========================================="
echo "MBTI News Service - S3/CloudFront Deploy"
echo "=========================================="

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "Error: AWS CLI is not installed"
    exit 1
fi

# Build the project
echo ""
echo "1. Building project..."
npm run build

# Check if build was successful
if [ ! -d "dist" ]; then
    echo "Error: Build failed - dist directory not found"
    exit 1
fi

echo "Build completed successfully!"

# Sync to S3
echo ""
echo "2. Uploading to S3..."
aws s3 sync dist/ "s3://${S3_BUCKET}" \
    --delete \
    --cache-control "public, max-age=31536000" \
    --region "${AWS_REGION}"

# Set proper cache control for index.html (no cache)
echo ""
echo "3. Setting cache headers for index.html..."
aws s3 cp "s3://${S3_BUCKET}/index.html" "s3://${S3_BUCKET}/index.html" \
    --cache-control "no-cache, no-store, must-revalidate" \
    --content-type "text/html" \
    --metadata-directive REPLACE \
    --region "${AWS_REGION}"

# Invalidate CloudFront cache
if [ -n "$CLOUDFRONT_DISTRIBUTION_ID" ]; then
    echo ""
    echo "4. Invalidating CloudFront cache..."
    aws cloudfront create-invalidation \
        --distribution-id "${CLOUDFRONT_DISTRIBUTION_ID}" \
        --paths "/*" \
        --region "${AWS_REGION}"
    echo "CloudFront invalidation created!"
else
    echo ""
    echo "4. Skipping CloudFront invalidation (no distribution ID configured)"
fi

echo ""
echo "=========================================="
echo "Deployment completed successfully!"
echo "=========================================="
echo ""
echo "S3 Bucket: ${S3_BUCKET}"
echo "Region: ${AWS_REGION}"
if [ -n "$CLOUDFRONT_DISTRIBUTION_ID" ]; then
    echo "CloudFront Distribution: ${CLOUDFRONT_DISTRIBUTION_ID}"
fi
echo ""
