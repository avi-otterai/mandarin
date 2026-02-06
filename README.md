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

1. **Quiz answer** → Show result, defer logging
2. **Next Question** → Save `QuizAttempt` to Supabase (async, non-blocking) + update local knowledge
3. **Don't log** (optional) → Skip logging this attempt entirely (useful for lucky guesses)
4. **Auto-refresh** → Profile tab refreshes progress on open

**Skip logging**: After seeing your answer, click the 🚫 button to skip recording that attempt. Useful when you guessed correctly through elimination but don't actually know the word — keeps your stats accurate.

---

## 🗄️ Data Storage

### Hybrid: localStorage + Supabase

| Storage | Key/Table | Data |
|---------|-----------|------|
| localStorage | `langseed_progress` | concepts with modality scores |
| localStorage | `langseed_settings` | user preferences |
| localStorage | `langseed_progress_cache` | cached progress snapshots for charts |
| localStorage | `langseed_vocab_prefs` | vocabulary page preferences (sort, filters, toggles) |
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

### ⛔ Data Preservation (CRITICAL FOR DEVELOPERS)

> **On Feb 2 2026, a careless schema migration DELETED HUNDREDS OF USER QUIZ ATTEMPTS.**
> The migration renamed `concept_id` → `vocabulary_id` and added a FK to a new table with different UUIDs.
> All historical quiz data was orphaned and lost. **This must never happen again.**

**Rules for ANY schema migration:**

1. **NEVER** add foreign keys with `ON DELETE CASCADE` to columns with existing data pointing to old UUIDs
2. **ALWAYS** back up production data before ANY migration
3. **ALWAYS** create mapping tables when changing ID references
4. **ALWAYS** test migrations on a copy of production data first
5. **ALWAYS** get explicit user approval before running migrations that touch existing data

**Tables with user data (HANDLE WITH EXTREME CARE):**
- `user_progress` - User's learning state
- `quiz_attempts` - All quiz history and ML training data
- `user_settings` - User preferences

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
- **Invite-only**: Contact the repo owner to request access
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

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials (get from Supabase Dashboard > Settings > API):
```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_DEV_USER_EMAIL=your-email@example.com   # Optional: auto-login in dev
VITE_DEV_USER_PASSWORD=your-password-here    # Optional: auto-login in dev
```

### 3. Run Locally

```bash
npm run dev
```

Open http://localhost:5173/

### Dev Mode Toggle

When running locally with `VITE_DEV_USER_EMAIL` and `VITE_DEV_USER_PASSWORD` configured, a **mode indicator** appears at the top center of the screen.

Single-click to instantly switch between:
- **Guest** (purple) - Local-only storage for testing
- **Dev** (yellow) - Full account with cloud sync

The page reloads automatically to ensure a clean state switch.

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
    └── hsk1_vocabulary.json # HSK1 vocab (247 items: 194 HSK words + 53 compound phrases)
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
| 252 rows × N users | 252 vocab + 252 × N user_progress |
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
- [x] **Vocabulary auto-sync** (new words added, deleted words removed, meanings updated from JSON)
- [x] **Dev mode toggle** (quick switch between guest/dev user on localhost)
- [x] **Compound phrases** (53 common phrases with negative chapter tags for level indication)
- [x] **Quick vocab toggle in Quiz/Study** (mark words as known/unknown without leaving the page)
- [x] **Smart quiz settings** (distractor difficulty + question selection strategy toggles)
- [x] **Skip logging option** ("Don't log" button to exclude guesses from stats)
- [x] Quick add/remove vocab from Quiz (suggest words, easy toggle without leaving quiz)
- [x] Historical progress timeline (bar chart showing daily quiz activity and accuracy)
- [~] **ML-based adaptive difficulty** (analysis done, need more incorrect data for calibration)
- [ ] ElevenLabs premium TTS integration
- [ ] Tone-specific practice mode

---

## 🧪 Smart Quiz System (Planned)

### Overview

The quiz system will be enhanced with smarter distractor selection and question picking to optimize learning. Currently implemented as manual toggles; future ML model will auto-tune.

### Phase 1: Manual Controls (Current)

#### Question Selection

Controls which concepts get quizzed:

| Strategy | Description | When to Use |
|----------|-------------|-------------|
| **Random** | Current default behavior | Variety, exploration |
| **Weak spots** | Lowest knowledge in task modalities | Focus on weaknesses |
| **Least tested** | Fewest total attempts | Ensure coverage |
| **Due for review** | Longest since last attempt | Spaced repetition |

