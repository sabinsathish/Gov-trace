import os
import re
import json
import docx
import requests
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS

# Optional PDF support
try:
    from pypdf import PdfReader
    PDF_OK = True
except Exception:
    PDF_OK = False

app = Flask(__name__)
CORS(app)

# ================== CONFIG ==================
API_URL = "http://134.199.198.69:8000/v1/chat/completions"
API_TOKEN = "KIxzeM7xhvg9/8j9BY2g3TGgTukXCu8lRIEngdHTCB33i4g8I"  # Put your token locally
MODEL_NAME = "openai/gpt-oss-120b"
TIMEOUT = 80
# ===========================================

schemes_db = []
all_criteria_keys = set()


# -----------------------
# Helpers: read content
# -----------------------
def read_docx(file_path: str) -> str:
    doc = docx.Document(file_path)
    parts = []
    for p in doc.paragraphs:
        t = (p.text or "").strip()
        if t:
            parts.append(t)
    return "\n".join(parts)

def read_txt(file_path: str) -> str:
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        return f.read()

def read_pdf(file_path: str) -> str:
    if not PDF_OK:
        return ""
    reader = PdfReader(file_path)
    out = []
    for page in reader.pages:
        try:
            out.append(page.extract_text() or "")
        except Exception:
            pass
    return "\n".join(out).strip()

def read_any_file(file_path: str, filename: str) -> tuple[str, str]:
    ext = (os.path.splitext(filename)[1] or "").lower().strip(".")
    if ext == "docx":
        return ("text", read_docx(file_path))
    if ext == "txt":
        return ("text", read_txt(file_path))
    if ext == "pdf":
        return ("text", read_pdf(file_path))
    if ext == "json":
        return ("json", read_txt(file_path))
    return ("text", read_txt(file_path))


# -----------------------
# GPT Extraction
# -----------------------
def extract_schemes_with_gpt(text: str):
    system_prompt = (
        "You are an expert on Indian government schemes. "
        "Extract scheme information into strict JSON."
    )

    user_prompt = f"""
You will be given text describing one or more Indian government schemes.

Return ONLY a JSON array (no extra text). Each scheme object must have:
- scheme_name (string)
- benefits (string)
- criteria (object) with eligibility rules

Criteria rules (be consistent):
1) Use *_min and *_max for numeric ranges (age_min, age_max, income_max, disability_percentage_min, etc.)
2) Use *_required booleans for yes/no requirements (disability_required, widow_required, student_required, etc.)
3) Use *_allowed arrays for categorical constraints:
   gender_allowed, category_allowed, residence_type_allowed, state_allowed, district_allowed, occupation_allowed
If the document says "only women", use gender_allowed:["Female"].
If it says "BPL only", use bpl_required:true.
If it says "SC/ST", use category_allowed:["SC","ST"].

Text:
{text}
"""

    payload = {
        "model": MODEL_NAME,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.2
    }

    headers = {
        "Authorization": f"Bearer {API_TOKEN}",
        "Content-Type": "application/json"
    }

    try:
        r = requests.post(API_URL, headers=headers, json=payload, timeout=TIMEOUT)
        r.raise_for_status()
        result = r.json()
        content = result["choices"][0]["message"]["content"]

        # Strip markdown fences if any
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]

        parsed = json.loads(content.strip())
        return parsed if isinstance(parsed, list) else []
    except Exception as e:
        print("GPT extraction error:", e)
        return []


# -----------------------
# Normalization (robust)
# -----------------------
_CANON_MAP = {
    # Age
    "min_age": "age_min",
    "minimum_age": "age_min",
    "max_age": "age_max",
    "maximum_age": "age_max",

    # Income
    "annual_income_max": "income_max",
    "income_limit": "income_max",
    "annual_income_limit": "income_max",
    "income_ceiling": "income_max",
    "annual_income_min": "income_min",

    # Category
    "category": "category_allowed",
    "caste": "category_allowed",
    "caste_category": "category_allowed",

    # BPL
    "bpl": "bpl_required",
    "bpl_only": "bpl_required",
    "bpl_status": "bpl_required",

    # Gender
    "gender": "gender_allowed",

    # Residence
    "residence": "residence_type_allowed",
    "rural_urban": "residence_type_allowed",

    # Disability
    "disabled": "disability_required",
    "disability": "disability_required",
    "disability_percent_min": "disability_percentage_min",
    "disability_percentage": "disability_percentage_min",
}

