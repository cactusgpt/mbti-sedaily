

import { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Sparkles } from 'lucide-react';

// API Configuration
const CHAT_API_URL = 'https://chzwwtjtgk.execute-api.us-east-1.amazonaws.com/dev/api/chat';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface MbtiChatBotProps {
  mbtiGroup?: 'NT' | 'NF' | 'ST' | 'SF';
  onMbtiChange?: (group: 'NT' | 'NF' | 'ST' | 'SF') => void;
}

// MBTI 그룹별 페르소나
const MBTI_PERSONAS = {
  NT: {
    name: '시현',
    role: '전략분석팀 수석연구원',
    greeting: '안녕하세요. 무엇이 궁금하신가요? 핵심만 빠르게 정리해드릴게요.',
    style: '논리적이고 분석적',
    color: 'blue',
    emoji: '📊',
  },
  NF: {
    name: '지원',
    role: '오피니언팀 논설위원',
    greeting: '반가워요. 오늘 어떤 이야기가 궁금하세요? 함께 생각해봐요.',
    style: '성찰적이고 따뜻한',
    color: 'violet',
    emoji: '💡',
  },
  ST: {
    name: '정훈',
    role: '팩트체크 에디터',
    greeting: '안녕하세요. 정확한 정보가 필요하시면 말씀하세요.',
    style: '정확하고 체계적',
    color: 'green',
    emoji: '📋',
  },
  SF: {
    name: '하은',
    role: 'MZ 독자 담당 에디터',
    greeting: '안녕하세요! 뭐가 궁금하세요? 쉽게 설명해드릴게요 😊',
    style: '친근하고 공감적',
    color: 'orange',
    emoji: '💬',
  },
};

// MBTI 그룹별 색상
const GROUP_COLORS = {
  NT: {
    primary: 'bg-blue-500',
    light: 'bg-blue-50',
    text: 'text-blue-600',
    border: 'border-blue-200',
    hover: 'hover:bg-blue-600',
  },
  NF: {
    primary: 'bg-violet-500',
    light: 'bg-violet-50',
    text: 'text-violet-600',
    border: 'border-violet-200',
    hover: 'hover:bg-violet-600',
  },
  ST: {
    primary: 'bg-green-500',
    light: 'bg-green-50',
    text: 'text-green-600',
    border: 'border-green-200',
    hover: 'hover:bg-green-600',
  },
  SF: {
    primary: 'bg-orange-500',
    light: 'bg-orange-50',
    text: 'text-orange-600',
    border: 'border-orange-200',
    hover: 'hover:bg-orange-600',
  },
};

// 퀵 액션 버튼
const QUICK_ACTIONS = [
  { label: '오늘 뉴스', query: '오늘 주요 뉴스 알려줘' },
  { label: '경제 동향', query: '최근 경제 동향이 어때?' },
  { label: 'MBTI 추천', query: '내 MBTI에 맞는 기사 추천해줘' },
];

export function MbtiChatBot({ mbtiGroup = 'SF', onMbtiChange }: MbtiChatBotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentGroup, setCurrentGroup] = useState(mbtiGroup);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const persona = MBTI_PERSONAS[currentGroup];
  const colors = GROUP_COLORS[currentGroup];

  // Show after delay
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  // Welcome message
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeMessage: Message = {
        id: 'welcome',
        role: 'assistant',
        content: `${persona.emoji} ${persona.greeting}\n\n저는 ${persona.name}이에요. ${persona.role}로 일하고 있어요.\n\n무엇이든 물어보세요!`,
        timestamp: new Date(),
      };
      setMessages([welcomeMessage]);
    }
  }, [isOpen, messages.length, persona]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Handle MBTI group change
  const handleGroupChange = (group: 'NT' | 'NF' | 'ST' | 'SF') => {
    setCurrentGroup(group);
    onMbtiChange?.(group);

    const newPersona = MBTI_PERSONAS[group];
    const changeMessage: Message = {
      id: `change-${Date.now()}`,
      role: 'assistant',
      content: `${newPersona.emoji} 안녕하세요! ${newPersona.name}이에요.\n\n${newPersona.greeting}`,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, changeMessage]);
  };

  // Send message
  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Build conversation history for API (exclude welcome message)
      const conversationHistory = messages
        .filter(m => m.id !== 'welcome')
        .map(m => ({
          role: m.role,
          content: m.content
        }));

      // Call chatbot API
      const response = await fetch(CHAT_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content.trim(),
          mbti_group: currentGroup,
          conversation_history: conversationHistory,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.response || '응답을 받지 못했어요.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: '죄송해요, 오류가 발생했어요. 잠시 후 다시 시도해주세요!',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <div
          className="fixed bottom-6 right-6 z-[45] group"
        >
          {/* Tooltip */}
          <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 ${colors.primary} text-white text-sm rounded-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg`}>
            <span className="font-medium">{persona.emoji} {persona.name}</span>
            <span className="block text-xs opacity-80">AI 어시스턴트</span>
          </div>

          {/* Button */}
          <button
            onClick={() => setIsOpen(true)}
            className={`w-14 h-14 ${colors.primary} ${colors.hover} text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110`}
            aria-label="AI 어시스턴트 열기"
          >
            <Sparkles className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          className="fixed bottom-24 right-6 z-[60] w-[360px] h-[500px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 max-md:w-full max-md:h-[100dvh] max-md:rounded-none max-md:top-0 max-md:left-0 max-md:right-0 max-md:bottom-0 max-md:fixed"
        >
          {/* Header */}
          <div className={`flex items-center justify-between px-4 py-3 ${colors.primary} text-white`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <span className="text-xl">{persona.emoji}</span>
              </div>
              <div>
                <h3 className="font-semibold text-sm">{persona.name}</h3>
                <p className="text-xs opacity-80">{persona.role}</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
              aria-label="닫기"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* MBTI Group Selector */}
          <div className="flex gap-1 p-2 bg-gray-50 border-b border-gray-100">
            {(['NT', 'NF', 'ST', 'SF'] as const).map((group) => (
              <button
                key={group}
                onClick={() => handleGroupChange(group)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  currentGroup === group
                    ? `${GROUP_COLORS[group].primary} text-white`
                    : `${GROUP_COLORS[group].light} ${GROUP_COLORS[group].text} hover:opacity-80`
                }`}
              >
                {MBTI_PERSONAS[group].emoji} {group}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
                    message.role === 'user'
                      ? `${colors.primary} text-white rounded-br-sm`
                      : 'bg-white text-gray-800 rounded-bl-sm shadow-sm border border-gray-100'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm border border-gray-100">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions */}
          <div className="px-3 py-2 bg-white border-t border-gray-100">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  onClick={() => sendMessage(action.query)}
                  disabled={isLoading}
                  className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-full transition-all ${colors.light} ${colors.text} hover:opacity-80 disabled:opacity-50`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-3 bg-white border-t border-gray-200">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="무엇이든 물어보세요..."
                disabled={isLoading}
                className="flex-1 px-4 py-2.5 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50"
                style={{
                  // @ts-ignore
                  '--tw-ring-color': currentGroup === 'NT' ? '#3b82f6' : currentGroup === 'NF' ? '#8b5cf6' : currentGroup === 'ST' ? '#22c55e' : '#f97316'
                }}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className={`w-10 h-10 ${colors.primary} ${colors.hover} text-white rounded-full flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