#### Option Selection

Controls how confusing the wrong answer options are:

| Setting | Behavior | Use Case |
|---------|----------|----------|
| **Easy** | Different lengths, different POS, far chapters | Building confidence |
| **Hard** | Similar lengths, same POS, nearby chapters, similar pinyin | Challenge mode |

**Heuristics used:**
- **Length similarity**: Character count of word
- **Part of speech**: Same grammatical category = more confusing
- **Chapter proximity**: Nearby chapters = similar difficulty level
- **Pinyin similarity**: Same tone, similar initial/final (hard mode only)

### Phase 2: ML-Based Calibration (In Progress)

**Status**: Initial analysis complete with 151 quiz attempts. Scripts in `analysis/` folder.

#### Current Results (151 attempts, 91% correct)

| Model | Accuracy | F1 | ROC-AUC |
|-------|----------|-----|---------|
| Logistic Regression | 0.68 | 0.80 | 0.45 |
| **Random Forest** | **0.90** | **0.95** | **0.70** |

**Top predictive features** (Random Forest importance):
1. `answer_modality` (12.5%) - what type of answer was shown
2. `distractor_avg` (11.6%) - avg knowledge of wrong options  
3. `knowledge_gap` (11.3%) - difference between target and distractors

**Challenge**: Severe class imbalance (91% correct) makes it hard to predict failures. ROC-AUC of 0.70 shows some signal exists.

#### Running the Analysis

```bash
# Create conda env (one-time setup)
conda create -n mandarin-ml python=3.11 -y
conda activate mandarin-ml
pip install supabase scikit-learn numpy

# Refresh data from Supabase (requires SUPABASE_SERVICE_ROLE_KEY in .env)
cd /path/to/avi-mandarin
python -c "
import json
from supabase import create_client
env = {}
with open('.env') as f:
    for line in f:
        if '=' in line and not line.startswith('#'):
            k, v = line.strip().split('=', 1)
            env[k] = v
supabase = create_client(env['VITE_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY'])
data = supabase.table('quiz_attempts').select('correct,question_modality,answer_modality,context').not_.is_('context', 'null').execute()
with open('analysis/quiz_attempts_data.json', 'w') as f:
    json.dump(data.data, f, indent=2)
print(f'Exported {len(data.data)} records')
"

# Run ML analysis
python analysis/quiz_ml_model.py
```

#### Next Steps

1. **Collect more data** - especially incorrect answers for better class balance
2. **Try SMOTE** - oversample minority class to improve recall on failures
3. **Integrate predictions** - use model's `predictedCorrect` to tune question difficulty

#### Rich context logging (implemented)

Each quiz attempt logs a JSON snapshot of:
- Concept knowledge (question modality, answer modality, overall)
- User's average modality scores
- Distractor knowledge scores
- Time since last attempt

### Data Collection Schema

Quiz attempts include a `context` JSONB column for flexible feature logging:

```typescript
interface QuizAttemptContext {
  // Concept knowledge at time of question
  conceptKnowledge: {
    questionModality: number;  // 0-100
    answerModality: number;    // 0-100
    overall: number;           // weighted average
  };
  
  // User's average modality scores across all concepts
  userAverages: {
    character: number;
    pinyin: number;
    meaning: number;
    audio: number;
  };
  
  // Distractor knowledge scores
  distractors: Array<{
    id: string;
    knowledge: number;  // overall knowledge
  }>;
  
  // Quiz settings at time of question
  settings: {
    questionSelection: 'random' | 'weak' | 'leastTested' | 'dueReview';
    optionSelection: 'easy' | 'hard';
  };
  
  // Timing
  daysSinceLastAttempt: number | null;
}
```

This flexible JSON approach allows adding/removing features without schema migrations.

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

## 📚 Adding New Vocabulary Sources (e.g., HSK4)

The `content/` folder contains scripts to extract vocabulary from Chinese textbook PDFs. This was used to create the HSK1 vocabulary and can be adapted for other levels (HSK4, HSK5, etc.).

### Extraction Pipeline Overview

```
PDF → OCR → Analyze Structure → Correct with Claude → Extract to JSON → Import to App
```

### Scripts in `content/hsk1/`

