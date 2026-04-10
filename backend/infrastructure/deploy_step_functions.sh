#!/bin/bash
# =============================================================================
# Deploy Step Functions State Machine + EventBridge Schedule
# =============================================================================
#
# Creates or updates:
#   1. IAM role for Step Functions (sedaily-mbti-stepfunctions-role)
#   2. State machine (sedaily-mbti-transform-pipeline-dev)
#   3. EventBridge rule (daily 07:00 KST = 22:00 UTC)
#   4. EventBridge target (Step Functions)
#
# Prerequisites:
#   - All 6 pipeline Lambda functions must exist (run provision.sh first)
#   - AWS CLI configured with admin-level permissions
#
# Usage:
#   ./deploy_step_functions.sh
#   ./deploy_step_functions.sh --dry-run
# =============================================================================

set -e

REGION="us-east-1"
DRY_RUN=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ "$1" = "--dry-run" ]; then
  DRY_RUN=true
  echo "[DRY RUN]"
  echo ""
fi

# ── Resolve AWS Account ID ───────────────────────────────────────────────────

if [ "$DRY_RUN" = true ]; then
  AWS_ACCOUNT_ID="\${AWS_ACCOUNT_ID}"
else
  AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
  echo "AWS Account: $AWS_ACCOUNT_ID"
fi

SFN_ROLE_NAME="sedaily-mbti-stepfunctions-role"
SFN_ROLE_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:role/${SFN_ROLE_NAME}"
SFN_NAME="sedaily-mbti-transform-pipeline-dev"
SFN_ARN="arn:aws:states:${REGION}:${AWS_ACCOUNT_ID}:stateMachine:${SFN_NAME}"
EB_RULE="sedaily-mbti-pipeline-schedule-dev"
EB_ROLE_NAME="sedaily-mbti-eventbridge-role"
EB_ROLE_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:role/${EB_ROLE_NAME}"

echo ""

# =============================================================================
# 1. IAM ROLE FOR STEP FUNCTIONS
# =============================================================================
echo "── 1. IAM Role: ${SFN_ROLE_NAME} ──"

TRUST_POLICY='{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "states.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}'

LAMBDA_POLICY="{
  \"Version\": \"2012-10-17\",
  \"Statement\": [{
    \"Effect\": \"Allow\",
    \"Action\": \"lambda:InvokeFunction\",
    \"Resource\": \"arn:aws:lambda:${REGION}:${AWS_ACCOUNT_ID}:function:sedaily-mbti-pipeline-*-dev\"
  }]
}"

if [ "$DRY_RUN" = true ]; then
  echo "[dry-run] Would create/update role ${SFN_ROLE_NAME}"
else
  # Check if role exists
  if aws iam get-role --role-name "$SFN_ROLE_NAME" > /dev/null 2>&1; then
    echo "  Role exists — updating inline policy"
  else
    echo "  Creating role..."
    aws iam create-role \
      --role-name "$SFN_ROLE_NAME" \
      --assume-role-policy-document "$TRUST_POLICY" \
      --description "Step Functions role for MBTI transform pipeline" \
      > /dev/null

    # Wait for role propagation
    sleep 5
    echo "  Role created"
  fi

  # Attach/update inline policy
  aws iam put-role-policy \
    --role-name "$SFN_ROLE_NAME" \
    --policy-name "InvokePipelineLambdas" \
    --policy-document "$LAMBDA_POLICY"

  echo "  [OK] Policy attached"
fi

echo ""

# =============================================================================
# 2. IAM ROLE FOR EVENTBRIDGE
# =============================================================================
echo "── 2. IAM Role: ${EB_ROLE_NAME} ──"

EB_TRUST_POLICY='{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "events.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}'

EB_SFN_POLICY="{
  \"Version\": \"2012-10-17\",
  \"Statement\": [{
    \"Effect\": \"Allow\",
    \"Action\": \"states:StartExecution\",
    \"Resource\": \"${SFN_ARN}\"
  }]
}"

if [ "$DRY_RUN" = true ]; then
  echo "[dry-run] Would create/update role ${EB_ROLE_NAME}"
