import { MENU_ITEMS, CartItem, ConversationTurn } from '@bistro/shared';
import { ParseOrderResponse } from './schemas';

type MenuItem = typeof MENU_ITEMS[0];

// ─── Number parsing ───────────────────────────────────────────────────────────

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

function parseQuantityFromTokens(tokens: string[]): number {
  for (const t of tokens) {
    const word = NUMBER_WORDS[t.toLowerCase()];
    if (word) return word;
    const n = parseInt(t, 10);
    if (!isNaN(n) && n > 0 && n <= 20) return n;
  }
  return 1;
}

function hasExplicitQty(tokens: string[]): boolean {
  return tokens.some(
    (t) =>
      NUMBER_WORDS[t.toLowerCase()] !== undefined ||
      (!isNaN(parseInt(t, 10)) && parseInt(t, 10) > 0)
  );
}

// ─── Item lookup ──────────────────────────────────────────────────────────────

// Ordered alias table: first match wins. Specific patterns before generic.
const ALIASES: [RegExp, string][] = [
  [/\bspicy\s*(?:crispy\s*)?chickens?\b/i,      'spicy_crispy_chicken'],
  [/buffalo\s*(chicken\s*)?(wrap)?/i,            'buffalo_chicken_wrap'],
  [/\bsparkling\s*water\b|\blarge\s*water\b|\bwaters?\b/i, 'sparkling_water'],
  [/bistro\s*fries|french\s*fries|\bfries\b/i,  'bistro_fries'],
  [/onion\s*rings?/i,                            'onion_rings'],
  [/truffle\s*mac|mac\s*(and\s*|&\s*|n\s*)?cheese|\bmac\b/i, 'mac_and_cheese'],
  [/milkshake|\bshake\b/i,                       'milkshake'],
  [/craft\s*lemonade|lemonade/i,                 'craft_lemonade'],
  [/\bsoda\b|pepsi|coke|\bpop\b/i,               'fountain_soda'],
  [/brownie|sundae/i,                            'brownie_sundae'],
  [/churros?/i,                                  'churro_bites'],
  [/garden\s*salad|side\s*salad|\bsalad\b/i,     'side_salad'],
  [/cuban/i,                                     'cuban_pressed'],
  [/\bblt\b/i,                                   'blt_deluxe'],
  [/mushroom/i,                                  'mushroom_swiss'],
  [/veggie\s*smash|veggie\s*burger|\bveggie\b|\bvegan\b|black\s*bean/i, 'veggie_smash'],
  [/smash\s*burger|classic\s*(smash|burger)/i,   'classic_smash'],
  // Generic last-resort aliases
  [/\bburger\b/i,                                'classic_smash'],
  [/\bchickens?\b/i,                             'spicy_crispy_chicken'],
  [/\bwrap\b/i,                                  'buffalo_chicken_wrap'],
  [/\bring\b/i,                                  'onion_rings'],
];

function lookupAlias(text: string): MenuItem | null {
  for (const [pattern, id] of ALIASES) {
    if (pattern.test(text)) {
      return MENU_ITEMS.find((i) => i.id === id) ?? null;
    }
  }
  return null;
}

function fuzzyScore(text: string, item: MenuItem): number {
  const t = text.toLowerCase();
  let score = 0;
  for (const part of item.name.toLowerCase().split(/\s+/)) {
    if (part.length > 3 && t.includes(part)) score += 2;
  }
  for (const tag of item.tags) {
    if (t.includes(tag.toLowerCase())) score += 1;
  }
  if (t.includes(item.id.replace(/_/g, ' '))) score += 3;
  return score;
}

function findItem(text: string): MenuItem | null {
  const alias = lookupAlias(text);
  if (alias) return alias;
  let best = { item: MENU_ITEMS[0], score: 0 };
  for (const item of MENU_ITEMS) {
    const s = fuzzyScore(text, item);
    if (s > best.score) best = { item, score: s };
  }
  return best.score >= 2 ? best.item : null;
}

// Try to find a cart item matching the text; prefers cart items over all menu items.
function findCartItem(text: string, cartItems: CartItem[]): CartItem | null {
  if (cartItems.length === 0) return null;
  // Score cart items first — prefer exact cart matches
  let best: CartItem | null = null;
  let bestScore = 0;
  for (const ci of cartItems) {
    const alias = lookupAlias(text);
    if (alias && alias.id === ci.menuItem.id) return ci;
    const s = fuzzyScore(text, ci.menuItem);
    if (s > bestScore) { best = ci; bestScore = s; }
  }
  return bestScore >= 2 ? best : null;
}

// ─── Multi-item segment splitting ─────────────────────────────────────────────

