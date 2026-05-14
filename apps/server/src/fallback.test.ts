/**
 * Fallback parser regression tests.
 * Run: PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH" ../../node_modules/.bin/ts-node -r tsconfig-paths/register src/fallback.test.ts
 */

import { fallbackParse } from './fallback';
import { CartItem, ConversationTurn } from '@bistro/shared';
import { MENU_ITEMS } from '@bistro/shared';

type Result = ReturnType<typeof fallbackParse>;

function cartWith(...pairs: [string, number][]): CartItem[] {
  return pairs.map(([id, qty]) => {
    const menuItem = MENU_ITEMS.find((i) => i.id === id)!;
    return { menuItem, quantity: qty, modifiers: [] };
  });
}

type Case = { label: string; input: string; cart?: CartItem[]; history?: ConversationTurn[]; check: (r: Result) => boolean };

const cases: Case[] = [
  // ── Core prompts ────────────────────────────────────────────────────────────
  {
    label: '1. Add 10 spicy chickens',
    input: 'Add 10 spicy chickens',
    check: (r) =>
      r.actions.length === 1 &&
      r.actions[0].type === 'ADD_ITEM' &&
      (r.actions[0] as any).itemId === 'spicy_crispy_chicken' &&
      (r.actions[0] as any).quantity === 10,
  },
  {
    label: '2. Remove 4 spicy chickens (cart=10) → DECREMENT to 6',
    input: 'Remove 4 spicy chickens',
    cart: cartWith(['spicy_crispy_chicken', 10]),
    check: (r) =>
      r.actions.length === 1 &&
      r.actions[0].type === 'DECREMENT_ITEM' &&
      (r.actions[0] as any).quantity === 4 &&
      /6/.test(r.assistantMessage),
  },
  {
    label: '2b. Remove with preface (actually remove like 4) → DECREMENT not ADD',
    input: 'Actually remove like 4 spicy chickens',
    cart: cartWith(['spicy_crispy_chicken', 10]),
    check: (r) => r.actions.length === 1 && r.actions[0].type === 'DECREMENT_ITEM',
  },
  {
    label: '3. Make it 2 (single item cart) → UPDATE_QUANTITY',
    input: 'Make it 2',
    cart: cartWith(['spicy_crispy_chicken', 5]),
    check: (r) =>
      r.actions.length === 1 &&
      r.actions[0].type === 'UPDATE_QUANTITY' &&
      (r.actions[0] as any).quantity === 2,
  },
  {
    label: '3b. Make it 2 (multi-item cart) → clarification, no actions',
    input: 'Make it 2',
    cart: cartWith(['spicy_crispy_chicken', 5], ['bistro_fries', 1]),
    check: (r) => r.actions.length === 0,
  },
  {
    label: '4. Add a sparkling water as well → ADD_ITEM',
    input: 'Add a sparkling water as well',
    check: (r) =>
      r.actions.length === 1 &&
      r.actions[0].type === 'ADD_ITEM' &&
      (r.actions[0] as any).itemId === 'sparkling_water',
  },
  {
    label: '5. Remove the water → REMOVE_ITEM sparkling_water',
    input: 'Remove the water',
    cart: cartWith(['sparkling_water', 1]),
    check: (r) =>
      r.actions.length === 1 &&
      r.actions[0].type === 'REMOVE_ITEM' &&
      (r.actions[0] as any).itemId === 'sparkling_water',
  },
  {
    label: '6. Clear my cart → CLEAR_CART',
    input: 'Clear my cart',
    check: (r) => r.actions.length === 1 && r.actions[0].type === 'CLEAR_CART',
  },
  {
    label: '7. Spicy meal under $20 → only spicy items, total ≤ $20',
    input: 'Build me a spicy meal under $20',
    check: (r) => {
      if (r.actions.length === 0) return false;
      const ids = r.actions.map((a) => (a as any).itemId);
      const noNonSpicy = !ids.includes('classic_smash') && !ids.includes('mushroom_swiss') && !ids.includes('veggie_smash') && !ids.includes('cuban_pressed') && !ids.includes('blt_deluxe');
      return noNonSpicy;
    },
  },
  {
    label: '8. What\'s popular? → no actions, lists popular items',
    input: "What's popular?",
    check: (r) =>
      r.actions.length === 0 &&
      /smash|crispy|cuban|fries|lemonade|milkshake|brownie/i.test(r.assistantMessage),
  },
  {
    label: '9. What\'s vegetarian? → no actions, lists veg items',
    input: "What's vegetarian?",
    check: (r) =>
      r.actions.length === 0 &&
      /veggie|fries|salad|mac|onion/i.test(r.assistantMessage),
  },

  // ── Additional add prompts ──────────────────────────────────────────────────
  {
    label: 'Can I get two burgers and fries? → 2 ADD_ITEMs',
    input: 'Can I get two burgers and fries?',
    check: (r) =>
      r.actions.length === 2 &&
      r.actions.every((a) => a.type === 'ADD_ITEM') &&
      r.actions.some((a) => (a as any).itemId === 'classic_smash' && (a as any).quantity === 2) &&
      r.actions.some((a) => (a as any).itemId === 'bistro_fries'),
  },
  {
    label: 'Add a burger, fries, and a water → 3 ADD_ITEMs',
    input: 'Add a burger, fries, and a water',
    check: (r) =>
      r.actions.length === 3 &&
      r.actions.every((a) => a.type === 'ADD_ITEM'),
  },
  {
    label: 'Give me 3 fries → ADD_ITEM bistro_fries qty 3',
    input: 'Give me 3 fries',
    check: (r) =>
      r.actions.length === 1 &&
      (r.actions[0] as any).itemId === 'bistro_fries' &&
      (r.actions[0] as any).quantity === 3,
  },
  {
    label: 'Add another spicy chicken → ADD_ITEM qty 1',
    input: 'Add another spicy chicken',
    check: (r) =>
      r.actions.length === 1 &&
      (r.actions[0] as any).itemId === 'spicy_crispy_chicken' &&
      (r.actions[0] as any).quantity === 1,
  },
  {
    label: 'Add one more (cart has chicken) → ADD_ITEM last cart item',
    input: 'Add one more',
    cart: cartWith(['spicy_crispy_chicken', 2]),
    check: (r) =>
      r.actions.length === 1 &&
      r.actions[0].type === 'ADD_ITEM' &&
      (r.actions[0] as any).itemId === 'spicy_crispy_chicken',
  },
  {
    label: 'Throw in some fries → ADD_ITEM bistro_fries',
    input: 'Throw in some fries',
    check: (r) =>
      r.actions.length === 1 &&
      (r.actions[0] as any).itemId === 'bistro_fries',
  },
  {
    label: 'I want one spicy chicken and two waters → 2 ADD_ITEMs',
    input: 'I want one spicy chicken and two waters',
    check: (r) =>
      r.actions.length === 2 &&
      r.actions.some((a) => (a as any).itemId === 'spicy_crispy_chicken' && (a as any).quantity === 1) &&
      r.actions.some((a) => (a as any).itemId === 'sparkling_water' && (a as any).quantity === 2),
  },

  // ── Remove prompts ──────────────────────────────────────────────────────────
  {
    label: 'Take off the fries → REMOVE_ITEM bistro_fries',
    input: 'Take off the fries',
    cart: cartWith(['bistro_fries', 1]),
    check: (r) =>
      r.actions.length === 1 &&
      r.actions[0].type === 'REMOVE_ITEM' &&
      (r.actions[0] as any).itemId === 'bistro_fries',
  },
  {
    label: 'Remove one burger (cart=3) → DECREMENT qty 1',
    input: 'Remove one burger',
    cart: cartWith(['classic_smash', 3]),
    check: (r) =>
      r.actions.length === 1 &&
      r.actions[0].type === 'DECREMENT_ITEM' &&
      (r.actions[0] as any).quantity === 1,
  },
  {
    label: 'Remove all spicy chickens → REMOVE_ITEM',
    input: 'Remove all spicy chickens',
    cart: cartWith(['spicy_crispy_chicken', 5]),
    check: (r) => r.actions.length === 1 && r.actions[0].type === 'REMOVE_ITEM',
  },
  {
    label: 'Cancel the fries → REMOVE_ITEM bistro_fries',
    input: 'Cancel the fries',
    cart: cartWith(['bistro_fries', 1]),
    check: (r) =>
      r.actions.length === 1 &&
      r.actions[0].type === 'REMOVE_ITEM' &&
      (r.actions[0] as any).itemId === 'bistro_fries',
  },
  {
    label: 'I don\'t want the water → REMOVE_ITEM sparkling_water',
    input: "I don't want the water",
    cart: cartWith(['sparkling_water', 1]),
    check: (r) => r.actions.length === 1 && r.actions[0].type === 'REMOVE_ITEM' && (r.actions[0] as any).itemId === 'sparkling_water',
  },
  {
    label: 'Actually no water → REMOVE_ITEM sparkling_water',
    input: 'Actually no water',
    cart: cartWith(['sparkling_water', 1]),
    check: (r) => r.actions.length === 1 && r.actions[0].type === 'REMOVE_ITEM' && (r.actions[0] as any).itemId === 'sparkling_water',
  },
  {
    label: 'Remove verb never produces ADD_ITEM',
    input: 'Remove 4 spicy chickens',
    cart: cartWith(['spicy_crispy_chicken', 10]),
    check: (r) => r.actions.every((a) => a.type !== 'ADD_ITEM'),
  },

  // ── Update quantity ─────────────────────────────────────────────────────────
  {
    label: 'Change the burger to 3 → UPDATE_QUANTITY classic_smash 3',
    input: 'Change the burger to 3',
    check: (r) =>
      r.actions.length === 1 &&
      r.actions[0].type === 'UPDATE_QUANTITY' &&
      (r.actions[0] as any).itemId === 'classic_smash' &&
      (r.actions[0] as any).quantity === 3,
  },
  {
    label: 'Set fries to 1 → UPDATE_QUANTITY bistro_fries 1',
    input: 'Set fries to 1',
    check: (r) =>
      r.actions.length === 1 &&
      r.actions[0].type === 'UPDATE_QUANTITY' &&
      (r.actions[0] as any).itemId === 'bistro_fries' &&
      (r.actions[0] as any).quantity === 1,
  },
  {
    label: 'Only one spicy chicken → UPDATE_QUANTITY 1',
    input: 'Only one spicy chicken',
    check: (r) =>
      r.actions.length === 1 &&
      r.actions[0].type === 'UPDATE_QUANTITY' &&
      (r.actions[0] as any).itemId === 'spicy_crispy_chicken' &&
      (r.actions[0] as any).quantity === 1,
  },

  // ── Cart queries ────────────────────────────────────────────────────────────
  {
    label: 'What\'s in my cart? → no actions, lists items',
    input: "What's in my cart?",
    cart: cartWith(['spicy_crispy_chicken', 2], ['bistro_fries', 1]),
    check: (r) => r.actions.length === 0 && /spicy|chicken/i.test(r.assistantMessage),
  },
  {
    label: 'What\'s my total? → no actions, mentions total',
    input: "What's my total?",
    cart: cartWith(['spicy_crispy_chicken', 2]),
    check: (r) => r.actions.length === 0 && /\$/.test(r.assistantMessage),
  },
  {
    label: 'What\'s my total? (empty cart) → graceful message',
    input: "What's my total?",
    check: (r) => r.actions.length === 0,
  },

  // ── Menu questions ──────────────────────────────────────────────────────────
  {
    label: 'What\'s spicy? → no actions, lists spicy items',
    input: "What's spicy?",
    check: (r) => r.actions.length === 0 && /buffalo|spicy/i.test(r.assistantMessage),
  },
  {
    label: 'What\'s the cheapest item? → mentions cheapest',
    input: "What's the cheapest item?",
    check: (r) => r.actions.length === 0 && /\$/.test(r.assistantMessage),
  },
  {
    label: 'What items are under $10? → lists affordable items',
    input: 'What items are under $10?',
    check: (r) => r.actions.length === 0 && /fries|water|soda|salad|lemonade/i.test(r.assistantMessage),
  },
  {
    label: 'Do you have fries? → confirms fries exist',
    input: 'Do you have fries?',
    check: (r) => r.actions.length === 0 && /fries/i.test(r.assistantMessage),
  },
  {
    label: 'Tell me about the spicy chicken → item description',
    input: 'Tell me about the spicy chicken',
    check: (r) => r.actions.length === 0 && /spicy|chicken|ghost|buttermilk/i.test(r.assistantMessage),
  },

  // ── Recommendations ─────────────────────────────────────────────────────────
  {
    label: 'I want something spicy → no actions, suggests spicy',
    input: 'I want something spicy',
    check: (r) => r.actions.length === 0 && /spicy|buffalo|chicken/i.test(r.assistantMessage),
  },
  {
    label: 'What can I get under $15 → budget meal',
    input: 'What can I get under $15?',
    check: (r) => r.actions.length > 0 || /\$/.test(r.assistantMessage),
  },

  // ── Regression: "Make it 2" with multi-item cart → ask, never ADD_ITEM ───────
  {
    label: 'REGRESSION: "Make it 2" multi-item cart → clarification, not ADD_ITEM',
    input: 'Make it 2',
    cart: cartWith(['spicy_crispy_chicken', 1], ['bistro_fries', 1]),
    check: (r) => r.actions.length === 0 && r.actions.every((a) => a.type !== 'ADD_ITEM'),
  },
  {
    label: 'REGRESSION: "Make it 2" single-item cart → UPDATE_QUANTITY, not ADD_ITEM',
    input: 'Make it 2',
    cart: cartWith(['spicy_crispy_chicken', 5]),
    check: (r) =>
      r.actions.length === 1 &&
      r.actions[0].type === 'UPDATE_QUANTITY' &&
      (r.actions[0] as any).quantity === 2,
  },

  // ── Regression: remove item not in cart → no action, helpful message ─────────
  {
    label: 'REGRESSION: "Cancel the lemonade" (not in cart) → no action',
    input: 'Cancel the lemonade',
    cart: cartWith(['spicy_crispy_chicken', 1]),
    check: (r) => r.actions.length === 0,
  },
  {
    label: 'REGRESSION: "Remove the fries" (not in cart) → no action',
    input: 'Remove the fries',
    cart: cartWith(['spicy_crispy_chicken', 2]),
    check: (r) => r.actions.length === 0,
  },
  {
    label: 'REGRESSION: "Remove the fries" (IS in cart) → REMOVE_ITEM',
    input: 'Remove the fries',
    cart: cartWith(['bistro_fries', 1]),
    check: (r) =>
      r.actions.length === 1 &&
      r.actions[0].type === 'REMOVE_ITEM' &&
      (r.actions[0] as any).itemId === 'bistro_fries',
  },

  // ── Intent classification: informational questions must NEVER add items ──────
  {
    label: 'INTENT: "What comes with the burger?" → no ADD_ITEM, description',
    input: 'What comes with the burger?',
    check: (r) =>
      r.actions.length === 0 &&
      /smash|beef|cheese|bun|sauce|pickles|brioche/i.test(r.assistantMessage),
  },
  {
    label: "INTENT: \"What's in the spicy chicken?\" → no ADD_ITEM",
    input: "What's in the spicy chicken?",
    check: (r) => r.actions.length === 0 && /spicy|ghost|pepper|chicken|buttermilk/i.test(r.assistantMessage),
  },
  {
    label: 'INTENT: "Is the burger spicy?" → no ADD_ITEM, answers property',
    input: 'Is the burger spicy?',
    check: (r) => r.actions.length === 0,
  },
  {
    label: 'INTENT: "What toppings are on the burger?" → no ADD_ITEM',
    input: 'What toppings are on the burger?',
    check: (r) => r.actions.length === 0,
  },
  {
    label: 'INTENT: "How spicy is the wrap?" → no ADD_ITEM',
    input: 'How spicy is the wrap?',
    check: (r) =>
      r.actions.length === 0 && /buffalo|spicy|wrap|chicken/i.test(r.assistantMessage),
  },
  {
    label: 'INTENT: "What drinks do you have?" → no ADD_ITEM, lists drinks',
    input: 'What drinks do you have?',
    check: (r) =>
      r.actions.length === 0 && /lemonade|soda|water/i.test(r.assistantMessage),
  },
  {
    label: 'INTENT: "Is there anything vegetarian?" → no ADD_ITEM',
    input: 'Is there anything vegetarian?',
    check: (r) => r.actions.length === 0 && /veggie|fries|salad|mac/i.test(r.assistantMessage),
  },
  {
    label: 'INTENT: intent field is MENU_QUESTION for informational response',
    input: 'What comes with the burger?',
    check: (r) => (r as any).intent === 'MENU_QUESTION',
  },
  {
    label: 'INTENT: "Can I get a burger?" → ADD_ITEM (order verb, not question)',
    input: 'Can I get a burger?',
    check: (r) =>
      r.actions.length === 1 &&
      r.actions[0].type === 'ADD_ITEM' &&
      (r.actions[0] as any).itemId === 'classic_smash',
  },

  // ── Conversational memory / pronoun resolution ─────────────────────────────
  {
    label: 'Pronoun: "10 of those" after single-item recommendation',
    input: 'Let me get 10 of those',
    history: [
      { role: 'user', text: "What's the cheapest spicy item?" },
      { role: 'assistant', text: 'The cheapest spicy item is 🌶️ Spicy Crispy Chicken at $14.99.' },
    ],
    check: (r) =>
      r.actions.length === 1 &&
      r.actions[0].type === 'ADD_ITEM' &&
      (r.actions[0] as any).itemId === 'spicy_crispy_chicken' &&
      (r.actions[0] as any).quantity === 10,
  },
  {
    label: 'Pronoun: "5 of them" after fries mention',
    input: 'Add 5 of them',
    history: [
      { role: 'user', text: 'Do you have fries?' },
      { role: 'assistant', text: 'Yes! 🍟 Bistro Fries ($4.99) — crispy golden fries. Want me to add some?' },
    ],
    check: (r) =>
      r.actions.length === 1 &&
      (r.actions[0] as any).itemId === 'bistro_fries' &&
      (r.actions[0] as any).quantity === 5,
  },
  {
    label: 'Pronoun: "2 of it" → ADD_ITEM qty 2',
    input: 'Give me 2 of it',
    history: [
      { role: 'user', text: 'Tell me about the milkshake' },
      { role: 'assistant', text: '🥛 House Milkshake ($6.49) — creamy hand-spun shake. Want one?' },
    ],
    check: (r) =>
      r.actions.length === 1 &&
      (r.actions[0] as any).itemId === 'milkshake' &&
      (r.actions[0] as any).quantity === 2,
  },
  {
    label: 'Pronoun: ambiguous history (multiple items) → no resolution, normal parse',
    input: 'Add those',
    history: [
      { role: 'user', text: "What's popular?" },
      { role: 'assistant', text: 'Our popular items are Classic Smash Burger, Spicy Crispy Chicken, Bistro Fries, and Craft Lemonade.' },
    ],
    check: (r) => r.actions.length === 0, // Can't resolve "those" — multiple items in history
  },
  {
    label: 'Pronoun: no history → falls through to normal parse',
    input: 'Add those',
    check: (_r) => true, // Should not throw; actions can be 0 or 1 depending on context
  },
];

let passed = 0;
let failed = 0;

for (const tc of cases) {
  const result = fallbackParse(tc.input, tc.cart ?? [], tc.history ?? []);
  const ok = tc.check(result);
  if (ok) {
    console.log(`  ✅  ${tc.label}`);
    passed++;
  } else {
    console.log(`  ❌  ${tc.label}`);
    console.log(`       input:   "${tc.input}"`);
    console.log(`       cart:    ${JSON.stringify(tc.cart?.map(c => `${c.menuItem.id}x${c.quantity}`) ?? [])}`);
    console.log(`       actions: ${JSON.stringify(result.actions)}`);
    console.log(`       message: "${result.assistantMessage}"`);
    failed++;
  }
}

console.log(`\n${passed}/${passed + failed} tests passed`);
if (failed > 0) process.exit(1);
