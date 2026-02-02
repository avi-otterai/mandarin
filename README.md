# Saras - Chinese Learning App

A React/TypeScript webapp for learning Mandarin Chinese with adaptive quiz-based learning.

---

## 🎯 Learning Philosophy

### Core Principles

| Principle | Implementation |
|-----------|----------------|
| **70-80% success rate** | Quiz selects words you're likely to get right, keeping you motivated |
| **Modality-level tracking** | Track knowledge separately for character, pinyin, meaning, and audio |
| **Encouraging progression** | Mistakes hurt less than successes help — recovery is always possible |
| **Progress visibility** | See your growth over time with modality breakdown charts |

### Knowledge Model

Each word has **4 modality scores** (0-100):
- **Character** - Can you recognize/produce the Chinese characters?
- **Pinyin** - Can you recall the romanized pronunciation?
- **Meaning** - Can you recall the English translation?
- **Audio** - Can you recognize/produce from spoken audio?

**Overall word knowledge** = weighted average of modality scores (weighted by your Learning Focus settings).

### Quiz Task Types (12 combinations)

```
Question → Answer

character → pinyin     | character → meaning   | character → audio
pinyin → character     | pinyin → meaning      | pinyin → audio  
meaning → character    | meaning → pinyin      | meaning → audio
audio → character      | audio → pinyin        | audio → meaning
```

Each quiz question tests one input modality (question) and one output modality (answer). Both modalities are updated after answering (answer gets full update, question gets partial credit for recognition).

---

## 📱 App Structure

### 4 Tabs

| Tab | Purpose | Mode |
|-----|---------|------|
| **Vocabulary** | Import chapters, browse words, toggle study status | Browse |
| **Study** | Self-paced flashcards, tap to reveal, unlimited | Passive |
| **Quiz** | Active MCQ, audio preview, daily goal, tracks progress | Active |
| **Profile** | Progress dashboard + settings | Config |

**Default tab**: Quiz (where the daily learning happens)

---

## 🧠 Data Model

### Concept (User's vocabulary item)

```typescript
interface Concept {
  id: string;
  
  // Base vocab data
  word: string;           // 你好
  pinyin: string;         // nǐhǎo
  meaning: string;        // hello
  partOfSpeech: string;   // interjection
  chapter: number;        // 1
  
  // Per-modality knowledge scores
  modality: {
    character: { knowledge: number; attempts: number; successes: number; lastAttempt: string | null };
    pinyin:    { knowledge: number; attempts: number; successes: number; lastAttempt: string | null };
    meaning:   { knowledge: number; attempts: number; successes: number; lastAttempt: string | null };
    audio:     { knowledge: number; attempts: number; successes: number; lastAttempt: string | null };
  };
  
  // Computed: weighted average of modality.*.knowledge
  knowledge: number;
  paused: boolean;
}
```

### QuizAttempt (Stored on each answer)

```typescript
interface QuizAttempt {
  id: string;
  userId: string;
  timestamp: string;
  
  conceptId: string;
  questionModality: 'character' | 'pinyin' | 'meaning' | 'audio';
  answerModality: 'character' | 'pinyin' | 'meaning' | 'audio';
  
  optionConceptIds: [string, string, string, string];  // 4 options
  selectedIndex: 0 | 1 | 2 | 3;
  correct: boolean;
  
  predictedCorrect: number;  // For future calibration
}
```

### Knowledge Update Formula

```typescript
// ANSWER modality (active recall - full rates):
// On correct: move toward 100 (25% of remaining distance)
// On incorrect: move toward 0 (17.5% of current value)
newKnowledge = correct
  ? current + (100 - current) * 0.25
  : current - current * 0.175;

// QUESTION modality (passive recognition - half rates):
newKnowledge = correct
  ? current + (100 - current) * 0.125
  : current - current * 0.0875;
```

**Why both?** Reading "你好" to select its meaning tests your character recognition (question) AND meaning recall (answer). Both should improve!

**Example recovery**: 80 → wrong → 66 → right → 74 → right → 81 ✓

### Initial Knowledge (Chapter Prior)

Earlier chapters = more common words = higher starting knowledge:
- Chapter 1: 70 (你, 好, 您)
- Chapter 8: 50 (medium frequency)
- Chapter 15: 30 (less common)

---

## 📊 Progress Tracking

### Quick Stats
- **Learning** - Words below 80% knowledge
- **Confident** - Words above 80% knowledge  
- **Unknown** - Words not yet imported (paused)

### Modality Breakdown

```
📝 Character   ████████░░ 78%
🔤 Pinyin      ██████████ 92%
💬 Meaning     █████████░ 85%
🔊 Audio       █████░░░░░ 52%
```

