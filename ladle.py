import os
import tempfile
import time
import asyncio
import inspect
import json

from gtts import gTTS
import pygame
import requests

# Optional mic support
try:
    import speech_recognition as sr
    HAS_SR = True
except ImportError:
    HAS_SR = False

try:
    from googletrans import Translator
except ImportError:
    raise SystemExit("googletrans not installed. Run: pip install googletrans==4.0.0-rc1")

# Optional PDF support (for reading scheme file locally)
try:
    from pypdf import PdfReader
    PDF_OK = True
except Exception:
    PDF_OK = False

# Optional DOCX support
try:
    import docx
    DOCX_OK = True
except Exception:
    DOCX_OK = False

translator = Translator()

DEFAULT_APP_BASE_URL = "http://127.0.0.1:5000"  # Your Flask app.py


# ---------------------------
# Async safe runner (from your code)
# ---------------------------
def _run_async(coro):
    """
    Safely run an async coroutine in both normal Python and environments
    where an event loop might already be running.
    """
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        new_loop = asyncio.new_event_loop()
        try:
            return new_loop.run_until_complete(coro)
        finally:
            new_loop.close()
    else:
        return asyncio.run(coro)


def translate_to_kannada(text: str) -> str:
    """
    Translate text to Kannada.
    Works with googletrans variants where translate() is sync OR async.
    """
    if not text:
        return ""
    result = translator.translate(text, dest="kn")
    if inspect.iscoroutine(result):
        result = _run_async(result)
    return result.text


def speak_kannada(kannada_text: str):
    """Convert Kannada text to speech and play it via pygame."""
    if not kannada_text.strip():
        return

    tts = gTTS(text=kannada_text, lang="kn")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as fp:
        audio_path = fp.name
        tts.save(audio_path)

    pygame.mixer.init()
    pygame.mixer.music.load(audio_path)
    pygame.mixer.music.play()

    while pygame.mixer.music.get_busy():
        time.sleep(0.1)

    pygame.mixer.quit()
    os.remove(audio_path)


def listen_english() -> str:
    """Listen from microphone and convert English speech to text."""
    if not HAS_SR:
        print("❌ SpeechRecognition not installed. Use text mode or install it:")
        print("   pip install SpeechRecognition")
        return ""

    recognizer = sr.Recognizer()
    with sr.Microphone() as source:
        print("\n🎤 Speak now (English)...")
        recognizer.adjust_for_ambient_noise(source, duration=0.5)
        audio = recognizer.listen(source)

    try:
        return recognizer.recognize_google(audio, language="en-IN")
    except sr.UnknownValueError:
        print("❌ Could not understand audio.")
        return ""
    except sr.RequestError:
        print("❌ Speech recognition service error (internet issue).")
        return ""


# ---------------------------
# Local file reading (scheme file -> text)
# ---------------------------
def read_docx(path: str) -> str:
    if not DOCX_OK:
        raise RuntimeError("python-docx not installed. Run: pip install python-docx")
    d = docx.Document(path)
    parts = []
    for p in d.paragraphs:
        t = (p.text or "").strip()
        if t:
            parts.append(t)
    return "\n".join(parts)


def read_txt(path: str) -> str:
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        return f.read()


def read_pdf(path: str) -> str:
    if not PDF_OK:
        raise RuntimeError("pypdf not installed. Run: pip install pypdf")
    reader = PdfReader(path)
    out = []
    for page in reader.pages:
        try:
            out.append(page.extract_text() or "")
        except Exception:
            pass
    return "\n".join(out).strip()


def read_scheme_file_any(path: str) -> str:
    ext = os.path.splitext(path)[1].lower()
    if ext == ".docx":
        return read_docx(path)
    if ext == ".txt":
        return read_txt(path)
    if ext == ".pdf":
        return read_pdf(path)
    if ext == ".json":
        # if user provides scheme JSON, still read and speak as text
        return read_txt(path)
    # fallback
    return read_txt(path)


