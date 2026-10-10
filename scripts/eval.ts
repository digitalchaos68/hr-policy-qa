import fs from 'fs';
import path from 'path';
import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import { retrieve, buildSystemPrompt, ANSWER_MODEL, REFUSAL_MESSAGE, type RetrievedChunk } from './lib/rag';

const JUDGE_MODEL = process.env.JUDGE_MODEL ?? 'gemini-3.5-flash-lite';
const DELAY_MS = Number(process.env.EVAL_DELAY_MS ?? 4000);

interface ExpectedSource {
  title: string;
  section?: string;
}

interface EvalQuestion {
  id: string;
  category: string;
  question: string;
  expected_sources: ExpectedSource[];
  key_facts: string[];
  should_refuse: boolean;
  must_not_include?: string[];
}

interface Judgement {
  facts: boolean[];
  contradiction: boolean;
  declined: boolean;
}

interface QuestionResult {
  id: string;
  category: string;
  question: string;
  shouldRefuse: boolean;
  topSimilarity: number;
  retrievalHit: boolean | null;
  citationOk: boolean | null;
  answerCorrect: boolean | null;
  refusalOk: boolean | null;
  pass: boolean;
  failReasons: string[];
  answer: string;
  retrieved: string[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withRetry<T>(fn: () => Promise<T>, tries = 4): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      await sleep(5000 * (i + 1));
    }
  }
  throw lastErr;
}

function matchesSource(chunk: RetrievedChunk, exp: ExpectedSource): boolean {
  if (chunk.document_title !== exp.title) return false;
  if (!exp.section) return true;
  return chunk.section_path.toLowerCase().includes(exp.section.toLowerCase());
}

function citedIndexes(text: string): number[] {
  const out = new Set<number>();
  for (const m of text.matchAll(/\[(S\d+(?:\s*,\s*S\d+)*)\]/g)) {
    for (const part of m[1].split(',')) out.add(Number(part.trim().slice(1)));
  }
  return Array.from(out);
}

function parseJudgement(raw: string, nFacts: number): Judgement {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Judge returned no JSON');
  const obj = JSON.parse(match[0]) as Partial<Judgement>;
  const facts = Array.isArray(obj.facts) ? obj.facts.map(Boolean) : [];
  while (facts.length < nFacts) facts.push(false);
  return { facts, contradiction: Boolean(obj.contradiction), declined: Boolean(obj.declined) };
}

async function judge(q: EvalQuestion, answer: string): Promise<Judgement> {
  const factLines = q.key_facts.length
    ? q.key_facts.map((f, i) => `${i + 1}. ${f}`).join('\n')
    : '(none)';

  const prompt = `You are a strict grader for an HR policy assistant.

QUESTION: ${q.question}

ASSISTANT ANSWER:
"""
${answer}
"""

KEY FACTS a correct answer must convey:
${factLines}

Return ONLY a JSON object, with no other text:
{"facts":[true or false for each key fact, in order],"contradiction":true or false,"declined":true or false}

Rules:
- facts[i] is true only if the answer clearly conveys that fact (the wording may differ).
- contradiction is true if the answer states anything that conflicts with the key facts.
- declined is true if the answer says the sources do not cover the question, or otherwise refuses to give the requested information instead of answering it.`;

  const { text } = await withRetry(() => generateText({ model: google(JUDGE_MODEL), prompt }));
  return parseJudgement(text, q.key_facts.length);
}

const pct = (n: number, d: number) => (d === 0 ? 'n/a' : `${Math.round((100 * n) / d)}% (${n}/${d})`);

