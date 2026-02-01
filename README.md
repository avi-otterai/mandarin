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
| localStorage | `langseed_last_review` | ISO timestamp of last completed review session |
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

## Terminology: Known vs Unknown Words

**This is the most important concept in the app!**

| Term | Meaning | In Revise? |
|------|---------|------------|
| **Known** ✓ | Word is checked in Vocabulary tab. User wants to learn this word. | **YES** |
| **Unknown** | Word is NOT checked. User hasn't selected it yet (to avoid overwhelm). | **NO** |

### How It Works

1. **Import chapters** → Words are added to Vocabulary (but marked as "unknown" by default)
2. **Check the ✓ checkbox** → Word becomes "known" = you want to learn it
3. **Only checked (known) words appear in Revise sessions!**

### Why This Matters

- **Avoids overwhelm**: You only see words you've explicitly chosen to learn
- **Controlled vocab**: Start small (check a few words), gradually expand
- **Focused learning**: Revise tab shows ONLY your selected vocabulary

### Binary System

There are only **2 categories**:
- ✓ **Known** = checked = will appear in Revise
- ☐ **Unknown** = not checked = won't appear in Revise

No complex mastery levels - just known or unknown. (SRS tracking for recall strength is separate and granular.)

---

## Features

### Vocabulary Tab
- **Table view** with sortable columns: Character, Pinyin, Meaning, Type, Chapter, Known (✓)
- **Sticky header** - header stays visible while scrolling
- **Filters**:
  - By chapter (Ch. 1-15)
  - By known status (All / Known ✓ / Unknown)
- **Bulk chapter management**:
  - Add words from chapter ranges (e.g., Ch. 1-6) to your list
  - Remove chapters you don't want yet
  - Quick add buttons per chapter showing progress
- **Mass actions**:
  - "Mark all known" - check all words in current view (adds to Revise)
  - "Mark unknown" - uncheck words (removes from Revise)
- **Checkbox (✓ column)**: Check = "known" = word will appear in Revise sessions
- Click any character to see details + SRS progress

### Revise Tab (Flashcard Review)
- **Flashcard-style** vocabulary review with reveal/hide mechanics
- **Session-based**: Randomly selects from your KNOWN words (configurable in Settings)
- **CRITICAL**: Only words with ✓ checkbox in Vocabulary appear here!
- **Four reveal fields** (tap to show/hide):
  - **Character** (汉字) - Chinese character
  - **Pinyin** - Pronunciation with tone marks
  - **Meaning** - English translation + part of speech
  - **Audio** - Speaker button with Text-to-Speech pronunciation
- **Weighted reveal**: One field is randomly shown initially based on your Learning Focus settings:
  - Default weights: Pinyin 50%, Meaning 35%, Character 15%, Audio 0%
  - Customize in Settings → Learning Focus
- **Session completion**: 🎉 Confetti celebration when you finish all cards
- **Daily tracking**: Completing a session marks today as "reviewed" (stored in localStorage)
- **Navigation**: Previous/Next buttons, progress bar, dot indicators, shuffle button

**⚠️ Known Words Only:**
- Revise ONLY shows words you've checked (✓) in the Vocabulary tab
- If you see "No Words Yet" - go to Vocabulary and check some words!
- This prevents overwhelm by keeping your study set focused and intentional

### Navigation Bar Indicators
The bottom navbar shows status indicators:
- **Revise tab**: Shows ✓ (green badge) if you've reviewed today, or ⚠ (orange badge) if not
- **Settings tab**: Shows orange dot if there are unsynced settings changes

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
  - Show example sentences
- **Audio & Pronunciation**:
  - Chinese voice selection (auto-detects available system voices)
  - Speech speed control (0.5x - 1.5x)
  - Auto-play audio when revealed
  - Test voice preview button
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

### GitHub Auto-Deployment (Recommended)

Connect GitHub for automatic deploys on every push to `main`:

1. **Create site**: Go to [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an existing project**
2. **Connect GitHub**: Click "Deploy with GitHub" → Authorize → Select `avi-otterai/mandarin`
3. **Verify build settings** (auto-detected from `netlify.toml`):
   - Branch: `main`
   - Build command: `npm run build`
   - Publish directory: `dist`
4. **Add environment variables** (CRITICAL!):
   - `VITE_SUPABASE_URL` → `https://YOUR_PROJECT_ID.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` → your anon key
5. **Deploy!** Click "Deploy site"

**✅ Auto-deploy enabled**: Every push to `main` triggers a new build automatically.

### Manual Deploy (Alternative)

```bash
npm run build
# Drag & drop 'dist' folder to Netlify dashboard
```

### Netlify Configuration

The `netlify.toml` file handles:
- Build command and publish directory
- SPA routing (redirects all routes to `index.html`)
- Security headers (X-Frame-Options, CSP, etc.)

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
│   ├── services/
│   │   └── ttsService.ts      # Text-to-Speech (browser API)
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
- [x] Mass known/unknown toggle
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
- [x] Confetti celebration on session completion
- [x] Revise tab indicator (✓ if reviewed today, ! if not)
- [x] Fix: Next button now works on last card to complete session
- [x] Browser TTS for Chinese pronunciation (voice selection, speed control)
- [ ] ElevenLabs premium TTS integration (multiple voices, styles)
- [ ] Tone-specific practice mode
- [ ] Progress stats / charts
- [ ] **Session tracking in Supabase**: Record each revision session (timestamp, cards reviewed, per-card recall feedback - e.g., "knew it" vs "didn't know" for each hidden modality)

---

## Data

HSK 1 vocabulary is stored in `src/data/hsk1_vocabulary.json` with ~150 words across 15 chapters.
