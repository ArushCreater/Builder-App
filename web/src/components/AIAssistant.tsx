import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Sparkles, X, ArrowUp, Square, RotateCcw, Copy, Check } from 'lucide-react';
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
  { title: 'Share a document', body: 'How do I share a doc with a client for approval?' },
  { title: 'Reminder recipients', body: 'Where do I set who gets every schedule reminder?' },
  { title: 'Daily log photos', body: 'How do I add photos to a daily log?' },
  { title: 'Mark as client', body: 'How do I mark a contact as a client?' },
];

// ── Minimal Markdown renderer (bold/italic/code/lists/links/code-block) ──
// Handles the subset Gemini typically returns. Keeps bundle weight zero.
function MarkdownText({ text }: { text: string }) {
  // Split out fenced code blocks first
  const blocks = text.split(/```([\s\S]*?)```/g);
  return (
    <>
      {blocks.map((block, i) => {
        if (i % 2 === 1) {
          // Code block — first line may be a language label
          const newline = block.indexOf('\n');
          const code = newline >= 0 ? block.slice(newline + 1) : block;
          return (
            <pre
              key={i}
              className="my-2 rounded-lg bg-slate-900 text-slate-100 text-[12.5px] leading-relaxed p-3 overflow-x-auto font-mono"
            >
              <code>{code.replace(/\n$/, '')}</code>
            </pre>
          );
        }
        return <InlineMarkdown key={i} text={block} />;
      })}
    </>
  );
}

function InlineMarkdown({ text }: { text: string }) {
  // Split into "blocks": paragraphs, list items, headings
  const lines = text.split('\n');
  const out: React.ReactNode[] = [];
  let listBuf: { ordered: boolean; items: string[] } | null = null;

  const flushList = () => {
    if (!listBuf) return;
    const Tag = listBuf.ordered ? 'ol' : 'ul';
    out.push(
      <Tag
        key={out.length}
        className={cn(
          'my-1.5 pl-5 space-y-0.5',
          listBuf.ordered ? 'list-decimal' : 'list-disc',
        )}
      >
        {listBuf.items.map((it, j) => (
          <li key={j}>{renderInline(it)}</li>
        ))}
      </Tag>,
    );
    listBuf = null;
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    const bullet = /^\s*[-*]\s+(.*)/.exec(line);
    const numbered = /^\s*\d+\.\s+(.*)/.exec(line);
    if (bullet) {
      if (!listBuf || listBuf.ordered) {
        flushList();
        listBuf = { ordered: false, items: [] };
      }
      listBuf.items.push(bullet[1]);
      continue;
    }
    if (numbered) {
      if (!listBuf || !listBuf.ordered) {
        flushList();
        listBuf = { ordered: true, items: [] };
      }
      listBuf.items.push(numbered[1]);
      continue;
    }
    flushList();
    if (!line.trim()) {
      out.push(<div key={out.length} className="h-2" />);
    } else {
      out.push(
        <p key={out.length} className="my-1 leading-relaxed">
          {renderInline(line)}
        </p>,
      );
    }
  }
  flushList();
  return <>{out}</>;
}

function renderInline(text: string): React.ReactNode {
  // Tokens: **bold**, *italic*, `code`, [link](url)
  const tokens: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/;
  while (remaining.length) {
    const m = re.exec(remaining);
    if (!m) {
      tokens.push(remaining);
      break;
    }
    if (m.index > 0) tokens.push(remaining.slice(0, m.index));
    if (m[2] !== undefined) {
      tokens.push(
        <strong key={key++} className="font-semibold text-slate-900">
          {m[2]}
        </strong>,
      );
    } else if (m[3] !== undefined) {
      tokens.push(
        <em key={key++} className="italic">
          {m[3]}
        </em>,
      );
    } else if (m[4] !== undefined) {
      tokens.push(
        <code key={key++} className="px-1 py-0.5 rounded bg-slate-100 text-slate-800 text-[12px] font-mono">
          {m[4]}
        </code>,
      );
    } else if (m[5] !== undefined && m[6] !== undefined) {
      tokens.push(
        <a
          key={key++}
          href={m[6]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 hover:text-indigo-700 underline decoration-indigo-300 underline-offset-2"
        >
          {m[5]}
        </a>,
      );
    }
    remaining = remaining.slice(m.index + m[0].length);
  }
  return <>{tokens}</>;
}

// ── AI avatar (gradient bubble with Sparkles) ──
function AIAvatar({ size = 28 }: { size?: number }) {
  return (
    <div
      className="rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-400 shadow-md flex items-center justify-center flex-shrink-0 ring-1 ring-white/40"
      style={{ width: size, height: size }}
    >
      <Sparkles
        className="text-white drop-shadow-sm"
        style={{ width: size * 0.55, height: size * 0.55 }}
      />
    </div>
  );
}

// ── Animated "thinking" dots (shown until first stream chunk arrives) ──
function ThinkingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      <span className="ai-dot ai-dot-1" />
      <span className="ai-dot ai-dot-2" />
      <span className="ai-dot ai-dot-3" />
    </div>
  );
}

