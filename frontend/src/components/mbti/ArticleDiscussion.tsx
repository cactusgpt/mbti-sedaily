import { useState, useRef, useEffect } from 'react';
import type { MbtiGroupId } from '@/data/mbtiGroups';

const API_URL = 'https://chzwwtjtgk.execute-api.us-east-1.amazonaws.com/dev/api/chat';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  articleTitle: string;
  articleContent: string;
  mbtiGroup: MbtiGroupId;
}

const editors: Record<MbtiGroupId, { name: string; emoji: string; color: string }> = {
  NT: { name: '시현', emoji: '📊', color: 'blue' },
  NF: { name: '지원', emoji: '💡', color: 'violet' },
  ST: { name: '정훈', emoji: '📋', color: 'green' },
  SF: { name: '하은', emoji: '💬', color: 'orange' },
};

const colorClasses: Record<string, { bg: string; text: string; light: string }> = {
  blue: { bg: 'bg-blue-500', text: 'text-blue-600', light: 'bg-blue-50' },
  violet: { bg: 'bg-violet-500', text: 'text-violet-600', light: 'bg-violet-50' },
  green: { bg: 'bg-green-500', text: 'text-green-600', light: 'bg-green-50' },
  orange: { bg: 'bg-orange-500', text: 'text-orange-600', light: 'bg-orange-50' },
};

export function ArticleDiscussion({ articleTitle, articleContent, mbtiGroup }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const editor = editors[mbtiGroup];
  const colors = colorClasses[editor.color];

  // 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 열면 포커스
  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  // 토론 시작
  const startDiscussion = () => {
    setIsOpen(true);
    if (messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: `${editor.emoji} 이 기사에 대해 얘기해볼까요?\n\n궁금한 점이나 의견 있으시면 편하게 말씀해주세요!`,
      }]);
    }
  };

  // 메시지 전송
  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: input.trim(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const context = `[기사 제목: ${articleTitle}]\n[기사 내용 요약: ${articleContent.slice(0, 500)}...]`;

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `${context}\n\n사용자 질문: ${input.trim()}`,
          mbti_group: mbtiGroup,
          conversation_history: messages.filter(m => m.id !== 'welcome').map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await response.json();
      setMessages(prev => [...prev, {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: data.response || '응답을 받지 못했어요.',
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id: `e-${Date.now()}`,
        role: 'assistant',
        content: '오류가 발생했어요. 다시 시도해주세요.',
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // 추천 질문
  const suggestions = [
    '이 뉴스 핵심이 뭐야?',
    '나한테 어떤 영향이 있어?',
    '다른 관점에서 보면?',
  ];

  if (!isOpen) {
    return (
      <button
        onClick={startDiscussion}
        className={`w-full py-4 ${colors.light} ${colors.text} rounded-xl font-medium text-[15px] hover:opacity-80 transition-opacity flex items-center justify-center gap-2`}
      >
        {editor.emoji} {editor.name}과 이 기사 토론하기
      </button>
    );
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className={`${colors.bg} text-white px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <span className="text-xl">{editor.emoji}</span>
          <span className="font-medium">{editor.name}과 토론</span>
        </div>
        <button onClick={() => setIsOpen(false)} className="text-white/70 hover:text-white">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="h-[300px] overflow-y-auto p-4 space-y-3 bg-gray-50">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-[14px] whitespace-pre-wrap ${
              msg.role === 'user'
                ? `${colors.bg} text-white rounded-br-sm`
                : 'bg-white text-gray-800 rounded-bl-sm shadow-sm'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white px-4 py-3 rounded-2xl shadow-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      <div className="px-3 py-2 bg-white border-t border-gray-100 flex gap-2 overflow-x-auto">
        {suggestions.map((q) => (
          <button
            key={q}
            onClick={() => { setInput(q); inputRef.current?.focus(); }}
            className={`flex-shrink-0 px-3 py-1.5 text-xs ${colors.light} ${colors.text} rounded-full hover:opacity-80`}
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
        className="p-3 bg-white border-t border-gray-200 flex gap-2"
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="의견이나 질문을 입력하세요..."
          disabled={isLoading}
          className="flex-1 px-4 py-2.5 bg-gray-100 rounded-full text-[14px] focus:outline-none"
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className={`w-10 h-10 ${colors.bg} text-white rounded-full flex items-center justify-center disabled:opacity-50`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </form>
    </div>
  );
}
