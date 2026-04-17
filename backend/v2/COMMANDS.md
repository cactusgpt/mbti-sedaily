# COMMANDS.md — v2 작업 자주 쓰는 명령어

**목적**: Claude Code가 명령어를 **추측하지 않도록** 검증된 명령어를 모아둠. 여기 없는 명령어는 공식 AWS 문서 확인하거나 사용자에게 확인.

모든 명령어는 `backend/` 디렉터리 기준. 다른 위치에서 실행해야 하면 명시.

---

## 🏗️ 환경 세팅

```bash
# Python 의존성 설치 (v2 전용)
cd backend
pip install -r v2/requirements.txt

# 로컬 환경변수 로드 (.env.v2 존재 시)
export $(cat v2/.env.v2 | grep -v '^#' | xargs)

# AWS 자격증명 확인
aws sts get-caller-identity
# 기대: Account = 887078546492
```

---

## 🧪 코드 검증

### 문법 확인 (매 파일 저장 후)
```bash
python3 -c "import ast; ast.parse(open('v2/clients/pgvector_v2_client.py').read())"
```

### Import 확인
```bash
cd backend
python3 -c "from v2.clients.pgvector_v2_client import PgVectorV2Client; print('OK')"
```

### 타입 체크 (선택)
```bash
cd backend
python3 -m mypy v2/ --ignore-missing-imports
```

### 테스트 실행
```bash
# 단위 테스트만 (integration 제외, AWS 리소스 불필요)
cd backend
python3 -m pytest v2/tests/ -v -m 'not integration'

# 통합 테스트 포함 (PG_V2_HOST 환경변수 필요)
python3 -m pytest v2/tests/ -v

# 특정 파일만
python3 -m pytest v2/tests/test_pgvector_v2_client.py -v

# 특정 테스트만
python3 -m pytest v2/tests/test_pgvector_v2_client.py::test_insert_article -v
```

---

## 🚀 배포

### v2 Lambda 전체 배포
```bash
cd backend
./v2/deploy-v2.sh
```

### v2 일부만
```bash
./v2/deploy-v2.sh collector        # Core 1만
./v2/deploy-v2.sh transform        # Core 2만
./v2/deploy-v2.sh personalization  # Core 3만 (Chat Agent 제외)
./v2/deploy-v2.sh chat-agent       # Chat Agent (Docker + ECR + AgentCore)
```

### 단일 Lambda 코드만 업데이트 (Claude Code OK)
```bash
# 이미 존재하는 함수의 코드만 교체 — 사람 개입 불필요
aws lambda update-function-code \
  --function-name sedaily-mbti-v2-collector-dev \
  --s3-bucket sedaily-mbti-lambda-packages-dev \
  --s3-key lambda_package_v2.zip \
  --region us-east-1
```

---

## 📊 pgvector v2 작업

### 연결 테스트
```bash
# 환경변수 확인
echo $PG_V2_HOST
echo $PG_V2_PASSWORD  # 실제 비밀번호 출력 주의

# psql 접속 (psql 설치되어 있어야 함)
PGPASSWORD="$PG_V2_PASSWORD" psql \
  -h "$PG_V2_HOST" \
  -U ailens \
  -d ailens_v2 \
  -p 5432
```

### 스키마 초기화 (TASK-1.2)
```bash
# dry-run
cd backend
python3 v2/infrastructure/init_pgvector_v2.py --dry-run

# 실제 실행
python3 v2/infrastructure/init_pgvector_v2.py
```

### 테이블 확인
```sql
\dt                                    -- 모든 테이블
\d articles                            -- articles 테이블 구조
\di                                    -- 모든 인덱스

SELECT status, COUNT(*) FROM articles GROUP BY status;
-- 기대: raw / transformed / failed 별 건수

SELECT COUNT(*) FROM article_versions;
-- 기대: articles.transformed 건수 × 4
```

### 상태 리셋 (개발 중에만)
```sql
-- 실패 재처리
UPDATE articles SET status = 'raw' WHERE status = 'failed';

-- 특정 기사만 재변환
UPDATE articles SET status = 'raw' WHERE news_id = 'NEWS_ID_HERE';
DELETE FROM article_versions WHERE news_id = 'NEWS_ID_HERE';
```

