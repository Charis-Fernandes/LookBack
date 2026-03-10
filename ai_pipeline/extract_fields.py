"""
Legal Field Extraction Module for LookBack
Extracts FIR number, date, sections, names, and other legal fields from OCR text.
Uses regex patterns + keyword matching for Indian legal documents.

Usage:
    python extract_fields.py ocr_output.json
    python extract_fields.py ocr_output.json --output extracted.json
    python extract_fields.py "raw text here" --text
"""

import json
import re
import sys
import argparse
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime


class LegalFieldExtractor:
    """
    Extracts structured legal fields from OCR text of Indian law enforcement documents.

    Supports:
    - FIR documents
    - Charge sheets
    - Police reports
    - ID cards
    """

    # ── IPC / BNS Section Descriptions ──────────────────────────────
    IPC_SECTIONS = {
        "302": "Murder",
        "304": "Culpable Homicide",
        "304A": "Death by Negligence",
        "306": "Abetment of Suicide",
        "307": "Attempt to Murder",
        "323": "Voluntarily Causing Hurt",
        "341": "Wrongful Restraint",
        "342": "Wrongful Confinement",
        "354": "Assault on Woman",
        "363": "Kidnapping",
        "365": "Kidnapping for Ransom",
        "376": "Rape",
        "379": "Theft",
        "380": "Theft in Dwelling House",
        "384": "Extortion",
        "392": "Robbery",
        "395": "Dacoity",
        "406": "Criminal Breach of Trust",
        "411": "Dishonestly Receiving Stolen Property",
        "420": "Cheating",
        "447": "Criminal Trespass",
        "452": "House Trespass",
        "467": "Forgery of Valuable Security",
        "468": "Forgery for Cheating",
        "471": "Using Forged Document",
        "498A": "Cruelty by Husband",
        "504": "Intentional Insult",
        "506": "Criminal Intimidation",
        "509": "Word/Gesture to Insult Modesty",
        "34": "Common Intention",
        "120B": "Criminal Conspiracy",
        "147": "Rioting",
        "148": "Rioting with Deadly Weapon",
        "149": "Unlawful Assembly",
        "153A": "Promoting Enmity",
        "186": "Obstructing Public Servant",
        "279": "Rash Driving",
    }

    # ── Regex Patterns ──────────────────────────────────────────────
    PATTERNS = {
        "fir_no": [
            r'FIR\s*(?:No|Number|NUM|#|no\.?)[\s.:_\-]*(\d{1,6}\s*/\s*\d{4})',
            r'FIR\s*(?:No|Number|NUM|#|no\.?)[\s.:_\-]*(\d{1,6})',
            r'F\.?I\.?R\.?\s*(?:No|Number)?[\s.:_\-]*(\d{1,6}\s*/\s*\d{4})',
            r'(?:First Information Report)\s*(?:No|Number)?[\s.:_\-]*(\d{1,6}\s*/\s*\d{4})',
            r'(?:Case|Crime)\s*(?:No|Number)[\s.:_\-]*(\d{1,6}\s*/\s*\d{4})',
        ],
        "date": [
            r'(?:Date|Dated|dt|Dt)[\s.:_\-]*(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})',
            r'(?:Date|Dated|dt|Dt)[\s.:_\-]*(\d{1,2}\s+\w+\s+\d{4})',
            r'(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})',
            r'(\d{1,2}\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,]*\d{2,4})',
            r'(\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2})',
        ],
        "sections": [
            r'(?:Sections?|Sec)[\s.:_\-]*(\d{1,3}[A-Za-z]?(?:\s*,\s*\d{1,3}[A-Za-z]?)*)',
            r'(?:IPC|BNS|CrPC|CRPC)[\s.:_\-]*(?:Section|Sec|S\.)?[\s.:_\-]*(\d{1,3}[A-Za-z]?(?:[,/\s]+\d{1,3}[A-Za-z]?)*)',
            r'(?:under|U/S|u/s)[\s.:_\-]*(?:sections?)?[\s.:_\-]*(\d{1,3}[A-Za-z]?(?:[,/\s]+\d{1,3}[A-Za-z]?)*)',
            r'(?:offence|offense|charged)[\s.:_\-]*(?:under|u/s)?[\s.:_\-]*(\d{1,3}[A-Za-z]?)',
            r'sections?\s+(\d{1,3}[A-Za-z]?(?:\s*,\s*\d{1,3}[A-Za-z]?)*)\s+(?:of\s+)?(?:IPC|BNS|Indian Penal)',
        ],
        "police_station": [
            r'(?:Police\s*Station|PS|P\.S\.|Thana)[\s.:_\-]*([A-Za-z\s]+?)(?:\n|,|\.|\d)',
            r'(?:Station)[\s.:_\-]*([A-Za-z\s]{3,30})',
        ],
        "complainant": [
            r'(?:Complainant|Informant|Informer|Plaintiff)[\s.:_\-]*(?:Name)?[\s.:_\-]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4})(?:\s*\n|\s*$)',
            r'(?:Name of (?:Complainant|Informant))[\s.:_\-]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4})(?:\s*\n|\s*$)',
            r'(?:Complainant|Informant|Informer|Plaintiff)[\s.:_\-]*(?:Name)?[\s.:_\-]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4})',
        ],
        "accused": [
            r'(?:Accused|Suspect|Defendant)[\s.:_\-]*(?:Name)?[\s.:_\-]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4})(?:\s*\n|\s*$)',
            r'(?:Name of (?:Accused|Suspect))[\s.:_\-]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4})(?:\s*\n|\s*$)',
            r'(?:Accused|Suspect|Defendant)[\s.:_\-]*(?:Name)?[\s.:_\-]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4})',
        ],
        "district": [
            r'(?:District|Dist|Distt)[\s.:_\-]*([A-Za-z\s]+?)(?:\n|,|\.|\d)',
        ],
        "state": [
            r'(?:State)[\s.:_\-]*([A-Za-z\s]+?)(?:\n|,|\.|\d)',
        ],
        "phone": [
            r'(?:Phone|Mobile|Contact|Tel|Mob)[\s.:_\-]*(\+?\d[\d\s\-]{8,14})',
            r'(\+91[\s\-]?\d{10})',
            r'(?<!\d)([6-9]\d{9})(?!\d)',
        ],
        "aadhaar": [
            r'(?:Aadhaar|Aadhar|UIDAI|UID)[\s.:_\-]*(\d{4}\s*\d{4}\s*\d{4})',
            r'(\d{4}\s\d{4}\s\d{4})',
        ],
        "pan": [
            r'(?:PAN|P\.A\.N)[\s.:_\-]*([A-Z]{5}\d{4}[A-Z])',
            r'([A-Z]{5}\d{4}[A-Z])',
        ],
    }

    def __init__(self, text: str = "", ocr_json_path: str = None):
        """
        Initialize extractor with text or OCR JSON file.

        Args:
            text: Raw text to extract from
            ocr_json_path: Path to OCR output JSON file
        """
        self.raw_text = text
        self.ocr_data = {}
        self.extracted_fields = {}
        self.confidence = 0.0

        if ocr_json_path:
            self._load_ocr_json(ocr_json_path)

    def _load_ocr_json(self, json_path: str):
        """Load OCR output JSON file."""
        path = Path(json_path)
        if not path.exists():
            raise FileNotFoundError(f"OCR JSON file not found: {json_path}")

        with open(path, 'r', encoding='utf-8') as f:
            self.ocr_data = json.load(f)

        # Support multiple JSON structures from different modules
        if "raw_text" in self.ocr_data:
            self.raw_text = self.ocr_data["raw_text"]
        elif "text" in self.ocr_data:
            self.raw_text = self.ocr_data["text"]
        elif "translated_text" in self.ocr_data:
            self.raw_text = self.ocr_data["translated_text"]
        else:
            raise ValueError("JSON must contain 'raw_text', 'text', or 'translated_text' field")

    # ── Extraction Methods ──────────────────────────────────────────

    def extract_fir_number(self) -> Optional[str]:
        """Extract FIR number from text."""
        for pattern in self.PATTERNS["fir_no"]:
            match = re.search(pattern, self.raw_text, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        return None

    def extract_dates(self) -> List[str]:
        """Extract all dates from text and normalize format."""
        dates = []
        seen = set()

        for pattern in self.PATTERNS["date"]:
            matches = re.finditer(pattern, self.raw_text, re.IGNORECASE)
            for match in matches:
                raw_date = match.group(1).strip()
                normalized = self._normalize_date(raw_date)
                if normalized and normalized not in seen:
                    dates.append(normalized)
                    seen.add(normalized)

        return dates

    def _normalize_date(self, date_str: str) -> Optional[str]:
        """Normalize date to YYYY-MM-DD format."""
        formats = [
            "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y",
            "%d/%m/%y", "%d-%m-%y", "%d.%m.%y",
            "%Y/%m/%d", "%Y-%m-%d",
            "%d %B %Y", "%d %b %Y",
            "%d %B, %Y", "%d %b, %Y",
        ]
        for fmt in formats:
            try:
                dt = datetime.strptime(date_str.strip(), fmt)
                if dt.year < 100:
                    dt = dt.replace(year=dt.year + 2000)
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                continue
        return date_str

    # Procedural sections to ignore (CrPC sections commonly referenced in headers)
    IGNORE_SECTIONS = {"154", "155", "156", "157", "161", "164", "173", "190", "200", "202", "204"}

    def extract_sections(self) -> List[Dict]:
        """Extract IPC/BNS sections from text."""
        sections = []
        seen = set()

        for pattern in self.PATTERNS["sections"]:
            matches = re.finditer(pattern, self.raw_text, re.IGNORECASE)
            for match in matches:
                raw = match.group(1).strip()
                parts = re.split(r'[,/\s]+', raw)
                for part in parts:
                    part = part.strip()
                    if (part
                        and re.match(r'^\d{1,3}[A-Za-z]?$', part)
                        and part not in seen
                        and part not in self.IGNORE_SECTIONS):
                        seen.add(part)
                        description = self.IPC_SECTIONS.get(part, "Unknown Section")
                        sections.append({
                            "section": part,
                            "description": description
                        })

        return sections

    def extract_police_station(self) -> Optional[str]:
        """Extract police station name."""
        for pattern in self.PATTERNS["police_station"]:
            match = re.search(pattern, self.raw_text, re.IGNORECASE)
            if match:
                station = match.group(1).strip()
                if len(station) > 2:
                    return station
        return None

    def extract_names(self, field: str = "complainant") -> List[str]:
        """Extract names (complainant or accused)."""
        names = []
        patterns = self.PATTERNS.get(field, [])
        for pattern in patterns:
            matches = re.finditer(pattern, self.raw_text)
            for match in matches:
                name = match.group(1).strip()
                if len(name) > 2 and name not in names:
                    names.append(name)
        return names

    def extract_identifiers(self) -> Dict:
        """Extract Aadhaar, PAN, phone numbers."""
        identifiers = {}

        # Phone numbers
        phones = []
        for pattern in self.PATTERNS["phone"]:
            matches = re.finditer(pattern, self.raw_text)
            for match in matches:
                phone = re.sub(r'[\s\-]', '', match.group(1) if match.groups() else match.group())
                if phone not in phones:
                    phones.append(phone)
        if phones:
            identifiers["phone_numbers"] = phones

        # Aadhaar
        for pattern in self.PATTERNS["aadhaar"]:
            match = re.search(pattern, self.raw_text, re.IGNORECASE)
            if match:
                identifiers["aadhaar"] = re.sub(r'\s', '', match.group(1))
                break

        # PAN
        for pattern in self.PATTERNS["pan"]:
            match = re.search(pattern, self.raw_text)
            if match:
                identifiers["pan"] = match.group(1) if match.groups() else match.group()
                break

        return identifiers

    def extract_acts(self) -> List[str]:
        """Extract referenced legal acts."""
        acts = []
        act_names = {
            r'Indian Penal Code|IPC': "Indian Penal Code (IPC)",
            r'Bharatiya Nyaya Sanhita|BNS': "Bharatiya Nyaya Sanhita (BNS)",
            r'Code of Criminal Procedure|CrPC|CRPC': "Code of Criminal Procedure (CrPC)",
            r'Bharatiya Nagarik Suraksha Sanhita|BNSS': "Bharatiya Nagarik Suraksha Sanhita (BNSS)",
            r'NDPS Act|Narcotics': "NDPS Act",
            r'IT Act|Information Technology': "IT Act",
            r'Arms Act': "Arms Act",
            r'SC/ST.*Act|Atrocities.*Act': "SC/ST (Prevention of Atrocities) Act",
            r'POCSO|Protection of Children': "POCSO Act",
            r'Dowry Prohibition': "Dowry Prohibition Act",
            r'Motor Vehicles Act|MV Act': "Motor Vehicles Act",
        }
        for pattern, name in act_names.items():
            if re.search(pattern, self.raw_text, re.IGNORECASE):
                if name not in acts:
                    acts.append(name)
        return acts

    def extract_district_state(self) -> Dict:
        """Extract district and state."""
        result = {}
        for pattern in self.PATTERNS["district"]:
            match = re.search(pattern, self.raw_text, re.IGNORECASE)
            if match:
                result["district"] = match.group(1).strip()
                break
        for pattern in self.PATTERNS["state"]:
            match = re.search(pattern, self.raw_text, re.IGNORECASE)
            if match:
                result["state"] = match.group(1).strip()
                break
        return result

    # ── Main Extraction ─────────────────────────────────────────────

    def extract_all(self) -> Dict:
        """Run all extraction methods and return structured output."""
        if not self.raw_text:
            return {"error": "No text to process", "fields_extracted": 0}

        fir_no = self.extract_fir_number()
        dates = self.extract_dates()
        sections = self.extract_sections()
        police_station = self.extract_police_station()
        complainants = self.extract_names("complainant")
        accused = self.extract_names("accused")
        identifiers = self.extract_identifiers()
        acts = self.extract_acts()
        location = self.extract_district_state()

        self.extracted_fields = {
            "fir_no": fir_no,
            "date": dates[0] if dates else None,
            "all_dates": dates if len(dates) > 1 else None,
            "sections": [s["section"] for s in sections],
            "sections_detailed": sections if sections else None,
            "police_station": police_station,
            "complainant": complainants[0] if complainants else None,
            "accused": accused if accused else None,
            "acts_referenced": acts if acts else None,
            "identifiers": identifiers if identifiers else None,
        }

        if location:
            self.extracted_fields.update(location)

        # Remove None values
        self.extracted_fields = {
            k: v for k, v in self.extracted_fields.items() if v is not None
        }

        self._calculate_confidence()
        return self.extracted_fields

    def _calculate_confidence(self):
        """Calculate extraction confidence based on fields found."""
        total_fields = 8
        found = 0
        for key in ["fir_no", "date", "sections", "police_station",
                     "complainant", "accused", "acts_referenced", "identifiers"]:
            if self.extracted_fields.get(key):
                found += 1
        self.confidence = round(found / total_fields, 2)

    def get_output(self) -> Dict:
        """Get final structured output with metadata."""
        if not self.extracted_fields:
            self.extract_all()

        fields_count = len([v for v in self.extracted_fields.values() if v])

        output = {
            "status": "success" if fields_count > 0 else "no_fields_found",
            "fields_extracted": fields_count,
            "confidence": self.confidence,
            "extracted_data": self.extracted_fields,
        }

        if self.ocr_data.get("confidence"):
            output["ocr_confidence"] = self.ocr_data["confidence"]

        return output

    def process(self) -> Dict:
        """Complete extraction pipeline. Returns structured output."""
        self.extract_all()
        return self.get_output()


def main():
    """CLI interface for legal field extraction."""
    parser = argparse.ArgumentParser(
        description="LookBack Legal Field Extractor - Extract structured data from OCR text"
    )
    parser.add_argument(
        "input",
        type=str,
        help="Path to OCR output JSON file, or raw text (with --text flag)"
    )
    parser.add_argument(
        "--text",
        action="store_true",
        help="Treat input as raw text instead of a file path"
    )
    parser.add_argument(
        "--output", "-o",
        type=str,
        default=None,
        help="Save output to JSON file"
    )
    parser.add_argument(
        "--detailed",
        action="store_true",
        help="Show detailed section descriptions"
    )

    args = parser.parse_args()

    try:
        if args.text:
            extractor = LegalFieldExtractor(text=args.input)
        else:
            extractor = LegalFieldExtractor(ocr_json_path=args.input)

        result = extractor.process()

        if not args.detailed and "extracted_data" in result:
            result["extracted_data"].pop("sections_detailed", None)
            result["extracted_data"].pop("all_dates", None)

        output_json = json.dumps(result, indent=2, ensure_ascii=False)
        print(output_json)

        if args.output:
            with open(args.output, 'w', encoding='utf-8') as f:
                f.write(output_json)
            print(f"\n✅ Output saved to: {args.output}", file=sys.stderr)

    except FileNotFoundError as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)
    except ValueError as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": f"Unexpected: {e}"}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