async function main() {
  const onlyArg = process.argv.find((a) => a.startsWith('--only='));
  const only = onlyArg ? onlyArg.slice('--only='.length).split(',') : null;

  const fileArg = process.argv.find((a) => a.startsWith('--file='));
  const file = fileArg ? fileArg.slice('--file='.length) : 'eval/questions.json';
  const label = path.basename(file, '.json');
  const prefix = label === 'questions' ? '' : `${label}-`;

  const all: EvalQuestion[] = JSON.parse(fs.readFileSync(path.join(process.cwd(), file), 'utf-8'));

  const questions = only ? all.filter((q) => only.includes(q.id)) : all;

  console.log(`Running ${questions.length} questions | answer model: ${ANSWER_MODEL} | judge model: ${JUDGE_MODEL}\n`);

  const results: QuestionResult[] = [];

  for (const q of questions) {
    const failReasons: string[] = [];
    let answer = '';
    let topSimilarity = 0;
    let retrieved: string[] = [];
    let retrievalHit: boolean | null = null;
    let citationOk: boolean | null = null;
    let answerCorrect: boolean | null = null;
    let refusalOk: boolean | null = null;

    try {
      const retrieval = await retrieve(q.question);
      const chunks = retrieval.results;
      topSimilarity = retrieval.topSimilarity;
      retrieved = chunks.map((r, i) => `S${i + 1}: ${r.section_path}`);

           // Same behaviour as the live app: the gate blocks first, otherwise the model answers
           if (retrieval.refuse) {
             answer = REFUSAL_MESSAGE;
           } else {
             const gen = await withRetry(() =>
               generateText({
                 model: google(ANSWER_MODEL),
                 system: buildSystemPrompt(chunks),
                 prompt: q.question,
               })
             );
             answer = gen.text;
             await sleep(DELAY_MS);
           }
      const judgement = await judge(q, answer);
      await sleep(DELAY_MS);

      const violated = (q.must_not_include ?? []).some((s) =>
        answer.toLowerCase().includes(s.toLowerCase())
      );
      if (violated) failReasons.push('answer contains forbidden text');

      // 1. Retrieval: every expected source appears in the top results
      if (q.expected_sources.length > 0) {
        retrievalHit = q.expected_sources.every((exp) => chunks.some((c) => matchesSource(c, exp)));
        if (!retrievalHit) failReasons.push('retrieval missed an expected source');
      }

      if (q.should_refuse) {
        // 4. Refusal
        refusalOk = judgement.declined && !violated;
        if (!judgement.declined) failReasons.push('should have declined but answered');
      } else {
        // 2. Citations: cited labels are valid and at least one points at an expected source
        const cited = citedIndexes(answer);
        const valid = cited.every((n) => n >= 1 && n <= chunks.length);
        const hitsExpected = cited.some((n) =>
          q.expected_sources.some((exp) => chunks[n - 1] && matchesSource(chunks[n - 1], exp))
        );
        citationOk = cited.length > 0 && valid && hitsExpected;
        if (!citationOk) failReasons.push('citations missing or not pointing at an expected source');

        // 3. Answer correctness
        const allFacts = judgement.facts.every(Boolean);
        answerCorrect = allFacts && !judgement.contradiction && !judgement.declined && !violated;
        if (!allFacts) failReasons.push('missing key fact(s)');
        if (judgement.contradiction) failReasons.push('contradicts key facts');
        if (judgement.declined) failReasons.push('declined an answerable question');
      }
    } catch (err) {
      failReasons.push(`error: ${err instanceof Error ? err.message.slice(0, 120) : String(err)}`);
      if (q.should_refuse) refusalOk = false;
      else answerCorrect = false;
    }

    const pass = q.should_refuse
      ? refusalOk === true
      : answerCorrect === true && retrievalHit !== false && citationOk !== false;

    results.push({
      id: q.id,
      category: q.category,
      question: q.question,
      shouldRefuse: q.should_refuse,
      topSimilarity,
      retrievalHit,
      citationOk,
      answerCorrect,
      refusalOk,
      pass,
      failReasons,
      answer,
      retrieved,
    });

    console.log(`${pass ? '✅' : '❌'} ${q.id}  sim ${topSimilarity.toFixed(3)}  ${q.question}`);
  }

  // ---- Summary ----
  const withSources = results.filter((r) => r.retrievalHit !== null);
  const answerable = results.filter((r) => !r.shouldRefuse);
  const refusals = results.filter((r) => r.shouldRefuse);

  const lines: string[] = [];
  lines.push(`## Evaluation results`);
  lines.push('');
  lines.push(`Run: ${new Date().toISOString()} | answer model: \`${ANSWER_MODEL}\` | judge model: \`${JUDGE_MODEL}\``);
  lines.push('');
  lines.push('| Metric | Result |');
  lines.push('|---|---|');
  lines.push(`| Retrieval hit (expected sources in top 8) | ${pct(withSources.filter((r) => r.retrievalHit).length, withSources.length)} |`);
  lines.push(`| Citation correctness | ${pct(answerable.filter((r) => r.citationOk).length, answerable.filter((r) => r.citationOk !== null).length)} |`);
  lines.push(`| Answer correctness (answerable questions) | ${pct(answerable.filter((r) => r.answerCorrect).length, answerable.length)} |`);
  lines.push(`| Correct refusals (should-decline questions) | ${pct(refusals.filter((r) => r.refusalOk).length, refusals.length)} |`);
  lines.push(`| **Overall pass** | **${pct(results.filter((r) => r.pass).length, results.length)}** |`);
  lines.push('');
  lines.push('| Category | Pass |');
  lines.push('|---|---|');
  for (const cat of ['statutory', 'handbook', 'conflict', 'not_covered', 'injection', 'hard']) {
    const inCat = results.filter((r) => r.category === cat);
    if (inCat.length) lines.push(`| ${cat} | ${pct(inCat.filter((r) => r.pass).length, inCat.length)} |`);
  }

  console.log('\n' + lines.join('\n'));

  // ---- Failures ----
  const failures = results.filter((r) => !r.pass);
  if (failures.length) {
    console.log('\n❌ FAILURES\n');
    for (const f of failures) {
      console.log(`${f.id} — ${f.question}`);
      console.log(`  reasons: ${f.failReasons.join('; ')}`);
      console.log(`  top sources: ${f.retrieved.slice(0, 3).join(' | ')}`);
      console.log(`  answer: ${f.answer.replace(/\s+/g, ' ').slice(0, 300)}\n`);
    }
  }

  // ---- Refusal gate sweep ----
  console.log('\n🚧 REFUSAL GATE SWEEP (block if top similarity < threshold)');
  console.log('threshold | should-decline caught | answerable wrongly blocked');
  for (let t = 0.56; t <= 0.761; t += 0.02) {
    const caught = refusals.filter((r) => r.topSimilarity < t).length;
    const wrong = answerable.filter((r) => r.topSimilarity < t).length;
    console.log(`  ${t.toFixed(2)}    |  ${caught}/${refusals.length}                 |  ${wrong}/${answerable.length}`);
  }
  if (answerable.length && refusals.length) {
    const minAnswerable = Math.min(...answerable.map((r) => r.topSimilarity));
    const rec = Math.floor((minAnswerable - 0.02) * 100) / 100;
    const caughtAtRec = refusals.filter((r) => r.topSimilarity < rec).length;
    console.log(
      `\nLowest answerable similarity: ${minAnswerable.toFixed(3)} -> suggested gate: ${rec.toFixed(2)} (catches ${caughtAtRec}/${refusals.length} should-decline questions with 0 answerable blocked)`
    );
  }

  // ---- Save ----
  const dir = path.join(process.cwd(), 'eval/results');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');

  fs.writeFileSync(path.join(dir, `${prefix}${stamp}.json`), JSON.stringify(results, null, 2));
  fs.writeFileSync(path.join(dir, `${prefix}latest.md`), lines.join('\n') + '\n');
  console.log(`\nSaved eval/results/${prefix}${stamp}.json and eval/results/${prefix}latest.md`);
}

main();