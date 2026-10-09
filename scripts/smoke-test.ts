import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { embedText } from './lib/embed';

dotenv.config({ path: '.env.local' });

async function main() {
  // 1. Test Supabase connection
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase.from('documents').select('*').limit(1);
  if (error) {
    console.error('❌ Supabase connection failed:', error.message);
    return;
  }
  console.log('✅ Supabase connected. documents table rows:', data.length);

  // 2. Test Gemini embeddings
  try {
    const embedding = await embedText('This is a test sentence for embeddings.');
    console.log('✅ Gemini embedding generated. Dimensions:', embedding.length);
  } catch (err) {
    console.error('❌ Gemini embedding failed:', err);
    return;
  }

  console.log('🎉 All checks passed.');
}

main();