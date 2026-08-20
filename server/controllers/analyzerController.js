import OpenAI from "openai";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import Analysis from "../models/Analysis.js";

const analyzeResume = async (req, res) => {
  try {
    const { resumeText, jobDescription, resumeLabel, jobLabel } = req.body;
    let finalResumeText = resumeText?.trim() || "";
    const trimmedResumeLabel = resumeLabel?.trim() || "";
    const trimmedJobLabel = jobLabel?.trim() || "";
    const originalFileName = req.file?.originalname || "";

    const generatedResumeLabel =
      trimmedResumeLabel ||
      originalFileName ||
      finalResumeText?.split("\n").map((line) => line.trim()).find(Boolean) ||
      "Untitled Resume";

    const generatedJobLabel =
      trimmedJobLabel ||
      jobDescription
        ?.split("\n")
        .map((line) => line.trim())
        .find(Boolean) ||
      "No Job Label";
    const hasJobDescription = jobDescription && jobDescription.trim() !== "";

    if (req.file) {
      try {
        const fileName = req.file.originalname?.toLowerCase() || "";
        const isMimeDocx = req.file.mimetype?.includes("wordprocessingml") || 
                          req.file.mimetype?.includes("word") ||
                          req.file.mimetype?.includes("officedocument");
        
        if (fileName.endsWith(".docx") || isMimeDocx) {
          // Parse Word document
          const result = await mammoth.extractRawText({ buffer: req.file.buffer });
          finalResumeText = result.value.trim();
        } else {
          // Try to parse as PDF
          const parser = new PDFParse({
            data: req.file.buffer,
          });
          const parsedPdf = await parser.getText();
          finalResumeText = parsedPdf.text.trim();
        }
      } catch (error) {
        console.error("File parse error:", error.message);
        return res.status(400).json({
          message: "Failed to parse uploaded file. Please upload a valid PDF or Word document.",
        });
      }
    }

    if (!finalResumeText) {
      return res.status(400).json({
        message: "Resume text or PDF file is required.",
      });
    }

    let parsed;

    if (process.env.OPENAI_API_KEY) {
      // Use OpenAI API if key is available
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      const modelName = process.env.OPENAI_MODEL || "gpt-4o-mini";

      const prompt = `
You are a senior ATS (Applicant Tracking System) optimization expert and professional resume reviewer.

Your job is to analyze a resume and compare it against a job description (if provided), producing structured, high-quality, realistic ATS feedback.

Return ONLY valid JSON in this EXACT format:

{
  "overallScore": number,
  "atsMatchScore": number | null,
  "summary": "2-3 sentence professional evaluation",
  "strengths": ["point 1", "point 2", "point 3"],
  "weaknesses": ["point 1", "point 2", "point 3"],
  "matchedKeywords": ["keyword 1", "keyword 2", "keyword 3"],
  "missingKeywords": ["keyword 1", "keyword 2", "keyword 3"],
  "atsSuggestions": ["ATS-specific improvement 1", "ATS-specific improvement 2"],
  "suggestions": ["general improvement 1", "general improvement 2"]
}

CRITICAL RULES:

1. overallScore:
- Score from 1–10
- Based on structure, clarity, impact, projects, and professionalism

2. atsMatchScore:
- Score from 1–10
- Based ONLY on how well the resume matches the job description
- If NO job description → return null

3. matchedKeywords:
- Extract important technical keywords FROM THE JOB DESCRIPTION
- Include ONLY keywords that clearly appear in the resume
- Examples: "React", "Node.js", "MongoDB", "REST APIs"

4. missingKeywords:
- Extract important keywords from job description NOT found in resume
- Do NOT hallucinate keywords
- Only include realistic, meaningful terms

5. atsSuggestions:
- Must be SPECIFIC to ATS optimization
- Focus on:
  - missing keywords
  - formatting issues
  - keyword density
  - alignment with job description

6. suggestions:
- General resume improvements
- Focus on:
  - impact (metrics, numbers)
  - clarity
  - stronger bullet points
  - better structure

7. STRICT BEHAVIOR:
- If no job description:
  - atsMatchScore = null
  - matchedKeywords = []
  - missingKeywords = []
  - atsSuggestions = []
- DO NOT mix ATS suggestions into general suggestions
- DO NOT return explanations outside JSON

Resume:
${finalResumeText}

Job Description:
${hasJobDescription ? jobDescription.trim() : "Not provided"}
`;

      const response = await openai.chat.completions.create({
        model: modelName,
        messages: [
          {
            role: "system",
            content: "You are a professional resume analyzer.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
      });

      const aiText = response.choices[0].message.content;

      try {
        const cleaned = aiText
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();

        parsed = JSON.parse(cleaned);
      } catch (parseError) {
        console.error("JSON parse error from OpenAI response:");
        console.error(aiText);

        return res.status(500).json({
          message: "Failed to parse AI response.",
        });
      }
    } else {
      // Offline mode: provide basic analysis without AI
      const resumeWords = finalResumeText.toLowerCase().split(/\s+/);
      const hasMetrics = /\d+%|[$₹€]\d+|(\d+)[kmb]?\s*(hours?|days?|months?|years?|projects?|clients?|users?)/i.test(finalResumeText);
      const hasActionVerbs = /led|managed|developed|implemented|designed|created|built|optimized|achieved|increased/i.test(finalResumeText);
      
      const resumeLength = finalResumeText.split('\n').length;
      const wordCount = resumeWords.length;
      
      let overallScore = 5;
      if (hasMetrics && hasActionVerbs) overallScore = 7;
      if (resumeLength > 20 && wordCount > 100) overallScore += 1;
      if (overallScore > 10) overallScore = 10;

      let atsMatchScore = null;
      let matchedKeywords = [];
      let missingKeywords = [];
      let atsSuggestions = [];

      if (hasJobDescription) {
        const jobWords = jobDescription.toLowerCase().split(/\s+/);
        const commonKeywords = ['javascript', 'react', 'nodejs', 'python', 'java', 'sql', 'mongodb', 'rest', 'api', 'html', 'css', 'aws', 'docker', 'git', 'agile', 'scrum'];
        
        matchedKeywords = commonKeywords.filter(kw => resumeWords.some(w => w.includes(kw)));
        missingKeywords = commonKeywords.filter(kw => !resumeWords.some(w => w.includes(kw)) && jobWords.some(jw => jw.includes(kw)));
        
        atsMatchScore = Math.min(10, 5 + Math.round((matchedKeywords.length / commonKeywords.length) * 4));
        atsSuggestions = missingKeywords.length > 0 ? [`Add missing keywords: ${missingKeywords.slice(0, 3).join(', ')}`] : ['Strong keyword matching'];
      }

      parsed = {
        overallScore,
        atsMatchScore,
        summary: `This resume has ${hasMetrics ? 'good metrics and ' : ''}${hasActionVerbs ? 'strong action verbs' : 'room for stronger action verbs'}. ${wordCount > 100 ? 'Well-detailed content.' : 'Consider adding more detail.'}`,
        strengths: [
          hasActionVerbs ? 'Uses strong action verbs' : 'Could use stronger action verbs',
          hasMetrics ? 'Includes quantifiable metrics' : 'Add specific numbers and metrics',
          resumeLength > 10 ? 'Good length and structure' : 'Could expand with more details'
        ],
        weaknesses: [
          !hasMetrics ? 'Missing quantifiable achievements' : 'Add more specific outcomes',
          !hasActionVerbs ? 'Needs stronger action words' : 'Minor improvements possible',
          resumeLength < 10 ? 'Too brief - add more details' : 'Well-structured'
        ],
        matchedKeywords,
        missingKeywords,
        atsSuggestions,
        suggestions: [
          'Add metrics and numbers to achievements',
          'Use action verbs at the start of each bullet',
          'Highlight measurable results and impact',
          'Ensure consistent formatting throughout'
        ]
      };
    }
    parsed.matchedKeywords = parsed.matchedKeywords || [];
    parsed.missingKeywords = parsed.missingKeywords || [];
    parsed.atsSuggestions = parsed.atsSuggestions || [];
    parsed.suggestions = parsed.suggestions || [];

    const normalizeScore = (value, allowNull = false) => {
      if (allowNull && (value === null || value === undefined || value === "")) {
        return null;
      }

      const num = Number(value);

      if (Number.isNaN(num)) {
        return allowNull ? null : 0;
      }

      if (num > 10 && num <= 100) {
        return Math.round(num / 10);
      }

      return Math.max(0, Math.min(10, Math.round(num)));
    };

    parsed.overallScore = normalizeScore(parsed.overallScore);
    parsed.atsMatchScore = normalizeScore(parsed.atsMatchScore, true);



    return res.status(200).json({
      message: "Resume analyzed successfully.",
      analysis: parsed,
      resumeText: finalResumeText,
      jobDescription: jobDescription?.trim() || "",
      resumeLabel: generatedResumeLabel,
      jobLabel: generatedJobLabel,
      originalFileName,
    });

  } catch (error) {
    console.error("AI Error:", error);

    return res.status(500).json({
      message: "Error analyzing resume with AI.",
    });
  }
};
const getUserAnalyses = async (req, res) => {
  try {
    const analyses = await Analysis.find({ user: req.user.userId }).sort({
      createdAt: -1,
    });

    return res.status(200).json(analyses);
  } catch (error) {
    console.error("Fetch Analyses Error:", error);

    return res.status(500).json({
      message: "Failed to fetch analysis history.",
    });
  }
};

const deleteAnalysis = async (req, res) => {
  try {
    const analysis = await Analysis.findById(req.params.id);

    if (!analysis) {
      return res.status(404).json({
        message: "Analysis not found.",
      });
    }

    if (analysis.user.toString() !== req.user.userId) {
      return res.status(403).json({
        message: "Not authorized to delete this analysis.",
      });
    }

    await analysis.deleteOne();

    return res.status(200).json({
      message: "Analysis deleted successfully.",
    });
  } catch (error) {
    console.error("Delete Analysis Error:", error);

    return res.status(500).json({
      message: "Failed to delete analysis.",
    });
  }
};
const saveAnalysis = async (req, res) => {
  try {
    const {
      resumeText,
      jobDescription,
      analysisResult,
      resumeLabel,
      jobLabel,
      originalFileName,
    } = req.body;

    if (!resumeText || !analysisResult) {
      return res.status(400).json({
        message: "Missing required data to save analysis.",
      });
    }

    const savedAnalysis = await Analysis.create({
      user: req.user.userId,
      resumeText,
      jobDescription: jobDescription || "",
      analysisResult,
      resumeLabel: resumeLabel || "Untitled Resume",
      jobLabel: jobLabel || "No Job Label",
      originalFileName: originalFileName || "",
    });

    return res.status(201).json({
      message: "Analysis saved successfully.",
      savedAnalysisId: savedAnalysis._id,
    });
  } catch (error) {
    console.error("Save Analysis Error:", error);

    return res.status(500).json({
      message: "Failed to save analysis.",
    });
  }
};
export { analyzeResume, getUserAnalyses, deleteAnalysis, saveAnalysis };