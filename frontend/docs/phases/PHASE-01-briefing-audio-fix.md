# PHASE-01: BriefingPage 음성 겹침 버그 수정 및 한국어 문법 수정

## Date: 2026-02-08

## Status: COMPLETED

## Summary

BriefingPage에서 음성이 겹쳐서 재생되는 버그와 에디터 선택 버튼의 한국어 조사 문법 오류를 수정함.

---

## 1. Problem Analysis

### 1.1 음성 겹침 문제

**증상:**
- OnboardingPage에서 "시현 목소리 듣기" 재생 중 "대화하기" 클릭
- BriefingPage로 이동 후 두 개의 음성이 동시에 재생 (메아리 효과)

**원인:**
1. OnboardingPage → BriefingPage 전환 시 기존 Audio 미정지
2. BriefingPage에서 새 Audio 생성 시 기존 AudioContext 미정리
3. useEffect 의존성 문제로 인한 중복 재생

### 1.2 한국어 문법 오류

**문제:**
- "시현와 뉴스 보러가기" ❌
- "지원와 대화하기" ❌

**올바른 표현:**
- "시현**과** 뉴스 보러가기" ✅
- "지원**과** 대화하기" ✅

**문법 규칙:**
- 받침 있는 명사 + "과" (시현, 지원, 정훈, 하은 모두 ㄴ 받침)
- 받침 없는 명사 + "와"

---

## 2. Solution

### 2.1 Architecture Change

**Before:**
```
OnboardingPage (Audio playing)
       ↓ 대화하기 클릭
BriefingPage (New Audio + Old Audio still playing)
       ↓
두 개의 음성 동시 재생 (메아리)
```

**After:**
```
OnboardingPage (Audio playing)
       ↓ 대화하기 클릭
       ↓ stopAudio() 호출
BriefingPage 마운트
       ↓ stopAudio() 추가 호출 (안전장치)
       ↓ 새 Audio 재생 전 기존 리소스 정리
단일 음성만 재생
```

---

## 3. Implementation

### 3.1 OnboardingPage.tsx 수정

#### 변경 1: "대화하기" 버튼 클릭 시 음성 정지

```typescript
// Before
{onStartBriefing && (
  <button
    onClick={() => {
      localStorage.setItem("mbti-group", editor.id);
      onStartBriefing(editor.id);
    }}
  >
    💬 {editor.name}와 대화하기
  </button>
)}

// After
{onStartBriefing && (
  <button
    onClick={() => {
      stopAudio(); // 재생 중인 음성 정지
      setPlayingId(null);
      localStorage.setItem("mbti-group", editor.id);
      onStartBriefing(editor.id);
    }}
  >
    💬 {editor.name}과 대화하기
  </button>
)}
```

#### 변경 2: "뉴스 보러가기" 버튼 클릭 시 음성 정지

```typescript
// Before
const handleSelect = (id: MbtiGroupId) => {
  localStorage.setItem("mbti-group", id);
  onSelectGroup(id);
};

// After
const handleSelect = (id: MbtiGroupId) => {
  stopAudio(); // 재생 중인 음성 정지
  setPlayingId(null);
  localStorage.setItem("mbti-group", id);
  onSelectGroup(id);
};
```

#### 변경 3: 한국어 조사 수정

```typescript
// Before
📰 {editor.name}와 뉴스 보러가기
💬 {editor.name}와 대화하기

// After
📰 {editor.name}과 뉴스 보러가기
💬 {editor.name}과 대화하기
```

### 3.2 BriefingPage.tsx 수정

#### 변경 1: Import 추가

```typescript
// Before
import { useState, useEffect, useRef } from "react";
import { generateSpeech, editorVoices, editorVolumes } from "@/lib/elevenlabs";

// After
import { useState, useEffect, useRef, useCallback } from "react";
import { generateSpeech, editorVoices, editorVolumes, stopAudio } from "@/lib/elevenlabs";
```

#### 변경 2: 오디오 리소스 참조 추가

```typescript
// Before
const audioRef = useRef<HTMLAudioElement | null>(null);

// After
const audioRef = useRef<HTMLAudioElement | null>(null);
const audioContextRef = useRef<AudioContext | null>(null);
const typeIntervalRef = useRef<NodeJS.Timeout | null>(null);
```

#### 변경 3: 마운트/언마운트 시 오디오 정리

