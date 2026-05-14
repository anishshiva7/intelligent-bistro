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
  [/spicy\s*(crispy\s*)?chicken/i,              'spicy_crispy_chicken'],
  [/buffalo\s*(chicken\s*)?(wrap)?/i,            'buffalo_chicken_wrap'],
  [/sparkling\s*water|large\s*water|\bwater\b/i, 'sparkling_water'],
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
  [/\bchicken\b/i,                               'spicy_crispy_chicken'],
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

function isSpicy(item: MenuItem): boolean {
  return (
    item.tags.includes('spicy') ||
    /spicy|ghost pepper|buffalo|chipotle/i.test(item.description)
  );
}

function isVegetarian(item: MenuItem): boolean {
  return item.tags.includes('vegetarian') || item.tags.includes('vegan-option');
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
    assistantMessage: `You have: ${list}. Total: ${fmt(total)} with tax.`,
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

function parseRemove(lower: string, cartItems: CartItem[]): ParseOrderResponse | null {
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

  // Prefer matching against cart items (more reliable than full menu)
  const cartMatch = findCartItem(afterVerb || lower, cartItems);
  const item = cartMatch?.menuItem ?? findItem(afterVerb || lower);

  if (!item) return null;

  // Item identified but not present in the cart — nothing to remove.
  // Return null so the caller responds with "not in your cart".
  if (!cartMatch) return null;

  if (removeAll) {
    return {
      actions: [{ type: 'REMOVE_ITEM', itemId: item.id }],
      assistantMessage: `Done — removed all ${item.name} from your cart.`,
    };
  }

  const tokens = afterVerb.split(/\s+/);
  const explicitQty = hasExplicitQty(tokens);

  if (explicitQty) {
    const qty = parseQuantityFromTokens(tokens);
    const currentQty = cartMatch?.quantity ?? 0;

    if (currentQty > 0 && qty >= currentQty) {
      return {
        actions: [{ type: 'REMOVE_ITEM', itemId: item.id }],
        assistantMessage: `Done — removed all ${item.name} from your cart.`,
      };
    }

    const remaining = currentQty > 0 ? currentQty - qty : 0;
    return {
      actions: [{ type: 'DECREMENT_ITEM', itemId: item.id, quantity: qty }],
      assistantMessage:
        remaining > 0
          ? `Removed ${qty}× ${item.name} — you now have ${remaining} left in your cart.`
          : `Removed ${item.name} from your cart.`,
    };
  }

  // No qty — full removal
  return {
    actions: [{ type: 'REMOVE_ITEM', itemId: item.id }],
    assistantMessage: `Done — removed ${item.name} from your cart.`,
  };
}

// ─── Context-aware commands ───────────────────────────────────────────────────

function handleContextCommand(lower: string, cartItems: CartItem[]): ParseOrderResponse | null {
  // "add one more", "another one", "same thing again", "add another"
  if (
    /\b(one\s+more|another\s+(?:one|of\s+(?:the\s+)?same)|same\s+(thing\s+)?again|add\s+(?:one\s+)?more|add\s+another(?!\s+\w))\b/i.test(
      lower
    )
  ) {
    if (cartItems.length === 0) {
      return {
        actions: [],
        assistantMessage: "Your cart is empty — what would you like to add first?",
      };
    }
    const last = cartItems[cartItems.length - 1];
    return {
      actions: [{ type: 'ADD_ITEM', itemId: last.menuItem.id, quantity: 1, modifiers: [] }],
      assistantMessage: `Added another ${last.menuItem.name} to your cart! 🛒`,
    };
  }

  // "only one [item]", "just one [item]" → UPDATE_QUANTITY 1
  const onlyMatch = lower.match(/\b(only|just)\s+(one|1|a)\s+(.+)/);
  if (onlyMatch) {
    const itemText = onlyMatch[3];
    const item = findItem(itemText);
    if (item) {
      return {
        actions: [{ type: 'UPDATE_QUANTITY', itemId: item.id, quantity: 1 }],
        assistantMessage: `Updated ${item.name} to 1.`,
      };
    }
  }

  // "make it/that X", "change it to X", "make that three instead", "actually make it 2"
  // "make the chicken 3", "actually make the waters 4"
  const makeMatch = lower.match(
    /\b(?:actually\s+)?(?:make\s+(?:it|that|the\s+\w+|my)|change\s+(?:it|that|the\s+\w+)\s+to|set\s+(?:it|that|the\s+\w+)\s+to)\s+(\w+)/
  );
  if (makeMatch) {
    const qty = parseQuantityFromTokens([makeMatch[1]]);

    // Check if a named item is in the message (strip the update phrase first)
    const stripped = lower
      .replace(/\b(?:actually|make|change|set|it|that|to|the|my|instead|please)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    const mentionedItem = stripped.length > 1 ? findItem(stripped) : null;

    if (mentionedItem) {
      return {
        actions: [{ type: 'UPDATE_QUANTITY', itemId: mentionedItem.id, quantity: qty }],
        assistantMessage: `Updated ${mentionedItem.name} to ${qty}.`,
      };
    }

    // No item named → use cart context
    if (cartItems.length === 1) {
      const ci = cartItems[0];
      return {
        actions: [{ type: 'UPDATE_QUANTITY', itemId: ci.menuItem.id, quantity: qty }],
        assistantMessage: `Updated ${ci.menuItem.name} to ${qty}.`,
      };
    }
    if (cartItems.length > 1) {
      const names = cartItems.map((ci) => ci.menuItem.name).join(', ');
      return {
        actions: [],
        assistantMessage: `Which item would you like to set to ${qty}? You have: ${names}.`,
      };
    }
    // Empty cart
    return {
      actions: [],
      assistantMessage: `Your cart is empty — nothing to update. What would you like to order?`,
    };
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
  if (/\b(is|how)\b.*(spicy|hot)\b|\b(spicy|hot)\b.*\b(is|are)\b|\bhow\s+much\s+(heat|spice)\b/.test(lower)) {
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
  const wantsVeg      = /\bvegetarian\b|\bvegan\b|plant.based|no\s*meat|meatless/.test(lower);
  const wantsPopular  = /\bpopular\b|\bbestseller\b|best\s*seller|most\s*(ordered|liked|loved|popular)|what('s| is) good/.test(lower);
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
    if (wantsPopular)  { pool = pool.filter((i) => i.popular);                 labels.push('popular'); }
    if (maxPrice !== null) { pool = pool.filter((i) => i.price < maxPrice); }

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

    // List results — single result gets a more specific nudge
    if (pool.length === 1) {
      const item = pool[0];
      return {
        intent: 'MENU_QUESTION' as const,
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
  const wantsVeg = /vegetarian|vegan|plant.based|no\s*meat/.test(lower);

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

  // "Recommend something vegetarian" (without a budget)
  if (/recommend\s+(something\s+)?vegetarian|suggest\s+(something\s+)?veg/.test(lower)) {
    const items = MENU_ITEMS.filter(isVegetarian).filter((i) => i.popular || i.category === 'burgers');
    const top = items[0] ?? MENU_ITEMS.filter(isVegetarian)[0];
    if (top) {
      return {
        actions: [],
        assistantMessage: `I'd recommend the ${top.imageEmoji} ${top.name} (${fmt(top.price)}) — ${top.description} Want me to add it?`,
      };
    }
  }

  // "Recommend a popular item", "what should I order", "what's good"
  if (
    /recommend|what should (i|we) (order|get|try)|what('s| is) (good|great|your (best|top))|surprise me/.test(
      lower
    )
  ) {
    const popular = MENU_ITEMS.filter((i) => i.popular);
    const pick = popular[Math.floor(Math.random() * popular.length)] ?? popular[0];
    return {
      actions: [],
      assistantMessage: `A customer favourite is the ${pick.imageEmoji} ${pick.name} (${fmt(pick.price)}) — ${pick.description} Want me to add it?`,
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

// ─── Main export ──────────────────────────────────────────────────────────────

export function fallbackParse(
  message: string,
  cartItems: CartItem[] = [],
  history: ConversationTurn[] = []
): ParseOrderResponse {
  const resolved = history.length > 0 ? resolvePronouns(message.trim(), history) : message.trim();
  const msg = resolved;
  const lower = msg.toLowerCase();

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

  // 3. Remove / decrement — hard guard: NEVER fall through to ADD_ITEM if remove intent present
  if (hasRemoveIntent(lower)) {
    const result = parseRemove(lower, cartItems);
    if (result) return result;
    return {
      actions: [],
      assistantMessage:
        "I couldn't find that item in your cart. Could you be more specific?",
    };
  }

  // 4. Context-aware commands ("make it 2", "add one more", "same again")
  const ctx = handleContextCommand(lower, cartItems);
  if (ctx) return ctx;

  // 5. Explicit update with item named ("set fries to 2", "change chicken to 3")
  const updateMatch = lower.match(
    /\b(?:change|set|update)\s+(.+?)\s+to\s+(\w+)\b/
  );
  if (updateMatch) {
    const itemText = updateMatch[1];
    const qty = parseQuantityFromTokens([updateMatch[2]]);
    const item = findItem(itemText);
    if (item) {
      return {
        actions: [{ type: 'UPDATE_QUANTITY', itemId: item.id, quantity: qty }],
        assistantMessage: `Updated ${item.name} to ${qty}.`,
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
      assistantMessage: `Added ${summary} to your cart! 🛒`,
    };
  }

  // 10. Unknown intent
  return {
    actions: [],
    assistantMessage:
      'I\'d love to help! Try "Add two Spicy Crispy Chickens and a water", "Build me a spicy meal under $20", or "What\'s popular?".',
  };
}
