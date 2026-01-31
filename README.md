# LangSeed JS - Chinese Learning App

A React/TypeScript webapp for learning Mandarin Chinese using spaced repetition.

## Data Storage

### Hybrid: localStorage + Supabase Cloud

**Local (instant)**: All changes save to localStorage immediately for fast interactions.

**Cloud (manual sync)**: Click the **Save** button to sync to Supabase for cross-device backup.

| Storage | Key/Table | Data |
|---------|-----------|------|
| localStorage | `langseed_progress` | concepts, srsRecords, lastUpdated |
| localStorage | `langseed_settings` | user preferences (theme, learning focus, etc.) |
| Supabase | `concepts` | Vocabulary with user preferences |
| Supabase | `srs_records` | SRS progress per word |
| Supabase | `user_settings` | User settings (JSONB) |

**Row Level Security (RLS)**: Each user can only access their own data.

---

## Authentication

The app uses **Supabase Auth** with email/password login.

- No public signup (private use only)
- Create your account via Supabase Dashboard
- All data is isolated per user via RLS

---

## Learning Goals (from user preferences)

**Priority order:**
1. **Pinyin** - Foundation, already comfortable
2. **Pronunciation** - Speaking practice, listening comprehension  
3. **Reading** - Character recognition
4. **Tones** - Struggling, needs focused practice
5. **Writing** - Lowest priority, optional

**Current level:** HSK 1

---

## Terminology

Understanding these terms is key to how the app works:

| Term | Meaning |
|------|---------|
| **Added / Known** | A word has been introduced to your study list. You want to learn it. These words appear in Revise sessions. |
| **Mastered** | You've demonstrated strong recall of a word (understanding ≥ 80%). |
| **Studying** | A word is added but not yet mastered. |

**Important distinction:**
- **Adding** a word = putting it in your study queue (chapters feature)
- **Mastering** a word = marking it complete (star checkbox) - either through SRS practice or manually
- **Known ≠ Memorized**: "Known" just means you've added it to study, not that you've fully learned it

---

## Features

### Vocabulary Tab
- **Table view** with sortable columns: Character, Pinyin, Meaning, Type, Chapter, Mastered (⭐)
- **Sticky header** - header stays visible while scrolling
- **Filters**:
  - By chapter (Ch. 1-15)
  - By mastery status (All / Mastered / Studying)
- **Bulk chapter management**:
  - Add words from chapter ranges (e.g., Ch. 1-6) to your study list
  - Remove chapters you don't want to study yet
  - Quick add buttons per chapter showing progress
- **Mass actions**:
  - "Mark all mastered" - for current filtered view
  - "Reset mastery" - put words back into study rotation
- Click any character to see details + SRS progress

### Revise Tab (Flashcard Review)
- **Flashcard-style** vocabulary review with reveal/hide mechanics
- **Session-based**: Randomly selects 10 words from your study list per session
- **Three reveal fields** (tap to show/hide):
  - **Character** (汉字) - Chinese character
  - **Pinyin** - Pronunciation with tone marks
  - **Meaning** - English translation + part of speech
