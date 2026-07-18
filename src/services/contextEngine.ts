import { AnalyticsEngine } from "../lib/analyticsEngine.js";
import { SCHOOLS, DISTRICTS, YEARLY_PERFORMANCE, SUBJECTS } from "../data/unebData.js";
import { ExamLevel } from "../types.js";
import { Type } from "@google/genai";

export interface IntentPlan {
  intent: 
    | "rankings"
    | "compare"
    | "district_performance"
    | "subject_strength"
    | "predict"
    | "national_stats"
    | "outliers"
    | "policy_recommendations"
    | "school_improvement"
    | "student_assistant"
    | "general_help";
  schoolIds: string[];
  districtId: string;
  year: number;
  level: ExamLevel;
  subjectName?: string;
  confidence: "High" | "Moderate" | "Low";
  explanationTrace: string;
}

// Conversation context history memory
export interface ConversationSession {
  lastSchoolIds?: string[];
  lastDistrictId?: string;
  lastLevel?: ExamLevel;
  lastYear?: number;
  lastIntent?: string;
}

// Caching in-memory to minimize API usage
const analyticsCache = new Map<string, any>();

export class ContextEngine {
  private static sessionMemory = new Map<string, ConversationSession>();

  /**
   * Retrieves or initializes session memory for follow-up questions
   */
  static getSession(sessionId: string): ConversationSession {
    if (!this.sessionMemory.has(sessionId)) {
      this.sessionMemory.set(sessionId, {});
    }
    return this.sessionMemory.get(sessionId)!;
  }

  /**
   * Updates session memory with the latest context
   */
  static updateSession(sessionId: string, updates: Partial<ConversationSession>) {
    const session = this.getSession(sessionId);
    this.sessionMemory.set(sessionId, { ...session, ...updates });
  }

