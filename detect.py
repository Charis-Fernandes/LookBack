import sys
import json
import os
from ultralytics import YOLO

def detect_objects(image_path):
    # Validate input file
    if not os.path.exists(image_path):
        print(f"Error: File '{image_path}' not found.", file=sys.stderr)
        sys.exit(1)
    
    # Check if file is an image
    valid_extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp'}
    if not any(image_path.lower().endswith(ext) for ext in valid_extensions):
        print(f"Error: '{image_path}' is not a valid image file.", file=sys.stderr)
        sys.exit(1)
    
    try:
        # Load YOLO model
        model = YOLO("yolov8n.pt")
        
        # Run inference
        results = model(image_path, verbose=False)
        
        detected_objects = set()
        confidence_scores = []
        
        for result in results:
            if result.boxes is not None:
                for cls_id, conf in zip(result.boxes.cls, result.boxes.conf):
                    label = model.names[int(cls_id)]
                    detected_objects.add(label)
                    confidence_scores.append(float(conf))
        
        # Calculate average confidence
        avg_confidence = sum(confidence_scores) / len(confidence_scores) if confidence_scores else 0.0
        
        # Create output
        output = {
            "tags": sorted(list(detected_objects)),
            "confidence": round(avg_confidence, 2)
        }
        
        # Print to stdout
        print(json.dumps(output))
        
        return output
        
    except Exception as e:
        print(f"Error processing image: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python detect.py <image_path>", file=sys.stderr)
        sys.exit(1)
    
    detect_objects(sys.argv[1])
