# YOKDILHUNTER

**İngilizce kelime öğrenme PWA'sı** — kelimeleri kaydet, Türkçe çevirisiyle flashcard ile çalış.

> Phase 1: Web uygulaması (React + Vite + Supabase)
> Phase 2 (ayrı proje): Aynı Supabase backend'e bağlanan Chrome Extension

---

## ✨ Özellikler

| Özellik | Açıklama |
|---|---|
| 🔑 Auth | Supabase ile e-posta/şifre giriş + kayıt |
| ➕ Kelime Ekleme | Ücretsiz API'lerden otomatik çeviri + tanım + eş anlamlı |
| 📚 Kütüphane | Tüm kelimeler, zorluk filtresi, arama, düzenleme |
| 🃏 Flashcard | 3D flip animasyonlu kart, Kolay/Orta/Zor değerlendirme |
| 📱 PWA | Telefon ana ekranına eklenebilir, offline çalışır |
| 🌙 Dark Mode | Varsayılan olarak koyu tema |

---

## 🚀 Kurulum Adımları

### 1. Node.js Kur

[nodejs.org](https://nodejs.org/) adresinden LTS sürümünü indir ve kur.

### 2. Supabase Projesi Oluştur

1. [supabase.com](https://supabase.com) → **New Project** oluştur (ücretsiz)
2. Proje oluşturulduktan sonra **SQL Editor**'ı aç
3. Bu dosyanın içeriğini kopyala ve çalıştır: [`supabase_schema.sql`](./supabase_schema.sql)
4. **Settings → API** sayfasından şunları kopyala:
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon public` key → `VITE_SUPABASE_ANON_KEY`

### 3. Environment Variables

```bash
# Proje klasöründe .env dosyası oluştur
cp .env.example .env
```

`.env` dosyasını düzenle:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

### 4. Bağımlılıkları Yükle ve Çalıştır

```bash
cd yokdilhunter
npm install
npm run dev
```

Tarayıcıda `http://localhost:5173` adresini aç.

---

## 🗄️ Veritabanı Şeması

```sql
-- supabase_schema.sql dosyasını SQL Editor'da çalıştır
```

Tablo: **`words`**

| Kolon | Tip | Açıklama |
|---|---|---|
| `id` | uuid | Primary key |
| `user_id` | uuid | Kullanıcı ID (auth.users FK) |
| `english_word` | text | İngilizce kelime |
| `turkish_translation` | text | Türkçe çeviri |
| `synonyms` | text[] | Eş anlamlılar |
| `definition` | text | İngilizce tanım |
| `phonetic` | text | Telaffuz (/ɪˈfem.ər.əl/) |
| `source_url` | text | *Phase 2 için ayrılmış* |
| `difficulty` | text | unrated / easy / medium / hard |
| `next_review_at` | timestamptz | Sonraki tekrar tarihi |
| `interval_days` | integer | Tekrar aralığı (gün) |
| `review_count` | integer | Toplam tekrar sayısı |
| `last_reviewed_at` | timestamptz | Son tekrar tarihi |
| `created_at` | timestamptz | Kayıt tarihi |

---

## 📡 Kullanılan Ücretsiz API'ler

| API | Kullanım |
|---|---|
| [Free Dictionary API](https://dictionaryapi.dev/) | Tanım, fonetik, eş anlamlılar |
| [MyMemory Translation](https://mymemory.translated.net/) | İngilizce → Türkçe çeviri |

Her ikisi de **ücretsiz**, API anahtarı gerektirmez.

---

## 🃏 Flashcard Tekrar Mantığı

| Değerlendirme | Sonraki Tekrar |
|---|---|
| 😰 Zor | +1 gün |
| 🤔 Orta | +3 gün |
| 😊 Kolay | +10 gün |

**Varsayılan tekrar oturumu** yalnızca `unrated + medium + hard` kelimelerini içerir.
`Kolay` işaretlenen kelimeler normal oturumdan çıkar (kütüphanede görünmeye devam eder).

---

## 🌐 Vercel'e Deploy

### Seçenek 1: Vercel CLI

```bash
npm install -g vercel
vercel --prod
```

### Seçenek 2: GitHub + Vercel Dashboard

1. Projeyi GitHub'a push et
2. [vercel.com](https://vercel.com) → **Import Project** → GitHub reposunu seç
3. **Environment Variables** ekle:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. **Deploy** ↗

`vercel.json` dosyası zaten React Router için SPA rewrite kurallarını içeriyor.

---

## 📱 Netlify'a Deploy (Alternatif)

```bash
npm run build
# dist/ klasörünü Netlify'a drag & drop et
# veya GitHub ile bağla
```

Netlify için `_redirects` dosyası:
```
/* /index.html 200
```

---

## 📁 Proje Yapısı

```
yokdilhunter/
├── public/
│   └── icons/          # PWA ikonları
├── src/
│   ├── components/
│   │   ├── auth/       # (gelecek kullanım)
│   │   ├── layout/     # BottomNav, Layout
│   │   ├── review/     # FlashCard
│   │   └── words/      # WordCard
│   ├── hooks/          # useAuth, useWords, useReview
│   ├── lib/            # supabase.js, api.js, spaced.js
│   ├── pages/          # AuthPage, AddWordPage, LibraryPage, ReviewPage
│   ├── store/          # authStore.js (Zustand)
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── supabase_schema.sql # Çalıştırılacak SQL
├── vercel.json
├── vite.config.js
└── tailwind.config.js
```

---

## 🔮 Phase 2: Chrome Extension

Phase 2'de ayrı bir codebase olarak bir Chrome Extension geliştirilecek.
Extension, web sayfalarında seçilen kelimeleri **doğrudan bu Supabase backend'e** kaydedecek —
`source_url` kolonu hangi sayfadan geldiğini takip etmek için kullanılacak.
Şema değişikliği gerektirmez.

---

## 🛠️ Tech Stack

- **React 18** + **Vite 5**
- **Tailwind CSS 3**
- **Supabase** (Auth + Postgres + RLS)
- **React Router v6**
- **Zustand** (auth state)
- **vite-plugin-pwa** (service worker + manifest)

---

*MIT License*
