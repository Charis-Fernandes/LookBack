"""
LookBack AI Pipeline - Flask API Server
Exposes the document processing pipeline as an HTTP endpoint.

Usage:
    python server.py                    # Start on default port 5000
    python server.py --port 8080        # Start on custom port
    python server.py --host 0.0.0.0     # Listen on all interfaces

Endpoints:
    POST /process       Process an image through the full pipeline
    POST /ocr           Run OCR only
    POST /classify      Run classification only (requires OCR text)
    POST /extract       Run field extraction only (requires OCR text)
    POST /detect        Run YOLO detection only
    GET  /health        Health check
"""

import os
import sys
import json
import time
import base64
import tempfile
import argparse
from pathlib import Path
from flask import Flask, request, jsonify
from flask_cors import CORS

# Ensure ai_pipeline modules are importable
AI_PIPELINE_DIR = Path(__file__).parent.resolve()
REPO_ROOT = AI_PIPELINE_DIR.parent.resolve()
sys.path.insert(0, str(AI_PIPELINE_DIR))
sys.path.insert(0, str(REPO_ROOT))

from pipeline import LookBackPipeline
from src.ocr import OCRModule
from classify import DocumentClassifier
from extract_fields import LegalFieldExtractor

app = Flask(__name__)
CORS(app)  # Allow React Native to call the API

# Temp directory for uploaded images
UPLOAD_DIR = AI_PIPELINE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)


def save_uploaded_image(request_data) -> str:
    """
    Save uploaded image to a temp file. Supports:
    - multipart/form-data with 'image' file field
    - JSON body with base64-encoded 'image' field
    
    Returns path to saved temp file.
    """
    if 'image' in request.files:
        # Multipart file upload
        file = request.files['image']
        ext = Path(file.filename).suffix or '.jpg'
        temp_path = UPLOAD_DIR / f"upload_{int(time.time() * 1000)}{ext}"
        file.save(str(temp_path))
        return str(temp_path)
    
    elif request.is_json and 'image' in request.json:
        # Base64 encoded image
        b64_data = request.json['image']
        
        # Strip data URL prefix if present (e.g., "data:image/jpeg;base64,...")
        if ',' in b64_data:
            header, b64_data = b64_data.split(',', 1)
            # Detect extension from header
            if 'png' in header:
                ext = '.png'
            elif 'webp' in header:
                ext = '.webp'
            else:
                ext = '.jpg'
        else:
            ext = '.jpg'
        
        image_bytes = base64.b64decode(b64_data)
        temp_path = UPLOAD_DIR / f"upload_{int(time.time() * 1000)}{ext}"
        with open(temp_path, 'wb') as f:
            f.write(image_bytes)
        return str(temp_path)
    
    return None


def cleanup_temp_file(path: str):
    """Remove temp uploaded file."""
    try:
        if path and os.path.exists(path):
            os.remove(path)
    except Exception:
        pass


# ═══════════════════════════════════════════════════════════════════
# ROUTES
# ═══════════════════════════════════════════════════════════════════

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        "status": "ok",
        "service": "LookBack AI Pipeline",
        "version": "1.0.0",
        "timestamp": int(time.time() * 1000),
    })


@app.route('/process', methods=['POST'])
def process_document():
    """
    Full pipeline: Image → OCR → Classification → Field Extraction → Detection
    
    Accepts:
        - multipart/form-data with 'image' file
        - JSON with base64 'image' field
        - Optional 'aggressive' parameter (default: true)
    
    Returns:
        JSON with ocr, classification, field_extraction, detection, summary
    """
    temp_path = None
    try:
        temp_path = save_uploaded_image(request)
        if not temp_path:
            return jsonify({"error": "No image provided. Send as 'image' file or base64 JSON field."}), 400
        
        # Get options
        aggressive = True
        if request.is_json and 'aggressive' in request.json:
            aggressive = request.json['aggressive']
        elif 'aggressive' in request.form:
            aggressive = request.form['aggressive'].lower() in ('true', '1', 'yes')
        
        # Run the full pipeline from the ai_pipeline directory
        original_cwd = os.getcwd()
        os.chdir(str(AI_PIPELINE_DIR))
        
        pipeline = LookBackPipeline(
            image_path=temp_path,
            aggressive=aggressive,
        )
        result = pipeline.run()
        
        os.chdir(original_cwd)
        
        if result is None:
            return jsonify({"error": "Pipeline processing failed"}), 500
        
        # Remove raw image path from result for security
        result.pop('image_path', None)
        result['processing_status'] = 'success'
        result['processed_at'] = int(time.time() * 1000)
        
        return jsonify(result), 200
    
    except Exception as e:
        return jsonify({"error": str(e), "processing_status": "failed"}), 500
    
    finally:
        cleanup_temp_file(temp_path)


