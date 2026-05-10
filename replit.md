# Braw

Braw, Firebase tabanlı gerçek zamanlı bir mobil mesajlaşma uygulamasıdır.

## Run & Operate

- `pnpm --filter @workspace/braw run dev` — Expo dev sunucusunu başlat
- Required env: `EXPO_PUBLIC_FIREBASE_*`, `EXPO_PUBLIC_CLOUDINARY_*`

## Stack

- Expo (React Native), Firebase Auth + Firestore, Cloudinary (medya), TypeScript

## Where things live

- `lib/firebase.ts` — Firebase init
- `lib/cloudinary.ts` — Cloudinary upload helper
- `contexts/AuthContext.tsx` — Auth state, user profile, role management
- `types/index.ts` — Shared TypeScript types
- `app/(auth)/` — Login & profile setup screens
- `app/(tabs)/` — Ana sekmeler (Sohbetler, Ara, Profil)
- `app/chat/[id].tsx` — Bireysel & grup sohbet ekranı
- `app/user/[id].tsx` — Kullanıcı profil görüntüleme (admin özellikleri dahil)
- `app/group/new.tsx` — Yeni grup oluştur
- `app/group-settings/[id].tsx` — Grup ayarları
- `app/admin/index.tsx` — Admin paneli

## Firestore Collections

- `users/{uid}` — Kullanıcı profili ve rol bilgisi
- `usernames/{username}` — Benzersiz kullanıcı adı indeksi
- `chats/{chatId}` — Bireysel ve grup sohbetleri
- `messages/{chatId}/messages/{msgId}` — Mesajlar
- `blocks/{blockerId_blockedId}` — Engelleme kayıtları

## User preferences

- Owner email: barandamci@icloud.com (otomatik "owner" rolü alır)
- Sadece @gmail.com adresleri kayıt olabilir (owner hariç)
- Kullanıcı arama: Tam kullanıcı adı gereklidir (liste gösterilmez)

## Architecture decisions

- Firebase Auth email/password — Gmail kısıtlaması uygulama tarafında
- Cloudinary upload preset: "Untitled" (unsigned olmalı)
- Chat ID formatı: bireysel = sorted([uid1, uid2]).join("_"), grup = auto ID
- Rol hiyerarşisi: owner > admin > user
