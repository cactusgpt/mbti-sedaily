# PHASE 02: BriefingPage 채팅 인터페이스 전환

## 작업 일자
2026-02-09

## 개요
"시현과 대화하기" 버튼 클릭 시 열리는 BriefingPage를 카라오케 스타일에서 AI 에디터와 실시간 대화하는 채팅 인터페이스로 전환

## 변경 사항

### 1. BriefingPage.tsx 완전 재작성
**기존**: TTS 기반 카라오케 스타일 뉴스 브리핑
**변경**: AI 에디터와 대화하는 채팅 인터페이스

#### 주요 기능
- 에디터별 맞춤 인사말 (시현/지원/정훈/하은)
- 실시간 채팅 메시지 송수신
- 추천 질문 버튼: "오늘 주요 뉴스 뭐야?", "경제 뉴스 알려줘", "쉽게 설명해줘", "내 생활에 영향 있어?"
- 로딩 인디케이터 (bouncing dots)
- 대화 히스토리 유지

#### UI 구성
```
┌─────────────────────────────────────────┐
│ [←] 시현과 대화         [뉴스 보기]    │ Header
├─────────────┬───────────────────────────┤
│             │  ┌─────────────────────┐  │
│   캐릭터    │  │ 에디터 메시지       │  │
│   이미지    │  └─────────────────────┘  │
│  (Desktop)  │           ┌─────────────┐ │
│             │           │ 사용자 메시지│ │
│             │           └─────────────┘ │
│             ├───────────────────────────┤
│             │ [추천1] [추천2] [추천3]   │ Suggestions
│             ├───────────────────────────┤
│             │ [입력창...        ] [▶]  │ Input
└─────────────┴───────────────────────────┘
```

### 2. API 연동
- 엔드포인트: `https://chzwwtjtgk.execute-api.us-east-1.amazonaws.com/dev/api/chat`
- 요청 형식:
  ```json
  {
    "message": "사용자 입력",
    "mbti_group": "NT|NF|ST|SF",
    "conversation_history": [
      { "role": "user|assistant", "content": "..." }
    ]
  }
  ```

### 3. 에디터 캐릭터 설정
| 그룹 | 이름 | 인사말 | 컬러 |
|------|------|--------|------|
| NT | 시현 | "안녕하세요. 시현이에요.\n오늘 뉴스에 대해 얘기해볼까요? 궁금한 거 있으면 물어보세요." | blue |
| NF | 지원 | "안녕하세요, 지원이에요.\n오늘 어떤 뉴스가 마음에 걸리세요? 같이 얘기해봐요." | violet |
| ST | 정훈 | "정훈입니다.\n오늘 뉴스 팩트 정리해드릴게요. 뭐가 궁금하세요?" | green |
| SF | 하은 | "안녕! 하은이야 😊\n오늘 뉴스 같이 수다 떨자! 뭐가 궁금해?" | orange |

## 기술 구현

### State 관리
```typescript
const [messages, setMessages] = useState<Message[]>([]);
const [input, setInput] = useState('');
const [isLoading, setIsLoading] = useState(false);
```

### 메시지 전송 로직
```typescript
const sendMessage = async (text?: string) => {
  const content = text || input;
  if (!content.trim() || isLoading) return;

  // 사용자 메시지 추가
  setMessages(prev => [...prev, userMsg]);
  setInput('');
  setIsLoading(true);

  // API 호출
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: content.trim(),
      mbti_group: groupId,
      conversation_history: messages.filter(m => m.id !== 'welcome').map(...)
    }),
  });

  // 응답 메시지 추가
  const data = await response.json();
  setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
};
```

## 수정 파일
- `src/components/mbti/BriefingPage.tsx` - 완전 재작성

## 배포
- S3: `sedaily-mbti-frontend-dev`
- CloudFront: `E1QS7PY350VHF6`
- URL: https://d1c80m8tuxbtcl.cloudfront.net
