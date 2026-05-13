import express from 'express';
import cors from 'cors';
import { MENU_ITEMS, MENU_CATEGORIES } from '@bistro/shared';

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

app.get('/menu/:category', (req, res) => {
  const { category } = req.params;
  const items = MENU_ITEMS.filter((item) => item.category === category);
  if (items.length === 0) {
    res.status(404).json({ error: 'Category not found' });
    return;
  }
  res.json({ items });
});

app.listen(PORT, () => {
  console.log(`🍔 Bistro server running on http://localhost:${PORT}`);
});