def _to_bool(v):
    if isinstance(v, bool):
        return v
    if isinstance(v, (int, float)):
        return bool(v)
    if isinstance(v, str):
        s = v.strip().lower()
        if s in ("yes", "y", "true", "1", "required"):
            return True
        if s in ("no", "n", "false", "0", "not required"):
            return False
    return v

def _to_list(v):
    if isinstance(v, list):
        return v
    if isinstance(v, str):
        parts = [p.strip() for p in re.split(r"[,/|]", v) if p.strip()]
        if len(parts) > 1:
            return parts
    return v

def _maybe_number(v):
    if isinstance(v, (int, float)):
        return v
    if isinstance(v, str):
        vv = v.strip()
        if re.fullmatch(r"\d+(\.\d+)?", vv):
            return float(vv) if "." in vv else int(vv)
    return v

def normalize_criteria(criteria: dict) -> dict:
    out = {}
    for k, v in (criteria or {}).items():
        if not isinstance(k, str):
            continue
        key_l = k.strip().lower()
        canon = _CANON_MAP.get(key_l, key_l)

        v = _to_bool(v)
        v = _to_list(v)
        v = _maybe_number(v)

        if canon.endswith("_allowed") and not isinstance(v, list):
            v = [str(v).strip()]

        out[canon] = v
    return out

def normalize_schemes(schemes: list) -> list:
    cleaned = []
    for s in schemes or []:
        if not isinstance(s, dict):
            continue
        name = str(s.get("scheme_name", "")).strip() or "Unknown Scheme"
        benefits = str(s.get("benefits", "")).strip()
        criteria = normalize_criteria(s.get("criteria", {}) or {})
        cleaned.append({"scheme_name": name, "criteria": criteria, "benefits": benefits})
    return cleaned


# -----------------------
# Pretty labels for reasons
# -----------------------
_PRETTY = {
    "age": "Age",
    "income": "Annual income",
    "bpl": "BPL status",
    "category": "Category",
    "gender": "Gender",
    "residence_type": "Residence type",
    "disability": "Disability",
    "disability_percentage": "Disability percentage",
}

def pretty_field(k: str) -> str:
    return _PRETTY.get(k, k.replace("_", " ").strip().title())

def bool_to_yesno(v):
    if v is True:
        return "Yes"
    if v is False:
        return "No"
    return str(v)


# -----------------------
# Criteria evaluation with reasons
# -----------------------
def _base_key_for_criterion_key(key: str) -> str:
    if key.endswith("_min") or key.endswith("_max"):
        return key[:-4]
    return key

def _compare_reason(field, op, required, actual):
    f = pretty_field(field)
    return f"{f} must be {op} {required} (you entered {actual})."

def _allowed_reason(field, allowed, actual):
    f = pretty_field(field)
    allowed_txt = ", ".join([str(x) for x in allowed])
    return f"{f} must be one of [{allowed_txt}] (you entered {actual})."

def _required_reason(field, required_bool, actual_bool):
    f = pretty_field(field)
    return f"{f} must be {bool_to_yesno(required_bool)} (you entered {bool_to_yesno(actual_bool)})."

