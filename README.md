# Intelligent Bistro

A full-stack AI-powered restaurant ordering app built with React Native, Expo, and Claude. Customers browse the menu, manage a cart, and place orders through natural conversation — no tapping through menus required.

---

## Demo

> 📹 *Loom walkthrough:* `[link]`

<!-- Screenshots: drop images here -->
| Menu | Cart | AI Ordering |
|------|------|-------------|
| ![menu]() | ![cart]() | ![chat]() |

---

## Overview

Intelligent Bistro is a mobile-first ordering app where the primary interface is a conversational AI assistant. The assistant understands multi-turn context, handles complex ordering patterns ("add 2 of those", "make it 3 instead", "remove the fries and the water"), and answers menu questions — all without leaving the chat.

The backend parses every user message into structured JSON actions (`ADD_ITEM`, `REMOVE_ITEM`, `UPDATE_QUANTITY`, etc.) that are applied atomically to client-side cart state. When the Anthropic API is unavailable, a deterministic fallback parser handles the full feature set locally.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile | React Native, Expo SDK 54, Expo Router |
| Styling | NativeWind (Tailwind CSS for RN) |
| State | Zustand |
| Backend | Node.js, Express, TypeScript |
| AI | Anthropic Claude Haiku (`claude-haiku-4-5-20251001`) |
| Validation | Zod |
| Monorepo | npm workspaces |
| Shared types | `@bistro/shared` internal package |

---

## Key Features

- **Conversational ordering** — full cart management through natural language
- **Menu browsing** — searchable, category-filtered menu with live search across name, description, and tags
- **Cart management** — real-time subtotal and tax calculation, animated badge counts
- **AI recommendations** — spicy, vegetarian, and budget-based meal suggestions
- **Graceful degradation** — deterministic fallback parser activates automatically if the API key is absent or an API call fails
- **Shared data layer** — single source of truth for menu data across mobile and server via `@bistro/shared`

---

## Conversational AI Capabilities

The assistant handles a wide range of natural language patterns:

| Input | Behavior |
|---|---|
| "Add two spicy chickens and a water" | Two `ADD_ITEM` actions in one turn |
| "Remove 2 waters and 2 fries" | Multi-item `DECREMENT_ITEM` + `REMOVE_ITEM` |
| "Make it 3" *(one item in cart)* | `UPDATE_QUANTITY` with cart context |
| "Add 2 of those" *(after a recommendation)* | Pronoun resolution → `ADD_ITEM` |
| "Add 2" / "2 please" / "Let me get 2" | Quantity-only follow-up after a single recommendation |
| "What's the cheapest spicy item?" | Menu Q&A — no cart action |
| "Most popular veg item?" | Filters to vegetarian, returns top main course |
| "Build me a spicy meal under $20" | Budget meal: qualifying main + side + drink |
| "Sure" / "I'll take one" | Affirmative follow-up — adds last recommended item |

### Architecture

```
User message
      │
      ▼
POST /parse-order (Express)
      │
      ├── ANTHROPIC_API_KEY set?
      │         │ Yes
      │         ▼
      │    Claude Haiku
      │    (system prompt with live cart + conversation history)
      │         │
      │         ├─ Zod validation passes → return response
      │         └─ validation fails / network error → fallback parser
      │
      └── No API key → fallback parser
                │
                ▼
         Deterministic NLP pipeline
         (regex + fuzzy item matching, 110 regression tests)
```

The **fallback parser** (`apps/server/src/fallback.ts`) is a 10-step deterministic pipeline: cart inspection → affirmative follow-up → remove guards → context commands → quantity updates → menu Q&A → budget meals → recommendations → multi-item add. It shares the same Zod-validated response schema as the Claude path, so the client never knows which route ran.

The **system prompt** (`apps/server/src/prompt.ts`) is built per-request with the current cart state injected inline. Conversation history is forwarded as an alternating `user`/`assistant` message array matching the Anthropic Messages API format.

---

## Project Structure