else
  if aws iam get-role --role-name "$EB_ROLE_NAME" > /dev/null 2>&1; then
    echo "  Role exists — updating inline policy"
  else
    echo "  Creating role..."
    aws iam create-role \
      --role-name "$EB_ROLE_NAME" \
      --assume-role-policy-document "$EB_TRUST_POLICY" \
      --description "EventBridge role for triggering MBTI pipeline" \
      > /dev/null
    sleep 5
    echo "  Role created"
  fi

  aws iam put-role-policy \
    --role-name "$EB_ROLE_NAME" \
    --policy-name "StartPipelineExecution" \
    --policy-document "$EB_SFN_POLICY"

  echo "  [OK] Policy attached"
fi

echo ""

# =============================================================================
# 3. STATE MACHINE
# =============================================================================
echo "── 3. State Machine: ${SFN_NAME} ──"

SFN_DEF_FILE="$SCRIPT_DIR/step_functions_definition.json"
if [ ! -f "$SFN_DEF_FILE" ]; then
  echo "  [ERROR] ${SFN_DEF_FILE} not found"
  exit 1
fi

if [ "$DRY_RUN" = true ]; then
  echo "[dry-run] Would create/update state machine from $SFN_DEF_FILE"
else
  SFN_TEMP=$(mktemp)
  sed "s/\${AWS_ACCOUNT_ID}/$AWS_ACCOUNT_ID/g" "$SFN_DEF_FILE" > "$SFN_TEMP"

  # Check if state machine exists
  if aws stepfunctions describe-state-machine --state-machine-arn "$SFN_ARN" > /dev/null 2>&1; then
    echo "  State machine exists — updating definition..."
    aws stepfunctions update-state-machine \
      --state-machine-arn "$SFN_ARN" \
      --definition "file://$SFN_TEMP" \
      --role-arn "$SFN_ROLE_ARN" \
      > /dev/null
    echo "  [OK] Updated"
  else
    echo "  Creating state machine..."
    aws stepfunctions create-state-machine \
      --name "$SFN_NAME" \
      --definition "file://$SFN_TEMP" \
      --role-arn "$SFN_ROLE_ARN" \
      --region "$REGION" \
      --type STANDARD \
      > /dev/null
    echo "  [OK] Created"
  fi

  rm -f "$SFN_TEMP"
fi

echo ""

# =============================================================================
# 4. EVENTBRIDGE SCHEDULE
# =============================================================================
echo "── 4. EventBridge Schedule: ${EB_RULE} ──"

if [ "$DRY_RUN" = true ]; then
  echo "[dry-run] Would create schedule rule + target"
else
  # Create or update rule (daily 07:00 KST = 22:00 UTC)
  aws events put-rule \
    --name "$EB_RULE" \
    --schedule-expression "cron(0 22 * * ? *)" \
    --state ENABLED \
    --description "Daily trigger for MBTI article transform pipeline (07:00 KST)" \
    --region "$REGION" \
    > /dev/null

  echo "  Rule created: cron(0 22 * * ? *) = daily 07:00 KST"

  # Add Step Functions as target
  aws events put-targets \
    --rule "$EB_RULE" \
    --targets "[{
      \"Id\": \"pipeline-trigger\",
      \"Arn\": \"${SFN_ARN}\",
      \"RoleArn\": \"${EB_ROLE_ARN}\",
      \"Input\": \"{\\\"date\\\": null, \\\"source\\\": \\\"schedule\\\"}\"
    }]" \
    --region "$REGION" \
    > /dev/null

  echo "  Target attached: ${SFN_NAME}"
  echo "  [OK] Schedule configured"
fi

echo ""

# =============================================================================
# SUMMARY
# =============================================================================
echo "============================================"
echo "  Step Functions Deployment Complete!"
echo "============================================"
echo ""
echo "  State Machine: ${SFN_NAME}"
echo "  Schedule: daily 07:00 KST (22:00 UTC)"
echo ""
echo "  Manual test:"
echo "    aws stepfunctions start-execution \\"
echo "      --state-machine-arn ${SFN_ARN} \\"
echo "      --input '{\"date\": \"$(date -u +%Y%m%d)\", \"source\": \"manual\"}'"
echo ""
