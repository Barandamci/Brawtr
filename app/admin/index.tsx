import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Platform,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { Feather, Ionicons } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { BrawUser } from "@/types";
import UserAvatar from "@/components/UserAvatar";

export default function AdminPanelScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useAuth();

  const [users, setUsers] = useState<BrawUser[]>([]);
  const [filtered, setFiltered] = useState<BrawUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "banned" | "admin">("all");

  const isAdminOrOwner = profile?.role === "admin" || profile?.role === "owner";

  useEffect(() => {
    if (!isAdminOrOwner) { router.back(); return; }
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => d.data() as BrawUser);
      setUsers(list);
      setLoading(false);
    });
    return () => unsub();
  }, [isAdminOrOwner]);

  useEffect(() => {
    let list = users;
    if (filter === "banned") list = list.filter((u) => u.isBanned);
    if (filter === "admin") list = list.filter((u) => u.role === "admin" || u.role === "owner");
    if (search.trim()) list = list.filter((u) => u.username.includes(search.trim().toLowerCase()));
    setFiltered(list);
  }, [users, filter, search]);

  const topInset = Platform.OS === "web" ? 67 : insets.top;

  const roleColor: Record<string, string> = {
    owner: colors.primary,
    admin: "#1D9BF0",
    user: colors.mutedForeground,
  };

  const roleLabel: Record<string, string> = {
    owner: "Kurucu",
    admin: "Admin",
    user: "Kullanıcı",
  };

  const filterTabs = [
    { key: "all", label: "Tümü" },
    { key: "admin", label: "Adminler" },
    { key: "banned", label: "Banlılar" },
  ] as const;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topInset + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Admin Paneli</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>{users.length} kullanıcı</Text>
        </View>
        <View style={{ width: 30 }} />
      </View>

      <View style={styles.searchWrap}>
        <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="search" size={15} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Kullanıcı ara..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
        </View>
      </View>

      <View style={styles.filterRow}>
        {filterTabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.filterTab,
              {
                backgroundColor: filter === tab.key ? colors.primary : colors.card,
                borderColor: filter === tab.key ? colors.primary : colors.border,
              },
            ]}
            onPress={() => setFilter(tab.key)}
          >
            <Text style={[styles.filterText, { color: filter === tab.key ? "#fff" : colors.mutedForeground }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.uid}
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.userRow, { borderBottomColor: colors.border }]}
              onPress={() => router.push(`/user/${item.uid}`)}
              activeOpacity={0.7}
            >
              <UserAvatar
                photoURL={item.photoURL}
                username={item.username}
                size={46}
                isOnline={item.isOnline}
                hasBlueTick={item.hasBlueTick}
                showOnline
              />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={[styles.username, { color: colors.text }]}>@{item.username}</Text>
                  {item.hasBlueTick && <Ionicons name="checkmark-circle" size={14} color="#1D9BF0" />}
                </View>
                <View style={{ flexDirection: "row", gap: 6, marginTop: 2 }}>
                  <Text style={[styles.rolePill, { color: roleColor[item.role] }]}>
                    {roleLabel[item.role]}
                  </Text>
                  {item.isBanned && (
                    <Text style={[styles.rolePill, { color: colors.destructive }]}>● Banlı</Text>
                  )}
                </View>
              </View>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Feather name="users" size={40} color={colors.muted} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Kullanıcı bulunamadı</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, padding: 32 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontFamily: "Inter_600SemiBold", fontSize: 17 },
  headerSub: { fontFamily: "Inter_400Regular", fontSize: 12 },
  searchWrap: { paddingHorizontal: 16, paddingVertical: 12 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
  },
  searchInput: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 15 },
  filterRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterText: { fontFamily: "Inter_500Medium", fontSize: 13 },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  username: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  rolePill: { fontFamily: "Inter_400Regular", fontSize: 12 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 14 },
});