# ---------------------------
# Flask app helpers
# ---------------------------
def check_app_health(base_url: str) -> bool:
    try:
        r = requests.get(f"{base_url}/health", timeout=5)
        return r.ok
    except Exception:
        return False


def call_check(base_url: str, payload: dict) -> dict:
    r = requests.post(f"{base_url}/check", json=payload, timeout=25)
    r.raise_for_status()
    return r.json()


# ---------------------------
# Kannada summary builders
# ---------------------------
def build_kannada_summary_from_check(resp: dict) -> str:
    eligible = resp.get("eligible_schemes", []) or []
    not_eligible = resp.get("not_eligible_schemes", []) or []
    missing_questions = resp.get("missing_questions", []) or []

    parts = []

    if eligible:
        parts.append("ನೀವು ಅರ್ಹರಾಗಿರುವ ಯೋಜನೆಗಳು:")
        for s in eligible[:10]:
            name = s.get("scheme_name", "ಯೋಜನೆ")
            ben = s.get("benefits", "")
            # Keep TTS short
            parts.append(f"- {name}.")
            if ben:
                parts.append(f"ಲಾಭಗಳು: {ben}")

    if not_eligible:
        parts.append("ನೀವು ಅರ್ಹರಾಗಿಲ್ಲದ ಯೋಜನೆಗಳು ಮತ್ತು ಕಾರಣಗಳು:")
        for s in not_eligible[:10]:
            name = s.get("scheme_name", "ಯೋಜನೆ")
            parts.append(f"- {name}.")
            reasons = s.get("reasons", []) or []
            # speak only top reasons to avoid long audio
            for r in reasons[:3]:
                parts.append(f"ಕಾರಣ: {r}")

    if missing_questions:
        parts.append("ಇನ್ನಷ್ಟು ಮಾಹಿತಿಯ ಅಗತ್ಯವಿದೆ. ದಯವಿಟ್ಟು ಕೆಳಗಿನ ಪ್ರಶ್ನೆಗಳಿಗೆ ಉತ್ತರಿಸಿ:")
        for q in missing_questions[:10]:
            parts.append(f"- {q.get('question', q.get('key', 'ಪ್ರಶ್ನೆ'))}")

    if not parts:
        return "ಯಾವುದೇ ಫಲಿತಾಂಶ ಲಭ್ಯವಿಲ್ಲ."

    # This summary is still English in parts (scheme names/reasons). We translate it fully below.
    english_text = "\n".join(parts)
    return translate_to_kannada(english_text)


# ---------------------------
# Interactive Modes
# ---------------------------
def mode_translate_and_speak_file():
    path = input("\nEnter scheme file path (.docx/.txt/.pdf/.json): ").strip().strip('"')
    if not path or not os.path.exists(path):
        print("❌ File not found.")
        return

    text = read_scheme_file_any(path)
    if not text.strip():
        print("❌ Could not extract text from file.")
        return

    # Big docs -> translate in chunks (googletrans can fail on huge strings)
    print("\n🔄 Translating file content to Kannada (chunked)...")
    chunks = chunk_text(text, 900)  # safer length
    translated_chunks = []
    for i, ch in enumerate(chunks, 1):
        kn = translate_to_kannada(ch)
        translated_chunks.append(kn)
        print(f"  ✅ chunk {i}/{len(chunks)} translated")

    kannada_full = "\n".join(translated_chunks)

    print("\n🇮🇳 Kannada Translation (first 500 chars):")
    print(kannada_full[:500] + ("..." if len(kannada_full) > 500 else ""))

    print("\n🔊 Speaking Kannada (this may take time for large text)...")
    # speak in chunks too
    for ch in chunk_text(kannada_full, 900):
        speak_kannada(ch)

    print("\n✅ Done.")


