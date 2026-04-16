#!/bin/bash
# Deploy Script for Sedaily-MBTI Backend
# Builds and deploys Lambda functions for MBTI news style transformation
#
# Usage:
#   ./deploy.sh           — Deploy all functions
#   ./deploy.sh pipeline  — Deploy pipeline functions only
#   ./deploy.sh api       — Deploy API functions only

set -e

DEPLOY_TARGET="${1:-all}"

echo "Starting Sedaily-MBTI Backend Deployment (target: $DEPLOY_TARGET)..."
echo ""

# ============================================
# Step 1: Build Lambda Package
# ============================================
echo "Building Lambda package..."

# Clean previous builds
rm -rf lambda-build lambda_package.zip
mkdir lambda-build

# Install dependencies for Linux (Lambda runtime)
# Only runtime deps — no pytest, no fastapi/uvicorn (dev-only)
echo "  -> Installing runtime dependencies for Linux (Python 3.11)..."
pip3 install \
  httpx==0.27.0 \
  python-dotenv==1.0.1 \
  requests==2.32.3 \
  beautifulsoup4==4.12.3 \
  opensearch-py==2.4.2 \
  requests-aws4auth==1.3.1 \
  pg8000==1.31.2 \
  -t lambda-build \
  --platform manylinux2014_x86_64 \
  --python-version 3.11 \
  --only-binary=:all: \
  --upgrade \
  --no-cache-dir \
  --quiet

# Copy source code modules
echo "  -> Copying source code..."
for dir in clients handlers config core models repositories services utils; do
  if [ -d "$dir" ]; then
    echo "    -> $dir/"
    cp -r "$dir" lambda-build/
  fi
done

# Copy prompt files (needed by MbtiTransformService)
if [ -d "prompts" ]; then
  echo "    -> prompts/"
  cp -r prompts lambda-build/
fi

# Copy legacy prompt file (fallback)
if [ -f "MBTI_TRANSFORM_PROMPT.md" ]; then
  cp MBTI_TRANSFORM_PROMPT.md lambda-build/
fi

# Remove files that should NOT be in the Lambda package
echo "  -> Cleaning up unnecessary files..."
find lambda-build -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find lambda-build -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
find lambda-build -type f -name "*.pyc" -delete 2>/dev/null || true
# infrastructure/ is NOT copied (only used for CloudFormation/Step Functions)

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

# --- API Functions (existing + new) ---
API_FUNCTIONS=(
  "sedaily-mbti-article-collector-dev"
  "sedaily-mbti-search-dev"
  "sedaily-mbti-article-dev"
  "sedaily-mbti-chatbot-dev"
  "sedaily-mbti-engagement-dev"
  "sedaily-mbti-tts-dev"
  "sedaily-mbti-time-machine-dev"
  "sedaily-mbti-s3-articles-dev"
  "sedaily-mbti-user-dev"
  "sedaily-mbti-archive-dev"
  "sedaily-mbti-podcast-dev"
  "sedaily-mbti-recommend-dev"
  "sedaily-mbti-post-dev"
  "sedaily-mbti-question-dev"
  "sedaily-mbti-metrics-dev"
  "sedaily-mbti-abtest-dev"
  "sedaily-mbti-translation-dev"
  "sedaily-mbti-briefing-dev"
)

# --- Pipeline Functions (Step Functions) ---
# Note: merge Lambda was removed when the state machine was rewritten to use a
# chained Map (each iteration runs Step3 → Step4 → Supervisor for one article).
PIPELINE_FUNCTIONS=(
  "sedaily-mbti-pipeline-step1-dev"
  "sedaily-mbti-pipeline-step2-dev"
  "sedaily-mbti-pipeline-step3-dev"
  "sedaily-mbti-pipeline-step4-dev"
  "sedaily-mbti-pipeline-supervisor-dev"
)

# Select which functions to deploy
case "$DEPLOY_TARGET" in
  pipeline)
    FUNCTIONS=("${PIPELINE_FUNCTIONS[@]}")
    ;;
  api)
    FUNCTIONS=("${API_FUNCTIONS[@]}")
    ;;
  all)
    FUNCTIONS=("${API_FUNCTIONS[@]}" "${PIPELINE_FUNCTIONS[@]}")
    ;;
  *)
    echo "Unknown target: $DEPLOY_TARGET (use: all, api, pipeline)"
    exit 1
    ;;
esac

# Update each function
SUCCESS_COUNT=0
FAIL_COUNT=0

for FUNCTION_NAME in "${FUNCTIONS[@]}"; do
  echo "  -> Updating $FUNCTION_NAME..."

  if aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --s3-bucket sedaily-mbti-lambda-packages-dev \
    --s3-key lambda_package.zip \
    --region us-east-1 \
    --output json \
    --query 'LastModified' \
    > /dev/null 2>&1; then
    echo "    [OK] Updated"
    ((SUCCESS_COUNT++))
  else
    echo "    [SKIP] Function not found or update failed"
    ((FAIL_COUNT++))
  fi
done

echo ""
echo "[DONE] Deployment complete! ($SUCCESS_COUNT updated, $FAIL_COUNT skipped)"
echo ""
echo "Monitoring commands:"
echo "  -> Article Collector:"
echo "     aws logs tail /aws/lambda/sedaily-mbti-article-collector-dev --follow"
echo "  -> Pipeline Step 1:"
echo "     aws logs tail /aws/lambda/sedaily-mbti-pipeline-step1-dev --follow"
echo "  -> Chatbot:"
echo "     aws logs tail /aws/lambda/sedaily-mbti-chatbot-dev --follow"
echo "  -> Archive:"
echo "     aws logs tail /aws/lambda/sedaily-mbti-archive-dev --follow"
echo "  -> Briefing Generator logs:"
echo "     aws logs tail /aws/lambda/sedaily-mbti-briefing-dev --follow"
echo ""
