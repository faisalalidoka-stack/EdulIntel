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
    // Use gemini-3.5-flash to structure the intent and extract metadata in structured JSON
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
      model: 'gemini-3.5-flash',
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
          : ["s_budo", "s_kitende"];
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
        calculatedResults = AnalyticsEngine.getNationalStats(2025, ExamLevel.UCE);
        calculationTrace = "Defaulted to 2025 National UCE statistics context";
        break;
    }

    // --- STEP 3: AI EXPLANATION LAYER ---
    const explanationPrompt = `
You are the AI Explanation Layer for the Uganda National Examinations Board (UNEB) Education Intelligence Platform, "EduIntel AI".
Your goal is to explain and summarize computed results from the national analytics engine to a user.

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
      model: 'gemini-3.5-flash',
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

// AI Report Generator Endpoint
app.post('/api/reports/generate', async (req, res) => {
  const { reportType, targetId, year = 2025, level = ExamLevel.UCE } = req.body;

  if (!ai) {
    return res.status(500).json({ error: "Gemini API key is missing" });
  }

  try {
    const reportPrompt = `
You are a senior education intelligence analyst compiling a formal educational report for Uganda's Ministry of Education.
Report Category: ${reportType} (context identifier: ${targetId || 'National Overview'})
Academic Cycle: ${year}
Curriculum: ${level}

Your output must be a valid JSON object matching this schema exactly, and nothing else (no markdown backticks, no wrapping):
{
  "executiveSummary": "A concise paragraph summarizing core performance findings and strategic indicators",
  "keyInsights": ["Insight 1", "Insight 2", "Insight 3"],
  "trendAnalysis": "A short summary paragraph tracking performance trajectories across the decade",
  "predictions": "2026 forecast and projections for this target context based on linear regressions",
  "confidence": "Calculated statistical confidence description (e.g. High, R² = 0.94)",
  "recommendations": ["Recommendation 1", "Recommendation 2", "Recommendation 3"],
  "actionPlan": ["Phase 1 (Month 1-3) Action Plan", "Phase 2 (Month 4-6) Action Plan", "Phase 3 (Month 7-12) Action Plan"]
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: reportPrompt,
      config: { responseMimeType: "application/json" }
    });

    const parsed = JSON.parse(response.text ? response.text.trim() : '{}');
    res.json(parsed);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// AI Policy Advisor Endpoint
