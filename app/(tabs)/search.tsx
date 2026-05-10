import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  getDoc,
  doc,
  setDoc,
  collection,
  serverTimestamp,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { Feather } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { BrawUser } from "@/types";
import UserAvatar from "@/components/UserAvatar";

export default function SearchScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [query2, setQuery2] = useState("");
  const [result, setResult] = useState<BrawUser | null>(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSearch() {
    if (!query2.trim()) return;
    setLoading(true);
    setSearched(false);
    setResult(null);
    try {
      const cleanQ = query2.trim().toLowerCase();
      const usernameSnap = await getDoc(doc(db, "usernames", cleanQ));
      if (!usernameSnap.exists()) {
        setResult(null);
        setSearched(true);
        setLoading(false);
        return;
      }
      const { uid } = usernameSnap.data() as { uid: string };
      const userSnap = await getDoc(doc(db, "users", uid));
      if (userSnap.exists()) {
        setResult(userSnap.data() as BrawUser);
      }
      setSearched(true);
    } catch {
      Alert.alert("Hata", "Arama sırasında bir sorun oluştu.");
    } finally {
      setLoading(false);
    }
  }

  async function openChat() {
    if (!result || !user) return;
    const ids = [user.uid, result.uid].sort();
    const chatId = ids.join("_");
    const chatRef = doc(db, "chats", chatId);
    const existing = await getDoc(chatRef);
    if (!existing.exists()) {
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

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topInset + 12 }]}>
        <Text style={[styles.title, { color: colors.text }]}>Kullanıcı Bul</Text>
      </View>

      <View style={styles.searchRow}>
        <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="Tam kullanıcı adı..."
            placeholderTextColor={colors.mutedForeground}
            value={query2}
            onChangeText={setQuery2}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
        </View>
        <TouchableOpacity
          style={[styles.searchBtn, { backgroundColor: colors.primary }]}
          onPress={handleSearch}
          activeOpacity={0.8}
        >
          <Feather name="arrow-right" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        {loading && <ActivityIndicator color={colors.primary} />}

        {!loading && searched && !result && (
          <View style={styles.center}>
            <Feather name="user-x" size={40} color={colors.muted} />
            <Text style={[styles.noResult, { color: colors.mutedForeground }]}>
              Kullanıcı bulunamadı
            </Text>
            <Text style={[styles.noResultSub, { color: colors.mutedForeground }]}>
              Tam kullanıcı adını yazmayı dene.
            </Text>
          </View>
        )}

        {!loading && result && (
          <View style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <UserAvatar
              photoURL={result.photoURL}
              username={result.username}
              size={56}
              isOnline={result.isOnline}
              hasBlueTick={result.hasBlueTick}
              showOnline
            />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={[styles.username, { color: colors.text }]}>@{result.username}</Text>
              </View>
              <Text style={[styles.bio, { color: colors.mutedForeground }]} numberOfLines={2}>
                {result.bio}
              </Text>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.chatBtn, { backgroundColor: colors.primary }]}
                onPress={openChat}
                activeOpacity={0.8}
              >
                <Feather name="message-circle" size={16} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chatBtn, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
                onPress={() => router.push(`/user/${result.uid}`)}
                activeOpacity={0.8}
              >
                <Feather name="user" size={16} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!searched && !loading && (
          <View style={styles.center}>
            <Feather name="search" size={44} color={colors.muted} />
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              Bir kullanıcıyla sohbet başlatmak için tam kullanıcı adını girin.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  title: { fontFamily: "Inter_700Bold", fontSize: 28 },
  searchRow: { flexDirection: "row", paddingHorizontal: 16, gap: 10, marginBottom: 24 },
  inputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 14 : 10,
  },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  searchBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  body: { flex: 1, paddingHorizontal: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  noResult: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
  noResultSub: { fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center" },
  hint: { fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center", maxWidth: 260 },
  resultCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  username: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
  bio: { fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 2 },
  actions: { flexDirection: "row", gap: 8 },
  chatBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
});
