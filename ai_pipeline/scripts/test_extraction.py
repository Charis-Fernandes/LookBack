"""
Test script for Legal Field Extraction Module
Run from ai_pipeline directory: python scripts/test_extraction.py
"""

import sys
import json
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from extract_fields import LegalFieldExtractor


def test_with_sample_fir():
    """Test extraction with sample FIR JSON."""
    print("=" * 60)
    print("Test 1: Sample FIR OCR JSON")
    print("=" * 60)

    sample_path = Path(__file__).parent.parent / "samples" / "sample_fir_ocr.json"

    if not sample_path.exists():
        print(f"  ❌ Sample file not found: {sample_path}")
        return False

    extractor = LegalFieldExtractor(ocr_json_path=str(sample_path))
    result = extractor.process()

    print(json.dumps(result, indent=2, ensure_ascii=False))

    data = result.get("extracted_data", {})

    checks = {
        "fir_no": "245/2024",
        "date": None,       # just check it exists
        "sections": None,   # just check it exists
        "police_station": None,
        "complainant": None,
    }

    passed = 0
    for field, expected in checks.items():
        value = data.get(field)
        if expected:
            if value == expected:
                print(f"  ✅ {field}: {value}")
                passed += 1
            else:
                print(f"  ❌ {field}: expected '{expected}', got '{value}'")
        else:
            if value:
                print(f"  ✅ {field}: {value}")
                passed += 1
            else:
                print(f"  ⚠️  {field}: not found")

    print(f"\n  Result: {passed}/{len(checks)} checks passed")
    return passed >= 3


def test_with_raw_text():
    """Test extraction with raw text."""
    print("\n" + "=" * 60)
    print("Test 2: Raw Text Input")
    print("=" * 60)

    text = """
    FIR No. 122/2024
    Date: 18-03-2024
    Police Station: Bandra

    Under Section 302, 34 of Indian Penal Code

    Complainant: Amit Patel
    Accused: Suresh Yadav

    District: Mumbai Suburban
    State: Maharashtra

    Contact: 9988776655
    Aadhaar: 1234 5678 9012
    """

    extractor = LegalFieldExtractor(text=text)
    result = extractor.process()

    print(json.dumps(result, indent=2, ensure_ascii=False))

    data = result.get("extracted_data", {})
    passed = 0
    total = 3

    # Check FIR No
    if data.get("fir_no") == "122/2024":
        print("  ✅ FIR No correct")
        passed += 1
    else:
        print(f"  ❌ FIR No: expected '122/2024', got '{data.get('fir_no')}'")

    # Check sections
    sections = data.get("sections", [])
    if "302" in sections:
        print(f"  ✅ Sections found: {sections}")
        passed += 1
    else:
        print(f"  ❌ Section 302 missing: {sections}")

    # Check date
    if data.get("date"):
        print(f"  ✅ Date: {data.get('date')}")
        passed += 1
    else:
        print("  ❌ Date not found")

    print(f"\n  Result: {passed}/{total} checks passed")
    return passed >= 2


def test_empty_text():
    """Test with empty text."""
    print("\n" + "=" * 60)
    print("Test 3: Empty Text")
    print("=" * 60)

    extractor = LegalFieldExtractor(text="")
    result = extractor.process()

    print(json.dumps(result, indent=2))

    if result.get("status") == "no_fields_found":
        print("  ✅ Correctly handled empty text")
        return True
    else:
        print(f"  ❌ Expected 'no_fields_found', got '{result.get('status')}'")
        return False


def test_hinglish_text():
    """Test with mixed Hindi-English text."""
    print("\n" + "=" * 60)
    print("Test 4: Hinglish / Mixed Text")
    print("=" * 60)

    text = """
    FIRST INFORMATION REPORT
    FIR No: 567/2023
    Dated: 25/12/2023
    Thana: Kotwali Varanasi

    Sections: 379, 411 IPC
    
    Complainant Name: Ramesh Gupta
    
    State: Uttar Pradesh
    District: Varanasi
    """

    extractor = LegalFieldExtractor(text=text)
    result = extractor.process()

    print(json.dumps(result, indent=2, ensure_ascii=False))

    data = result.get("extracted_data", {})
    passed = 0

    if data.get("fir_no"):
        print(f"  ✅ FIR No: {data['fir_no']}")
        passed += 1
    else:
        print("  ⚠️  FIR No not found")

    if data.get("sections"):
        print(f"  ✅ Sections: {data['sections']}")
        passed += 1
    else:
        print("  ⚠️  Sections not found")

    if data.get("complainant"):
        print(f"  ✅ Complainant: {data['complainant']}")
        passed += 1
    else:
        print("  ⚠️  Complainant not found")

    print(f"\n  Result: {passed}/3 checks passed")
    return passed >= 2


def run_all_tests():
    """Run all extraction tests."""
    print("\n🧪 Running Legal Field Extraction Tests\n")

    results = []
    results.append(("Sample FIR JSON", test_with_sample_fir()))
    results.append(("Raw Text", test_with_raw_text()))
    results.append(("Empty Text", test_empty_text()))
    results.append(("Hinglish Text", test_hinglish_text()))

    print("\n" + "=" * 60)
    print("  Test Results Summary")
    print("=" * 60)

    for name, passed in results:
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"  {status} - {name}")

    total = sum(1 for _, p in results if p)
    print(f"\n  Total: {total}/{len(results)} tests passed")

    return 0 if all(p for _, p in results) else 1


if __name__ == "__main__":
    exit_code = run_all_tests()
    sys.exit(exit_code)