**주의**: 프로덕션에서 `UPDATE/DELETE` 전에 반드시 `SELECT`로 대상 확인. WHERE 절 빠지면 재앙.

---

## 🪣 S3 v2 작업

### 버킷 내용 확인
```bash
# 전체 목록
aws s3 ls s3://sedaily-mbti-article-body-v2-dev/ --recursive | head -20

# 특정 기사의 파일들
aws s3 ls s3://sedaily-mbti-article-body-v2-dev/articles/NEWS_ID/

# 내용 확인
aws s3 cp s3://sedaily-mbti-article-body-v2-dev/articles/NEWS_ID/original.json -
aws s3 cp s3://sedaily-mbti-article-body-v2-dev/articles/NEWS_ID/version_NT.json -
```

### 버킷 크기
```bash
aws s3api list-objects-v2 \
  --bucket sedaily-mbti-article-body-v2-dev \
  --query 'sum(Contents[].Size)' \
  --output text | awk '{printf "%.2f MB\n", $1/1024/1024}'
```

---

## 🤖 Bedrock 호출 (로컬 테스트)

### Opus 4.6 호출 테스트 (비용 주의!)
```bash
cd backend
python3 -c "
import boto3, json
client = boto3.client('bedrock-runtime', region_name='us-east-1')
response = client.invoke_model(
    modelId='us.anthropic.claude-opus-4-6-v1:0',
    body=json.dumps({
        'anthropic_version': 'bedrock-2023-05-31',
        'max_tokens': 100,
        'messages': [{'role': 'user', 'content': 'Hello in Korean'}]
    })
)
print(json.loads(response['body'].read()))
"
```

### Titan V2 임베딩 테스트
```bash
python3 -c "
import boto3, json
client = boto3.client('bedrock-runtime', region_name='us-east-1')
response = client.invoke_model(
    modelId='amazon.titan-embed-text-v2:0',
    body=json.dumps({
        'inputText': '서울경제 테스트 문장',
        'dimensions': 1024,
        'normalize': True
    })
)
body = json.loads(response['body'].read())
print(f'embedding dim: {len(body[\"embedding\"])}')
print(f'first 5: {body[\"embedding\"][:5]}')
"
```

---

## 📋 CloudWatch 로그

### Collector Lambda 로그 실시간
```bash
aws logs tail /aws/lambda/sedaily-mbti-v2-collector-dev --follow --region us-east-1
```

### 최근 에러만 필터링
```bash
aws logs filter-log-events \
  --log-group-name /aws/lambda/sedaily-mbti-v2-transform-dev \
  --filter-pattern "ERROR" \
  --start-time $(date -v-1H +%s)000 \
  --region us-east-1
```

### Transform Lambda 토큰 사용량 (비용 모니터링)
```bash
aws logs filter-log-events \
  --log-group-name /aws/lambda/sedaily-mbti-v2-transform-dev \
  --filter-pattern "tokens=" \
  --start-time $(date -v-1d +%s)000 \
  --region us-east-1 \
  --query 'events[].message'
```

---

## 🐳 Chat Agent (Phase 4)

### 로컬 빌드 + 실행
```bash
cd backend/v2/agents/chat_agent

# ARM64 빌드 (Mac M1/M2는 native, Intel은 buildx 필요)
docker buildx build --platform linux/arm64 -t sedaily-mbti-chat-agent:local .

# 로컬 실행 (포트 8000)
docker run --rm -p 8000:8000 \
  -e PG_V2_HOST="$PG_V2_HOST" \
  -e PG_V2_PASSWORD="$PG_V2_PASSWORD" \
  sedaily-mbti-chat-agent:local

# 다른 터미널에서 MCP initialize 테스트
curl -X POST http://localhost:8000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
```

### ECR push
```bash
# 로그인
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  887078546492.dkr.ecr.us-east-1.amazonaws.com

# 태그 & push
GIT_SHA=$(git rev-parse --short HEAD)
docker tag sedaily-mbti-chat-agent:local \
  887078546492.dkr.ecr.us-east-1.amazonaws.com/sedaily-mbti-chat-agent:$GIT_SHA
docker tag sedaily-mbti-chat-agent:local \
  887078546492.dkr.ecr.us-east-1.amazonaws.com/sedaily-mbti-chat-agent:latest
docker push 887078546492.dkr.ecr.us-east-1.amazonaws.com/sedaily-mbti-chat-agent:$GIT_SHA
docker push 887078546492.dkr.ecr.us-east-1.amazonaws.com/sedaily-mbti-chat-agent:latest
```