Averages are computed only for modalities you've actually tested.

### Data Flow

1. **Quiz answer** → Save `QuizAttempt` to Supabase (async, non-blocking)
2. **Update local** → Recalculate modality knowledge from answer (both question and answer modalities)
3. **Auto-refresh** → Profile tab refreshes progress on open

---

## 🗄️ Data Storage

### Hybrid: localStorage + Supabase

| Storage | Key/Table | Data |
|---------|-----------|------|
| localStorage | `langseed_progress` | concepts with modality scores |
| localStorage | `langseed_settings` | user preferences |
| localStorage | `langseed_progress_cache` | cached progress snapshots for charts |
| localStorage | `langseed_vocab_sort` | vocabulary table sort column & direction |
| localStorage | `langseed_pending_sync` | flag indicating unsynced local changes |
| Supabase | `vocabulary` | Static HSK vocabulary (shared across all users) |
| Supabase | `user_progress` | User's learning state per vocabulary item |
| Supabase | `quiz_attempts` | All quiz answers (source of truth for progress) |
| Supabase | `user_settings` | User settings (JSONB) |

**Normalized Schema**: Vocabulary reference data is stored once, user progress links to it.

**Row Level Security (RLS)**: Each user can only access their own data. Vocabulary is publicly readable (reference data).

### Auto-Sync Behavior

For signed-in users, progress is automatically synced to Supabase:
- **After quiz answers**: Syncs 3 seconds after the last answer (debounced)
- **On page hide/close**: Syncs immediately when navigating away or closing the tab
- **On app startup**: Loads from cloud to ensure consistency across devices

**⚠️ Important**: Cloud data is the source of truth. If you have local progress that hasn't synced, it will be overwritten when loading from cloud.

### ⚠️ Data Preservation Notes (For Developers)

**DO NOT delete or reset the `user_progress` table for user `your-email@example.com`** - this account has active learning data that should be preserved. If schema changes are needed, migrate the data rather than resetting.

---

## 🔐 Authentication

### Two Modes

| Mode | Cloud Sync | Data Persistence | Signup |
|------|------------|------------------|--------|
| **Guest Mode** | ❌ None | localStorage only (device-local) | Open |
| **Signed In** | ✅ Supabase | localStorage + cloud sync | Invite-only |

### Guest Mode
- Try the app without an account
- Progress saved locally on your device
- Chapter 1 words pre-loaded as "studying"
- No cloud backup (data lost if browser storage cleared)

### Signed In Mode
- **Invite-only**: Email your-email@example.com to request access
- Full cloud sync to Supabase
- Data persists across devices
- Row Level Security (RLS) isolates user data

---

## ⚙️ Settings

### Learning Focus (0-3 weights)

Controls:
1. Which quiz task types are selected (higher weight = more questions)
2. Which flashcard field is revealed first in Study tab
3. How overall word knowledge is computed (weighted average)

| Level | Meaning |
|-------|---------|
| 0 | Skip - never test this modality |
| 1 | Low priority |
| 2 | Medium priority |
| 3 | High priority |

### Other Settings

- **Cards per session**: Quiz questions per session (5-50)
- **Theme**: 8 themes (light, dark, wooden, ocean, forest, sunset, sakura, ink)
- **Character size**: small / medium / large
- **Pinyin display**: tone marks (māma) or numbers (ma1ma1)
- **Audio**: Voice selection, speech rate, auto-play

---

## 🛠️ Tech Stack

- React 19 + TypeScript
- Vite (build tool)
- Tailwind CSS v4 + daisyUI v5
- localStorage (local cache)
- Supabase (auth + cloud storage)

---

## 🚀 Setup

### 1. Clone & Install

```bash
git clone https://github.com/avi-otterai/mandarin.git
cd avi-mandarin
npm install
```

### 2. Configure Supabase

```bash
cp .env.example .env
```

Edit `.env`:
```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_DEV_USER_PASSWORD=your-password-here  # Optional: auto-login in dev
```

### 3. Run Locally

```bash
npm run dev
```

Open http://localhost:5173/

---

## 📁 Project Structure

