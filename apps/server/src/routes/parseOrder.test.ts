import { shouldUseDeterministicParser } from './parseOrder';

type Case = {
  label: string;
  input: string;
  expected: boolean;
};

const cases: Case[] = [
  {
    label: 'explicit add item uses deterministic parser',
    input: 'Add one spicy chicken',
    expected: true,
  },
  {
    label: 'explicit add water uses deterministic parser',
    input: 'Add one sparkling water',
    expected: true,
  },
  {
    label: 'contextual quantity update uses deterministic parser',
    input: 'Make it one instead',
    expected: true,
  },
  {
    label: 'cart query uses deterministic parser',
    input: "What's in my cart?",
    expected: true,
  },
  {
    label: 'checkout-ready phrase uses deterministic parser',
    input: 'Ready to checkout',
    expected: true,
  },
  {
    label: 'done phrase uses deterministic parser',
    input: 'That should be it',
    expected: true,
  },
  {
    label: 'explicit checkout phrase uses deterministic parser',
    input: 'I would like to checkout',
    expected: true,
  },
  {
    label: 'yes after checkout prompt uses deterministic parser',
    input: 'Yes',
    expected: true,
  },
  {
    label: 'no after add-it prompt uses deterministic parser',
    input: 'No',
    expected: true,
  },
  {
    label: 'recommendation can still use AI path',
    input: 'Recommend something spicy',
    expected: false,
  },
  {
    label: 'menu question can still use AI path',
    input: 'What comes on the burger?',
    expected: false,
  },
];

let passed = 0;
let failed = 0;

for (const tc of cases) {
  const history =
    tc.input === 'Yes'
      ? [{ role: 'assistant' as const, text: 'Your current total is $21.71 ($19.96 + $1.75 tax). Ready to place your order?' }]
      : tc.input === 'No'
        ? [{ role: 'assistant' as const, text: 'Our top pick is the 🥖 Cuban Pressed ($13.49) — Want me to add it?' }]
        : [];
  const actual = shouldUseDeterministicParser(tc.input, history);
  if (actual === tc.expected) {
    console.log(`  ✅  ${tc.label}`);
    passed++;
  } else {
    console.log(`  ❌  ${tc.label}`);
    console.log(`       input:    "${tc.input}"`);
    console.log(`       expected: ${tc.expected}`);
    console.log(`       actual:   ${actual}`);
    failed++;
  }
}

console.log(`\n${passed}/${passed + failed} tests passed`);
if (failed > 0) process.exit(1);
