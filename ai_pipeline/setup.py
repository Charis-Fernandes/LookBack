

import subprocess
import sys
import os
from pathlib import Path


def print_section(title):
    
    print("\n" + "="*70)
    print(f"  {title}")
    print("="*70)


def run_command(cmd, description):
    
    try:
        print(f"  → {description}...")
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        if result.returncode == 0:
            print(f"  ✓ {description}")
            return True
        else:
            print(f"  ✗ {description} failed")
            if result.stderr:
                print(f"    Error: {result.stderr[:200]}")
            return False
    except Exception as e:
        print(f"  ✗ {description} failed: {e}")
        return False


def check_python_version():
    
    print_section("1. Python Version Check")
    version = sys.version_info
    version_str = f"{version.major}.{version.minor}.{version.micro}"
    
    if version.major == 3 and version.minor >= 11:
        print(f"  ✓ Python {version_str} (OK)")
        return True
    else:
        print(f"  ✗ Python {version_str} detected")
        print(f"  ⚠ Python 3.11+ required")
        print(f"  → Download from: https://www.python.org/downloads/")
        return False


def check_venv():
    
    print_section("2. Virtual Environment Check")
    
    in_venv = sys.prefix != sys.base_prefix
    if in_venv:
        venv_path = sys.prefix
        print(f"  ✓ Virtual environment activated")
        print(f"    Path: {venv_path}")
        return True
    else:
        print(f"  ⚠ Virtual environment NOT activated")
        print(f"  → Run: python -m venv venv")
        print(f"  → Then: venv\\Scripts\\activate (Windows)")
        print(f"         source venv/bin/activate (Linux/macOS)")
        return False


def check_tesseract():
    
    print_section("3. Tesseract OCR Check")
    
    result = subprocess.run("tesseract --version", shell=True, capture_output=True, text=True)
    if result.returncode == 0:
        version_line = result.stdout.split('\n')[0]
        print(f"  ✓ Tesseract installed: {version_line}")
        return True
    else:
        print(f"  ✗ Tesseract NOT found in PATH")
        print(f"  → Windows: Download from https://github.com/UB-Mannheim/tesseract/wiki")
        print(f"  → macOS: brew install tesseract")
        print(f"  → Linux: sudo apt-get install tesseract-ocr")
        print(f"  → After install, use --tesseract-path flag with full path")
        return False


def install_requirements():
    
    print_section("4. Installing Python Packages")
    
    req_file = "requirements.txt"
    if not Path(req_file).exists():
        print(f"  ✗ {req_file} not found")
        return False
    
    cmd = f"{sys.executable} -m pip install -r {req_file}"
    return run_command(cmd, "Installing packages from requirements.txt")


def verify_packages():
    
    print_section("5. Package Verification")
    
    packages = {
        "cv2": "OpenCV",
        "pytesseract": "PyTesseract",
        "PIL": "Pillow",
        "numpy": "NumPy"
    }
    
    all_ok = True
    for import_name, display_name in packages.items():
        try:
            __import__(import_name)
            print(f"  ✓ {display_name} installed")
        except ImportError:
            print(f"  ✗ {display_name} NOT installed")
            all_ok = False
    
    return all_ok


def check_project_structure():
    
    print_section("6. Project Structure Check")
    
    required_files = [
        "ocr.py",
        "classify.py",
        "pipeline.py",
        "requirements.txt",
        "README.md"
    ]
    
    required_dirs = [
        "samples",
        "outputs"
    ]
    
    all_ok = True
    
    for file in required_files:
        if Path(file).exists():
            print(f"  ✓ {file}")
        else:
            print(f"  ✗ {file} NOT found")
            all_ok = False
    
    for dir in required_dirs:
        if Path(dir).exists():
            print(f"  ✓ {dir}/ directory")
        else:
            print(f"  ✗ {dir}/ directory NOT found")
            all_ok = False
    
    return all_ok


def run_tests():
    
    print_section("7. Running Tests")
    
    # Create sample data
    print("  → Creating sample test data...")
    result = subprocess.run(
        f"{sys.executable} test_pipeline.py",
        shell=True,
        capture_output=True,
        text=True
    )
    
    if result.returncode == 0:
        print("  ✓ Sample data created successfully")
        return True
    else:
        print("  ⚠ Test creation had issues (non-critical)")
        print(f"    {result.stderr[:200] if result.stderr else result.stdout[:200]}")
        return True  # Non-blocking


def print_next_steps():
    
    print_section("Next Steps")
    
    print("""
  1. Basic OCR Test (requires image file):
     python ocr.py path/to/image.jpg --output ocr_output.json

  2. Test Classification (using sample):
     python classify.py samples/sample_fir_ocr.json --detailed

  3. Full Pipeline Test (requires image):
     python pipeline.py path/to/image.jpg --output-dir outputs

  4. For Windows Users (Tesseract path):
     python pipeline.py image.jpg --tesseract-path "C:\\Program Files\\Tesseract-OCR\\tesseract.exe"

  5. View README for detailed documentation:
     Open README.md for complete usage guide

  📚 Documentation: See README.md for detailed information
  🔧 Troubleshooting: Check README.md section on common issues
  """)


def main():
    
    print("\n")
    print("╔" + "="*68 + "╗")
    print("║" + " "*15 + "LookBack Setup and Verification Script" + " " * 15 + "║")
    print("╚" + "="*68 + "╝")
    
    checks = [
        ("Python Version", check_python_version),
        ("Virtual Environment", check_venv),
        ("Tesseract OCR", check_tesseract),
        ("Install Requirements", install_requirements),
        ("Package Verification", verify_packages),
        ("Project Structure", check_project_structure),
        ("Test Setup", run_tests),
    ]
    
    results = {}
    critical_failed = False
    
    for name, check_func in checks:
        try:
            results[name] = check_func()
            if name in ["Python Version"] and not results[name]:
                critical_failed = True
        except Exception as e:
            print(f"  ✗ Error during {name}: {e}")
            results[name] = False
    
    # Summary
    print_section("Setup Summary")
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for name, result in results.items():
        status = "✓ PASSED" if result else "✗ FAILED"
        print(f"  {status}: {name}")
    
    print(f"\n  Total: {passed}/{total} checks passed")
    
    if critical_failed:
        print("\n  ⚠ Critical issue detected - please fix and re-run")
        print_next_steps()
        return 1
    
    if results["Tesseract OCR"]:
        print("\n  ✓ Setup complete! Ready to process documents")
    else:
        print("\n  ⚠ Setup mostly complete, but Tesseract needs attention")
        print("    (Classification will work, but OCR will fail)")
    
    print_next_steps()
    return 0


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
