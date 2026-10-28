'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Sparkles, AlertCircle, Bot, User } from 'lucide-react';
import { AISettings, ChatMessage } from '@/types/sticker';
import { sendChatMessage } from '@/lib/aiClient';
import { Icon, Palette } from '@/lib/funIsometric';

interface AISidebarProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AISettings;
  onOpenSettings: () => void;
  icon: Icon;
  palette: Palette;
  selectedLayerId: string | null;
}

const QUICK_ACTIONS = [
  '🎨 Sarankan kombinasi role warna untuk layer ini',
  '💫 Ide motion preset yang cocok untuk stiker ini',
  '📁 Jelaskan cara kerja Grouping & Motion Sync',
  '📐 Berapa tebal outline & depth isometrik terbaik?',
];

export const AISidebar: React.FC<AISidebarProps> = ({
  isOpen,
  onClose,
  settings,
  onOpenSettings,
  icon,
  palette,
  selectedLayerId,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome',
      sender: 'ai',
      text: 'Hello! I am your Motion-Track Assistant. I can help with isometric sticker concepts, role-based color palettes (Slush/Riso/Candy), and keyframe motions. How can I help you today?',
      timestamp: 0,
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading]);

  const msgCounterRef = useRef<number>(1);

  const handleSend = async (promptToSend?: string) => {
    const text = (promptToSend || input).trim();
    if (!text || isLoading) return;

    if (!settings.apiKey) {
      setErrorMessage('Please configure your API Key in the Settings menu first.');
      return;
    }

    setErrorMessage(null);
    msgCounterRef.current += 1;
    const userMsg: ChatMessage = {
      id: `msg-${msgCounterRef.current}`,
      sender: 'user',
      text,
      timestamp: msgCounterRef.current,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const reply = await sendChatMessage(messages, text, settings, {
        icon,
        palette,
        selectedLayerId,
      });
      msgCounterRef.current += 1;
      const aiMsg: ChatMessage = {
        id: `msg-${msgCounterRef.current}`,
        sender: 'ai',
        text: reply,
        timestamp: msgCounterRef.current,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reach AI endpoint.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <aside className="fixed right-0 top-14 bottom-0 w-84 sm:w-96 bg-white/95 backdrop-blur-xl border-l border-slate-200/80 shadow-2xl z-40 flex flex-col select-none">
      {/* Header */}
      <div className="p-3.5 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shadow-blue-200">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="font-mono text-xs font-bold text-slate-900">AI Assistant</h4>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-600 font-medium">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  settings.apiKey ? 'bg-emerald-500' : 'bg-amber-400'
                }`}
              />
              <span>{settings.apiKey ? settings.model : 'Not Connected'}</span>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Warning if no API Key */}
      {!settings.apiKey && (
        <div className="p-3 bg-amber-50 border-b border-amber-200 flex items-start gap-2 text-xs font-mono text-amber-950 font-medium">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span>API Key is missing. Enter your AI URL & API Key in Settings.</span>
            <button
              onClick={onOpenSettings}
              className="mt-1 block underline font-bold hover:text-amber-950"
            >
              Open AI Settings
            </button>
          </div>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex gap-2.5 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {m.sender !== 'user' && (
              <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                <Bot className="w-3.5 h-3.5" />
              </div>
            )}

            <div
              className={`p-3 rounded-2xl max-w-[85%] font-sans leading-relaxed whitespace-pre-wrap font-normal ${
                m.sender === 'user'
                  ? 'bg-slate-900 text-white rounded-tr-none font-medium'
                  : 'bg-slate-50 border border-slate-300 text-slate-900 rounded-tl-none'
              }`}
            >
              {m.text}
            </div>

            {m.sender === 'user' && (
              <div className="w-6 h-6 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="p-3 bg-slate-50 border border-slate-300 rounded-2xl rounded-tl-none font-mono text-[11px] text-slate-700 font-medium flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ff6b35] animate-pulse" />
              <span>Generating sticker concepts...</span>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl font-mono text-[11px] text-red-700 font-medium">
            {errorMessage}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="px-3 py-2 border-t border-slate-200 bg-slate-50 flex flex-col gap-1">
        <span className="text-[10px] font-mono text-slate-700 font-bold">Quick Prompts:</span>
        <div className="flex flex-wrap gap-1">
          {QUICK_ACTIONS.map((action, i) => (
            <button
              key={i}
              onClick={() => handleSend(action)}
              className="text-[10px] font-mono text-slate-800 font-semibold bg-white border border-slate-300 hover:border-[#ff6b35] hover:bg-orange-50 px-2.5 py-1 rounded-lg transition truncate max-w-full shadow-2xs"
            >
              {action}
            </button>
          ))}
        </div>
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-slate-200 bg-white">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask sticker concepts, color palettes, motion..."
            className="flex-1 px-3 py-2 rounded-xl border border-slate-300 focus:border-[#ff6b35] focus:outline-none text-xs bg-slate-50 text-slate-900 font-medium placeholder:text-slate-500"
          />
          <button
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim()}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white transition shadow-sm"
          >
            <Send className="w-4 h-4 text-[#ff6b35]" />
          </button>
        </div>
      </div>
    </aside>
  );
};