| Script | Purpose | Requirements |
|--------|---------|--------------|
| `ocr_extract.py` | Extract text from scanned PDF using macOS Vision OCR | macOS, PyMuPDF |
| `analyze_structure.py` | Use Claude to analyze chapter structure | Anthropic API key |
| `correct_chapters.py` | Use Claude to fix OCR errors (parallel processing) | Anthropic API key |
| `extract_vocabulary.py` | Parse corrected chapters into JSON | None |

### Step-by-Step: Adding HSK4 (or any textbook)

#### 1. Set Up the Folder

```bash
# Create folder for new vocabulary source
mkdir content/hsk4
cd content/hsk4

# Copy the extraction scripts
cp ../hsk1/ocr_extract.py .
cp ../hsk1/analyze_structure.py .
cp ../hsk1/correct_chapters.py .
cp ../hsk1/extract_vocabulary.py .
```

#### 2. Add Your PDF

Place your textbook PDF in the folder (e.g., `HSK4_textbook.pdf`).

#### 3. Modify Scripts for Your PDF

Edit `ocr_extract.py` to point to your PDF:
```python
# Change this line to match your PDF filename
pdf_path = script_dir / "HSK4_textbook.pdf"
output_path = script_dir / "hsk4_ocr.txt"
```

Similarly update the other scripts to use `hsk4` instead of `hsk1` in filenames.

#### 4. Set Up Environment

```bash
# From repo root, ensure you have the Anthropic API key
# Add to .env file:
# ANTHROPIC_API_KEY=your-key-here

# Install Python dependencies
pip install PyMuPDF anthropic
```

#### 5. Run the Extraction Pipeline

```bash
cd content/hsk4

# Step 1: OCR the PDF (macOS only - uses Vision framework)
python ocr_extract.py
# Output: hsk4_ocr.txt

# Step 2: Analyze structure (uses Claude)
python analyze_structure.py
# Output: chapter_structure_analysis.txt

# Step 3: Correct chapters (uses Claude in parallel)
python correct_chapters.py
# Output: corrected_chapters/*.txt + hsk4_corrected.txt

# Step 4: Extract vocabulary to JSON
python extract_vocabulary.py
# Output: hsk4_vocabulary.json
```

#### 6. Adapt for Different Textbook Formats

The scripts are designed for HSK Standard Course textbooks. For other formats, you may need to modify:

**In `correct_chapters.py`:**
- Update the prompt to describe your textbook's structure
- Modify section headers (热身, 课文, 生词, etc.) to match your book
- Adjust vocabulary formatting rules

**In `extract_vocabulary.py`:**
- Modify `parse_vocab_line()` regex patterns to match your format
- Update `POS_MAPPING` if your book uses different part-of-speech abbreviations
- Change chapter count in `extract_all_chapters()` loop

**Common vocabulary line formats:**
```
# Pipe-separated (preferred):
1. 汉字 | pinyin | pos | meaning

# Space-separated:
1. 汉字 pinyin pos. meaning
```

#### 7. Import to App

Once you have the JSON vocabulary file:

```bash
# Copy to app data folder
cp hsk4_vocabulary.json ../../src/data/

# Update vocabularyStore.ts to import the new vocabulary
# (see existing hsk1 import pattern)
```

### Non-macOS Users

The `ocr_extract.py` script uses macOS Vision framework for OCR. For other platforms:

1. **Use Google Cloud Vision API** - Modify to use `google-cloud-vision` package
2. **Use Tesseract** - Use `pytesseract` with Chinese language pack
3. **Use existing text** - If your PDF has embedded text (not scanned), PyMuPDF can extract it directly

### Tips for Good Extraction

- **Clean PDFs work best** - Scanned books with clear text yield better OCR
- **Review corrected chapters** - Claude is good but not perfect; spot-check the output
- **Pinyin is tricky** - OCR often mangles tone marks; the Claude correction step helps
- **Deduplicate** - The extract script skips duplicate words; first occurrence wins

### Files Generated

```
content/hsk4/
├── HSK4_textbook.pdf          # Your source PDF
├── hsk4_ocr.txt               # Raw OCR output
├── chapter_structure_analysis.txt  # Claude's analysis of structure
├── corrected_chapters/        # Individual corrected chapters
│   ├── chapter_01.txt
│   ├── chapter_02.txt
│   └── ...
├── hsk4_corrected.txt         # All chapters combined
└── hsk4_vocabulary.json       # Final JSON for app import
```

---

## 📄 License

Private use only.