@app.route('/ocr', methods=['POST'])
def run_ocr():
    """Run OCR only on an uploaded image."""
    temp_path = None
    try:
        temp_path = save_uploaded_image(request)
        if not temp_path:
            return jsonify({"error": "No image provided."}), 400
        
        aggressive = True
        if request.is_json and 'aggressive' in request.json:
            aggressive = request.json['aggressive']
        
        ocr = OCRModule(temp_path, aggressive=aggressive, auto_translate=False)
        result = ocr.process()
        
        if result is None:
            return jsonify({"error": "OCR processing failed"}), 500
        
        return jsonify({"ocr": result, "processing_status": "success"}), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cleanup_temp_file(temp_path)


@app.route('/classify', methods=['POST'])
def run_classification():
    """
    Run classification on OCR text.
    Expects JSON body with 'ocr_text' field.
    """
    try:
        if not request.is_json or 'ocr_text' not in request.json:
            return jsonify({"error": "Provide 'ocr_text' in JSON body."}), 400
        
        ocr_text = request.json['ocr_text']
        
        # Create temp OCR JSON for classifier
        temp_json = str(UPLOAD_DIR / f"temp_ocr_{int(time.time() * 1000)}.json")
        with open(temp_json, 'w') as f:
            json.dump({"raw_text": ocr_text}, f)
        
        original_cwd = os.getcwd()
        os.chdir(str(AI_PIPELINE_DIR))
        
        classifier = DocumentClassifier(
            translation_json_path=temp_json,
            model_path="models/distilbert_classifier"
        )
        classifier.classify()
        result = classifier.get_output_json()
        
        os.chdir(original_cwd)
        cleanup_temp_file(temp_json)
        
        return jsonify({"classification": result, "processing_status": "success"}), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/extract', methods=['POST'])
def run_extraction():
    """
    Run field extraction on OCR text.
    Expects JSON body with 'ocr_text' field.
    """
    try:
        if not request.is_json or 'ocr_text' not in request.json:
            return jsonify({"error": "Provide 'ocr_text' in JSON body."}), 400
        
        ocr_text = request.json['ocr_text']
        extractor = LegalFieldExtractor(text=ocr_text)
        result = extractor.process()
        
        return jsonify({"field_extraction": result, "processing_status": "success"}), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/detect', methods=['POST'])
def run_detection():
    """Run YOLO object detection on an uploaded image."""
    temp_path = None
    try:
        temp_path = save_uploaded_image(request)
        if not temp_path:
            return jsonify({"error": "No image provided."}), 400
        
        import io
        original_cwd = os.getcwd()
        os.chdir(str(REPO_ROOT))
        
        from detect import detect_objects
        
        old_stdout = sys.stdout
        sys.stdout = buffer = io.StringIO()
        
        detect_objects(temp_path)
        
        sys.stdout = old_stdout
        os.chdir(original_cwd)
        
        output = buffer.getvalue().strip()
        if output:
            lines = output.strip().split('\n')
            result = json.loads(lines[-1])
        else:
            result = {"tags": [], "confidence": 0.0}
        
        return jsonify({"detection": result, "processing_status": "success"}), 200
    
    except SystemExit:
        sys.stdout = sys.__stdout__
        return jsonify({"detection": {"tags": [], "confidence": 0.0}, "processing_status": "success"}), 200
    except Exception as e:
        sys.stdout = sys.__stdout__
        return jsonify({"error": str(e)}), 500
    finally:
        cleanup_temp_file(temp_path)


# ═══════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="LookBack AI Pipeline API Server")
    parser.add_argument('--host', default='0.0.0.0', help='Host to bind to (default: 0.0.0.0)')
    parser.add_argument('--port', type=int, default=5000, help='Port to listen on (default: 5000)')
    parser.add_argument('--debug', action='store_true', help='Enable debug mode')
    
    args = parser.parse_args()
    
    print(f"\n{'='*60}")
    print(f"  LookBack AI Pipeline Server")
    print(f"  Listening on http://{args.host}:{args.port}")
    print(f"{'='*60}")
    print(f"  Endpoints:")
    print(f"    POST /process   - Full pipeline (OCR+Classification+Extraction+Detection)")
    print(f"    POST /ocr       - OCR only")
    print(f"    POST /classify  - Classification only")
    print(f"    POST /extract   - Field extraction only")
    print(f"    POST /detect    - YOLO detection only")
    print(f"    GET  /health    - Health check")
    print(f"{'='*60}\n")
    
    app.run(host=args.host, port=args.port, debug=args.debug)