```
src/
├── components/
│   ├── Navbar.tsx           # Bottom navigation (4 tabs)
│   ├── HelpModal.tsx        # Onboarding/help modal
│   ├── VocabCard.tsx        # Word detail modal
│   └── ProgressDashboard.tsx # Progress charts
├── pages/
│   ├── VocabularyPage.tsx   # Word list + filters
│   ├── StudyPage.tsx        # Self-paced flashcards
│   ├── QuizPage.tsx         # Active MCQ quiz
│   ├── ProfilePage.tsx      # Progress + settings
│   └── LoginPage.tsx        # Authentication
├── stores/
│   ├── vocabularyStore.ts   # Vocab state + modality knowledge
│   └── settingsStore.ts     # Settings state
├── lib/
│   ├── supabase.ts          # Supabase client
│   ├── syncService.ts       # Cloud sync logic
│   └── quizService.ts       # Quiz attempt writes
├── services/
│   └── ttsService.ts        # Text-to-Speech
├── types/
│   ├── vocabulary.ts        # Concept, QuizAttempt types
│   ├── settings.ts          # Settings types
│   └── database.ts          # Supabase types
├── utils/
│   ├── knowledge.ts         # Knowledge scoring
│   ├── quiz.ts              # Quiz generation
│   └── pinyin.ts            # Pinyin utilities
└── data/
    └── hsk1_vocabulary.json # HSK1 word list (150 words, 15 chapters)
```

---

## 🗃️ Supabase Schema (Normalized)

### Table: `vocabulary` (Static reference data)

```sql
CREATE TABLE vocabulary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word TEXT NOT NULL,
  pinyin TEXT NOT NULL,
  part_of_speech TEXT NOT NULL,
  meaning TEXT NOT NULL,
  chapter INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'hsk1',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(word, pinyin, meaning)
);

-- Public read access (reference data shared across all users)
CREATE POLICY "Vocabulary is publicly readable" ON vocabulary FOR SELECT USING (true);
```

### Table: `user_progress` (User-specific learning state)

```sql
CREATE TABLE user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  vocabulary_id UUID REFERENCES vocabulary(id) ON DELETE CASCADE NOT NULL,
  knowledge INTEGER NOT NULL DEFAULT 50 CHECK (knowledge >= 0 AND knowledge <= 100),
  modality JSONB NOT NULL DEFAULT '{}',  -- { character: {...}, pinyin: {...}, ... }
  paused BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, vocabulary_id)
);

-- RLS: Users can only access their own progress
CREATE POLICY "Users can view their own progress" ON user_progress
  FOR SELECT USING (user_id = (select auth.uid()));
```

### Table: `quiz_attempts` (Analytics)

```sql
CREATE TABLE quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  vocabulary_id UUID REFERENCES vocabulary(id) ON DELETE CASCADE NOT NULL,
  task_type TEXT NOT NULL,              -- e.g., 'character_to_meaning'
  question_modality TEXT NOT NULL,       -- e.g., 'character'
  answer_modality TEXT NOT NULL,         -- e.g., 'meaning'
  correct BOOLEAN NOT NULL,
  response_time_ms INTEGER,
  knowledge_before INTEGER NOT NULL,
  knowledge_after INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_quiz_attempts_vocabulary_id ON quiz_attempts(vocabulary_id);
```

### Table: `user_settings`

```sql
CREATE TABLE user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Schema Benefits

| Old (denormalized) | New (normalized) |
|--------------------|------------------|
| `concepts` duplicated per user | `vocabulary` stored once |
| 162 rows × N users | 162 vocab + 162 × N user_progress |
| Fixing typos required updating every user | Fix once in vocabulary |
| Mixed static + user data | Clear separation of concerns |

---

## ✅ Roadmap

- [x] Vocabulary table with sorting and filters
- [x] Self-paced flashcard Study tab
- [x] localStorage + Supabase sync
- [x] 8 custom themes
- [x] Browser TTS with per-browser voice preferences
- [x] Onboarding help modal
- [x] **Quiz tab with MCQ testing**
- [x] **Modality-level knowledge tracking**
- [x] **Progress dashboard with charts**
- [x] **Chapter-based initial knowledge priors**
- [x] **Guest mode** (try without account, local storage only)
- [ ] Quick add/remove vocab from Quiz (suggest words, easy toggle without leaving quiz)
- [ ] Smart word selection (75% easy / 25% hard blend based on knowledge)
- [ ] Historical progress timeline (bar chart of "words likely correct" over time)
- [ ] Prediction calibration tracking
- [ ] ElevenLabs premium TTS integration
- [ ] Tone-specific practice mode

---

## 📖 Terminology

| Term | Definition |
|------|------------|
| **Modality** | One of 4 aspects: character, pinyin, meaning, audio |
| **Knowledge** | 0-100 score representing probability of correct recall |
| **Quiz Task** | A question testing one modality → another (12 types) |
| **Study** | Passive flashcard review (self-paced, no tracking) |
| **Quiz** | Active MCQ testing (tracked, contributes to progress) |

---

## 📄 License

Private use only.
