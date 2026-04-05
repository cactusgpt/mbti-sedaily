// ElevenLabs Text-to-Speech API
const ELEVENLABS_API_KEY = 'sk_4f96cf9ae2d25855ba16a51960c11d381114d9bc032b75e9';

// 에디터별 목소리 ID (ElevenLabs 한국어 네이티브 목소리)
// 남자: 시현(NT), 정훈(ST) / 여자: 지원(NF), 하은(SF)
export const editorVoices: Record<string, string> = {
  NT: 'U1cJYS4EdbaHmfR7YzHd', // Min ho - 쿨하고 젠틀한 남성 (시현)
  NF: 'AW5wrnG1jVizOYY7R1Oo', // JiYoung - 따뜻하고 자연스러운 여성 (지원)
  ST: 's07IwTCOrCDCaETjUVjx', // Hyun Bin - 쿨한 남성, 프로페셔널 (정훈) ✓
  SF: 'xi3rF0t7dg7uN2M0WUhr', // Yuna - 발랄하고 밝은 여성 (하은)
};

// 에디터별 볼륨 설정 (0.0 ~ 1.0, 기본 1.0)
export const editorVolumes: Record<string, number> = {
  NT: 1.0,
  NF: 1.4,  // 지원 목소리 더 크게
  ST: 1.0,
  SF: 1.0,
};

// 에디터 소개 텍스트 (자연스러운 말투)
export const editorIntroTexts: Record<string, string> = {
  NT: '안녕하세요. 시현입니다. 저는요, 뉴스를 볼 때 항상 숫자부터 봐요. 데이터가 뭐라고 하는지, 그게 중요하거든요. 핵심만 딱 전해드릴게요.',
  NF: '안녕하세요, 지원이에요. 저는 뉴스 읽을 때, 그 뒤에 있는 사람들 이야기가 자꾸 눈에 들어오더라고요. 천천히, 같이 읽어봐요.',
  ST: '정훈입니다. 저는 팩트만 전달해요. 언제, 어디서, 뭐가 있었는지. 그게 젤 중요하니까요.',
  SF: '안녕! 하은이야. 경제뉴스 어렵지? 나도 처음엔 그랬어. 근데 쉽게 풀면 진짜 재밌거든. 같이 보자!',
};

interface TTSOptions {
  voiceId: string;
  text: string;
  modelId?: string;
}

export async function generateSpeech({ voiceId, text, modelId = 'eleven_multilingual_v2' }: TTSOptions): Promise<ArrayBuffer> {
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': ELEVENLABS_API_KEY,
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: {
        stability: 0.35,        // 낮을수록 더 자연스러운 변화 (AI티 감소)
        similarity_boost: 0.6,  // 약간 낮춰서 더 자연스럽게
        style: 0.7,             // 감정 표현 높임
        use_speaker_boost: true,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`ElevenLabs API error: ${response.status}`);
  }

  return response.arrayBuffer();
}

// 오디오 재생 유틸리티
let currentAudio: HTMLAudioElement | null = null;
let onEndCallback: (() => void) | null = null;

// 오디오 캐시 (메모리 + IndexedDB)
const audioCache = new Map<string, string>(); // editorId -> blob URL

// IndexedDB 캐시
const DB_NAME = 'mbti-audio-cache';
const STORE_NAME = 'audio';

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

async function getCachedAudio(editorId: string): Promise<Blob | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(editorId);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  } catch {
    return null;
  }
}

async function setCachedAudio(editorId: string, blob: Blob): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(blob, editorId);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch {
    // 캐시 실패해도 무시
  }
}

export async function playEditorIntro(editorId: string, onEnd?: () => void): Promise<void> {
  // 기존 재생 중인 오디오 중지
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }

  const voiceId = editorVoices[editorId];
  const text = editorIntroTexts[editorId];

  if (!voiceId || !text) {
    console.error('Unknown editor:', editorId);
    return;
  }

  onEndCallback = onEnd || null;

  try {
    let url = audioCache.get(editorId);

    if (!url) {
      // 1. IndexedDB에서 캐시 확인
      const cachedBlob = await getCachedAudio(editorId);

      if (cachedBlob) {
        url = URL.createObjectURL(cachedBlob);
      } else {
        // 2. API 호출
        const audioData = await generateSpeech({ voiceId, text });
        const blob = new Blob([audioData], { type: 'audio/mpeg' });
        url = URL.createObjectURL(blob);

        // IndexedDB에 캐시 저장
        await setCachedAudio(editorId, blob);
      }

      // 메모리 캐시에도 저장
      audioCache.set(editorId, url);
    }

    currentAudio = new Audio(url);

    // Web Audio API로 볼륨 증폭
    const volume = editorVolumes[editorId] || 1.0;
    if (volume > 1.0) {
      const audioContext = new AudioContext();
      const source = audioContext.createMediaElementSource(currentAudio);
      const gainNode = audioContext.createGain();
      gainNode.gain.value = volume;
      source.connect(gainNode);
      gainNode.connect(audioContext.destination);
    }

    await currentAudio.play();

    // 재생 완료 콜백 (캐시된 URL은 해제하지 않음)
    currentAudio.onended = () => {
      currentAudio = null;
      if (onEndCallback) {
        onEndCallback();
        onEndCallback = null;
      }
    };
  } catch (error) {
    console.error('Failed to play audio:', error);
    throw error;
  }
}

export function stopAudio(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
}

export function isPlaying(): boolean {
  return currentAudio !== null && !currentAudio.paused;
}
