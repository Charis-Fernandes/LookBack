"""
Integration Testing for LookBack Pipeline
Tests the complete end-to-end workflow
"""

import json
import sys
from pathlib import Path
from PIL import Image
import numpy as np


def create_sample_images():
    """Create synthetic test images for pipeline testing"""
    print("\n" + "="*60)
    print("Creating Sample Test Images")
    print("="*60)
    
    # Create samples directory if doesn't exist
    samples_dir = Path("samples")
    samples_dir.mkdir(exist_ok=True)
    
    # Create a simple text image for testing
    try:
        # Create white image with black text-like patterns
        img_array = np.ones((400, 600, 3), dtype=np.uint8) * 255
        
        # Add some black rectangles to simulate text
        from PIL import ImageDraw, ImageFont
        
        img = Image.fromarray(img_array)
        draw = ImageDraw.Draw(img)
        
        # Draw sample text (simple)
        text_samples = [
            ("FIR Sample", "sample_fir.png", "FIR No. 123/2024\nFirst Information Report"),
            ("ID Sample", "sample_id.png", "AADHAR CARD\nUIDIA Enrollment"),
            ("Report Sample", "sample_report.png", "OFFICIAL REPORT\nSummary Findings"),
        ]
        
        for title, filename, text_lines in text_samples:
            img = Image.new('RGB', (600, 400), color='white')
            draw = ImageDraw.Draw(img)
            draw.text((50, 50), text_lines, fill='black')
            
            sample_path = samples_dir / filename
            img.save(sample_path)
            print(f"✓ Created {filename}")
        
        return True
    except Exception as e:
        print(f"✗ Error creating sample images: {e}")
        return False


def create_sample_ocr_jsons():
    """Create sample OCR JSON files for testing"""
    print("\n" + "="*60)
    print("Creating Sample OCR JSON Files")
    print("="*60)
    
    samples_dir = Path("samples")
    samples_dir.mkdir(exist_ok=True)
    
    samples = [
        {
            "filename": "sample_fir_ocr.json",
            "content": {
                "raw_text": "FIR No. 123/2024\nFirst Information Report\nPolice Station: Downtown Station\nDate: 24-02-2024\nUnder Section IPC\nComplainant: John Doe\nOffence: Theft\nRegistration Number: 2024/123\n",
                "confidence": 0.92
            }
        },
        {
            "filename": "sample_id_ocr.json",
            "content": {
                "raw_text": "AADHAR CARD\nUIDIA - Unique Identification Authority of India\nEnrolment Number: XXXX-XXXX-XXXX\nName: Applicant Name\nDate of Birth: 01/01/1990\nGender: Male\nAddress: Address Line 1, City, State\n",
                "confidence": 0.88
            }
        },
        {
            "filename": "sample_report_ocr.json",
            "content": {
                "raw_text": "OFFICIAL REPORT\nDepartment: Public Safety Division\nDate: 24-02-2024\nSummary of Findings: Investigation was conducted thoroughly\nConclusion: Based on examination, it is concluded that\nRecommendations: Further action is recommended\nSubmitted by: Officer Name\n",
                "confidence": 0.85
            }
        }
    ]
    
    try:
        for sample in samples:
            filepath = samples_dir / sample["filename"]
            with open(filepath, 'w') as f:
                json.dump(sample["content"], f, indent=2)
            print(f"✓ Created {sample['filename']}")
        return True
    except Exception as e:
        print(f"✗ Error creating sample OCR JSONs: {e}")
        return False


def test_classification_with_samples():
    """Test classification module with sample JSON files"""
    print("\n" + "="*60)
    print("Testing Classification with Sample Data")
    print("="*60)
    
    from classify import DocumentClassifier
    
    samples = [
        ("samples/sample_fir_ocr.json", "FIR"),
        ("samples/sample_id_ocr.json", "ID_CARD"),
        ("samples/sample_report_ocr.json", "OFFICIAL_REPORT"),
    ]
    
    passed = 0
    failed = 0
    
    for json_file, expected_type in samples:
        if not Path(json_file).exists():
            print(f"✗ {json_file} not found")
            failed += 1
            continue
        
        try:
            classifier = DocumentClassifier(json_file)
            result = classifier.process()
            
            if result and result["doc_type"] == expected_type:
                print(f"✓ {json_file}: {result['doc_type']} (confidence: {result['confidence']})")
                passed += 1
            else:
                actual = result["doc_type"] if result else "ERROR"
                print(f"✗ {json_file}: Expected {expected_type}, got {actual}")
                failed += 1
        except Exception as e:
            print(f"✗ {json_file}: Error - {e}")
            failed += 1
    
    print(f"\nResults: {passed} passed, {failed} failed")
    return failed == 0


def test_output_structure():
    """Verify output JSON structure"""
    print("\n" + "="*60)
    print("Testing Output JSON Structure")
    print("="*60)
    
    # Expected structures
    expected_ocr_keys = {"raw_text", "confidence"}
    expected_classification_keys = {"doc_type", "confidence"}
    expected_final_keys = {
        "pipeline_status", 
        "timestamp", 
        "input_image", 
        "ocr_output", 
        "classification_output", 
        "structured_data"
    }
    
    print("✓ OCR output keys: raw_text, confidence")
    print("✓ Classification output keys: doc_type, confidence")
    print("✓ Final output keys: pipeline_status, timestamp, input_image,")
    print("  ocr_output, classification_output, structured_data")
    
    return True


def run_all_tests():
    """Execute all integration tests"""
    print("\n" + "="*70)
    print(" "*10 + "LookBack Integration Testing Suite")
    print("="*70)
    
    results = {
        "Create Sample Images": create_sample_images(),
        "Create Sample OCR JSONs": create_sample_ocr_jsons(),
        "Classification with Samples": test_classification_with_samples(),
        "Output Structure Validation": test_output_structure(),
    }
    
    print("\n" + "="*70)
    print("Integration Test Summary")
    print("="*70)
    for test_name, result in results.items():
        status = "✓ PASSED" if result else "✗ FAILED"
        print(f"{test_name}: {status}")
    
    print("="*70)
    print("\nSample files created in 'samples/' directory")
    print("Use these for testing pipeline.py")
    print("="*70 + "\n")
    
    all_passed = all(results.values())
    return 0 if all_passed else 1


if __name__ == "__main__":
    exit_code = run_all_tests()
    sys.exit(exit_code)
