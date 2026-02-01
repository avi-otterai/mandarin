#!/usr/bin/env python3
"""
Extract text from scanned HSK1 PDF using macOS Vision OCR.
Extracts embedded images from PDF and runs OCR on them.
"""

import fitz  # PyMuPDF
import sys
from pathlib import Path

def ocr_image_macos(image_data):
    """Use macOS Vision framework for OCR."""
    import Vision
    import Quartz
    from Foundation import NSData
    
    # Create CGImage from data
    ns_data = NSData.dataWithBytes_length_(image_data, len(image_data))
    image_source = Quartz.CGImageSourceCreateWithData(ns_data, None)
    
    if not image_source:
        return ""
    
    cg_image = Quartz.CGImageSourceCreateImageAtIndex(image_source, 0, None)
    if not cg_image:
        return ""
    
    # Create request handler
    handler = Vision.VNImageRequestHandler.alloc().initWithCGImage_options_(cg_image, None)
    
    # Create text recognition request with Chinese support
    request = Vision.VNRecognizeTextRequest.alloc().init()
    request.setRecognitionLevel_(Vision.VNRequestTextRecognitionLevelAccurate)
    request.setRecognitionLanguages_(["zh-Hans", "zh-Hant", "en"])  # Simplified Chinese, Traditional, English
    request.setUsesLanguageCorrection_(True)
    
    # Perform OCR
    success, error = handler.performRequests_error_([request], None)
    
    if not success:
        return ""
    
    # Extract text
    results = request.results()
    text_lines = []
    
    for observation in results:
        candidates = observation.topCandidates_(1)
        if candidates:
            text_lines.append(candidates[0].string())
    
    return "\n".join(text_lines)

def extract_pdf_with_ocr(pdf_path, output_path):
    """Extract text from PDF by extracting embedded images and OCR-ing them."""
    doc = fitz.open(pdf_path)
    all_text = []
    
    print(f"Processing {len(doc)} pages...")
    
    for page_num in range(len(doc)):
        page = doc[page_num]
        images = page.get_images()
        
        print(f"  Page {page_num + 1}/{len(doc)}...", end=" ", flush=True)
        
        if not images:
            print("(no images)")
            continue
        
        page_text = []
        for img_info in images:
            xref = img_info[0]
            base_image = doc.extract_image(xref)
            img_data = base_image["image"]
            
            # OCR the extracted image
            text = ocr_image_macos(img_data)
            if text.strip():
                page_text.append(text)
        
        if page_text:
            combined_text = "\n".join(page_text)
            all_text.append(f"\n{'='*60}\n## PAGE {page_num + 1}\n{'='*60}\n")
            all_text.append(combined_text)
            print(f"({len(combined_text)} chars)")
        else:
            print("(empty)")
    
    doc.close()
    
    # Write output
    full_text = "\n".join(all_text)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("# HSK 1 - Chapters 1-15 (OCR Extracted)\n")
        f.write("# Note: Review for OCR errors, especially in pinyin tones\n\n")
        f.write(full_text)
    
    print(f"\nSaved to: {output_path}")
    print(f"Total: {len(full_text)} characters")

def main():
    script_dir = Path(__file__).parent
    pdf_path = script_dir / "HSK1_SC_L1-L15.pdf"
    output_path = script_dir / "hsk1_ocr.txt"
    
    if not pdf_path.exists():
        print(f"Error: PDF not found at {pdf_path}")
        sys.exit(1)
    
    extract_pdf_with_ocr(pdf_path, output_path)

if __name__ == "__main__":
    main()
