#!/bin/bash
# Deploy script for AI LENS v2 Lambda functions.
#
# v2 handlers import v1 modules (`from clients.xxx`, `from core.xxx`), so this
# script bundles the full v1 source tree plus `v2/` into one zip. A distinct
# S3 key (`lambda_package_v2.zip`) keeps v1 and v2 artifacts separate.
#
# IMPORTANT: per backend/v2/.clauderules #4, this script does NOT create
# Lambda functions, API Gateway routes, IAM roles, or env vars. It only runs
# `update-function-code` on functions that already exist (rule #6). Functions
# not found in AWS are reported as SKIP.
#
# Run from backend/:
#   cd backend
#   ./v2/deploy-v2.sh                  — all registered v2 functions
#   ./v2/deploy-v2.sh api              — /api/v2/* handlers (health, ...)
#   ./v2/deploy-v2.sh collector        — Core 1 (TASK-2.1+)
#   ./v2/deploy-v2.sh transform        — Core 2 (TASK-2.3+)
#   ./v2/deploy-v2.sh personalization  — Core 3 (TASK-3.4+)
#   ./v2/deploy-v2.sh chat-agent       — defers to Docker/ECR path (Phase 4)

set -e

DEPLOY_TARGET="${1:-all}"

# ============================================
# Configuration
# ============================================
BUILD_DIR="lambda-build-v2"
PACKAGE_FILE="lambda_package_v2.zip"
S3_BUCKET="sedaily-mbti-lambda-packages-dev"
S3_KEY="lambda_package_v2.zip"
AWS_REGION="us-east-1"

# ============================================
# Function lists (append here as new TASKs land)
# ============================================
API_V2_FUNCTIONS=(
  "sedaily-mbti-v2-health-dev"
)

CORE1_FUNCTIONS=()  # TASK-2.1 → sedaily-mbti-v2-collector-dev
CORE2_FUNCTIONS=()  # TASK-2.3 → transform, validator
CORE3_FUNCTIONS=()  # TASK-3.4 → feed, article, event, consolidation

# chat-agent deploys via Docker + ECR + agentcore CLI — not in this list.

# ============================================
# Target resolution
# ============================================
case "$DEPLOY_TARGET" in
  api)
    FUNCTIONS=("${API_V2_FUNCTIONS[@]}")
    ;;
  collector)
    FUNCTIONS=("${CORE1_FUNCTIONS[@]}")
    ;;
  transform)
    FUNCTIONS=("${CORE2_FUNCTIONS[@]}")
    ;;
  personalization)
    FUNCTIONS=("${CORE3_FUNCTIONS[@]}")
    ;;
  chat-agent)
    echo "Chat Agent deploys via Docker build + ECR push + agentcore CLI."
    echo "See backend/v2/agents/chat_agent/deploy.sh (TASK-4.2)."
    exit 0
    ;;
  all)
    FUNCTIONS=(
      "${API_V2_FUNCTIONS[@]}"
      "${CORE1_FUNCTIONS[@]}"
      "${CORE2_FUNCTIONS[@]}"
      "${CORE3_FUNCTIONS[@]}"
    )
    ;;
  *)
    echo "Unknown target: $DEPLOY_TARGET"
    echo "Use: all | api | collector | transform | personalization | chat-agent"
    exit 1
    ;;
esac

