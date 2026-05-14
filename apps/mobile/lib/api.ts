import { CartItem, ParseOrderResponse, ConversationTurn } from '@bistro/shared';

// In dev, Expo web runs at 8081 and the server at 3001 on the same machine.
// On a physical device, replace with your machine's LAN IP.
const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL ?? 'http://localhost:3001';

export async function parseOrder(
  message: string,
  cartItems: CartItem[],
  conversationHistory?: ConversationTurn[]
): Promise<ParseOrderResponse> {
  const res = await fetch(`${SERVER_URL}/parse-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, cartItems, conversationHistory }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Server error ${res.status}: ${text}`);
  }

  return res.json() as Promise<ParseOrderResponse>;
}