  /**
   * Fast, robust intent classifier with follow-up memory mapping
   */
  static async resolveIntent(
    message: string, 
    chatHistory: { sender: string; text: string }[] = [],
    aiInstance: any,
    sessionId: string = "default"
  ): Promise<IntentPlan> {
    const session = this.getSession(sessionId);
    const lowercaseMsg = message.toLowerCase();

    // Setup defaults
    let year = session.lastYear || 2025;
    let level = session.lastLevel || ExamLevel.UCE;
    
    // Parse year from message
    const yearMatch = message.match(/\b(201[5-9]|202[0-5])\b/);
    if (yearMatch) {
      year = parseInt(yearMatch[0]);
    }

    // Parse level
    if (lowercaseMsg.includes("uace") || lowercaseMsg.includes("a level") || lowercaseMsg.includes("a-level")) {
      level = ExamLevel.UACE;
    } else if (lowercaseMsg.includes("uce") || lowercaseMsg.includes("o level") || lowercaseMsg.includes("o-level")) {
      level = ExamLevel.UCE;
    }

    // Detect school IDs in message
    const schoolIds: string[] = [];
    SCHOOLS.forEach(s => {
      const sName = s.name.toLowerCase();
      // Match exact name or major keywords
      if (lowercaseMsg.includes(sName)) {
        schoolIds.push(s.id);
      } else {
        // Match key parts like "Kitende", "Budo", "Namugongo", "Gayaza"
        const keywords = sName.split(/\s+/).filter(w => w.length > 4 && w !== "boarding" && w !== "school" && w !== "high" && w !== "college");
        const hasKeyword = keywords.some(k => lowercaseMsg.includes(k));
        if (hasKeyword && !schoolIds.includes(s.id)) {
          schoolIds.push(s.id);
        }
      }
    });

    // Detect district ID
    let districtId = "";
    DISTRICTS.forEach(d => {
      if (lowercaseMsg.includes(d.name.toLowerCase())) {
        districtId = d.id;
      }
    });

    // Extract Subject
    let matchedSubject = "";
    SUBJECTS.forEach(sub => {
      if (lowercaseMsg.includes(sub.name.toLowerCase())) {
        matchedSubject = sub.name;
      }
    });

    // Memory substitution for follow-up questions
    // If no schools found but we had a last school in session, substitute it!
    if (schoolIds.length === 0 && session.lastSchoolIds && session.lastSchoolIds.length > 0) {
      // E.g., user asks "What about their chemistry strengths?" -> uses last school
      if (lowercaseMsg.includes("their") || lowercaseMsg.includes("it") || lowercaseMsg.includes("strengths") || lowercaseMsg.includes("predict") || lowercaseMsg.includes("rank") || lowercaseMsg.includes("compare")) {
        schoolIds.push(...session.lastSchoolIds);
      }
    }

    // Let's use Gemini to perform precise classification if aiInstance is present
    let intent: IntentPlan["intent"] = "general_help";
    let confidence: IntentPlan["confidence"] = "High";
    let trace = "";

    if (aiInstance) {
      try {
        const prompt = `
You are the AI Query Planner for UNEB EduIntel.
Categorize this question into ONE of the the specified intents.

User Question: ${JSON.stringify(message)}
Previous Session Context: ${JSON.stringify(session)}

Return a strict JSON object adhering to the specified schema.
`;
        const res = await aiInstance.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                intent: {
                  type: Type.STRING,
                  enum: [
                    "rankings",
                    "compare",
                    "district_performance",
                    "subject_strength",
                    "predict",
                    "national_stats",
                    "outliers",
                    "policy_recommendations",
                    "school_improvement",
                    "student_assistant",
                    "general_help"
                  ]
                },
                level: {
                  type: Type.STRING,
                  enum: ["UCE", "UACE"]
                },
                year: {
                  type: Type.INTEGER
                }
              },
              required: ["intent", "level", "year"]
            }
          }
        });

        const parsed = JSON.parse(res.text ? res.text.trim() : '{}');
        if (parsed.intent) {
          intent = parsed.intent;
          if (parsed.level) level = parsed.level === "UACE" ? ExamLevel.UACE : ExamLevel.UCE;
          if (parsed.year) year = parsed.year;
        }
      } catch (err) {
        console.error("ContextEngine: intent classification error, falling back to heuristics.", err);
        // Fallback heuristics
        if (schoolIds.length >= 2 || lowercaseMsg.includes("compare") || lowercaseMsg.includes("versus") || lowercaseMsg.includes("vs")) {
          intent = "compare";
        } else if (lowercaseMsg.includes("predict") || lowercaseMsg.includes("forecast") || lowercaseMsg.includes("2026") || lowercaseMsg.includes("future")) {
          intent = "predict";
        } else if (lowercaseMsg.includes("subject") || lowercaseMsg.includes("strong") || lowercaseMsg.includes("weak") || matchedSubject) {
          intent = "subject_strength";
        } else if (lowercaseMsg.includes("policy") || lowercaseMsg.includes("strategy") || lowercaseMsg.includes("intervention") || lowercaseMsg.includes("ministry")) {
          intent = "policy_recommendations";
        } else if (lowercaseMsg.includes("improve") || lowercaseMsg.includes("roadmap") || lowercaseMsg.includes("turnaround")) {
          intent = "school_improvement";
        } else if (lowercaseMsg.includes("student") || lowercaseMsg.includes("prepare") || lowercaseMsg.includes("study") || lowercaseMsg.includes("plan")) {
          intent = "student_assistant";
        } else if (lowercaseMsg.includes("district")) {
          intent = "district_performance";
        } else if (lowercaseMsg.includes("rank") || lowercaseMsg.includes("best") || lowercaseMsg.includes("top")) {
          intent = "rankings";
        } else if (lowercaseMsg.includes("national") || lowercaseMsg.includes("uganda") || lowercaseMsg.includes("overall")) {
          intent = "national_stats";
        } else if (lowercaseMsg.includes("outlier") || lowercaseMsg.includes("improve") || lowercaseMsg.includes("decline")) {
          intent = "outliers";
        }
      }
    }

    // Set fallback schools if none found for school intents
    if ((intent === "compare" || intent === "subject_strength" || intent === "predict" || intent === "school_improvement") && schoolIds.length === 0) {
      schoolIds.push("s_budo"); // fallback default
    }

    const uniqueSchoolIds = Array.from(new Set(schoolIds));

    // Refine confidence rating
    if (intent === "predict" && uniqueSchoolIds.length > 0) {
      const perfs = YEARLY_PERFORMANCE.filter(p => p.schoolId === uniqueSchoolIds[0] && p.level === level);
      confidence = perfs.length >= 5 ? "High" : perfs.length >= 3 ? "Moderate" : "Low";
    } else if (intent === "compare" && uniqueSchoolIds.length < 2) {
      confidence = "Moderate";
    } else {
      confidence = "High";
    }

    trace = `Detected intent: ${intent.toUpperCase()} for ${level} level. Year: ${year}. Identified entities: Schools: [${uniqueSchoolIds.map(id => SCHOOLS.find(s => s.id === id)?.name || id).join(', ')}], District: ${districtId || 'None'}`;

    // Store in session memory
    this.updateSession(sessionId, {
      lastSchoolIds: uniqueSchoolIds.length > 0 ? uniqueSchoolIds : session.lastSchoolIds,
      lastDistrictId: districtId || session.lastDistrictId,
      lastLevel: level,
      lastYear: year,
      lastIntent: intent
    });

    return {
      intent,
      schoolIds: uniqueSchoolIds,
      districtId,
      year,
      level,
      subjectName: matchedSubject,
      confidence,
      explanationTrace: trace
    };
  }

  /**
   * Retrieves structural context for the specified intent plan
   */
  static async getContext(plan: IntentPlan): Promise<{ data: any; metadata: any }> {
    const cacheKey = `${plan.intent}_${plan.schoolIds.join("-")}_${plan.districtId}_${plan.year}_${plan.level}_${plan.subjectName}`;
    
    if (analyticsCache.has(cacheKey)) {
      return analyticsCache.get(cacheKey);
    }

    let calculatedData: any = null;
    let metadata: any = {
      standards: "Uganda National Examinations Board (UNEB)",
      academic_year: plan.year,
      curriculum: plan.level === ExamLevel.UCE ? "O-Level (UCE)" : "A-Level (UACE)",
      confidence: plan.confidence
    };

    switch (plan.intent) {
      case "rankings":
        const rankings = AnalyticsEngine.getRankings(plan.year, plan.level);
        calculatedData = rankings.slice(0, 15); // Top 15 schools
        metadata.total_schools_ranked = rankings.length;
        break;

      case "compare":
        const comparisonIds = plan.schoolIds.length > 0 ? plan.schoolIds : ["s_budo", "s_kitende"];
        calculatedData = AnalyticsEngine.compareSchools(comparisonIds, plan.level);
        calculatedData.forEach((item: any) => {
          item.context = SCHOOLS.find(s => s.id === item.school.id);
        });
        break;

      case "district_performance":
        const distPerf = AnalyticsEngine.getDistrictPerformance(plan.year, plan.level);
        calculatedData = plan.districtId 
          ? distPerf.find(d => d.districtId === plan.districtId) || distPerf.slice(0, 5)
          : distPerf.slice(0, 10);
        break;

      case "subject_strength":
        const schoolId = plan.schoolIds[0] || "s_budo";
        calculatedData = {
          school: SCHOOLS.find(s => s.id === schoolId),
          subjects: AnalyticsEngine.getSubjectStrengths(schoolId, plan.level, plan.year)
        };
        break;

      case "predict":
        const predId = plan.schoolIds[0] || "s_budo";
        calculatedData = {
          school: SCHOOLS.find(s => s.id === predId),
          regression: AnalyticsEngine.predictPerformance(predId, plan.level),
          historical: YEARLY_PERFORMANCE.filter(p => p.schoolId === predId && p.level === plan.level)
            .sort((a, b) => a.year - b.year)
        };
        break;

      case "national_stats":
        calculatedData = AnalyticsEngine.getNationalStats(plan.year, plan.level);
        break;

      case "outliers":
        calculatedData = AnalyticsEngine.getOutlierSchools(plan.level);
        break;

      case "policy_recommendations":
        // Collect poverty rates, national stats, and subject failures to give rich context
        const districts = DISTRICTS.sort((a, b) => b.povertyRate - a.povertyRate); // high poverty first
        const outliersList = AnalyticsEngine.getOutlierSchools(plan.level);
        const uceStats = AnalyticsEngine.getNationalStats(2025, ExamLevel.UCE);
        calculatedData = {
          marginalized_districts: districts.slice(0, 5),
          declining_outliers: outliersList.filter(o => o.type === "Needs Support (Declining)").slice(0, 5),
          national_averages: uceStats
        };
        break;

      case "school_improvement":
        const impId = plan.schoolIds[0] || "s_budo";
        calculatedData = {
          school: SCHOOLS.find(s => s.id === impId),
          consistency: AnalyticsEngine.getSchoolConsistency(impId, plan.level),
          subjects: AnalyticsEngine.getSubjectStrengths(impId, plan.level, plan.year)
        };
        break;

      case "student_assistant":
        const studId = plan.schoolIds[0] || "s_budo";
        calculatedData = {
          school: SCHOOLS.find(s => s.id === studId),
          subjectName: plan.subjectName || "Mathematics",
          averages: AnalyticsEngine.getSubjectStrengths(studId, plan.level, plan.year)
        };
        break;

      default:
        calculatedData = AnalyticsEngine.getNationalStats(2025, ExamLevel.UCE);
        break;
    }

    const result = { data: calculatedData, metadata };
    
    // Store in cache
    analyticsCache.set(cacheKey, result);
    return result;
  }
}
