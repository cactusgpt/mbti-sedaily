

import { useState, useRef, useEffect, useCallback } from "react";
import { API_URL } from "@/config/api";
import type { MbtiGroupId } from "@/data/mbtiGroups";

interface Props {
  articleTitle: string;
  articleBody: string | string[];
  mbtiGroup: MbtiGroupId;
}

export function ArticlePodcast({ articleTitle, articleBody, mbtiGroup }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioReady, setAudioReady] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Create audio text from article
  const getAudioText = useCallback(() => {
    const intro = `${articleTitle}.`;
    const body = Array.isArray(articleBody) ? articleBody.join(' ') : articleBody;
    // 마크다운 기호 제거
    const cleanBody = body.replace(/\*\*/g, '').replace(/■/g, '').replace(/✓/g, '');
    return `${intro} ${cleanBody}`;
  }, [articleTitle, articleBody]);

  // Fetch TTS audio
  const fetchAudio = async () => {
    if (audioReady && audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const text = getAudioText();

      const response = await fetch(`${API_URL}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          mbti_group: mbtiGroup,
        }),
      });

      if (!response.ok) throw new Error('TTS 요청 실패');

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message);
      }

      // Convert base64 to audio blob
      const audioBlob = base64ToBlob(data.audio, 'audio/mpeg');
      const audioUrl = URL.createObjectURL(audioBlob);

      // Create audio element
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.load();
      }

    } catch (err) {
      console.error('TTS error:', err);
      setError('음성 생성에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // Convert base64 to blob
  const base64ToBlob = (base64: string, mimeType: string) => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  };

  // Handle play/pause
  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (!audioReady) {
        fetchAudio();
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  // Handle seek
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const time = parseFloat(e.target.value);
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  // Handle playback rate change
  const cyclePlaybackRate = () => {
    const rates = [1, 1.25, 1.5, 1.75, 2];
    const currentIndex = rates.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % rates.length;
    const newRate = rates[nextIndex];
    setPlaybackRate(newRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = newRate;
    }
  };

  // Format time (mm:ss)
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setAudioReady(true);
      audio.play();
      setIsPlaying(true);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleError = () => {
      setError('오디오 재생 오류');
      setIsPlaying(false);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, []);

  return (
    <div className="flex items-center gap-3">
      {/* Hidden audio element */}
      <audio ref={audioRef} preload="none" />

      {/* Play/Pause Button */}
      <button
        onClick={togglePlay}
        disabled={isLoading}
        className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
      >
        {isLoading ? (
          <span className="text-[12px]">...</span>
        ) : isPlaying ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        ) : (
          <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <polygon points="5,3 19,12 5,21" />
          </svg>
        )}
      </button>

      {/* Progress Bar */}
      <div className="flex-1">
        <input
          type="range"
          min="0"
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          disabled={!audioReady}
          className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          style={{ accentColor: '#111' }}
        />
        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
          <span>{formatTime(currentTime)}</span>
          <span>{audioReady ? formatTime(duration) : '--:--'}</span>
        </div>
      </div>

      {/* Playback Rate */}
      <button
        onClick={cyclePlaybackRate}
        disabled={!audioReady}
        className="px-2 py-1 text-[11px] text-gray-500 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50"
      >
        {playbackRate}x
      </button>

      {/* Error Message */}
      {error && (
        <span className="text-[11px] text-red-500">{error}</span>
      )}
    </div>
  );
}
