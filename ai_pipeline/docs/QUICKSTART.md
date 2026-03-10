# LookBack Quick Start Guide

## 🚀 Getting Started in 10 Minutes

### Step 1: Activate Virtual Environment
```bash
# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate
```

### Step 2: Install Dependencies
```bash
pip install -r requirements.txt
```

### Step 3: Install Tesseract (One-time setup)

**Windows:**
1. Download: https://github.com/UB-Mannheim/tesseract/wiki/Downloads
2. Install to default location
3. Use in commands: `--tesseract-path "C:\Program Files\Tesseract-OCR\tesseract.exe"`

**macOS:**
```bash
brew install tesseract
```

**Linux:**
```bash
sudo apt-get install tesseract-ocr
```

### Step 4: Run Verification
```bash
python setup.py
```

### Step 5: Test with Sample Data

#### Test 1: Classification with sample FIR
```bash
python classify.py samples/sample_fir_ocr.json
```

**Expected Output:**
```json
{
  "doc_type": "FIR",
  "confidence": 0.92
}
```

#### Test 2: Full OCR (requires image file)
```bash
python ocr.py path/to/image.jpg --output ocr_result.json
```

#### Test 3: Complete Pipeline
```bash
python pipeline.py path/to/image.jpg --output-dir outputs
```

---

## 📁 Directory Structure After Setup

```
lookback/
├── ocr.py                          # OCR module
├── classify.py                     # Classification module
├── pipeline.py                     # Pipeline orchestration
├── requirements.txt                # Dependencies
├── README.md                       # Full documentation
├── setup.py                        # Setup verification
├── QUICKSTART.md                   # This file
│
├── samples/                        # Test data
│   ├── sample_fir_ocr.json        # FIR sample output
│   ├── sample_id_ocr.json         # ID sample output
│   └── sample_report_ocr.json     # Report sample output
│
├── outputs/                        # Generated outputs
│   ├── *_ocr_*.json               # OCR results
│   ├── *_classification_*.json    # Classification results
│   └── *_final_*.json             # Final pipeline outputs
│
└── venv/                          # Virtual environment (created)
```

---

## 🧪 Quick Testing

### 1. Test Classification Module
```bash
python classify.py samples/sample_fir_ocr.json --detailed
```

### 2. Test with Your Own Image

#### Step A: Run OCR
```bash
python ocr.py your_document.jpg --tesseract-path "C:\Program Files\Tesseract-OCR\tesseract.exe" --output my_ocr.json
```

#### Step B: Classify
```bash
python classify.py my_ocr.json --detailed
```

#### Step C: Full Pipeline
```bash
python pipeline.py your_document.jpg --output-dir outputs --tesseract-path "C:\Program Files\Tesseract-OCR\tesseract.exe"
```

---

## ⚡ Command Reference

### OCR Module
```bash
# Basic
python ocr.py image.jpg

# With Tesseract path
python ocr.py image.jpg --tesseract-path "path/to/tesseract.exe"

# Save output
python ocr.py image.jpg --output ocr_result.json
```

### Classification Module
```bash
# Basic
python classify.py ocr_output.json

# Detailed view
python classify.py ocr_output.json --detailed

# Save result
python classify.py ocr_output.json --output classification_result.json
```

### Pipeline Module
```bash
# Basic
python pipeline.py image.jpg

# Custom output directory
python pipeline.py image.jpg --output-dir results

# With Tesseract path
python pipeline.py image.jpg --tesseract-path "path/to/tesseract.exe"

# Verbose output
python pipeline.py image.jpg --verbose
```

---

## 🐛 Troubleshooting

### Problem: "Tesseract is not installed"
**Solution 1:** Provide full path
```bash
python ocr.py image.jpg --tesseract-path "C:\Program Files\Tesseract-OCR\tesseract.exe"
```

**Solution 2:** Add to PATH environment variable
- Windows: Add `C:\Program Files\Tesseract-OCR` to System PATH
- Restart terminal/IDE after adding to PATH

### Problem: "ModuleNotFoundError: No module named 'cv2'"
**Solution:**
```bash
pip install -r requirements.txt
```

### Problem: Image file not found
**Solution:** Use absolute path
```bash
python ocr.py "C:\full\path\to\image.jpg"
```

### Problem: Poor OCR accuracy
**Solutions:**
1. Use high-resolution images (300+ DPI recommended)
2. Ensure good lighting in photos
3. Try preprocessing with: `python preprocess.py image.jpg`
4. Experiment with different PSM modes in ocr.py

---

## ✅ Verification Checklist

- [ ] Python 3.11+ installed
- [ ] Virtual environment created and activated
- [ ] `pip install -r requirements.txt` completed
- [ ] Tesseract installed and verified with `tesseract --version`
- [ ] `python setup.py` shows all PASSED
- [ ] `python classify.py samples/sample_fir_ocr.json` works
- [ ] Have sample documents ready for testing

---

## 📞 Getting Help

1. **Check README.md** - Comprehensive documentation
2. **View docstrings** - In Python files
3. **Run --help** - `python pipeline.py --help`
4. **Check output** - Look in `outputs/` folder

---

## 🎯 Next Steps

1. ✅ Complete setup (this guide)
2. 📖 Read [README.md](README.md) for detailed documentation
3. 🧪 Run sample classifications
4. 🖼️ Test with your own document images
5. 💾 Review outputs in `outputs/` folder
6. 🔧 Customize and optimize

---

## 📚 Full Documentation

For detailed information about:
- Architecture and design
- Module specifications
- API reference
- Optimization tips
- Viva preparation

**See: [README.md](README.md)**

---

**Quick Start Version:** 1.0  
**Last Updated:** February 24, 2024
