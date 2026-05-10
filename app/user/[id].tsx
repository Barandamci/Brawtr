import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  getDoc,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { Feather, Ionicons } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { BrawUser, Chat } from "@/types";
import UserAvatar from "@/components/UserAvatar";

export default function UserProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, profile } = useAuth();

  const [viewedUser, setViewedUser] = useState<BrawUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const [userChats, setUserChats] = useState<{ chatId: string; otherUsername: string }[]>([]);

  const isAdminOrOwner = profile?.role === "admin" || profile?.role === "owner";
  const isOwner = profile?.role === "owner";

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, "users", id), (snap) => {
      if (snap.exists()) setViewedUser(snap.data() as BrawUser);
      setLoading(false);
    });
    return () => unsub();
  }, [id]);

  useEffect(() => {
    if (!user || !id) return;
    const blockId = `${user.uid}_${id}`;
    getDoc(doc(db, "blocks", blockId)).then((s) => setIsBlocked(s.exists()));
  }, [user, id]);

  async function loadUserChats() {
    if (!id || !isAdminOrOwner) return;
    const q = query(collection(db, "chats"), where("members", "array-contains", id));
    const snap = await getDocs(q);
    const chats: { chatId: string; otherUsername: string }[] = [];
    for (const d of snap.docs) {
      const chat = { id: d.id, ...d.data() } as Chat;
      if (chat.isGroup) {
        chats.push({ chatId: chat.id, otherUsername: chat.name || "Grup" });
      } else {
        const otherUid = chat.members.find((m) => m !== id);
        if (otherUid) {
          const us = await getDoc(doc(db, "users", otherUid));
          if (us.exists()) chats.push({ chatId: chat.id, otherUsername: "@" + (us.data() as BrawUser).username });
        }
      }
    }
    setUserChats(chats);
  }

  useEffect(() => {
    if (isAdminOrOwner) loadUserChats();
  }, [id, isAdminOrOwner]);

  async function handleBlock() {
    if (!user || !id) return;
    const blockId = `${user.uid}_${id}`;
    if (isBlocked) {
      await deleteDoc(doc(db, "blocks", blockId));
      setIsBlocked(false);
    } else {
      await setDoc(doc(db, "blocks", blockId), { blockerId: user.uid, blockedId: id });
      setIsBlocked(true);
    }
    Haptics(isBlocked ? "unblocked" : "blocked");
  }

  async function handleBan() {
    if (!viewedUser) return;
    if (viewedUser.role === "owner") {
      Alert.alert("Hata", "Kurucu banlanamaz.");
      return;
    }
    Alert.prompt(
      viewedUser.isBanned ? "Banı Kaldır" : "Kullanıcıyı Banla",
      "Açıklama (isteğe bağlı):",
      [
        { text: "İptal", style: "cancel" },
        {
          text: viewedUser.isBanned ? "Kaldır" : "Banla",
          style: viewedUser.isBanned ? "default" : "destructive",
          onPress: async (reason) => {
            await doc(db, "users", id);
            await import("firebase/firestore").then(({ updateDoc }) =>
              updateDoc(doc(db, "users", id), {
                isBanned: !viewedUser.isBanned,
                banReason: reason || "",
                bannedBy: user?.uid,
                bannedAt: serverTimestamp(),
              })
            );
          },
        },
      ],
      "plain-text"
    );
  }

  async function openChat() {
    if (!user || !id) return;
    const ids = [user.uid, id].sort();
    const chatId = ids.join("_");
    const chatRef = doc(db, "chats", chatId);
    const ex = await getDoc(chatRef);
    if (!ex.exists()) {
      await setDoc(chatRef, {
        members: ids,
        isGroup: false,
        lastMessage: "",
        lastMessageTime: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
    }
    router.push(`/chat/${chatId}`);
  }

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const botInset = Platform.OS === "web" ? 34 : insets.bottom;

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!viewedUser) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground }}>Kullanıcı bulunamadı</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topInset + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Profil</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: botInset + 32 }]}>
        <View style={styles.profileSection}>
          <UserAvatar
            photoURL={viewedUser.photoURL}
            username={viewedUser.username}
            size={90}
            isOnline={viewedUser.isOnline}
            hasBlueTick={viewedUser.hasBlueTick}
            showOnline
          />
          <View style={styles.nameRow}>
            <Text style={[styles.username, { color: colors.text }]}>@{viewedUser.username}</Text>
            {viewedUser.hasBlueTick && (
              <Ionicons name="checkmark-circle" size={18} color="#1D9BF0" />
            )}
          </View>
          {viewedUser.isBanned && (
            <View style={[styles.bannedBadge, { backgroundColor: colors.destructive + "22" }]}>
              <Feather name="slash" size={12} color={colors.destructive} />
              <Text style={[styles.bannedText, { color: colors.destructive }]}>Banlı</Text>
            </View>
          )}
          <Text style={[styles.statusText, { color: viewedUser.isOnline ? colors.online : colors.mutedForeground }]}>
            {viewedUser.isOnline ? "Aktif" : "Çevrimdışı"}
          </Text>
          <Text style={[styles.bio, { color: colors.text }]}>{viewedUser.bio}</Text>
        </View>

        {user?.uid !== id && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
              onPress={openChat}
              activeOpacity={0.8}
            >
              <Feather name="message-circle" size={18} color="#fff" />
              <Text style={[styles.actionBtnText, { color: "#fff" }]}>Mesaj Gönder</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtnOutline, { borderColor: colors.border, backgroundColor: colors.card }]}
              onPress={handleBlock}
              activeOpacity={0.8}
            >
              <Feather name={isBlocked ? "user-check" : "user-x"} size={18} color={isBlocked ? colors.primary : colors.destructive} />
            </TouchableOpacity>
          </View>
        )}

        {isAdminOrOwner && (
          <View style={[styles.adminCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.adminCardTitle, { color: colors.text }]}>Admin Paneli</Text>

            <TouchableOpacity
              style={[styles.adminBtn, { backgroundColor: viewedUser.isBanned ? colors.primary + "22" : colors.destructive + "22" }]}
              onPress={handleBan}
              disabled={viewedUser.role === "owner" || (!isOwner && viewedUser.role === "admin")}
            >
              <Feather
                name={viewedUser.isBanned ? "user-check" : "slash"}
                size={16}
                color={viewedUser.isBanned ? colors.primary : colors.destructive}
              />
              <Text style={{ color: viewedUser.isBanned ? colors.primary : colors.destructive, fontFamily: "Inter_500Medium", fontSize: 14 }}>
                {viewedUser.isBanned ? "Banı Kaldır" : "Kullanıcıyı Banla"}
              </Text>
            </TouchableOpacity>

            {isOwner && viewedUser.role !== "owner" && (
              <TouchableOpacity
                style={[styles.adminBtn, { backgroundColor: colors.primary + "22" }]}
                onPress={async () => {
                  const newRole = viewedUser.role === "admin" ? "user" : "admin";
                  await import("firebase/firestore").then(({ updateDoc }) =>
                    updateDoc(doc(db, "users", id), { role: newRole })
                  );
                }}
              >
                <Feather name="shield" size={16} color={colors.primary} />
                <Text style={{ color: colors.primary, fontFamily: "Inter_500Medium", fontSize: 14 }}>
                  {viewedUser.role === "admin" ? "Admin'i Kaldır" : "Admin Yap"}
                </Text>
              </TouchableOpacity>
            )}

            {isAdminOrOwner && !viewedUser.hasBlueTick && (
              <TouchableOpacity
                style={[styles.adminBtn, { backgroundColor: "#1D9BF022" }]}
                onPress={async () => {
                  await import("firebase/firestore").then(({ updateDoc }) =>
                    updateDoc(doc(db, "users", id), { hasBlueTick: true })
                  );
                }}
              >
                <Ionicons name="checkmark-circle" size={16} color="#1D9BF0" />
                <Text style={{ color: "#1D9BF0", fontFamily: "Inter_500Medium", fontSize: 14 }}>Mavi Tık Ver</Text>
              </TouchableOpacity>
            )}

            {isAdminOrOwner && viewedUser.hasBlueTick && (
              <TouchableOpacity
                style={[styles.adminBtn, { backgroundColor: colors.muted }]}
                onPress={async () => {
                  await import("firebase/firestore").then(({ updateDoc }) =>
                    updateDoc(doc(db, "users", id), { hasBlueTick: false })
                  );
                }}
              >
                <Ionicons name="checkmark-circle-outline" size={16} color={colors.mutedForeground} />
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 14 }}>Mavi Tık'ı Kaldır</Text>
              </TouchableOpacity>
            )}

            {userChats.length > 0 && (
              <View style={{ marginTop: 16, gap: 8 }}>
                <Text style={[styles.adminCardTitle, { color: colors.mutedForeground, fontSize: 12 }]}>
                  KONUŞMALAR ({userChats.length})
                </Text>
                {userChats.map((c) => (
                  <TouchableOpacity
                    key={c.chatId}
                    style={[styles.chatRow, { borderColor: colors.border }]}
                    onPress={() => router.push(`/chat/${c.chatId}`)}
                  >
                    <Feather name="message-square" size={14} color={colors.mutedForeground} />
                    <Text style={[styles.chatRowText, { color: colors.text }]}>{c.otherUsername}</Text>
                    <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Haptics(action: string) {}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontFamily: "Inter_600SemiBold", fontSize: 17 },
  scroll: { paddingHorizontal: 20, paddingTop: 24, gap: 20 },
  profileSection: { alignItems: "center", gap: 8 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  username: { fontFamily: "Inter_700Bold", fontSize: 22 },
  bannedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  bannedText: { fontFamily: "Inter_500Medium", fontSize: 12 },
  statusText: { fontFamily: "Inter_400Regular", fontSize: 13 },
  bio: { fontFamily: "Inter_400Regular", fontSize: 15, textAlign: "center", maxWidth: 280 },
  actionRow: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
  },
  actionBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  actionBtnOutline: {
    width: 50,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  adminCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  adminCardTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  adminBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  chatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chatRowText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 14 },
});