```
intelligent-bistro/
├── apps/
│   ├── mobile/                    # React Native / Expo app
│   │   ├── app/
│   │   │   └── (tabs)/
│   │   │       ├── index.tsx      # Menu tab
│   │   │       ├── cart.tsx       # Cart tab
│   │   │       └── chat.tsx       # AI ordering tab
│   │   ├── components/
│   │   │   └── MenuItemCard.tsx
│   │   ├── store/
│   │   │   └── cartStore.ts       # Zustand cart store
│   │   └── lib/
│   │       └── api.ts             # Server client
│   │
│   └── server/                    # Express API
│       └── src/
│           ├── index.ts           # Entry point — port 3001
│           ├── routes/
│           │   └── parseOrder.ts  # POST /parse-order
│           ├── prompt.ts          # Claude system prompt builder
│           ├── fallback.ts        # Deterministic NLP parser
│           ├── schemas.ts         # Zod response schemas
│           └── fallback.test.ts   # 110 parser regression tests
│
└── packages/
    └── shared/                    # @bistro/shared
        └── src/
            ├── types.ts           # MenuItem, CartItem, OrderAction, …
            ├── menu.ts            # Canonical menu (19 items, single source of truth)
            └── index.ts
```

---

## Running Locally

### Prerequisites

- Node.js 18+
- Expo Go on your device, or an iOS/Android simulator
- An Anthropic API key *(optional — the fallback parser covers all features without one)*

### 1. Install dependencies

```bash
npm install
```

Installs all workspace dependencies from the root.

### 2. Configure environment variables

```bash
# apps/server/.env
ANTHROPIC_API_KEY=sk-ant-...
```

The server starts and runs fully without a key — all requests are handled by the fallback parser. Add the key to enable Claude.

### 3. Start the server

```bash
npm run server
```

Starts the Express API at `http://localhost:3001`. Console output confirms whether Claude or the fallback parser is active:

```
🍔 Bistro server running on http://localhost:3001
🤖 AI: Claude (Haiku)
```

### 4. Start the mobile app

In a separate terminal:

```bash
npm run mobile
```

Opens the Expo dev server. Scan the QR code with Expo Go, or press `i` / `a` for iOS / Android simulator.

> **Physical device:** update the API base URL in `apps/mobile/lib/api.ts` to your machine's local IP address instead of `localhost`.

### 5. Run parser tests

```bash
cd apps/server
../../node_modules/.bin/ts-node src/fallback.test.ts
# 110/110 tests passed
```

---

## Design Decisions

**Structured JSON over free-form responses.** Every AI response is validated against a Zod schema before touching cart state. If Claude returns malformed JSON or the API call fails, the request is transparently retried through the deterministic fallback — no errors surface to the user.

**Fallback-first resilience.** The fallback parser isn't a degraded mode — it covers 100% of supported interactions with the same response contract as Claude. This means the app is fully functional without an API key and recovers silently from network failures.

**Single source of truth for menu data.** All 19 menu items live in `packages/shared/src/menu.ts` and are consumed by both the server (AI context, fallback logic, spicy/vegetarian helpers) and the mobile app (UI rendering, search, category filtering). No duplication, no drift.

**Conversation history as first-class state.** The chat tab maintains a rolling history sent with every request. This enables pronoun resolution ("add 2 of those"), affirmative follow-ups ("Sure"), and quantity references ("I'll take 2") without any special client-side handling.

**Stateless server, reactive client.** The server parses intent and returns a list of actions. Cart state lives entirely in a Zustand store on the client. Cart updates are instantaneous regardless of server latency, and the server stays simple and horizontally scalable.

---

## Future Improvements

- **Persistent cart + order history** — lightweight database for session continuity
- **Voice input** — Expo's speech APIs are a natural fit for an ordering context
- **Item modifiers** — the action schema already has a `modifiers: string[]` field; the parser and UI need to surface it
- **Streaming responses** — Anthropic's streaming API would eliminate the perceived wait before the assistant replies
- **Multi-location support** — the menu data format is already generic enough to support multiple restaurant configs