// ── Copy-to-clipboard button for AI messages ──
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700"
      title="Copy"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export function AIAssistant({ open, onClose }: Props) {
  const [messages, setMessages] = useState<Msg[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as Msg[];
    } catch { /* ignore */ }
    return [];
  });
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Persist conversation
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch { /* ignore */ }
  }, [messages]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  });

  // Focus on open
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open]);

  // Escape closes
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !streaming) onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose, streaming]);

  // Auto-grow textarea
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, [input]);

  const stop = useCallback(() => {
    // Aborts an in-flight request OR skips the typing animation, revealing
    // the full text immediately.
    abortRef.current?.abort();
    abortRef.current = null;
    skipTypingRef.current = true;
    if (typeRafRef.current !== null) {
      cancelAnimationFrame(typeRafRef.current);
      typeRafRef.current = null;
    }
  }, []);

  const typeOut = useCallback((fullText: string, assistantId: string) => {
    return new Promise<void>((resolve) => {
      skipTypingRef.current = false;
      let i = 0;
      // ~3 chars per frame ≈ 180 chars/sec at 60fps. Feels lively but readable.
      const charsPerFrame = 3;
      const tick = () => {
        if (skipTypingRef.current) {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: fullText } : m)),
          );
          typeRafRef.current = null;
          resolve();
          return;
        }
        i = Math.min(i + charsPerFrame, fullText.length);
        const slice = fullText.slice(0, i);
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: slice } : m)),
        );
        if (i >= fullText.length) {
          typeRafRef.current = null;
          resolve();
          return;
        }
        typeRafRef.current = requestAnimationFrame(tick);
      };
      typeRafRef.current = requestAnimationFrame(tick);
    });
  }, []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;

      const userMsg: Msg = { id: crypto.randomUUID(), role: 'user', content: trimmed };
      const assistantId = crypto.randomUUID();
      const placeholder: Msg = { id: assistantId, role: 'assistant', content: '' };
      const baseMessages = [...messages, userMsg];
      setMessages([...baseMessages, placeholder]);
      setInput('');
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            messages: baseMessages.map(({ role, content }) => ({ role, content })),
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          let msg = `HTTP ${res.status}`;
          try { const j = await res.json(); if (j?.message) msg = j.message; } catch { /* ignore */ }
          throw new Error(msg);
        }
        const json = (await res.json()) as { reply?: string };
        const reply = (json.reply || '').trim();
        if (!reply) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: '⚠️ No response received.' } : m,
            ),
          );
        } else {
          await typeOut(reply, assistantId);
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: m.content || '_Stopped before any response._' }
                : m,
            ),
          );
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: `⚠️ ${err?.message || 'Something went wrong.'}` }
                : m,
            ),
          );
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
        skipTypingRef.current = false;
      }
    },
    [messages, streaming, typeOut],
  );

  const reset = () => {
    if (streaming) return;
    setMessages([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  };

  return (
    <>
      <style>{`
        @keyframes ai-msg-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .ai-msg-in { animation: ai-msg-in 280ms cubic-bezier(0.22, 1, 0.36, 1) both; }

        @keyframes ai-cursor-blink {
          0%, 60% { opacity: 1; }
          60.01%, 100% { opacity: 0; }
        }
        .ai-cursor {
          display: inline-block;
          width: 8px;
          height: 1.05em;
          background: linear-gradient(180deg, #6366f1, #06b6d4);
          border-radius: 2px;
          vertical-align: text-bottom;
          margin-left: 2px;
          animation: ai-cursor-blink 1s infinite steps(1);
        }

        @keyframes ai-dot-pulse {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
        .ai-dot {
          width: 7px;
          height: 7px;
          border-radius: 999px;
          background: linear-gradient(135deg, #6366f1, #06b6d4);
          animation: ai-dot-pulse 1.2s infinite ease-in-out;
        }
        .ai-dot-1 { animation-delay: -0.32s; }
        .ai-dot-2 { animation-delay: -0.16s; }
        .ai-dot-3 { animation-delay: 0s; }

        @keyframes ai-aurora {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .ai-aurora {
          background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 30%, #134e4a 60%, #0f172a 100%);
          background-size: 300% 300%;
          animation: ai-aurora 18s ease infinite;
        }
      `}</style>

      {/* Mobile backdrop only */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm sm:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed top-0 right-0 z-50 h-screen w-full sm:w-[440px] flex flex-col',
          'bg-slate-50 sm:bg-white/95 sm:backdrop-blur-xl',
          'border-l border-slate-200 shadow-[-12px_0_40px_-12px_rgba(15,23,42,0.18)]',
          'transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
        aria-hidden={!open}
      >
        {/* Header */}
        <header className="ai-aurora text-white px-5 py-4 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-900/10 pointer-events-none" />
          <div className="relative flex items-center gap-3">
            <AIAvatar size={36} />
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-[15px] leading-tight tracking-tight">BuilderOS Assistant</h2>
              <p className="text-[11px] text-slate-300 mt-0.5 flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                {streaming ? 'Generating…' : 'Online · Powered by Gemini'}
              </p>
            </div>
            {messages.length > 0 && !streaming && (
              <button
                onClick={reset}
                className="h-10 w-10 sm:h-8 sm:w-8 rounded-lg hover:bg-white/10 active:bg-white/20 flex items-center justify-center text-slate-200 hover:text-white transition-colors"
                title="New conversation"
                aria-label="Start new conversation"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="h-10 w-10 sm:h-8 sm:w-8 rounded-lg hover:bg-white/10 active:bg-white/20 flex items-center justify-center text-slate-200 hover:text-white transition-colors"
              title="Close"
              aria-label="Close AI Assistant"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Messages area */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 pt-5 pb-2 bg-gradient-to-b from-slate-50 to-white"
        >
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center gap-5 py-6">
              <div className="relative">
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-indigo-400/40 to-cyan-300/40 blur-xl" />
                <div className="relative h-20 w-20 rounded-3xl bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-400 flex items-center justify-center shadow-xl ring-1 ring-white/50">
                  <Sparkles className="h-10 w-10 text-white drop-shadow-md" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">How can I help?</h3>
                <p className="text-sm text-slate-500 mt-1 max-w-xs">
                  Ask anything about BuilderOS — sharing docs, schedules, photos, contacts, settings.
                </p>
              </div>
              <div className="w-full grid grid-cols-1 gap-2 mt-1">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.title}
                    onClick={() => send(s.body)}
                    className="group text-left px-4 py-3 rounded-xl bg-white border border-slate-200/80 hover:border-indigo-300 hover:shadow-sm hover:bg-indigo-50/40 transition-all"
                  >
                    <div className="text-[13px] font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors">
                      {s.title}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">{s.body}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {messages.map((m, idx) => {
                const isLastAssistant =
                  m.role === 'assistant' && idx === messages.length - 1 && streaming;
                if (m.role === 'user') {
                  return (
                    <div key={m.id} className="ai-msg-in flex justify-end">
                      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-br from-indigo-600 to-indigo-700 text-white px-3.5 py-2.5 text-[14px] leading-relaxed shadow-sm whitespace-pre-wrap">
                        {m.content}
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={m.id} className="ai-msg-in flex gap-2.5 group">
                    <AIAvatar size={26} />
                    <div className="flex-1 min-w-0">
                      <div className="rounded-2xl rounded-tl-md bg-white border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_12px_-6px_rgba(15,23,42,0.08)] px-3.5 py-2.5 text-[14px] text-slate-800">
                        {m.content === '' && isLastAssistant ? (
                          <ThinkingDots />
                        ) : (
                          <>
                            <div className="ai-md">
                              <MarkdownText text={m.content} />
                            </div>
                            {isLastAssistant && <span className="ai-cursor" />}
                          </>
                        )}
                      </div>
                      {m.content && !isLastAssistant && (
                        <div className="flex items-center gap-1 mt-1 pl-1">
                          <CopyButton text={m.content} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="px-3 pt-2 pb-3 border-t border-slate-200/80 bg-white/90 backdrop-blur">
          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className={cn(
              'flex items-end gap-2 rounded-2xl border bg-white px-3 py-2 transition-all',
              'shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)]',
              streaming
                ? 'border-slate-200'
                : 'border-slate-200 focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-100/60',
            )}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (!streaming) send(input);
                }
              }}
              placeholder={streaming ? 'Generating response…' : 'Message BuilderOS Assistant…'}
              rows={1}
              className="flex-1 bg-transparent text-[14px] text-slate-900 placeholder:text-slate-400 outline-none resize-none py-1"
              style={{ minHeight: '22px', maxHeight: '160px' }}
              disabled={streaming}
            />
            {streaming ? (
              <button
                type="button"
                onClick={stop}
                className="h-9 w-9 rounded-full bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center flex-shrink-0 transition-colors shadow-sm"
                title="Stop generating"
              >
                <Square className="h-3.5 w-3.5 fill-white" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className={cn(
                  'h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all shadow-sm',
                  input.trim()
                    ? 'bg-gradient-to-br from-indigo-500 to-indigo-700 hover:from-indigo-600 hover:to-indigo-800 text-white hover:shadow-md hover:-translate-y-0.5'
                    : 'bg-slate-100 text-slate-300 cursor-not-allowed',
                )}
                aria-label="Send"
              >
                <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
              </button>
            )}
          </form>
          <p className="text-[10px] text-slate-400 text-center mt-2">
            AI can make mistakes · <span className="font-medium">Enter</span> to send · <span className="font-medium">Shift+Enter</span> for a new line
          </p>
        </div>
      </aside>
    </>
  );
}

export default AIAssistant;
