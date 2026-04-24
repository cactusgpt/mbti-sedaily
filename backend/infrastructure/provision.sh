#!/bin/bash
# =============================================================================
# AI LENS Backend — AWS Resource Provisioning Script
# =============================================================================
#
# Creates all new AWS resources for the redesigned backend:
#   - 2 S3 buckets (article body, audio)
#   - 2 DynamoDB tables (personal, podcast)
#   - 9 Lambda functions (3 API + 6 pipeline)
#   - 1 Step Functions state machine
#   - 1 EventBridge schedule rule
#
# Prerequisites:
#   - AWS CLI configured with appropriate credentials
#   - Existing Lambda role: sedaily-mbti-lambda-role
#   - Lambda package already uploaded: s3://sedaily-mbti-lambda-packages-dev/lambda_package.zip
#     (run deploy.sh first)
#
# Usage:
#   ./provision.sh                    # Create all resources
#   ./provision.sh --dry-run          # Print commands without executing
#
# Does NOT provision (Phase 2 — requires AWS engineer):
#   - OpenSearch domain
#   - RDS PostgreSQL + pgvector
# =============================================================================

set -e

REGION="us-east-1"
DRY_RUN=false

if [ "$1" = "--dry-run" ]; then
  DRY_RUN=true
  echo "============================================"
  echo "  DRY RUN — commands will be printed only"
  echo "============================================"
  echo ""
fi

# ── Resolve AWS Account ID ───────────────────────────────────────────────────

if [ "$DRY_RUN" = true ]; then
  AWS_ACCOUNT_ID="\${AWS_ACCOUNT_ID}"
  echo "[dry-run] AWS_ACCOUNT_ID will be resolved at runtime"
else
  AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
  echo "AWS Account: $AWS_ACCOUNT_ID"
fi

LAMBDA_ROLE="arn:aws:iam::${AWS_ACCOUNT_ID}:role/sedaily-mbti-lambda-role"
LAMBDA_CODE="S3Bucket=sedaily-mbti-lambda-packages-dev,S3Key=lambda_package.zip"
SFN_ROLE="arn:aws:iam::${AWS_ACCOUNT_ID}:role/sedaily-mbti-stepfunctions-role"
EB_ROLE="arn:aws:iam::${AWS_ACCOUNT_ID}:role/sedaily-mbti-eventbridge-role"

run() {
  if [ "$DRY_RUN" = true ]; then
    echo "[dry-run] $*"
  else
    echo "  -> $1 ..."
    eval "$*"
  fi
}

echo ""
echo "============================================"
echo "  AI LENS Backend Provisioning"
echo "============================================"
echo ""

# =============================================================================
# 1. S3 BUCKETS
# =============================================================================
echo "── 1. S3 Buckets ──────────────────────────────────────────"

# Article body storage (split from DynamoDB)
# Stores: articles/{news_id}/body.json
# Contains: content_ko, content_raw, content_blocks, version_NT/NF/ST/SF
echo ""
echo "[1.1] sedaily-mbti-article-body-dev (article body JSON)"
run aws s3api create-bucket \
  --bucket sedaily-mbti-article-body-dev \
  --region $REGION

# Block public access on article body bucket
run aws s3api put-public-access-block \
  --bucket sedaily-mbti-article-body-dev \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# Audio file storage (podcast/TTS)
# Stores: podcasts/{podcast_id}.mp3
# Accessed via presigned URLs (1-hour expiry)
echo ""
echo "[1.2] sedaily-mbti-audio-dev (podcast/TTS audio)"
run aws s3api create-bucket \
  --bucket sedaily-mbti-audio-dev \
  --region $REGION

run aws s3api put-public-access-block \
  --bucket sedaily-mbti-audio-dev \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

echo ""
echo "  [OK] S3 buckets created"
echo ""

# =============================================================================
# 2. DYNAMODB TABLES
# =============================================================================
echo "── 2. DynamoDB Tables ─────────────────────────────────────"

