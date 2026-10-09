import fs from 'fs';
import path from 'path';
import { supabase } from './lib/supabase';
import { embedText } from './lib/embed';
import { chunkMarkdown, chunkPlainText } from './lib/chunk';
import { fetchPageText } from './lib/fetch-page';

const TODAY = new Date().toISOString().slice(0, 10);

async function ingestDocument(
  title: string,
  sourceType: 'statutory' | 'handbook',
  url: string | null,
  chunks: { sectionPath: string; text: string }[]
) {
  // Remove any existing version of this document (by title) so re-runs don't duplicate
  await supabase.from('documents').delete().eq('title', title);

  const { data: doc, error: docError } = await supabase
    .from('documents')
    .insert({
      title,
      source_type: sourceType,
      url,
      retrieved_at: TODAY,
      effective_date: TODAY,
    })
    .select()
    .single();

  if (docError || !doc) {
    console.error(`❌ Failed to insert document "${title}":`, docError?.message);
    return;
  }

  console.log(`  Embedding ${chunks.length} chunk(s)...`);
  for (const chunk of chunks) {
    const embedding = await embedText(chunk.text);
    const { error: chunkError } = await supabase.from('chunks').insert({
      document_id: doc.id,
      section_path: chunk.sectionPath,
      text: chunk.text,
      embedding,
    });
    if (chunkError) {
      console.error(`  ❌ Failed to insert chunk for "${chunk.sectionPath}":`, chunkError.message);
    }
  }

  console.log(`✅ Ingested "${title}" (${chunks.length} chunks)`);
}

async function main() {
  // 1. Ingest the handbook
  const handbookPath = path.join(process.cwd(), 'data/sources/handbook.md');
  const handbookMd = fs.readFileSync(handbookPath, 'utf-8');
  const handbookChunks = chunkMarkdown(handbookMd, 'Acme Pte Ltd Employee Handbook');
  await ingestDocument('Acme Pte Ltd Employee Handbook', 'handbook', null, handbookChunks);

  // 2. Ingest each statutory source
  const linksPath = path.join(process.cwd(), 'data/sources/statutory-links.json');
  const links: {
    title: string;
    url: string;
    source_type: string;
    mode?: 'local';
    file?: string;
  }[] = JSON.parse(fs.readFileSync(linksPath, 'utf-8'));

  for (const link of links) {
    console.log(`Fetching: ${link.title}`);
    try {
      let chunks;
      if (link.mode === 'local' && link.file) {
        const localPath = path.join(process.cwd(), 'data/sources', link.file);
        const md = fs.readFileSync(localPath, 'utf-8');
        chunks = chunkMarkdown(md, link.title);
      } else {
        const text = await fetchPageText(link.url);
        if (text.length < 200) {
          console.warn(`  ⚠️ "${link.title}" returned very little text (${text.length} chars) — check the page manually.`);
        }
        chunks = chunkPlainText(text, link.title);
      }
      await ingestDocument(link.title, 'statutory', link.url, chunks);
    } catch (err) {
      console.error(`  ❌ Failed to fetch "${link.title}":`, err);
    }
  }

  console.log('🎉 Ingestion complete.');
}

main();