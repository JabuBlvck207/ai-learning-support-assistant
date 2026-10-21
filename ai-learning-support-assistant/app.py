
import os
import io
import json
from pathlib import Path
from flask import Flask, request, jsonify, render_template
from dotenv import load_dotenv
import requests
from pypdf import PdfReader

load_dotenv(Path(__file__).resolve().parent / ".env")

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 12 * 1024 * 1024

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "").strip()
OPENROUTER_MODEL = os.getenv(
    "OPENROUTER_MODEL", "openai/gpt-4o-mini"
).strip()
APP_URL = os.getenv("APP_URL", "http://127.0.0.1:5000")
APP_NAME = os.getenv("APP_NAME", "AI Learning Support Assistant")

MAX_TEXT_CHARS = 24000
MAX_OUTPUT_TOKENS = 2048


def extract_pdf(file_storage):
    reader = PdfReader(file_storage.stream)
    chunks = []

    for page in reader.pages:
        chunks.append(page.extract_text() or "")

    return "\n".join(chunks).strip()


def ask_ai(task, material, level="Beginner", extra=""):
    if not OPENROUTER_API_KEY:
        return None, (
            "OpenRouter API key is missing. "
            "Add OPENROUTER_API_KEY to your .env file."
        )

    system = (
        "You are a careful, encouraging learning assistant. "
        "Teach from the supplied course material first. "
        "Do not invent claims about the material. If information is missing, "
        "say so and distinguish general background knowledge from uploaded "
        "notes. Use clear headings and concise explanations. "
        "Never claim to be a human teacher. Encourage learners to verify "
        "important details with their course notes."
    )

    user = (
        f"Task: {task}\n"
        f"Learning level: {level}\n"
        f"Additional instructions: {extra or 'None'}\n\n"
        f"COURSE MATERIAL:\n{material[:MAX_TEXT_CHARS]}"
    )

    try:
        response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": APP_URL,
                "X-Title": APP_NAME,
            },
            json={
                "model": OPENROUTER_MODEL,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "temperature": 0.4,
                "max_tokens": MAX_OUTPUT_TOKENS,
            },
            timeout=90,
        )

        response.raise_for_status()
        data = response.json()

        return data["choices"][0]["message"]["content"], None

    except requests.RequestException as exc:
        details = "OpenRouter request failed."

        if getattr(exc, "response", None) is not None:
            try:
                details += " " + exc.response.text[:500]
            except Exception:
                pass

        return None, details

    except (KeyError, IndexError, ValueError):
        return None, (
            "The AI provider returned an unexpected response. "
            "Please try again."
        )


@app.get("/")
def index():
    return render_template("index.html")


@app.post("/api/upload")
def upload():
    uploaded = request.files.get("document")

    if not uploaded or not uploaded.filename:
        return jsonify(error="Choose a PDF file first."), 400

    if not uploaded.filename.lower().endswith(".pdf"):
        return jsonify(
            error="This MVP supports PDF documents only."
        ), 400

    try:
        material = extract_pdf(uploaded)
    except Exception:
        return jsonify(
            error=(
                "Could not read this PDF. Check that it is a valid, "
                "readable PDF."
            )
        ), 400

    if not material:
        return jsonify(
            error=(
                "No selectable text was found. Scanned PDFs need OCR "
                "before they can be used."
            )
        ), 400

    material = material[:MAX_TEXT_CHARS]

    return jsonify(
        message="Document processed successfully.",
        filename=uploaded.filename,
        character_count=len(material),
        material=material,
        preview=material[:1200],
    )


@app.post("/api/learn")
def learn():
    payload = request.get_json(silent=True) or {}

    material = (payload.get("material") or "").strip()
    task = (payload.get("task") or "").strip()
    level = payload.get("level", "Beginner")
    extra = payload.get("extra", "")

    allowed = {"summary", "explain", "quiz", "revision"}

    if not material:
        return jsonify(
            error="Upload a PDF before using the learning tools."
        ), 400

    if task not in allowed:
        return jsonify(error="Choose a valid learning activity."), 400

    prompts = {
        "summary": (
            "Create a useful study summary of the material. Include: "
            "overview, key concepts, important terms with definitions, "
            "a numbered list of main takeaways, and 3 quick self-check "
            "questions. Do not add facts that are not supported by "
            "the material."
        ),
        "explain": (
            "Explain the learner's requested topic using the material. "
            "Start with a plain-language explanation, then a simple "
            "example, then a slightly more detailed explanation appropriate "
            "to the selected level. If the requested topic is not covered "
            "in the material, clearly say that and offer only clearly "
            "labelled general background."
        ),
        "quiz": (
            "Create exactly 5 practice questions based on the material. "
            "Mix multiple-choice and short-answer questions. Format the "
            "output with numbered questions; for multiple-choice use A-D. "
            "At the end add a separate ANSWER KEY section with concise "
            "answers and explanations so the learner can hide it while "
            "practising."
        ),
        "revision": (
            "Review the learner's quiz performance information in the "
            "additional instructions. Identify the topics that appear "
            "weakest, explain why they need revision based on the evidence "
            "provided, and give a short, prioritised revision plan with "
            "specific actions. Do not claim to know performance that "
            "was not provided."
        ),
    }

    result, error = ask_ai(
        prompts[task], material, level, extra
    )

    if error:
        return jsonify(error=error), 502

    return jsonify(result=result)


@app.post("/api/ask")
def ask():
    payload = request.get_json(silent=True) or {}

    material = (payload.get("material") or "").strip()
    question = (payload.get("question") or "").strip()
    level = payload.get("level", "Beginner")

    if not material:
        return jsonify(
            error="Upload a PDF before asking questions."
        ), 400

    if not question:
        return jsonify(error="Enter a question."), 400

    result, error = ask_ai(
        (
            "Answer the learner's question using the uploaded course "
            "material. Explain your reasoning, cite a heading or short "
            "phrase from the notes when possible, and state clearly when "
            "the notes do not contain enough information."
        ),
        material,
        level,
        f"Learner question: {question}",
    )

    if error:
        return jsonify(error=error), 502

    return jsonify(result=result)


@app.get("/api/health")
def health():
    return jsonify(
        status="ok",
        ai_configured=bool(OPENROUTER_API_KEY),
        model=OPENROUTER_MODEL,
    )


if __name__ == "__main__":
    app.run(
        debug=True,
        port=int(os.getenv("PORT", "5000")),
    )
