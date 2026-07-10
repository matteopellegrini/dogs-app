'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface InlineChatProps {
  sample: string;
  samplePath: string;
  starterQuestions: string[];
}

export default function InlineChat({ sample, samplePath, starterQuestions }: InlineChatProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMessages([]);
    setInput('');
    setOpen(false);
  }, [sample]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  async function send(text: string) {
    if (!text.trim() || streaming) return;
    if (!open) setOpen(true);
    const userMsg: Message = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setStreaming(true);

    const assistantMsg: Message = { role: 'assistant', content: '' };
    setMessages([...newMessages, assistantMsg]);

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
    <div className="mb-4 border border-[#3540CA]/20 rounded-xl bg-[#F8F8FD] overflow-hidden sticky top-0 z-10 shadow-md">
      {/* Header bar — always visible */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[#3540CA] text-base">🤖</span>
          <span className="text-sm font-medium text-[#3540CA]">Ask AI about these results</span>
        </div>
        <button
          onClick={() => setOpen(o => !o)}
          className="text-xs text-[#3540CA]/60 hover:text-[#3540CA] transition-colors px-2 py-1 rounded-lg hover:bg-[#3540CA]/10"
        >
          {open ? 'Collapse ▲' : 'Expand ▼'}
        </button>
      </div>

      {/* Starter questions — always visible when no messages yet */}
      {!open && messages.length === 0 && (
        <div className="px-4 pb-3 flex flex-wrap gap-2">
          {starterQuestions.map(q => (
            <button
              key={q}
              onClick={() => send(q)}
              className="text-xs px-3 py-1.5 rounded-full border border-[#3540CA]/25 text-[#3540CA] hover:bg-[#3540CA] hover:text-white transition-colors bg-white"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Expanded panel */}
      {open && (
        <div className="border-t border-[#3540CA]/10">
          {/* Starter questions when no conversation yet */}
          {messages.length === 0 && (
            <div className="px-4 pt-3 pb-2 flex flex-wrap gap-2">
              {starterQuestions.map(q => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="text-xs px-3 py-1.5 rounded-full border border-[#3540CA]/25 text-[#3540CA] hover:bg-[#3540CA] hover:text-white transition-colors bg-white"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Messages */}
          {messages.length > 0 && (
            <div className="px-4 py-3 space-y-3 max-h-72 overflow-y-auto">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-[#3540CA] text-white rounded-br-sm'
                      : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
                  }`}>
                    {msg.role === 'assistant' && !msg.content
                      ? <span className="animate-pulse text-gray-400">●●●</span>
                      : msg.content}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}

          {/* Input */}
          <div className="px-4 pb-3 pt-1 flex gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a follow-up question…"
              rows={1}
              disabled={streaming}
              className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#3540CA]/40 disabled:opacity-50 bg-white"
            />
            <button
              onClick={() => send(input)}
              disabled={streaming || !input.trim()}
              className="bg-[#3540CA] hover:bg-[#2a34b0] text-white px-3 rounded-xl transition-colors disabled:opacity-40 text-sm"
            >
              {streaming ? '⏳' : '↑'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
