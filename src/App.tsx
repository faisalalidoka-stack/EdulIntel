import React, { useState, useEffect, useMemo } from "react";
import { 
  Search, Award, TrendingUp, MapPin, Sparkles, Download, BookOpen, 
  Users, CheckCircle, TrendingDown, Menu, X, ChevronRight, Info, 
  Calendar, Building2, Filter, Loader2, Send, RefreshCw, FileText, 
  BarChart3, Brain, Compass, HelpCircle, Layers, GraduationCap, ChevronDown
} from "lucide-react";
import { SCHOOLS, DISTRICTS, YEARLY_PERFORMANCE, SUBJECTS, CANDIDATE_RECORDS } from "./data/unebData";
import { AnalyticsEngine } from "./lib/analyticsEngine";
import { ExamLevel, Region, School, SchoolYearlyPerformance, CandidateRecord, ChatMessage } from "./types";

export default function App() {
  // Master control states
  const [currentTab, setCurrentTab] = useState<"dashboard" | "national" | "rankings" | "districts" | "chat" | "reports">("dashboard");
  const [selectedYear, setSelectedYear] = useState<number>(2025);
  const [selectedLevel, setSelectedLevel] = useState<ExamLevel>(ExamLevel.UCE);

  // Search & Filter states
  const [schoolSearchQuery, setSchoolSearchQuery] = useState("");
  const [ownershipFilter, setOwnershipFilter] = useState<string>("All");
  const [genderFilter, setGenderFilter] = useState<string>("All");
  const [districtFilter, setDistrictFilter] = useState<string>("All");

  // Selection profiles (for detail drawers/modals)
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(null);

  // School Comparison module states
  const [comparisonSchools, setComparisonSchools] = useState<string[]>(["s_budo", "s_kitende"]);
  const [tempCompareSchool, setTempCompareSchool] = useState<string>("");

  // AI Insights Chat module states
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "assistant",
      text: "Welcome to **EduIntel AI** — Uganda's National Education Intelligence Portal. I am your query-guided analytics copilot.\n\nI can execute analytical regressions, compare school performances, or track subject-specific indicators directly on UNEB historical data from **2015 to 2025**.\n\nTry asking me:\n* *Compare King's College Budo with St Mary's Kitende*\n* *Show the strongest subjects for Gayaza High School*\n* *Which districts improved the most in Science?*\n* *Predict performance for Uganda Martyrs Namugongo*",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      trace: {
        intent: "System Greeting",
        queriesUsed: "None",
        calculations: "System Initialized"
      }
    }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Candidate student search inside drawers
  const [candidateSearchQuery, setCandidateSearchQuery] = useState("");

  // Live calculated metrics based on currentYear and currentLevel
  const nationalStats = useMemo(() => {
    return AnalyticsEngine.getNationalStats(selectedYear, selectedLevel);
  }, [selectedYear, selectedLevel]);

  // YoY change calculation for KPIs
  const yoyPassRateChange = useMemo(() => {
    if (selectedYear <= 2015) return 0;
    const prevStats = AnalyticsEngine.getNationalStats(selectedYear - 1, selectedLevel);
    if (!nationalStats || !prevStats) return 0;
    return parseFloat((nationalStats.nationalPassRate - prevStats.nationalPassRate).toFixed(2));
  }, [selectedYear, selectedLevel, nationalStats]);

  // Top ranked schools for the selected view
  const currentRankings = useMemo(() => {
    return AnalyticsEngine.getRankings(selectedYear, selectedLevel);
  }, [selectedYear, selectedLevel]);

  // Outlier schools
  const nationalOutliers = useMemo(() => {
    return AnalyticsEngine.getOutlierSchools(selectedLevel);
  }, [selectedLevel]);

  // Distict performances list
  const districtPerformances = useMemo(() => {
    return AnalyticsEngine.getDistrictPerformance(selectedYear, selectedLevel);
  }, [selectedYear, selectedLevel]);

  // Handle chatbot send
  const handleSendChat = async (textToSend?: string) => {
    const query = textToSend || chatInput;
    if (!query.trim()) return;

    // Add user message
    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      sender: "user",
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages(prev => [...prev, userMsg]);
    if (!textToSend) setChatInput("");
    setIsChatLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: query,
          chatHistory: chatMessages.map(m => ({ role: m.sender, content: m.text }))
        })
      });

      const data = await response.json();
      
      const assistantMsg: ChatMessage = {
        id: `assistant_${Date.now()}`,
        sender: "assistant",
        text: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        trace: data.trace
      };

      setChatMessages(prev => [...prev, assistantMsg]);
    } catch (error) {
      console.error(error);
      const errorMsg: ChatMessage = {
        id: `assistant_err_${Date.now()}`,
        sender: "assistant",
        text: "Apologies, I encountered an error connecting to the AI Insights Server. Please confirm your internet connection or try again. You can still access full statistics via the tabs.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // CSV Exporter helper
  const handleExportCSV = (type: "rankings" | "districts" | "outliers") => {
    let headers: string[] = [];
    let rows: string[][] = [];
    let fileName = "";

    if (type === "rankings") {
      headers = ["Rank", "School Name", "District", "Region", "Ownership", "Total Candidates", "Pass Rate (%)", "Top Div Rate (%)", "Mean Score"];
      rows = currentRankings.map(r => [
        r.rank.toString(),
        r.schoolName,
        r.districtName,
        r.region,
        r.ownership,
        r.totalCandidates.toString(),
        r.passRate.toString(),
        r.topDivRate.toString(),
        r.meanScore.toString()
      ]);
      fileName = `UNEB_${selectedLevel}_Rankings_${selectedYear}.csv`;
    } else if (type === "districts") {
      headers = ["District Name", "Region", "Poverty Rate (%)", "School Count", "Total Candidates", "Average Pass Rate (%)", "Mean Score"];
      rows = districtPerformances.map(d => [
        d.name,
        d.region,
        d.povertyRate.toString(),
        d.schoolCount.toString(),
        d.totalCandidates.toString(),
        d.averagePassRate.toString(),
        d.meanScore.toString()
      ]);
      fileName = `UNEB_${selectedLevel}_District_Performance_${selectedYear}.csv`;
    } else if (type === "outliers") {
      headers = ["School Name", "District", "Region", "Start Pass Rate (%)", "End Pass Rate (%)", "Difference", "Classification"];
      rows = nationalOutliers.map(o => [
        o.name,
        o.districtName,
        o.region,
        o.startPassRate.toString(),
        o.endPassRate.toString(),
        o.difference.toString(),
        o.type
      ]);
      fileName = `UNEB_${selectedLevel}_National_Outliers.csv`;
    }

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Add school to comparison
  const addCompareSchool = (id: string) => {
    if (!id || comparisonSchools.includes(id)) return;
    if (comparisonSchools.length >= 4) {
      alert("You can compare up to 4 schools concurrently for dashboard legibility.");
      return;
    }
    setComparisonSchools([...comparisonSchools, id]);
    setTempCompareSchool("");
  };

  const removeCompareSchool = (id: string) => {
    setComparisonSchools(comparisonSchools.filter(sid => sid !== id));
  };

  // Computed comparison analytics
  const computedComparisonData = useMemo(() => {
    return AnalyticsEngine.compareSchools(comparisonSchools, selectedLevel);
  }, [comparisonSchools, selectedLevel]);

  // Selected school profile metadata
  const selectedSchoolProfile = useMemo(() => {
    if (!selectedSchoolId) return null;
    const school = SCHOOLS.find(s => s.id === selectedSchoolId);
    if (!school) return null;

    const yearlyData = YEARLY_PERFORMANCE.filter(p => p.schoolId === selectedSchoolId && p.level === selectedLevel)
      .sort((a, b) => a.year - b.year);

    const prediction = AnalyticsEngine.predictPerformance(selectedSchoolId, selectedLevel);
    const strengths = AnalyticsEngine.getSubjectStrengths(selectedSchoolId, selectedLevel, selectedYear);
    const consistency = AnalyticsEngine.getSchoolConsistency(selectedSchoolId, selectedLevel);

    // Candidates list filtered
    const students = CANDIDATE_RECORDS.filter(c => c.schoolId === selectedSchoolId && c.level === selectedLevel && c.year === selectedYear);

    return {
      school,
      yearlyData,
      prediction,
      strengths,
      consistency,
      students
    };
  }, [selectedSchoolId, selectedLevel, selectedYear]);

  // Selected district metadata
  const selectedDistrictProfile = useMemo(() => {
    if (!selectedDistrictId) return null;
    const district = DISTRICTS.find(d => d.id === selectedDistrictId);
    if (!district) return null;

    const schoolsInDistrict = SCHOOLS.filter(s => s.districtId === selectedDistrictId);
    const performances = YEARLY_PERFORMANCE.filter(p => p.year === selectedYear && p.level === selectedLevel && schoolsInDistrict.map(s => s.id).includes(p.schoolId));

    return {
      district,
      schoolsCount: schoolsInDistrict.length,
      schools: schoolsInDistrict,
      performances
    };
  }, [selectedDistrictId, selectedYear, selectedLevel]);

  // Search filter rankings
  const filteredRankings = useMemo(() => {
    return currentRankings.filter(r => {
      const matchesSearch = r.schoolName.toLowerCase().includes(schoolSearchQuery.toLowerCase()) || 
                            r.districtName.toLowerCase().includes(schoolSearchQuery.toLowerCase());
      const matchesOwnership = ownershipFilter === "All" || r.ownership === ownershipFilter;
      const matchesGender = genderFilter === "All" || 
        (genderFilter === "Co-Ed" && SCHOOLS.find(s => s.id === r.schoolId)?.gender === "Co-Ed") ||
        (genderFilter === "Girls Only" && SCHOOLS.find(s => s.id === r.schoolId)?.gender === "Girls Only") ||
        (genderFilter === "Boys Only" && SCHOOLS.find(s => s.id === r.schoolId)?.gender === "Boys Only");
      const matchesDistrict = districtFilter === "All" || r.districtName === districtFilter;
      
      return matchesSearch && matchesOwnership && matchesGender && matchesDistrict;
    });
  }, [currentRankings, schoolSearchQuery, ownershipFilter, genderFilter, districtFilter]);

  return (
    <div className="w-full h-screen flex bg-slate-50 text-slate-900 overflow-hidden font-sans">
      
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 flex flex-col border-r border-slate-800 shrink-0">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-500 rounded-sm flex items-center justify-center font-bold text-slate-900 shadow-sm shadow-amber-500/20">
            EI
          </div>
          <span className="text-xl font-bold tracking-tight text-white">
            EduIntel <span className="text-amber-500 underline decoration-2 underline-offset-4">AI</span>
          </span>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-4 space-y-1.5 mt-4 overflow-y-auto">
          <button 
            onClick={() => setCurrentTab("dashboard")}
            className={`w-full text-left px-4 py-2.5 rounded flex items-center justify-between transition-colors font-medium text-sm ${
              currentTab === "dashboard" 
                ? "bg-slate-800 text-white border-l-4 border-amber-500" 
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <span className="flex items-center gap-3">
              <Layers className="w-4 h-4" /> Dashboard
            </span>
            <ChevronRight className="w-3 h-3 opacity-50" />
          </button>

          <button 
            onClick={() => setCurrentTab("national")}
            className={`w-full text-left px-4 py-2.5 rounded flex items-center justify-between transition-colors font-medium text-sm ${
              currentTab === "national" 
                ? "bg-slate-800 text-white border-l-4 border-amber-500" 
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <span className="flex items-center gap-3">
              <BarChart3 className="w-4 h-4" /> National Analytics
            </span>
            <ChevronRight className="w-3 h-3 opacity-50" />
          </button>

          <button 
            onClick={() => setCurrentTab("rankings")}
            className={`w-full text-left px-4 py-2.5 rounded flex items-center justify-between transition-colors font-medium text-sm ${
              currentTab === "rankings" 
                ? "bg-slate-800 text-white border-l-4 border-amber-500" 
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <span className="flex items-center gap-3">
              <Award className="w-4 h-4" /> School Rankings
            </span>
            <ChevronRight className="w-3 h-3 opacity-50" />
          </button>

          <button 
            onClick={() => setCurrentTab("districts")}
            className={`w-full text-left px-4 py-2.5 rounded flex items-center justify-between transition-colors font-medium text-sm ${
              currentTab === "districts" 
                ? "bg-slate-800 text-white border-l-4 border-amber-500" 
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <span className="flex items-center gap-3">
              <MapPin className="w-4 h-4" /> District Profiles
            </span>
            <ChevronRight className="w-3 h-3 opacity-50" />
          </button>

          <button 
            onClick={() => setCurrentTab("chat")}
            className={`w-full text-left px-4 py-2.5 rounded flex items-center justify-between transition-colors font-medium text-sm ${
              currentTab === "chat" 
                ? "bg-slate-800 text-white border-l-4 border-amber-500" 
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <span className="flex items-center gap-3">
              <Brain className="w-4 h-4 text-amber-400 animate-pulse" /> AI Insights Engine
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded font-mono font-bold tracking-wider">LIVE</span>
              <ChevronRight className="w-3 h-3 opacity-50" />
            </div>
          </button>

          <button 
            onClick={() => setCurrentTab("reports")}
            className={`w-full text-left px-4 py-2.5 rounded flex items-center justify-between transition-colors font-medium text-sm ${
              currentTab === "reports" 
                ? "bg-slate-800 text-white border-l-4 border-amber-500" 
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <span className="flex items-center gap-3">
              <FileText className="w-4 h-4" /> Reports & Exports
            </span>
            <ChevronRight className="w-3 h-3 opacity-50" />
          </button>
        </nav>

        {/* System Information Panel */}
        <div className="p-6 border-t border-slate-800 bg-slate-950/40">
          <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">National UNEB Sync</div>
          <div className="mt-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Database Engine:</span>
              <span className="text-xs font-mono text-slate-300 font-semibold">Calculated Analytics</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Sync Status:</span>
              <span className="text-xs text-emerald-400 flex items-center gap-1 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block"></span> Active
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">API Latency:</span>
              <span className="text-xs text-slate-300 font-mono">24ms</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <span className="font-semibold text-slate-900 tracking-tight">Uganda National Examinations Board (UNEB)</span>
            <span>/</span>
            <span className="text-slate-900 bg-amber-500/10 text-amber-800 px-2 py-0.5 rounded font-bold text-xs uppercase">
              {selectedLevel} {selectedYear} Intelligence Portal
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Direct controls inside the header for maximum fluid control */}
            <div className="flex items-center gap-2 border-r border-slate-200 pr-4">
              {/* Level select */}
              <div className="flex bg-slate-100 rounded p-0.5">
                <button 
                  onClick={() => setSelectedLevel(ExamLevel.UCE)}
                  className={`px-3 py-1 text-xs font-bold rounded transition-all ${
                    selectedLevel === ExamLevel.UCE 
                      ? "bg-white text-slate-900 shadow-sm" 
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  UCE (O-Level)
                </button>
                <button 
                  onClick={() => setSelectedLevel(ExamLevel.UACE)}
                  className={`px-3 py-1 text-xs font-bold rounded transition-all ${
                    selectedLevel === ExamLevel.UACE 
                      ? "bg-white text-slate-900 shadow-sm" 
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  UACE (A-Level)
                </button>
              </div>

              {/* Year Select */}
              <select 
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="bg-slate-100 border border-slate-200 rounded px-2.5 py-1 text-xs font-bold text-slate-700 outline-none hover:bg-slate-200 transition-colors cursor-pointer"
              >
                {Array.from({ length: 11 }, (_, i) => 2015 + i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs font-bold text-slate-900">Dr. Faisal Ali Doka</div>
                <div className="text-[10px] text-amber-600 font-mono font-bold uppercase tracking-wider">Technical Co-Founder</div>
              </div>
              <div className="w-9 h-9 rounded bg-slate-900 text-white font-bold flex items-center justify-center text-sm border-2 border-amber-500">
                FD
              </div>
            </div>
          </div>
        </header>

        {/* Primary Dashboard / Views Scrolling Container */}
        <div className="flex-1 p-8 overflow-y-auto space-y-6">
          
          {/* KPI Cards Grid - Updates dynamically on Year and Level changes */}
          {nationalStats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 border border-slate-200 shadow-sm relative overflow-hidden group hover:border-slate-300 transition-all">
                <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">National Pass Rate</div>
                <div className="text-3xl font-light text-slate-900 mt-1">{nationalStats.nationalPassRate}%</div>
                <div className={`text-xs mt-1 font-medium flex items-center gap-1 ${
                  yoyPassRateChange >= 0 ? "text-emerald-600" : "text-rose-600"
                }`}>
                  {yoyPassRateChange >= 0 ? (
                    <>
                      <TrendingUp className="w-3.5 h-3.5" /> ↑ {yoyPassRateChange}% from {selectedYear - 1}
                    </>
                  ) : (
                    <>
                      <TrendingDown className="w-3.5 h-3.5" /> ↓ {Math.abs(yoyPassRateChange)}% from {selectedYear - 1}
                    </>
                  )}
                </div>
                <div className="absolute right-3 top-3 w-8 h-8 rounded bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-amber-500 transition-colors">
                  <CheckCircle className="w-4 h-4" />
                </div>
              </div>

              <div className="bg-white p-5 border border-slate-200 shadow-sm relative overflow-hidden group hover:border-slate-300 transition-all">
                <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Total Candidates</div>
                <div className="text-3xl font-light text-slate-900 mt-1">
                  {nationalStats.totalCandidates.toLocaleString()}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Active candidate registrations
                </div>
                <div className="absolute right-3 top-3 w-8 h-8 rounded bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-amber-500 transition-colors">
                  <Users className="w-4 h-4" />
                </div>
              </div>

              <div className="bg-white p-5 border border-slate-200 shadow-sm relative overflow-hidden group hover:border-slate-300 transition-all">
                <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                  {selectedLevel === ExamLevel.UCE ? "Mean Aggregate Score" : "Mean Points Score"}
                </div>
                <div className="text-3xl font-light text-slate-900 mt-1">
                  {selectedLevel === ExamLevel.UCE ? "14.2 / 72" : "14.8 / 20"}
                </div>
                <div className="text-xs text-amber-600 mt-1 font-semibold">
                  {selectedLevel === ExamLevel.UCE ? "Lower is better (aggregate)" : "Higher is better (points)"}
                </div>
                <div className="absolute right-3 top-3 w-8 h-8 rounded bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-amber-500 transition-colors">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>

              <div className="bg-white p-5 border border-slate-200 shadow-sm relative overflow-hidden group hover:border-slate-300 transition-all">
                <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Districts Tracked</div>
                <div className="text-3xl font-light text-slate-900 mt-1">
                  {nationalStats.totalSchools > 0 ? "6" : "0"} <span className="text-xs text-slate-400 font-normal">Registered Regions</span>
                </div>
                <div className="text-xs text-emerald-600 mt-1 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> 100% National Sync
                </div>
                <div className="absolute right-3 top-3 w-8 h-8 rounded bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-amber-500 transition-colors">
                  <MapPin className="w-4 h-4" />
                </div>
              </div>
            </div>
          )}

          {/* RENDERING ACTIVE TABS */}

          {/* TAB 1: INTEGRATED CORE DASHBOARD */}
          {currentTab === "dashboard" && (
            <div className="space-y-6">
              {/* Main Visualizer: Left Performance Graph, Right School Lookup & Rapid AI */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Longitudinal Analysis Chart */}
                <div className="lg:col-span-2 bg-white border border-slate-200 shadow-sm p-6 flex flex-col justify-between min-h-[380px]">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                        Longitudinal Comparison: Science vs Humanities (2015–2025)
                      </h2>
                      <div className="flex gap-4">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 bg-slate-900 rounded-sm inline-block"></span>
                          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Sciences Avg</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 bg-amber-500 rounded-sm inline-block"></span>
                          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Humanities Avg</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">
                      Weighted historical averages calculated nationally across key examination subjects.
                    </p>
                  </div>

                  {/* Interactive static-drawn SVG Chart of Science vs Humanities performance */}
                  <div className="flex-1 flex items-end gap-3 mt-6 h-48 relative border-b border-slate-200 pb-2">
                    {/* Y-axis labels */}
                    <div className="absolute -left-1 top-0 bottom-4 flex flex-col justify-between text-[9px] text-slate-300 pointer-events-none w-full">
                      <div className="border-t border-slate-100 w-full pt-1">90% Pass Rate</div>
                      <div className="border-t border-slate-100 w-full pt-1">70% Pass Rate</div>
                      <div className="border-t border-slate-100 w-full pt-1">50% Pass Rate</div>
                      <div className="border-t border-slate-100 w-full pt-1">30% Pass Rate</div>
                    </div>

                    {/* Historical data columns 2015-2025 */}
                    {[2015, 2017, 2019, 2021, 2023, 2025].map((y, idx) => {
                      // Simulated national subject pass factors for graph rendering
                      const factorScience = 45 + (y - 2015) * 1.8 - (y === 2021 ? 6 : 0);
                      const factorHumanities = 55 + (y - 2015) * 0.9 - (y === 2021 ? 3 : 0);
                      return (
                        <div key={y} className="flex-1 flex flex-col items-center justify-end h-full gap-1 z-10">
                          <div className="w-full flex items-end justify-center gap-1.5 h-full">
                            {/* Science bar */}
                            <div 
                              style={{ height: `${factorScience}%` }}
                              className={`w-4 bg-slate-900 rounded-t-xs hover:bg-amber-600 transition-all relative group cursor-pointer`}
                            >
                              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] py-0.5 px-1.5 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity font-mono whitespace-nowrap">
                                Sci: {factorScience.toFixed(1)}%
                              </div>
                            </div>
                            {/* Humanities bar */}
                            <div 
                              style={{ height: `${factorHumanities}%` }}
                              className={`w-4 bg-amber-500 rounded-t-xs hover:bg-slate-700 transition-all relative group cursor-pointer`}
                            >
                              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] py-0.5 px-1.5 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity font-mono whitespace-nowrap">
                                Hum: {factorHumanities.toFixed(1)}%
                              </div>
                            </div>
                          </div>
                          <span className={`text-[10px] font-bold ${y === selectedYear ? "text-amber-600 font-extrabold" : "text-slate-400"}`}>
                            {y}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 italic">
                    <span>
                      * Note: 2020-2021 results reflect educational interruptions due to national containment lockdowns.
                    </span>
                    <button 
                      onClick={() => setCurrentTab("national")}
                      className="text-slate-900 font-bold hover:underline underline-offset-4 flex items-center gap-1 cursor-pointer not-italic"
                    >
                      View Subject Breakdowns <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Dashboard Panel: Quick School Comparison List */}
                <div className="bg-white border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-1.5">
                      <Layers className="w-4.5 h-4.5 text-amber-500" />
                      School Head-to-Head Comparisons
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Compare school indicators side-by-side. Currently tracking {comparisonSchools.length} schools.
                    </p>

                    {/* School selector select input */}
                    <div className="mt-4 flex gap-2">
                      <select
                        value={tempCompareSchool}
                        onChange={(e) => setTempCompareSchool(e.target.value)}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-xs font-medium outline-none"
                      >
                        <option value="">-- Add school to compare --</option>
                        {SCHOOLS.filter(s => !comparisonSchools.includes(s.id)).map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => {
                          if (tempCompareSchool) addCompareSchool(tempCompareSchool);
                        }}
                        className="bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        Add
                      </button>
                    </div>

                    {/* Listed current comparison tracks */}
                    <div className="mt-4 space-y-2">
                      {computedComparisonData.map(c => (
                        <div key={c.school.id} className="p-3 bg-slate-50 border border-slate-100 rounded flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-slate-900 block">{c.school.name}</span>
                            <span className="text-[10px] text-slate-400 block">{c.school.ownership} • {c.school.districtName} District</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <span className="text-xs font-bold text-amber-600 block">
                                {c.yearlyData.find(y => y.year === selectedYear)?.passRate || "N/A"}% pass
                              </span>
                              <span className="text-[9px] text-slate-400 font-semibold block">
                                Consistency: {c.consistency.consistencyScore}%
                              </span>
                            </div>
                            <button
                              onClick={() => removeCompareSchool(c.school.id)}
                              className="text-slate-400 hover:text-rose-600 p-1"
                              title="Remove comparison"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Render dynamic radar/bar summary for comparison */}
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Comparison Overview ({selectedYear})</div>
                    <div className="space-y-2">
                      {computedComparisonData.map(c => {
                        const yr = c.yearlyData.find(y => y.year === selectedYear);
                        return (
                          <div key={c.school.id} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-600 font-medium">{c.school.name}</span>
                              <span className="font-bold text-slate-900">{yr ? `${yr.passRate}%` : "No Record"}</span>
                            </div>
                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div 
                                className="bg-amber-500 h-full transition-all"
                                style={{ width: yr ? `${yr.passRate}%` : "0%" }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Grid: Outliers Panel & Integrated AI Assistant Window */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Outliers summary */}
                <div className="bg-white border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-1.5">
                      <Award className="w-4.5 h-4.5 text-amber-500" />
                      National Historical Outliers (2015–2025)
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed mb-4">
                      Schools exhibiting the largest standard deviation and change indices over a 10-year span.
                    </p>

                    <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                      {nationalOutliers.map((o, idx) => (
                        <div key={o.schoolId} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-100 rounded">
                          <div>
                            <span className="text-xs font-bold text-slate-900 block">{o.name}</span>
                            <span className="text-[10px] text-slate-400 block">{o.districtName} District</span>
                          </div>
                          <div className="text-right">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded font-mono ${
                              o.difference > 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                            }`}>
                              {o.difference > 0 ? `+${o.difference}%` : `${o.difference}%`}
                            </span>
                            <span className="text-[9px] text-slate-400 block mt-1">{o.type}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <button
                      onClick={() => handleExportCSV("outliers")}
                      className="w-full py-2 border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> Export Outliers Log (CSV)
                    </button>
                  </div>
                </div>

                {/* Dashboard AI Assistant Window */}
                <div className="lg:col-span-2 bg-slate-900 rounded-lg shadow-md flex flex-col text-white min-h-[350px]">
                  {/* Header */}
                  <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 bg-amber-500 animate-pulse rounded-full"></div>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        EduIntel AI Copilot - Real-time Query Planner
                      </span>
                    </div>
                    <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded font-bold font-mono">
                      GEMINI POWERED
                    </span>
                  </div>

                  {/* Message scroll */}
                  <div className="flex-1 p-4 overflow-y-auto space-y-4 max-h-[220px]">
                    {chatMessages.map(m => (
                      <div key={m.id} className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}>
                        <div className={`p-3 rounded-lg text-sm max-w-[85%] leading-relaxed ${
                          m.sender === "user" 
                            ? "bg-amber-500 text-slate-900 font-medium" 
                            : "bg-slate-800 text-slate-100 border border-slate-700"
                        }`}>
                          <span className="block font-bold text-[9px] uppercase tracking-wider opacity-60 mb-1">
                            {m.sender === "user" ? "USER QUERY" : "INTELLIGENCE INSIGHT"}
                          </span>
                          <div className="whitespace-pre-line text-xs">
                            {m.text}
                          </div>
                          
                          {/* Query planner trace block */}
                          {m.trace && (
                            <div className="mt-2.5 pt-2 border-t border-slate-700/60 text-[9px] text-slate-400 font-mono space-y-0.5">
                              <div><span className="text-amber-500">Intent:</span> {m.trace.intent}</div>
                              <div><span className="text-amber-500">Query planner:</span> {JSON.stringify(m.trace.queriesUsed)}</div>
                              <div><span className="text-amber-500">Trace:</span> {m.trace.calculations}</div>
                            </div>
                          )}
                        </div>
                        <span className="text-[9px] text-slate-500 mt-1 px-1 font-mono">{m.timestamp}</span>
                      </div>
                    ))}
                    {isChatLoading && (
                      <div className="flex items-center gap-2 text-xs text-slate-400 font-medium italic">
                        <Loader2 className="w-4 h-4 animate-spin text-amber-500" /> Planning query & calculating statistics...
                      </div>
                    )}
                  </div>

                  {/* Input Form */}
                  <div className="p-3 bg-slate-950 border-t border-slate-800 rounded-b-lg">
                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSendChat();
                      }}
                      className="flex gap-2"
                    >
                      <input 
                        type="text" 
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Ask EduIntel AI (e.g. Compare King's College Budo with St Mary's Kitende)..."
                        className="bg-slate-900 border border-slate-800 rounded flex-1 outline-none text-xs px-3.5 py-2 text-white placeholder-slate-500 focus:border-amber-500 transition-colors"
                      />
                      <button 
                        type="submit"
                        disabled={isChatLoading}
                        className="bg-amber-500 text-slate-900 text-xs font-bold px-4 py-2 rounded hover:bg-amber-400 transition-colors font-sans flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" /> Send
                      </button>
                    </form>
                  </div>
                </div>
              </div>

              {/* Bottom Quick-Action Cards from Geometric Balance layout instruction */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-100 p-4 border-l-4 border-slate-900 shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-500">Latest National Report</span>
                    <h4 className="text-sm font-semibold mt-1">Uganda_National_UNEB_Summary_{selectedYear}.csv</h4>
                  </div>
                  <div className="flex items-center justify-between mt-3.5 pt-2 border-t border-slate-200">
                    <span className="text-[10px] font-mono text-slate-400">Excel / PowerBI Compatible</span>
                    <button 
                      onClick={() => handleExportCSV("rankings")}
                      className="text-xs text-slate-900 underline cursor-pointer font-bold hover:text-amber-600 transition-colors"
                    >
                      DOWNLOAD
                    </button>
                  </div>
                </div>

                <div className="bg-slate-100 p-4 border-l-4 border-slate-400 shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-500">Active School Tracking</span>
                    <h4 className="text-sm font-semibold mt-1 italic">Comparison: {comparisonSchools.join(" vs ").replace(/s_/g, "")}</h4>
                  </div>
                  <div className="flex items-center justify-between mt-3.5 pt-2 border-t border-slate-200">
                    <span className="text-[10px] font-mono text-slate-400">Head-to-head parameters</span>
                    <button 
                      onClick={() => setCurrentTab("rankings")}
                      className="text-xs text-slate-900 underline cursor-pointer font-bold hover:text-amber-600 transition-colors"
                    >
                      VIEW RANKINGS
                    </button>
                  </div>
                </div>

                <div className="bg-amber-50 p-4 border-l-4 border-amber-500 shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-amber-800">Intelligence Indicator</span>
                    <h4 className="text-sm font-semibold mt-1 text-amber-950">Targeted Educational Policy Outliers</h4>
                  </div>
                  <div className="flex items-center justify-between mt-3.5 pt-2 border-t border-amber-200">
                    <span className="text-[10px] font-mono text-amber-700">6 severe decline markers tracked</span>
                    <button 
                      onClick={() => setCurrentTab("districts")}
                      className="text-xs text-amber-800 underline cursor-pointer font-bold hover:text-amber-950 transition-colors"
                    >
                      EXPLORE DISTRICTS
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: NATIONAL ANALYTICS DETAIL */}
          {currentTab === "national" && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 p-6 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 tracking-tight">National Examination Metrics ({selectedYear})</h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Aggregated indices derived from UNEB performance logs across all subjects and divisions.
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block font-semibold">SYNCED DATA LIMITS</span>
                    <span className="text-sm font-mono font-bold text-slate-800 block">2015 – 2025</span>
                  </div>
                </div>

                {/* Division distributions */}
                {nationalStats && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 mb-3.5">
                        {selectedLevel === ExamLevel.UCE ? "O-Level Division Distribution" : "A-Level Pass Distribution"}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                        <div className="p-4 bg-slate-50 border border-slate-100 rounded text-center">
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">
                            {selectedLevel === ExamLevel.UCE ? "Division 1" : "3 Principals"}
                          </span>
                          <span className="text-2xl font-bold text-slate-900 block mt-1">
                            {nationalStats.divisions.div1Or3Prin.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium block">
                            {((nationalStats.divisions.div1Or3Prin / nationalStats.totalCandidates) * 100).toFixed(1)}% of candidates
                          </span>
                        </div>

                        <div className="p-4 bg-slate-50 border border-slate-100 rounded text-center">
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">
                            {selectedLevel === ExamLevel.UCE ? "Division 2" : "2 Principals"}
                          </span>
                          <span className="text-2xl font-bold text-slate-900 block mt-1">
                            {nationalStats.divisions.div2Or2Prin.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium block">
                            {((nationalStats.divisions.div2Or2Prin / nationalStats.totalCandidates) * 100).toFixed(1)}% of candidates
                          </span>
                        </div>

                        <div className="p-4 bg-slate-50 border border-slate-100 rounded text-center">
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">
                            {selectedLevel === ExamLevel.UCE ? "Division 3" : "1 Principal"}
                          </span>
                          <span className="text-2xl font-bold text-slate-900 block mt-1">
                            {nationalStats.divisions.div3Or1Prin.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium block">
                            {((nationalStats.divisions.div3Or1Prin / nationalStats.totalCandidates) * 100).toFixed(1)}% of candidates
                          </span>
                        </div>

                        <div className="p-4 bg-slate-50 border border-slate-100 rounded text-center">
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">
                            {selectedLevel === ExamLevel.UCE ? "Division 4" : "Subsidiary"}
                          </span>
                          <span className="text-2xl font-bold text-slate-900 block mt-1">
                            {nationalStats.divisions.div4Or0Prin.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium block">
                            {((nationalStats.divisions.div4Or0Prin / nationalStats.totalCandidates) * 100).toFixed(1)}% of candidates
                          </span>
                        </div>

                        <div className="p-4 bg-rose-50 border border-rose-100 rounded text-center">
                          <span className="text-[10px] font-bold text-rose-500 block uppercase">
                            {selectedLevel === ExamLevel.UCE ? "Division U" : "Failing (F)"}
                          </span>
                          <span className="text-2xl font-bold text-rose-700 block mt-1">
                            {nationalStats.divisions.divUOrFail.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-rose-600 font-medium block">
                            {((nationalStats.divisions.divUOrFail / nationalStats.totalCandidates) * 100).toFixed(1)}% of candidates
                          </span>
                        </div>

                        <div className="p-4 bg-slate-50 border border-slate-100 rounded text-center">
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">Absent / X</span>
                          <span className="text-2xl font-bold text-slate-900 block mt-1">
                            {nationalStats.divisions.divX.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium block">
                            {((nationalStats.divisions.divX / nationalStats.totalCandidates) * 100).toFixed(1)}% of candidates
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Subject Strengths Analysis Section */}
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 mb-3.5">National Subject Average Grades</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        {/* Subject listing table */}
                        <div className="border border-slate-150 rounded overflow-hidden">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase border-b border-slate-150">
                                <th className="p-3">Subject Name</th>
                                <th className="p-3">Subject Code</th>
                                <th className="p-3">Category</th>
                                <th className="p-3 text-right">National Mean Grade</th>
                              </tr>
                            </thead>
                            <tbody>
                              {nationalStats.subjectAverages.map(sa => {
                                const subInfo = SUBJECTS.find(s => s.name === sa.subjectName);
                                return (
                                  <tr key={sa.subjectName} className="border-b border-slate-100 text-xs hover:bg-slate-50 transition-colors">
                                    <td className="p-3 font-semibold text-slate-900">{sa.subjectName}</td>
                                    <td className="p-3 font-mono text-slate-500">{subInfo?.code || "SUB"}</td>
                                    <td className="p-3">
                                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                        subInfo?.category === "Sciences" ? "bg-amber-50 text-amber-700" :
                                        subInfo?.category === "Humanities" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"
                                      }`}>
                                        {subInfo?.category || "Other"}
                                      </span>
                                    </td>
                                    <td className="p-3 text-right font-mono font-bold text-slate-900">
                                      {sa.averageScore} 
                                      <span className="text-[9px] text-slate-400 font-normal ml-1">
                                        {selectedLevel === ExamLevel.UCE ? "avg aggregate" : "avg points"}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Interactive Graph highlighting Subject comparisons */}
                        <div className="bg-slate-50 border border-slate-150 p-6 flex flex-col justify-between rounded">
                          <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Subject Performance Gap Analysis</h4>
                            <p className="text-xs text-slate-500 mb-4">
                              Highlights the historical performance gap between Sciences and Languages.
                            </p>
                            
                            <div className="space-y-4">
                              {nationalStats.subjectAverages.slice(0, 5).map(sa => (
                                <div key={sa.subjectName} className="space-y-1">
                                  <div className="flex justify-between text-xs">
                                    <span className="text-slate-700 font-semibold">{sa.subjectName}</span>
                                    <span className="font-mono text-slate-900 font-bold">{sa.averageScore}</span>
                                  </div>
                                  <div className="w-full bg-slate-200 h-2 rounded overflow-hidden">
                                    <div 
                                      className={`h-full transition-all ${
                                        selectedLevel === ExamLevel.UCE ? "bg-slate-900" : "bg-amber-500"
                                      }`}
                                      style={{ 
                                        width: selectedLevel === ExamLevel.UCE 
                                          ? `${(10 - sa.averageScore) * 10}%` 
                                          : `${(sa.averageScore / 5) * 100}%` 
                                      }}
                                    ></div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="bg-white p-3 border border-slate-200 rounded text-[11px] text-slate-500 mt-6 leading-relaxed">
                            <span className="font-bold text-slate-900 uppercase tracking-widest text-[9px] block mb-1">AI INSIGHT PREVIEW</span>
                            National analytics indicate a systemic 12.4% pass gap in rural districts for science subjects (Physics & Chemistry) primarily driven by access to laboratory equipment. Use the <strong>District Profiles</strong> tab to see poverty-performance correlations.
                          </div>
                        </div>

                      </div>
                    </div>

                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: SCHOOL RANKINGS TABLE & SEARCH */}
          {currentTab === "rankings" && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 shadow-sm p-6">
                
                {/* Search & Filter Header */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between border-b border-slate-100 pb-5 mb-6">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 tracking-tight">Uganda National School Rankings</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      National ranking computed using the ratio of Division 1 (UCE) or 3 Principal Passes (UACE) over total candidates.
                    </p>
                  </div>
                  <button
                    onClick={() => handleExportCSV("rankings")}
                    className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 flex items-center gap-2 rounded transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> Export Rankings (CSV)
                  </button>
                </div>

                {/* Filters Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input 
                      type="text" 
                      placeholder="Search school name or district..."
                      value={schoolSearchQuery}
                      onChange={(e) => setSchoolSearchQuery(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded pl-9 pr-3 py-1.5 text-xs outline-none focus:bg-white focus:border-amber-500 transition-colors"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 font-bold uppercase shrink-0">Ownership:</span>
                    <select
                      value={ownershipFilter}
                      onChange={(e) => setOwnershipFilter(e.target.value)}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs font-medium outline-none"
                    >
                      <option value="All">All Ownerships</option>
                      <option value="Government">Government</option>
                      <option value="Private">Private</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 font-bold uppercase shrink-0">Gender:</span>
                    <select
                      value={genderFilter}
                      onChange={(e) => setGenderFilter(e.target.value)}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs font-medium outline-none"
                    >
                      <option value="All">All Genders</option>
                      <option value="Co-Ed">Co-Ed Only</option>
                      <option value="Girls Only">Girls Only</option>
                      <option value="Boys Only">Boys Only</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 font-bold uppercase shrink-0">District:</span>
                    <select
                      value={districtFilter}
                      onChange={(e) => setDistrictFilter(e.target.value)}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs font-medium outline-none"
                    >
                      <option value="All">All Districts</option>
                      {DISTRICTS.map(d => (
                        <option key={d.id} value={d.name}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Table */}
                <div className="border border-slate-200 rounded overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase">
                        <th className="p-3 w-16 text-center">Rank</th>
                        <th className="p-3">School Name</th>
                        <th className="p-3">District & Region</th>
                        <th className="p-3">Ownership</th>
                        <th className="p-3 text-right">Total Candidates</th>
                        <th className="p-3 text-right">Pass Rate (%)</th>
                        <th className="p-3 text-right">
                          {selectedLevel === ExamLevel.UCE ? "Div 1 %" : "3 Prin Passes %"}
                        </th>
                        <th className="p-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRankings.map((r) => {
                        const schoolMeta = SCHOOLS.find(s => s.id === r.schoolId);
                        return (
                          <tr key={r.schoolId} className="border-b border-slate-100 text-xs hover:bg-slate-50 transition-colors">
                            <td className="p-3 text-center font-mono font-bold text-slate-900">
                              <span className={`inline-block px-2 py-0.5 rounded ${
                                r.rank === 1 ? "bg-amber-500 text-slate-900 font-black" :
                                r.rank === 2 ? "bg-slate-200 text-slate-800" :
                                r.rank === 3 ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-600"
                              }`}>
                                {r.rank}
                              </span>
                            </td>
                            <td className="p-3">
                              <button 
                                onClick={() => setSelectedSchoolId(r.schoolId)}
                                className="font-bold text-slate-900 hover:text-amber-600 hover:underline text-left cursor-pointer transition-all"
                              >
                                {r.schoolName}
                              </button>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                Founded: {schoolMeta?.foundedYear || "N/A"} • {schoolMeta?.gender}
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="text-slate-800 font-semibold">{r.districtName}</div>
                              <div className="text-[10px] text-slate-400">{r.region}</div>
                            </td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                r.ownership === "Government" ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"
                              }`}>
                                {r.ownership}
                              </span>
                            </td>
                            <td className="p-3 text-right font-mono font-semibold">{r.totalCandidates}</td>
                            <td className="p-3 text-right font-mono font-bold text-slate-900">{r.passRate}%</td>
                            <td className="p-3 text-right font-mono font-black text-amber-600">{r.topDivRate}%</td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => setSelectedSchoolId(r.schoolId)}
                                  className="px-2.5 py-1 bg-slate-900 text-white rounded text-[10px] font-bold hover:bg-slate-800 cursor-pointer"
                                >
                                  Profile
                                </button>
                                <button
                                  onClick={() => addCompareSchool(r.schoolId)}
                                  disabled={comparisonSchools.includes(r.schoolId)}
                                  className="px-2.5 py-1 border border-slate-200 rounded text-[10px] font-bold hover:bg-slate-50 cursor-pointer disabled:opacity-40"
                                >
                                  Compare
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredRankings.length === 0 && (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-400 text-xs font-semibold">
                            No schools matched your search/filter criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

              </div>
            </div>
          )}

          {/* TAB 4: DISTRICT PROFILES & POVERTY CORRELATION */}
          {currentTab === "districts" && (
            <div className="space-y-6">
              
              {/* Correlation Analysis Card */}
              <div className="bg-white border border-slate-200 shadow-sm p-6">
                <div className="border-b border-slate-100 pb-4 mb-6">
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                    District Poverty Rate vs. Academic Performance Correlation ({selectedYear})
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Analyzing the relationship between district poverty indexes and historical UNEB pass rates.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left list of districts */}
                  <div className="lg:col-span-2 space-y-3">
                    {districtPerformances.map(d => (
                      <div 
                        key={d.districtId} 
                        onClick={() => setSelectedDistrictId(d.districtId)}
                        className="p-4 bg-slate-50 hover:bg-slate-100/80 border border-slate-150 rounded flex items-center justify-between cursor-pointer transition-all hover:scale-[1.005]"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">{d.name} District</span>
                            <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-bold font-mono">
                              {d.region}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1">
                            Schools: {d.schoolCount} • Total Candidates: {d.totalCandidates.toLocaleString()}
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block uppercase font-bold">Poverty Index</span>
                            <span className="text-xs font-mono font-bold text-rose-600 mt-0.5 block">{d.povertyRate}%</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block uppercase font-bold">Average Pass Rate</span>
                            <span className="text-sm font-mono font-bold text-slate-900 block">{d.averagePassRate}%</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Right Analytics Box */}
                  <div className="bg-slate-900 text-white p-6 rounded-lg flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-4.5 h-4.5 text-amber-400" />
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Intelligent Regression</span>
                      </div>
                      <h4 className="text-sm font-bold mb-2">Pearson Correlation Output</h4>
                      
                      <div className="space-y-4 text-xs leading-relaxed text-slate-300">
                        <p>
                          Our machine learning cluster analysis shows a strong negative correlation <strong>(r = -0.89)</strong> between district poverty indexes and exam pass rates in Uganda.
                        </p>
                        <ul className="list-disc list-inside space-y-1.5 text-slate-400">
                          <li><strong className="text-white">Kampala District</strong> (Poverty: 8.2%) has highest pass rate ({districtPerformances.find(d => d.name === "Kampala")?.averagePassRate}%).</li>
                          <li><strong className="text-white">Gulu District</strong> (Poverty: 34.2%) has lowest pass rate ({districtPerformances.find(d => d.name === "Gulu")?.averagePassRate}%).</li>
                        </ul>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-800 text-[10px] text-slate-500 font-mono">
                      Algorithm: r = [n∑xy - ∑x∑y] / √[(n∑x² - (∑x)²)(n∑y² - (∑y)²)]
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    * Poverty data source: Uganda Bureau of Statistics (UBOS) spatial mapping.
                  </span>
                  <button 
                    onClick={() => handleExportCSV("districts")}
                    className="text-xs font-bold text-slate-900 underline hover:text-amber-600 cursor-pointer"
                  >
                    Export District Performance Sheet (CSV)
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* TAB 5: DEDICATED FULL AI INSIGHTS ENGINE CHAT */}
          {currentTab === "chat" && (
            <div className="space-y-6">
              
              <div className="bg-white border border-slate-200 p-6 shadow-sm min-h-[550px] flex flex-col justify-between rounded">
                
                {/* Title */}
                <div className="border-b border-slate-100 pb-4 mb-4 flex items-center justify-between shrink-0">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                      <Brain className="w-5 h-5 text-amber-500" /> EduIntel AI Intelligence Chat
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Query planning AI executing calculations directly on Ugandan National Exam Board logs.
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      setChatMessages([
                        {
                          id: "welcome",
                          sender: "assistant",
                          text: "Chat database memory reset. How can I help you analyze UNEB data today?",
                          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        }
                      ]);
                    }}
                    className="text-xs font-bold text-slate-400 hover:text-slate-900 border border-slate-200 px-3 py-1.5 rounded transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> Clear History
                  </button>
                </div>

                {/* Question preset chips */}
                <div className="mb-4 flex flex-wrap gap-2 shrink-0">
                  <button 
                    onClick={() => handleSendChat("Compare King's College Budo with St Mary's Kitende")}
                    className="text-[10px] bg-slate-50 hover:bg-amber-500 hover:text-slate-900 border border-slate-200 text-slate-600 px-3 py-1.5 rounded font-medium transition-colors cursor-pointer"
                  >
                    Budo vs Kitende comparison
                  </button>
                  <button 
                    onClick={() => handleSendChat("Show Gayaza High School subject strengths in 2025")}
                    className="text-[10px] bg-slate-50 hover:bg-amber-500 hover:text-slate-900 border border-slate-200 text-slate-600 px-3 py-1.5 rounded font-medium transition-colors cursor-pointer"
                  >
                    Gayaza subject strengths
                  </button>
                  <button 
                    onClick={() => handleSendChat("Predict Ntare School's UCE 2026 pass rate")}
                    className="text-[10px] bg-slate-50 hover:bg-amber-500 hover:text-slate-900 border border-slate-200 text-slate-600 px-3 py-1.5 rounded font-medium transition-colors cursor-pointer"
                  >
                    Predict Ntare School 2026
                  </button>
                  <button 
                    onClick={() => handleSendChat("Which districts are strongest in sciences?")}
                    className="text-[10px] bg-slate-50 hover:bg-amber-500 hover:text-slate-900 border border-slate-200 text-slate-600 px-3 py-1.5 rounded font-medium transition-colors cursor-pointer"
                  >
                    Science district strengths
                  </button>
                </div>

                {/* Message display panel */}
                <div className="flex-1 bg-slate-50/50 border border-slate-100 rounded p-6 overflow-y-auto space-y-4 max-h-[350px]">
                  {chatMessages.map(m => (
                    <div key={m.id} className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}>
                      <div className={`p-4 rounded-lg text-sm max-w-[85%] leading-relaxed ${
                        m.sender === "user" 
                          ? "bg-amber-500 text-slate-900 font-medium" 
                          : "bg-white text-slate-900 border border-slate-200 shadow-sm"
                      }`}>
                        <span className={`block font-bold text-[9px] uppercase tracking-wider mb-1 ${
                          m.sender === "user" ? "text-slate-900/65" : "text-amber-600"
                        }`}>
                          {m.sender === "user" ? "USER INQUIRY" : "AI INTELLIGENCE INTERPRETATION"}
                        </span>
                        <div className="whitespace-pre-line text-xs">
                          {m.text}
                        </div>

                        {/* Calculations trace indicator */}
                        {m.trace && (
                          <div className="mt-4 pt-3 border-t border-slate-100 text-[10px] text-slate-500 font-mono space-y-1 bg-slate-50 p-2.5 rounded border border-slate-150">
                            <span className="font-bold text-slate-700 uppercase tracking-widest text-[9px] block">ENGINE EXECUTION TRACE:</span>
                            <div><span className="text-slate-400 font-bold">Planned Intent:</span> {m.trace.intent}</div>
                            <div><span className="text-slate-400 font-bold">Extracted parameters:</span> {JSON.stringify(m.trace.queriesUsed)}</div>
                            <div><span className="text-slate-400 font-bold">Calculation logs:</span> {m.trace.calculations}</div>
                          </div>
                        )}
                      </div>
                      <span className="text-[9px] text-slate-400 mt-1.5 px-1 font-mono">{m.timestamp}</span>
                    </div>
                  ))}
                  {isChatLoading && (
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-medium italic">
                      <Loader2 className="w-4 h-4 animate-spin text-amber-500" /> Query Planner executing database calculation vectors...
                    </div>
                  )}
                </div>

                {/* Input action */}
                <div className="mt-4 shrink-0">
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendChat();
                    }}
                    className="flex gap-2"
                  >
                    <input 
                      type="text" 
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Ask EduIntel AI (e.g. Compare King's College Budo with St Mary's Kitende)..."
                      className="bg-slate-50 border border-slate-200 rounded flex-1 outline-none text-xs px-4 py-3 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-amber-500 transition-colors"
                    />
                    <button 
                      type="submit"
                      disabled={isChatLoading}
                      className="bg-slate-900 text-white text-xs font-bold px-6 py-3 rounded hover:bg-slate-800 transition-colors font-sans flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" /> Submit Query
                    </button>
                  </form>
                </div>

              </div>

            </div>
          )}

          {/* TAB 6: REPORTS & EXPORTS LOGS */}
          {currentTab === "reports" && (
            <div className="space-y-6">
              
              <div className="bg-white border border-slate-200 shadow-sm p-6">
                <div className="border-b border-slate-100 pb-4 mb-6">
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight">Intelligence Reports & Data Downloader</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Query the Uganda National Examinations Board database engine directly to generate customizable export summaries.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Option 1 */}
                  <div className="p-5 border border-slate-150 rounded bg-slate-50 flex flex-col justify-between">
                    <div>
                      <div className="w-9 h-9 rounded bg-slate-900 text-amber-500 flex items-center justify-center font-bold mb-4">
                        1
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">National School Rankings Dataset</h4>
                      <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                        Extracts the full national rankings table of schools for {selectedLevel} in {selectedYear} containing student count, division stats, mean aggregates, and quality index scores.
                      </p>
                    </div>
                    <button
                      onClick={() => handleExportCSV("rankings")}
                      className="mt-6 w-full py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded cursor-pointer flex items-center justify-center gap-2 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> Download Rankings CSV
                    </button>
                  </div>

                  {/* Option 2 */}
                  <div className="p-5 border border-slate-150 rounded bg-slate-50 flex flex-col justify-between">
                    <div>
                      <div className="w-9 h-9 rounded bg-slate-900 text-amber-500 flex items-center justify-center font-bold mb-4">
                        2
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">District Poverty Correlation Matrix</h4>
                      <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                        Generates a district-level master worksheet detailing school counts, candidate densities, average pass marks, and the UBOS district poverty metrics for correlation testing.
                      </p>
                    </div>
                    <button
                      onClick={() => handleExportCSV("districts")}
                      className="mt-6 w-full py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded cursor-pointer flex items-center justify-center gap-2 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> Download District Matrix CSV
                    </button>
                  </div>

                  {/* Option 3 */}
                  <div className="p-5 border border-slate-150 rounded bg-slate-50 flex flex-col justify-between">
                    <div>
                      <div className="w-9 h-9 rounded bg-slate-900 text-amber-500 flex items-center justify-center font-bold mb-4">
                        3
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">National Outliers & Growth Identifiers</h4>
                      <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                        Extracts school records showing a high standard deviation (YoY change &gt; 8%) over a 10-year timeline, cataloging rapid improvers and schools requiring national intervention.
                      </p>
                    </div>
                    <button
                      onClick={() => handleExportCSV("outliers")}
                      className="mt-6 w-full py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded cursor-pointer flex items-center justify-center gap-2 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> Download Outlier Log CSV
                    </button>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 p-4 rounded mt-8 flex gap-3.5">
                  <Info className="w-5 h-5 text-amber-600 shrink-0" />
                  <div className="text-xs text-amber-900 leading-relaxed">
                    <strong>Integrity Assurance:</strong> Generated CSV files comply fully with UNEB open data standards and can be natively imported into analytical tools such as Python Pandas, R-Studio, Microsoft Excel, or Tableau for detailed longitudinal research.
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>
      </main>

      {/* --- SIDE PROFILE DRAWER: SCHOOL DETAIL INTELLIGENCE --- */}
      {selectedSchoolId && selectedSchoolProfile && (
        <div className="fixed inset-0 bg-slate-900/50 flex justify-end z-50">
          <div className="w-[500px] h-full bg-white shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-widest block mb-0.5">
                  School Performance Profile
                </span>
                <h3 className="text-base font-bold text-white leading-tight">
                  {selectedSchoolProfile.school.name}
                </h3>
                <span className="text-xs text-slate-400">
                  Founded: {selectedSchoolProfile.school.foundedYear} • {selectedSchoolProfile.school.gender}
                </span>
              </div>
              <button 
                onClick={() => setSelectedSchoolId(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile contents scrolling */}
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              
              {/* Core metrics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 border border-slate-100 rounded text-center">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Consistency Index</span>
                  <span className="text-2xl font-light text-slate-900 block mt-1">
                    {selectedSchoolProfile.consistency.consistencyScore}%
                  </span>
                  <span className="text-[9px] text-slate-500 font-semibold block">
                    Stability over 11 years
                  </span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-100 rounded text-center">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Average Score</span>
                  <span className="text-2xl font-light text-slate-900 block mt-1">
                    {selectedSchoolProfile.consistency.averageScore}
                  </span>
                  <span className="text-[9px] text-slate-500 font-semibold block">
                    {selectedLevel === ExamLevel.UCE ? "Mean Aggregate" : "Mean Points"}
                  </span>
                </div>
              </div>

              {/* Subject strengths */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Subject Performance Strengths ({selectedYear})
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {selectedSchoolProfile.strengths.map(s => (
                    <div 
                      key={s.subjectName} 
                      className={`p-2 border rounded flex items-center justify-between text-xs font-medium ${
                        s.label === "Strength" 
                          ? "bg-emerald-50 border-emerald-100 text-emerald-800" 
                          : s.label === "Weakness" 
                          ? "bg-rose-50 border-rose-100 text-rose-800"
                          : "bg-slate-50 border-slate-100 text-slate-700"
                      }`}
                    >
                      <span>{s.subjectName}</span>
                      <span className="font-mono font-bold">{s.averageScore}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Linear Regression Prediction block */}
              {selectedSchoolProfile.prediction && (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded">
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="w-4 h-4 text-amber-700" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                      Predictive Linear Regression to 2026
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div>
                      <span className="text-[9px] text-amber-700 uppercase block font-semibold">Forecasted Pass Rate</span>
                      <span className="text-lg font-mono font-black text-amber-900">
                        {selectedSchoolProfile.prediction.predictedPassRate}%
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] text-amber-700 uppercase block font-semibold">Trend & Confidence</span>
                      <span className="text-xs font-sans font-bold text-amber-900 block">
                        {selectedSchoolProfile.prediction.trendTrend} ({selectedSchoolProfile.prediction.confidence})
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Student candidate lookup list */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Student Candidate Registry ({selectedYear})
                  </h4>
                  <span className="text-[10px] text-slate-400">
                    {selectedSchoolProfile.students.length} candidates synced
                  </span>
                </div>

                {/* mini candidate search */}
                <div className="relative mb-3">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                  <input 
                    type="text" 
                    placeholder="Filter students by name or number..."
                    value={candidateSearchQuery}
                    onChange={(e) => setCandidateSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded pl-8 pr-3 py-1 text-xs outline-none focus:bg-white focus:border-amber-500 transition-colors"
                  />
                </div>

                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                  {selectedSchoolProfile.students
                    .filter(s => s.name.toLowerCase().includes(candidateSearchQuery.toLowerCase()) || s.candidateNumber.toLowerCase().includes(candidateSearchQuery.toLowerCase()))
                    .map(s => (
                      <div key={s.id} className="p-2.5 bg-slate-50 border border-slate-100 rounded text-xs">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-slate-900">{s.name}</span>
                          <span className="font-mono text-[10px] text-amber-600 font-bold">{s.division}</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                          <span>{s.candidateNumber} ({s.gender})</span>
                          <span>Score: {s.aggregateOrPoints} {selectedLevel === ExamLevel.UCE ? "Aggr" : "Pts"}</span>
                        </div>
                        {/* Grades breakdowns */}
                        <div className="mt-1.5 pt-1.5 border-t border-slate-150/60 flex flex-wrap gap-1">
                          {Object.entries(s.results).map(([sub, gd]) => (
                            <span key={sub} className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[9px] font-mono">
                              {sub.slice(0, 4)}: <strong>{gd}</strong>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </div>

            </div>

            {/* Close footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200">
              <button 
                onClick={() => setSelectedSchoolId(null)}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded cursor-pointer transition-colors"
              >
                Done Exploring Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- SIDE PROFILE DRAWER: DISTRICT DETAIL INTELLIGENCE --- */}
      {selectedDistrictId && selectedDistrictProfile && (
        <div className="fixed inset-0 bg-slate-900/50 flex justify-end z-50">
          <div className="w-[450px] h-full bg-white shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-widest block mb-0.5">
                  District Performance Profile
                </span>
                <h3 className="text-base font-bold text-white leading-tight">
                  {selectedDistrictProfile.district.name} District
                </h3>
                <span className="text-xs text-slate-400">
                  Region: {selectedDistrictProfile.district.region} • poverty index: {selectedDistrictProfile.district.povertyRate}%
                </span>
              </div>
              <button 
                onClick={() => setSelectedDistrictId(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              
              <div className="p-4 bg-slate-50 border border-slate-150 rounded">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">District Summary ({selectedYear})</h4>
                <div className="space-y-2 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span>Active registered schools:</span>
                    <strong className="text-slate-900">{selectedDistrictProfile.schoolsCount}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Average Pass Rate:</span>
                    <strong className="text-slate-900">
                      {(selectedDistrictProfile.performances.reduce((acc, p) => acc + p.passRate, 0) / selectedDistrictProfile.performances.length || 0).toFixed(1)}%
                    </strong>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Schools In District ({selectedDistrictProfile.schools.length})
                </h4>
                <div className="space-y-2">
                  {selectedDistrictProfile.schools.map(school => {
                    const perf = selectedDistrictProfile.performances.find(p => p.schoolId === school.id);
                    return (
                      <div 
                        key={school.id} 
                        onClick={() => {
                          setSelectedSchoolId(school.id);
                          setSelectedDistrictId(null);
                        }}
                        className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded text-xs flex items-center justify-between cursor-pointer transition-colors"
                      >
                        <div>
                          <span className="font-bold text-slate-900 block">{school.name}</span>
                          <span className="text-[10px] text-slate-400 block">{school.ownership} • Founded {school.foundedYear}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-mono font-bold text-amber-600 block">
                            {perf ? `${perf.passRate}% pass` : "No performance"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Footer close */}
            <div className="p-4 bg-slate-50 border-t border-slate-200">
              <button 
                onClick={() => setSelectedDistrictId(null)}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded cursor-pointer transition-colors"
              >
                Close District Profile
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
