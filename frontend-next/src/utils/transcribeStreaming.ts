// Stub for TranscribeStreamingClient - feature disabled
// This is a placeholder to prevent import errors

interface TranscribeConfig {
  language?: string;
  sampleRate?: number;
  onPartialTranscript?: (text: string) => void;
  onTranscript?: (text: string) => void;
  onError?: (error: Error) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

export class TranscribeStreamingClient {
  constructor(config: TranscribeConfig) {
    // Stub implementation
  }
  
  async start(stream: MediaStream): Promise<void> {
    // Stub implementation
  }
  
  stop(): void {
    // Stub implementation
  }
}