function splitSegments(text: string): string[] {
  return text
    .split(/\s*(?:\band\b|,|&|\bplus\b)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseSegment(segment: string): { qty: number; text: string } {
  const tokens = segment.split(/\s+/);
  const qty = parseQuantityFromTokens(tokens);
  const cleaned = tokens
    .filter((t) => NUMBER_WORDS[t.toLowerCase()] === undefined && isNaN(parseInt(t, 10)))
    .join(' ')
    .trim();
  return { qty, text: cleaned || segment };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(p: number) {
  return `$${p.toFixed(2)}`;
}

function cartTotal(cartItems: CartItem[]) {
  const subtotal = cartItems.reduce((s, ci) => s + ci.menuItem.price * ci.quantity, 0);
  const tax = subtotal * 0.0875;
  return { subtotal, tax, total: subtotal + tax };
}

function applyActionsToCart(cartItems: CartItem[], actions: ParseOrderResponse['actions']): CartItem[] {
  const next = cartItems.map((ci) => ({ ...ci, modifiers: [...ci.modifiers] }));

  for (const action of actions) {
    if (action.type === 'CLEAR_CART') return [];

    if (action.type === 'ADD_ITEM') {
      const menuItem = MENU_ITEMS.find((item) => item.id === action.itemId);
      if (!menuItem) continue;
      const existing = next.find((ci) => ci.menuItem.id === action.itemId);
      if (existing) {
        existing.quantity += action.quantity;
      } else {
        next.push({ menuItem, quantity: action.quantity, modifiers: action.modifiers ?? [] });
      }
      continue;
    }

    if (action.type === 'REMOVE_ITEM') {
      const index = next.findIndex((ci) => ci.menuItem.id === action.itemId);
      if (index >= 0) next.splice(index, 1);
      continue;
    }

    if (action.type === 'DECREMENT_ITEM') {
      const existing = next.find((ci) => ci.menuItem.id === action.itemId);
      if (!existing) continue;
      existing.quantity -= action.quantity;
      if (existing.quantity <= 0) {
        const index = next.findIndex((ci) => ci.menuItem.id === action.itemId);
        if (index >= 0) next.splice(index, 1);
      }
      continue;
    }

    if (action.type === 'UPDATE_QUANTITY') {
      const existing = next.find((ci) => ci.menuItem.id === action.itemId);
      if (!existing) continue;
      existing.quantity = action.quantity;
    }
  }

  return next;
}

function withCartChangeSummary(
  assistantMessage: string,
  cartItems: CartItem[],
  actions: ParseOrderResponse['actions']
): string {
  if (actions.length === 0) return assistantMessage;

  const nextCart = applyActionsToCart(cartItems, actions);
  if (nextCart.length === 0) {
    return `${assistantMessage} Your cart is now empty.`;
  }

  const { total } = cartTotal(nextCart);
  return `${assistantMessage} Your cart total is now ${fmt(total)}. Ready to checkout, or would you like to add anything else?`;
}

function isSpicy(item: MenuItem): boolean {
  return (
    item.tags.includes('spicy') ||
    /spicy|ghost pepper|buffalo|chipotle/i.test(item.description)
  );
}

function isVegetarian(item: MenuItem): boolean {
  return item.tags.includes('vegetarian') || item.tags.includes('vegan-option');
}

function extractLastReferencedItem(history: ConversationTurn[]): MenuItem | null {
  for (const turn of [...history].reverse()) {
    const item = findItem(turn.text);
    if (item) return item;
  }
  return null;
}

function resolveContextTarget(cartItems: CartItem[], history: ConversationTurn[]): MenuItem | null | 'ambiguous' {
  if (cartItems.length === 1) return cartItems[0].menuItem;
  if (cartItems.length === 0) return null;

  const historyItem = extractLastReferencedItem(history) ?? extractLastSuggestedItem(history);
  if (!historyItem) return 'ambiguous';

  const inCart = cartItems.find((ci) => ci.menuItem.id === historyItem.id);
  return inCart ? inCart.menuItem : 'ambiguous';
}

function buildQuantityClarification(quantity: number, cartItems: CartItem[]): ParseOrderResponse {
  const names = cartItems.map((ci) => ci.menuItem.name).join(', ');
  return {
    actions: [],
    assistantMessage: `Which item should I update to ${quantity}? You have: ${names}.`,
  };
}

function buildContextQuantityUpdate(
  quantity: number,
  cartItems: CartItem[],
  history: ConversationTurn[]
): ParseOrderResponse {
  const target = resolveContextTarget(cartItems, history);
  if (target === 'ambiguous') {
    return buildQuantityClarification(quantity, cartItems);
  }
  if (!target) {
    return {
      actions: [],
      assistantMessage: 'Your cart is empty — nothing to update. What would you like to order?',
    };
  }

  const actions: ParseOrderResponse['actions'] = [
    { type: 'UPDATE_QUANTITY', itemId: target.id, quantity },
  ];
  return {
    actions,
    assistantMessage: withCartChangeSummary(`Updated ${target.name} to ${quantity}.`, cartItems, actions),
  };
}

// ─── Cart inspection ──────────────────────────────────────────────────────────

function handleCartQuery(lower: string, cartItems: CartItem[]): ParseOrderResponse | null {
  const isCartContents = /what('s| is) in (my |the )?cart|show.*cart|my (current )?cart|(what (do|did) i (have|order|get)|cart (items|contents)|review.*order|summarize.*order)/.test(lower);
  const isTotalQuery = /\b(my (total|tab|bill)|how much (is|does|will|do i)|what('s| is) (my )?total|what (do i|will i) owe|order (cost|total|price)|current (total|cost))\b/.test(lower);
  const isDrinkQuery = /do (i|we) have (any )?(drinks?|water|soda|lemonade|milkshake|something to drink)/.test(lower);

  if (!isCartContents && !isTotalQuery && !isDrinkQuery) return null;

  if (cartItems.length === 0) {
    return {
      actions: [],
      assistantMessage: "Your cart is empty — what can I get started for you? 🍽️",
    };
  }

  const { subtotal, tax, total } = cartTotal(cartItems);

  if (isTotalQuery) {
    return {
      actions: [],
      assistantMessage: `Your current total is ${fmt(total)} (${fmt(subtotal)} + ${fmt(tax)} tax). Ready to place your order?`,
    };
  }

  const list = cartItems
    .map((ci) => `${ci.quantity}× ${ci.menuItem.name} (${fmt(ci.menuItem.price * ci.quantity)})`)
    .join(', ');
  return {
    actions: [],
    assistantMessage: `You have: ${list}. Total: ${fmt(total)} with tax. Ready to place the order, or would you like to add anything else?`,
  };
}

function handleCheckoutIntent(lower: string, cartItems: CartItem[]): ParseOrderResponse | null {
  const isCheckoutIntent =
    /\b(ready to checkout|ready to check out|i am ready to checkout|i'm ready to checkout|i am done|i'm done|that should be it|that is it|that's it|that should do it|that should do|i am finished|i'm finished)\b/.test(lower);

  if (!isCheckoutIntent) return null;

  if (cartItems.length === 0) {
    return {
      actions: [],
      assistantMessage: "Your cart is empty right now — add a few items first, then head to Cart when you're ready to order.",
    };
  }

  const { total } = cartTotal(cartItems);
  return {
    actions: [],
    assistantMessage: `You're all set. Go to the Cart tab to place your order. Your total is ${fmt(total)}.`,
  };
}

// ─── Remove / decrement helpers ───────────────────────────────────────────────

// Hard-remove verbs — unambiguous
const REMOVE_VERB_RE = /\b(remove|delete|take\s+(?:off|away)|cancel|drop)\b/i;
// Soft-remove patterns — implicit intent
const IMPLICIT_REMOVE_RE = /\b(no\s+more|don'?t\s+(want|need)|do\s+not\s+(want|need)|actually\s+no|forget\s+(about\s+|it\s+—\s+no\s+)?the?|skip\s+the?|get\s+rid\s+of|scratch\s+(the\s+)?that|i\s+changed\s+my\s+mind\s+on\s+the?)\b/i;
// Filler words to strip before item/qty detection
const FILLER_RE = /\b(like|about|around|some|the|my|those|these|just|only|all\s+of\s+the|of)\b/gi;

function hasRemoveIntent(lower: string): boolean {
  return REMOVE_VERB_RE.test(lower) || IMPLICIT_REMOVE_RE.test(lower);
}

function parseRemove(lower: string, cartItems: CartItem[], history: ConversationTurn[] = []): ParseOrderResponse | null {
  // Extract text after the triggering verb/phrase
  let afterVerb = lower;
  const hardVerbMatch = lower.match(/\b(?:remove|delete|take\s+(?:off|away)|cancel|drop)\b\s*(.*)/i);
  const softVerbMatch = lower.match(
    /\b(?:no\s+more|don'?t\s+(?:want|need)|do\s+not\s+(?:want|need)|actually\s+no|forget\s+(?:about\s+)?the?|skip\s+the?|get\s+rid\s+of|scratch\s+(?:the\s+)?that)\b\s*(.*)/i
  );

  if (hardVerbMatch) afterVerb = hardVerbMatch[1];
  else if (softVerbMatch) afterVerb = softVerbMatch[1];

  afterVerb = afterVerb.replace(FILLER_RE, '').replace(/\s+/g, ' ').trim();

  const removeAll = /\ball\b/.test(lower) || /\beverything\b/.test(lower);

  // ── Multi-item removal ("Remove 2 waters and 2 fries") ──────────────────────
  const multiSegments = afterVerb
    .split(/\s*(?:\band\b|,|&|\bplus\b)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);

  if (multiSegments.length > 1) {
    const actions: ParseOrderResponse['actions'] = [];
    const removedLabels: string[] = [];

    for (const seg of multiSegments) {
      const segTokens = seg.split(/\s+/);
      const segText = segTokens
        .filter((t) => NUMBER_WORDS[t.toLowerCase()] === undefined && isNaN(parseInt(t, 10)))
        .join(' ')
        .trim();

      const cm = findCartItem(segText || seg, cartItems);
      if (!cm) continue;

      const explicitSegQty = hasExplicitQty(segTokens);
      if (removeAll || !explicitSegQty) {
        actions.push({ type: 'REMOVE_ITEM', itemId: cm.menuItem.id });
        removedLabels.push(cm.menuItem.name);
      } else {
        const qty = parseQuantityFromTokens(segTokens);
        if (qty >= cm.quantity) {
          actions.push({ type: 'REMOVE_ITEM', itemId: cm.menuItem.id });
          removedLabels.push(cm.menuItem.name);
        } else {
          actions.push({ type: 'DECREMENT_ITEM', itemId: cm.menuItem.id, quantity: qty });
          removedLabels.push(`${qty}× ${cm.menuItem.name}`);
        }
      }
    }

    if (actions.length > 0) {
      const summary =
        removedLabels.length === 1
          ? removedLabels[0]
          : `${removedLabels.slice(0, -1).join(', ')} and ${removedLabels[removedLabels.length - 1]}`;
      return {
        actions,
        assistantMessage: withCartChangeSummary(`Removed ${summary} from your cart.`, cartItems, actions),
      };
    }
    return null;
  }

  // ── Single-item removal ───────────────────────────────────────────────────
  let cartMatch = findCartItem(afterVerb || lower, cartItems);
  let item = cartMatch?.menuItem ?? findItem(afterVerb || lower);

  // If text-based lookup failed, fall back to the last item mentioned in conversation history
  if (!item && history.length > 0) {
    const historyItem = extractLastSuggestedItem(history);
    if (historyItem) {
      const histCartMatch = cartItems.find((ci) => ci.menuItem.id === historyItem.id);
      if (histCartMatch) { item = historyItem; cartMatch = histCartMatch; }
    }
  }

  if (!item) return null;

  // Item identified but not present in the cart — nothing to remove.
  if (!cartMatch) return null;

  if (removeAll) {
    const actions: ParseOrderResponse['actions'] = [{ type: 'REMOVE_ITEM', itemId: item.id }];
    return {
      actions,
      assistantMessage: withCartChangeSummary(`Done — removed all ${item.name} from your cart.`, cartItems, actions),
    };
  }

  const tokens = afterVerb.split(/\s+/);
  const explicitQty = hasExplicitQty(tokens);

  if (explicitQty) {
    const qty = parseQuantityFromTokens(tokens);
    const currentQty = cartMatch?.quantity ?? 0;

    if (currentQty > 0 && qty >= currentQty) {
      const actions: ParseOrderResponse['actions'] = [{ type: 'REMOVE_ITEM', itemId: item.id }];
      return {
        actions,
        assistantMessage: withCartChangeSummary(`Done — removed all ${item.name} from your cart.`, cartItems, actions),
      };
    }

    const remaining = currentQty > 0 ? currentQty - qty : 0;
    const actions: ParseOrderResponse['actions'] = [{ type: 'DECREMENT_ITEM', itemId: item.id, quantity: qty }];
    return {
      actions,
      assistantMessage: withCartChangeSummary(
        remaining > 0
          ? `Removed ${qty}× ${item.name} — you now have ${remaining} left in your cart.`
          : `Removed ${item.name} from your cart.`,
        cartItems,
        actions
      ),
    };
  }

  const actions: ParseOrderResponse['actions'] = [{ type: 'REMOVE_ITEM', itemId: item.id }];
  return {
    actions,
    assistantMessage: withCartChangeSummary(`Done — removed ${item.name} from your cart.`, cartItems, actions),
  };
}

// ─── Context-aware commands ───────────────────────────────────────────────────

function handleContextCommand(lower: string, cartItems: CartItem[], history: ConversationTurn[] = []): ParseOrderResponse | null {
  // "add one more", "add 1 more", "add 5 more", "another one", "same thing again"
  const addMoreRe = /\b(?:add\s+)?(?:(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+)?more\b|\banother(?:\s+one)?\b(?!\s+\w)|\bsame\s+(?:thing\s+)?again\b/i;
  if (addMoreRe.test(lower) && !hasRemoveIntent(lower)) {
    const cleaned = lower
      .replace(/\b(add|more|another|one|two|three|four|five|six|seven|eight|nine|ten|\d+|the|a|an|of|same|again|thing|please)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!(cleaned.length > 1 && findItem(cleaned))) {
      const qtyMatch = lower.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+more\b/i);
      const qty = qtyMatch ? parseQuantityFromTokens([qtyMatch[1]]) : 1;
      const target =
        cartItems.length > 0
          ? cartItems[cartItems.length - 1].menuItem
          : extractLastSuggestedItem(history);
      if (!target) {
        return { actions: [], assistantMessage: "Your cart is empty — what would you like to add first?" };
      }
      const actions: ParseOrderResponse['actions'] = [{ type: 'ADD_ITEM', itemId: target.id, quantity: qty, modifiers: [] }];
      return {
        actions,
        assistantMessage: withCartChangeSummary(
          qty === 1
            ? `Added another ${target.name} to your cart! 🛒`
            : `Added ${qty}× more ${target.name} to your cart! 🛒`,
          cartItems,
          actions
        ),
      };
    }
  }

  // "only one [item]", "just one [item]" → UPDATE_QUANTITY 1
  const onlyMatch = lower.match(/\b(only|just)\s+(one|1|a)\s+(.+)/);
  if (onlyMatch) {
    const itemText = onlyMatch[3];
    const item = findItem(itemText);
    if (item) {
      const actions: ParseOrderResponse['actions'] = [{ type: 'UPDATE_QUANTITY', itemId: item.id, quantity: 1 }];
      return {
        actions,
        assistantMessage: withCartChangeSummary(`Updated ${item.name} to 1.`, cartItems, actions),
      };
    }
  }

  const contextualOneMatch = lower.match(/^(?:add\s+)?(?:make\s+(?:it|that)\s+)?(?:just|only\s+)?(one|1|a)(?:\s+instead)?$/i);
  if (contextualOneMatch || /^(?:just|only)\s+one$/i.test(lower)) {
    return buildContextQuantityUpdate(1, cartItems, history);
  }

  // "make it/that X", "change it to X", "make that three instead", "actually make it 2"
  // "make the chicken 3", "actually make the waters 4"
  const makeMatch = lower.match(
    /\b(?:actually\s+)?(?:make\s+(?:it|that|the\s+\w+|my)|change\s+(?:it|that|the\s+\w+)\s+to|set\s+(?:it|that|the\s+\w+)\s+to)\s+(\w+)/
  );
  if (makeMatch) {
    if (makeMatch[1].toLowerCase() === 'negative') {
      return { actions: [], assistantMessage: 'Quantities must be 1 or more.' };
    }
    const qty = parseQuantityFromTokens([makeMatch[1]]);

    // Check if a named item is in the message (strip the update phrase first)
    const stripped = lower
      .replace(/\b(?:actually|make|change|set|it|that|to|the|my|instead|please)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    const mentionedItem = stripped.length > 1 ? findItem(stripped) : null;

    if (mentionedItem) {
      const actions: ParseOrderResponse['actions'] = [{ type: 'UPDATE_QUANTITY', itemId: mentionedItem.id, quantity: qty }];
      return {
        actions,
        assistantMessage: withCartChangeSummary(`Updated ${mentionedItem.name} to ${qty}.`, cartItems, actions),
      };
    }

    // No item named → use cart context
    return buildContextQuantityUpdate(qty, cartItems, history);
  }

  return null;
}

// ─── Intent classification ────────────────────────────────────────────────────

// Returns true when the message is unambiguously an order command.
// "Can I get a burger?" starts with an order verb → order, not a question.
function hasExplicitOrderIntent(lower: string): boolean {
  return /^(add|order|can\s+i\s+(get|have)|give\s+me|let\s+me\s+(get|have)|i('d|\s+would)\s+like|i\s+want|throw\s+in|can\s+you\s+add|get\s+me)\b/.test(
    lower
  );
}

// ─── Menu questions ───────────────────────────────────────────────────────────

function isQuestion(msg: string): boolean {
  return /[?]|^(what|which|who|how|can\s+you|do\s+you|is\s+(there|the|it|a)|are\s+(there|the)|tell\s+me|show\s+me|list|any|describe)/i.test(
    msg
  );
}

function handleQuestion(lower: string, cartItems: CartItem[]): ParseOrderResponse | null {
  // ── Cart total (bypass filter pipeline) ────────────────────────────────────
  if (
    /\b(my (total|tab|bill)|how much (is|does|will|do i)|what('s| is) (my )?total|what (do i|will i) owe|order (cost|total|price))\b/.test(
      lower
    )
  ) {
    if (cartItems.length === 0) {
      return { actions: [], assistantMessage: "Your cart is empty — add some items and I'll tally it up!" };
    }
    const { subtotal, tax, total } = cartTotal(cartItems);
    return {
      actions: [],
      assistantMessage: `Your total is ${fmt(total)} (${fmt(subtotal)} subtotal + ${fmt(tax)} tax).`,
    };
  }

  // ── Item composition: "what comes with X", "what's in X", "what toppings on X" ──
  if (
    /tell\s+me\s+about|describe|what'?s?\s+(in|on|inside|on\s+top\s+of)\b|what\s+comes?\s+(with|on)\b|toppings?\s+(on|of)\b|ingredients?\s+in\b|does.*comes?\s+with|what.*includes?\b|what'?s?\s+included/.test(
      lower
    )
  ) {
    const item = findItem(lower);
    if (item) {
      return {
        intent: 'MENU_QUESTION',
        actions: [],
        assistantMessage: `${item.imageEmoji} ${item.name} (${fmt(item.price)}) — ${item.description}`,
      };
    }
  }

  // ── Spicy / heat questions: "is X spicy?", "how spicy is X?", "is it hot?" ──
  // Guard: let superlative/filter queries ("cheapest spicy item") fall to filter pipeline
  if (
    !/\bcheapest\b|least\s+expensive|most\s+affordable|most\s+expensive|under\s+\$|\bitems?\b/i.test(lower) &&
    /\b(is|how)\b.*(spicy|hot)\b|\b(spicy|hot)\b.*\b(is|are)\b|\bhow\s+much\s+(heat|spice)\b/.test(lower)
  ) {
    const item = findItem(lower);
    if (item) {
      const spicy = isSpicy(item);
      return {
        intent: 'MENU_QUESTION',
        actions: [],
        assistantMessage: spicy
          ? `${item.imageEmoji} ${item.name} is spicy — ${item.description}`
          : `${item.imageEmoji} ${item.name} is not spicy — ${item.description}`,
      };
    }
    // Generic "is it spicy" without a named item
    const spicyItems = MENU_ITEMS.filter(isSpicy);
    return {
      intent: 'MENU_QUESTION',
      actions: [],
      assistantMessage: `Our spicy options are ${spicyItems.map((i) => `${i.imageEmoji} ${i.name}`).join(' and ')}. Everything else is mild!`,
    };
  }

  // ── Filter pipeline ─────────────────────────────────────────────────────────
  // Detect every constraint in the query, then intersect them.
  const wantsSpicy    = /\bspicy\b|hot\s*food|\bhot\b/.test(lower);
  const wantsVeg      = /\bvegetarian\b|\bvegan\b|\bveg\b|\bveggie\b|plant.based|no\s*meat|meatless/.test(lower);
  const wantsPopular  = /\bpopular\b|\bbestseller\b|best\s*seller|most\s*(ordered|liked|loved|popular)|what('s| is) good|\bbest\s+item\b|\btop\s+item\b/.test(lower);
  const wantsDrinks   = /\bdrinks?\b|\bbeverages?\b|something to drink/.test(lower);
  const wantsDesserts = /\bdesserts?\b|\bsweets?\b|something sweet/.test(lower);
  const wantsSides    = /\bsides?\b|\bstarters?\b/.test(lower);
  const wantsCheapest = /\bcheapest\b|least expensive|lowest price|most affordable/.test(lower);
  const wantsExpensive = /most expensive|priciest/.test(lower);

  const underPriceMatch = lower.match(/under\s+\$?(\d+)|less\s+than\s+\$?(\d+)/);
  const maxPrice = underPriceMatch
    ? parseInt(underPriceMatch[1] ?? underPriceMatch[2], 10)
    : null;

  const hasFilter =
    wantsSpicy || wantsVeg || wantsPopular || wantsDrinks || wantsDesserts ||
    wantsSides || wantsCheapest || wantsExpensive || maxPrice !== null;

  if (hasFilter && !/(meal|combo|build|suggest|budget)/.test(lower)) {
    let pool = [...MENU_ITEMS];
    const labels: string[] = [];

    if (wantsSpicy)    { pool = pool.filter(isSpicy);                          labels.push('spicy'); }
    if (wantsVeg)      { pool = pool.filter(isVegetarian);                     labels.push('vegetarian'); }
    if (wantsDrinks)   { pool = pool.filter((i) => i.category === 'drinks');   labels.push('drink'); }
    if (wantsDesserts) { pool = pool.filter((i) => i.category === 'desserts'); labels.push('dessert'); }
    if (wantsSides)    { pool = pool.filter((i) => i.category === 'sides');    labels.push('side'); }
    if (maxPrice !== null) { pool = pool.filter((i) => i.price < maxPrice); }

    // Singular pick fires BEFORE popular filter so e.g. "most popular veg item" returns
    // the best vegetarian main (Veggie Smash) rather than the only popular+veg side (Bistro Fries).
    // Sort: main courses (burgers/sandwiches) first, then popular items, then by price.
    const wantsSinglePick =
      wantsPopular &&
      /\bmost\s+popular\b|\bbest\s+(?:item|seller)\b|\btop\s+(?:item|pick)\b|\bnumber\s+one\b/i.test(lower);
    if (wantsSinglePick && pool.length > 0) {
      const sorted = [...pool].sort((a, b) => {
        const isMain = (i: MenuItem) => i.category === 'burgers' || i.category === 'sandwiches';
        if (isMain(a) && !isMain(b)) return -1;
        if (!isMain(a) && isMain(b)) return 1;
        if (a.popular && !b.popular) return -1;
        if (!a.popular && b.popular) return 1;
        return a.price - b.price;
      });
      const item = sorted[0];
      const qualifier = labels.length > 0 ? `${labels.join(' and ')} ` : '';
      return {
        intent: 'MENU_QUESTION' as const,
        actions: [],
        assistantMessage: `Our most popular ${qualifier}item is the ${item.imageEmoji} ${item.name} (${fmt(item.price)}) — ${item.description} Want me to add it?`,
      };
    }

    // Popular filter for multi-result paths (not single-pick)
    if (wantsPopular) { pool = pool.filter((i) => i.popular); labels.push('popular'); }

    const ctx = labels.join(' and ');

    if (pool.length === 0) {
      const priceClause = maxPrice !== null ? ` under ${fmt(maxPrice)}` : '';
      return {
        intent: 'MENU_QUESTION' as const,
        actions: [],
        assistantMessage: `We don't have any ${ctx || 'matching'}${priceClause} options. Check the full menu for everything we offer!`,
      };
    }

    // Cheapest within filtered pool
    if (wantsCheapest) {
      const item = [...pool].sort((a, b) => a.price - b.price)[0];
      return {
        intent: 'MENU_QUESTION' as const,
        actions: [],
        assistantMessage: `The cheapest${ctx ? ' ' + ctx : ''} item is ${item.imageEmoji} ${item.name} at ${fmt(item.price)}.`,
      };
    }

    // Most expensive within filtered pool
    if (wantsExpensive) {
      const item = [...pool].sort((a, b) => b.price - a.price)[0];
      return {
        intent: 'MENU_QUESTION' as const,
        actions: [],
        assistantMessage: `The most expensive${ctx ? ' ' + ctx : ''} item is ${item.imageEmoji} ${item.name} at ${fmt(item.price)}.`,
      };
    }

    // Price-capped list
    if (maxPrice !== null && !wantsCheapest) {
      const list = pool.map((i) => `${i.imageEmoji} ${i.name} (${fmt(i.price)})`).join(', ');
      const qualifier = ctx ? `${ctx} items` : 'items';
      return {
        intent: 'MENU_QUESTION' as const,
        actions: [],
        assistantMessage: `${qualifier.charAt(0).toUpperCase() + qualifier.slice(1)} under ${fmt(maxPrice)}: ${list}.`,
      };
    }

    // Single result — be specific
    if (pool.length === 1) {
      const item = pool[0];
      return {
        actions: [],
        assistantMessage: `Our only ${ctx} option is ${item.imageEmoji} ${item.name} (${fmt(item.price)}) — ${item.description} Want me to add it?`,
      };
    }

    const list = pool.map((i) => `${i.imageEmoji} ${i.name} (${fmt(i.price)})`).join(', ');
    const opener = ctx ? `Our ${ctx} options` : 'Here\'s what we have';
    const cta = wantsDrinks ? 'Which one can I add?' : 'Want me to add one?';
    return {
      intent: 'MENU_QUESTION' as const,
      actions: [],
      assistantMessage: `${opener}: ${list}. ${cta}`,
    };
  }

  // ── Specific item check ("do you have X?") ──────────────────────────────────
  if (/do you have|have.*on.*menu|is.*available|do.*serve/.test(lower)) {
    const item = findItem(lower);
    if (item) {
      return {
        intent: 'MENU_QUESTION' as const,
        actions: [],
        assistantMessage: `Yes! ${item.imageEmoji} ${item.name} (${fmt(item.price)}) — ${item.description}`,
      };
    }
    return {
      intent: 'MENU_QUESTION' as const,
      actions: [],
      assistantMessage: "I don't think we carry that — check the full menu on the Menu tab!",
    };
  }

  return null;
}

// ─── Budget / recommendation ──────────────────────────────────────────────────

function buildBudgetMeal(lower: string, budget: number): ParseOrderResponse {
  const wantsSpicy = /spicy|hot\s*food|heat/.test(lower);
  const wantsVeg = /\bvegetarian\b|\bvegan\b|\bveg\b|\bveggie\b|plant.based|no\s*meat/.test(lower);

  function mainQualifies(item: MenuItem): boolean {
    if (wantsSpicy) return isSpicy(item);
    if (wantsVeg) return isVegetarian(item);
    return true;
  }

  function sortPopularFirst(items: MenuItem[]): MenuItem[] {
    return [...items].sort((a, b) => (b.popular ? 1 : 0) - (a.popular ? 1 : 0) || a.price - b.price);
  }

  let total = 0;
  const picked: MenuItem[] = [];

  // Main (burger or sandwich, constraint-filtered)
  for (const m of sortPopularFirst(
    MENU_ITEMS.filter(
      (i) => (i.category === 'burgers' || i.category === 'sandwiches') && mainQualifies(i)
    )
  )) {
    if (total + m.price <= budget) { picked.push(m); total += m.price; break; }
  }

  if (picked.length === 0) {
    const constraint = wantsSpicy ? 'spicy' : wantsVeg ? 'vegetarian' : '';
    const cheapestMain = Math.min(
      ...MENU_ITEMS.filter(
        (i) => (i.category === 'burgers' || i.category === 'sandwiches') && mainQualifies(i)
      ).map((i) => i.price)
    );
    return {
      actions: [],
      assistantMessage: constraint
        ? `I couldn't find a ${constraint} main under ${fmt(budget)}. Our ${constraint} mains start at ${fmt(cheapestMain)}.`
        : `I couldn't build a full meal under ${fmt(budget)}. Our cheapest main starts at ${fmt(cheapestMain)}.`,
    };
  }

  // Side (any, popular first)
  for (const s of sortPopularFirst(MENU_ITEMS.filter((i) => i.category === 'sides'))) {
    if (total + s.price <= budget) { picked.push(s); total += s.price; break; }
  }

  // Drink (cheapest first)
  for (const d of [...MENU_ITEMS.filter((i) => i.category === 'drinks')].sort((a, b) => a.price - b.price)) {
    if (total + d.price <= budget) { picked.push(d); total += d.price; break; }
  }

  const label = wantsSpicy ? 'spicy ' : wantsVeg ? 'vegetarian ' : '';
  return {
    actions: picked.map((i) => ({ type: 'ADD_ITEM' as const, itemId: i.id, quantity: 1, modifiers: [] })),
    assistantMessage: `Here's a ${label}meal under ${fmt(budget)}: ${picked.map((i) => i.name).join(', ')} — ${fmt(total)} total. Enjoy! 🍽️`,
  };
}

function handleRecommendation(lower: string): ParseOrderResponse | null {
  // "I want something spicy", "I'm craving something hot"
  if (/\b(want|craving|in\s+the\s+mood\s+for)\s+(something\s+)?(spicy|hot\s*food)\b/.test(lower)) {
    const items = MENU_ITEMS.filter(isSpicy);
    const list = items.map((i) => `${i.imageEmoji} ${i.name} (${fmt(i.price)})`).join(' or ');
    return {
      actions: [],
      assistantMessage: `Great choice for spice lovers! Try ${list}. Which shall I add? 🌶️`,
    };
  }

  // "I want a drink", "can you add a drink", "throw in a drink"
  if (/\b(want|add|get|throw in|have)\s+(a\s+)?(drink|beverage|something to drink)\b/.test(lower)) {
    const items = MENU_ITEMS.filter((i) => i.category === 'drinks');
    const list = items.map((i) => `${i.imageEmoji} ${i.name} (${fmt(i.price)})`).join(', ');
    return {
      actions: [],
      assistantMessage: `Our drinks: ${list}. Just let me know which one!`,
    };
  }

  // "Recommend/want/crave something vegetarian/veg/veggie" (without a budget)
  if (/(?:recommend|suggest)\s+(?:something\s+)?(?:vegetarian|vegan|veg(?:gie)?)|(?:want|craving|in\s+the\s+mood\s+for|looking\s+for)\s+(?:a\s+|an\s+|some\s+|something\s+)?(?:vegetarian|vegan|veg(?:gie)?)\b/.test(lower)) {
    const items = MENU_ITEMS.filter(isVegetarian).filter((i) => i.popular || i.category === 'burgers');
    const top = items[0] ?? MENU_ITEMS.filter(isVegetarian)[0];
    if (top) {
      return {
        actions: [],
        assistantMessage: `I'd recommend the ${top.imageEmoji} ${top.name} (${fmt(top.price)}) — ${top.description} Want me to add it?`,
      };
    }
  }

  // "Recommend a popular item", "what should I order", "recommend something spicy"
  if (
    /recommend|what should (i|we) (order|get|try)|what('s| is) (good|great|your (best|top))|surprise me/.test(
      lower
    )
  ) {
    const wantsSpicy = /\bspicy\b|\bhot\b/.test(lower);
    const wantsVeg = /\bvegetarian\b|\bvegan\b|\bveg\b|\bveggie\b/.test(lower);

    let pool: MenuItem[];
    if (wantsSpicy) {
      pool = MENU_ITEMS.filter(isSpicy);
    } else if (wantsVeg) {
      pool = MENU_ITEMS.filter(isVegetarian).filter((i) => i.popular || i.category === 'burgers');
      if (pool.length === 0) pool = MENU_ITEMS.filter(isVegetarian);
    } else {
      pool = MENU_ITEMS.filter((i) => i.popular);
    }

    const pick = pool[Math.floor(Math.random() * pool.length)] ?? pool[0];
    const qualifier = wantsSpicy ? 'spicy ' : wantsVeg ? 'vegetarian ' : '';
    return {
      actions: [],
      assistantMessage: `Our top ${qualifier}pick is the ${pick.imageEmoji} ${pick.name} (${fmt(pick.price)}) — ${pick.description} Want me to add it?`,
    };
  }

  return null;
}

// ─── Conversational pronoun resolution ───────────────────────────────────────

function extractLastSuggestedItem(history: ConversationTurn[]): MenuItem | null {
  const lastAssistant = [...history].reverse().find((t) => t.role === 'assistant');
  if (!lastAssistant) return null;
  const text = lastAssistant.text.toLowerCase();
  const matches = MENU_ITEMS.filter((item) => text.includes(item.name.toLowerCase()));
  return matches.length === 1 ? matches[0] : null;
}

// Rewrites pronoun-heavy messages like "10 of those" → "Add 10 Buffalo Chicken Wrap"
// when the previous assistant turn mentioned exactly one item.
function resolvePronouns(msg: string, history: ConversationTurn[]): string {
  const lower = msg.toLowerCase().trim();
  if (!/\b(those|them|it|that)\b/i.test(lower)) return msg;

  const item = extractLastSuggestedItem(history);
  if (!item) return msg;

  // "10 of those" / "five of them" / "2 of it" (optionally preceded by add verb)
  const countMatch = lower.match(/\b(\w+)\s+of\s+(?:those|them|it|that)\b/i);
  if (countMatch) {
    const qty = parseQuantityFromTokens([countMatch[1]]);
    return `Add ${qty} ${item.name}`;
  }

  // Generic pronoun swap for phrases like "give me that", "add those"
  return msg.replace(/\b(those|them|it|that)\b/gi, item.name);
}

// ─── Affirmative follow-up ────────────────────────────────────────────────────

// Handles short affirmations after a single-item recommendation.
// "Sure" / "I'll take 2" / "Yes please" → ADD_ITEM for the last suggested item.
// Uses an end-anchor so "I'll take 2 burgers" (explicit item) falls through to normal parse.
function handleAffirmativeFollowUp(lower: string, history: ConversationTurn[]): ParseOrderResponse | null {
  if (history.length === 0) return null;

  const isAffirmative =
    /^(?:(?:i'?ll|i\s+will)\s+(?:take|get|have)(?:\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten))?|yes(?:\s+please)?|yes\s+add\s+it|sure(?:\s+please|[,.]?\s+add\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten))?|ok(?:ay)?|that\s+sounds?\s+(?:great|good|perfect)|sounds?\s+(?:great|good|perfect)|add\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|another(?:\s+one)?)|let\s+me\s+(?:get|have|take)\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)|(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+please)\s*[.!?]*$/i.test(
      lower.trim()
    );

  if (!isAffirmative) return null;

  const item = extractLastSuggestedItem(history);
  if (!item) return null;

  const qtyMatch = lower.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b/i);
  const qty = qtyMatch ? parseQuantityFromTokens([qtyMatch[1]]) : 1;

  const actions: ParseOrderResponse['actions'] = [{ type: 'ADD_ITEM', itemId: item.id, quantity: qty, modifiers: [] }];
  return {
    actions,
    assistantMessage: withCartChangeSummary(
      qty === 1
        ? `Added ${item.name} to your cart! 🛒`
        : `Added ${qty}× ${item.name} to your cart! 🛒`,
      [],
      actions
    ),
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function fallbackParse(
  message: string,
  cartItems: CartItem[] = [],
  history: ConversationTurn[] = []
): ParseOrderResponse {
  const resolved = history.length > 0 ? resolvePronouns(message.trim(), history) : message.trim();
  const msg = resolved;
  const lower = msg.toLowerCase();

  // 0. Universal negative-quantity guard — fires before any action logic
  if (/\bnegative\s+\d+\b|\s-\d+\b/i.test(lower)) {
    return {
      actions: [],
      assistantMessage: "I can't process negative quantities — please tell me how many you'd like!",
    };
  }

  // 1. Clear cart (before generic remove so "clear everything" doesn't partially match)
  if (
    /\b(clear|empty)\b.*\bcart\b|\bstart\s*over\b|\bremove everything\b|\bdelete (all|everything)\b/.test(
      lower
    )
  ) {
    return {
      actions: [{ type: 'CLEAR_CART' }],
      assistantMessage: 'Done! Your cart has been cleared. Ready to start fresh? 🛒',
    };
  }

  // 2. Cart inspection
  const cartQuery = handleCartQuery(lower, cartItems);
  if (cartQuery) return cartQuery;

  // 2.25. Checkout-ready confirmations
  const checkoutIntent = handleCheckoutIntent(lower, cartItems);
  if (checkoutIntent) return checkoutIntent;

  // 2.5. Affirmative follow-up ("Sure", "I'll take 2", "Yes please" after a single-item recommendation)
  const followUp = handleAffirmativeFollowUp(lower, history);
  if (followUp) return followUp;

  // 3. Remove / decrement — hard guard: NEVER fall through to ADD_ITEM if remove intent present
  if (hasRemoveIntent(lower)) {
    const result = parseRemove(lower, cartItems, history);
    if (result) return result;
    return {
      actions: [],
      assistantMessage:
        "I couldn't find that item in your cart. Could you be more specific?",
    };
  }

  // 4. Context-aware commands ("make it 2", "add one more", "same again")
  const ctx = handleContextCommand(lower, cartItems, history);
  if (ctx) return ctx;

  // 5. Explicit update with item named ("set fries to 2", "change chicken to 3")
  const updateMatch = lower.match(
    /\b(?:change|set|update)\s+(.+?)\s+to\s+(\w+)\b/
  );
  if (updateMatch) {
    const itemText = updateMatch[1];
    if (updateMatch[2].toLowerCase() === 'negative') {
      return { actions: [], assistantMessage: 'Quantities must be 1 or more.' };
    }
    const qty = parseQuantityFromTokens([updateMatch[2]]);
    const item = findItem(itemText);
    if (item) {
      const actions: ParseOrderResponse['actions'] = [{ type: 'UPDATE_QUANTITY', itemId: item.id, quantity: qty }];
      return {
        actions,
        assistantMessage: withCartChangeSummary(`Updated ${item.name} to ${qty}.`, cartItems, actions),
      };
    }
  }

  // 6. Menu questions — skip only when the message is an unambiguous order command
  //    (e.g. "Can I get a burger?" → order, not a question about burgers)
  if (!hasExplicitOrderIntent(lower) && isQuestion(lower)) {
    const q = handleQuestion(lower, cartItems);
    if (q) return q;

    // Question detected but no specific handler matched.
    // Describe the mentioned item if we can identify one; otherwise guide the user.
    // This guard ensures questions NEVER fall through to add-item logic.
    const item = findItem(lower);
    if (item) {
      return {
        intent: 'MENU_QUESTION',
        actions: [],
        assistantMessage: `${item.imageEmoji} ${item.name} (${fmt(item.price)}) — ${item.description}`,
      };
    }
    return {
      intent: 'MENU_QUESTION',
      actions: [],
      assistantMessage:
        "Check the Menu tab to browse everything we offer, or just tell me what you'd like to order!",
    };
  }

  // 7. Budget meal ("build me a meal under $20", "what can I get under $15")
  const budgetMatch = lower.match(/under\s+\$?(\d+)|budget.*?\$?(\d+)|\$?(\d+).*?budget/);
  if (budgetMatch && /meal|suggest|recommend|eat|order|build|combo|what can i get|what.*have|spend/.test(lower)) {
    const budget = parseInt(budgetMatch[1] ?? budgetMatch[2] ?? budgetMatch[3], 10);
    return buildBudgetMeal(lower, budget);
  }

  // 8. Non-budget recommendations ("I want something spicy", "what's good")
  const rec = handleRecommendation(lower);
  if (rec) return rec;

  // 8b. Negative-quantity guard — "make water negative 3", "set fries to -2"
  if (/\b(?:make|set|change|update)\b.+\bnegative\b/i.test(lower) || /\b(?:make|set|change|update)\b.+\s-\d+/.test(lower)) {
    return { actions: [], assistantMessage: 'Quantities must be 1 or more.' };
  }

  // 9. Add item(s)
  const addMatch = lower.match(
    /^(?:add|get|i(?:'d| would) like|can i (?:get|have)|give me|order|i want|throw in|can you add|let me get)\s+(.+)/
  );
  const searchText = addMatch ? addMatch[1] : lower;
  const segments = splitSegments(searchText);

  const addActions: Array<{
    type: 'ADD_ITEM';
    itemId: string;
    quantity: number;
    modifiers: string[];
  }> = [];
  const addedNames: string[] = [];

  for (const seg of segments) {
    const { qty, text } = parseSegment(seg);
    const item = findItem(text);
    if (item) {
      addActions.push({ type: 'ADD_ITEM', itemId: item.id, quantity: qty, modifiers: [] });
      addedNames.push(qty > 1 ? `${qty}× ${item.name}` : item.name);
    }
  }

  if (addActions.length > 0) {
    const summary =
      addedNames.length === 1
        ? addedNames[0]
        : `${addedNames.slice(0, -1).join(', ')} and ${addedNames[addedNames.length - 1]}`;
    return {
      actions: addActions,
      assistantMessage: withCartChangeSummary(`Added ${summary} to your cart! 🛒`, cartItems, addActions),
    };
  }

  // 10. Unknown intent
  return {
    actions: [],
    assistantMessage:
      'I\'d love to help! Try "Add two Spicy Crispy Chickens and a water", "Build me a spicy meal under $20", or "What\'s popular?".',
  };
}
