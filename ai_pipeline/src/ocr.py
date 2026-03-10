"""
OCR Module for LookBack Document Processing System
Handles image preprocessing and text extraction using Tesseract OCR
Automatically translates extracted text using IndicTrans2
"""

import json
import argparse
import sys
from pathlib import Path
import cv2
import pytesseract
from PIL import Image
import numpy as np

# Import translator module for automatic translation
try:
    from translate import IndicTransTranslator
    TRANSLATOR_AVAILABLE = True
except (ImportError, Exception) as e:
    TRANSLATOR_AVAILABLE = False
    # Silently disable translation if dependencies not available

# Configure Tesseract path (auto-detect OS)
import platform
if platform.system() == "Windows":
    pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
# On Linux/Mac, tesseract is expected to be in PATH (installed via apt/brew)


class OCRModule:
    """
    Optical Character Recognition module for extracting text from document images.
    
    Attributes:
        image_path (str): Path to the input image file
        tesseract_path (str): Path to Tesseract executable (Windows-specific)
    """
    
    def __init__(self, image_path, tesseract_path=None, aggressive=False, auto_translate=True):
        """
        Initialize OCR Module
        
        Args:
            image_path (str): Path to the input image
            tesseract_path (str, optional): Path to tesseract.exe (required on Windows)
            aggressive (bool, optional): Use aggressive preprocessing for low-quality scans
            auto_translate (bool, optional): Automatically translate extracted text using IndicTrans2
        """
        self.image_path = image_path
        self.confidence = 0.0
        self.raw_text = ""
        self.aggressive = aggressive
        self.auto_translate = auto_translate
        self.translated_text = ""
        self.detected_language = None
        self.translation_confidence = 0.0
        
        # Set Tesseract path if provided (important for Windows)
        if tesseract_path:
            pytesseract.pytesseract.tesseract_cmd = tesseract_path
    
    def validate_image(self):
        """
        Validate if image file exists and is readable
        
        Returns:
            bool: True if image is valid, False otherwise
        """
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
        """
        Deskew (straighten) image to improve OCR accuracy
        Rotates image to correct tilt/rotation
        
        Args:
            image (numpy.ndarray): Input image
            
        Returns:
            numpy.ndarray: Deskewed image
        """
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
        """
        Preprocess image for better OCR accuracy
        
        Preprocessing steps:
        1. Deskew (straighten) image
        2. Resize image for better OCR
        3. Convert to grayscale
        4. Apply contrast enhancement
        5. Apply denoising
        6. Apply thresholding
        7. Morphological operations
        
        
        Args:
            image (numpy.ndarray): Input image
            
        Returns:
            numpy.ndarray: Preprocessed image
        """
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
    
    def extract_text(self):
        """
        Extract text from image using Tesseract OCR
        
        Returns:
            bool: True if extraction successful, False otherwise
        """
        try:
            # Read image
            image = cv2.imread(self.image_path)
            if image is None:
                raise ValueError("Failed to read image")
            
            # Preprocess image
            processed = self.preprocess_image(image)
            
            # Convert numpy array to PIL Image for pytesseract
            pil_image = Image.fromarray(processed)
            
            # Extract text using Tesseract with multi-language support
            # --oem 1: LSTM neural net mode (best accuracy)
            # --psm 3: Auto page segmentation (best for mixed content)
            # lang: English + Hindi + Marathi (Indian law enforcement docs)
            config = r'--oem 1 --psm 3'
            
            # Try with multiple languages (English + Hindi + Marathi)
            try:
                self.raw_text = pytesseract.image_to_string(
                    pil_image, 
                    lang='eng+hin+mar',  # Multi-language support
                    config=config
                )
            except Exception as lang_error:
                # Fallback to English-only if Hindi/Marathi not installed
                print(f"  Note: Using English-only (install Hindi/Marathi data for better results)")
                self.raw_text = pytesseract.image_to_string(pil_image, config=config)
            
            # Calculate confidence (Tesseract doesn't provide direct confidence for full text)
            # Better estimate: text length normalized
            if self.raw_text.strip():
                text_length = len(self.raw_text.strip())
                # Award confidence based on reasonable text length (200-2000 chars is good)
                if text_length > 100:
                    self.confidence = min(0.90, 0.50 + (text_length / 5000))
                else:
                    self.confidence = max(0.30, text_length / 500)
            else:
                self.confidence = 0.0
            
            return True
        except pytesseract.TesseractNotFoundError:
            print("ERROR: Tesseract is not installed or path is incorrect")
            print("Install Tesseract from: https://github.com/UB-Mannheim/tesseract/wiki")
            return False
        except Exception as e:
            print(f"Text extraction error: {str(e)}")
            return False
    
    def translate_text(self):
        """
        Translate extracted text using IndicTrans2
        
        Returns:
            bool: True if translation succeeded, False otherwise
        """
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
        """
        Generate JSON output with extracted text, translation, and confidence
        
        Returns:
            dict: Output JSON with raw_text, translated_text, and metadata
        """
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
        """
        Complete OCR pipeline: validate, extract, translate, return JSON
        
        Returns:
            dict: JSON output or None if processing failed
        """
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
    """
    Command-line interface for OCR module
    Usage: python ocr.py <image_path> [--tesseract-path path/to/tesseract.exe]
    """
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
        auto_translate=not args.no_translate
    )
    if args.aggressive:
        print("  Using aggressive preprocessing for low-quality images...")
    
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
