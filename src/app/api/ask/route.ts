import { google } from '@ai-sdk/google';
import { createUIMessageStream, createUIMessageStreamResponse, streamText } from 'ai';
import { createHash } from 'crypto';
import { supabase } from '../../../../scripts/lib/supabase';
import {
  ANSWER_MODEL,
  REFUSAL_MESSAGE,
  buildSourcesPayload,
  buildSystemPrompt,
  retrieve,
} from '../../../../scripts/lib/rag';

export const runtime = 'nodejs';

const MAX_QUESTION_CHARS = 500;
const PER_IP_PER_HOUR = Number(process.env.RATE_LIMIT_PER_HOUR ?? 15);
const GLOBAL_PER_DAY = Number(process.env.RATE_LIMIT_PER_DAY ?? 300);

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// One-way hash so we never store a raw IP address
function hashIp(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  return createHash('sha256')
    .update(ip + (process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''))
    .digest('hex')
    .slice(0, 32);
}

async function countSince(ms: number, ipHash?: string) {
  const since = new Date(Date.now() - ms).toISOString();
  let query = supabase
    .from('query_log')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', since);
  if (ipHash) query = query.eq('ip_hash', ipHash);
  const { count } = await query;
  return count ?? 0;
}

export async function POST(req: Request) {
  const started = Date.now();
  const body = await req.json();

  // Support both shapes: a direct {question} (curl/testing)
  // and the useChat {messages: [...]} format (the UI)
  let question: string | undefined;
  if (typeof body.question === 'string') {
    question = body.question;
  } else if (Array.isArray(body.messages)) {
    const lastUser = [...body.messages].reverse().find((m: any) => m.role === 'user');
    if (lastUser?.parts) {
      question = lastUser.parts
        .filter((p: any) => p.type === 'text')
        .map((p: any) => p.text)
        .join(' ');
    }
  }

  if (!question || question.trim().length === 0) {
    return json({ error: 'Question is required.' }, 400);
  }
  question = question.trim();
  if (question.length > MAX_QUESTION_CHARS) {
    return json({ error: `Please keep questions under ${MAX_QUESTION_CHARS} characters.` }, 400);
  }

  // Rate limiting (production only, so local testing isn't throttled)
  const ipHash = hashIp(req);
  if (process.env.NODE_ENV === 'production') {
    const [ipCount, globalCount] = await Promise.all([
      countSince(60 * 60 * 1000, ipHash),
      countSince(24 * 60 * 60 * 1000),
    ]);
    if (ipCount >= PER_IP_PER_HOUR) {
      return json(
        { error: `Rate limit reached: ${PER_IP_PER_HOUR} questions per hour. Please try again later.` },
        429
      );
    }
    if (globalCount >= GLOBAL_PER_DAY) {
      return json(
        { error: 'This free demo has reached its daily limit. Please try again tomorrow.' },
        429
      );
    }
  }

  // Log the question up front so it counts toward the limits immediately
  const { data: logRow } = await supabase
    .from('query_log')
    .insert({ question, ip_hash: ipHash })
    .select('id')
    .single();
  const logId: string | undefined = logRow?.id;

  // Retrieve (embed + hybrid search + gate decision)
  let retrieval: Awaited<ReturnType<typeof retrieve>>;
  try {
    retrieval = await retrieve(question);
  } catch {
    return json({ error: 'Retrieval failed. Please try again in a moment.' }, 503);
  }
  const { results, refuse } = retrieval;

       if (refuse) {
         if (logId) {
           await supabase
             .from('query_log')
             .update({ answer: REFUSAL_MESSAGE, refused: true, latency_ms: Date.now() - started })
             .eq('id', logId);
         }
         const stream = createUIMessageStream({
           execute: ({ writer }) => {
             writer.write({ type: 'text-start', id: 'refusal' });
             writer.write({ type: 'text-delta', id: 'refusal', delta: REFUSAL_MESSAGE });
             writer.write({ type: 'text-end', id: 'refusal' });
           },
         });
         return createUIMessageStreamResponse({ stream });
       }
  // Stream the answer, then record it in the log
  const result = streamText({
    model: google(ANSWER_MODEL),
    system: buildSystemPrompt(results),
    prompt: question,
    onFinish: async ({ text }) => {
      if (!logId) return;
      await supabase
        .from('query_log')
        .update({
          answer: text,
          retrieved_ids: results.map((r) => r.chunk_id),
          latency_ms: Date.now() - started,
        })
        .eq('id', logId);
    },
  });

  const sources = buildSourcesPayload(results);
  return result.toUIMessageStreamResponse({
    messageMetadata: () => ({ sources }),
  });
}