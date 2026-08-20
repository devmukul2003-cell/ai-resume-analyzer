import json
import os
import re
import sqlite3
from io import BytesIO
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import fitz
import bcrypt
from docx import Document
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from openai import OpenAI

try:
    import spacy
    NLP = spacy.load("en_core_web_sm")
except Exception:
    NLP = None

load_dotenv()
ROOT = Path(__file__).resolve().parent
DB_PATH = Path(os.getenv("DATABASE_PATH", ROOT / "resume_analyzer.db"))
SECRET = os.getenv("JWT_SECRET", "change-this-secret")
ALGORITHM = "HS256"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
app = FastAPI(title="AI Resume Analyzer API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def db():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def hash_password(password: str):
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str):
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def init_db():
    with db() as connection:
        connection.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS analyses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            resume_text TEXT NOT NULL,
            job_description TEXT DEFAULT '',
            result_json TEXT NOT NULL,
            resume_label TEXT DEFAULT '',
            job_label TEXT DEFAULT '',
            original_file_name TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        """)


@app.on_event("startup")
def startup():
    init_db()


def token_for(user_id: int):
    return jwt.encode({"sub": str(user_id), "exp": datetime.now(timezone.utc) + timedelta(days=7)}, SECRET, algorithm=ALGORITHM)


def current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
    except (JWTError, TypeError, ValueError):
        raise HTTPException(401, "Invalid or expired token")
    with db() as connection:
        user = connection.execute("SELECT id, name, email FROM users WHERE id = ?", (user_id,)).fetchone()
    if not user:
        raise HTTPException(401, "User not found")
    return dict(user)


def extract_text(data: bytes, filename: str):
    suffix = Path(filename).suffix.lower()
    if suffix == ".pdf":
        return "\n".join(page.get_text() for page in fitz.open(stream=data, filetype="pdf")).strip()
    if suffix == ".docx":
        return "\n".join(p.text for p in Document(BytesIO(data)).paragraphs).strip()
    raise HTTPException(400, "Only PDF and DOCX files are supported")


def keyword_terms(text: str):
    terms = re.findall(r"[A-Za-z][A-Za-z+#./-]{1,24}", text)
    stop = {"with", "from", "that", "this", "will", "have", "your", "into", "and", "the", "for", "are", "you"}
    return list(dict.fromkeys(term for term in terms if term.lower() not in stop and (term.isupper() or any(c in term for c in "+#./") or len(term) > 4)))


def local_analysis(resume: str, job: str):
    resume_terms = {term.lower() for term in keyword_terms(resume)}
    job_terms = keyword_terms(job)
    matched = [term for term in job_terms if term.lower() in resume_terms]
    missing = [term for term in job_terms if term.lower() not in resume_terms][:8]
    sections = sum(bool(re.search(rf"\\b{name}\\b", resume, re.I)) for name in ("experience", "education", "skills", "projects"))
    score = min(10, max(1, 4 + sections + (1 if len(resume) > 800 else 0)))
    return {"overallScore": score, "atsMatchScore": round(len(matched) / max(1, len(job_terms)) * 10) if job else None, "summary": "Your resume has a workable foundation. Add measurable outcomes and tailor the language to each target role for a stronger application.", "strengths": ["Clear professional content", "Relevant skills can be identified", "Readable resume structure"], "weaknesses": ["Some achievements may need measurable results", "Role-specific language could be sharper", "Add evidence for your strongest skills"], "matchedKeywords": matched[:12], "missingKeywords": missing, "atsSuggestions": ["Mirror important job-description keywords naturally in your experience bullets", "Use standard section headings and keep formatting easy for ATS parsers" ] if job else [], "suggestions": ["Start bullets with strong action verbs", "Add numbers, scope, or outcomes to describe impact", "Keep the most relevant experience near the top"]}


def ai_analysis(resume: str, job: str):
    if not os.getenv("OPENAI_API_KEY"):
        return local_analysis(resume, job)
    prompt = "Return only JSON with keys overallScore, atsMatchScore, summary, strengths, weaknesses, matchedKeywords, missingKeywords, atsSuggestions, suggestions. Score 1-10. atsMatchScore is null without a job description. Analyze this resume against the job description.\nRESUME:\n" + resume + "\nJOB:\n" + (job or "Not provided")
    response = OpenAI().chat.completions.create(model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"), messages=[{"role": "system", "content": "You are an ATS resume reviewer."}, {"role": "user", "content": prompt}], response_format={"type": "json_object"})
    return json.loads(response.choices[0].message.content)


@app.get("/api/health")
def health():
    return {"success": True, "database": str(DB_PATH), "spacy": NLP is not None}


@app.post("/api/auth/signup")
def signup(name: str = Form(...), email: str = Form(...), password: str = Form(...)):
    if len(password) < 6 or not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        raise HTTPException(400, "Use a valid email and a password of at least 6 characters")
    try:
        with db() as connection:
            cursor = connection.execute("INSERT INTO users(name,email,password_hash,created_at) VALUES(?,?,?,?)", (name.strip(), email.lower().strip(), hash_password(password), datetime.now(timezone.utc).isoformat()))
            user = {"id": cursor.lastrowid, "name": name.strip(), "email": email.lower().strip()}
    except sqlite3.IntegrityError:
        raise HTTPException(400, "An account with this email already exists")
    return {"token": token_for(user["id"]), "user": user}


@app.post("/api/auth/login")
def login(email: str = Form(...), password: str = Form(...)):
    with db() as connection:
        user = connection.execute("SELECT * FROM users WHERE email = ?", (email.lower().strip(),)).fetchone()
    if not user or not verify_password(password, user["password_hash"]):
        raise HTTPException(400, "Invalid email or password")
    return {"token": token_for(user["id"]), "user": {"id": user["id"], "name": user["name"], "email": user["email"]}}


@app.post("/api/analyzer")
async def analyze(resumeText: str = Form(""), jobDescription: str = Form(""), resumeLabel: str = Form(""), jobLabel: str = Form(""), resumeFile: Optional[UploadFile] = File(None)):
    resume = resumeText.strip()
    filename = resumeFile.filename if resumeFile else ""
    if resumeFile:
        resume = extract_text(await resumeFile.read(), filename)
    if not resume:
        raise HTTPException(400, "Paste a resume or upload a PDF/DOCX file")
    result = ai_analysis(resume, jobDescription.strip())
    return {"message": "Resume analyzed successfully", "analysis": result, "resumeText": resume, "jobDescription": jobDescription.strip(), "resumeLabel": resumeLabel.strip() or filename or "Untitled Resume", "jobLabel": jobLabel.strip() or "No Job Label", "originalFileName": filename}


@app.post("/api/analyzer/save")
def save(payload: dict, user=Depends(current_user)):
    if not payload.get("resumeText") or not payload.get("analysisResult"):
        raise HTTPException(400, "Missing resume or analysis result")
    with db() as connection:
        cursor = connection.execute("INSERT INTO analyses(user_id,resume_text,job_description,result_json,resume_label,job_label,original_file_name,created_at) VALUES(?,?,?,?,?,?,?,?)", (user["id"], payload["resumeText"], payload.get("jobDescription", ""), json.dumps(payload["analysisResult"]), payload.get("resumeLabel", "Untitled Resume"), payload.get("jobLabel", "No Job Label"), payload.get("originalFileName", ""), datetime.now(timezone.utc).isoformat()))
    return {"savedAnalysisId": cursor.lastrowid}


@app.get("/api/analyzer/history")
def history(user=Depends(current_user)):
    with db() as connection:
        rows = connection.execute("SELECT * FROM analyses WHERE user_id = ? ORDER BY created_at DESC", (user["id"],)).fetchall()
    return [{**dict(row), "analysisResult": json.loads(row["result_json"])} for row in rows]


@app.delete("/api/analyzer/{analysis_id}")
def delete(analysis_id: int, user=Depends(current_user)):
    with db() as connection:
        cursor = connection.execute("DELETE FROM analyses WHERE id = ? AND user_id = ?", (analysis_id, user["id"]))
    if cursor.rowcount == 0:
        raise HTTPException(404, "Analysis not found")
    return {"message": "Analysis deleted"}
