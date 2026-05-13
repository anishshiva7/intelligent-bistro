export type MenuCategory =
  | 'burgers'
  | 'sandwiches'
  | 'sides'
  | 'drinks'
  | 'desserts';

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: MenuCategory;
  tags: string[];
  popular?: boolean;
  imageEmoji: string;
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  modifiers: string[];
}

export type OrderActionType =
  | 'ADD_ITEM'
  | 'REMOVE_ITEM'
  | 'UPDATE_QUANTITY'
  | 'CLEAR_CART';

export interface AddItemAction {
  type: 'ADD_ITEM';
  itemId: string;
  quantity: number;
  modifiers: string[];
}

export interface RemoveItemAction {
  type: 'REMOVE_ITEM';
  itemId: string;
}

export interface UpdateQuantityAction {
  type: 'UPDATE_QUANTITY';
  itemId: string;
  quantity: number;
}

export interface ClearCartAction {
  type: 'CLEAR_CART';
}

export type OrderAction =
  | AddItemAction
  | RemoveItemAction
  | UpdateQuantityAction
  | ClearCartAction;

export interface ParseOrderResponse {
  actions: OrderAction[];
  assistantMessage: string;
}

export interface ParseOrderRequest {
  message: string;
  cartItems: CartItem[];
}
