import React, { useState, useEffect } from "react";
import { 
  Sparkles, Award, TrendingUp, BookOpen, Layers, FileText, Brain, 
  Hammer, GraduationCap, Cloud, Menu, X, ArrowUpRight, ChevronRight, HelpCircle
} from "lucide-react";
import { ExamLevel } from "./types";
import { initAuth, saveFileToDrive, listDriveFiles } from "./lib/driveService";
import { User } from "firebase/auth";

// Page Imports
import Home from "./pages/Home";
import AIAnalyst from "./pages/AIAnalyst";
import Compare from "./pages/Compare";
import Trends from "./pages/Trends";
import PolicyAdvisor from "./pages/PolicyAdvisor";
import Reports from "./pages/Reports";
import Predictions from "./pages/Predictions";
import SchoolImprovement from "./pages/SchoolImprovement";
import StudentAssistant from "./pages/StudentAssistant";
import GoogleDrive from "./pages/GoogleDrive";

export default function App() {
  // Master states
  const [currentTab, setCurrentTab] = useState<
    "home" | "ai" | "compare" | "trends" | "policy" | "reports" | "predictions" | "improvement" | "student" | "drive"
  >("home");
  const [selectedYear, setSelectedYear] = useState<number>(2025);
  const [selectedLevel, setSelectedLevel] = useState<ExamLevel>(ExamLevel.UCE);
  const [initialSearchQuery, setInitialSearchQuery] = useState<string>("");

  // Google Drive & Auth States (integrated from existing architecture)
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Initialize Auth state listener on mount
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setCurrentUser(user);
        setAccessToken(token);
      },
      () => {
        setCurrentUser(null);
        setAccessToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleSearchFromHome = (query: string) => {
    setInitialSearchQuery(query);
    setCurrentTab("ai");
  };

  const handleSelectSchool = (schoolId: string) => {
    // Navigate to Compare and run comparison
    setCurrentTab("compare");
  };

  const handleSelectDistrict = (districtId: string) => {
    setCurrentTab("compare");
  };

  const handleSaveFileToDrive = async (filename: string, content: string, mimeType: string) => {
    if (!accessToken) return;
    return saveFileToDrive(accessToken, filename, content, mimeType);
  };

  const navItems = [
    { id: "home", label: "Home Portal", icon: Sparkles, category: "Core" },
    { id: "ai", label: "AI Analyst Workspace", icon: Brain, category: "Core" },
    { id: "compare", label: "Comparison Matrix", icon: Layers, category: "Core" },
    { id: "trends", label: "Longitudinal Trends", icon: TrendingUp, category: "Core" },
    { id: "policy", label: "AI Policy Advisor", icon: BookOpen, category: "Core" },
    { id: "reports", label: "AI Report Generator", icon: FileText, category: "Core" },
    
    { id: "predictions", label: "2026 Predictions", icon: Award, category: "AI Tools" },
    { id: "improvement", label: "Improvement Planner", icon: Hammer, category: "AI Tools" },
    { id: "student", label: "Student Assistant", icon: GraduationCap, category: "AI Tools" },
    { id: "drive", label: "Google Drive Cloud", icon: Cloud, category: "Integrations" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-900 font-sans">
      
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 px-4 flex items-center justify-between z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-sm">
            E
          </div>
          <span className="font-bold tracking-tight text-slate-900">EduIntel AI</span>
        </div>
        <button 
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
        >
          {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar Layout */}
      <aside className={`
        fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 flex flex-col justify-between z-40 transition-transform duration-300 md:translate-x-0
        ${sidebarOpen ? "translate-x-0 pt-16 md:pt-0" : "-translate-x-full md:translate-x-0"}
      `}>
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-8">
          
          {/* Logo / Brand Header */}
          <div className="hidden md:flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-sm">
              E
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight text-slate-900 flex items-center gap-1">
                EduIntel <span className="text-blue-600 text-xs font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 uppercase">AI</span>
              </h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Uganda Education Data</p>
            </div>
          </div>

          {/* Navigation Items Categories */}
          {["Core", "AI Tools", "Integrations"].map((category) => {
            const items = navItems.filter(item => item.category === category);
            return (
              <div key={category} className="space-y-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 block">
                  {category}
                </span>
                <nav className="space-y-1">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setCurrentTab(item.id as any);
                          setSidebarOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                          isActive 
                            ? "bg-blue-600 text-white shadow-xs" 
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                        }`}
                      >
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-white" : "text-slate-400"}`} />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>
            );
          })}
        </div>

        {/* Global Year & Level Controls inside sidebar footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/50 space-y-3.5 shrink-0">
          <div className="space-y-1.5">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Cohort Year</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-blue-500 transition-all text-slate-800 cursor-pointer"
            >
              {[2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015].map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">UNEB Level</span>
            <div className="flex bg-slate-200 p-0.5 rounded-xl">
              <button
                onClick={() => setSelectedLevel(ExamLevel.UCE)}
                className={`flex-1 text-[10px] font-bold py-1.5 rounded-lg transition-all ${
                  selectedLevel === ExamLevel.UCE ? "bg-white text-slate-900 shadow-3xs" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                UCE (O-Level)
              </button>
              <button
                onClick={() => setSelectedLevel(ExamLevel.UACE)}
                className={`flex-1 text-[10px] font-bold py-1.5 rounded-lg transition-all ${
                  selectedLevel === ExamLevel.UACE ? "bg-white text-slate-900 shadow-3xs" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                UACE (A-Level)
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className="flex-1 md:ml-64 p-6 md:p-10 pt-20 md:pt-10 overflow-x-hidden min-h-screen">
        <div className="max-w-6xl mx-auto space-y-8">
          
          {/* Main Router Logic */}
          {currentTab === "home" && (
            <Home 
              onSearch={handleSearchFromHome}
              onNavigateTab={(tab) => setCurrentTab(tab)}
              onSelectSchool={handleSelectSchool}
              onSelectDistrict={handleSelectDistrict}
            />
          )}

          {currentTab === "ai" && (
            <AIAnalyst 
              initialSearchQuery={initialSearchQuery}
              onClearSearchQuery={() => setInitialSearchQuery("")}
              onNavigateTab={(tab) => setCurrentTab(tab)}
            />
          )}

          {currentTab === "compare" && (
            <Compare 
              selectedLevel={selectedLevel}
              selectedYear={selectedYear}
            />
          )}

          {currentTab === "trends" && (
            <Trends />
          )}

          {currentTab === "policy" && (
            <PolicyAdvisor />
          )}

          {currentTab === "reports" && (
            <Reports 
              selectedYear={selectedYear}
              selectedLevel={selectedLevel}
              currentUser={currentUser}
              accessToken={accessToken}
              onInitiateExport={() => {}}
              onSaveFileToDrive={handleSaveFileToDrive}
            />
          )}

          {currentTab === "predictions" && (
            <Predictions />
          )}

          {currentTab === "improvement" && (
            <SchoolImprovement />
          )}

          {currentTab === "student" && (
            <StudentAssistant />
          )}

          {currentTab === "drive" && (
            <GoogleDrive 
              currentUser={currentUser}
              accessToken={accessToken}
              onLoginSuccess={(user, token) => {
                setCurrentUser(user);
                setAccessToken(token);
              }}
              onLogoutSuccess={() => {
                setCurrentUser(null);
                setAccessToken(null);
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
}
