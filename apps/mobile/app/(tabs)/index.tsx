import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
  TextInput,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MENU_ITEMS, MENU_CATEGORIES } from '@bistro/shared';
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

  const searchResults =
    searchQuery.length > 0
      ? MENU_ITEMS.filter(
          (item) =>
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
        )
      : [];

  const displayItems = searchQuery.length > 0 ? searchResults : filteredItems;
  const isSearching = searchQuery.length > 0;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: '#09090b' }}>
      {/* Header */}
      <View
        className="px-4 pt-2 pb-3"
        style={{ borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }}
      >
        <View className="flex-row items-center mb-3" style={{ gap: 10 }}>
          <Text style={{ fontSize: 26 }}>🍽️</Text>
          <View>
            <Text className="text-white font-bold tracking-tight" style={{ fontSize: 22, lineHeight: 26 }}>
              Intelligent Bistro
            </Text>
            <Text className="text-bistro-400" style={{ fontSize: 11 }}>Order smart. Eat well.</Text>
          </View>
        </View>

        {/* Search bar */}
        <View
          className="flex-row items-center rounded-2xl px-3 py-2.5"
          style={{
            backgroundColor: 'rgba(255,255,255,0.07)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.1)',
            gap: 8,
          }}
        >
          <Text style={{ fontSize: 15 }}>🔍</Text>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search menu..."
            placeholderTextColor="rgba(255,255,255,0.35)"
            className="flex-1 text-white"
            style={{ fontSize: 14 }}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 16 }}>✕</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Category pills */}
      {!isSearching && (
        <View style={{ borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}
          >
            {MENU_CATEGORIES.map((cat) => {
              const active = cat.id === selectedCategory;
              return (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setSelectedCategory(cat.id)}
                  className="flex-row items-center rounded-full px-4 py-2"
                  style={{
                    backgroundColor: active ? '#06b6d4' : 'rgba(255,255,255,0.07)',
                    borderWidth: 1,
                    borderColor: active ? '#06b6d4' : 'rgba(255,255,255,0.1)',
                    gap: 6,
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={{ fontSize: 15 }}>{cat.emoji}</Text>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: active ? '#fff' : 'rgba(255,255,255,0.65)',
                    }}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Section label */}
      <View className="px-4 py-2.5">
        <Text
          style={{
            color: 'rgba(255,255,255,0.35)',
            fontSize: 11,
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: 0.8,
          }}
        >
          {isSearching
            ? `${displayItems.length} result${displayItems.length !== 1 ? 's' : ''} for "${searchQuery}"`
            : `${MENU_CATEGORIES.find((c) => c.id === selectedCategory)?.label ?? ''} · ${filteredItems.length} items`}
        </Text>
      </View>

      {/* Grid */}
      <FlatList
        data={displayItems}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MenuItemCard item={item} />}
        contentContainerStyle={{ paddingTop: 4, paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View className="items-center justify-center py-20">
            <Text style={{ fontSize: 44 }}>🤷</Text>
            <Text className="text-white/50 text-base mt-3">No items found</Text>
            {isSearching && (
              <TouchableOpacity onPress={() => setSearchQuery('')} className="mt-3">
                <Text className="text-bistro-400 text-sm">Clear search</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </SafeAreaView>
  );
}