```typescript
// 마운트 시 기존 오디오 정지, 언마운트 시 정리
useEffect(() => {
  stopAudio(); // OnboardingPage에서 재생 중이던 오디오 정지

  return () => {
    // 언마운트 시 모든 오디오 정리
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (typeIntervalRef.current) {
      clearInterval(typeIntervalRef.current);
    }
  };
}, []);
```

#### 변경 4: playText 함수 개선

```typescript
const playText = useCallback(async (text: string) => {
  // 기존 오디오 완전히 정리
  if (audioRef.current) {
    audioRef.current.pause();
    audioRef.current.onended = null;
    audioRef.current = null;
  }
  if (audioContextRef.current) {
    audioContextRef.current.close();
    audioContextRef.current = null;
  }
  if (typeIntervalRef.current) {
    clearInterval(typeIntervalRef.current);
    typeIntervalRef.current = null;
  }

  // ... 새 오디오 생성 및 재생

  // AudioContext 참조 저장
  if (volume > 1.0) {
    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;  // 참조 저장
    // ...
  }

  // 타이핑 인터벌 참조 저장
  typeIntervalRef.current = setInterval(() => {
    // ...
  }, 50);
}, [groupId]);
```

#### 변경 5: 자동 진행 중복 방지

```typescript
// Before
useEffect(() => {
  if (!isPlaying && currentIndex === -1 && currentText === editor.greeting) {
    setTimeout(() => handleNext(), 1000);
  }
}, [isPlaying, currentIndex, currentText]);

// After
const greetingFinishedRef = useRef(false);
useEffect(() => {
  if (!isPlaying && currentIndex === -1 && currentText === editor.greeting && !greetingFinishedRef.current) {
    greetingFinishedRef.current = true;  // 중복 실행 방지
    const timer = setTimeout(() => handleNext(), 1000);
    return () => clearTimeout(timer);
  }
}, [isPlaying, currentIndex, currentText, editor.greeting, handleNext]);
```

---

## 4. Files Modified

| File | Change Type | Description |
|------|-------------|-------------|
| `src/components/mbti/OnboardingPage.tsx` | Modified | 버튼 클릭 시 음성 정지, 조사 "와"→"과" 수정 |
| `src/components/mbti/BriefingPage.tsx` | Modified | 오디오 리소스 정리 로직 개선, useCallback 적용 |

---

## 5. Deployment

### 5.1 Build

```bash
cd /Users/yeong-gwang/Documents/work/서울경제신문/DEV/mbti/frontend
npm run build
```

결과:
```
✓ 2344 modules transformed.
dist/assets/index-BLakFVti.js    186.05 kB │ gzip: 57.02 kB
✓ built in 3.93s
```

### 5.2 S3 Upload

```bash
aws s3 sync dist/ s3://sedaily-mbti-frontend-dev --delete
```

### 5.3 CloudFront Cache Invalidation

```bash
aws cloudfront create-invalidation \
  --distribution-id E1QS7PY350VHF6 \
  --paths "/*"
```

결과:
```json
{
  "Invalidation": {
    "Id": "IA4EOVV4QJPMMBM5G1IE24ONTZ",
    "Status": "InProgress"
  }
}
```

---

## 6. Verification

### 6.1 테스트 시나리오

| 단계 | 예상 동작 | 결과 |
|------|----------|------|
| 1. OnboardingPage에서 "시현 목소리 듣기" 클릭 | 시현 목소리 재생 | ✅ |
| 2. 재생 중 "시현과 대화하기" 클릭 | 기존 음성 정지, BriefingPage로 이동 | ✅ |
| 3. BriefingPage "브리핑 시작하기" 클릭 | 단일 음성만 재생 (겹침 없음) | ✅ |
| 4. 버튼 텍스트 확인 | "시현과", "지원과", "정훈과", "하은과" | ✅ |

---

## 7. URL

- **Production**: https://d1c80m8tuxbtcl.cloudfront.net

---

## 8. Related Issues

- ElevenLabs TTS API 연동 (이전 작업)
- 에디터별 음성 캐싱 (IndexedDB)
- Web Audio API GainNode 볼륨 증폭

---

## 9. References

- [Web Audio API - AudioContext](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext)
- [React useCallback Hook](https://react.dev/reference/react/useCallback)
- [Korean Grammar - 와/과 조사](https://korean.go.kr/)