def mode_check_and_speak_results(base_url: str):
    if not check_app_health(base_url):
        print(f"❌ Flask app not reachable at {base_url}. Start app.py first.")
        return

    print("\nFill basic fields (press Enter to skip a field).")
    age = input("Age: ").strip()
    income = input("Income: ").strip()
    bpl = input("BPL (true/false): ").strip().lower()
    category = input("Category (General/OBC/SC/ST): ").strip()
    gender = input("Gender (Male/Female/Other): ").strip()
    residence_type = input("Residence type (Rural/Urban): ").strip()
    disability = input("Disability (true/false): ").strip().lower()
    disability_percentage = input("Disability percentage (0-100): ").strip()

    def maybe_int(x):
        try:
            return int(x) if x != "" else None
        except Exception:
            return None

    def maybe_float(x):
        try:
            return float(x) if x != "" else None
        except Exception:
            return None

    def maybe_bool(x):
        if x == "":
            return None
        if x in ("true", "yes", "1"):
            return True
        if x in ("false", "no", "0"):
            return False
        return None

    payload = {
        "age": maybe_int(age),
        "income": maybe_int(income),
        "bpl": maybe_bool(bpl),
        "category": category if category else None,
        "gender": gender if gender else None,
        "residence_type": residence_type if residence_type else None,
        "disability": maybe_bool(disability),
        "disability_percentage": maybe_float(disability_percentage),
    }

    print("\n🔄 Calling /check ...")
    resp = call_check(base_url, payload)

    # Print a quick view in English
    print("\n--- Eligible schemes (English) ---")
    for s in resp.get("eligible_schemes", [])[:10]:
        print("-", s.get("scheme_name"))
    print("\n--- Not eligible (English) ---")
    for s in resp.get("not_eligible_schemes", [])[:5]:
        print("-", s.get("scheme_name"))
        for r in (s.get("reasons", []) or [])[:3]:
            print("   *", r)

    print("\n🔄 Building Kannada summary and speaking...")
    kannada_summary = build_kannada_summary_from_check(resp)
    print("\n🇮🇳 Kannada Summary (first 500 chars):")
    print(kannada_summary[:500] + ("..." if len(kannada_summary) > 500 else ""))

    # Speak in chunks
    for ch in chunk_text(kannada_summary, 900):
        speak_kannada(ch)

    print("\n✅ Done.")


def mode_voice_translate_and_speak():
    print("\n========== Voice English ➜ Kannada ==========")
    print("Speak a short English sentence. I will translate + speak Kannada.")
    text = listen_english()
    if not text:
        return
    print(f"\n✅ You said: {text}")
    kn = translate_to_kannada(text)
    print(f"\n🇮🇳 Kannada: {kn}")
    speak_kannada(kn)


def chunk_text(text: str, max_len: int):
    """
    Chunk by sentences / newline to avoid splitting words too badly.
    """
    if len(text) <= max_len:
        return [text]

    parts = re.split(r"(\n+|[.!?])", text)
    chunks = []
    buf = ""
    for p in parts:
        if not p:
            continue
        if len(buf) + len(p) <= max_len:
            buf += p
        else:
            if buf.strip():
                chunks.append(buf.strip())
            buf = p
    if buf.strip():
        chunks.append(buf.strip())
    return chunks


def main():
    print("\n========== Kannada Companion (for app.py) ==========")
    print("This tool works alongside your Flask app.py.")
    print("\nChoose:")
    print("1) Translate + speak a scheme file (docx/txt/pdf/json) locally")
    print("2) Call app.py /check and speak results in Kannada")
    print("3) Voice: speak English -> Kannada TTS")
    print("0) Exit")

    choice = input("Enter choice: ").strip()

    if choice == "1":
        mode_translate_and_speak_file()
    elif choice == "2":
        base_url = input(f"Enter app base url (default {DEFAULT_APP_BASE_URL}): ").strip()
        if not base_url:
            base_url = DEFAULT_APP_BASE_URL
        mode_check_and_speak_results(base_url)
    elif choice == "3":
        mode_voice_translate_and_speak()
    else:
        print("Bye.")


if __name__ == "__main__":
    main()