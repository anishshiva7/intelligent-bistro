import { MENU_ITEMS } from '@bistro/shared';
import { ParseOrderResponse } from './schemas';

const NUMBER_WORDS: Record<string, number> = {
  one: 1, a: 1, an: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

function parseQuantity(token: string): number {
  const n = NUMBER_WORDS[token.toLowerCase()];
  if (n) return n;
  const parsed = parseInt(token, 10);
  return isNaN(parsed) ? 1 : parsed;
}

// Score how well a message matches a menu item (higher = better match)
function matchScore(message: string, item: typeof MENU_ITEMS[0]): number {
  const msg = message.toLowerCase();
  let score = 0;
  const nameParts = item.name.toLowerCase().split(/\s+/);
  for (const part of nameParts) {
    if (part.length > 3 && msg.includes(part)) score += 2;
  }
  for (const tag of item.tags) {
    if (msg.includes(tag.toLowerCase())) score += 1;
  }
  if (msg.includes(item.id.replace(/_/g, ' '))) score += 3;
  return score;
}

function findBestMatch(message: string) {
  let best = { item: MENU_ITEMS[0], score: 0 };
  for (const item of MENU_ITEMS) {
    const score = matchScore(message, item);
    if (score > best.score) best = { item, score };
  }
  return best.score >= 2 ? best.item : null;
}

// Extract quantity from message tokens near a keyword
function extractQuantity(message: string): number {
  const tokens = message.toLowerCase().split(/\s+/);
  for (let i = 0; i < tokens.length; i++) {
    const n = NUMBER_WORDS[tokens[i]] ?? parseInt(tokens[i], 10);
    if (!isNaN(n) && n > 0 && n <= 20) return n;
  }
  return 1;
}

export function fallbackParse(message: string): ParseOrderResponse {
  const msg = message.toLowerCase().trim();

  // Clear cart
  if (/clear|empty|start over|remove everything|delete (all|everything)/.test(msg)) {
    return {
      actions: [{ type: 'CLEAR_CART' }],
      assistantMessage: "Done! Your cart has been cleared.",
    };
  }

  // Remove item
  const removeMatch = msg.match(/^(remove|delete|take off|cancel)\s+(.+)/);
  if (removeMatch) {
    const item = findBestMatch(removeMatch[2]);
    if (item) {
      return {
        actions: [{ type: 'REMOVE_ITEM', itemId: item.id }],
        assistantMessage: `Removed ${item.name} from your cart.`,
      };
    }
  }

  // Update quantity ("make that X", "change to X", "update X to Y")
  const makeMatch = msg.match(/make that\s+(\w+)|change.*?to\s+(\w+)|update.*?to\s+(\w+)/);
  if (makeMatch) {
    const qtyToken = makeMatch[1] ?? makeMatch[2] ?? makeMatch[3];
    const qty = parseQuantity(qtyToken);
    const item = findBestMatch(msg);
    if (item) {
      return {
        actions: [{ type: 'UPDATE_QUANTITY', itemId: item.id, quantity: qty }],
        assistantMessage: `Updated ${item.name} quantity to ${qty}.`,
      };
    }
  }

  // Budget meal suggestion
  const budgetMatch = msg.match(/under\s+\$?(\d+)|budget.*\$?(\d+)|\$?(\d+).*budget/);
  if (budgetMatch && /meal|suggest|recommend|eat|order/.test(msg)) {
    const budget = parseInt(budgetMatch[1] ?? budgetMatch[2] ?? budgetMatch[3], 10);
    let total = 0;
    const picked: typeof MENU_ITEMS = [];
    // Pick a burger or sandwich, then a side, then a drink
    const priorities = ['burgers', 'sandwiches', 'sides', 'drinks'];
    for (const cat of priorities) {
      const candidates = MENU_ITEMS.filter((i) => i.category === cat).sort(
        (a, b) => (b.popular ? 1 : 0) - (a.popular ? 1 : 0)
      );
      for (const c of candidates) {
        if (total + c.price <= budget) {
          picked.push(c);
          total += c.price;
          break;
        }
      }
    }
    if (picked.length > 0) {
      return {
        actions: picked.map((i) => ({ type: 'ADD_ITEM' as const, itemId: i.id, quantity: 1, modifiers: [] })),
        assistantMessage: `Here's a great meal under $${budget}: ${picked.map((i) => i.name).join(', ')}. Total: $${total.toFixed(2)}.`,
      };
    }
  }

  // Add item (default intent)
  const addMatch = msg.match(/^(add|get|i('d| would) like|can i (get|have)|give me|order|i want)\s+(.+)/);
  const searchText = addMatch ? addMatch[addMatch.length - 1] : msg;
  const item = findBestMatch(searchText);

  if (item) {
    const qty = extractQuantity(searchText);
    return {
      actions: [{ type: 'ADD_ITEM', itemId: item.id, quantity: qty, modifiers: [] }],
      assistantMessage: `Added ${qty > 1 ? `${qty}x ` : ''}${item.name} to your cart!`,
    };
  }

  // Question / unknown intent
  return {
    actions: [],
    assistantMessage:
      "I'm not sure what you'd like to order. Try saying something like \"Add two spicy chicken sandwiches\" or \"Build me a meal under $20\".",
  };
}
