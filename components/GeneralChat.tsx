'use client';

import { useRef, useEffect, useState } from 'react';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface GeneralChatProps {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  sample: string;
  samplePath: string;
}

const STARTER_QUESTIONS = [
  'Give me a high-level summary of this dog\'s genomic health profile.',
  'What are the most important findings I should discuss with a vet?',
  'Are there any breed-specific health risks I should be aware of?',
  'How do the coat color genetics and trait scores interact?',
  'What does the inbreeding level mean for long-term health?',
];

export default function GeneralChat({ messages, setMessages, sample, samplePath }: GeneralChatProps) {
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(text: string) {
    if (!text.trim() || streaming) return;
    const userMsg: ChatMessage = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setStreaming(true);
    setMessages([...newMessages, { role: 'assistant', content: '' }]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, sample, samplePath }),
      });

      if (!res.ok) throw new Error('Chat request failed');

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: fullText };
          return updated;
        });
      }
    } catch {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' };
        return updated;
      });
    } finally {
      setStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 220px)', minHeight: '400px' }}>

      {/* Chat history */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">🤖</div>
            <p className="text-sm text-gray-500 mb-1 font-medium">General AI Assistant</p>
            <p className="text-xs text-gray-400 mb-6">
              Ask anything about <strong>{sample || 'your dog'}</strong> — across all results.
              Your conversation is saved as you switch between tabs.
            </p>
            <div className="space-y-2 max-w-lg mx-auto text-left">
              {STARTER_QUESTIONS.map(q => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="w-full text-left text-sm px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-[#EEF0FB] hover:border-[#3540CA]/40 text-gray-700 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-[#3540CA] text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                }`}>
                  {msg.role === 'assistant' && !msg.content
                    ? <span className="animate-pulse text-gray-400">●●●</span>
                    : msg.content}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* History indicator */}
      {messages.length > 0 && (
        <div className="flex items-center justify-between pb-2 border-b border-gray-100 mb-2">
          <span className="text-xs text-gray-400">
            {Math.ceil(messages.length / 2)} message{Math.ceil(messages.length / 2) !== 1 ? 's' : ''} in this conversation
          </span>
          <button
            onClick={() => setMessages([])}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-0.5 rounded hover:bg-red-50"
          >
            Clear chat
          </button>
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything about your dog's genomic results…"
          rows={2}
          disabled={streaming}
          className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#3540CA]/40 disabled:opacity-50 bg-white"
        />
        <button
          onClick={() => send(input)}
          disabled={streaming || !input.trim()}
          className="bg-[#3540CA] hover:bg-[#2a34b0] text-white px-4 rounded-xl transition-colors disabled:opacity-40 text-sm shrink-0"
        >
          {streaming ? '⏳' : '↑'}
        </button>
      </div>
      <p className="text-xs text-gray-400 mt-1.5">Enter to send · Shift+Enter for newline</p>
    </div>
  );
}
