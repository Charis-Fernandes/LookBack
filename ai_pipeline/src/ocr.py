

import json
import argparse
import sys
import re
from pathlib import Path
import cv2
import pytesseract
from PIL import Image
import numpy as np
from pytesseract import Output

# Import translator module for automatic translation
try:
    from translate import IndicTransTranslator
    TRANSLATOR_AVAILABLE = True
except (ImportError, Exception) as e:
    TRANSLATOR_AVAILABLE = False
    # Silently disable translation if dependencies not available

# Configure Tesseract path for Windows
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"


class OCRModule:
    
    def __init__(
        self,
        image_path,
        tesseract_path=None,
        aggressive=False,
        auto_translate=True,
        fast_mode=False,
        min_token_conf=35,
    ):
        self.image_path = image_path
        self.confidence = 0.0
        self.raw_text = ""
        self.aggressive = aggressive
        self.auto_translate = auto_translate
        self.fast_mode = fast_mode
        self.min_token_conf = min_token_conf
        self.translated_text = ""
        self.detected_language = None
        self.translation_confidence = 0.0
        self._installed_languages = set()
        
        if tesseract_path:
            pytesseract.pytesseract.tesseract_cmd = tesseract_path

    def detect_installed_languages(self):

        try:
            languages = pytesseract.get_languages(config="")
            self._installed_languages = set(languages)
        except Exception:
            self._installed_languages = set()

    def build_language_candidates(self):

        # Use multilingual OCR only when language packs are actually available.
        if {"eng", "hin", "mar"}.issubset(self._installed_languages):
            return ["eng+hin+mar", "eng"]

        # If Hindi/Marathi aren't visible to Tesseract, avoid costly failed attempts.
        return ["eng"]
    
    def validate_image(self):
        
        try:
            if not Path(self.image_path).exists():
                raise FileNotFoundError(f"Image file not found: {self.image_path}")
            
            # Attempt to open image
            img = cv2.imread(self.image_path)
            if img is None:
                raise ValueError(f"Unable to read image: {self.image_path}")
            
            return True
        except Exception as e:
            print(f"Image validation error: {str(e)}")
            return False
    
    def deskew_image(self, image):
        
        try:
            # Convert to grayscale if needed
            if len(image.shape) == 3:
                gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            else:
                gray = image
            
            # Get edges
            edges = cv2.Canny(gray, 50, 150)
            
            # Find contours
            contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            if not contours:
                return image
            
            # Find the largest contour (document)
            largest_contour = max(contours, key=cv2.contourArea)
            
            # Get the rotated rectangle
            rect = cv2.minAreaRect(largest_contour)
            angle = rect[2]
            
            # Correct angle
            if angle < -45:
                angle = 90 + angle
            
            if abs(angle) < 1:  # Already straight
                return image
            
            # Get image center
            h, w = image.shape[:2]
            center = (w // 2, h // 2)
            
            # Get rotation matrix
            rotation_matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
            
            # Apply rotation
            rotated = cv2.warpAffine(
                image, 
                rotation_matrix, 
                (w, h),
                borderMode=cv2.BORDER_REFLECT,
                flags=cv2.INTER_CUBIC
            )
            
            return rotated
        except Exception as e:
            # If deskewing fails, return original
            return image
    
    def preprocess_image(self, image):
        
        try:
            # Step 1: Deskew (straighten) image
            image = self.deskew_image(image)
            
            # Step 2: Resize image if too small (improves OCR accuracy)
            height, width = image.shape[:2]
            if width < 800:
                scale = 1200 / width
                new_width = int(width * scale)
                new_height = int(height * scale)
                image = cv2.resize(image, (new_width, new_height), interpolation=cv2.INTER_CUBIC)
            
            # Step 3: Convert to grayscale
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            # Step 4: Apply CLAHE or aggressive contrast enhancement
            if self.aggressive:
                # Aggressive mode: stronger contrast enhancement for degraded scans
                clahe = cv2.createCLAHE(clipLimit=4.0, tileGridSize=(4, 4))
            else:
                # Normal mode: balanced enhancement
                clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            
            enhanced = clahe.apply(gray)
            
            # Step 5: Apply denoising (bilateral filter - preserves edges)
            if self.aggressive:
                # Stronger denoising for low-quality images
                denoised = cv2.bilateralFilter(enhanced, 11, 100, 100)
            else:
                denoised = cv2.bilateralFilter(enhanced, 9, 75, 75)
            
            # Step 6: Apply thresholding with optional median blur
            if self.aggressive:
                # Additional median blur for very noisy images
                denoised = cv2.medianBlur(denoised, 5)
            
            _, binary = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            
            # Step 7: Morphological operations (dilate, erode) to improve text
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
            processed = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=1)
            
            return processed
        except Exception as e:
            print(f"Preprocessing error: {str(e)}")
            return image

    def generate_ocr_variants(self, image):

        variants = []

        # Variant 1: Existing preprocessing pipeline
        primary = self.preprocess_image(image)
        variants.append(("primary", primary))

        if self.fast_mode:
            return variants

        # Variant 2: Adaptive thresholding, often better for uneven lighting
        try:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            denoised = cv2.bilateralFilter(gray, 9, 75, 75)
            adaptive = cv2.adaptiveThreshold(
                denoised,
                255,
                cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                cv2.THRESH_BINARY,
                31,
                11,
            )
            variants.append(("adaptive", adaptive))
        except Exception:
            pass

        # Variant 3: Upscaled grayscale for tiny/compressed text
        try:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            h, w = gray.shape[:2]
            if w < 1600:
                upscaled = cv2.resize(gray, (w * 2, h * 2), interpolation=cv2.INTER_CUBIC)
            else:
                upscaled = gray
            clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
            upscaled_enhanced = clahe.apply(upscaled)
            _, upscaled_bin = cv2.threshold(
                upscaled_enhanced, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU
            )
            variants.append(("upscaled", upscaled_bin))
        except Exception:
            pass

        return variants

    def _is_noise_token(self, token):

        token = token.strip()
        if not token:
            return True

        # Keep Aadhaar-like and numeric IDs.
        if re.fullmatch(r"[0-9]{4,}", token):
            return False
        if re.fullmatch(r"[0-9]{4}\s?[0-9]{4}\s?[0-9]{4}", token):
            return False

        # Drop tiny punctuation-only tokens.
        if re.fullmatch(r"[^\w\u0900-\u097F]+", token):
            return True

        alnum = sum(ch.isalnum() for ch in token)
        alpha = sum(ch.isalpha() for ch in token)
        digit = sum(ch.isdigit() for ch in token)
        punct = len(token) - alnum

        # Typical OCR junk: heavy punctuation and very little meaningful text.
        if len(token) <= 3 and punct >= 2:
            return True
        if alpha == 0 and digit <= 1 and punct >= 1:
            return True

        return False

    def _extract_with_confidence(self, image, lang, config):

        pil_image = Image.fromarray(image)

        # Use token-level confidences and ignore invalid values (-1)
        data = pytesseract.image_to_data(
            pil_image, lang=lang, config=config, output_type=Output.DICT
        )
        conf_values = []
        kept_tokens = []
        conf_list = data.get("conf", [])
        text_list = data.get("text", [])
        for value, token in zip(conf_list, text_list):
            try:
                confidence = float(value)
                if confidence >= self.min_token_conf and token.strip() and not self._is_noise_token(token):
                    kept_tokens.append(token.strip())
                if confidence >= 0:
                    conf_values.append(confidence)
            except (TypeError, ValueError):
                continue

        mean_conf = (sum(conf_values) / len(conf_values)) / 100 if conf_values else 0.0

        text = " ".join(kept_tokens).strip()
        if not text:
            # Fallback to standard OCR output if filtering removed everything.
            text = pytesseract.image_to_string(pil_image, lang=lang, config=config)

        clean_text = text.strip()
        if clean_text:
            printable_chars = sum(1 for c in clean_text if c.isprintable())
            text_quality = printable_chars / max(1, len(clean_text))
        else:
            text_quality = 0.0

        # Blend OCR engine confidence with basic text sanity score
        score = (0.8 * mean_conf) + (0.2 * text_quality)
        return text, mean_conf, score
    
    def extract_text(self):
        
        try:
            image = cv2.imread(self.image_path)
            if image is None:
                raise ValueError("Failed to read image")

            self.detect_installed_languages()

            variants = self.generate_ocr_variants(image)
            configs = [r"--oem 1 --psm 3"] if self.fast_mode else [r"--oem 1 --psm 3", r"--oem 1 --psm 6"]
            lang_candidates = self.build_language_candidates()

            best_text = ""
            best_conf = 0.0
            best_score = -1.0
            used_fallback_lang = ("eng+hin+mar" not in lang_candidates)

            for variant_name, variant_image in variants:
                for config in configs:
                    successful = False
                    for lang in lang_candidates:
                        try:
                            text, mean_conf, score = self._extract_with_confidence(
                                variant_image, lang=lang, config=config
                            )
                            successful = True

                            if text.strip() and score > best_score:
                                best_text = text
                                best_conf = mean_conf
                                best_score = score
                        except Exception:
                            continue

                    # If no language worked for this pass, move to next pass
                    if not successful:
                        continue

            if used_fallback_lang:
                print("  Note: Hindi/Marathi language data not detected by Tesseract runtime; using English-only fallback")

            self.raw_text = best_text
            self.confidence = max(0.0, min(1.0, best_conf))
            
            return True
        except pytesseract.TesseractNotFoundError:
            print("ERROR: Tesseract is not installed or path is incorrect")
            print("Install Tesseract from: https://github.com/UB-Mannheim/tesseract/wiki")
            return False
        except Exception as e:
            print(f"Text extraction error: {str(e)}")
            return False
    
    def translate_text(self):
        
        if not TRANSLATOR_AVAILABLE or not self.auto_translate:
            return False
        
        if not self.raw_text.strip():
            return False
        
        try:
            translator = IndicTransTranslator(self.raw_text)
            if translator.translate():
                self.translated_text = translator.translated_text
                self.detected_language = translator.source_language
                self.translation_confidence = translator.confidence
                return True
        except Exception as e:
            print(f"  Translation warning: {str(e)}")
            return False
        
        return False
    
    def get_output_json(self):
        
        output = {
            "raw_text": self.raw_text.strip(),
            "ocr_confidence": round(self.confidence, 2)
        }
        
        # Add translation if available
        if self.translated_text:
            output["translated_text"] = self.translated_text
            output["detected_language"] = self.detected_language
            output["translation_confidence"] = round(self.translation_confidence, 2)
            output["translation_model"] = "IndicTrans2"
        
        return output
    
    def process(self):
        
        if not self.validate_image():
            return None
        
        if not self.extract_text():
            return None
        
        # Automatically translate if enabled
        if self.auto_translate and TRANSLATOR_AVAILABLE:
            print("  Translating extracted text using IndicTrans2...")
            self.translate_text()
        
        return self.get_output_json()


