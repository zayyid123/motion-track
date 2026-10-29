'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Bot, Check, Image as ImageIcon, Send, Sparkles, User, X } from 'lucide-react';
import type { AISettings, ChatMessage } from '@/lib/ai/types';
import { parseAIResponse } from '@/lib/ai/actions';
import type { AIAction, AIApplyOutcome } from '@/lib/ai/actions';
import { sendChatMessage } from '@/lib/ai/transport';
import { fileToDataUrl } from '@/lib/ai/imageUtils';
import type { Icon, Palette, View } from '@/lib/funIsometric/fun';

interface AISidebarProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AISettings;
  onOpenSettings: () => void;
  icon: Icon;
  palette: Palette;
  paletteId: string;
  facing: View;
  selectedLayerId: string | null;
  onApplyActions: (actions: AIAction[]) => AIApplyOutcome;
}

const QUICK_ACTIONS = [
  '💡 Create a detailed glowing light bulb sticker with sparkles',
  '🪙 Create a detailed gold coin with engraved star',
  '⭐ Create a layered sparkling star with highlights',
  '🎨 Change palette to matcha',
];

const WELCOME =
  'Hello! I am your Motion-Track assistant. Ask me about isometric sticker concepts, role-based palettes, motion presets, and group containers — or tell me what to change and I will apply it to the project.';

