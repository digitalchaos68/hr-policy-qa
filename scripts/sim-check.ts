import { retrieve } from './lib/rag';

const questions = [
  'How many days of annual leave do I get?',
  'What is the overtime pay rate?',
  'How much notice do I need to give when resigning?',
  'What is the weather in Singapore today?',
  'What is the minimum wage in Singapore?',
  'Does Acme offer stock options or an employee share plan?',
];

async function main() {
  for (const q of questions) {
    const { topSimilarity } = await retrieve(q);
    console.log(topSimilarity.toFixed(3), ' ', q);
  }
}

main();