def evaluate_scheme_with_reasons(user: dict, criteria: dict):
    """
    Returns:
      status: "eligible" | "needs_info" | "not_eligible"
      missing: list[str] (base keys)
      reasons: list[str] (for not_eligible)
    """
    missing = []
    reasons = []

    for key, required_value in (criteria or {}).items():
        base_key = _base_key_for_criterion_key(key)

        if base_key not in user or user[base_key] is None or user[base_key] == "":
            if base_key not in missing:
                missing.append(base_key)
            continue

        user_value = user[base_key]

        # numeric rule
        if isinstance(required_value, (int, float)):
            try:
                uv = float(user_value)
                rv = float(required_value)
            except Exception:
                reasons.append(f"{pretty_field(base_key)} has an invalid value (you entered {user_value}).")
                continue

            if key.endswith("_min") and uv < rv:
                reasons.append(_compare_reason(base_key, "≥", required_value, user_value))
            elif key.endswith("_max") and uv > rv:
                reasons.append(_compare_reason(base_key, "≤", required_value, user_value))
            elif (not key.endswith("_min") and not key.endswith("_max")) and uv != rv:
                reasons.append(_compare_reason(base_key, "=", required_value, user_value))

        # boolean rule
        elif isinstance(required_value, bool):
            if bool(user_value) != required_value:
                reasons.append(_required_reason(base_key, required_value, bool(user_value)))

        # allowed list
        elif isinstance(required_value, list):
            allowed = [str(x).strip().lower() for x in required_value]
            if str(user_value).strip().lower() not in allowed:
                reasons.append(_allowed_reason(base_key, required_value, user_value))

        # string match
        elif isinstance(required_value, str):
            if str(user_value).strip().lower() != required_value.strip().lower():
                reasons.append(_allowed_reason(base_key, [required_value], user_value))

    if reasons:
        return ("not_eligible", missing, reasons)

    if missing:
        return ("needs_info", missing, [])

    return ("eligible", [], [])


# -----------------------
# Basic form fields (as you requested)
# -----------------------
# Removed: aadhaar, mobile, farmer, minority, bank_account from basic.
BASIC_FIELDS = {
    "age",
    "income",
    "bpl",
    "category",
    "gender",
    "residence_type",
    "disability",
    "disability_percentage",
}

def build_user_profile(payload: dict) -> dict:
    def to_int(x):
        try:
            if x is None or x == "":
                return None
            return int(x)
        except Exception:
            return None

    def to_float(x):
        try:
            if x is None or x == "":
                return None
            return float(x)
        except Exception:
            return None

    def to_bool(x):
        if isinstance(x, bool):
            return x
        if x is None or x == "":
            return None
        if isinstance(x, str):
            s = x.strip().lower()
            if s in ("true", "yes", "1"):
                return True
            if s in ("false", "no", "0"):
                return False
        return bool(x)

    base = {
        "age": to_int(payload.get("age")),
        "income": to_int(payload.get("income")),
        "bpl": to_bool(payload.get("bpl")),
        "category": payload.get("category") or None,
        "gender": payload.get("gender") or None,
        "residence_type": payload.get("residence_type") or None,
        "disability": to_bool(payload.get("disability")),
        "disability_percentage": to_float(payload.get("disability_percentage")),
    }

    extra = payload.get("extra", {}) or {}
    for k, v in extra.items():
        if k not in base or base[k] is None or base[k] == "":
            base[k] = v

    return base


# -----------------------
# Build scheme-driven questions (options derived from scheme criteria)
# -----------------------
_PRETTY_LABELS = {
    "bpl_required": "Are you BPL?",
    "disability_required": "Do you have a disability?",
    "disability_percentage_min": "Disability percentage",
    "widow_required": "Are you a widow?",
    "student_required": "Are you a student?",
    "farmer_required": "Are you a farmer?",
    "minority_required": "Do you belong to a minority community?",
    "bank_account_required": "Do you have a bank account?",
    "aadhaar_required": "Do you have Aadhaar?",
    "gender_allowed": "Gender",
    "category_allowed": "Category",
    "residence_type_allowed": "Residence type",
    "occupation_allowed": "Occupation",
    "state_allowed": "State",
    "district_allowed": "District",
}

def pretty_label(key: str) -> str:
    if key in _PRETTY_LABELS:
        return _PRETTY_LABELS[key]
    return key.replace("_", " ").strip().title()

