import { supabase } from './lib/supabase';

async function main() {
  const { data: docs, error: docsError } = await supabase
    .from('documents')
    .select('id, title, source_type, url, retrieved_at')
    .order('source_type', { ascending: false });

  if (docsError) {
    console.error('❌ Failed to fetch documents:', docsError.message);
    return;
  }

  console.log(`\n📄 ${docs.length} documents:\n`);
  for (const doc of docs) {
    const { count } = await supabase
      .from('chunks')
      .select('*', { count: 'exact', head: true })
      .eq('document_id', doc.id);
    console.log(`  [${doc.source_type}] ${doc.title} — ${count} chunks`);
  }

  const { count: totalChunks } = await supabase
    .from('chunks')
    .select('*', { count: 'exact', head: true });
  console.log(`\n🧩 Total chunks: ${totalChunks}`);

  // Spot-check: print one chunk's text to eyeball quality
  const { data: sample } = await supabase
    .from('chunks')
    .select('section_path, text')
    .limit(1)
    .order('created_at', { ascending: true });
  if (sample && sample[0]) {
    console.log(`\n🔍 Sample chunk (${sample[0].section_path}):`);
    console.log(sample[0].text.slice(0, 300) + '...');
  }
}

main();