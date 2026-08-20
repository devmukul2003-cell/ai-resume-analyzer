# 🚀 AI Resume Analyzer

AI-powered web application that analyzes resumes and provides ATS-style feedback, keyword matching, and improvement suggestions.

This project uses a React + Vite frontend with an Express.js backend, MongoDB persistence, and OpenAI-powered analysis.

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

* **Frontend:** React, Vite, Tailwind CSS
* **Backend:** Node.js, Express.js
* **Database:** MongoDB + Mongoose
* **AI/NLP:** OpenAI API
* **Resume parsing:** PDF parsing via pdf-parse

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
git clone https://github.com/<your-user>/<your-repo>.git
cd AI-Resume-Analyzer-main
```

### Server

```powershell
cd server
npm install
```

Create a `.env` file in the `server` folder:

```env
PORT=5000
CLIENT_URL=http://localhost:5173
MONGODB_URI=mongodb://127.0.0.1:27017/resume-analyzer
JWT_SECRET=your_secret_key
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini
```

Then start the backend:

```powershell
npm run dev
```

### Client

```powershell
cd client
npm install
copy .env.example .env
```

Then start the frontend:

```powershell
npm run dev
```

Use the default Vite URL:

```text
http://localhost:5173
```

---

## 🔐 Environment Variables

The app expects these values in `server/.env` and `client/.env`.

```env
# server/.env
PORT=5000
CLIENT_URL=http://localhost:5173
MONGODB_URI=mongodb://127.0.0.1:27017/resume-analyzer
JWT_SECRET=your_secret_key
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini
```

```env
# client/.env
VITE_API_BASE_URL=http://localhost:5000
```

---

## 🧠 How It Works

```text
React/Vite → Express.js → MongoDB + OpenAI API
```

* Frontend sends resume data
* Backend validates and parses uploaded PDF files
* OpenAI generates structured ATS feedback
* Results can be saved to MongoDB

---

## 📌 Notes

* Without `OPENAI_API_KEY`, the analyzer uses local keyword and structure analysis for offline functionality.
* The API accepts pasted text, uploaded PDF files, and DOCX files.
* The frontend connects to the backend via `VITE_API_BASE_URL` environment variable.
* Install the optional spaCy model for entity-aware NLP features: `python -m spacy download en_core_web_sm`.

## 🌐 Publish on GitHub Pages

1. Create a GitHub repository and push this project to the `main` branch.
2. Deploy the `backend` folder as a Render Web Service with:

  ```text
  Build command: npm install
  Start command: node index.js
  ```

3. Set the MongoDB URI and JWT secret as environment variables on Render.
4. Copy the Render service URL and update `VITE_API_BASE_URL` in your `.env` file.
5. Deploy the `client` folder to GitHub Pages using the included workflow.
6. In GitHub, open **Settings > Pages** and set the source to **GitHub Actions**.

---

⭐ Star the repo if you found it useful!
