#!/usr/bin/env python3
"""
Extract 'atom' vocabulary from HSK1 chapters.

Atoms are simple terms that appear in the textbook but weren't in "New Words":
- Numbers (一, 二, 三... 零-百)
- Single characters from stroke/character sections
- Base characters that form compounds

These are mutually exclusive from 'hsk' (New Words) vocabulary.
"""

import os
import sys
import json
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Any

# Load .env from repo root
def load_env():
    # Try multiple locations for .env
    possible_paths = [
        Path(__file__).parent.parent.parent / ".env",  # repo root
        Path(__file__).parent.parent / ".env",
        Path(__file__).parent / ".env",
    ]
    for env_path in possible_paths:
        if env_path.exists():
            with open(env_path) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        os.environ[key] = value
            return
    print("Warning: No .env file found")

load_env()

try:
    import anthropic
except ImportError:
    print("Installing anthropic package...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "anthropic", "-q"])
    import anthropic


def load_existing_hsk_words() -> set:
    """Load existing HSK vocabulary words to avoid duplicates."""
    script_dir = Path(__file__).parent
    vocab_path = script_dir / "hsk1_vocabulary.json"
    
    if not vocab_path.exists():
        print(f"Warning: {vocab_path} not found. Run extract_vocabulary.py first.")
        return set()
    
    with open(vocab_path, 'r', encoding='utf-8') as f:
        vocab = json.load(f)
    
    return {entry['word'] for entry in vocab}


def read_chapter(chapter_num: int) -> str:
    """Read a corrected chapter file."""
    script_dir = Path(__file__).parent
    chapter_path = script_dir / "corrected_chapters" / f"chapter_{chapter_num:02d}.txt"
    
    if not chapter_path.exists():
        return ""
    
    with open(chapter_path, 'r', encoding='utf-8') as f:
        return f.read()


def extract_atoms_with_claude(chapter_num: int, chapter_content: str, existing_hsk_words: set) -> List[Dict[str, Any]]:
    """Use Claude to extract atom vocabulary from a chapter."""
    
    if not chapter_content.strip():
        return []
    
    client = anthropic.Anthropic()
    
    existing_list = ", ".join(sorted(existing_hsk_words)[:100])  # Show first 100 for context
    
    prompt = f"""Analyze Chapter {chapter_num} of an HSK1 Chinese textbook and extract "atom" vocabulary.

## WHAT ARE ATOMS?

Atoms are SIMPLE terms that appear in the chapter but are NOT in the official "New Words" (生词) section:

1. **Numbers** - digits and number words appearing in examples, exercises, or number tables
   - Single digits: 零, 一, 二, 三, 四, 五, 六, 七, 八, 九
   - Ten: 十
   - Hundred: 百
   
2. **Single characters from 汉字 (Characters) sections** - characters shown with stroke order
   - Characters taught for writing practice that aren't in New Words
   
3. **Base characters** - simple characters used to form compounds but not listed separately
   - E.g., if "美国" is a New Word but "美" appears independently, include "美"

## WHAT TO EXCLUDE:

- Words already in the official "New Words" list (these are marked as 'hsk' tag)
- Grammar patterns or sentence structures
- Names of people (李月, 王方, etc.)

## EXISTING HSK WORDS (DO NOT INCLUDE THESE):
{existing_list}... (showing first 100)

## CHAPTER {chapter_num} CONTENT:
---
{chapter_content}
---

## OUTPUT FORMAT:

Return a JSON array of atom vocabulary. Each entry should have:
- word: Chinese character(s)
- pinyin: with tone marks (ā á ǎ à, etc.)
- part_of_speech: one of [numeral, noun, verb, adjective, adverb, pronoun, particle, other]
- meaning: English translation
- context: Brief note on where it appears in the chapter (e.g., "number table", "character stroke section")

Example output:
```json
[
  {{"word": "四", "pinyin": "sì", "part_of_speech": "numeral", "meaning": "four", "context": "number table in notes section"}},
  {{"word": "五", "pinyin": "wǔ", "part_of_speech": "numeral", "meaning": "five", "context": "number table in notes section"}}
]
```

Return ONLY the JSON array, no other text. If no atoms are found, return an empty array: []"""

    try:
        response = client.messages.create(
            model="claude-opus-4-20260201",
            max_tokens=4000,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        
        result_text = response.content[0].text.strip()
        
        # Extract JSON from response (handle markdown code blocks)
        if "```json" in result_text:
            result_text = result_text.split("```json")[1].split("```")[0].strip()
        elif "```" in result_text:
            result_text = result_text.split("```")[1].split("```")[0].strip()
        
        atoms = json.loads(result_text)
        
        # Add chapter and tag info
        for atom in atoms:
            atom['chapter'] = chapter_num
            atom['source'] = 'hsk1'
            atom['tag'] = 'atom'
            # Remove context field before final output (just for extraction guidance)
            if 'context' in atom:
                del atom['context']
        
        return atoms
        
    except Exception as e:
        print(f"  Error processing chapter {chapter_num}: {e}")
        return []


def process_all_chapters(max_workers: int = 5) -> List[Dict[str, Any]]:
    """Process all chapters in parallel to extract atoms."""
    
    existing_hsk_words = load_existing_hsk_words()
    print(f"Loaded {len(existing_hsk_words)} existing HSK words to exclude")
    
    all_atoms = []
    seen_words = set(existing_hsk_words)  # Start with HSK words to prevent duplicates
    
    # Read all chapters
    chapters = {}
    for i in range(1, 16):
        content = read_chapter(i)
        if content:
            chapters[i] = content
    
    print(f"\nProcessing {len(chapters)} chapters with {max_workers} parallel workers...")
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_chapter = {
            executor.submit(extract_atoms_with_claude, num, content, existing_hsk_words): num
            for num, content in chapters.items()
        }
        
        chapter_results = {}
        for future in as_completed(future_to_chapter):
            chapter_num = future_to_chapter[future]
            try:
                atoms = future.result()
                chapter_results[chapter_num] = atoms
                print(f"  ✓ Chapter {chapter_num}: found {len(atoms)} atoms")
            except Exception as e:
                print(f"  ✗ Chapter {chapter_num} failed: {e}")
                chapter_results[chapter_num] = []
    
    # Combine results in chapter order, deduplicating
    for chapter_num in sorted(chapter_results.keys()):
        for atom in chapter_results[chapter_num]:
            if atom['word'] not in seen_words:
                all_atoms.append(atom)
                seen_words.add(atom['word'])
            else:
                print(f"    Skipping duplicate: {atom['word']} (ch.{chapter_num})")
    
    return all_atoms


def main():
    script_dir = Path(__file__).parent
    output_path = script_dir / "hsk1_atoms.json"
    
    print("=" * 60)
    print("EXTRACTING ATOM VOCABULARY FROM HSK1 CHAPTERS")
    print("=" * 60)
    
    # Check for corrected chapters
    chapters_dir = script_dir / "corrected_chapters"
    if not chapters_dir.exists():
        print(f"Error: Corrected chapters not found at {chapters_dir}")
        print("Run correct_chapters.py first.")
        return
    
    atoms = process_all_chapters(max_workers=5)
    
    # Sort by chapter, then by word
    atoms.sort(key=lambda x: (x['chapter'], x['word']))
    
    # Summary by chapter
    print("\n" + "=" * 60)
    print("EXTRACTION SUMMARY")
    print("=" * 60)
    
    by_chapter = {}
    for atom in atoms:
        ch = atom['chapter']
        by_chapter[ch] = by_chapter.get(ch, 0) + 1
    
    for ch in sorted(by_chapter.keys()):
        print(f"  Chapter {ch}: {by_chapter[ch]} atoms")
    
    print(f"\nTotal unique atoms: {len(atoms)}")
    
    # Save to JSON
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(atoms, f, ensure_ascii=False, indent=2)
    
    print(f"\nSaved to: {output_path}")
    
    # Print all atoms for review
    print("\n" + "=" * 60)
    print("EXTRACTED ATOMS (for review):")
    print("=" * 60)
    
    current_chapter = None
    for atom in atoms:
        if atom['chapter'] != current_chapter:
            current_chapter = atom['chapter']
            print(f"\n--- Chapter {current_chapter} ---")
        print(f"  {atom['word']} ({atom['pinyin']}) - {atom['part_of_speech']} - {atom['meaning']}")


if __name__ == "__main__":
    main()
