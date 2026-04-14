#!/bin/bash
# Deploy Script for Sedaily-MBTI Backend
# Builds and deploys Lambda functions for MBTI news style transformation

set -e

echo "Starting Sedaily-MBTI Backend Deployment..."
echo ""

# ============================================
# Step 1: Build Lambda Package
# ============================================
echo "Building Lambda package..."

# Clean previous builds
rm -rf lambda-build lambda_package.zip
mkdir lambda-build

# Install dependencies for Linux (Lambda runtime)
echo "  -> Installing dependencies for Linux (Python 3.11)..."
pip3 install \
  httpx==0.27.0 \
  pydantic==2.10.0 \
  pydantic-settings==2.6.0 \
  python-dotenv==1.0.1 \
  requests==2.32.3 \
  beautifulsoup4==4.12.3 \
  redis \
  -t lambda-build \
  --platform manylinux2014_x86_64 \
  --python-version 3.11 \
  --only-binary=:all: \
  --upgrade \
  --no-cache-dir \
  --quiet

# Copy source code
echo "  -> Copying source code..."
cp -r clients handlers utils prompts MBTI_TRANSFORM_PROMPT.md lambda-build/

# Copy refactored modules
for dir in config core models repositories services; do
  if [ -d "$dir" ]; then
    echo "  -> Copying $dir module..."
    cp -r "$dir" lambda-build/
  fi
done

# Create ZIP package
echo "  -> Creating ZIP package..."
cd lambda-build
zip -r ../lambda_package.zip . -q
cd ..

# Cleanup build directory
rm -rf lambda-build

# Get package size
PACKAGE_SIZE=$(du -h lambda_package.zip | cut -f1)
echo "  [OK] Package created: lambda_package.zip ($PACKAGE_SIZE)"
echo ""

# ============================================
# Step 2: Upload to S3
# ============================================
echo "Uploading to S3..."
aws s3 cp lambda_package.zip s3://sedaily-mbti-lambda-packages-dev/ --quiet
echo "  [OK] Uploaded to s3://sedaily-mbti-lambda-packages-dev/lambda_package.zip"
echo ""

# ============================================
# Step 3: Update Lambda Functions
# ============================================
echo "Updating Lambda functions..."

# Define MBTI Lambda functions to update
LAMBDA_FUNCTIONS=(
  "sedaily-mbti-article-collector-dev"
  "sedaily-mbti-search-dev"
  "sedaily-mbti-article-dev"
  "sedaily-mbti-chatbot-dev"
  "sedaily-mbti-engagement-dev"
  "sedaily-mbti-tts-dev"
  "sedaily-mbti-time-machine-dev"
  "sedaily-mbti-s3-articles-dev"
  "sedaily-mbti-briefing-dev"
)

# Update each function
for FUNCTION_NAME in "${LAMBDA_FUNCTIONS[@]}"; do
  echo "  -> Updating $FUNCTION_NAME..."

  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --s3-bucket sedaily-mbti-lambda-packages-dev \
    --s3-key lambda_package.zip \
    --region us-east-1 \
    --output json \
    --query 'LastModified' \
    > /dev/null

  echo "    [OK] Updated successfully"
done

echo ""
echo "[DONE] Deployment complete!"
echo ""
echo "Monitoring commands:"
echo "  -> Article Collector logs:"
echo "     aws logs tail /aws/lambda/sedaily-mbti-article-collector-dev --follow"
echo "  -> Search API logs:"
echo "     aws logs tail /aws/lambda/sedaily-mbti-search-dev --follow"
echo "  -> Article API logs:"
echo "     aws logs tail /aws/lambda/sedaily-mbti-article-dev --follow"
echo "  -> Chatbot API logs:"
echo "     aws logs tail /aws/lambda/sedaily-mbti-chatbot-dev --follow"
echo "  -> Briefing Generator logs:"
echo "     aws logs tail /aws/lambda/sedaily-mbti-briefing-dev --follow"
echo ""