app.post('/api/policy/advise', async (req, res) => {
  const { topic, queryText } = req.body;

  if (!ai) {
    return res.status(500).json({ error: "Gemini API key is missing" });
  }

  try {
    const policyPrompt = `
You are a Senior Education Policy Strategist for the Republic of Uganda.
Formulate a highly strategic, evidence-based advisory brief for the topic: "${topic}".
Additional context query: "${queryText || 'None'}"

Your output must be a valid JSON object matching this schema exactly, and nothing else:
{
  "priorityAreas": "Identify primary areas at risk or requiring immediate interventions",
  "evidence": "Detail quantitative data trends and historical benchmarks that support this intervention",
  "expectedImpact": "Forecast expected performance increases or dropout rate reductions",
  "costConsiderations": "Explain estimated budget structures, subsidies, or teacher allowances required",
  "recommendedActions": ["Immediate strategic action 1", "Immediate strategic action 2", "Immediate strategic action 3"],
  "implementationTimeline": "Formulate a concrete quarterly timeline for deployment over 12-18 months"
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: policyPrompt,
      config: { responseMimeType: "application/json" }
    });

    const parsed = JSON.parse(response.text ? response.text.trim() : '{}');
    res.json(parsed);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// AI School Improvement Roadmap Endpoint
app.post('/api/school-improvement', async (req, res) => {
  const { schoolId, level } = req.body;

  if (!ai) {
    return res.status(500).json({ error: "Gemini API key is missing" });
  }

  try {
    const school = SCHOOLS.find(s => s.id === schoolId) || SCHOOLS[0];
    const improvementPrompt = `
You are an institutional turnaround consultant. Design a school improvement roadmap for:
School: ${school.name} (District: ${school.districtName}, Level: ${level})

Your output must be a valid JSON object matching this schema exactly, and nothing else:
{
  "strengths": ["Strength 1", "Strength 2", "Strength 3"],
  "weaknesses": ["Weakness 1", "Weakness 2"],
  "roadmap12Month": [
    { "month": "Months 1-3", "focus": "Brief focus description", "actions": ["Action 1", "Action 2"] },
    { "month": "Months 4-6", "focus": "Brief focus description", "actions": ["Action 1", "Action 2"] },
    { "month": "Months 7-12", "focus": "Brief focus description", "actions": ["Action 1", "Action 2"] }
  ],
  "teacherRecs": ["Recommendation 1", "Recommendation 2"],
  "resourceRecs": ["Resource Upgrade 1", "Resource Upgrade 2"],
  "expectedOutcomes": ["Outcome target 1", "Outcome target 2"]
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: improvementPrompt,
      config: { responseMimeType: "application/json" }
    });

    const parsed = JSON.parse(response.text ? response.text.trim() : '{}');
    res.json(parsed);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// AI Student Study Planner Endpoint
app.post('/api/student-assistant', async (req, res) => {
  const { subject, performance } = req.body;

  if (!ai) {
    return res.status(500).json({ error: "Gemini API key is missing" });
  }

  try {
    const studentPrompt = `
You are a empathetic student tutor preparing a candidate for UNEB secondary exams.
Subject: ${subject}
Student challenge description: "${performance}"

Your output must be a valid JSON object matching this schema exactly, and nothing else:
{
  "studyPlan": "A supportive opening paragraph guiding their study mindset",
  "weakAreas": ["Weak area 1", "Weak area 2", "Weak area 3"],
  "resources": ["Curriculum handbook or textbook reference", "UNEB past papers range", "Online reference"],
  "weeklySchedule": [
    { "day": "Days 1-2", "tasks": ["Specific study task 1", "Specific study task 2"] },
    { "day": "Days 3-4", "tasks": ["Specific study task 1", "Specific study task 2"] },
    { "day": "Days 5-7", "tasks": ["Specific study task 1", "Specific study task 2"] }
  ],
  "improvementStrategy": "Specific active-recall or memory tip for this subject"
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: studentPrompt,
      config: { responseMimeType: "application/json" }
    });

    const parsed = JSON.parse(response.text ? response.text.trim() : '{}');
    res.json(parsed);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// AI Predictions Endpoint
app.post('/api/predictions', async (req, res) => {
  const { targetType, targetId, level = ExamLevel.UCE } = req.body;

  if (!ai) {
    return res.status(500).json({ error: "Gemini API key is missing" });
  }

  try {
    const predictionPrompt = `
You are a senior data forecaster predicting outcomes for Uganda's upcoming 2026 UNEB examination cohort.
Scope: ${targetType} (Context identifier: ${targetId || 'National Overview'})
Level: ${level}

Your output must be a valid JSON object matching this schema exactly, and nothing else:
{
  "predictedOutcomes": "Specify expected grade distributions and passing ratios with numerical projections",
  "confidenceLevel": "Model confidence level (e.g. High, R² = 0.94)",
  "factors": ["Contributing factor 1", "Contributing factor 2", "Contributing factor 3"],
  "riskMitigation": ["Risk mitigation strategy 1", "Risk mitigation strategy 2"]
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: predictionPrompt,
      config: { responseMimeType: "application/json" }
    });

    const parsed = JSON.parse(response.text ? response.text.trim() : '{}');
    res.json(parsed);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Analyze imported Google Drive document content with Gemini
app.post('/api/drive/analyze', async (req, res) => {
  const { fileName, fileContent, customQuery } = req.body;

  if (!fileName || !fileContent) {
    return res.status(400).json({ error: 'fileName and fileContent are required' });
  }

  if (!ai) {
    return res.json({
      reply: "The Gemini API Key is not configured yet. Please configure it in the Secrets panel in AI Studio to analyze custom Drive files."
    });
  }

  try {
    const analysisPrompt = `
You are the Lead Analyst at the EduIntel AI Research Lab in Kampala, Uganda.
You are tasked with analyzing an educational dataset, spreadsheet, or report imported directly from the user's Google Drive.

File Name: "${fileName}"
File Content (First 15000 characters):
\`\`\`
${fileContent.substring(0, 15000)}
\`\`\`

User's Analytical Query/Request: "${customQuery || 'Analyze this document, extract key statistical metrics, summarize the main findings, and provide actionable recommendations for Ugandan schools.'}"

Guidelines:
1. Provide a comprehensive, structured response in beautiful Markdown.
2. Be highly specific. Quote numbers, tables, or school names from the dataset.
3. Keep the tone authoritative, encouraging, and academically rigorous.
4. Structure your response with sections like:
   - **Executive Summary**
   - **Key Data Insights & Metrics**
   - **Detailed Trends & Findings**
   - **Actionable Strategic Recommendations**
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: analysisPrompt
    });

    res.json({ reply: response.text });
  } catch (error: any) {
    console.error("Drive analysis error:", error);
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
