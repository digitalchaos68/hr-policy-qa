'use client';

import { useChat } from '@ai-sdk/react';
import { useState } from 'react';
import { DefaultChatTransport } from 'ai';

export default function Home() {
const { messages, sendMessage, status } = useChat({
  transport: new DefaultChatTransport({ api: '/api/ask' }),
});
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage({ text: input });
    setInput('');
  };

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '1rem', fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: '1.4rem', marginBottom: '0.25rem' }}>HR Policy Q&amp;A Assistant</h1>
      <p style={{ color: '#666', fontSize: '0.85rem', marginBottom: '1rem' }}>
        Answers are grounded in Singapore MOM/CPF guidance and a sample company handbook (Acme Pte Ltd, fictional). Not legal advice.
      </p>
<div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem', fontSize: '0.78rem', color: '#555' }}>
  <span style={{ fontWeight: 600 }}>Source key:</span>
  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
    <span style={{ width: 12, height: 12, borderRadius: 3, background: '#e6f0ff', border: '1px solid #b3d1ff', display: 'inline-block' }} />
    Statutory (MOM/CPF)
  </span>
  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
    <span style={{ width: 12, height: 12, borderRadius: 3, background: '#fff2e0', border: '1px solid #ffdca3', display: 'inline-block' }} />
    Company Handbook
  </span>
</div>
      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: '1rem', minHeight: 300, marginBottom: '1rem' }}>
        {messages.length === 0 && (
          <p style={{ color: '#999' }}>Try: &quot;How many days of annual leave do I get?&quot;</p>
        )}
        {messages.map((m) => (
  <div key={m.id} style={{ marginBottom: '1rem' }}>
    <strong>{m.role === 'user' ? 'You' : 'Assistant'}:</strong>
    <div style={{ whiteSpace: 'pre-wrap', marginTop: '0.25rem' }}>
      {m.parts.map((part, i) =>
        part.type === 'text' ? <span key={i}>{part.text}</span> : null
      )}
    </div>
    {m.role === 'assistant' && (m.metadata as any)?.sources?.length > 0 && (
      <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
        {(m.metadata as any).sources.map((s: any) => (
          <span
            key={s.label}
            title={s.sectionPath}
            style={{
              fontSize: '0.75rem',
              padding: '0.2rem 0.5rem',
              borderRadius: 12,
              background: s.sourceType === 'statutory' ? '#e6f0ff' : '#fff2e0',
              color: s.sourceType === 'statutory' ? '#1a4d99' : '#996300',
              border: '1px solid ' + (s.sourceType === 'statutory' ? '#b3d1ff' : '#ffdca3'),
            }}
          >
            [{s.label}] {s.title} {s.sourceType === 'statutory' ? '(Statutory)' : '(Handbook)'}
          </span>
        ))}
      </div>
    )}
  </div>
))}
        {status === 'streaming' && <p style={{ color: '#999' }}>Thinking…</p>}
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question…"
          style={{ flex: 1, padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4 }}
        />
        <button
          type="submit"
          disabled={status === 'streaming'}
          style={{ padding: '0.5rem 1rem', borderRadius: 4, border: 'none', background: '#111', color: '#fff' }}
        >
          Ask
        </button>
      </form>
    </div>
  );
}