import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";

export default function SignupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { setPendingSignup } = useAuth();

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const apiBase =
    typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.host}/api`
      : `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

  async function handleSignup() {
    const trimName = fullName.trim();
    const trimUser = username
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_");
    const trimEmail = email.trim().toLowerCase();

    if (!trimName || !trimUser || !trimEmail || !password) {
      Alert.alert("Eksik bilgi", "Lütfen tüm alanları doldurun.");
      return;
    }
    if (trimUser.length < 3) {
      Alert.alert("Hata", "Kullanıcı adı en az 3 karakter olmalı.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Hata", "Şifre en az 6 karakter olmalı.");
      return;
    }

    setLoading(true);
    try {
      const usernameSnap = await getDoc(doc(db, "usernames", trimUser));
      if (usernameSnap.exists()) {
        Alert.alert(
          "Hata",
          "Bu kullanıcı adı zaten alınmış. Başka bir tane dene."
        );
        setLoading(false);
        return;
      }

      const resp = await fetch(`${apiBase}/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimEmail,
          fullName: trimName,
          username: trimUser,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        Alert.alert("Hata", data.error || "E-posta gönderilemedi.");
        setLoading(false);
        return;
      }

      setPendingSignup({
        email: trimEmail,
        password,
        username: trimUser,
        fullName: trimName,
      });

      router.push("/(auth)/verify-otp");
    } catch (err) {
      Alert.alert(
        "Hata",
        "Bir hata oluştu. İnternet bağlantınızı kontrol edin.\n" +
          String(err)
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {
              paddingTop: insets.top + 20,
              paddingBottom: insets.bottom + 32,
            },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backBtn, { marginBottom: 24 }]}
          >
            <Feather name="arrow-left" size={22} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.header}>
            <View
              style={[styles.avatarIcon, { backgroundColor: colors.primary }]}
            >
              <Feather name="user-plus" size={32} color="#fff" />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>
              Kayıt Ol
            </Text>
            <Text
              style={[styles.subtitle, { color: colors.mutedForeground }]}
            >
              Yeni hesap oluştur
            </Text>
          </View>

          <View style={styles.form}>
            <View
              style={[
                styles.inputRow,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <Feather
                name="user"
                size={18}
                color={colors.mutedForeground}
                style={styles.icon}
              />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Ad Soyad"
                placeholderTextColor={colors.mutedForeground}
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            <View
              style={[
                styles.inputRow,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text
                style={[styles.atSign, { color: colors.mutedForeground }]}
              >
                @
              </Text>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="kullanici_adi"
                placeholderTextColor={colors.mutedForeground}
                value={username}
                onChangeText={(t) =>
                  setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                }
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View
              style={[
                styles.inputRow,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <Feather
                name="mail"
                size={18}
                color={colors.mutedForeground}
                style={styles.icon}
              />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="E-posta"
                placeholderTextColor={colors.mutedForeground}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View
              style={[
                styles.inputRow,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <Feather
                name="lock"
                size={18}
                color={colors.mutedForeground}
                style={styles.icon}
              />
              <TextInput
                style={[styles.input, { color: colors.text, flex: 1 }]}
                placeholder="Şifre (min. 6 karakter)"
                placeholderTextColor={colors.mutedForeground}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowPass(!showPass)}
                style={styles.eyeBtn}
              >
                <Feather
                  name={showPass ? "eye-off" : "eye"}
                  size={18}
                  color={colors.mutedForeground}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.primary }]}
              onPress={handleSignup}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Kayıt Ol</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.switchBtn}
            >
              <Text
                style={[
                  styles.switchText,
                  { color: colors.mutedForeground },
                ]}
              >
                Zaten hesabın var mı?{" "}
                <Text
                  style={{
                    color: colors.primary,
                    fontFamily: "Inter_600SemiBold",
                  }}
                >
                  Giriş Yap
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24 },
  backBtn: { padding: 4, alignSelf: "flex-start" },
  header: { alignItems: "center", marginBottom: 32, gap: 10 },
  avatarIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  title: { fontSize: 28, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular" },
  form: { gap: 12 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 14 : 10,
  },
  icon: { marginRight: 10 },
  atSign: {
    fontSize: 17,
    fontFamily: "Inter_500Medium",
    marginRight: 8,
  },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  eyeBtn: { padding: 4 },
  button: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
  },
  buttonText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  switchBtn: { alignItems: "center", paddingVertical: 8 },
  switchText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