export const AISidebar: React.FC<AISidebarProps> = ({
  isOpen,
  onClose,
  settings,
  onOpenSettings,
  icon,
  palette,
  paletteId,
  facing,
  selectedLayerId,
  onApplyActions,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'welcome', sender: 'ai', text: WELCOME, timestamp: 0 },
  ]);
  const [input, setInput] = useState('');
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [pendingImageName, setPendingImageName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef(1);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const relayNeedsConsent = settings.transport === 'relay' && !settings.relayConsent;

  const handleAttachFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please attach an image file (PNG, JPG, WebP, GIF).');
      return;
    }
    try {
      setErrorMessage(null);
      const dataUrl = await fileToDataUrl(file);
      setPendingImage(dataUrl);
      setPendingImageName(file.name);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to read image.');
    }
  };

  const handleSend = async (promptToSend?: string) => {
    const text = (promptToSend ?? input).trim();
    const imageToSend = pendingImage ?? undefined;
    if ((!text && !imageToSend) || isLoading) return;

    if (!settings.apiKey) {
      setErrorMessage('Add an API key in Settings before using the assistant.');
      return;
    }
    if (relayNeedsConsent) {
      setErrorMessage('Server relay needs explicit consent. Enable it in Settings or switch to direct mode.');
      return;
    }

    setErrorMessage(null);
    counterRef.current += 1;
    const userMessage: ChatMessage = {
      id: `msg-${counterRef.current}`,
      sender: 'user',
      text: text || 'Create an isometric animated sticker based on this reference image.',
      image: imageToSend,
      timestamp: counterRef.current,
    };

    const history = messages;
    setMessages((current) => [...current, userMessage]);
    setInput('');
    setPendingImage(null);
    setPendingImageName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const raw = await sendChatMessage(
        history,
        text || 'Create an isometric animated sticker based on this reference image.',
        settings,
        { icon, palette, paletteId, facing, selectedLayerId },
        controller.signal,
        imageToSend
      );

      // The model answers with { reply, actions }. Valid actions are applied
      // immediately; anything rejected is surfaced with the message.
      const parsed = parseAIResponse(raw);
      const outcome =
        parsed.actions.length > 0
          ? onApplyActions(parsed.actions)
          : { applied: [], skipped: [], changed: false };
      const skipped = [...parsed.warnings, ...outcome.skipped];

      counterRef.current += 1;
      setMessages((current) => [
        ...current,
        {
          id: `msg-${counterRef.current}`,
          sender: 'ai',
          text: parsed.reply,
          timestamp: counterRef.current,
          applied: outcome.applied,
          skipped,
          raw,
        },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reach the AI endpoint.';
      setErrorMessage(message);
    } finally {
      abortRef.current = null;
      setIsLoading(false);
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
  };

  if (!isOpen) return null;

  const statusText = !settings.apiKey
    ? 'Not connected'
    : settings.transport === 'relay'
    ? `${settings.model} · relay`
    : `${settings.model} · direct`;

  return (
    <aside
      aria-label="AI assistant"
      className="fixed bottom-0 right-0 top-14 z-40 flex w-full max-w-full select-none flex-col border-l border-slate-200/80 bg-white/95 shadow-2xl backdrop-blur-xl sm:w-96"
    >
      <div className="flex items-center justify-between border-b border-slate-200/80 bg-slate-50/50 p-3.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-200">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div>
            <h2 className="font-mono text-xs font-bold text-slate-900">AI Assistant</h2>
            <div className="flex items-center gap-1.5 font-mono text-[10px] font-medium text-slate-600">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  settings.apiKey && !relayNeedsConsent ? 'bg-emerald-500' : 'bg-amber-400'
                }`}
              />
              <span className="truncate">{statusText}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            handleStop();
            onClose();
          }}
          aria-label="Close AI assistant"
          className="rounded-lg p-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6b35]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {(!settings.apiKey || relayNeedsConsent) && (
        <div
          role="alert"
          className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 p-3 font-mono text-xs font-medium text-amber-950"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="flex-1">
            <span>
              {relayNeedsConsent
                ? 'Server relay is selected but consent is missing.'
                : 'API key is missing. Enter your endpoint and key in Settings.'}
            </span>
            <button
              type="button"
              onClick={onOpenSettings}
              className="mt-1 block underline underline-offset-2 transition hover:text-amber-950"
            >
              Open AI settings
            </button>
          </div>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 space-y-3.5 overflow-y-auto p-4 text-xs">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-2.5 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.sender !== 'user' && (
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-blue-100 font-bold text-blue-700">
                <Bot className="h-3.5 w-3.5" />
              </div>
            )}

            <div
              className={`max-w-[85%] rounded-2xl p-3 font-sans font-normal leading-relaxed ${
                message.sender === 'user'
                  ? 'rounded-tr-none bg-slate-900 font-medium text-white'
                  : 'rounded-tl-none border border-slate-300 bg-slate-50 text-slate-900'
              }`}
            >
              {message.image && (
                <div className="mb-2 overflow-hidden rounded-xl border border-white/20 bg-black/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={message.image}
                    alt="Attached reference"
                    className="max-h-44 w-auto rounded-lg object-contain"
                  />
                </div>
              )}
              <span className="block whitespace-pre-wrap">{message.text}</span>

              {message.sender === 'ai' &&
              message.id !== 'welcome' &&
              (message.applied?.length ?? 0) === 0 &&
              (message.skipped?.length ?? 0) === 0 ? (
                <div className="mt-2 border-t border-slate-300/60 pt-1.5 font-mono text-[10px] text-slate-500">
                  ℹ️ Chat only (no actions executed on canvas).
                </div>
              ) : null}

              {message.sender === 'ai' &&
              ((message.applied?.length ?? 0) > 0 || (message.skipped?.length ?? 0) > 0) ? (
                <div className="mt-2 space-y-1.5 border-t border-slate-300/70 pt-2 font-mono text-[10px] leading-relaxed">
                  {message.applied?.length ? (
                    <div>
                      <span className="flex items-center gap-1 font-bold text-emerald-700">
                        <Check className="h-3 w-3" />
                        Applied to project
                      </span>
                      <ul className="mt-0.5 space-y-0.5 text-emerald-800">
                        {message.applied.map((item, index) => (
                          <li key={`${item}-${index}`}>· {item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {message.skipped?.length ? (
                    <div>
                      <span className="flex items-center gap-1 font-bold text-amber-700">
                        <AlertCircle className="h-3 w-3" />
                        Skipped
                      </span>
                      <ul className="mt-0.5 space-y-0.5 text-amber-800">
                        {message.skipped.map((item, index) => (
                          <li key={`${item}-${index}`}>· {item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {message.sender === 'user' && (
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
                <User className="h-3.5 w-3.5" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2.5" role="status" aria-live="polite">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-none border border-slate-300 bg-slate-50 p-3 font-mono text-[11px] font-medium text-slate-700">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ff6b35]" />
              <span>Thinking…</span>
            </div>
          </div>
        )}

        {errorMessage && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-2.5 font-mono text-[11px] font-medium text-red-700"
          >
            {errorMessage}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1 border-t border-slate-200 bg-slate-50 px-3 py-2">
        <span className="font-mono text-[10px] font-bold text-slate-700">Quick prompts</span>
        <div className="flex flex-wrap gap-1">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => handleSend(action)}
              className="max-w-full truncate rounded-lg border border-slate-300 bg-white px-2.5 py-1 font-mono text-[10px] font-semibold text-slate-800 shadow-sm transition hover:border-[#ff6b35] hover:bg-orange-50"
            >
              {action}
            </button>
          ))}
        </div>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void handleAttachFile(file);
        }}
        className={`border-t border-slate-200 bg-white p-3 transition ${
          isDragging ? 'bg-orange-50/80 ring-2 ring-inset ring-[#ff6b35]' : ''
        }`}
      >
        {isDragging && (
          <div className="mb-2 text-center font-mono text-[11px] font-bold text-[#ff6b35]">
            Drop image here to attach
          </div>
        )}

        {pendingImage && (
          <div className="mb-2.5 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-2 shadow-sm">
            <div className="flex items-center gap-2 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pendingImage}
                alt="Reference preview"
                className="h-10 w-10 shrink-0 rounded-lg border border-slate-200 bg-white object-cover"
              />
              <div className="min-w-0">
                <p className="truncate font-mono text-[11px] font-bold text-slate-800">
                  {pendingImageName || 'Reference image'}
                </p>
                <p className="font-mono text-[10px] text-slate-500">Ready to send with prompt</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setPendingImage(null);
                setPendingImageName(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
              aria-label="Remove image"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleAttachFile(file);
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Attach reference image (or paste/drag)"
            aria-label="Attach reference image"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-slate-50 text-slate-600 transition hover:border-[#ff6b35] hover:bg-orange-50 hover:text-[#ff6b35]"
          >
            <ImageIcon className="h-4 w-4" />
          </button>

          <label htmlFor="ai-chat-input" className="sr-only">
            Ask the AI assistant
          </label>
          <input
            id="ai-chat-input"
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onPaste={(event) => {
              const file = event.clipboardData.files?.[0];
              if (file && file.type.startsWith('image/')) {
                event.preventDefault();
                void handleAttachFile(file);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void handleSend();
              }
            }}
            placeholder={pendingImage ? 'Add instructions or press Enter…' : 'Ask or attach an image…'}
            className="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-500 focus:border-[#ff6b35] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6b35]/30"
          />
          {isLoading ? (
            <button
              type="button"
              onClick={handleStop}
              className="rounded-xl bg-red-600 p-2 text-white transition hover:bg-red-700"
              aria-label="Stop generating"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={!input.trim() && !pendingImage}
              aria-label="Send message"
              className="rounded-xl bg-slate-900 p-2 text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-40"
            >
              <Send className="h-4 w-4 text-[#ff6b35]" />
            </button>
          )}
        </div>
        <p className="mt-1.5 font-mono text-[10px] font-medium text-slate-500">
          Upload an image, paste from clipboard, or type a prompt.
        </p>
      </div>
    </aside>
  );
};