def main():
    
    parser = argparse.ArgumentParser(
        description="LookBack OCR Module - Extract text from document images"
    )
    parser.add_argument(
        "image_path",
        type=str,
        help="Path to input image file (PNG, JPG, etc.)"
    )
    parser.add_argument(
        "--tesseract-path",
        type=str,
        default=None,
        help="Path to tesseract.exe (required on Windows if not in PATH)"
    )
    parser.add_argument(
        "--aggressive",
        action="store_true",
        help="Use aggressive preprocessing for low-quality/scanned documents"
    )
    parser.add_argument(
        "--fast",
        action="store_true",
        help="Use a faster OCR path (lower latency, slightly lower recall on hard images)"
    )
    parser.add_argument(
        "--min-token-conf",
        type=int,
        default=35,
        help="Minimum token confidence (0-100) to keep OCR tokens in output (default: 35)"
    )
    parser.add_argument(
        "--no-translate",
        action="store_true",
        help="Skip automatic translation (IndicTrans2)"
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Optional: Save output JSON to specified file"
    )
    
    args = parser.parse_args()
    
    # Initialize and process with aggressive mode if specified
    ocr = OCRModule(
        args.image_path, 
        args.tesseract_path, 
        aggressive=args.aggressive,
        auto_translate=not args.no_translate,
        fast_mode=args.fast,
        min_token_conf=max(0, min(100, args.min_token_conf))
    )
    if args.aggressive:
        print("  Using aggressive preprocessing for low-quality images...")
    if args.fast:
        print("  Using fast OCR mode for lower latency...")
    
    result = ocr.process()
    
    if result is None:
        print("ERROR: OCR processing failed")
        sys.exit(1)
    
    # Print output
    print(json.dumps(result, indent=2))
    
    # Save to file if specified
    if args.output:
        try:
            with open(args.output, 'w') as f:
                json.dump(result, f, indent=2)
            print(f"\nOutput saved to: {args.output}")
        except Exception as e:
            print(f"Error saving output: {str(e)}")
            sys.exit(1)


if __name__ == "__main__":
    main()
