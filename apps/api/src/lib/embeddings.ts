import type { Env } from '../types';

const EMBED_MODEL = '@cf/baai/bge-base-en-v1.5'; // 768-dim

/** Turn text into a 768-dim embedding via Workers AI. */
export async function embedText(env: Env, text: string): Promise<number[]> {
  const res = (await env.AI.run(EMBED_MODEL, { text: [text] })) as { data: number[][] };
  return res.data[0];
}

/** Embed a skill and upsert it into Vectorize (id = skill id). */
export async function upsertSkillVector(env: Env, skillId: number, text: string): Promise<void> {
  const values = await embedText(env, text);
  await env.VECTORIZE.upsert([
    { id: String(skillId), values, metadata: { skill_id: skillId } },
  ]);
}

/** Embed a free-text query and return the ids of the most similar skills. */
export async function searchSimilar(env: Env, query: string, topK = 30): Promise<number[]> {
  const values = await embedText(env, query);
  const result = await env.VECTORIZE.query(values, { topK, returnMetadata: 'none' });
  return result.matches.map((m) => Number(m.id));
}
