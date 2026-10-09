import { google } from '@ai-sdk/google';
import { embed as aiEmbed } from 'ai';

const TARGET_DIM = 1536;

function truncateAndNormalize(vector: number[], dim: number): number[] {
  const truncated = vector.slice(0, dim);
  const norm = Math.sqrt(truncated.reduce((sum, v) => sum + v * v, 0));
  return norm === 0 ? truncated : truncated.map((v) => v / norm);
}

export async function embedText(text: string): Promise<number[]> {
  const { embedding } = await aiEmbed({
    model: google.textEmbeddingModel('gemini-embedding-001'),
    value: text,
  });
  return truncateAndNormalize(embedding, TARGET_DIM);
}