import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  doc,
  updateDoc,
  setDoc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { uploadMedia } from "@/lib/cloudinary";
import UserAvatar from "@/components/UserAvatar";

async function uploadWithTimeout(uri: string, timeoutMs = 20000): Promise<string | null> {
  try {
    const race = await Promise.race([
      uploadMedia(uri, "image").then((r) => r.url),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    return race;
  } catch {
    return null;
  }
}

export default function SetupProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, refreshProfile } = useAuth();

  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [photoURI, setPhotoURI] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("İzin gerekli", "Fotoğraf seçmek için galeri iznine ihtiyaç var.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoURI(result.assets[0].uri);
    }
  }

  async function handleSave() {
    if (!username.trim()) {
      Alert.alert("Hata", "Kullanıcı adı zorunludur.");
      return;
    }
    if (username.trim().length < 3) {
      Alert.alert("Hata", "Kullanıcı adı en az 3 karakter olmalıdır.");
      return;
    }
    if (!bio.trim()) {
      Alert.alert("Hata", "Bio zorunludur.");
      return;
    }
    if (!user) return;

    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");

    setSaving(true);
    try {
      const usernameRef = doc(db, "usernames", cleanUsername);
      const existing = await getDoc(usernameRef);
      if (existing.exists() && existing.data()?.uid !== user.uid) {
        Alert.alert("Hata", "Bu kullanıcı adı zaten alınmış. Başka bir tane dene.");
        setSaving(false);
        return;
      }

      let photoURL = "";
      if (photoURI) {
        setUploadStatus("Fotoğraf yükleniyor...");
        const uploaded = await uploadWithTimeout(photoURI, 20000);
        if (uploaded) {
          photoURL = uploaded;
        } else {
          setUploadStatus("");
          Alert.alert(
            "Fotoğraf Yüklenemedi",
            "Fotoğraf yüklenemedi. Cloudinary ayarlarını kontrol et veya fotoğrafsız devam et.",
            [
              { text: "Fotoğrafsız Devam Et", onPress: () => saveProfile("") },
              { text: "İptal", onPress: () => setSaving(false) },
            ]
          );
          return;
        }
      }

      await saveProfile(photoURL);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bir hata oluştu.";
      Alert.alert("Hata", msg);
      setSaving(false);
      setUploadStatus("");
    }
  }

  async function saveProfile(photoURL: string) {
    if (!user) return;
    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
    try {
      setUploadStatus("Kaydediliyor...");
      await setDoc(doc(db, "usernames", cleanUsername), { uid: user.uid });
      await updateDoc(doc(db, "users", user.uid), {
        username: cleanUsername,
        bio: bio.trim(),
        photoURL,
        updatedAt: serverTimestamp(),
      });
      await refreshProfile();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bir hata oluştu.";
      Alert.alert("Hata", msg);
    } finally {
      setSaving(false);
      setUploadStatus("");
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.title, { color: colors.text }]}>Profili Tamamla</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Braw'ı kullanmaya başlamak için profilini oluştur.
        </Text>

        <TouchableOpacity style={styles.avatarBtn} onPress={pickPhoto} activeOpacity={0.8}>
          <UserAvatar photoURL={photoURI} username={username} size={88} />
          <View style={[styles.editBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.editBadgeText}>+</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.form}>
          <View>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Kullanıcı Adı</Text>
            <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="ornek_kullanici"
                placeholderTextColor={colors.mutedForeground}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <View>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Bio</Text>
            <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border, height: 90 }]}>
              <TextInput
                style={[styles.input, { color: colors.text, flex: 1 }]}
                placeholder="Kendinden kısaca bahset..."
                placeholderTextColor={colors.mutedForeground}
                value={bio}
                onChangeText={setBio}
                multiline
                maxLength={120}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <View style={styles.savingRow}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={[styles.buttonText, { marginLeft: 8 }]}>
                  {uploadStatus || "Kaydediliyor..."}
                </Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>Kaydet</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", marginBottom: 8 },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 32 },
  avatarBtn: {
    alignSelf: "center",
    marginBottom: 32,
    position: "relative",
  },
  editBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  editBadgeText: { color: "#fff", fontSize: 20, lineHeight: 24 },
  form: { gap: 16 },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  inputWrap: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 14 : 10,
  },
  input: { fontSize: 15, fontFamily: "Inter_400Regular" },
  button: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  savingRow: { flexDirection: "row", alignItems: "center" },
  buttonText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
