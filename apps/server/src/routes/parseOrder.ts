import { Router, Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { ParseOrderRequestSchema } from '../requestSchemas';
import { ParseOrderResponseSchema } from '../schemas';
import { buildSystemPrompt } from '../prompt';
import { fallbackParse } from '../fallback';

const router = Router();
const client = new Anthropic();

export function shouldUseDeterministicParser(
  message: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; text: string }> = []
): boolean {
  const lower = message.toLowerCase().trim();
  const lastAssistant = [...conversationHistory].reverse().find((turn) => turn.role === 'assistant')?.text.toLowerCase() ?? '';

  if (
    /^(add|get|order|give me|let me get|i want|i'd like|i would like|throw in|can you add|can i (get|have))\b/.test(lower)
  ) {
    return true;
  }

  if (
    /^(remove|delete|take off|take away|cancel|drop|clear|empty|start over|change|set|update)\b/.test(lower)
  ) {
    return true;
  }

  if (
    /^(make it|make that|add one instead|make it one instead|just one|only one|add one more|add \d+ more|add (one|two|three|four|five|six|seven|eight|nine|ten) more|same thing again|another one|remove \d+ more|take off \d+ more)\b/.test(lower)
  ) {
    return true;
  }

  if (
    /what('s| is) in (my |the )?cart|show.*cart|my (current )?cart|what('s| is) (my )?total|how much (is|does|will|do i)|order (cost|total|price)|current (total|cost)/.test(lower)
  ) {
    return true;
  }

  if (
    /\b(ready to checkout|ready to check out|i am ready to checkout|i'm ready to checkout|i would like to checkout|i'd like to checkout|i want to checkout|i want to check out|i am done|i'm done|that should be it|that is it|that's it|that should do it|that should do|i am finished|i'm finished)\b/.test(lower)
  ) {
    return true;
  }

  if (
    /^(yes(?:\s+please)?|yep|yeah|sure|ok(?:ay)?|please do|no(?:\s+thanks)?|nope|not now)\s*[.!?]*$/.test(lower) &&
    /ready to place your order|go to the cart tab to place your order|ready to checkout|want me to add it|want me to add one/.test(lastAssistant)
  ) {
    return true;
  }

  return false;
}

router.post('/', async (req: Request, res: Response) => {
  const parsed = ParseOrderRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return;
  }

  const { message, cartItems, conversationHistory } = parsed.data;
  const deterministicResult = fallbackParse(message, cartItems, conversationHistory);

  if (!process.env.ANTHROPIC_API_KEY || shouldUseDeterministicParser(message, conversationHistory ?? [])) {
    res.json(deterministicResult);
    return;
  }

  try {
    // Build alternating message array from history + current turn.
    // Anthropic requires messages to start with 'user' and alternate roles.
    const rawHistory = conversationHistory ?? [];
    const apiMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    for (const turn of rawHistory) {
      apiMessages.push({ role: turn.role, content: turn.text });
    }
    apiMessages.push({ role: 'user', content: message });

    // Strip any leading assistant turns (Anthropic requires first turn = user)
    while (apiMessages.length > 0 && apiMessages[0].role !== 'user') {
      apiMessages.shift();
    }

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: buildSystemPrompt(cartItems),
      messages: apiMessages,
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    const jsonText = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

    const aiResult = JSON.parse(jsonText);
    const validated = ParseOrderResponseSchema.safeParse(aiResult);

    if (validated.success) {
      res.json(validated.data);
    } else {
      console.warn('[parse-order] Zod validation failed, using fallback:', validated.error.flatten());
      res.json(deterministicResult);
    }
  } catch (err) {
    console.error('[parse-order] AI error, using fallback:', err);
    res.json(deterministicResult);
  }
});

export default router;
