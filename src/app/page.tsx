'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';

type Source = {
  label: string;
  title: string;
  sourceType: 'statutory' | 'handbook';
  sectionPath: string;
};

const STARTERS = [
  'How many days of annual leave do I get?',
  'How many weeks of paternity leave am I entitled to?',
  'What is the overtime pay rate?',
  'How much notice do I need to give when resigning?',
];

const CITATION_GROUP = /\[(S\d+(?:\s*,\s*S\d+)*)\]/g;

// Turn "[S1, S2]" into clickable-style markdown links so we can render them as chips
function linkCitations(text: string) {
  return text.replace(CITATION_GROUP, (_, group: string) =>
    group
      .split(',')
      .map((s) => `[${s.trim()}](#cite)`)
      .join(' ')
  );
}

function citedLabels(text: string): Set<string> {
  const labels = new Set<string>();
  for (const match of text.matchAll(CITATION_GROUP)) {
    match[1].split(',').forEach((s) => labels.add(s.trim()));
  }
  return labels;
}

const mdComponents: Components = {
  a: ({ href, children }) =>
    href === '#cite' ? (
      <span className="mx-0.5 inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 align-baseline text-[11px] font-semibold text-slate-600">
        {children}
      </span>
    ) : (
      <a href={href} target="_blank" rel="noreferrer" className="text-blue-600 underline">
        {children}
      </a>
    ),
  p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
  strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
};

function SourceBadge({ type }: { type: Source['sourceType'] }) {
  const statutory = type === 'statutory';
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
        statutory ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
      }`}
    >
      {statutory ? 'Statutory' : 'Handbook'}
    </span>
  );
}

export default function Home() {
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: '/api/ask' }),
  });
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const busy = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  const ask = (text: string) => {
    if (!text.trim() || busy) return;
    sendMessage({ text });
    setInput('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    ask(input);
  };

  return (
    <div className="flex h-dvh flex-col bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white">
              HR
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight">HR Policy Q&amp;A</h1>
              <p className="text-xs text-slate-500">
                Singapore employment rules and a sample company handbook
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
            <span className="font-medium text-slate-600">Source key</span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm border border-blue-200 bg-blue-100" />
              Statutory (MOM / CPF)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm border border-amber-200 bg-amber-100" />
              Company handbook (Acme Pte Ltd, fictional)
            </span>
          </div>
        </div>
      </header>

      {/* Conversation */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
          {messages.length === 0 && (
            <div className="pt-6 text-center">
              <h2 className="text-xl font-semibold">What would you like to know?</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                Every answer is grounded in the policy sources and cites where it came from. If the
                sources don&apos;t cover a question, the assistant says so.
              </p>
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                {STARTERS.map((q) => (
                  <button
                    key={q}
                    onClick={() => ask(q)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => {
            const text = m.parts
              .filter((p) => p.type === 'text')
              .map((p) => (p as { text: string }).text)
              .join('');

            if (m.role === 'user') {
              return (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-slate-900 px-4 py-2.5 text-sm text-white">
                    {text}
                  </div>
                </div>
              );
            }

            const allSources: Source[] = (m.metadata as { sources?: Source[] } | undefined)?.sources ?? [];
            const cited = citedLabels(text);
            const shown = allSources.filter((s) => cited.has(s.label));

            return (
              <div key={m.id} className="max-w-[95%]">
                <div className="rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
                  <ReactMarkdown components={mdComponents}>{linkCitations(text)}</ReactMarkdown>

                  {shown.length > 0 && (
                    <div className="mt-4 border-t border-slate-100 pt-3">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        Sources
                      </p>
                      <ul className="space-y-1.5">
                        {shown.map((s) => (
                          <li
                            key={s.label}
                            title={s.sectionPath}
                            className="flex items-center gap-2 text-xs text-slate-600"
                          >
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-600">
                              {s.label}
                            </span>
                            <span className="min-w-0 flex-1 truncate">{s.title}</span>
                            <SourceBadge type={s.sourceType} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {status === 'submitted' && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
              </span>
              Searching the policy sources…
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Something went wrong while answering. Please try again in a moment.
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </main>

      {/* Input */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about leave, overtime, notice periods, CPF…"
              className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Ask
            </button>
          </form>
          <p className="mt-2 text-center text-[11px] text-slate-400">
            Informational only, not legal advice. Demo built on public MOM/CPF pages and a fictional
            handbook. Please don&apos;t enter personal information.
          </p>
        </div>
      </footer>
    </div>
  );
}