if [ ${#FUNCTIONS[@]} -eq 0 ]; then
  echo "No v2 functions registered for target '$DEPLOY_TARGET' yet."
  echo "(Skipping build/upload — nothing to deploy.)"
  exit 0
fi

echo "Starting Sedaily-MBTI v2 Lambda Deployment (target: $DEPLOY_TARGET)..."
echo ""

# ============================================
# Step 1: Build Lambda package
# ============================================
echo "Building Lambda package..."

rm -rf "$BUILD_DIR" "$PACKAGE_FILE"
mkdir "$BUILD_DIR"

# Install runtime dependencies for Lambda (Linux, Python 3.11).
# Same pins as v1 deploy.sh because v2 handlers import v1 modules.
# TODO(TASK-4.1): add `mcp==<pin>` when Chat Agent work starts.
echo "  -> Installing runtime dependencies for Linux (Python 3.11)..."
pip3 install \
  httpx==0.27.0 \
  python-dotenv==1.0.1 \
  requests==2.32.3 \
  beautifulsoup4==4.12.3 \
  opensearch-py==2.4.2 \
  requests-aws4auth==1.3.1 \
  pg8000==1.31.2 \
  -t "$BUILD_DIR" \
  --platform manylinux2014_x86_64 \
  --python-version 3.11 \
  --only-binary=:all: \
  --upgrade \
  --no-cache-dir \
  --quiet

# Copy v1 source modules (unchanged — v2 handlers import them).
echo "  -> Copying v1 source..."
for dir in clients handlers config core models repositories services utils; do
  if [ -d "$dir" ]; then
    echo "    -> $dir/"
    cp -r "$dir" "$BUILD_DIR/"
  fi
done

# Copy v1 prompt files (v2 may load chatbot/transform prompts via prompt_loader).
if [ -d "prompts" ]; then
  echo "    -> prompts/"
  cp -r prompts "$BUILD_DIR/"
fi

# Copy v1 legacy prompt file (fallback used by MbtiTransformService).
if [ -f "MBTI_TRANSFORM_PROMPT.md" ]; then
  cp MBTI_TRANSFORM_PROMPT.md "$BUILD_DIR/"
fi

# Copy v2 source — exclude tests, docs, build/package outputs, config files.
echo "  -> Copying v2 source..."
mkdir -p "$BUILD_DIR/v2"
rsync -a \
  --exclude='tests/' \
  --exclude='__pycache__/' \
  --exclude='*.pyc' \
  --exclude='*.md' \
  --exclude='.clauderules' \
  --exclude='.gitignore' \
  --exclude='requirements.txt' \
  --exclude='deploy-v2.sh' \
  --exclude='lambda-build-v2/' \
  --exclude='lambda_package_v2.zip' \
  v2/ "$BUILD_DIR/v2/"

# Scrub caches from anything we just copied.
find "$BUILD_DIR" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find "$BUILD_DIR" -type f -name "*.pyc" -delete 2>/dev/null || true

# Create ZIP package.
echo "  -> Creating ZIP package..."
cd "$BUILD_DIR"
zip -r "../$PACKAGE_FILE" . -q
cd ..

# Remove build dir (keep the zip for debugging; .gitignore excludes it).
rm -rf "$BUILD_DIR"

PACKAGE_SIZE=$(du -h "$PACKAGE_FILE" | cut -f1)
echo "  [OK] Package created: $PACKAGE_FILE ($PACKAGE_SIZE)"
echo ""

# ============================================
# Step 2: Upload to S3
# ============================================
echo "Uploading to S3..."
aws s3 cp "$PACKAGE_FILE" "s3://$S3_BUCKET/$S3_KEY" --region "$AWS_REGION" --quiet
echo "  [OK] Uploaded to s3://$S3_BUCKET/$S3_KEY"
echo ""

# ============================================
# Step 3: Update Lambda functions (update-function-code only)
# ============================================
echo "Updating Lambda functions..."
SUCCESS_COUNT=0
SKIP_COUNT=0

for FUNCTION_NAME in "${FUNCTIONS[@]}"; do
  echo "  -> $FUNCTION_NAME"

  if aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --s3-bucket "$S3_BUCKET" \
    --s3-key "$S3_KEY" \
    --region "$AWS_REGION" \
    --output json \
    --query 'LastModified' \
    > /dev/null 2>&1; then
    echo "    [OK] Updated"
    ((SUCCESS_COUNT++))
  else
    echo "    [SKIP] Function not found in AWS — create it manually per .clauderules #4"
    ((SKIP_COUNT++))
  fi
done

echo ""
echo "[DONE] $SUCCESS_COUNT updated, $SKIP_COUNT skipped."
echo ""
echo "Monitoring (once the function exists):"
echo "  aws logs tail /aws/lambda/sedaily-mbti-v2-health-dev --follow --region $AWS_REGION"
