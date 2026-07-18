import React, { useState, useMemo } from "react";
import { Layers, Sparkles, Loader2, ArrowUpRight, CheckCircle2, AlertTriangle, TrendingUp, TrendingDown, BookOpen, Trash2, Plus } from "lucide-react";
import { SCHOOLS, YEARLY_PERFORMANCE } from "../data/unebData";
import { AnalyticsEngine } from "../lib/analyticsEngine";
import { ExamLevel } from "../types";
import { GemmaService } from "../services/gemma";

interface CompareProps {
  selectedLevel: ExamLevel;
  selectedYear: number;
}

export default function Compare({ selectedLevel, selectedYear }: CompareProps) {
  const [selectedSchools, setSelectedSchools] = useState<string[]>(["s_budo", "s_kitende"]);
  const [newSchoolId, setNewSchoolId] = useState("");
  const [aiAnalysis, setAiAnalysis] = useState<string>("");
  const [loadingAI, setLoadingAI] = useState(false);

  const availableSchools = useMemo(() => {
    return SCHOOLS.filter(s => !selectedSchools.includes(s.id));
  }, [selectedSchools]);

  const comparisonData = useMemo(() => {
    return AnalyticsEngine.compareSchools(selectedSchools, selectedLevel);
  }, [selectedSchools, selectedLevel]);

  const handleAddSchool = () => {
    if (newSchoolId && selectedSchools.length < 4) {
      setSelectedSchools([...selectedSchools, newSchoolId]);
      setNewSchoolId("");
      setAiAnalysis("");
    }
  };

  const handleRemoveSchool = (id: string) => {
    if (selectedSchools.length > 1) {
      setSelectedSchools(selectedSchools.filter(sid => sid !== id));
      setAiAnalysis("");
    }
  };

  const handleRunAIInterpretation = async () => {
    setLoadingAI(true);
    setAiAnalysis("");
    try {
      const names = comparisonData.map(d => d.school.name).join(", ");
      const queryPrompt = `Provide a senior educational interpretation comparing: ${names}. For level ${selectedLevel}.
Analyze the historical pass rates and metrics of these institutions, outlining their Strengths, Weaknesses, Trend Direction, Predictions for 2026, and concrete Recommendations. Output using clean, professional Markdown with bullet points.`;
      
      const res = await GemmaService.chat(queryPrompt);
      setAiAnalysis(res.reply);
    } catch (e: any) {
      console.error(e);
      setAiAnalysis("Unable to formulate comparative interpretation. Please check your system configuration.");
    } finally {
      setLoadingAI(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Title & Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-5 gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" /> Multi-School Comparison Matrix
          </h2>
          <p className="text-xs text-slate-500">
            Compare educational performance indicators, division distributions, and subject metrics side-by-side.
          </p>
        </div>

        {/* Add school controls */}
        <div className="flex items-center gap-2">
          <select
            value={newSchoolId}
            onChange={(e) => setNewSchoolId(e.target.value)}
            disabled={selectedSchools.length >= 4}
            className="bg-white border border-slate-200 text-xs font-semibold px-3 py-2 rounded-xl outline-none"
          >
            <option value="">-- Add School (Max 4) --</option>
            {availableSchools.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button
            onClick={handleAddSchool}
            disabled={!newSchoolId || selectedSchools.length >= 4}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold px-4 py-2 rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
      </div>

      {/* Grid of Comparative Performance Matrix cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {comparisonData.map(({ school, consistency, yearlyData }) => {
          const currentYearPerf = yearlyData.find((yd: any) => yd.year === selectedYear) || yearlyData[yearlyData.length - 1];
          const previousYearPerf = yearlyData.find((yd: any) => yd.year === selectedYear - 1);
          
          const passRateDiff = previousYearPerf 
            ? parseFloat((currentYearPerf.passRate - previousYearPerf.passRate).toFixed(1))
            : 0;

          return (
            <div key={school.id} className="bg-white rounded-2xl border border-slate-200 shadow-3xs p-6 relative flex flex-col justify-between hover:border-slate-300 transition-all">
              {/* Delete tag */}
              {selectedSchools.length > 1 && (
                <button
                  onClick={() => handleRemoveSchool(school.id)}
                  className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-50 text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}

              <div className="space-y-4">
                {/* School Title */}
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">{school.ownership} • {school.gender}</span>
                  <h3 className="text-base font-extrabold text-slate-900 mt-0.5 leading-snug line-clamp-2 pr-6">{school.name}</h3>
                  <span className="text-[10px] text-slate-500 font-semibold mt-1 block">{school.districtName} District</span>
                </div>

                {/* Primary Pass Rate KPI */}
                <div className="bg-slate-50 p-4 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pass Rate ({selectedYear})</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-light text-slate-900">{currentYearPerf?.passRate}%</span>
                    {previousYearPerf && (
                      <span className={`text-[10px] font-bold flex items-center gap-0.5 ${
                        passRateDiff >= 0 ? "text-emerald-600" : "text-rose-600"
                      }`}>
                        {passRateDiff >= 0 ? `+${passRateDiff}%` : `${passRateDiff}%`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Performance indicators */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Quality pass index:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {selectedLevel === ExamLevel.UCE 
                        ? `${currentYearPerf?.divisions.div1Or3Prin} Div 1` 
                        : `${currentYearPerf?.divisions.div1Or3Prin} (3 Passes)`
                      }
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Consistency index:</span>
                    <span className={`font-mono font-bold px-2 py-0.5 rounded text-[10px] ${
                      consistency.consistencyScore >= 80 
                        ? "bg-emerald-50 text-emerald-700" 
                        : "bg-amber-50 text-amber-700"
                    }`}>{consistency.consistencyScore}%</span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Historical Mean Score:</span>
                    <span className="font-mono font-bold text-slate-900">{consistency.averageScore}</span>
                  </div>
                </div>
              </div>

              {/* Little YoY Progress bar */}
              <div className="mt-5 pt-4 border-t border-slate-100">
                <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block mb-1.5">Longitudinal Progress (2015-2025)</span>
                <div className="flex gap-1 h-1.5">
                  {yearlyData.map((yd: any, idx: number) => {
                    const pass = yd.passRate;
                    return (
                      <div 
                        key={idx}
                        style={{ height: "100%" }}
                        className={`flex-1 rounded-sm ${
                          pass >= 90 ? "bg-blue-600" : pass >= 70 ? "bg-indigo-400" : "bg-indigo-200"
                        }`}
                        title={`${yd.year}: ${pass}%`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* AI Comparison Interpretation Module */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-5 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-3xs">
              <Sparkles className="w-5 h-5 text-blue-600 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Gemma Comparative Analytical Layer</h3>
              <p className="text-xs text-slate-500">Run executive AI comparative regressions on the active matrix above</p>
            </div>
          </div>

          <button
            onClick={handleRunAIInterpretation}
            disabled={loadingAI}
            className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-sm ml-auto md:ml-0"
          >
            {loadingAI ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" /> Planning Comparison...
              </>
            ) : (
              <>
                Interpret Performance with Gemma <ArrowUpRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        {/* AI Output Window */}
        <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-6 min-h-[140px] flex items-center justify-center">
          {loadingAI ? (
            <div className="text-center space-y-2">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
              <p className="text-xs text-slate-500 font-bold">Gemma is analyzing institutional consistency indexes and formulating recommendations...</p>
            </div>
          ) : aiAnalysis ? (
            <div className="w-full text-left space-y-4 prose prose-slate max-w-none">
              {aiAnalysis.split("\n").map((line, idx) => {
                let cleaned = line.trim();
                if (cleaned.startsWith("### ")) {
                  return <h4 key={idx} className="text-xs font-black text-slate-800 mt-4 mb-2 uppercase tracking-widest">{cleaned.replace("### ", "")}</h4>;
                }
                if (cleaned.startsWith("## ")) {
                  return <h3 key={idx} className="text-sm font-black text-slate-900 mt-5 mb-2 border-b border-slate-100 pb-1 uppercase tracking-wider">{cleaned.replace("## ", "")}</h3>;
                }
                if (cleaned.startsWith("# ")) {
                  return <h2 key={idx} className="text-base font-black text-blue-800 mt-6 mb-3 uppercase tracking-wide">{cleaned.replace("# ", "")}</h2>;
                }
                if (cleaned.startsWith("* ") || cleaned.startsWith("- ")) {
                  return (
                    <li key={idx} className="ml-4 list-disc text-slate-600 text-xs py-0.5 leading-relaxed">
                      {cleaned.substring(2).split("**").map((part, i) => i % 2 === 1 ? <strong key={i} className="font-extrabold text-slate-950">{part}</strong> : part)}
                    </li>
                  );
                }
                if (cleaned === "") {
                  return <div key={idx} className="h-2" />;
                }
                return (
                  <p key={idx} className="text-slate-600 text-xs leading-relaxed mb-1.5">
                    {line.split("**").map((part, i) => i % 2 === 1 ? <strong key={i} className="font-extrabold text-slate-950">{part}</strong> : part)}
                  </p>
                );
              })}
            </div>
          ) : (
            <div className="text-center space-y-1">
              <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-bold">No interpretation generated yet</p>
              <p className="text-[10px] text-slate-400">Click the button above to execute Gemma's comparative explanation models.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