def merge_question_constraints(acc: dict, criterion_key: str, criterion_value):
    if isinstance(criterion_value, list):
        acc["input_type"] = "select"
        acc.setdefault("options", set())
        for o in criterion_value:
            s = str(o).strip()
            if s:
                acc["options"].add(s)
        return

    if isinstance(criterion_value, bool) and criterion_key.endswith("_required"):
        acc["input_type"] = "select"
        acc["data_type"] = "bool"
        acc["options"] = {"Yes", "No"}
        return

    if isinstance(criterion_value, (int, float)):
        acc["input_type"] = "number"
        acc["data_type"] = "number"
        if criterion_key.endswith("_min"):
            acc["min"] = max(acc.get("min", float("-inf")), float(criterion_value))
        elif criterion_key.endswith("_max"):
            acc["max"] = min(acc.get("max", float("inf")), float(criterion_value))
        return

    if isinstance(criterion_value, str):
        acc["input_type"] = "select"
        acc.setdefault("options", set())
        acc["options"].add(criterion_value.strip())
        return

def build_missing_questions(possible_schemes: list, missing_fields: list):
    questions = []

    for field in missing_fields:
        agg = {
            "key": field,
            "question": pretty_label(field),
            "input_type": "text",
            "data_type": "text",
        }

        for scheme in possible_schemes:
            criteria = scheme.get("criteria", {}) or {}

            # If criteria refers to field directly (field_min/field_max or field_allowed/field_required)
            for ck, cv in criteria.items():
                base = _base_key_for_criterion_key(ck)
                if base != field:
                    continue
                merge_question_constraints(agg, ck, cv)

            # Special linking: basic fields may be constrained via *_allowed keys
            if field == "gender" and "gender_allowed" in criteria and isinstance(criteria["gender_allowed"], list):
                agg["input_type"] = "select"
                agg.setdefault("options", set())
                for o in criteria["gender_allowed"]:
                    agg["options"].add(str(o).strip())

            if field == "category" and "category_allowed" in criteria and isinstance(criteria["category_allowed"], list):
                agg["input_type"] = "select"
                agg.setdefault("options", set())
                for o in criteria["category_allowed"]:
                    agg["options"].add(str(o).strip())

            if field == "residence_type" and "residence_type_allowed" in criteria and isinstance(criteria["residence_type_allowed"], list):
                agg["input_type"] = "select"
                agg.setdefault("options", set())
                for o in criteria["residence_type_allowed"]:
                    agg["options"].add(str(o).strip())

            if field == "bpl" and "bpl_required" in criteria and isinstance(criteria["bpl_required"], bool):
                agg["input_type"] = "select"
                agg["data_type"] = "bool"
                agg["options"] = {"Yes", "No"}

            if field == "disability" and "disability_required" in criteria and isinstance(criteria["disability_required"], bool):
                agg["input_type"] = "select"
                agg["data_type"] = "bool"
                agg["options"] = {"Yes", "No"}

            if field == "disability_percentage" and "disability_percentage_min" in criteria and isinstance(criteria["disability_percentage_min"], (int, float)):
                agg["input_type"] = "number"
                agg["data_type"] = "number"
                agg["min"] = max(agg.get("min", float("-inf")), float(criteria["disability_percentage_min"]))

        # finalize options/min/max
        if agg.get("input_type") == "select":
            opts = agg.get("options")
            if isinstance(opts, set):
                opts = sorted([o for o in opts if o])
            elif isinstance(opts, list):
                opts = [o for o in opts if o]
            else:
                opts = []
            agg["options"] = opts

        if "min" in agg and agg["min"] == float("-inf"):
            del agg["min"]
        if "max" in agg and agg["max"] == float("inf"):
            del agg["max"]

        if agg.get("input_type") == "select" and not agg.get("options"):
            agg["input_type"] = "text"
            agg["data_type"] = "text"
            agg.pop("options", None)

        questions.append(agg)

    return questions


