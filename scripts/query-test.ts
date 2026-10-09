import { supabase } from './lib/supabase';
import { embedText } from './lib/embed';
import readline from 'readline';

async function search(question: string) {
  console.log(`\nEmbedding query...`);
  const queryEmbedding = await embedText(question);

  const { data, error } = await supabase.rpc('hybrid_search', {
    query_embedding: queryEmbedding,
    query_text: question,
    match_count: 8,
  });

  if (error) {
    console.error('❌ Search failed:', error.message);
    return;
  }

  console.log(`\n📋 Top ${data.length} results for: "${question}"\n`);
  data.forEach((row: any, i: number) => {
    console.log(`${i + 1}. [${row.source_type}] ${row.section_path}  (score: ${row.score.toFixed(4)})`);
    console.log(`   ${row.chunk_text.slice(0, 150).replace(/\s+/g, ' ')}...\n`);
  });
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const ask = () => {
    rl.question('\n❓ Ask a question (or "exit"): ', async (question) => {
      if (question.trim().toLowerCase() === 'exit') {
        rl.close();
        return;
      }
      await search(question);
      ask();
    });
  };

  ask();
}

main();