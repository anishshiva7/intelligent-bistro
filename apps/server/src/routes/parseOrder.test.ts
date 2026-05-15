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
  const actual = shouldUseDeterministicParser(tc.input);
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
