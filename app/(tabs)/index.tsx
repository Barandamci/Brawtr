import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  getDoc,
  doc,
} from "firebase/firestore";
import { Feather } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { Chat, BrawUser } from "@/types";
import ChatListItem from "@/components/ChatListItem";

export default function ChatsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile } = useAuth();

  const [chats, setChats] = useState<Chat[]>([]);
  const [otherUsers, setOtherUsers] = useState<Record<string, BrawUser>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "chats"),
      where("members", "array-contains", user.uid),
      orderBy("lastMessageTime", "desc")
    );
    const unsub = onSnapshot(q, async (snap) => {
      const chatList: Chat[] = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Chat));
      setChats(chatList);
      setLoading(false);

      const uids = new Set<string>();
      for (const c of chatList) {
        if (!c.isGroup) {
          c.members.forEach((m) => { if (m !== user.uid) uids.add(m); });
        }
      }

      const fetched: Record<string, BrawUser> = {};
      await Promise.all(
        [...uids].map(async (uid) => {
          const snap = await getDoc(doc(db, "users", uid));
          if (snap.exists()) fetched[uid] = snap.data() as BrawUser;
        })
      );
      setOtherUsers((prev) => ({ ...prev, ...fetched }));
    });
    return () => unsub();
  }, [user]);

  const topInset = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topInset + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Braw</Text>
        <View style={styles.headerRight}>
          {(profile?.role === "admin" || profile?.role === "owner") && (
            <TouchableOpacity
              onPress={() => router.push("/admin/index")}
              style={[styles.iconBtn, { backgroundColor: colors.card }]}
            >
              <Feather name="shield" size={18} color={colors.primary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => router.push("/group/new")}
            style={[styles.iconBtn, { backgroundColor: colors.card }]}
          >
            <Feather name="users" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/search")}
            style={[styles.iconBtn, { backgroundColor: colors.card }]}
          >
            <Feather name="edit" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : chats.length === 0 ? (
        <View style={styles.center}>
          <Feather name="message-circle" size={48} color={colors.muted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Henüz sohbet yok</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Arama sekmesinden kullanıcı adını yazarak birini bul.
          </Text>
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const otherUid = item.isGroup
              ? null
              : item.members.find((m) => m !== user?.uid);
            const otherUser = otherUid ? otherUsers[otherUid] : undefined;
            return (
              <ChatListItem
                chat={item}
                otherUser={otherUser}
                onPress={() => router.push(`/chat/${item.id}`)}
              />
            );
          }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 28 },
  headerRight: { flexDirection: "row", gap: 8 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 18 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center" },
});
