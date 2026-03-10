"""
Complete LookBack Document Processing Pipeline
Chains: Image → OCR → Classification → Field Extraction → Detection → JSON Output

Usage:
    python pipeline.py <image_path> [--output output.json] [--aggressive]

Example:
    python pipeline.py samples/sample_fir_img.png --output results.json --aggressive
"""

import json
import argparse
import sys
import io
import os
from pathlib import Path
from typing import Dict, Optional

# Import the modules
from src.ocr import OCRModule
from classify import DocumentClassifier
from extract_fields import LegalFieldExtractor


class LookBackPipeline:
    """
    Complete document processing pipeline for law enforcement documents.

    Processes:
    1. OCR: Extract text from image using Tesseract
    2. Classification: Classify document type using DistilBERT
    3. Field Extraction: Extract structured legal fields (FIR no, dates, sections)
    4. Detection: Object detection using YOLOv8
    """

    def __init__(self, image_path: str, aggressive: bool = True, output_path: Optional[str] = None):
        """
        Initialize the pipeline.

        Args:
            image_path: Path to input document image
            aggressive: Use aggressive OCR preprocessing for low-quality images
            output_path: Optional path to save final JSON output
        """
        self.image_path = image_path
        self.aggressive = aggressive
        self.output_path = output_path
        self.final_output = {}

    def run(self) -> Dict:
        """
        Execute the complete pipeline: OCR → Classification → Extraction → Detection

        Returns:
            Dictionary with processing results
        """
        print("\n" + "="*60)
        print("LookBack Document Processing Pipeline")
        print("="*60)

        # Step 1: OCR
        print("\n[Step 1/4] Extracting text from image...")
        ocr_result = self._run_ocr()
        if ocr_result is None:
            print("ERROR: OCR extraction failed")
            return None

        print(f"  [OK] Extracted {len(ocr_result.get('raw_text', ''))} characters")
        print(f"  [OK] OCR Confidence: {ocr_result.get('ocr_confidence', ocr_result.get('confidence', 0)):.2f}")

        # Step 2: Classification
        print("\n[Step 2/4] Classifying document type...")
        classification_result = self._run_classification(ocr_result)
        if classification_result is None:
            print("  [WARN] Classification failed, continuing...")
            classification_result = {"doc_type": "UNKNOWN", "confidence": 0.0, "method": "N/A"}
        else:
            print(f"  [OK] Document Type: {classification_result['doc_type']}")
            print(f"  [OK] Classification Confidence: {classification_result['confidence']:.2f}")

        # Step 3: Field Extraction
        print("\n[Step 3/4] Extracting legal fields...")
        extraction_result = self._run_field_extraction(ocr_result)
        if extraction_result is None:
            print("  [WARN] Field extraction returned no results")
            extraction_result = {"status": "no_fields_found", "fields_extracted": 0, "confidence": 0.0, "extracted_data": {}}
        else:
            fields = extraction_result.get("extracted_data", {})
            count = extraction_result.get("fields_extracted", 0)
            print(f"  [OK] Extracted {count} fields")
            if fields.get("fir_no"):
                print(f"  [OK] FIR No: {fields['fir_no']}")
            if fields.get("date"):
                print(f"  [OK] Date: {fields['date']}")
            if fields.get("sections"):
                print(f"  [OK] Sections: {', '.join(fields['sections'])}")
            if fields.get("police_station"):
                print(f"  [OK] Station: {fields['police_station']}")
            if fields.get("complainant"):
                print(f"  [OK] Complainant: {fields['complainant']}")
            if fields.get("acts_referenced"):
                print(f"  [OK] Acts: {', '.join(fields['acts_referenced'])}")

        # Step 4: Object Detection
        print("\n[Step 4/4] Running object detection (YOLO)...")
        detection_result = self._run_detection()
        if detection_result is None:
            print("  [WARN] Detection skipped or unavailable")
            detection_result = {"tags": [], "confidence": 0.0}
        else:
            tags = detection_result.get("tags", [])
            print(f"  [OK] Detected {len(tags)} objects: {', '.join(tags) if tags else 'none'}")

        # Combine all results
        ocr_confidence = ocr_result.get('ocr_confidence', ocr_result.get('confidence', 0))

        self.final_output = {
            "image_path": str(self.image_path),
            "processing_status": "success",
            "ocr": ocr_result,
            "classification": classification_result,
            "field_extraction": extraction_result,
            "detection": detection_result,
            "summary": {
                "detected_document_type": classification_result.get('doc_type', 'UNKNOWN'),
                "ocr_confidence": ocr_confidence,
                "classification_confidence": classification_result.get('confidence', 0),
                "extraction_confidence": extraction_result.get('confidence', 0),
                "fields_extracted": extraction_result.get('fields_extracted', 0),
                "fir_no": extraction_result.get('extracted_data', {}).get('fir_no', 'N/A'),
                "date": extraction_result.get('extracted_data', {}).get('date', 'N/A'),
                "sections": extraction_result.get('extracted_data', {}).get('sections', []),
                "detected_objects": detection_result.get('tags', []),
                "text_preview": ocr_result.get('raw_text', '')[:200] + "..." if len(ocr_result.get('raw_text', '')) > 200 else ocr_result.get('raw_text', '')
            }
        }

        # Save if output path specified
        if self.output_path:
            self._save_output()

        return self.final_output

    def _run_ocr(self) -> Optional[Dict]:
        """Run OCR on the image."""
        try:
            ocr = OCRModule(
                self.image_path,
                aggressive=self.aggressive,
                auto_translate=False
            )
            return ocr.process()
        except Exception as e:
            print(f"  ERROR: {str(e)}")
            return None

    def _run_classification(self, ocr_result: Dict) -> Optional[Dict]:
        """Classify the document based on OCR text."""
        try:
            temp_ocr_json = "temp_ocr_output.json"
            with open(temp_ocr_json, 'w') as f:
                json.dump(ocr_result, f)

            classifier = DocumentClassifier(
                translation_json_path=temp_ocr_json,
                model_path="models/distilbert_classifier"
            )

            if not classifier.classify():
                print("  ERROR: Classification failed")
                return None

            Path(temp_ocr_json).unlink(missing_ok=True)
            return classifier.get_output_json()
        except Exception as e:
            print(f"  ERROR: {str(e)}")
            Path("temp_ocr_output.json").unlink(missing_ok=True)
            return None

    def _run_field_extraction(self, ocr_result: Dict) -> Optional[Dict]:
        """Run legal field extraction on OCR text."""
        try:
            raw_text = ocr_result.get("raw_text", "")
            if not raw_text:
                print("  [WARN] No text available for extraction")
                return None

            extractor = LegalFieldExtractor(text=raw_text)
            result = extractor.process()
            return result
        except Exception as e:
            print(f"  ERROR: {str(e)}")
            return None

    def _run_detection(self) -> Optional[Dict]:
        """Run YOLO object detection on the image."""
        try:
            # detect.py is in the parent directory — we need to run from there
            # so the YOLO model file (yolov8n.pt) is found
            parent_dir = str(Path(__file__).parent.parent)
            sys.path.insert(0, parent_dir)

            # Save and change to parent dir so yolov8n.pt is found
            original_cwd = os.getcwd()
            os.chdir(parent_dir)

            from detect import detect_objects

            # Capture stdout since detect_objects prints JSON
            old_stdout = sys.stdout
            sys.stdout = buffer = io.StringIO()

            # Use absolute path for the image
            abs_image = str(Path(original_cwd) / self.image_path) if not Path(self.image_path).is_absolute() else self.image_path
            detect_objects(abs_image)

            sys.stdout = old_stdout
            os.chdir(original_cwd)
            output = buffer.getvalue().strip()

            if output:
                # Take only the last line (JSON output), skip any YOLO logging
                lines = output.strip().split('\n')
                return json.loads(lines[-1])
            return {"tags": [], "confidence": 0.0}
        except SystemExit:
            # detect.py calls sys.exit on error, catch it
            sys.stdout = sys.__stdout__
            print("  [WARN] Detection module exited (image may not be suitable)")
            return {"tags": [], "confidence": 0.0}
        except ImportError:
            print("  [WARN] Detection module not available (install ultralytics)")
            return None
        except Exception as e:
            sys.stdout = sys.__stdout__
            print(f"  [WARN] Detection error: {e}")
            return None

    def _save_output(self):
        """Save final output to JSON file."""
        try:
            with open(self.output_path, 'w', encoding='utf-8') as f:
                json.dump(self.final_output, f, indent=2, ensure_ascii=False)
            print(f"\n[OK] Results saved to: {self.output_path}")
        except Exception as e:
            print(f"ERROR: Could not save output: {str(e)}")

    def print_summary(self):
        """Print a summary of the processing results."""
        if not self.final_output:
            print("No results to display")
            return

        summary = self.final_output.get('summary', {})

        print("\n" + "="*60)
        print("PROCESSING SUMMARY")
        print("="*60)
        print(f"\n  Image:            {self.image_path}")
        print(f"  Document Type:    {summary.get('detected_document_type', 'UNKNOWN')}")
        print(f"  OCR Confidence:   {summary.get('ocr_confidence', 0):.2%}")
        print(f"  Class Confidence: {summary.get('classification_confidence', 0):.2%}")
        print(f"  Extr Confidence:  {summary.get('extraction_confidence', 0):.2%}")
        print(f"  Fields Found:     {summary.get('fields_extracted', 0)}")
        print(f"  FIR No:           {summary.get('fir_no', 'N/A')}")
        print(f"  Date:             {summary.get('date', 'N/A')}")
        sections = summary.get('sections', [])
        print(f"  Sections:         {', '.join(sections) if sections else 'N/A'}")
        tags = summary.get('detected_objects', [])
        print(f"  Objects:          {', '.join(tags) if tags else 'none'}")
        print(f"\n  Text Preview:")
        print(f"  {summary.get('text_preview', 'N/A')}")
        print("\n" + "="*60)


def main():
    """Main entry point for the pipeline."""
    parser = argparse.ArgumentParser(
        description="LookBack Document Processing Pipeline - OCR + Classification + Extraction + Detection"
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
