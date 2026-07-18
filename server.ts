import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { AnalyticsEngine } from './src/lib/analyticsEngine.js';
import { SCHOOLS, DISTRICTS, SUBJECTS, YEARLY_PERFORMANCE } from './src/data/unebData.js';
import { ExamLevel } from './src/types.js';
import { ContextEngine } from './src/services/contextEngine.js';
import { PromptBuilder } from './src/services/promptBuilder.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.use(express.json());

// Initialize Gemini API
const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// Helper to call Gemini with robust exponential backoff retries (handles temporary 503 load spikes)
async function callGeminiWithRetry(aiClient: any, params: any, maxRetries = 3, delayMs = 1500): Promise<any> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await aiClient.models.generateContent(params);
    } catch (error: any) {
      attempt++;
      console.warn(`Gemini API call failed (attempt ${attempt}/${maxRetries}):`, error);
      if (attempt >= maxRetries) {
        throw error;
      }
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, attempt - 1)));
    }
  }
}

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
// User Question -> ContextEngine (Intent Detection & Retrieval) -> PromptBuilder -> Gemma -> Structured AI Response
app.post('/api/chat', async (req, res) => {
  const { message, chatHistory = [], sessionId = "default", role = "statistician", thinking = false } = req.body;

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
    // 1. Resolve intent with memory integration
    const plan = await ContextEngine.resolveIntent(message, chatHistory, ai, sessionId);

    // 2. Retrieve structured calculations & context from Analytics Engine
    const context = await ContextEngine.getContext(plan);

    // 3. Compile prompt with robust system rules using selected role
    const systemInstruction = PromptBuilder.getSystemPrompt(role);
    const compiledPrompt = PromptBuilder.buildExplanationPrompt(message, plan, context, chatHistory);

    // Select suitable model and configuration based on intent, role, and thinking level parameters
    let modelName = 'gemini-3.5-flash';
    const apiConfig: any = {
      systemInstruction: systemInstruction
    };

    if (thinking) {
      modelName = 'gemini-3.1-pro-preview';
      apiConfig.thinkingConfig = {
        thinkingLevel: ThinkingLevel.HIGH
      };
      // Note: Do not set maxOutputTokens when using thinkingLevel HIGH
    } else {
      const fastIntents = ["rankings", "district_performance", "general_help"];
      const complexIntents = ["predict", "policy_recommendations", "school_improvement"];

      if (role === "policy_consultant" || complexIntents.includes(plan.intent)) {
        modelName = 'gemini-3.1-pro-preview';
      } else if (role === "student_coach" || fastIntents.includes(plan.intent)) {
        modelName = 'gemini-3.1-flash-lite';
      } else {
        modelName = 'gemini-3.5-flash';
      }
    }

    // 4. Generate content from Gemma with Retry
    const response = await callGeminiWithRetry(ai, {
      model: modelName,
      contents: compiledPrompt,
      config: apiConfig
    });

    res.json({
      reply: response.text,
      trace: {
        intent: plan.intent,
        queriesUsed: {
          intent: plan.intent,
          schoolIds: plan.schoolIds,
          districtId: plan.districtId,
          year: plan.year,
          level: plan.level,
          subjectName: plan.subjectName
        },
        calculations: plan.explanationTrace
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
    let reportContext: any = null;
    
    if (reportType === "school") {
      const schoolId = targetId || "s_budo";
      const school = SCHOOLS.find(s => s.id === schoolId) || SCHOOLS[0];
      const consistency = AnalyticsEngine.getSchoolConsistency(schoolId, level);
      const subjects = AnalyticsEngine.getSubjectStrengths(schoolId, level, year);
      const prediction = AnalyticsEngine.predictPerformance(schoolId, level);
      const history = YEARLY_PERFORMANCE.filter(p => p.schoolId === schoolId && p.level === level)
        .sort((a, b) => a.year - b.year);
      
      reportContext = {
        scope: "School Turnaround Report",
        school,
        consistency,
        subjects,
        prediction,
        history
      };
    } else if (reportType === "district") {
      const districtId = targetId || "d_kampala";
      const district = DISTRICTS.find(d => d.id === districtId) || DISTRICTS[0];
      const distPerf = AnalyticsEngine.getDistrictPerformance(year, level);
      const specificPerf = distPerf.find(d => d.districtId === districtId);
      
      reportContext = {
        scope: "District Education Management Brief",
        district,
        performance: specificPerf,
        allDistrictsBenchmark: distPerf.slice(0, 5)
      };
    } else {
      // default: national overview
      const nationalStats = AnalyticsEngine.getNationalStats(year, level);
      const outliers = AnalyticsEngine.getOutlierSchools(level);
      
      reportContext = {
        scope: "National Educational Standards Report",
        nationalStats,
        outstandingImprovers: outliers.filter(o => o.type === "Outstanding Improver").slice(0, 5),
        decliningSchools: outliers.filter(o => o.type === "Needs Support (Declining)").slice(0, 5)
      };
    }

    const reportPrompt = `
You are a senior education intelligence analyst compiling a formal educational report for Uganda's Ministry of Education.
Report Category: ${reportType} (context identifier: ${targetId || 'National Overview'})
Academic Cycle: ${year}
Curriculum: ${level}

--- GROUND TRUTH DATA ---
${JSON.stringify(reportContext, null, 2)}

Your output must be a valid JSON object matching this schema exactly, and nothing else (no markdown backticks, no wrapping):
{
  "executiveSummary": "A concise paragraph summarizing core performance findings and strategic indicators based strictly on the ground truth data",
  "keyInsights": ["Data Insight 1", "Data Insight 2", "Data Insight 3"],
  "trendAnalysis": "A short summary paragraph tracking performance trajectories across the decade based on history",
  "predictions": "2026 forecast and projections for this target context based on linear regressions",
  "confidence": "Calculated statistical confidence description (e.g. High, R² = 0.94)",
  "recommendations": ["Recommendation 1", "Recommendation 2", "Recommendation 3"],
  "actionPlan": ["Phase 1 (Month 1-3) Action Plan", "Phase 2 (Month 4-6) Action Plan", "Phase 3 (Month 7-12) Action Plan"]
}
`;

    const response = await callGeminiWithRetry(ai, {
      model: 'gemini-3.5-flash',
      contents: reportPrompt,
      config: { responseMimeType: "application/json" }
    });

    const rawText = response.text ? response.text.trim() : '{}';
    let cleanText = rawText;
    if (cleanText.startsWith("```")) {
      cleanText = cleanText.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();
    }
    const parsed = JSON.parse(cleanText);
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
    // Inject rich context: poverty rates, national stats, outstanding/declining regions
    const districts = DISTRICTS.sort((a, b) => b.povertyRate - a.povertyRate); // high poverty first
    const outliersList = AnalyticsEngine.getOutlierSchools(ExamLevel.UCE);
    const uceStats = AnalyticsEngine.getNationalStats(2025, ExamLevel.UCE);
    
    const policyContext = {
      marginalized_districts: districts.slice(0, 5),
      declining_outliers: outliersList.filter(o => o.type === "Needs Support (Declining)").slice(0, 5),
      national_averages: uceStats
    };

    const policyPrompt = `
You are a Senior Education Policy Strategist for the Republic of Uganda.
Formulate a highly strategic, evidence-based advisory brief for the topic: "${topic}".
Additional context query: "${queryText || 'None'}"

--- GROUND TRUTH CONTEXT ---
${JSON.stringify(policyContext, null, 2)}

Your output must be a valid JSON object matching this schema exactly, and nothing else:
{
  "priorityAreas": "Identify primary areas at risk or requiring immediate interventions, referencing the specific districts and stats provided",
  "evidence": "Detail quantitative data trends and historical benchmarks that support this intervention using exact context metrics",
  "expectedImpact": "Forecast expected performance increases or dropout rate reductions (e.g., Target +5% in marginalized districts)",
  "costConsiderations": "Explain estimated budget structures, subsidies, or teacher allowances required (e.g., regional teacher allowances)",
  "recommendedActions": ["Immediate strategic action 1", "Immediate strategic action 2", "Immediate strategic action 3"],
  "implementationTimeline": "Formulate a concrete quarterly timeline for deployment over 12-18 months"
}
`;

    const response = await callGeminiWithRetry(ai, {
      model: 'gemini-3.1-pro-preview',
      contents: policyPrompt,
      config: { responseMimeType: "application/json" }
    });

    const rawText = response.text ? response.text.trim() : '{}';
    let cleanText = rawText;
    if (cleanText.startsWith("```")) {
      cleanText = cleanText.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();
    }
    const parsed = JSON.parse(cleanText);
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
    const targetSchoolId = schoolId || "s_budo";
    const school = SCHOOLS.find(s => s.id === targetSchoolId) || SCHOOLS[0];
    const consistency = AnalyticsEngine.getSchoolConsistency(targetSchoolId, level);
    const subjects = AnalyticsEngine.getSubjectStrengths(targetSchoolId, level, 2025);
    const prediction = AnalyticsEngine.predictPerformance(targetSchoolId, level);

    const improvementContext = {
      school,
      consistency,
      subjects,
      prediction
    };

    const improvementPrompt = `
You are an institutional turnaround consultant. Design a school improvement roadmap for:
School: ${school.name} (District: ${school.districtName}, Level: ${level})

--- INSTITUTIONAL GROUND TRUTH ---
${JSON.stringify(improvementContext, null, 2)}

Your output must be a valid JSON object matching this schema exactly, and nothing else:
{
  "strengths": ["Strength 1 (citing specific subjects or consistency score)", "Strength 2", "Strength 3"],
  "weaknesses": ["Weakness 1 (citing weak subjects or declining trend)", "Weakness 2"],
  "roadmap12Month": [
    { "month": "Months 1-3", "focus": "Brief focus description", "actions": ["Action 1", "Action 2"] },
    { "month": "Months 4-6", "focus": "Brief focus description", "actions": ["Action 1", "Action 2"] },
    { "month": "Months 7-12", "focus": "Brief focus description", "actions": ["Action 1", "Action 2"] }
  ],
  "teacherRecs": ["Recommendation 1", "Recommendation 2"],
  "resourceRecs": ["Resource Upgrade 1", "Resource Upgrade 2"],
  "expectedOutcomes": ["Outcome target 1 (citing projected pass rates or mean scores)", "Outcome target 2"]
}
`;

    const response = await callGeminiWithRetry(ai, {
      model: 'gemini-3.1-pro-preview',
      contents: improvementPrompt,
      config: { responseMimeType: "application/json" }
    });

    const rawText = response.text ? response.text.trim() : '{}';
    let cleanText = rawText;
    if (cleanText.startsWith("```")) {
      cleanText = cleanText.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();
    }
    const parsed = JSON.parse(cleanText);
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
    // Get national aggregate averages for subjects
    const uceStats = AnalyticsEngine.getNationalStats(2025, ExamLevel.UCE);
    const targetSubjectAvg = uceStats?.subjectAverages.find(s => s.subjectName.toLowerCase() === (subject || '').toLowerCase());

    const studentContext = {
      requestedSubject: subject,
      studentPerformanceStatement: performance,
      nationalSubjectAverageScore: targetSubjectAvg || { averageScore: 4.5 }
    };

    const studentPrompt = `
You are a empathetic student tutor preparing a candidate for UNEB secondary exams.
Subject: ${subject}
Student challenge description: "${performance}"

--- CONTEXTUAL BENCHMARKS ---
${JSON.stringify(studentContext, null, 2)}

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

    const response = await callGeminiWithRetry(ai, {
      model: 'gemini-3.1-flash-lite',
      contents: studentPrompt,
      config: { responseMimeType: "application/json" }
    });

    const rawText = response.text ? response.text.trim() : '{}';
    let cleanText = rawText;
    if (cleanText.startsWith("```")) {
      cleanText = cleanText.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();
    }
    const parsed = JSON.parse(cleanText);
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
    let predictionContext: any = null;

    if (targetType === "school") {
      const schoolId = targetId || "s_budo";
      predictionContext = {
        scope: "School Forecast",
        school: SCHOOLS.find(s => s.id === schoolId),
        regression: AnalyticsEngine.predictPerformance(schoolId, level)
      };
    } else {
      const outliers = AnalyticsEngine.getOutlierSchools(level);
      predictionContext = {
        scope: "National Trajectory Forecast",
        regression_outliers: outliers.slice(0, 5)
      };
    }

    const predictionPrompt = `
You are a senior data forecaster predicting outcomes for Uganda's upcoming 2026 UNEB examination cohort.
Scope: ${targetType} (Context identifier: ${targetId || 'National Overview'})
Level: ${level}

--- HISTORICAL REGRESSIONS GROUND TRUTH ---
${JSON.stringify(predictionContext, null, 2)}

Your output must be a valid JSON object matching this schema exactly, and nothing else:
{
  "predictedOutcomes": "Specify expected grade distributions and passing ratios with numerical projections based directly on the regressions provided",
  "confidenceLevel": "Model confidence level based on provided metrics (e.g. High, R² = 0.94)",
  "factors": ["Contributing factor 1", "Contributing factor 2", "Contributing factor 3"],
  "riskMitigation": ["Risk mitigation strategy 1", "Risk mitigation strategy 2"]
}
`;

    const response = await callGeminiWithRetry(ai, {
      model: 'gemini-3.1-pro-preview',
      contents: predictionPrompt,
      config: { responseMimeType: "application/json" }
    });

    const rawText = response.text ? response.text.trim() : '{}';
    let cleanText = rawText;
    if (cleanText.startsWith("```")) {
      cleanText = cleanText.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();
    }
    const parsed = JSON.parse(cleanText);
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

    const response = await callGeminiWithRetry(ai, {
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
