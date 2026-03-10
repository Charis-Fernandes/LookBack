"""
Download training images from Bing Image Search
More reliable than Google Images for automated scraping
"""

from bing_image_downloader import downloader
import os

def download_images(query, folder, max_images=50):
    """Download images from Bing"""
    os.makedirs(folder, exist_ok=True)
    
    print(f"Downloading {max_images} images for: {query}")
    try:
        downloader.download(
            query,
            limit=max_images,
            output_dir="dataset",
            adult_filter_off=True,
            force_replace=False,
            timeout=60,
            verbose=False,
            silent_mode=True
        )
        print(f"✓ Downloaded to {folder}")
    except Exception as e:
        print(f"⚠ Error downloading {query}: {e}")


if __name__ == "__main__":
    searches = {
        "FIR": "first information report india legal document",
        "ID_CARD": "aadhaar pan voter id card india",
        "CHARGE_SHEET": "charge sheet police india document",
        "POLICE_REPORT": "police report form incident india"
    }

    for doc_type, query in searches.items():
        folder = f"dataset/{doc_type}"
        download_images(query, folder, max_images=30)

    print("\n✓ Download complete. Images saved to dataset/ folder")
    print("Use these images to populate dataset.csv with OCR outputs")