# Personal DB — user profiles, archived sentences, reading history
# PK: user_id (S), SK: sk (S)
# SK patterns: PROFILE, ARCHIVE#{article_id}#{timestamp}, READING#{article_id}
echo ""
echo "[2.1] sedaily-mbti-personal-dev (user data)"
run aws dynamodb create-table \
  --table-name sedaily-mbti-personal-dev \
  --attribute-definitions \
    "AttributeName=user_id,AttributeType=S" \
    "AttributeName=sk,AttributeType=S" \
  --key-schema \
    "AttributeName=user_id,KeyType=HASH" \
    "AttributeName=sk,KeyType=RANGE" \
  --billing-mode PAY_PER_REQUEST \
  --region $REGION

# Podcast DB — podcast episode metadata
# PK: podcast_id (S)  — format: podcast_{news_id}_{mbti_group}_{timestamp}
# GSI: date-index for listing podcasts by date
echo ""
echo "[2.2] sedaily-mbti-podcast-dev (podcast metadata)"
run aws dynamodb create-table \
  --table-name sedaily-mbti-podcast-dev \
  --attribute-definitions \
    "AttributeName=podcast_id,AttributeType=S" \
    "AttributeName=created_date,AttributeType=S" \
  --key-schema \
    "AttributeName=podcast_id,KeyType=HASH" \
  --global-secondary-indexes \
    "'[{
      \"IndexName\": \"date-index\",
      \"KeySchema\": [
        {\"AttributeName\": \"created_date\", \"KeyType\": \"HASH\"},
        {\"AttributeName\": \"podcast_id\", \"KeyType\": \"RANGE\"}
      ],
      \"Projection\": {\"ProjectionType\": \"ALL\"}
    }]'" \
  --billing-mode PAY_PER_REQUEST \
  --region $REGION

echo ""

# Wait for tables to become active
if [ "$DRY_RUN" = false ]; then
  echo "  Waiting for tables to become ACTIVE..."
  aws dynamodb wait table-exists --table-name sedaily-mbti-personal-dev --region $REGION
  aws dynamodb wait table-exists --table-name sedaily-mbti-podcast-dev --region $REGION
  echo "  [OK] DynamoDB tables active"
else
  echo "[dry-run] Would wait for table-exists"
fi
echo ""

# =============================================================================
# 3. LAMBDA FUNCTIONS — API
# =============================================================================
echo "── 3. Lambda Functions (API) ──────────────────────────────"

create_lambda() {
  local NAME=$1
  local HANDLER=$2
  local MEMORY=${3:-512}
  local TIMEOUT=${4:-300}

  echo ""
  echo "[Lambda] $NAME"
  echo "         handler: $HANDLER"
  echo "         memory: ${MEMORY}MB, timeout: ${TIMEOUT}s"

  run aws lambda create-function \
    --function-name "$NAME" \
    --runtime python3.11 \
    --handler "$HANDLER" \
    --role "$LAMBDA_ROLE" \
    --code "$LAMBDA_CODE" \
    --timeout "$TIMEOUT" \
    --memory-size "$MEMORY" \
    --region $REGION \
    --environment "Variables={AWS_REGION=$REGION,DYNAMODB_TABLE_ARTICLES=sedaily-mbti-articles-dev,DYNAMODB_TABLE_PERSONAL=sedaily-mbti-personal-dev,DYNAMODB_TABLE_PODCAST=sedaily-mbti-podcast-dev,S3_ARTICLE_BODY_BUCKET=sedaily-mbti-article-body-dev,S3_AUDIO_BUCKET=sedaily-mbti-audio-dev}"
}

# Archive (내 서랍) — sentence archiving with pgvector similarity
create_lambda \
  "sedaily-mbti-archive-dev" \
  "handlers.archive_handler.lambda_handler" \
  512 300

# Podcast — audio generation (Bedrock script + Polly TTS + S3 upload)
create_lambda \
  "sedaily-mbti-podcast-dev" \
  "handlers.podcast_handler.lambda_handler" \
  512 300

# Recommendations — personalized article recommendations + DNA analysis
create_lambda \
  "sedaily-mbti-recommend-dev" \
  "handlers.recommendation_handler.lambda_handler" \
  512 300

