export enum ExamLevel {
  UCE = "UCE", // O-Level (Uganda Certificate of Education)
  UACE = "UACE" // A-Level (Uganda Advanced Certificate of Education)
}

export enum Region {
  CENTRAL = "Central",
  WESTERN = "Western",
  EASTERN = "Eastern",
  NORTHERN = "Northern"
}

export interface District {
  id: string;
  name: string;
  region: Region;
  povertyRate: number; // For development correlation analysis
  schoolCount: number;
}

export interface School {
  id: string;
  name: string;
  districtId: string;
  districtName: string;
  region: Region;
  ownership: "Government" | "Private";
  gender: "Co-Ed" | "Girls Only" | "Boys Only";
  foundedYear: number;
  latitude?: number;
  longitude?: number;
}

// Year-by-year aggregated results for a school
export interface SchoolYearlyPerformance {
  schoolId: string;
  year: number;
  level: ExamLevel;
  totalCandidates: number;
  
  // Division distributions
  // For UCE: Div 1, Div 2, Div 3, Div 4, Div U (Ungraded), Div X (Absent)
  // For UACE: 3 Principals, 2 Principals, 1 Principal, 0 Principals (Subsidiary), Fail (F)
  divisions: {
    div1Or3Prin: number; // Div 1 for UCE, 3 Principal Passes for UACE
    div2Or2Prin: number; // Div 2 for UCE, 2 Principal Passes for UACE
    div3Or1Prin: number; // Div 3 for UCE, 1 Principal Pass for UACE
    div4Or0Prin: number; // Div 4 for UCE, 0 Principal Passes (Subsidiary) for UACE
    divUOrFail: number;  // Div U for UCE, Fail for UACE
    divX: number;        // Absent / Ungraded
  };

  // Mean Aggregate Score (UCE) or Mean Points (UACE, max 20)
  meanScore: number; 
  passRate: number; // percentage of candidates passing (e.g. Div 1-4 for UCE, or >= 1 Principal Pass for UACE)

  // Subject performance: Subject -> Average Point (Grade value 1-9 for UCE, or A-F points 5-0 for UACE)
  subjectAverages: {
    [subjectName: string]: number;
  };
}

// Student candidate level record for details & search features
export interface CandidateRecord {
  id: string;
  candidateNumber: string; // e.g. U0001/001
  name: string;
  schoolId: string;
  schoolName: string;
  districtName: string;
  year: number;
  level: ExamLevel;
  gender: "M" | "F";
  division: string; // e.g. "Division 1" or "19 Points"
  aggregateOrPoints: number; // UCE best-8 aggregate (lower is better, 8 to 72) or UACE Points (higher is better, 0 to 20)
  results: {
    [subjectName: string]: string; // e.g. "English: D1", "Mathematics: C3" for UCE, or "Math: A", "Physics: B" for UACE
  };
}

export interface Subject {
  name: string;
  code: string;
  category: "Sciences" | "Humanities" | "Languages" | "Vocational";
}

// Analytics dashboard metrics computed dynamically
export interface AnalyticsSummary {
  year: number;
  level: ExamLevel;
  totalSchools: number;
  totalCandidates: number;
  overallPassRate: number;
  topPerformingSchools: Array<{
    schoolId: string;
    schoolName: string;
    districtName: string;
    passRate: number;
    div1Percent: number;
    meanScore: number;
    rank: number;
  }>;
  divisionTrends: {
    labels: string[];
    counts: number[];
  };
  subjectPerformance: Array<{
    subjectName: string;
    averageGrade: number;
    passRate: number;
  }>;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
  // Execution metadata showing tracing: intent, tool executed, calculated stats
  trace?: {
    intent?: string;
    queriesUsed?: any;
    calculations?: string;
  };
}
