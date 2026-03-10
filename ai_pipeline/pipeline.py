

import json
import argparse
import sys
from pathlib import Path
from typing import Dict, Optional

# Import the OCR and Classifier modules
from src.ocr import OCRModule
from classify import DocumentClassifier


class LookBackPipeline:
    
    
    def __init__(self, image_path: str, aggressive: bool = True, output_path: Optional[str] = None):
        
        self.image_path = image_path
        self.aggressive = aggressive
        self.output_path = output_path
        self.final_output = {}
        
    def run(self) -> Dict:
        
        print("\n" + "="*60)
        print("LookBack Document Processing Pipeline")
        print("="*60)
        
        # Step 1: OCR
        print("\n[Step 1/2] Extracting text from image...")
        ocr_result = self._run_ocr()
        if ocr_result is None:
            print("ERROR: OCR extraction failed")
            return None
        
        print(f"  [OK] Extracted {len(ocr_result['raw_text'])} characters")
        print(f"  [OK] OCR Confidence: {ocr_result['ocr_confidence']:.2f}")
        
        # Step 2: Classification
        print("\n[Step 2/2] Classifying document type...")
        classification_result = self._run_classification(ocr_result)
        if classification_result is None:
            print("ERROR: Classification failed")
            return None
        
        print(f"  [OK] Document Type: {classification_result['doc_type']}")
        print(f"  [OK] Classification Confidence: {classification_result['confidence']:.2f}")
        
        # Combine results
        self.final_output = {
            "image_path": str(self.image_path),
            "processing_status": "success",
            "ocr": ocr_result,
            "classification": classification_result,
            "summary": {
                "detected_document_type": classification_result['doc_type'],
                "ocr_confidence": ocr_result['ocr_confidence'],
                "classification_confidence": classification_result['confidence'],
                "text_preview": ocr_result['raw_text'][:200] + "..." if len(ocr_result['raw_text']) > 200 else ocr_result['raw_text']
            }
        }
        
        # Save if output path specified
        if self.output_path:
            self._save_output()
        
        return self.final_output
    
    def _run_ocr(self) -> Optional[Dict]:
        
        try:
            ocr = OCRModule(
                self.image_path,
                aggressive=self.aggressive,
                auto_translate=False  # Skip translation due to Python 3.13 compatibility
            )
            return ocr.process()
        except Exception as e:
            print(f"  ERROR: {str(e)}")
            return None
    
    def _run_classification(self, ocr_result: Dict) -> Optional[Dict]:
        
        try:
            # Create temporary JSON file with OCR output for classifier
            temp_ocr_json = "temp_ocr_output.json"
            with open(temp_ocr_json, 'w') as f:
                json.dump(ocr_result, f)
            
            # Classify using DistilBERT model
            classifier = DocumentClassifier(
                translation_json_path=temp_ocr_json,
                model_path="models/distilbert_classifier"
            )
            
            if not classifier.classify():
                print("  ERROR: Classification failed")
                return None
            
            # Clean up temp file
            Path(temp_ocr_json).unlink(missing_ok=True)
            
            return classifier.get_output_json()
        except Exception as e:
            print(f"  ERROR: {str(e)}")
            return None
    
    def _save_output(self):
        
        try:
            with open(self.output_path, 'w', encoding='utf-8') as f:
                json.dump(self.final_output, f, indent=2, ensure_ascii=False)
            print(f"\n[OK] Results saved to: {self.output_path}")
        except Exception as e:
            print(f"ERROR: Could not save output: {str(e)}")
    
    def print_summary(self):
        
        if not self.final_output:
            print("No results to display")
            return
        
        print("\n" + "="*60)
        print("PROCESSING SUMMARY")
        print("="*60)
        summary = self.final_output.get('summary', {})
        print(f"\nDocument Type: {summary.get('detected_document_type', 'UNKNOWN')}")
        print(f"OCR Confidence: {summary.get('ocr_confidence', 0):.2%}")
        print(f"Classification Confidence: {summary.get('classification_confidence', 0):.2%}")
        print(f"\nText Preview:\n{summary.get('text_preview', 'N/A')}")
        print("\n" + "="*60)


def main():
    
    parser = argparse.ArgumentParser(
        description="LookBack Document Processing Pipeline - OCR + Classification"
    )
    parser.add_argument("image", help="Path to document image")
    parser.add_argument("--output", "-o", help="Output JSON file path", default="results.json")
    parser.add_argument("--aggressive", action="store_true", help="Use aggressive OCR preprocessing for low-quality images")
    
    args = parser.parse_args()
    
    # Check if image exists
    if not Path(args.image).exists():
        print(f"ERROR: Image file not found: {args.image}")
        sys.exit(1)
    
    # Run pipeline
    pipeline = LookBackPipeline(
        image_path=args.image,
        aggressive=args.aggressive,
        output_path=args.output
    )
    
    result = pipeline.run()
    
    if result:
        pipeline.print_summary()
        print("\n[OK] Pipeline completed successfully!")
        sys.exit(0)
    else:
        print("\n[ERROR] Pipeline failed!")
        sys.exit(1)


if __name__ == "__main__":
    main()
