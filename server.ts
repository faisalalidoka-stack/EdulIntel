import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { AnalyticsEngine } from './src/lib/analyticsEngine.js';
import { SCHOOLS, DISTRICTS, SUBJECTS } from './src/data/unebData.js';
import { ExamLevel } from './src/types.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.use(express.json());

// Initialize Gemini API
const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// API Endpoint for dynamic analytics retrieval
app.get('/api/analytics/rankings', (req, res) => {
  const year = parseInt(req.query.year as string) || 2025;
  const level = (req.query.level as ExamLevel) || ExamLevel.UCE;
  try {
    const data = AnalyticsEngine.getRankings(year, level);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/analytics/compare', (req, res) => {
  const schoolIds = ((req.query.schoolIds as string) || '').split(',').filter(Boolean);
  const level = (req.query.level as ExamLevel) || ExamLevel.UCE;
  try {
    const data = AnalyticsEngine.compareSchools(schoolIds, level);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/analytics/district', (req, res) => {
  const year = parseInt(req.query.year as string) || 2025;
  const level = (req.query.level as ExamLevel) || ExamLevel.UCE;
  try {
    const data = AnalyticsEngine.getDistrictPerformance(year, level);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/analytics/predict', (req, res) => {
  const schoolId = req.query.schoolId as string;
  const level = (req.query.level as ExamLevel) || ExamLevel.UCE;
  if (!schoolId) {
    return res.status(400).json({ error: 'schoolId is required' });
  }
  try {
    const data = AnalyticsEngine.predictPerformance(schoolId, level);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/analytics/outliers', (req, res) => {
  const level = (req.query.level as ExamLevel) || ExamLevel.UCE;
  try {
    const data = AnalyticsEngine.getOutlierSchools(level);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/analytics/national', (req, res) => {
  const year = parseInt(req.query.year as string) || 2025;
  const level = (req.query.level as ExamLevel) || ExamLevel.UCE;
  try {
    const data = AnalyticsEngine.getNationalStats(year, level);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// AI Chat - Implements the full AI pipeline:
// User Question -> AI Query Planner -> Analytics Engine -> Database -> Calculated Results -> AI Explanation Layer -> Final User Response
app.post('/api/chat', async (req, res) => {
  const { message, chatHistory = [] } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  if (!ai) {
    return res.json({
      reply: "The Gemini API Key is not configured yet. Please configure it in the Secrets panel in AI Studio.\n\nHowever, you can still search, filter, compare, and forecast school results directly using the interactive charts and tools in the dashboard tabs!",
      trace: {
        intent: "System Config Warning",
        queriesUsed: "None",
        calculations: "Gemini Key missing"
      }
    });
  }

  try {
    // --- STEP 1: AI QUERY PLANNER ---
    // Use gemini-2.5-flash to structure the intent and extract metadata in structured JSON
    const plannerPrompt = `
You are the AI Query Planner for the UNEB Education Intelligence Platform.
Analyze the user's question and map it to one of our Analytics Engine functions.

Available Schools: ${JSON.stringify(SCHOOLS.map(s => ({ id: s.id, name: s.name })))}
Available Districts: ${JSON.stringify(DISTRICTS.map(d => ({ id: d.id, name: d.name })))}
Available Subjects: ${JSON.stringify(SUBJECTS.map(s => s.name))}

Your output must be a valid JSON object matching this schema exactly, and nothing else (no backticks, no markdown):
{
  "intent": "rankings" | "compare" | "district_performance" | "subject_strength" | "predict" | "national_stats" | "outliers" | "general_help",
  "schoolIds": string[], // ids of schools identified in the question
  "districtId": string, // id of district identified in the question
  "year": number, // academic year between 2015 and 2025 (default 2025)
  "level": "UCE" | "UACE", // (default "UCE" unless specified "A-level" or "UACE" or "U.A.C.E")
  "subjectName": string // name of the subject if specified (e.g. "Mathematics", "Physics")
}

User Question: "${message}"
`;

    const plannerResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: plannerPrompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    let plan: any = { intent: "general_help", schoolIds: [], year: 2025, level: ExamLevel.UCE };
    try {
      const cleanedText = plannerResponse.text ? plannerResponse.text.trim() : '{}';
      plan = JSON.parse(cleanedText);
    } catch (e) {
      console.error("Failed to parse planner output:", plannerResponse.text);
    }

    // --- STEP 2: ANALYTICS ENGINE INVOCATION ---
    // Trigger calculations based on matched intent
    let calculatedResults: any = null;
    let calculationTrace = "";

    switch (plan.intent) {
      case "rankings":
        calculatedResults = AnalyticsEngine.getRankings(plan.year || 2025, plan.level || ExamLevel.UCE).slice(0, 10);
        calculationTrace = `Retrieved top 10 ranked schools for ${plan.level || 'UCE'} in ${plan.year || 2025}`;
        break;

      case "compare":
        const idsToCompare = plan.schoolIds && plan.schoolIds.length > 0 
          ? plan.schoolIds 
          : ["s_budo", "s_kitende"]; // Default if none identified
        calculatedResults = AnalyticsEngine.compareSchools(idsToCompare, plan.level || ExamLevel.UCE);
        calculationTrace = `Compared schools [${idsToCompare.join(', ')}] for ${plan.level || 'UCE'}`;
        break;

      case "district_performance":
        calculatedResults = AnalyticsEngine.getDistrictPerformance(plan.year || 2025, plan.level || ExamLevel.UCE);
        calculationTrace = `Calculated performance for districts in ${plan.year || 2025} (${plan.level || 'UCE'})`;
        break;

      case "subject_strength":
        const targetSchoolId = plan.schoolIds && plan.schoolIds[0] ? plan.schoolIds[0] : "s_budo";
        calculatedResults = AnalyticsEngine.getSubjectStrengths(targetSchoolId, plan.level || ExamLevel.UCE, plan.year || 2025);
        calculationTrace = `Evaluated subject strengths/weaknesses for school ${targetSchoolId} in ${plan.year || 2025}`;
        break;

      case "predict":
        const predSchoolId = plan.schoolIds && plan.schoolIds[0] ? plan.schoolIds[0] : "s_budo";
        calculatedResults = AnalyticsEngine.predictPerformance(predSchoolId, plan.level || ExamLevel.UCE);
        calculationTrace = `Ran linear regression forecast for school ${predSchoolId} (${plan.level || 'UCE'}) to 2026`;
        break;

      case "national_stats":
        calculatedResults = AnalyticsEngine.getNationalStats(plan.year || 2025, plan.level || ExamLevel.UCE);
        calculationTrace = `Calculated national aggregation stats for ${plan.year || 2025} (${plan.level || 'UCE'})`;
        break;

      case "outliers":
        calculatedResults = AnalyticsEngine.getOutlierSchools(plan.level || ExamLevel.UCE);
        calculationTrace = `Identified national outlier schools (outstanding improvers and declining schools)`;
        break;

      default:
        // Default to national statistics overview as context
        calculatedResults = AnalyticsEngine.getNationalStats(2025, ExamLevel.UCE);
        calculationTrace = "Defaulted to 2025 National UCE statistics context";
        break;
    }

    // --- STEP 3: AI EXPLANATION LAYER ---
    // Inject the real calculations into the explanation prompt to prevent hallucination
    const explanationPrompt = `
You are the AI Explanation Layer for the Uganda National Examinations Board (UNEB) Education Intelligence Platform, "EduIntel AI".

Your goal is to explain and summarize computed results from the national analytics engine to a user (who could be a parent, district official, or school administrator).

CRITICAL RULE:
- Do NOT make up or hallucinate any statistics.
- ONLY speak using the calculated metrics provided below.
- Keep the tone highly professional, objective, and authoritative.
- Present your response using beautiful, structured Markdown. Use bold key terms and clean lists.

User Question: "${message}"

Matched Intent: ${plan.intent}
Calculated Results from Analytics Engine (RAW DATA):
${JSON.stringify(calculatedResults, null, 2)}

Provide the final calculated response. State the reasoning behind each metric.
`;

    const explanationResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: explanationPrompt
    });

    res.json({
      reply: explanationResponse.text,
      trace: {
        intent: plan.intent,
        queriesUsed: plan,
        calculations: calculationTrace
      }
    });

  } catch (error: any) {
    console.error("Chat error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Vite Middleware integration for single-port full-stack architecture
if (process.env.NODE_ENV !== 'production') {
  const { createServer } = await import('vite');
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
  });
  
  app.use(vite.middlewares);
  
  app.use('*', async (req, res, next) => {
    const url = req.originalUrl;
    try {
      // Serve index.html dynamically
      let template = await vite.transformIndexHtml(url, `
        <!doctype html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>EduIntel AI - UNEB Intelligence Platform</title>
          </head>
          <body>
            <div id="root"></div>
            <script type="module" src="/src/main.tsx"></script>
          </body>
        </html>
      `);
      res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
} else {
  // Production serving
  app.use(express.static(path.join(__dirname, '../dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running at http://0.0.0.0:${port}`);
});
