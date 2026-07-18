import { ExamLevel } from "../types";

export interface AIResponsePayload {
  reply: string;
  trace?: {
    intent?: string;
    queriesUsed?: any;
    calculations?: string;
  };
}

export interface ReportPayload {
  executiveSummary: string;
  keyInsights: string[];
  trendAnalysis: string;
  predictions: string;
  recommendations: string[];
  actionPlan: string[];
  confidence: string;
}

export interface PolicyPayload {
  priorityAreas: string;
  evidence: string;
  expectedImpact: string;
  costConsiderations: string;
  recommendedActions: string[];
  implementationTimeline: string;
}

export interface PredictionPayload {
  predictedOutcomes: string;
  confidenceLevel: string;
  factors: string[];
  riskMitigation: string[];
}

export interface RoadmapPayload {
  strengths: string[];
  weaknesses: string[];
  roadmap12Month: { month: string; focus: string; actions: string[] }[];
  teacherRecs: string[];
  resourceRecs: string[];
  expectedOutcomes: string[];
}

export interface StudyPlanPayload {
  studyPlan: string;
  weakAreas: string[];
  resources: string[];
  weeklySchedule: { day: string; tasks: string[] }[];
  improvementStrategy: string;
}

export class GemmaService {
  static async chat(
    message: string,
    chatHistory: { sender: string; text: string }[] = [],
    role: string = "statistician",
    thinking: boolean = false
  ): Promise<AIResponsePayload> {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, chatHistory, role, thinking }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  static async generateReport(reportType: "national" | "district" | "school" | "subject", targetId?: string, year?: number, level?: ExamLevel): Promise<ReportPayload> {
    const res = await fetch("/api/reports/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportType, targetId, year, level }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  static async getPolicyAdvice(topic: string, queryText?: string): Promise<PolicyPayload> {
    const res = await fetch("/api/policy/advise", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, queryText }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  static async generateSchoolRoadmap(schoolId: string, level: ExamLevel): Promise<RoadmapPayload> {
    const res = await fetch("/api/school-improvement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolId, level }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  static async generateStudyPlan(subject: string, performance: string): Promise<StudyPlanPayload> {
    const res = await fetch("/api/student-assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, performance }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  static async getPredictions(targetType: "school" | "district" | "national", targetId?: string, level?: ExamLevel): Promise<PredictionPayload> {
    const res = await fetch("/api/predictions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType, targetId, level }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
}
