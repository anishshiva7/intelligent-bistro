import { Router, Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { ParseOrderRequestSchema } from '../requestSchemas';
import { ParseOrderResponseSchema } from '../schemas';
import { buildSystemPrompt } from '../prompt';
import { fallbackParse } from '../fallback';

const router = Router();
const client = new Anthropic();

router.post('/', async (req: Request, res: Response) => {
  // Validate request body
  const parsed = ParseOrderRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return;
  }

  const { message, cartItems } = parsed.data;

  // Skip AI if no API key configured
  if (!process.env.ANTHROPIC_API_KEY) {
    res.json(fallbackParse(message));
    return;
  }

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: buildSystemPrompt(cartItems),
      messages: [{ role: 'user', content: message }],
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : '';

    // Strip any accidental markdown fences
    const jsonText = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

    const aiResult = JSON.parse(jsonText);
    const validated = ParseOrderResponseSchema.safeParse(aiResult);

    if (validated.success) {
      res.json(validated.data);
    } else {
      // AI returned invalid shape — fall back gracefully
      console.warn('[parse-order] Zod validation failed, using fallback:', validated.error.flatten());
      res.json(fallbackParse(message));
    }
  } catch (err) {
    console.error('[parse-order] AI error, using fallback:', err);
    res.json(fallbackParse(message));
  }
});

export default router;
