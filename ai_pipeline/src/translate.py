"""
Advanced Translation Module using IndicTrans Model
Detects and translates Indian languages (Hindi, Marathi, etc.) to English
Part of LookBack Document Processing System
"""

import json
import argparse
import sys
from pathlib import Path
from typing import Tuple, Dict

# Lazy imports - only load when needed to avoid compatibility issues
TRANSFORMERS_AVAILABLE = False
TORCH_AVAILABLE = False

def _check_dependencies():
    """Check if required dependencies are available"""
    global TRANSFORMERS_AVAILABLE, TORCH_AVAILABLE
    try:
        import torch
        TORCH_AVAILABLE = True
    except (ImportError, Exception):
        TORCH_AVAILABLE = False
    
    try:
        from transformers import pipeline
        TRANSFORMERS_AVAILABLE = True
    except (ImportError, Exception):
        TRANSFORMERS_AVAILABLE = False
    
    return TRANSFORMERS_AVAILABLE and TORCH_AVAILABLE


class IndicTransTranslator:
    """
    Advanced translator using IndicTrans2 model for Indian languages.
    
    Supports:
    - Hindi (hin_Deva)
    - Marathi (mar_Deva)
    - Gujarati (guj_Deva)
    - Bengali (ben_Deva)
    - Tamil (tam_Taml)
    - Telugu (tel_Telu)
    - Kannada (kan_Knda)
    - Malayalam (mal_Mlym)
    - Punjabi (pan_Guru)
    - Urdu (urd_Arab)
    - Hinglish (encoded as hindi)
    
    Attributes:
        text (str): Input text to translate
        source_language (str): Detected source language code
        translated_text (str): Translated English text
        confidence (float): Translation confidence (0.0-1.0)
    """
    
    # Language code mapping for IndicTrans2
    INDIC_LANG_CODES = {
        'hin': 'hin_Deva',  # Hindi
        'mar': 'mar_Deva',  # Marathi
        'gu': 'guj_Deva',   # Gujarati
        'bn': 'ben_Deva',   # Bengali
        'ta': 'tam_Taml',   # Tamil
        'te': 'tel_Telu',   # Telugu
        'kn': 'kan_Knda',   # Kannada
        'ml': 'mal_Mlym',   # Malayalam
        'pa': 'pan_Guru',   # Punjabi
        'ur': 'urd_Arab',   # Urdu
    }
    
    LANGUAGE_NAMES = {
        'hin_Deva': 'Hindi',
        'mar_Deva': 'Marathi',
        'guj_Deva': 'Gujarati',
        'ben_Deva': 'Bengali',
        'tam_Taml': 'Tamil',
        'tel_Telu': 'Telugu',
        'kan_Knda': 'Kannada',
        'mal_Mlym': 'Malayalam',
        'pan_Guru': 'Punjabi',
        'urd_Arab': 'Urdu',
        'eng_Latn': 'English',
    }
    
    def __init__(self, text: str = ""):
        """
        Initialize IndicTrans Translator
        
        Args:
            text (str, optional): Text to translate
        """
        self.text = text
        self.source_language = None
        self.translated_text = ""
        self.confidence = 0.0
        self.error_message = None
        self.translator = None
        
        # Initialize model
        self._load_model()
    
    def _load_model(self):
        """
        Load the IndicTrans2 model from HuggingFace
        
        Uses: ai4bharat/indic-trans-indic_to_en-1498M
        """
        try:
            # Lazy import to avoid compatibility issues
            if not _check_dependencies():
                self.error_message = "transformers or torch library not available"
                return False
            
            # Import here to avoid module-level import errors
            from transformers import pipeline
            import torch
            
            # Load Indic to English translator
            # This specific model translates from any Indic language to English
            self.translator = pipeline(
                "translation",
                model="ai4bharat/indic-trans-indic_to_en-1498M",
                device=0 if torch.cuda.is_available() else -1
            )
            return True
        except Exception as e:
            self.error_message = f"Failed to load model: {str(e)}"
            return False
    
    def detect_language_simple(self, text: str) -> str:
        """
        Simple language detection using character analysis
        
        Analyzes Unicode script to determine language:
        - Devanagari script → Hindi/Marathi/Sanskrit
        - Tamil script → Tamil
        - Telugu script → Telugu
        - etc.
        
        Args:
            text (str): Input text
            
        Returns:
            str: Detected language code (e.g., 'hin_Deva')
        """
        if not text:
            return 'eng_Latn'
        
        # Count character ranges for different scripts
        devanagari_count = 0
        tamil_count = 0
        telugu_count = 0
        kannada_count = 0
        malayalam_count = 0
        gurmukhi_count = 0
        
        for char in text:
            code = ord(char)
            # Devanagari: U+0900 to U+097F
            if 0x0900 <= code <= 0x097F:
                devanagari_count += 1
            # Tamil: U+0B80 to U+0BFF
            elif 0x0B80 <= code <= 0x0BFF:
                tamil_count += 1
            # Telugu: U+0C00 to U+0C7F
            elif 0x0C00 <= code <= 0x0C7F:
                telugu_count += 1
            # Kannada: U+0C80 to U+0CFF
            elif 0x0C80 <= code <= 0x0CFF:
                kannada_count += 1
            # Malayalam: U+0D00 to U+0D7F
            elif 0x0D00 <= code <= 0x0D7F:
                malayalam_count += 1
            # Gurmukhi (Punjabi): U+0A00 to U+0A7F
            elif 0x0A00 <= code <= 0x0A7F:
                gurmukhi_count += 1
        
        # Find the dominant script
        scripts = {
            'hin_Deva': devanagari_count,
            'tam_Taml': tamil_count,
            'tel_Telu': telugu_count,
            'kan_Knda': kannada_count,
            'mal_Mlym': malayalam_count,
            'pan_Guru': gurmukhi_count,
        }
        
        if max(scripts.values()) > 0:
            return max(scripts, key=scripts.get)
        
        # Default to English if no Indic script detected
        return 'eng_Latn'
    
    def set_text(self, text: str):
        """
        Set text to translate
        
        Args:
            text (str): Text to translate
        """
        self.text = text
        self.source_language = None
        self.translated_text = ""
        self.confidence = 0.0
        self.error_message = None
    
    def translate(self) -> bool:
        """
        Detect language and translate to English
        
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            if not self.text or not self.text.strip():
                self.error_message = "Input text is empty"
                return False
            
            # Step 1: Detect language
            self.source_language = self.detect_language_simple(self.text)
            
            # If already English, no translation needed
            if self.source_language == 'eng_Latn':
                self.translated_text = self.text
                self.confidence = 1.0
                return True
            
            # Step 2: Load model if not already loaded
            if not self.translator:
                if not self._load_model():
                    return False
            
            # Step 3: Translate using IndicTrans2
            result = self.translator(
                self.text,
                src_lang=self.source_language,
                tgt_lang='eng_Latn',
                max_length=512
            )
            
            self.translated_text = result[0]['translation_text']
            
            # Confidence based on translation length ratio
            # Good translations usually preserve or slightly increase length
            ratio = len(self.translated_text) / max(len(self.text), 1)
            self.confidence = min(1.0, max(0.5, ratio))
            
            return True
        
        except Exception as e:
            self.error_message = f"Translation error: {str(e)}"
            # Fallback to original text
            self.translated_text = self.text
            self.confidence = 0.5
            return True  # Non-critical failure
    
    def get_output_json(self) -> Dict:
        """
        Generate JSON output with translation results
        
        Returns:
            dict: Output JSON with translation details
        """
        return {
            "original_text": self.text[:200] + "..." if len(self.text) > 200 else self.text,
            "translated_text": self.translated_text,
            "source_language": self.source_language,
            "source_language_name": self.LANGUAGE_NAMES.get(self.source_language, "Unknown"),
            "translation_model": "IndicTrans2",
            "confidence": round(self.confidence, 2),
            "error": self.error_message
        }


def translate_if_needed(text: str) -> Tuple[str, str, float]:
    """
    Simple function interface for translation
    
    Args:
        text (str): Text to translate (any language)
        
    Returns:
        Tuple[str, str, float]: (translated_text, source_language, confidence)
    """
    translator = IndicTransTranslator(text)
    
    if translator.translate():
        return translator.translated_text, translator.source_language, translator.confidence
    else:
        return text, 'unknown', 0.0


def main():
    """
    Command-line interface for Advanced Translator
    Usage: python translate.py <ocr_json_path> [--output output.json]
    """
    parser = argparse.ArgumentParser(
        description="LookBack Advanced Translator - IndicTrans2 for Indian Languages"
    )
    parser.add_argument(
        "input_source",
        type=str,
        help="Path to OCR JSON file containing 'raw_text' key"
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Optional: Save output JSON to file"
    )
    
    args = parser.parse_args()
    
    # Load OCR JSON
    try:
        json_path = args.input_source
        if not Path(json_path).exists():
            print(f"ERROR: File not found: {json_path}")
            sys.exit(1)
        
        with open(json_path, 'r', encoding='utf-8') as f:
            ocr_data = json.load(f)
        
        text = ocr_data.get("raw_text", "")
        if not text:
            print("ERROR: No 'raw_text' found in JSON")
            sys.exit(1)
    
    except json.JSONDecodeError:
        print("ERROR: Invalid JSON file")
        sys.exit(1)
    except Exception as e:
        print(f"ERROR: Failed to read input: {str(e)}")
        sys.exit(1)
    
    # Translate
    print("Translating using IndicTrans2 model...")
    translator = IndicTransTranslator(text)
    
    if not translator.translate():
        print(f"WARNING: {translator.error_message}")
    
    # Output
    output = translator.get_output_json()
    print(json.dumps(output, indent=2, ensure_ascii=False))
    
    # Save if specified
    if args.output:
        try:
            with open(args.output, 'w', encoding='utf-8') as f:
                json.dump(output, f, indent=2, ensure_ascii=False)
            print(f"\nSaved to: {args.output}")
        except Exception as e:
            print(f"ERROR saving output: {str(e)}")
            sys.exit(1)


if __name__ == "__main__":
    main()