### AgentCore CLI (사람이 실행)
```bash
# 최초 배포 — 사람이 실행
agentcore configure
agentcore deploy \
  --name sedaily-mbti-chat-agent-v2-dev \
  --image 887078546492.dkr.ecr.us-east-1.amazonaws.com/sedaily-mbti-chat-agent:latest \
  --protocol mcp

# Runtime 호출 테스트
aws bedrock-agentcore invoke-agent-runtime \
  --agent-runtime-arn arn:aws:bedrock-agentcore:us-east-1:887078546492:runtime/sedaily-mbti-chat-agent-v2-dev \
  --payload '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
```

---

## 🔍 디버깅

### Lambda 함수 설정 확인
```bash
aws lambda get-function-configuration \
  --function-name sedaily-mbti-v2-collector-dev \
  --region us-east-1 \
  --query '{Env:Environment,Timeout:Timeout,Memory:MemorySize,Runtime:Runtime,Role:Role}'
```

### Lambda 환경변수 업데이트 (사람이 실행)
```bash
aws lambda update-function-configuration \
  --function-name sedaily-mbti-v2-collector-dev \
  --region us-east-1 \
  --environment "Variables={PG_V2_HOST=xxx,PG_V2_PASSWORD=xxx,...}"
```

### EventBridge 규칙 확인
```bash
aws events list-rules --name-prefix sedaily-mbti-v2 --region us-east-1
aws events describe-rule --name sedaily-mbti-v2-collector-schedule --region us-east-1
```

### API Gateway 라우트 확인
```bash
# API ID는 chzwwtjtgk
aws apigatewayv2 get-routes --api-id chzwwtjtgk --region us-east-1 \
  --query 'Items[?contains(RouteKey, `/v2/`)]'
```

---

## 💰 비용 모니터링

### 오늘 Bedrock 사용량
```bash
aws ce get-cost-and-usage \
  --time-period Start=$(date -v-1d +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity DAILY \
  --metrics UnblendedCost \
  --filter '{"Dimensions":{"Key":"SERVICE","Values":["Amazon Bedrock"]}}'
```

### 주간 Lambda 비용
```bash
aws ce get-cost-and-usage \
  --time-period Start=$(date -v-7d +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity DAILY \
  --metrics UnblendedCost \
  --filter '{"Dimensions":{"Key":"SERVICE","Values":["AWS Lambda"]}}'
```

---

## 🆘 긴급 상황

### v2 Lambda 전체 비활성화 (concurrency 0)
```bash
for fn in sedaily-mbti-v2-collector-dev sedaily-mbti-v2-transform-dev sedaily-mbti-v2-feed-dev; do
  aws lambda put-function-concurrency \
    --function-name "$fn" \
    --reserved-concurrent-executions 0 \
    --region us-east-1
done
```

### EventBridge 스케줄 정지
```bash
aws events disable-rule --name sedaily-mbti-v2-collector-schedule --region us-east-1
aws events disable-rule --name sedaily-mbti-v2-transform-trigger --region us-east-1
```

### pgvector v2 긴급 백업
```bash
# Point-in-time recovery는 RDS 기본. 스냅샷만 찍어두기:
aws rds create-db-snapshot \
  --db-instance-identifier sedaily-mbti-pgvector-v2-dev \
  --db-snapshot-identifier sedaily-mbti-pgvector-v2-emergency-$(date +%Y%m%d%H%M) \
  --region us-east-1
```

---

## 📝 참고 링크

- AgentCore 공식 문서: https://docs.aws.amazon.com/bedrock-agentcore/
- MCP 프로토콜: https://modelcontextprotocol.io/
- pgvector 문서: https://github.com/pgvector/pgvector
- Bedrock 모델 가격: https://aws.amazon.com/bedrock/pricing/
- Titan V2 임베딩: https://docs.aws.amazon.com/bedrock/latest/userguide/titan-embedding-models.html
