# 🚀 AI Resume Analyzer

AI-powered web application that analyzes resumes and provides ATS-style feedback, keyword matching, and improvement suggestions.

Plain HTML, CSS, and JavaScript frontend with a FastAPI backend, SQLite persistence, and optional LLM-powered feedback.

---

## ✨ Features

* Analyze resume (paste text or upload PDF)
* ATS-style scoring and feedback
* Keyword match & missing keyword detection
* AI-generated improvement suggestions
* User authentication (JWT)
* Save, view, and delete past analyses
* Demo mode (no login required)

---

## 🏗️ Tech Stack

* **Frontend:** HTML, CSS, JavaScript
* **Backend:** Python, FastAPI
* **Database:** SQLite
* **AI/NLP:** OpenAI API, spaCy
* **Resume parsing:** PyMuPDF (PDF), python-docx (DOCX)

---

## 📸 Screenshots

### 🚀 Landing Experience
<p align="center">
  <img src="docs/screenshots/1_landing1.png" width="45%"/>
  <img src="docs/screenshots/2_landing2.png" width="45%"/>
</p>

<p align="center">
  <img src="docs/screenshots/3_landing3.png" width="60%"/>
</p>

### 🧠 Resume Analyzer
<p align="center">
  <img src="docs/screenshots/4_analyzer.png" width="70%"/>
</p>

### 📊 Results & Insights
<p align="center">
  <img src="docs/screenshots/5_result.png" width="70%"/>
</p>

### 📌 Detailed Feedback
<p align="center">
  <img src="docs/screenshots/6_details1.png" width="45%"/>
  <img src="docs/screenshots/7_details2.png" width="45%"/>
</p>

---

## ⚙️ Setup (Local)

```bash
# Clone repo
git clone https://github.com/mahir-alam/AI-Resume-Analyzer.git
cd AI-Resume-Analyzer
```

### Backend

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8001
```

### Frontend

Open `frontend/index.html` directly in a browser, or serve the repository with a static server:

```powershell
python -m http.server 5500 --directory frontend
```

---

## 🔐 Environment Variables

Create a `.env` file in **backend**:

```env
JWT_SECRET=your_secret_key
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini
DATABASE_PATH=resume_analyzer.db
```

---

## 🧠 How It Works

```text
HTML/CSS/JavaScript → FastAPI → SQLite + OpenAI API
```

* Frontend sends resume data
* Backend processes request
* OpenAI generates structured feedback
* Results can be saved to database

---

## 📌 Notes

* Without `OPENAI_API_KEY`, the API uses a local keyword and structure analysis so the application remains usable offline.
* Install the optional spaCy model for entity-aware NLP features: `python -m spacy download en_core_web_sm`.
* The API accepts pasted text, PDF files, and DOCX files.

## 🌐 Publish on GitHub Pages

1. Create a GitHub repository and push this project to the `main` branch.
2. Deploy the `backend` folder as a Render Web Service with:

  ```text
  Build command: pip install -r requirements.txt
  Start command: python -m uvicorn main:app --host 0.0.0.0 --port $PORT
  ```

3. Copy the Render service URL and replace the API value near the top of `frontend/app.js`:

  ```js
  const API = 'https://your-backend.onrender.com';
  ```

4. Commit and push the change. The included `.github/workflows/deploy-pages.yml` workflow deploys the `frontend` folder automatically.
5. In GitHub, open **Settings > Pages** and set the source to **GitHub Actions**.

GitHub Pages hosts the static frontend only. The FastAPI backend must remain deployed separately.

---


⭐ Star the repo if you found it useful!
