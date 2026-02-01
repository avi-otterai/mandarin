#!/usr/bin/env python3
"""
Correct HSK1 chapters using Claude, processing in parallel.
Uses the structure analysis to guide corrections.
"""

import os
import sys
import re
import json
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Tuple

# Load .env from repo root
def load_env():
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key] = value

load_env()

try:
    import anthropic
except ImportError:
    print("Installing anthropic package...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "anthropic", "-q"])
    import anthropic


def read_structure_analysis() -> str:
    """Read the structure analysis for context."""
    script_dir = Path(__file__).parent
    analysis_path = script_dir / "chapter_structure_analysis.txt"
    if analysis_path.exists():
        with open(analysis_path, 'r', encoding='utf-8') as f:
            return f.read()
    return ""


def extract_chapters_from_ocr() -> Dict[int, str]:
    """Extract individual chapters from the OCR file."""
    script_dir = Path(__file__).parent
    ocr_path = script_dir / "hsk1_ocr.txt"
    
    with open(ocr_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Split by page markers
    pages = re.split(r'={60,}\n## PAGE \d+\n={60,}', content)
    if pages and pages[0].startswith('#'):
        pages = pages[1:]
    
    # Group pages into chapters based on audio markers (01-X, 02-X, etc.)
    chapters = {}
    current_lesson = 0
    current_content = []
    
    for page_text in pages:
        # Find lesson number from audio markers like "01-1", "02-3"
        match = re.search(r'(\d{2})-\d+', page_text)
        if match:
            lesson_num = int(match.group(1))
            if lesson_num <= 15 and lesson_num != current_lesson:
                if current_content and current_lesson > 0:
                    chapters[current_lesson] = '\n\n'.join(current_content)
                current_lesson = lesson_num
                current_content = [page_text.strip()]
            else:
                if page_text.strip():
                    current_content.append(page_text.strip())
        else:
            if page_text.strip():
                current_content.append(page_text.strip())
    
    if current_content and current_lesson > 0:
        chapters[current_lesson] = '\n\n'.join(current_content)
    
    return chapters


def correct_chapter_with_claude(chapter_num: int, chapter_content: str, structure_context: str) -> Tuple[int, str]:
    """Use Claude to correct a single chapter."""
    
    client = anthropic.Anthropic()
    
    chinese_nums = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十',
                   '十一', '十二', '十三', '十四', '十五']
    
    prompt = f"""You are correcting Chapter {chapter_num} (第{chinese_nums[chapter_num]}课) of an HSK 1 Chinese textbook.

The content was extracted via OCR and contains errors that need fixing.

## STRUCTURE CONTEXT (from analysis of full book):
{structure_context[:4000]}

## YOUR TASK:
Correct the OCR errors and reformat this chapter into clean, well-structured text.

### CORRECTION RULES:

**Pinyin fixes:**
- Add proper tone marks: ā á ǎ à, ē é ě è, ī í ǐ ì, ō ó ǒ ò, ū ú ǔ ù, ǖ ǘ ǚ ǜ
- Common OCR errors: "hdo" → "hǎo", "Nihdo" → "Nǐ hǎo", "bi shi" → "bú shì"
- Use standard pinyin with tone marks, not numbers

**English fixes:**
- "Hcllo" → "Hello", "go0d" → "good", "pltral" → "plural"
- Fix spacing and punctuation

**Formatting:**
- Use clear section headers: 课文 Text, 生词 New Words, 拼音 Pinyin, etc.
- Format vocabulary as: 汉字 | pinyin | part of speech | English
- Keep audio markers (e.g., "01-1") for reference
- Use proper Chinese punctuation (：！？)

**Structure each chapter with these sections (if present in original):**
1. 热身 Warm-up
2. 课文 Text (dialogues)
3. 生词 New Words (vocabulary)
4. 注释 Notes (grammar)
5. 练习 Exercises  
6. 拼音 Pinyin
7. 汉字 Characters
8. 运用 Application

## CHAPTER {chapter_num} RAW OCR CONTENT:
---
{chapter_content}
---

Please output the CORRECTED chapter in clean, readable format. 
Preserve all educational content but fix OCR errors and improve formatting.
Start directly with the chapter header."""

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=8000,
        messages=[
            {"role": "user", "content": prompt}
        ]
    )
    
    return chapter_num, response.content[0].text


def process_all_chapters_parallel(chapters: Dict[int, str], structure_context: str, max_workers: int = 5):
    """Process all chapters in parallel."""
    script_dir = Path(__file__).parent
    output_dir = script_dir / "corrected_chapters"
    output_dir.mkdir(exist_ok=True)
    
    results = {}
    
    print(f"\nProcessing {len(chapters)} chapters with {max_workers} parallel workers...")
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit all chapter correction tasks
        future_to_chapter = {
            executor.submit(correct_chapter_with_claude, num, content, structure_context): num
            for num, content in chapters.items()
        }
        
        # Collect results as they complete
        for future in as_completed(future_to_chapter):
            chapter_num = future_to_chapter[future]
            try:
                num, corrected_content = future.result()
                results[num] = corrected_content
                
                # Save immediately
                output_path = output_dir / f"chapter_{num:02d}.txt"
                with open(output_path, 'w', encoding='utf-8') as f:
                    f.write(corrected_content)
                
                print(f"  ✓ Chapter {num} completed ({len(corrected_content)} chars) → {output_path.name}")
                
            except Exception as e:
                print(f"  ✗ Chapter {chapter_num} failed: {e}")
    
    return results


def combine_all_chapters(output_dir: Path):
    """Combine all corrected chapters into one file."""
    combined_path = output_dir.parent / "hsk1_corrected.txt"
    
    all_content = ["# HSK 1 - Chapters 1-15 (Corrected)\n"]
    all_content.append("# OCR errors fixed, formatting standardized\n\n")
    
    for i in range(1, 16):
        chapter_path = output_dir / f"chapter_{i:02d}.txt"
        if chapter_path.exists():
            with open(chapter_path, 'r', encoding='utf-8') as f:
                content = f.read()
            all_content.append("\n" + "=" * 70 + "\n")
            all_content.append(content)
            all_content.append("\n")
    
    with open(combined_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(all_content))
    
    print(f"\nCombined all chapters → {combined_path}")
    return combined_path


def main():
    script_dir = Path(__file__).parent
    
    print("Reading structure analysis...")
    structure_context = read_structure_analysis()
    if not structure_context:
        print("Warning: No structure analysis found. Run analyze_structure.py first.")
        structure_context = "Standard HSK textbook structure with sections: 课文, 生词, 拼音, 汉字, 练习"
    
    print("Extracting chapters from OCR output...")
    chapters = extract_chapters_from_ocr()
    print(f"Found {len(chapters)} chapters")
    
    for num in sorted(chapters.keys()):
        print(f"  - Chapter {num}: {len(chapters[num])} chars")
    
    # Process all chapters in parallel
    results = process_all_chapters_parallel(chapters, structure_context, max_workers=5)
    
    # Combine into single file
    output_dir = script_dir / "corrected_chapters"
    combine_all_chapters(output_dir)
    
    print("\n" + "=" * 60)
    print("CORRECTION COMPLETE")
    print("=" * 60)
    print(f"Individual chapters: {output_dir}/")
    print(f"Combined file: {script_dir}/hsk1_corrected.txt")


if __name__ == "__main__":
    main()
