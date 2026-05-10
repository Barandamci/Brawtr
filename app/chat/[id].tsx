import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Platform,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  getDoc,
  doc,
  updateDoc,
  limit,
} from "firebase/firestore";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { Feather, Ionicons } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { uploadMedia } from "@/lib/cloudinary";
import { Chat, BrawUser, Message } from "@/types";
import UserAvatar from "@/components/UserAvatar";
import { Timestamp } from "firebase/firestore";

function formatMsgTime(ts: Timestamp | null): string {
  if (!ts) return "";
  return ts.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, profile } = useAuth();

  const [chat, setChat] = useState<Chat | null>(null);
  const [otherUser, setOtherUser] = useState<BrawUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingChat, setLoadingChat] = useState(true);

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!id) return;
    const chatRef = doc(db, "chats", id);
    const unsub = onSnapshot(chatRef, async (snap) => {
      if (!snap.exists()) return;
      const chatData = { id: snap.id, ...snap.data() } as Chat;
      setChat(chatData);
      setLoadingChat(false);

      if (!chatData.isGroup) {
        const otherUid = chatData.members.find((m) => m !== user?.uid);
        if (otherUid) {
          const uSnap = await getDoc(doc(db, "users", otherUid));
          if (uSnap.exists()) setOtherUser(uSnap.data() as BrawUser);
        }
      }
    });
    return () => unsub();
  }, [id, user]);

  useEffect(() => {
    if (!id) return;
    const q = query(
      collection(db, "messages", id, "messages"),
      orderBy("timestamp", "desc"),
      limit(80)
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Message)));
    });
    return () => unsub();
  }, [id]);

  const isRestricted = chat?.isGroup && chat?.restrictedMode;
  const isGroupAdmin = chat?.isGroup && (chat?.admins?.includes(user?.uid ?? "") || chat?.createdBy === user?.uid);
  const canSend = !isRestricted || isGroupAdmin || profile?.role === "owner" || profile?.role === "admin";

  async function sendNotifications(msgText: string, mediaUrl?: string, mediaType?: "image" | "video") {
    if (!chat || !profile?.username) return;
    const preview = mediaUrl
      ? mediaType === "video" ? "📹 Video gönderdi" : "📷 Fotoğraf gönderdi"
      : msgText.trim();

    const apiBase = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

    function notifyMember(member: BrawUser, previewText: string) {
      if (member.isOnline) return;
      fetch(`${apiBase}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientEmail: member.email || null,
          recipientUsername: member.username,
          senderUsername: profile!.username,
          messagePreview: previewText,
          chatId: id,
          pushToken: member.pushToken || null,
        }),
      }).catch(() => {});
    }

    if (!chat.isGroup) {
      if (otherUser) notifyMember(otherUser, preview);
    } else {
      const otherMembers = chat.members.filter((m) => m !== user?.uid);
      for (const memberId of otherMembers) {
        getDoc(doc(db, "users", memberId))
          .then((snap) => {
            if (!snap.exists()) return;
            notifyMember(snap.data() as BrawUser, `${chat.name || "Grup"}: ${preview}`);
          })
          .catch(() => {});
      }
    }
  }

  async function sendMessage(msgText: string, mediaUrl?: string, mediaType?: "image" | "video") {
    if ((!msgText.trim() && !mediaUrl) || !user || !id) return;
    if (!canSend) {
      Alert.alert("Kısıtlı Mod", "Bu grupta sadece yöneticiler mesaj atabilir.");
      return;
    }
    setSending(true);
    try {
      const msgRef = collection(db, "messages", id, "messages");
      await addDoc(msgRef, {
        text: msgText.trim(),
        mediaUrl: mediaUrl || null,
        mediaType: mediaType || null,
        senderId: user.uid,
        timestamp: serverTimestamp(),
        deleted: false,
      });
      await updateDoc(doc(db, "chats", id), {
        lastMessage: mediaUrl ? (mediaType === "video" ? "📹 Video" : "📷 Fotoğraf") : msgText.trim(),
        lastMessageTime: serverTimestamp(),
      });
      setText("");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      sendNotifications(msgText, mediaUrl, mediaType);
    } catch {
      Alert.alert("Hata", "Mesaj gönderilemedi.");
    } finally {
      setSending(false);
    }
  }

  async function handlePickMedia() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const mediaType = asset.type === "video" ? "video" : "image";
      setSending(true);
      try {
        const uploaded = await uploadMedia(asset.uri, mediaType);
        await sendMessage("", uploaded.url, mediaType);
      } catch {
        Alert.alert("Hata", "Medya yüklenemedi.");
      } finally {
        setSending(false);
      }
    }
  }

  const displayName = chat?.isGroup
    ? chat.name || "Grup"
    : otherUser?.username || "Kullanıcı";

  const isOnline = !chat?.isGroup && otherUser?.isOnline;

  const renderMessage = useCallback(({ item }: { item: Message }) => {
    const isMine = item.senderId === user?.uid;
    return (
      <View style={[styles.msgRow, { justifyContent: isMine ? "flex-end" : "flex-start" }]}>
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: isMine ? colors.messageBubble : colors.messageBubbleOther,
              borderBottomRightRadius: isMine ? 4 : 16,
              borderBottomLeftRadius: isMine ? 16 : 4,
            },
          ]}
        >
          {item.mediaUrl && item.mediaType === "image" && (
            <Image source={{ uri: item.mediaUrl }} style={styles.mediaImg} resizeMode="cover" />
          )}
          {item.text ? (
            <Text style={[styles.msgText, { color: isMine ? colors.messageBubbleText : colors.messageBubbleTextOther }]}>
              {item.text}
            </Text>
          ) : null}
          <Text style={[styles.msgTime, { color: isMine ? "rgba(255,255,255,0.6)" : colors.mutedForeground }]}>
            {formatMsgTime(item.timestamp)}
          </Text>
        </View>
      </View>
    );
  }, [user, colors]);

  const topInset = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topInset + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerCenter}
          onPress={() => chat?.isGroup ? router.push(`/group-settings/${id}`) : router.push(`/user/${otherUser?.uid}`)}
          activeOpacity={0.8}
        >
          <UserAvatar
            photoURL={chat?.isGroup ? chat.photoURL : otherUser?.photoURL}
            username={displayName}
            size={38}
            isOnline={isOnline}
            hasBlueTick={!chat?.isGroup && otherUser?.hasBlueTick}
            showOnline
          />
          <View>
            <Text style={[styles.headerName, { color: colors.text }]}>{displayName}</Text>
            <Text style={[styles.headerStatus, { color: isOnline ? colors.online : colors.mutedForeground }]}>
              {chat?.isGroup ? `${chat.members.length} üye` : isOnline ? "Aktif" : "Çevrimdışı"}
            </Text>
          </View>
        </TouchableOpacity>

        {chat?.isGroup && isGroupAdmin && (
          <TouchableOpacity onPress={() => router.push(`/group-settings/${id}`)}>
            <Feather name="settings" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        {loadingChat ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            inverted
            contentContainerStyle={{ padding: 12, paddingBottom: 4 }}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          />
        )}

        <View style={[styles.inputBar, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: insets.bottom + 8 }]}>
          {isRestricted && !canSend ? (
            <View style={styles.restrictedBar}>
              <Feather name="lock" size={14} color={colors.mutedForeground} />
              <Text style={[styles.restrictedText, { color: colors.mutedForeground }]}>
                Bu grup kısıtlı modda. Sadece yöneticiler mesaj atabilir.
              </Text>
            </View>
          ) : (
            <>
              <TouchableOpacity onPress={handlePickMedia} style={styles.mediaBtn} disabled={sending}>
                <Feather name="paperclip" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                placeholder="Mesaj yaz..."
                placeholderTextColor={colors.mutedForeground}
                value={text}
                onChangeText={setText}
                multiline
                maxLength={1000}
              />
              <TouchableOpacity
                style={[styles.sendBtn, { backgroundColor: text.trim() ? colors.primary : colors.muted }]}
                onPress={() => sendMessage(text)}
                disabled={!text.trim() || sending}
                activeOpacity={0.8}
              >
                {sending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Feather name="send" size={16} color="#fff" />
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  headerName: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  headerStatus: { fontFamily: "Inter_400Regular", fontSize: 12 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  msgRow: { flexDirection: "row", marginBottom: 6, paddingHorizontal: 4 },
  bubble: { maxWidth: "78%", borderRadius: 16, padding: 10, gap: 4 },
  mediaImg: { width: 220, height: 180, borderRadius: 10 },
  msgText: { fontFamily: "Inter_400Regular", fontSize: 15 },
  msgTime: { fontFamily: "Inter_400Regular", fontSize: 11, alignSelf: "flex-end" },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  mediaBtn: { padding: 8 },
  textInput: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    maxHeight: 120,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  restrictedBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    justifyContent: "center",
  },
  restrictedText: { fontFamily: "Inter_400Regular", fontSize: 13 },
});
