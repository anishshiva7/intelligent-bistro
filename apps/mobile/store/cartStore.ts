import { create } from 'zustand';
import { CartItem, MenuItem } from '@bistro/shared';

const TAX_RATE = 0.0875;

interface CartStore {
  items: CartItem[];
  addItem: (menuItem: MenuItem, quantity?: number, modifiers?: string[]) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  decrementItem: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  subtotal: () => number;
  tax: () => number;
  total: () => number;
  itemCount: () => number;
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],

  addItem: (menuItem, quantity = 1, modifiers = []) => {
    set((state) => {
      const existing = state.items.find((i) => i.menuItem.id === menuItem.id);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.menuItem.id === menuItem.id
              ? { ...i, quantity: i.quantity + quantity }
              : i
          ),
        };
      }
      return { items: [...state.items, { menuItem, quantity, modifiers }] };
    });
  },

  removeItem: (itemId) => {
    set((state) => ({
      items: state.items.filter((i) => i.menuItem.id !== itemId),
    }));
  },

  decrementItem: (itemId, quantity) => {
    const current = get().items.find((i) => i.menuItem.id === itemId);
    if (!current) return;
    get().updateQuantity(itemId, current.quantity - quantity);
  },

  updateQuantity: (itemId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(itemId);
      return;
    }
    set((state) => ({
      items: state.items.map((i) =>
        i.menuItem.id === itemId ? { ...i, quantity } : i
      ),
    }));
  },

  clearCart: () => set({ items: [] }),

  subtotal: () => {
    const { items } = get();
    return items.reduce((sum, i) => sum + i.menuItem.price * i.quantity, 0);
  },

  tax: () => get().subtotal() * TAX_RATE,

  total: () => get().subtotal() + get().tax(),

  itemCount: () => {
    const { items } = get();
    return items.reduce((sum, i) => sum + i.quantity, 0);
  },
}));