# -----------------------
# Routes
# -----------------------
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/load_schemes", methods=["POST"])
def load_schemes():
    global schemes_db, all_criteria_keys

    paste_text = (request.form.get("paste_text") or "").strip()
    paste_json = (request.form.get("paste_json") or "").strip()

    if paste_json:
        try:
            raw = json.loads(paste_json)
            if not isinstance(raw, list):
                return jsonify({"error": "Pasted JSON must be an array of schemes"}), 400
            schemes_db = normalize_schemes(raw)
        except Exception as e:
            return jsonify({"error": f"Invalid JSON: {e}"}), 400

    elif paste_text:
        extracted = extract_schemes_with_gpt(paste_text)
        schemes_db = normalize_schemes(extracted)

    else:
        if "file" not in request.files:
            return jsonify({"error": "No file or pasted text/json provided"}), 400
        f = request.files["file"]
        if not f or f.filename == "":
            return jsonify({"error": "Empty filename"}), 400

        tmp_path = "/tmp/uploaded_input"
        f.save(tmp_path)

        kind, content = read_any_file(tmp_path, f.filename)
        try:
            os.remove(tmp_path)
        except Exception:
            pass

        if kind == "json":
            try:
                raw = json.loads(content)
                if not isinstance(raw, list):
                    return jsonify({"error": "Uploaded JSON must be an array of schemes"}), 400
                schemes_db = normalize_schemes(raw)
            except Exception as e:
                return jsonify({"error": f"Invalid JSON file: {e}"}), 400
        else:
            if not content.strip():
                if f.filename.lower().endswith(".pdf") and not PDF_OK:
                    return jsonify({"error": "PDF reading not enabled. Install: pip install pypdf"}), 400
                return jsonify({"error": "Could not read text from the file"}), 400

            extracted = extract_schemes_with_gpt(content)
            schemes_db = normalize_schemes(extracted)

    all_criteria_keys.clear()
    for s in schemes_db:
        all_criteria_keys.update((s.get("criteria") or {}).keys())

    return jsonify({
        "message": f"Loaded {len(schemes_db)} schemes",
        "schemes_count": len(schemes_db),
        "all_criteria_keys": sorted(list(all_criteria_keys))
    })

@app.route("/check", methods=["POST"])
def check_eligibility():
    payload = request.get_json() or {}
    user_profile = build_user_profile(payload)

    eligible = []
    not_eligible = []
    possible_schemes = []
    missing_counter = {}

    # Evaluate every scheme with reasons
    for scheme in schemes_db or []:
        criteria = scheme.get("criteria", {}) or {}
        status, missing, reasons = evaluate_scheme_with_reasons(user_profile, criteria)

        if status == "eligible":
            eligible.append({
                "scheme_name": scheme.get("scheme_name", "Unknown Scheme"),
                "benefits": scheme.get("benefits", "")
            })
            continue

        if status == "not_eligible":
            not_eligible.append({
                "scheme_name": scheme.get("scheme_name", "Unknown Scheme"),
                "benefits": scheme.get("benefits", ""),
                "reasons": reasons
            })
            continue

        # needs_info: scheme is still possible but missing data (no fail reasons yet)
        possible_schemes.append(scheme)
        for k in missing:
            # Don't ask basic fields in "additional" section
            if k in BASIC_FIELDS:
                continue
            missing_counter[k] = missing_counter.get(k, 0) + 1

    missing_fields_sorted = sorted(missing_counter.keys(), key=lambda k: missing_counter[k], reverse=True)
    missing_questions = build_missing_questions(possible_schemes, missing_fields_sorted)

    return jsonify({
        "eligible_schemes": eligible,
        "not_eligible_schemes": not_eligible,
        "missing_fields": missing_fields_sorted,
        "missing_questions": missing_questions
    })

@app.route("/health")
def health():
    return jsonify({
        "ok": True,
        "schemes_loaded": len(schemes_db),
        "pdf_supported": PDF_OK
    })

if __name__ == "__main__":
    app.run(debug=True)