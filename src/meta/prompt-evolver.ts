import type { MemoryArchive, InterviewQA, GenerationMemory } from '../types.js';

interface CategoryRule {
  name: string;
  keywords: string[];
}

const CATEGORIES: CategoryRule[] = [
  { name: 'goal', keywords: ['goal', 'objective', 'purpose', 'aim', 'target'] },
  { name: 'constraints', keywords: ['constraint', 'limit', 'restriction', 'must', 'should not', 'cannot', 'boundary'] },
  { name: 'steps', keywords: ['step', 'how', 'process', 'order', 'sequence', 'phase', 'stage'] },
  { name: 'assumptions', keywords: ['assumption', 'assume', 'presume', 'take for granted'] },
  { name: 'risks', keywords: ['risk', 'concern', 'issue', 'problem', 'worried', 'afraid'] },
];

function categorizeQuestion(q: InterviewQA): string[] {
  const text = `${q.question} ${q.reason}`.toLowerCase();
  return CATEGORIES.filter((cat) => cat.keywords.some((kw) => text.includes(kw))).map((cat) => cat.name);
}

function generationImproved(memory: GenerationMemory): boolean {
  return memory.improvements.some((imp) => imp.includes('improved'));
}

export function evolvePrompts(archive: MemoryArchive): string[] {
  const last3 = archive.memories.slice(-3);
  if (last3.length === 0) return [];

  const yieldCounts = new Map<string, { hit: number; miss: number }>();
  for (const cat of CATEGORIES) {
    yieldCounts.set(cat.name, { hit: 0, miss: 0 });
  }

  for (const memory of last3) {
    const improved = generationImproved(memory);
    const questions = memory.planSnapshot.interviews;
    const seenCats = new Set<string>();

    for (const q of questions) {
      const cats = categorizeQuestion(q);
      for (const cat of cats) {
        seenCats.add(cat);
      }
    }

    for (const cat of seenCats) {
      const entry = yieldCounts.get(cat);
      if (!entry) continue;
      if (improved) {
        entry.hit += 1;
      } else {
        entry.miss += 1;
      }
    }
  }

  const suggestions: string[] = [];

  for (const cat of CATEGORIES) {
    const entry = yieldCounts.get(cat.name);
    if (!entry) continue;
    const { hit, miss } = entry;
    const total = hit + miss;
    if (total === 0) continue;

    const rate = hit / total;
    if (rate >= 0.66) {
      suggestions.push(`Promote "${cat.name}" questions (improved ${hit}/${total} generations); consider generating more of them`);
    } else if (rate <= 0.33) {
      suggestions.push(`Demote "${cat.name}" questions (improved ${hit}/${total} generations); consider reducing their frequency or rephrasing`);
    }
  }

  return suggestions;
}
