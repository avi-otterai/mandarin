#!/usr/bin/env python3
"""
Structure the OCR-extracted HSK1 content into proper chapters.
Detects lesson boundaries from audio markers (01-X, 02-X, etc.)
"""

import re
from pathlib import Path

def parse_ocr_output(input_path):
    """Parse the OCR output and split into pages."""
    with open(input_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Split by page markers
    pages = re.split(r'={60,}\n## PAGE \d+\n={60,}', content)
    
    # Remove header
    if pages and pages[0].startswith('#'):
        pages = pages[1:]
    
    return pages

def detect_lesson_start(text):
    """Detect if this page starts a new lesson based on markers."""
    # Look for lesson audio markers at the start like "01-1", "02-1" etc.
    # These indicate the first audio track of a lesson
    patterns = [
        r'^[\s\S]{0,200}?(\d{2})-1\b',  # XX-1 near the start
        r'课文\s*\nText',  # "课文 Text" header
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return True
    return False

def extract_lesson_number(text):
    """Extract the lesson number from audio markers."""
    match = re.search(r'(\d{2})-\d+', text)
    if match:
        return int(match.group(1))
    return None

def structure_into_chapters(pages):
    """Group pages into chapters/lessons."""
    chapters = {}
    current_lesson = 0
    current_content = []
    
    for i, page_text in enumerate(pages):
        lesson_num = extract_lesson_number(page_text)
        
        # Only accept lessons 1-15 (ignore OCR artifacts like "39")
        if lesson_num and lesson_num <= 15 and lesson_num != current_lesson:
            # Save previous lesson
            if current_content and current_lesson > 0:
                chapters[current_lesson] = '\n\n'.join(current_content)
            
            # Start new lesson
            current_lesson = lesson_num
            current_content = [page_text.strip()]
        else:
            # Continue current lesson
            if page_text.strip():
                current_content.append(page_text.strip())
    
    # Save last lesson
    if current_content and current_lesson > 0:
        chapters[current_lesson] = '\n\n'.join(current_content)
    
    return chapters

def format_output(chapters):
    """Format chapters into structured output."""
    output = []
    output.append("# HSK 1 - Chapters 1-15")
    output.append("# Extracted from HSK1_SC_L1-L15.pdf via OCR")
    output.append("# Note: Review for OCR errors, especially in pinyin tones")
    output.append("")
    
    for lesson_num in sorted(chapters.keys()):
        content = chapters[lesson_num]
        chinese_num = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十',
                      '十一', '十二', '十三', '十四', '十五'][lesson_num]
        
        output.append("")
        output.append("=" * 70)
        output.append(f"## 第{chinese_num}课 - Lesson {lesson_num}")
        output.append("=" * 70)
        output.append("")
        output.append(content)
        output.append("")
    
    return '\n'.join(output)

def main():
    script_dir = Path(__file__).parent
    input_path = script_dir / "hsk1_ocr.txt"
    output_path = script_dir / "hsk1.txt"
    
    if not input_path.exists():
        print(f"Error: OCR output not found at {input_path}")
        print("Run ocr_extract.py first.")
        return
    
    print(f"Reading OCR output from: {input_path}")
    pages = parse_ocr_output(input_path)
    print(f"Found {len(pages)} pages")
    
    print("Structuring into chapters...")
    chapters = structure_into_chapters(pages)
    
    print(f"Found {len(chapters)} lessons:")
    for num in sorted(chapters.keys()):
        print(f"  - Lesson {num}: {len(chapters[num])} chars")
    
    formatted = format_output(chapters)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(formatted)
    
    print(f"\nStructured content saved to: {output_path}")
    print(f"Total: {len(formatted)} characters")

if __name__ == "__main__":
    main()
