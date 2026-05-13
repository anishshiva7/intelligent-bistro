import React from 'react';
import { View, Text, TouchableOpacity, Pressable } from 'react-native';
import { MenuItem } from '@bistro/shared';
import { useCartStore } from '../store/cartStore';

interface Props {
  item: MenuItem;
}

export function MenuItemCard({ item }: Props) {
  const addItem = useCartStore((s) => s.addItem);
  const cartItems = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);

  const cartEntry = cartItems.find((ci) => ci.menuItem.id === item.id);
  const qty = cartEntry?.quantity ?? 0;

  return (
    <View className="bg-white rounded-2xl mb-3 mx-4 overflow-hidden shadow-sm border border-gray-100">
      {/* Emoji image area */}
      <View className="bg-bistro-50 h-32 items-center justify-center relative">
        <Text style={{ fontSize: 64 }}>{item.imageEmoji}</Text>
        {item.popular && (
          <View className="absolute top-2 left-2 bg-bistro-500 rounded-full px-2 py-0.5">
            <Text className="text-white text-xs font-bold">Popular</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View className="p-3">
        <View className="flex-row items-start justify-between mb-1">
          <Text className="text-dark font-bold text-base flex-1 mr-2" numberOfLines={1}>
            {item.name}
          </Text>
          <Text className="text-bistro-600 font-bold text-base">
            ${item.price.toFixed(2)}
          </Text>
        </View>

        <Text className="text-gray-500 text-xs mb-3 leading-4" numberOfLines={2}>
          {item.description}
        </Text>

        {/* Tags */}
        <View className="flex-row flex-wrap gap-1 mb-3">
          {item.tags.slice(0, 3).map((tag) => (
            <View key={tag} className="bg-bistro-50 rounded-full px-2 py-0.5 border border-bistro-100">
              <Text className="text-bistro-700 text-xs">{tag}</Text>
            </View>
          ))}
        </View>

        {/* Add to cart controls */}
        {qty === 0 ? (
          <TouchableOpacity
            onPress={() => addItem(item)}
            className="bg-bistro-500 rounded-xl py-2.5 items-center active:opacity-80"
            activeOpacity={0.8}
          >
            <Text className="text-white font-bold text-sm">Add to Cart</Text>
          </TouchableOpacity>
        ) : (
          <View className="flex-row items-center justify-between bg-bistro-50 rounded-xl border border-bistro-200">
            <TouchableOpacity
              onPress={() => (qty === 1 ? removeItem(item.id) : updateQuantity(item.id, qty - 1))}
              className="w-11 h-11 items-center justify-center"
              activeOpacity={0.7}
            >
              <Text className="text-bistro-600 text-xl font-bold">−</Text>
            </TouchableOpacity>
            <Text className="text-dark font-bold text-base min-w-8 text-center">{qty}</Text>
            <TouchableOpacity
              onPress={() => updateQuantity(item.id, qty + 1)}
              className="w-11 h-11 items-center justify-center"
              activeOpacity={0.7}
            >
              <Text className="text-bistro-600 text-xl font-bold">+</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}