echo ""
echo "  [OK] API Lambda functions created"
echo ""

# =============================================================================
# 4. LAMBDA FUNCTIONS — PIPELINE (Step Functions)
# =============================================================================
echo "── 4. Lambda Functions (Pipeline) ─────────────────────────"

# Step 1: Article selection — rule-based + Nova AI filtering
create_lambda \
  "sedaily-mbti-pipeline-step1-dev" \
  "handlers.pipeline.step1_select.lambda_handler" \
  512 300

# Step 2: MBTI classification — Nova categorization + allocation
create_lambda \
  "sedaily-mbti-pipeline-step2-dev" \
  "handlers.pipeline.step2_classify.lambda_handler" \
  256 300

# Step 3: Tone & manner transformation — Claude 4-version rewriting
# Higher memory: Claude responses can be large (8192 tokens output)
create_lambda \
  "sedaily-mbti-pipeline-step3-dev" \
  "handlers.pipeline.step3_transform.lambda_handler" \
  1024 300

# Step 4: Quality validation — Nova spelling/grammar/style checks
create_lambda \
  "sedaily-mbti-pipeline-step4-dev" \
  "handlers.pipeline.step4_validate.lambda_handler" \
  256 300

# Supervisor: final gate + storage + vector indexing
# Higher memory: writes to DynamoDB + S3 + OpenSearch + pgvector
create_lambda \
  "sedaily-mbti-pipeline-supervisor-dev" \
  "handlers.pipeline.supervisor.lambda_handler" \
  1024 300

# Merge: concatenate parallel step3 batch results (lightweight)
create_lambda \
  "sedaily-mbti-pipeline-merge-dev" \
  "handlers.pipeline.merge_transform_results.lambda_handler" \
  128 30

echo ""
echo "  [OK] Pipeline Lambda functions created"
echo ""

# =============================================================================
# 5. STEP FUNCTIONS STATE MACHINE
# =============================================================================
echo "── 5. Step Functions State Machine ────────────────────────"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SFN_DEF_FILE="$SCRIPT_DIR/step_functions_definition.json"

if [ ! -f "$SFN_DEF_FILE" ]; then
  echo "  [WARN] $SFN_DEF_FILE not found — skipping Step Functions"
else
  echo ""
  echo "[5.1] Creating state machine: sedaily-mbti-transform-pipeline-dev"

  if [ "$DRY_RUN" = true ]; then
    echo "[dry-run] Would substitute \${AWS_ACCOUNT_ID} in $SFN_DEF_FILE"
    echo "[dry-run] aws stepfunctions create-state-machine ..."
  else
    # Substitute account ID placeholder
    SFN_TEMP=$(mktemp)
    sed "s/\${AWS_ACCOUNT_ID}/$AWS_ACCOUNT_ID/g" "$SFN_DEF_FILE" > "$SFN_TEMP"

    aws stepfunctions create-state-machine \
      --name sedaily-mbti-transform-pipeline-dev \
      --definition "file://$SFN_TEMP" \
      --role-arn "$SFN_ROLE" \
      --region $REGION \
      --type STANDARD

    rm -f "$SFN_TEMP"
    echo "  [OK] State machine created"
  fi
fi
echo ""

# =============================================================================
# 6. EVENTBRIDGE SCHEDULE
# =============================================================================
echo "── 6. EventBridge Schedule ────────────────────────────────"

# Daily trigger at 07:00 KST = 22:00 UTC (previous day)
echo ""
echo "[6.1] Schedule rule: sedaily-mbti-pipeline-schedule-dev (daily 07:00 KST)"

run aws events put-rule \
  --name sedaily-mbti-pipeline-schedule-dev \
  --schedule-expression "'cron(0 22 * * ? *)'" \
  --state ENABLED \
  --region $REGION

# Connect schedule to Step Functions
echo ""
echo "[6.2] Connecting schedule to state machine"

if [ "$DRY_RUN" = true ]; then
  echo "[dry-run] aws events put-targets --rule sedaily-mbti-pipeline-schedule-dev ..."
