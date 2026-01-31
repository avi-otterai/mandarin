# LangSeed JS - Chinese Learning App

A React/TypeScript webapp for learning Mandarin Chinese using spaced repetition.

## Data Storage

### Current: localStorage (Browser)
All your progress is saved **locally in your browser's localStorage**:
- **Key**: `langseed_progress`
- **Data stored**:
  - `concepts`: Your vocabulary list with known/unknown status
  - `srsRecords`: SRS progress for each word (tier, next review time, streak, lapses)
  - `lastUpdated`: Timestamp of last save

**Location**: This data persists in your browser. Clearing browser data will reset progress.

**To export your data**: Open browser DevTools → Application → localStorage → Copy `langseed_progress`

### Planned: Supabase (Cloud)
Future update will add Supabase for:
- Cross-device sync
- User accounts
- Cloud backup

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

## Features

### Vocabulary Tab
- **Table view** with sortable columns: Character, Pinyin, Meaning, Type, Chapter, Known
- **Sticky header** - header stays visible while scrolling
- **Filters**:
  - By chapter (Ch. 1-15)
  - By status (All / Known only / Learning only)
- **Mass actions**:
  - "Mark all as known" - for current filtered view
  - "Reset all" - unmark all as learning
- Click any character to see details + SRS progress

### Revise Tab (SRS)
- Spaced repetition practice
- Question types:
  - **Pinyin Quiz**: Type the pinyin for a character
  - **Multiple Choice**: Pick the correct character for a meaning
  - **Yes/No**: Confirm if a statement is correct
- 8-tier SRS system with increasing intervals:
  | Tier | Interval |
  |------|----------|
  | 0 | 10 min |
  | 1 | 1 hour |
  | 2 | 8 hours |
  | 3 | 1 day |
  | 4 | 3 days |
  | 5 | 7 days |
  | 6 | 30 days |
  | 7 | Graduated ✓ |

---

## Tech Stack
- React 19 + TypeScript
- Vite (build tool)
- Tailwind CSS v4 + daisyUI v5
- localStorage (current)
- Supabase (planned)

---

## Running Locally

```bash
cd langseed-js
npm install
npm run dev
```

Open http://localhost:5173/

---

## Deploying to Netlify

```bash
npm run build
# Deploy 'dist' folder to Netlify
```

Or connect GitHub repo with:
- Build command: `npm run build`
- Publish directory: `dist`

---

## Project Structure

```
langseed-js/
├── src/
│   ├── components/
│   │   ├── Navbar.tsx        # Bottom navigation
│   │   └── VocabCard.tsx     # Word detail modal
│   ├── pages/
│   │   ├── VocabularyPage.tsx # Table + filters
│   │   └── RevisePage.tsx     # SRS practice
│   ├── stores/
│   │   └── vocabularyStore.ts # State + localStorage
│   ├── types/
│   │   └── vocabulary.ts      # TypeScript types
│   ├── utils/
│   │   ├── srs.ts            # SRS algorithm
│   │   └── pinyin.ts         # Pinyin matching
│   └── data/
│       └── hsk1_vocabulary.json
├── index.html
├── package.json
└── README.md
```

---

## TODO / Roadmap

- [x] Vocabulary table with sorting
- [x] Chapter filtering
- [x] Mass select/unselect
- [x] Sticky table header
- [x] SRS practice (3 question types)
- [x] localStorage persistence
- [ ] Add Supabase for cloud persistence
- [ ] Add audio/TTS for pronunciation
- [ ] Tone-specific practice mode
- [ ] Import custom vocabulary lists
- [ ] Progress stats / charts

---

## Data

HSK 1 vocabulary is stored in `src/data/hsk1_vocabulary.json` with ~150 words across 15 chapters.
