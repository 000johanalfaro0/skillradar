import type { Env, SkillAnalysis } from '../types';

const MODEL = 'gemini-2.5-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

// Controlled vocabulary for domain tags. Keeps filters consistent across skills.
export const TAG_VOCAB = [
  'web',
  'frontend',
  'backend',
  'mobile',
  'design',
  'data',
  'ai-ml',
  'devops',
  'testing',
  'security',
  'database',
  'automation',
  'docs',
  'api',
  'cli',
  'productivity',
  'art',
  'performance',
] as const;

// Structured-output schema: forces Gemini to return exactly this JSON shape.
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    critique: {
      type: 'object',
      properties: {
        pros: { type: 'array', items: { type: 'string' } },
        cons: { type: 'array', items: { type: 'string' } },
      },
      required: ['pros', 'cons'],
    },
    use_case: { type: 'string' },
    difficulty: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] },
    primary_language: { type: 'string' },
    tags: {
      type: 'array',
      items: { type: 'string', enum: [...TAG_VOCAB] },
    },
  },
  required: ['summary', 'critique', 'use_case', 'difficulty', 'primary_language', 'tags'],
};

const SYSTEM_PROMPT = `You are a senior software architect reviewing a Claude Code "skill"
(an instruction file that tells an AI assistant how to perform a task).
Given the raw SKILL.md content, return a critical, honest assessment.
- summary: 2-3 sentences in plain language a non-expert can understand: what the skill does and who it helps.
- critique.pros / critique.cons: concrete strengths and weaknesses of the instructions themselves.
- use_case: one sentence describing the best moment to reach for this skill.
- difficulty: how much prior knowledge a user needs.
- primary_language: the programming language this skill is most associated with, or "General" if not language-specific.
- tags: 1-4 domain tags chosen ONLY from the allowed list. Pick the most relevant; do not force four.
Be specific and skeptical. Do not invent capabilities the file does not describe.`;

export const MODEL_NAME = MODEL;

const LANG_NAMES: Record<string, string> = { en: 'English', es: 'Spanish' };

/** Analyze one SKILL.md in the given language. Returns null on API/parse failure. */
export async function analyzeSkill(
  env: Env,
  skillBody: string,
  lang = 'en',
): Promise<SkillAnalysis | null> {
  // Cap input so a huge SKILL.md can't blow the token budget.
  const body = skillBody.slice(0, 24_000);
  const langName = LANG_NAMES[lang] ?? 'English';
  // Free-text fields are localized; tags/difficulty stay as canonical English keys.
  const systemPrompt = `${SYSTEM_PROMPT}
Write summary, critique (pros and cons), and use_case in ${langName}.
Keep the tags and difficulty values EXACTLY as the allowed English keywords.`;

  const payload = JSON.stringify({
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: body }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.3,
    },
  });

  // Retry on 429 (rate limit). Free-tier Gemini is easy to hit when bursting languages.
  let res: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch(`${ENDPOINT}?key=${env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    });
    if (res.status !== 429) break;
    if (attempt < 2) await new Promise((r) => setTimeout(r, 6000 * (attempt + 1)));
  }

  if (!res || !res.ok) {
    console.error(`gemini ${lang} HTTP ${res?.status}: ${(await res?.text())?.slice(0, 200)}`);
    return null;
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    console.error(`gemini ${lang}: empty candidate`);
    return null;
  }

  try {
    return JSON.parse(text) as SkillAnalysis;
  } catch {
    console.error(`gemini ${lang}: JSON parse failed`);
    return null;
  }
}
