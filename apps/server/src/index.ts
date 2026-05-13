import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { MENU_ITEMS, MENU_CATEGORIES } from '@bistro/shared';
import parseOrderRouter from './routes/parseOrder';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/menu', (_req, res) => {
  res.json({ items: MENU_ITEMS, categories: MENU_CATEGORIES });
});

app.use('/parse-order', parseOrderRouter);

app.listen(PORT, () => {
  const hasKey = !!process.env.ANTHROPIC_API_KEY;
  console.log(`🍔 Bistro server running on http://localhost:${PORT}`);
  console.log(`🤖 AI: ${hasKey ? 'Claude (Haiku)' : 'Fallback parser (set ANTHROPIC_API_KEY to enable Claude)'}`);
});