- **Weighted reveal**: One field is randomly shown initially based on weights:
  - Pinyin: 50% (most likely - user's strength)
  - Meaning: 35% (sometimes shown)
  - Character: 15% (least likely - harder recognition)
- **Audio icon**: Gray speaker icon next to pinyin (placeholder for future TTS)
- **Navigation**: Swipe through cards, progress indicator, shuffle for new session

**What "Known" means:**
- "Known" = words you've added to your study list (from Vocabulary tab)
- It does NOT mean fully memorized - just that you want to revise these words
- Unknown/unadded words are not shown to avoid overwhelm

### Settings Tab
- **Cards per Session**: Configure how many words to review (5-50)
- **Learning Focus**: Set priority for each field (0=Skip, 1=Low, 2=Med, 3=High):
  - Character recognition
  - Pinyin recall
  - Meaning/translation
  - Audio/pronunciation
- **Theme Selection**: 8 themes with live preview:
  - Light, Dark, Wooden, Ocean, Forest, Sunset, Sakura, Ink
- **Display Options**:
  - Character size (small/medium/large)
  - Pinyin display (tones: māma vs numbers: ma1ma)
  - Auto-play audio on reveal
  - Show example sentences
- **Accessibility**: Reduced motion option
- **Account**: Sign out and reset to defaults
- **Save button**: Syncs settings to Supabase for cross-device persistence

### Cloud Sync
- **Save button** in header syncs local data to Supabase
- **Sync indicator** shows if changes are pending
- **Auto-load** from cloud on login

---

## Tech Stack
- React 19 + TypeScript
- Vite (build tool)
- Tailwind CSS v4 + daisyUI v5
- localStorage (local cache)
- Supabase (auth + cloud storage)

---

## Setup

### 1. Clone & Install

```bash
git clone https://github.com/avi-otterai/mandarin.git
cd langseed-js
npm install
```

### 2. Configure Supabase

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```bash
cp .env.example .env
```

Edit `.env`:
```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Create Supabase User

Go to your Supabase Dashboard → Authentication → Users → Add user

### 4. Run Locally

```bash
npm run dev
```

Open http://localhost:5173/

---

## Deploying to Netlify

### Option 1: Connect GitHub

1. Go to [Netlify](https://app.netlify.com)
2. New site → Import from Git → Select your repo
3. Build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Environment variables (Site settings → Environment):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy!

### Option 2: Manual Deploy

```bash
npm run build
# Upload 'dist' folder to Netlify
```

---

## Project Structure

```
langseed-js/
├── src/
│   ├── components/
│   │   ├── Navbar.tsx        # Bottom navigation (3 tabs)
│   │   ├── VocabCard.tsx     # Word detail modal
│   │   └── SyncButton.tsx    # Cloud sync button
│   ├── pages/
│   │   ├── VocabularyPage.tsx # Table + filters
│   │   ├── RevisePage.tsx     # Flashcard review
│   │   ├── SettingsPage.tsx   # User preferences
│   │   └── LoginPage.tsx      # Authentication
│   ├── stores/
│   │   ├── vocabularyStore.ts # Vocab state + localStorage + sync
│   │   └── settingsStore.ts   # Settings state + localStorage + sync
│   ├── hooks/
│   │   └── useAuth.ts         # Supabase auth hook
│   ├── lib/
│   │   ├── supabase.ts        # Supabase client
│   │   └── syncService.ts     # Cloud sync logic
│   ├── types/
│   │   ├── vocabulary.ts      # Vocab types
│   │   ├── settings.ts        # Settings types
│   │   └── database.ts        # Supabase types
│   ├── utils/
│   │   ├── srs.ts            # SRS algorithm
│   │   └── pinyin.ts         # Pinyin matching
│   └── data/
│       └── hsk1_vocabulary.json
├── .env.example              # Environment template
├── netlify.toml              # Netlify config
├── index.html
├── package.json
└── README.md
```

---

## Supabase Schema

### Tables

**concepts**
- `id`, `user_id`, `word`, `pinyin`, `part_of_speech`, `meaning`, `chapter`, `source`, `understanding`, `paused`, `created_at`, `updated_at`

**srs_records**
- `id`, `user_id`, `concept_id`, `question_type`, `tier`, `next_review`, `streak`, `lapses`, `created_at`, `updated_at`

**user_settings**
- `user_id` (primary key), `settings` (JSONB), `created_at`, `updated_at`
- Stores: cardsPerSession, learningFocus, theme, pinyinDisplay, characterSize, autoPlayAudio, showExampleSentences, shuffleMode, reducedMotion

### RLS Policies
All tables have Row Level Security enabled:
- Users can only SELECT/INSERT/UPDATE/DELETE their own rows
- Enforced via `auth.uid() = user_id`

---

## TODO / Roadmap

- [x] Vocabulary table with sorting
- [x] Chapter filtering
- [x] Bulk chapter add/remove
- [x] Mass mastery toggle
- [x] Sticky table header
- [x] SRS practice (3 question types)
- [x] localStorage persistence
- [x] Supabase auth + cloud sync
- [x] Manual save button with sync indicator
- [x] Netlify deployment config
- [x] Flashcard-style revise with reveal/hide mechanics
- [x] Settings tab with themes & learning focus
- [x] Configurable words per session
- [x] Custom reveal weights
- [x] 8 custom themes (light, dark, wooden, ocean, forest, sunset, sakura, ink)
- [ ] Add audio/TTS for pronunciation
- [ ] Tone-specific practice mode
- [ ] Import custom vocabulary lists
- [ ] Progress stats / charts

---

## Data

HSK 1 vocabulary is stored in `src/data/hsk1_vocabulary.json` with ~150 words across 15 chapters.
