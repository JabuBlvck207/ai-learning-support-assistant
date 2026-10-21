# AI Learning Support Assistant

A small full-stack AI learning tool for the CAPACITI Week 4 AI Solution project. Students upload lecture notes or study guides as PDFs, then generate summaries, request explanations, practise with quizzes, and receive revision recommendations.

## Features

- Upload and extract text from text-based PDF notes.
- Generate study summaries.
- Explain a topic at beginner or intermediate level.
- Generate five practice questions with an answer key.
- Ask questions grounded in the uploaded notes.
- Request a revision plan using quiz-performance information.
- Track activities and quiz scores in the current browser session.
- Responsible AI messaging and basic input/error handling.

## Technology

- Frontend: HTML, CSS, JavaScript
- Backend: Python, Flask
- AI: OpenRouter Chat Completions API
- PDF extraction: pypdf
- Session progress: browser session storage (not a permanent student record)

## Requirements

- Python 3.10 or newer
- An OpenRouter API key
- Internet access for AI requests

## Run on Windows PowerShell

Open PowerShell in this project folder.

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
notepad .env
```

In `.env`, replace `your_openrouter_api_key_here` with your API key. Save the file. Keep `.env` private and never commit it to GitHub.

If PowerShell blocks activation, you can avoid activation and run the environment's Python directly:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
notepad .env
.\.venv\Scripts\python.exe app.py
```

If the `py` command is unavailable, install Python from https://www.python.org/downloads/ and select **Add Python to PATH** during installation.

Start the application:

```powershell
python app.py
```

Then open http://127.0.0.1:5000 in your browser.

## How to use

1. Upload a text-based PDF containing lecture notes or a study guide.
2. Choose Beginner or Intermediate.
3. Select Summary, Explain a topic, Practice quiz, or Revision plan.
4. Enter a topic/question or quiz performance notes where requested.
5. Review the result and mark an activity as completed or record your quiz score in the progress panel.

## Important limitations

- The current MVP accepts PDFs only. It does not perform OCR on scanned/image-only PDFs.
- PDF text is processed in memory and is not saved to a database.
- The AI may make mistakes. Verify important answers against your course materials.
- Revision recommendations depend on the quiz score and topics the learner enters; this MVP does not automatically grade all answers.
- API calls may incur usage costs depending on your OpenRouter account and model.
- Do not upload confidential, personal, or sensitive student information.
- This is a learning prototype, not a replacement for a qualified educator.

## Suggested Week 4 demonstration

1. Upload a sample set of notes.
2. Generate a summary.
3. Ask the assistant to explain one difficult concept at beginner level.
4. Generate a practice quiz.
5. Record a score and ask for a revision plan.
6. Explain the architecture, limitations, privacy safeguards, and future improvements.

## Suggested future improvements

- Add DOCX and TXT upload support.
- Add source/page references for generated answers.
- Add automatic quiz grading with structured question data.
- Add persistent progress with a database if the project scope permits it.
- Add OCR for scanned PDFs.
- Add unit tests and deploy the app securely.

## Architecture

```text
Browser (HTML/CSS/JavaScript)
        |
        | JSON + PDF upload
        v
Flask backend
        |
        +--> pypdf extracts text from uploaded PDF
        |
        +--> OpenRouter API for learning tasks
        |
        v
Browser displays result and stores session progress
```
