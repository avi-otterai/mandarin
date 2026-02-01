#!/usr/bin/env python3
"""
Extract vocabulary from corrected HSK1 chapters and output as JSON for import.
"""

import re
import json
from pathlib import Path
from typing import List, Dict, Any, Optional

# Part of speech mapping from HSK format to LangSeed format
POS_MAPPING = {
    'pron.': 'pronoun',
    'pron': 'pronoun',
    'adj.': 'adjective',
    'adj': 'adjective',
    'v.': 'verb',
    'verb': 'verb',
    'n.': 'noun',
    'noun': 'noun',
    'adv.': 'adverb',
    'adv': 'adverb',
    'prep.': 'preposition',
    'prep': 'preposition',
    'conj.': 'conjunction',
    'conj': 'conjunction',
    'part.': 'particle',
    'particle': 'particle',
    'num.': 'numeral',
    'numeral': 'numeral',
    'm.': 'measure_word',
    'mw.': 'measure_word',
    'measure word': 'measure_word',
    'interj.': 'interjection',
    'interj': 'interjection',
}


def normalize_pos(pos: str) -> str:
    """Normalize part of speech to LangSeed format."""
    pos_lower = pos.lower().strip()
    return POS_MAPPING.get(pos_lower, 'other')


def parse_vocab_line(line: str) -> Optional[Dict[str, Any]]:
    """
    Parse a vocabulary line in various formats:
    Format 1: 1. 你 nǐ pron. (singular) you
    Format 2: 1. 谢谢 | xièxie | v. | to thank
    """
    
    # Try pipe-separated format first (more structured)
    # Pattern: number. chinese | pinyin | pos | meaning
    if '|' in line:
        parts = line.split('|')
        if len(parts) >= 3:
            # Extract number and chinese from first part
            first_match = re.match(r'^(\d+)\.\s*(.+)$', parts[0].strip())
            if first_match:
                num, chinese = first_match.groups()
                pinyin = parts[1].strip()
                
                # POS might be empty or in parts[2]
                if len(parts) >= 4:
                    pos = parts[2].strip() or 'other'
                    meaning = parts[3].strip()
                else:
                    pos = 'other'
                    meaning = parts[2].strip()
                
                if chinese and pinyin:
                    return {
                        'word': chinese.strip(),
                        'pinyin': pinyin.strip(),
                        'part_of_speech': normalize_pos(pos),
                        'meaning': meaning.strip()
                    }
    
    # Try space-separated format
    # Pattern: number. chinese pinyin pos. meaning
    pattern = r'^(\d+)\.\s*(\S+)\s+([a-zA-Züǖǘǚǜāáǎàēéěèīíǐìōóǒòūúǔù]+(?:\s+[a-zA-Züǖǘǚǜāáǎàēéěèīíǐìōóǒòūúǔù]+)?)\s+((?:pron|adj|v|n|adv|prep|conj|part|num|m|mw|interj)\.?)\s*(.+)$'
    
    match = re.match(pattern, line.strip(), re.IGNORECASE)
    if match:
        num, chinese, pinyin, pos, meaning = match.groups()
        return {
            'word': chinese.strip(),
            'pinyin': pinyin.strip(),
            'part_of_speech': normalize_pos(pos),
            'meaning': meaning.strip()
        }
    
    # Try alternative pattern without explicit POS (some phrases)
    pattern2 = r'^(\d+)\.\s*(\S+)\s+([a-zA-Züǖǘǚǜāáǎàēéěèīíǐìōóǒòūúǔù]+(?:\s+[a-zA-Züǖǘǚǜāáǎàēéěèīíǐìōóǒòūúǔù]+)?)\s+(.+)$'
    match = re.match(pattern2, line.strip(), re.IGNORECASE)
    if match:
        num, chinese, pinyin, meaning = match.groups()
        # Try to extract POS from meaning if present
        pos_match = re.match(r'^((?:pron|adj|v|n|adv|prep|conj|part|num|m|mw|interj)\.?)\s*(.+)$', meaning, re.IGNORECASE)
        if pos_match:
            pos, meaning = pos_match.groups()
        else:
            pos = 'other'
        
        return {
            'word': chinese.strip(),
            'pinyin': pinyin.strip(),
            'part_of_speech': normalize_pos(pos) if isinstance(pos, str) else 'other',
            'meaning': meaning.strip()
        }
    
    return None


def extract_vocab_from_chapter(chapter_path: Path, chapter_num: int) -> List[Dict[str, Any]]:
    """Extract all vocabulary entries from a chapter file."""
    vocab = []
    
    with open(chapter_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Find all lines that look like vocabulary entries (start with number followed by .)
    lines = content.split('\n')
    
    for line in lines:
        # Skip empty lines and headers
        if not line.strip() or line.startswith('#') or line.startswith('|'):
            continue
        
        # Check if this looks like a vocab line
        if re.match(r'^\d+\.\s+\S', line):
            entry = parse_vocab_line(line)
            if entry:
                entry['chapter'] = chapter_num
                entry['source'] = 'hsk1'
                vocab.append(entry)
    
    return vocab


def extract_all_chapters(chapters_dir: Path) -> List[Dict[str, Any]]:
    """Extract vocabulary from all chapter files."""
    all_vocab = []
    seen_words = set()  # Track duplicates
    
    for i in range(1, 16):
        chapter_path = chapters_dir / f'chapter_{i:02d}.txt'
        if chapter_path.exists():
            chapter_vocab = extract_vocab_from_chapter(chapter_path, i)
            
            # Add only unique words (first occurrence wins)
            for entry in chapter_vocab:
                if entry['word'] not in seen_words:
                    all_vocab.append(entry)
                    seen_words.add(entry['word'])
                else:
                    print(f"  Skipping duplicate: {entry['word']} (ch.{i})")
    
    return all_vocab


def main():
    script_dir = Path(__file__).parent
    chapters_dir = script_dir / 'corrected_chapters'
    output_path = script_dir / 'hsk1_vocabulary.json'
    
    if not chapters_dir.exists():
        print(f"Error: Corrected chapters not found at {chapters_dir}")
        print("Run correct_chapters.py first.")
        return
    
    print("Extracting vocabulary from corrected chapters...")
    vocab = extract_all_chapters(chapters_dir)
    
    # Group by chapter for summary
    by_chapter = {}
    for entry in vocab:
        ch = entry['chapter']
        by_chapter[ch] = by_chapter.get(ch, 0) + 1
    
    print(f"\nExtracted {len(vocab)} unique vocabulary entries:")
    for ch in sorted(by_chapter.keys()):
        print(f"  Chapter {ch}: {by_chapter[ch]} words")
    
    # Save as JSON
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(vocab, f, ensure_ascii=False, indent=2)
    
    print(f"\nSaved to: {output_path}")
    
    # Also print sample entries
    print("\nSample entries:")
    for entry in vocab[:5]:
        print(f"  {entry['word']} ({entry['pinyin']}) - {entry['part_of_speech']} - {entry['meaning']}")


if __name__ == "__main__":
    main()
