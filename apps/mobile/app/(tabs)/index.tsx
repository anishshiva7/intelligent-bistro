import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MENU_ITEMS, MENU_CATEGORIES } from '../../constants/menu';
import { MenuItemCard } from '../../components/MenuItemCard';
import { MenuCategory } from '@bistro/shared';

export default function MenuScreen() {
  const [selectedCategory, setSelectedCategory] = useState<MenuCategory>('burgers');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = MENU_ITEMS.filter((item) => {
    const matchesCategory = item.category === selectedCategory;
    const matchesSearch =
      searchQuery.length === 0 ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const allSearchResults = searchQuery.length > 0
    ? MENU_ITEMS.filter(
        (item) =>
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : [];

  const displayItems = searchQuery.length > 0 ? allSearchResults : filteredItems;

  return (
    <SafeAreaView className="flex-1 bg-dark">
      {/* Header */}
      <View className="px-4 pt-2 pb-3 bg-dark">
        <View className="flex-row items-center mb-1">
          <Text style={{ fontSize: 28 }}>🍽️</Text>
          <View className="ml-2">
            <Text className="text-white text-2xl font-bold tracking-tight">
              Intelligent Bistro
            </Text>
            <Text className="text-bistro-400 text-xs">Order smart. Eat well.</Text>
          </View>
        </View>

        {/* Search bar */}
        <View className="mt-3 flex-row items-center bg-white/10 rounded-2xl px-3 py-2.5 border border-white/10">
          <Text style={{ fontSize: 16 }}>🔍</Text>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search menu..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            className="flex-1 ml-2 text-white text-sm"
            style={{ fontSize: 14 }}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text className="text-white/60 text-lg">✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category pills — hidden while searching */}
      {searchQuery.length === 0 && (
        <View className="bg-dark pb-2">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          >
            {MENU_CATEGORIES.map((cat) => {
              const active = cat.id === selectedCategory;
              return (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setSelectedCategory(cat.id)}
                  className={`flex-row items-center rounded-full px-4 py-2 border ${
                    active
                      ? 'bg-bistro-500 border-bistro-500'
                      : 'bg-white/5 border-white/10'
                  }`}
                  activeOpacity={0.75}
                >
                  <Text style={{ fontSize: 16 }}>{cat.emoji}</Text>
                  <Text
                    className={`ml-1.5 text-sm font-semibold ${
                      active ? 'text-white' : 'text-gray-300'
                    }`}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Section header */}
      <View className="px-4 py-2 bg-dark">
        <Text className="text-white/50 text-xs font-semibold uppercase tracking-wider">
          {searchQuery.length > 0
            ? `${displayItems.length} result${displayItems.length !== 1 ? 's' : ''}`
            : `${MENU_CATEGORIES.find((c) => c.id === selectedCategory)?.label ?? ''} · ${filteredItems.length} items`}
        </Text>
      </View>

      {/* Menu items */}
      <FlatList
        data={displayItems}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MenuItemCard item={item} />}
        contentContainerStyle={{ paddingVertical: 8, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View className="items-center justify-center py-20">
            <Text style={{ fontSize: 48 }}>🤷</Text>
            <Text className="text-white/60 text-base mt-3">No items found</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
