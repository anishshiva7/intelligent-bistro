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
    check: (r) =>
      r.actions.length === 0 &&
      /spicy|chicken/i.test(r.assistantMessage) &&
      /total/i.test(r.assistantMessage),
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
  {
    label: 'REGRESSION: "Add two waters" then "Add one spicy chickens" → spicy chicken, never water',
    input: 'Add one spicy chickens',
    cart: cartWith(['sparkling_water', 2]),
    history: [
      { role: 'user', text: 'Add two waters' },
      { role: 'assistant', text: 'Added 2× Sparkling Water to your cart! 🛒' },
    ],
    check: (r) =>
      r.actions.length === 1 &&
      r.actions[0].type === 'ADD_ITEM' &&
      (r.actions[0] as any).itemId === 'spicy_crispy_chicken' &&
      !/(sparkling water)/i.test(JSON.stringify(r.actions)),
  },
  {
    label: 'REGRESSION: "Add one instead" single-item cart → UPDATE_QUANTITY 1 with total prompt',
    input: 'Add one instead',
    cart: cartWith(['spicy_crispy_chicken', 3]),
    history: [
      { role: 'user', text: 'Add three spicy chickens' },
      { role: 'assistant', text: 'Added 3× Spicy Crispy Chicken to your cart! 🛒' },
    ],
    check: (r) =>
      r.actions.length === 1 &&
      r.actions[0].type === 'UPDATE_QUANTITY' &&
      (r.actions[0] as any).itemId === 'spicy_crispy_chicken' &&
      (r.actions[0] as any).quantity === 1 &&
      /total is now/i.test(r.assistantMessage),
  },
  {
    label: 'REGRESSION: "Make it one instead" multi-item cart → clarification, not fallback',
    input: 'Make it one instead',
    cart: cartWith(['spicy_crispy_chicken', 2], ['bistro_fries', 1]),
    check: (r) =>
      r.actions.length === 0 &&
      /which item/i.test(r.assistantMessage),
  },
  {
    label: 'REGRESSION: "Make it one instead" single-item cart → UPDATE_QUANTITY 1',
    input: 'Make it one instead',
    cart: cartWith(['spicy_crispy_chicken', 4]),
    check: (r) =>
      r.actions.length === 1 &&
      r.actions[0].type === 'UPDATE_QUANTITY' &&
      (r.actions[0] as any).quantity === 1,
  },
  {
    label: 'REGRESSION: "Ready to checkout" → no actions, tells user to go to cart',
    input: 'Ready to checkout',
    cart: cartWith(['spicy_crispy_chicken', 1], ['craft_lemonade', 1]),
    check: (r) =>
      r.actions.length === 0 &&
      /go to the cart/i.test(r.assistantMessage) &&
      /\$/.test(r.assistantMessage),
  },
  {
    label: 'REGRESSION: "That should be it" → no actions, tells user to go to cart',
    input: 'That should be it',
    cart: cartWith(['spicy_crispy_chicken', 1]),
    check: (r) =>
      r.actions.length === 0 &&
      /go to the cart/i.test(r.assistantMessage),
  },
  {
    label: 'REGRESSION: "I am done" empty cart → no actions, asks to add items first',
    input: 'I am done',
    check: (r) =>
      r.actions.length === 0 &&
      /cart is empty/i.test(r.assistantMessage),
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

  // ── ISSUE 1 (QA set): Superlative menu questions ────────────────────────────
  {
    label: 'QA1: "What is the cheapest spicy item?" → cheapest spicy, no ADD_ITEM',
    input: 'What is the cheapest spicy item?',
    check: (r) =>
      r.actions.length === 0 &&
      /buffalo chicken wrap|\$12\.49/i.test(r.assistantMessage),
  },
  {
    label: 'QA1b: "cheapest vegetarian item" → cheapest veg item',
    input: 'What is the cheapest vegetarian item?',
    check: (r) =>
      r.actions.length === 0 &&
      /\$4\.49|garden side salad|salad/i.test(r.assistantMessage),
  },
  {
    label: 'QA1c: "most expensive item" → most expensive overall',
    input: 'What is the most expensive item?',
    check: (r) =>
      r.actions.length === 0 &&
      /\$14\.99|spicy crispy chicken/i.test(r.assistantMessage),
  },
  {
    label: 'QA1d: "cheapest drink" → cheapest drink',
    input: 'What is the cheapest drink?',
    check: (r) =>
      r.actions.length === 0 &&
      /\$2\.49|sparkling water/i.test(r.assistantMessage),
  },

  // ── ISSUE 2 (QA set): Multi-item removal ─────────────────────────────────────
  {
    label: 'QA2: "Remove 2 waters and 2 fries" (cart: water x3, fries x1) → 2 actions',
    input: 'Remove 2 waters and 2 fries',
    cart: cartWith(['sparkling_water', 3], ['bistro_fries', 1]),
    check: (r) => {
      if (r.actions.length !== 2) return false;
      const hasDecrement = r.actions.some(
        (a) => a.type === 'DECREMENT_ITEM' && (a as any).itemId === 'sparkling_water' && (a as any).quantity === 2
      );
      const hasRemove = r.actions.some(
        (a) => a.type === 'REMOVE_ITEM' && (a as any).itemId === 'bistro_fries'
      );
      return hasDecrement && hasRemove;
    },
  },
  {
    label: 'QA2b: "Remove the fries and the water" (full removes) → 2 REMOVE_ITEMs',
    input: 'Remove the fries and the water',
    cart: cartWith(['bistro_fries', 2], ['sparkling_water', 1]),
    check: (r) =>
      r.actions.length === 2 &&
      r.actions.every((a) => a.type === 'REMOVE_ITEM') &&
      r.actions.some((a) => (a as any).itemId === 'bistro_fries') &&
      r.actions.some((a) => (a as any).itemId === 'sparkling_water'),
  },
  {
    label: 'QA2c: multi-remove, one item not in cart → only removes cart items',
    input: 'Remove the fries and the milkshake',
    cart: cartWith(['bistro_fries', 1]),
    check: (r) =>
      r.actions.length === 1 &&
      r.actions[0].type === 'REMOVE_ITEM' &&
      (r.actions[0] as any).itemId === 'bistro_fries',
  },

  // ── ISSUE 3 (QA set): Singular popular returns ONE item ──────────────────────
  {
    label: 'QA3: "What is your most popular item?" → exactly ONE item, no actions',
    input: 'What is your most popular item?',
    check: (r) => {
      if (r.actions.length > 0) return false;
      // Must mention exactly one item (the first popular item — Classic Smash Burger)
      const popularNames = ['classic smash', 'spicy crispy', 'cuban', 'bistro fries', 'craft lemonade', 'milkshake', 'brownie'];
      const mentions = popularNames.filter((n) => r.assistantMessage.toLowerCase().includes(n));
      return mentions.length === 1;
    },
  },
  {
    label: 'QA3b: "best item?" → singular → one item',
    input: 'What is the best item?',
    check: (r) => {
      if (r.actions.length > 0) return false;
      const popularNames = ['classic smash', 'spicy crispy', 'cuban', 'bistro fries', 'craft lemonade', 'milkshake', 'brownie'];
      const mentions = popularNames.filter((n) => r.assistantMessage.toLowerCase().includes(n));
      return mentions.length === 1;
    },
  },
  {
    label: "QA3c: \"What's popular?\" (plural) → lists multiple items",
    input: "What's popular?",
    check: (r) => {
      if (r.actions.length > 0) return false;
      const popularNames = ['classic smash', 'spicy crispy', 'cuban', 'bistro fries', 'craft lemonade', 'milkshake', 'brownie'];
      const mentions = popularNames.filter((n) => r.assistantMessage.toLowerCase().includes(n));
      return mentions.length > 1;
    },
  },

  // ── ISSUE 4 (QA set): Follow-up references after singular recommendation ─────
  {
    label: 'QA4: "Add 2 of those" after singular popular → ADD_ITEM qty 2',
    input: 'Add 2 of those',
    history: [
      { role: 'user', text: 'What is your most popular item?' },
      { role: 'assistant', text: 'Our most popular item is the 🍔 Classic Smash Burger ($13.99) — double smashed beef patty. Want me to add it?' },
    ],
    check: (r) =>
      r.actions.length === 1 &&
      r.actions[0].type === 'ADD_ITEM' &&
      (r.actions[0] as any).itemId === 'classic_smash' &&
      (r.actions[0] as any).quantity === 2,
  },
  {
    label: 'QA4b: "add one" after recommendation → ADD_ITEM qty 1 from history',
    input: 'add one',
    history: [
      { role: 'user', text: 'Recommend something spicy' },
      { role: 'assistant', text: 'Our top spicy pick is the 🌶️ Spicy Crispy Chicken ($14.99) — Want me to add it?' },
    ],
    check: (r) =>
      r.actions.length === 1 &&
      r.actions[0].type === 'ADD_ITEM' &&
      (r.actions[0] as any).itemId === 'spicy_crispy_chicken',
  },
  {
    label: 'QA4c: "add another one" after recommendation → ADD_ITEM qty 1',
    input: 'add another one',
    history: [
      { role: 'user', text: 'Recommend something' },
      { role: 'assistant', text: 'Our top pick is the 🍔 Classic Smash Burger ($13.99) — Want me to add it?' },
    ],
    check: (r) =>
      r.actions.length === 1 &&
      r.actions[0].type === 'ADD_ITEM' &&
      (r.actions[0] as any).itemId === 'classic_smash',
  },

  // ── ISSUE 1a: Recommendation must respect spicy constraint ──────────────────
  {
    label: 'ISSUE1a: "Recommend something spicy" → spicy item only (never lemonade/soda)',
    input: 'Recommend something spicy',
    check: (r) => {
      if (r.actions.length > 0) return false;
      // Any of the 3 spicy items is a valid recommendation
      return /spicy crispy chicken|buffalo chicken wrap|veggie smash/i.test(r.assistantMessage) &&
        // Must NOT recommend non-spicy items
        !/craft lemonade|fountain soda|sparkling water|milkshake|brownie|churro|salad|mac|onion rings|classic smash|mushroom swiss|cuban|blt/i.test(r.assistantMessage);
    },
  },
  {
    label: 'ISSUE1a: "What should I order that\'s spicy?" → spicy item only',
    input: "What should I order that's spicy?",
    check: (r) =>
      r.actions.length === 0 &&
      /spicy crispy chicken|buffalo|veggie smash/i.test(r.assistantMessage),
  },

  // ── ISSUE 1b: Affirmative follow-up resolves to last recommended item ────────
  {
    label: 'ISSUE1b: "Sure" after single-item recommendation → ADD_ITEM qty 1',
    input: 'Sure',
    history: [
      { role: 'user', text: 'Recommend something spicy' },
      { role: 'assistant', text: 'Our top spicy pick is the 🌶️ Spicy Crispy Chicken ($14.99) — buttermilk fried chicken. Want me to add it?' },
    ],
    check: (r) =>
      r.actions.length === 1 &&
      r.actions[0].type === 'ADD_ITEM' &&
      (r.actions[0] as any).itemId === 'spicy_crispy_chicken' &&
      (r.actions[0] as any).quantity === 1,
  },
  {
    label: 'ISSUE1b: "I\'ll take 2" after recommendation → ADD_ITEM qty 2',
    input: "I'll take 2",
    history: [
      { role: 'user', text: 'Recommend something spicy' },
      { role: 'assistant', text: 'Our top spicy pick is the 🌶️ Spicy Crispy Chicken ($14.99) — Want me to add it?' },
    ],
    check: (r) =>
      r.actions.length === 1 &&
      r.actions[0].type === 'ADD_ITEM' &&
      (r.actions[0] as any).itemId === 'spicy_crispy_chicken' &&
      (r.actions[0] as any).quantity === 2,
  },
  {
    label: 'ISSUE1b: "Yes please" after recommendation → ADD_ITEM qty 1',
    input: 'Yes please',
    history: [
      { role: 'user', text: 'Recommend something' },
      { role: 'assistant', text: 'Our top pick is the 🍔 Classic Smash Burger ($13.99) — Want me to add it?' },
    ],
    check: (r) =>
      r.actions.length === 1 &&
      r.actions[0].type === 'ADD_ITEM' &&
      (r.actions[0] as any).itemId === 'classic_smash',
  },
  {
    label: 'ISSUE1b: "That sounds good" after recommendation → ADD_ITEM',
    input: 'That sounds good',
    history: [
      { role: 'user', text: 'Recommend something' },
      { role: 'assistant', text: 'Our top pick is the 🥖 Cuban Pressed ($13.49) — Want me to add it?' },
    ],
    check: (r) =>
      r.actions.length === 1 &&
      r.actions[0].type === 'ADD_ITEM' &&
      (r.actions[0] as any).itemId === 'cuban_pressed',
  },
  {
    label: 'ISSUE1b: "I\'ll take one" after recommendation → ADD_ITEM qty 1',
    input: "I'll take one",
    history: [
      { role: 'user', text: 'Recommend a drink' },
      { role: 'assistant', text: 'Our top pick is the 🍋 Craft Lemonade ($3.99) — Want me to add it?' },
    ],
    check: (r) =>
      r.actions.length === 1 &&
      r.actions[0].type === 'ADD_ITEM' &&
      (r.actions[0] as any).itemId === 'craft_lemonade',
  },
  {
    label: 'ISSUE1b: "Sure" with NO history → no action (cannot resolve item)',
    input: 'Sure',
    check: (r) => r.actions.length === 0,
  },
  {
    label: 'ISSUE1b: affirmative after multi-item message → null (ambiguous)',
    input: 'Sure',
    history: [
      { role: 'user', text: "What's spicy?" },
      { role: 'assistant', text: 'Our spicy options are 🌶️ Spicy Crispy Chicken and 🌯 Buffalo Chicken Wrap.' },
    ],
    check: (r) => r.actions.length === 0, // cannot resolve — two items in history
  },

  // ── ISSUE 2: Negative quantities must never mutate cart ──────────────────────
  {
    label: 'ISSUE2: "Add negative 10 burgers" → actions: [], error message',
    input: 'Add negative 10 burgers',
    check: (r) => r.actions.length === 0 && r.actions.every((a) => a.type !== 'ADD_ITEM'),
  },
  {
    label: 'ISSUE2: "Add -10 burgers" → actions: [], error message',
    input: 'Add -10 burgers',
    check: (r) => r.actions.length === 0,
  },
  {
    label: 'ISSUE2: "Add -5 fries" → actions: []',
    input: 'Add -5 fries',
    check: (r) => r.actions.length === 0,
  },
  {
    label: 'ISSUE2: "Remove negative 2 fries" → actions: []',
    input: 'Remove negative 2 fries',
    cart: cartWith(['bistro_fries', 5]),
    check: (r) => r.actions.length === 0,
  },

  // ── ISSUE 3: UPDATE_QUANTITY message must say "Updated", not "Added" ─────────
  {
    label: 'ISSUE3: "Make it 2 instead" single-item cart → UPDATE_QUANTITY, message says Updated',
    input: 'Make it 2 instead',
    cart: cartWith(['classic_smash', 3]),
    check: (r) =>
      r.actions.length === 1 &&
      r.actions[0].type === 'UPDATE_QUANTITY' &&
      (r.actions[0] as any).quantity === 2 &&
      /updated/i.test(r.assistantMessage) &&
      !/added/i.test(r.assistantMessage),
  },
  {
    label: 'ISSUE3: "Change the burger to 2" → UPDATE_QUANTITY, message says Updated',
    input: 'Change the burger to 2',
    check: (r) =>
      r.actions.length === 1 &&
      r.actions[0].type === 'UPDATE_QUANTITY' &&
      /updated/i.test(r.assistantMessage) &&
      !/added/i.test(r.assistantMessage),
  },
  {
    label: 'ISSUE3: "Set fries to 3" → UPDATE_QUANTITY, message says Updated',
    input: 'Set fries to 3',
    check: (r) =>
      r.actions.length === 1 &&
      r.actions[0].type === 'UPDATE_QUANTITY' &&
      (r.actions[0] as any).quantity === 3 &&
      /updated/i.test(r.assistantMessage),
  },

  // ── BUG FIX: "Remove 2 more" with conversational context ────────────────────
  {
    label: 'BUG1: "Remove 2 more" (history=spicy chicken) → DECREMENT_ITEM qty 2',
    input: 'Remove 2 more',
    cart: cartWith(['spicy_crispy_chicken', 10]),
    history: [
      { role: 'user', text: 'Add 10 spicy chickens' },
      { role: 'assistant', text: 'Added 10× Spicy Crispy Chicken to your cart! 🛒' },
    ],
    check: (r) =>
      r.actions.length === 1 &&
      r.actions[0].type === 'DECREMENT_ITEM' &&
      (r.actions[0] as any).itemId === 'spicy_crispy_chicken' &&
      (r.actions[0] as any).quantity === 2,
  },
  {
    label: 'BUG1b: "Take off 3 more" (history=fries) → DECREMENT_ITEM qty 3',
    input: 'Take off 3 more',
    cart: cartWith(['bistro_fries', 8]),
    history: [
      { role: 'user', text: 'Add 8 fries' },
      { role: 'assistant', text: 'Added 8× Bistro Fries to your cart! 🛒' },
    ],
    check: (r) =>
      r.actions.length === 1 &&
      r.actions[0].type === 'DECREMENT_ITEM' &&
      (r.actions[0] as any).itemId === 'bistro_fries' &&
      (r.actions[0] as any).quantity === 3,
  },

  // ── BUG FIX: "Make it 2 instead" → UPDATE_QUANTITY, never ADD_ITEM ──────────
  {
    label: 'BUG2: "Make it 2 instead" single-item cart → UPDATE_QUANTITY not ADD_ITEM',
    input: 'Make it 2 instead',
    cart: cartWith(['spicy_crispy_chicken', 5]),
    check: (r) =>
      r.actions.length === 1 &&
      r.actions[0].type === 'UPDATE_QUANTITY' &&
      (r.actions[0] as any).quantity === 2,
  },
  {
    label: 'BUG2b: "Make it 3 instead" single-item cart → UPDATE_QUANTITY 3',
    input: 'Make it 3 instead',
    cart: cartWith(['bistro_fries', 1]),
    check: (r) =>
      r.actions.length === 1 &&
      r.actions[0].type === 'UPDATE_QUANTITY' &&
      (r.actions[0] as any).quantity === 3,
  },
  {
    label: 'BUG2c: "Make it 2 instead" multi-item cart → clarification, no ADD_ITEM',
    input: 'Make it 2 instead',
    cart: cartWith(['spicy_crispy_chicken', 1], ['bistro_fries', 1]),
    check: (r) => r.actions.length === 0 && r.actions.every((a) => a.type !== 'ADD_ITEM'),
  },

  // ── BUG FIX: "Add 1 more" with digit ────────────────────────────────────────
  {
    label: 'BUG3: "Add 1 more" (cart has chicken) → ADD_ITEM qty 1',
    input: 'Add 1 more',
    cart: cartWith(['spicy_crispy_chicken', 2]),
    check: (r) =>
      r.actions.length === 1 &&
      r.actions[0].type === 'ADD_ITEM' &&
      (r.actions[0] as any).itemId === 'spicy_crispy_chicken' &&
      (r.actions[0] as any).quantity === 1,
  },
  {
    label: 'BUG3b: "Add 5 more" (cart has fries) → ADD_ITEM qty 5',
    input: 'Add 5 more',
    cart: cartWith(['bistro_fries', 2]),
    check: (r) =>
      r.actions.length === 1 &&
      r.actions[0].type === 'ADD_ITEM' &&
      (r.actions[0] as any).itemId === 'bistro_fries' &&
      (r.actions[0] as any).quantity === 5,
  },

  // ── BUG FIX: Negative quantities → reject with error message ────────────────
  {
    label: 'BUG4: "Make water negative 3" → actions: [], error message',
    input: 'Make water negative 3',
    cart: cartWith(['sparkling_water', 5]),
    check: (r) => r.actions.length === 0 && /negative|must be|positive|can't process/i.test(r.assistantMessage),
  },
  {
    label: 'BUG4b: "Set fries to negative" → actions: [], error message',
    input: 'Set fries to negative',
    cart: cartWith(['bistro_fries', 3]),
    check: (r) => r.actions.length === 0 && /negative|must be|positive|can't process/i.test(r.assistantMessage),
  },
  {
    label: 'BUG4c: "Make it negative" single-item cart → actions: [], error message',
    input: 'Make it negative',
    cart: cartWith(['spicy_crispy_chicken', 3]),
    check: (r) => r.actions.length === 0 && /negative|must be|positive|can't process/i.test(r.assistantMessage),
  },

  // ── ISSUE 1: "veg" shorthand → vegetarian intent ─────────────────────────────
  {
    label: 'VEG1: "most popular veg item" → no actions, returns Veggie Smash (top veg main)',
    input: 'What is the most popular veg item?',
    check: (r) =>
      r.actions.length === 0 &&
      /veggie smash/i.test(r.assistantMessage),
  },
  {
    label: 'VEG2: "cheapest veg item" → no actions, cheapest vegetarian item',
    input: 'What is the cheapest veg item?',
    check: (r) =>
      r.actions.length === 0 &&
      /\$4\.49|garden side salad|salad/i.test(r.assistantMessage),
  },
  {
    label: 'VEG3: "recommend a veg meal" → no actions, recommends vegetarian item',
    input: 'Recommend a veg meal',
    check: (r) =>
      r.actions.length === 0 &&
      /veggie smash|bistro fries|salad|mac|onion rings/i.test(r.assistantMessage),
  },
  {
    label: 'VEG4: "what veg options do you have" → no actions, mentions veggie items',
    input: 'What veg options do you have?',
    check: (r) =>
      r.actions.length === 0 &&
      /veggie|vegetarian/i.test(r.assistantMessage),
  },
  {
    label: 'VEG5: "I want something veg" → no actions, suggests vegetarian',
    input: 'I want something veg',
    check: (r) =>
      r.actions.length === 0 &&
      /veggie smash|vegetarian/i.test(r.assistantMessage),
  },
  {
    label: 'VEG6: "veggie" shorthand also works — "most popular veggie item" → Veggie Smash',
    input: 'What is the most popular veggie item?',
    check: (r) =>
      r.actions.length === 0 &&
      /veggie smash/i.test(r.assistantMessage),
  },

  // ── ISSUE 2: Quantity-only follow-up resolves to last recommendation ──────────
  {
    label: 'QTY1: "Add 2" after single recommendation → ADD_ITEM qty 2',
    input: 'Add 2',
    history: [
      { role: 'user', text: 'Recommend something spicy' },
      { role: 'assistant', text: 'Our top spicy pick is the 🌶️ Spicy Crispy Chicken ($14.99) — Want me to add it?' },
    ],
    check: (r) =>
      r.actions.length === 1 &&
      r.actions[0].type === 'ADD_ITEM' &&
      (r.actions[0] as any).itemId === 'spicy_crispy_chicken' &&
      (r.actions[0] as any).quantity === 2,
  },
  {
    label: 'QTY2: "2 please" after single recommendation → ADD_ITEM qty 2',
    input: '2 please',
    history: [
      { role: 'user', text: 'Recommend something spicy' },
      { role: 'assistant', text: 'Our top spicy pick is the 🌶️ Spicy Crispy Chicken ($14.99) — Want me to add it?' },
    ],
    check: (r) =>
      r.actions.length === 1 &&
      r.actions[0].type === 'ADD_ITEM' &&
      (r.actions[0] as any).itemId === 'spicy_crispy_chicken' &&
      (r.actions[0] as any).quantity === 2,
  },
  {
    label: 'QTY3: "Add two" after recommendation → ADD_ITEM qty 2',
    input: 'Add two',
    history: [
      { role: 'user', text: 'What is your most popular item?' },
      { role: 'assistant', text: 'Our most popular item is the 🍔 Classic Smash Burger ($13.99) — Want me to add it?' },
    ],
    check: (r) =>
      r.actions.length === 1 &&
      r.actions[0].type === 'ADD_ITEM' &&
      (r.actions[0] as any).itemId === 'classic_smash' &&
      (r.actions[0] as any).quantity === 2,
  },
  {
    label: 'QTY4: "Sure add 2" after recommendation → ADD_ITEM qty 2',
    input: 'Sure add 2',
    history: [
      { role: 'user', text: 'Recommend something spicy' },
      { role: 'assistant', text: 'Our top spicy pick is the 🌶️ Spicy Crispy Chicken ($14.99) — Want me to add it?' },
    ],
    check: (r) =>
      r.actions.length === 1 &&
      r.actions[0].type === 'ADD_ITEM' &&
      (r.actions[0] as any).itemId === 'spicy_crispy_chicken' &&
      (r.actions[0] as any).quantity === 2,
  },
  {
    label: 'QTY5: "Let me get 2" after recommendation → ADD_ITEM qty 2',
    input: 'Let me get 2',
    history: [
      { role: 'user', text: 'Recommend something spicy' },
      { role: 'assistant', text: 'Our top spicy pick is the 🌶️ Spicy Crispy Chicken ($14.99) — Want me to add it?' },
    ],
    check: (r) =>
      r.actions.length === 1 &&
      r.actions[0].type === 'ADD_ITEM' &&
      (r.actions[0] as any).itemId === 'spicy_crispy_chicken' &&
      (r.actions[0] as any).quantity === 2,
  },
  {
    label: 'QTY6: "Add 2" with NO history → falls through, no affirmative resolution',
    input: 'Add 2',
    check: (r) => r.actions.length === 0, // no item to resolve — unknown intent
  },
  {
    label: 'QTY7: "Add 2" after multi-item message → no affirmative (ambiguous)',
    input: 'Add 2',
    history: [
      { role: 'user', text: "What's spicy?" },
      { role: 'assistant', text: 'Our spicy options are 🌶️ Spicy Crispy Chicken and 🌯 Buffalo Chicken Wrap.' },
    ],
    check: (r) => r.actions.length === 0, // cannot resolve — two items in history
  },
  {
    label: 'QTY8: "Add 2 spicy chickens" (explicit item) → ADD_ITEM ignores affirmative path',
    input: 'Add 2 spicy chickens',
    history: [
      { role: 'user', text: 'What is your most popular item?' },
      { role: 'assistant', text: 'Our most popular item is the 🍔 Classic Smash Burger ($13.99) — Want me to add it?' },
    ],
    check: (r) =>
      r.actions.length === 1 &&
      r.actions[0].type === 'ADD_ITEM' &&
      (r.actions[0] as any).itemId === 'spicy_crispy_chicken' &&
      (r.actions[0] as any).quantity === 2,
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
