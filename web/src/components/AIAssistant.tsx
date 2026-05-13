import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { Sparkles, X, Send, Loader2, RotateCcw } from 'lucide-react';
import { cn } from '../lib/utils';

interface Msg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const STORAGE_KEY = 'builderos-ai-chat';

const SUGGESTIONS = [
  'How do I share a doc with a client?',
  'Where do I set who gets schedule reminders?',
  'How do I add photos to a daily log?',
  'How do I mark a contact as a client?',
];

export function AIAssistant({ open, onClose }: Props) {
  const [messages, setMessages] = useState<Msg[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as Msg[];
    } catch { /* ignore */ }
    return [];
  });
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Persist chat across reloads (it's nice if the user can leave & come back)
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch { /* ignore */ }
  }, [messages]);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, open]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [open]);

  // Escape closes
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const chatMutation = useMutation({
    mutationFn: (payload: { messages: { role: 'user' | 'assistant'; content: string }[] }) =>
      apiClient.post<{ reply: string }>('/ai/chat', payload),
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: data.reply },
      ]);
    },
    onError: (err: any) => {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `⚠️ ${err?.message || 'Something went wrong. Try again.'}`,
        },
      ]);
    },
  });

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || chatMutation.isPending) return;
    const userMsg: Msg = { id: crypto.randomUUID(), role: 'user', content: trimmed };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    chatMutation.mutate({
      messages: next.map(({ role, content }) => ({ role, content })),
    });
  };

  const reset = () => {
    setMessages([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  };

  return (
    <>
      {/* Backdrop on mobile only — desktop just lets the sidebar overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm sm:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed top-0 right-0 z-50 h-screen w-full sm:w-[420px] bg-white border-l border-slate-200 shadow-2xl flex flex-col transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
        aria-hidden={!open}
      >
        {/* Header */}
        <header className="flex items-center gap-3 px-5 py-4 bg-slate-900 text-white">
          <div className="h-9 w-9 rounded-xl bg-white/15 border border-white/30 flex items-center justify-center shadow-inner flex-shrink-0">
            <Sparkles className="h-5 w-5 text-cyan-300" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-base leading-tight">BuilderOS Assistant</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Ask me anything about the app</p>
          </div>
          {messages.length > 0 && (
            <button
              onClick={reset}
              className="h-8 w-8 rounded-full hover:bg-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
              title="Reset conversation"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full hover:bg-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4 bg-slate-50">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center gap-4 py-8">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-cyan-100 flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-indigo-500" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Hi! Ask me anything.</h3>
                <p className="text-sm text-slate-500 mt-1">
                  I know how every feature in BuilderOS works.
                </p>
              </div>
              <div className="w-full space-y-2 mt-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="w-full text-left px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-700 hover:bg-indigo-50 hover:border-indigo-200 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  'flex',
                  m.role === 'user' ? 'justify-end' : 'justify-start',
                )}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap shadow-sm',
                    m.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-sm'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-bl-sm',
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))
          )}
          {chatMutation.isPending && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-3.5 py-2.5 flex items-center gap-2 shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                <span className="text-sm text-slate-500">Thinking…</span>
              </div>
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-slate-200 px-3 py-3 bg-white">
          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 focus-within:border-indigo-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-100 px-3 py-2 transition-colors"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Ask anything about the app…"
              rows={1}
              className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none resize-none max-h-32 py-1"
              style={{ minHeight: '22px' }}
              disabled={chatMutation.isPending}
            />
            <button
              type="submit"
              disabled={!input.trim() || chatMutation.isPending}
              className="h-8 w-8 rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors flex-shrink-0"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
          <p className="text-[10px] text-slate-400 text-center mt-2">
            AI can make mistakes. Verify important steps in the app.
          </p>
        </div>
      </aside>
    </>
  );
}

export default AIAssistant;
