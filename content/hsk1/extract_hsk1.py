#!/usr/bin/env python3
"""
Extract text from HSK1 PDF and structure it into chapters.
"""

import fitz  # PyMuPDF
import re
import sys
from pathlib import Path

def extract_pdf_text(pdf_path):
    """Extract all text from PDF."""
    doc = fitz.open(pdf_path)
    full_text = []
    
    for page_num, page in enumerate(doc):
        text = page.get_text()
        full_text.append(f"--- PAGE {page_num + 1} ---\n{text}")
    
    doc.close()
    return "\n".join(full_text)

def structure_into_chapters(text):
    """
    Try to structure the text into chapters.
    HSK textbooks typically have lessons marked as 第X课 or Lesson X.
    """
    # Common patterns for lesson/chapter markers in Chinese textbooks
    patterns = [
        r'第\s*(\d+)\s*课',           # 第1课, 第 1 课
        r'第\s*([一二三四五六七八九十]+)\s*课',  # 第一课
        r'Lesson\s*(\d+)',            # Lesson 1
        r'L(\d+)',                    # L1
        r'Unit\s*(\d+)',              # Unit 1
    ]
    
    # Try to find chapter markers
    chapters = {}
    current_chapter = "Introduction"
    current_content = []
    
    lines = text.split('\n')
    
    for line in lines:
        found_chapter = False
        for pattern in patterns:
            match = re.search(pattern, line, re.IGNORECASE)
            if match:
                # Save previous chapter
                if current_content:
                    chapters[current_chapter] = '\n'.join(current_content)
                
                # Start new chapter
                chapter_num = match.group(1)
                # Convert Chinese numbers if needed
                chinese_nums = {'一': '1', '二': '2', '三': '3', '四': '4', '五': '5',
                              '六': '6', '七': '7', '八': '8', '九': '9', '十': '10',
                              '十一': '11', '十二': '12', '十三': '13', '十四': '14', '十五': '15'}
                chapter_num = chinese_nums.get(chapter_num, chapter_num)
                current_chapter = f"Chapter {chapter_num}"
                current_content = [line]
                found_chapter = True
                break
        
        if not found_chapter:
            current_content.append(line)
    
    # Save last chapter
    if current_content:
        chapters[current_chapter] = '\n'.join(current_content)
    
    return chapters

def format_output(chapters):
    """Format chapters into a structured text file."""
    output = []
    output.append("=" * 60)
    output.append("HSK 1 - Chapters 1-15")
    output.append("Extracted from HSK1_SC_L1-L15.pdf")
    output.append("=" * 60)
    output.append("")
    
    # Sort chapters properly
    def chapter_sort_key(ch):
        if ch == "Introduction":
            return 0
        match = re.search(r'(\d+)', ch)
        return int(match.group(1)) if match else 999
    
    for chapter in sorted(chapters.keys(), key=chapter_sort_key):
        content = chapters[chapter]
        output.append("")
        output.append("#" * 60)
        output.append(f"# {chapter}")
        output.append("#" * 60)
        output.append("")
        output.append(content)
        output.append("")
    
    return '\n'.join(output)

def main():
    script_dir = Path(__file__).parent
    pdf_path = script_dir / "HSK1_SC_L1-L15.pdf"
    output_path = script_dir / "hsk1.txt"
    
    if not pdf_path.exists():
        print(f"Error: PDF not found at {pdf_path}")
        sys.exit(1)
    
    print(f"Extracting text from: {pdf_path}")
    raw_text = extract_pdf_text(pdf_path)
    
    # First, let's save the raw text to see what we're working with
    raw_output = script_dir / "hsk1_raw.txt"
    with open(raw_output, 'w', encoding='utf-8') as f:
        f.write(raw_text)
    print(f"Raw text saved to: {raw_output}")
    
    print("Structuring into chapters...")
    chapters = structure_into_chapters(raw_text)
    
    print(f"Found {len(chapters)} sections:")
    for ch in chapters.keys():
        print(f"  - {ch}")
    
    formatted = format_output(chapters)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(formatted)
    
    print(f"\nStructured content saved to: {output_path}")
    print(f"Total characters: {len(formatted)}")

if __name__ == "__main__":
    main()