else
  SFN_ARN="arn:aws:states:$REGION:$AWS_ACCOUNT_ID:stateMachine:sedaily-mbti-transform-pipeline-dev"

  aws events put-targets \
    --rule sedaily-mbti-pipeline-schedule-dev \
    --targets "[{
      \"Id\": \"pipeline-trigger\",
      \"Arn\": \"$SFN_ARN\",
      \"RoleArn\": \"$EB_ROLE\",
      \"Input\": \"{\\\"date\\\": null, \\\"source\\\": \\\"schedule\\\"}\"
    }]" \
    --region $REGION
fi

echo ""
echo "  [OK] EventBridge schedule configured"
echo ""

# =============================================================================
# SUMMARY
# =============================================================================
echo "============================================"
echo "  Provisioning Complete!"
echo "============================================"
echo ""
echo "Resources created:"
echo "  S3 Buckets:       2 (article-body, audio)"
echo "  DynamoDB Tables:  2 (personal, podcast)"
echo "  Lambda Functions: 9 (3 API + 6 pipeline)"
echo "  Step Functions:   1 (transform-pipeline)"
echo "  EventBridge:      1 (daily 07:00 KST schedule)"
echo ""
echo "Next steps:"
echo "  1. Run deploy.sh to upload latest Lambda code"
echo "  2. Configure API Gateway routes for new Lambda functions"
echo "  3. Test pipeline: aws stepfunctions start-execution \\"
echo "       --state-machine-arn arn:aws:states:$REGION:$AWS_ACCOUNT_ID:stateMachine:sedaily-mbti-transform-pipeline-dev \\"
echo "       --input '{\"date\": \"$(date -u +%Y%m%d)\", \"source\": \"manual\"}'"
echo ""
echo "Phase 2 (not provisioned yet — requires AWS engineer):"
echo "  - OpenSearch domain (RAG hybrid search)"
echo "  - RDS PostgreSQL + pgvector extension (similarity search)"
echo ""

# =============================================================================
# CLEANUP COMMANDS (uncomment to tear down)
# =============================================================================
# echo "Tearing down resources..."
#
# # EventBridge
# aws events remove-targets --rule sedaily-mbti-pipeline-schedule-dev --ids pipeline-trigger --region $REGION
# aws events delete-rule --name sedaily-mbti-pipeline-schedule-dev --region $REGION
#
# # Step Functions
# aws stepfunctions delete-state-machine \
#   --state-machine-arn arn:aws:states:$REGION:$AWS_ACCOUNT_ID:stateMachine:sedaily-mbti-transform-pipeline-dev
#
# # Lambda — Pipeline
# aws lambda delete-function --function-name sedaily-mbti-pipeline-step1-dev --region $REGION
# aws lambda delete-function --function-name sedaily-mbti-pipeline-step2-dev --region $REGION
# aws lambda delete-function --function-name sedaily-mbti-pipeline-step3-dev --region $REGION
# aws lambda delete-function --function-name sedaily-mbti-pipeline-step4-dev --region $REGION
# aws lambda delete-function --function-name sedaily-mbti-pipeline-supervisor-dev --region $REGION
# aws lambda delete-function --function-name sedaily-mbti-pipeline-merge-dev --region $REGION
#
# # Lambda — API
# aws lambda delete-function --function-name sedaily-mbti-archive-dev --region $REGION
# aws lambda delete-function --function-name sedaily-mbti-podcast-dev --region $REGION
# aws lambda delete-function --function-name sedaily-mbti-recommend-dev --region $REGION
#
# # DynamoDB (WARNING: deletes all data)
# aws dynamodb delete-table --table-name sedaily-mbti-personal-dev --region $REGION
# aws dynamodb delete-table --table-name sedaily-mbti-podcast-dev --region $REGION
#
# # S3 (must empty buckets first)
# aws s3 rm s3://sedaily-mbti-article-body-dev --recursive
# aws s3api delete-bucket --bucket sedaily-mbti-article-body-dev --region $REGION
# aws s3 rm s3://sedaily-mbti-audio-dev --recursive
# aws s3api delete-bucket --bucket sedaily-mbti-audio-dev --region $REGION
#
# echo "Teardown complete."
