import React from 'react';
import { View, Text, SafeAreaView, FlatList, TouchableOpacity } from 'react-native';
import { useCartStore } from '../../store/cartStore';

export default function CartScreen() {
  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore((s) => s.subtotal());
  const tax = useCartStore((s) => s.tax());
  const total = useCartStore((s) => s.total());
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearCart = useCartStore((s) => s.clearCart);

  const isEmpty = items.length === 0;

  return (
    <SafeAreaView className="flex-1 bg-dark">
      {/* Header */}
      <View className="px-4 pt-2 pb-4 flex-row items-center justify-between">
        <View>
          <Text className="text-white text-2xl font-bold">Your Cart</Text>
          <Text className="text-bistro-400 text-xs">
            {isEmpty ? 'Nothing here yet' : `${items.reduce((s, i) => s + i.quantity, 0)} items`}
          </Text>
        </View>
        {!isEmpty && (
          <TouchableOpacity
            onPress={clearCart}
            className="bg-white/10 rounded-full px-3 py-1.5"
            activeOpacity={0.7}
          >
            <Text className="text-white/70 text-xs font-medium">Clear all</Text>
          </TouchableOpacity>
        )}
      </View>

      {isEmpty ? (
        <View className="flex-1 items-center justify-center pb-20">
          <Text style={{ fontSize: 72 }}>🛒</Text>
          <Text className="text-white text-xl font-bold mt-4">Cart is empty</Text>
          <Text className="text-white/50 text-sm mt-2 text-center px-8">
            Browse the menu or chat with our AI to add items
          </Text>
        </View>
      ) : (
        <>
          <FlatList
            data={items}
            keyExtractor={(item) => item.menuItem.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <View className="bg-white rounded-2xl mb-3 p-3 flex-row items-center shadow-sm">
                <View className="w-14 h-14 bg-bistro-50 rounded-xl items-center justify-center mr-3">
                  <Text style={{ fontSize: 32 }}>{item.menuItem.imageEmoji}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-dark font-bold text-sm" numberOfLines={1}>
                    {item.menuItem.name}
                  </Text>
                  <Text className="text-bistro-600 font-semibold text-sm">
                    ${(item.menuItem.price * item.quantity).toFixed(2)}
                  </Text>
                </View>
                {/* Quantity controls */}
                <View className="flex-row items-center bg-bistro-50 rounded-xl border border-bistro-200">
                  <TouchableOpacity
                    onPress={() =>
                      item.quantity === 1
                        ? removeItem(item.menuItem.id)
                        : updateQuantity(item.menuItem.id, item.quantity - 1)
                    }
                    className="w-9 h-9 items-center justify-center"
                  >
                    <Text className="text-bistro-600 text-lg font-bold">−</Text>
                  </TouchableOpacity>
                  <Text className="text-dark font-bold text-sm w-6 text-center">
                    {item.quantity}
                  </Text>
                  <TouchableOpacity
                    onPress={() => updateQuantity(item.menuItem.id, item.quantity + 1)}
                    className="w-9 h-9 items-center justify-center"
                  >
                    <Text className="text-bistro-600 text-lg font-bold">+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />

          {/* Order summary */}
          <View className="mx-4 mb-4 bg-white rounded-2xl p-4 shadow-sm">
            <Text className="text-dark font-bold text-base mb-3">Order Summary</Text>
            <View className="flex-row justify-between mb-1.5">
              <Text className="text-gray-500 text-sm">Subtotal</Text>
              <Text className="text-dark font-semibold text-sm">${subtotal.toFixed(2)}</Text>
            </View>
            <View className="flex-row justify-between mb-3">
              <Text className="text-gray-500 text-sm">Tax (8.75%)</Text>
              <Text className="text-dark font-semibold text-sm">${tax.toFixed(2)}</Text>
            </View>
            <View className="h-px bg-gray-100 mb-3" />
            <View className="flex-row justify-between">
              <Text className="text-dark font-bold text-base">Total</Text>
              <Text className="text-bistro-600 font-bold text-base">${total.toFixed(2)}</Text>
            </View>
          </View>

          {/* Place Order button */}
          <View className="px-4 pb-4">
            <TouchableOpacity
              className="bg-bistro-500 rounded-2xl py-4 items-center"
              activeOpacity={0.85}
            >
              <Text className="text-white font-bold text-base">Place Order · ${total.toFixed(2)}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}
