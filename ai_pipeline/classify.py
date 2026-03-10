

import json
import logging
from pathlib import Path
from typing import Dict, Tuple, Optional
import numpy as np

try:
    import torch
    from transformers import AutoTokenizer, AutoModelForSequenceClassification
    HAS_TRANSFORMERS = True
except ImportError:
    HAS_TRANSFORMERS = False
    print("Warning: transformers library not found. Install with: pip install torch transformers")


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DocumentClassifier:
    

    DOCUMENT_TYPES = ["FIR", "ID_CARD", "CHARGE_SHEET", "POLICE_REPORT"]

    # Fallback keyword-based classification if model not available
    KEYWORDS = {
        "FIR": [
            "first information report", "fir", "complaint",
            "informant", "accused", "offence", "crime",
            "police station", "section", "ipc"
        ],
        "ID_CARD": [
            "identification", "voter id", "aadhar", "aadhaar",
            "pan card", "driving license", "passport",
            "date of birth", "signature", "photograph",
            "citizen", "resident", "address"
        ],
        "CHARGE_SHEET": [
            "charge sheet", "chargesheet", "investigation",
            "charge", "accused person", "offence proved",
            "evidence", "witness", "conviction",
            "penal code", "section", "charges"
        ],
        "POLICE_REPORT": [
            "police report", "incident report", "case",
            "officer", "badge number", "date", "time",
            "location", "witness", "statement",
            "patrol", "dispatch", "report number"
        ]
    }

    def __init__(self, translation_json_path: Optional[str] = None, 
                 model_path: str = "models/distilbert_classifier"):
        
        self.translation_json_path = translation_json_path
        self.model_path = Path(model_path)
        
        self.model = None
        self.tokenizer = None
        self.device = None
        self.using_fallback = False
        self.classification_result = {}
        
        self._setup_device()
        self._load_model()

    def _setup_device(self):
        
        if HAS_TRANSFORMERS:
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
            logger.info(f"Using device: {self.device}")
        else:
            logger.warning("PyTorch not available, will use keyword fallback only")

    def _load_model(self):
        
        if not HAS_TRANSFORMERS:
            logger.warning("Transformers library not available, using keyword fallback")
            self.using_fallback = True
            return

        if not self.model_path.exists():
            logger.warning(
                f"Model not found at {self.model_path}. Using keyword fallback.\n"
                f"Train model in Google Colab: train_classifier.py"
            )
            self.using_fallback = True
            return

        required_files = ["config.json", "model.safetensors", "tokenizer.json"]
        missing_files = [
            file_name
            for file_name in required_files
            if not (self.model_path / file_name).exists()
        ]
        if missing_files:
            logger.warning(
                "Model directory is incomplete at %s. Missing files: %s. "
                "Using keyword fallback.",
                self.model_path,
                ", ".join(missing_files),
            )
            self.using_fallback = True
            return

        try:
            logger.info(f"Loading DistilBERT model from {self.model_path}")

            # Prefer fast tokenizer, but gracefully fallback to slow tokenizer
            # when backend tokenizer dependencies are unavailable.
            try:
                self.tokenizer = AutoTokenizer.from_pretrained(
                    str(self.model_path),
                    local_files_only=True,
                    use_fast=True
                )
            except Exception as tokenizer_error:
                logger.warning(
                    "Fast tokenizer unavailable (%s). Falling back to slow tokenizer.",
                    tokenizer_error,
                )
                self.tokenizer = AutoTokenizer.from_pretrained(
                    str(self.model_path),
                    local_files_only=True,
                    use_fast=False
                )

            self.model = AutoModelForSequenceClassification.from_pretrained(
                str(self.model_path),
                local_files_only=True
            )
            self.model.to(self.device)
            self.model.eval()
            logger.info("Model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            logger.warning("Falling back to keyword-based classification")
            self.using_fallback = True

    def _read_translation_json(self) -> str:
        
        if not self.translation_json_path:
            return ""

        try:
            with open(self.translation_json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                # Try various text field names in order of preference
                return (
                    data.get('translated_text') or 
                    data.get('original_text') or 
                    data.get('raw_text') or 
                    data.get('processed_text', '')
                )
        except Exception as e:
            logger.warning(f"Could not read translation JSON: {e}")
            return ""

    def _classify_with_model(self, text: str) -> Tuple[str, float]:
        
        if not self.model or not self.tokenizer:
            return "UNKNOWN", 0.0

        try:
            # Truncate text to max 512 tokens (DistilBERT limit)
            inputs = self.tokenizer(
                text[:2000],  # Truncate to ~2000 chars first
                return_tensors="pt",
                truncation=True,
                max_length=512
            )
            inputs = {k: v.to(self.device) for k, v in inputs.items()}

            with torch.no_grad():
                outputs = self.model(**inputs)
                logits = outputs.logits
                probabilities = torch.softmax(logits, dim=-1)
                confidence = probabilities.max().item()
                predicted_label = logits.argmax(dim=-1).item()

            doc_type = self.DOCUMENT_TYPES[predicted_label]
            return doc_type, confidence

        except Exception as e:
            logger.error(f"Model classification error: {e}")
            return "UNKNOWN", 0.0

    def _classify_with_keywords(self, text: str) -> Tuple[str, float]:
        
        text_lower = text.lower()
        scores = {}

        for doc_type, keywords in self.KEYWORDS.items():
            matches = sum(1 for keyword in keywords if keyword in text_lower)
            scores[doc_type] = matches

        if not any(scores.values()):
            return "POLICE_REPORT", 0.3  # Default fallback

        best_type = max(scores, key=scores.get)
        max_matches = scores[best_type]
        # Confidence based on match ratio
        confidence = min(max_matches / 5.0, 0.95)

        return best_type, confidence

    def classify(self) -> bool:
        
        try:
            # Read translated text if available
            text = self._read_translation_json()
            
            if not text:
                logger.error("No text available for classification")
                return False

            # Classify using appropriate method
            if not self.using_fallback and self.model:
                doc_type, confidence = self._classify_with_model(text)
                method = "DistilBERT"
            else:
                doc_type, confidence = self._classify_with_keywords(text)
                method = "Keywords" if self.using_fallback else "Keywords (Fallback)"

            self.classification_result = {
                "doc_type": doc_type,
                "confidence": float(confidence),
                "method": method,
                "valid_types": self.DOCUMENT_TYPES
            }

            logger.info(
                f"Classification: {doc_type} "
                f"(confidence: {confidence:.2f}, method: {method})"
            )
            return True

        except Exception as e:
            logger.error(f"Classification failed: {e}")
            return False

    def get_output_json(self) -> Dict:
        
        return self.classification_result

    def save_output(self, output_path: str):
        
        try:
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(self.classification_result, f, indent=2, ensure_ascii=False)
            logger.info(f"Classification saved to {output_path}")
        except Exception as e:
            logger.error(f"Failed to save classification: {e}")


def main():
    
    import argparse

    parser = argparse.ArgumentParser(
        description="Classify document using fine-tuned DistilBERT"
    )
    parser.add_argument(
        "translation_json",
        help="Path to translated JSON file from translate.py"
    )
    parser.add_argument(
        "--model", 
        default="models/distilbert_classifier",
        help="Path to fine-tuned DistilBERT model (default: models/distilbert_classifier)"
    )
    parser.add_argument(
        "-o", "--output",
        help="Path to save JSON output"
    )

    args = parser.parse_args()

    # Classify
    classifier = DocumentClassifier(
        translation_json_path=args.translation_json,
        model_path=args.model
    )

    if classifier.classify():
        result = classifier.get_output_json()
        print(json.dumps(result, indent=2))

        if args.output:
            classifier.save_output(args.output)
    else:
        print("Classification failed")
        exit(1)


if __name__ == "__main__":
    main()
