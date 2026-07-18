import React, { useState, useMemo } from "react";
import { TrendingUp, Sparkles, Loader2, ArrowUpRight, BarChart3, HelpCircle, Activity } from "lucide-react";
import { SUBJECTS, YEARLY_PERFORMANCE } from "../data/unebData";
import { ExamLevel } from "../types";
import { GemmaService } from "../services/gemma";

export default function Trends() {
  const [selectedSubject, setSelectedSubject] = useState("Mathematics");
  const [selectedLevel, setSelectedLevel] = useState<ExamLevel>(ExamLevel.UCE);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);

  // Compute average score for the selected subject from 2015-2025
  const trendData = useMemo(() => {
    const years = Array.from({ length: 11 }, (_, i) => 2015 + i);
    return years.map(year => {
      const perfs = YEARLY_PERFORMANCE.filter(p => p.year === year && p.level === selectedLevel);
      if (perfs.length === 0) return { year, averageScore: 0 };
      
      const sum = perfs.reduce((s, p) => s + (p.subjectAverages[selectedSubject] || 0), 0);
      const avg = sum / perfs.length;
      return {
        year,
        averageScore: parseFloat(avg.toFixed(2))
      };
    });
  }, [selectedSubject, selectedLevel]);

  const handleRunAITrends = async () => {
    setLoadingAI(true);
    setAiAnalysis("");
    try {
      const dataStr = trendData.map(d => `${d.year}: ${d.averageScore}`).join(", ");
      const queryPrompt = `Perform a trend analysis on Ugandan ${selectedSubject} performance (${selectedLevel} level) across 2015 to 2025.
Historical averages: [${dataStr}].
Note that on the UCE scale, 1 is the best grade (distinction) and 9 is the worst (fail). On UACE, 5 is the best (Grade A) and 0 is the worst (Grade F).
Generate a response with sections:
1. Trend Summary
2. Reasons & Potential Causes
3. Future Outlook (2026 predictions)
4. Recommended Interventions`;

      const res = await GemmaService.chat(queryPrompt);
      setAiAnalysis(res.reply);
    } catch (e: any) {
      console.error(e);
      setAiAnalysis("Failed to formulate trends analysis. Check your configuration.");
    } finally {
      setLoadingAI(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-5 gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" /> Longitudinal Trend Analytics
          </h2>
          <p className="text-xs text-slate-500">
            Plot examination score averages across years, and analyze national performance regressions with Gemma.
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <select
            value={selectedSubject}
            onChange={(e) => { setSelectedSubject(e.target.value); setAiAnalysis(""); }}
            className="bg-white border border-slate-200 text-xs font-semibold px-3 py-2 rounded-xl outline-none"
          >
            {SUBJECTS.map(s => (
              <option key={s.name} value={s.name}>{s.name}</option>
            ))}
          </select>

          <div className="flex bg-slate-100 rounded p-0.5">
            <button 
              onClick={() => { setSelectedLevel(ExamLevel.UCE); setAiAnalysis(""); }}
              className={`px-3 py-1.5 text-[10px] font-bold rounded transition-all ${
                selectedLevel === ExamLevel.UCE ? "bg-white text-slate-900 shadow-3xs" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              UCE
            </button>
            <button 
              onClick={() => { setSelectedLevel(ExamLevel.UACE); setAiAnalysis(""); }}
              className={`px-3 py-1.5 text-[10px] font-bold rounded transition-all ${
                selectedLevel === ExamLevel.UACE ? "bg-white text-slate-900 shadow-3xs" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              UACE
            </button>
          </div>
        </div>
      </div>

      {/* Graph Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-3xs p-6 space-y-6">
        <div>
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-slate-900">National {selectedSubject} Trendline (2015-2025)</h3>
            <span className="text-xs font-mono font-bold text-slate-400">
              {selectedLevel === ExamLevel.UCE ? "Scale: 1 (Excellent) to 9 (Fail)" : "Scale: 5 (Excellent) to 0 (Fail)"}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Aggregated historical UNEB scores across all registered test centers nationally.</p>
        </div>

        {/* Custom pure-SVG interactive chart that works seamlessly in React 19 */}
        <div className="h-52 flex items-end gap-2 pb-2 relative border-b border-slate-100">
          {/* Grid lines */}
          <div className="absolute top-0 bottom-4 left-0 right-0 flex flex-col justify-between text-[8px] text-slate-300 pointer-events-none">
            <div className="border-t border-dashed border-slate-100 w-full pt-1">High Performance</div>
            <div className="border-t border-dashed border-slate-100 w-full pt-1">Median Performance</div>
            <div className="border-t border-dashed border-slate-100 w-full pt-1">Lower Performance</div>
          </div>

          {trendData.map((d, idx) => {
            // Normalize score to height percentage for visual output
            // For UCE, lower is better (8 is worst, 1 is best). Let's convert so 1 has high bar
            const heightFactor = selectedLevel === ExamLevel.UCE
              ? (9 - d.averageScore) * 12.5
              : d.averageScore * 20;

            return (
              <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full group z-10">
                <div 
                  style={{ height: `${Math.max(5, Math.min(100, heightFactor))}%` }}
                  className="w-full max-w-[40px] bg-indigo-600 hover:bg-amber-500 hover:scale-105 transition-all rounded-t-sm relative cursor-pointer"
                >
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] py-0.5 px-1.5 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity font-mono whitespace-nowrap z-50 shadow-sm">
                    Avg Grade: {d.averageScore}
                  </div>
                </div>
                <span className="text-[10px] font-bold text-slate-400 mt-2">{d.year}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* AI Trends Summarizer */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-5 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-3xs">
              <Activity className="w-5 h-5 text-indigo-600 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Gemma Trend Diagnostician</h3>
              <p className="text-xs text-slate-500">Formulate trend analyses, identify potential causes, and design policy interventions</p>
            </div>
          </div>

          <button
            onClick={handleRunAITrends}
            disabled={loadingAI}
            className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-sm ml-auto md:ml-0"
          >
            {loadingAI ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" /> Analyzing Trends...
              </>
            ) : (
              <>
                Run Trend Diagnosis <ArrowUpRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        {/* AI Output Area */}
        <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-6 min-h-[140px] flex items-center justify-center">
          {loadingAI ? (
            <div className="text-center space-y-2">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
              <p className="text-xs text-slate-500 font-bold">Gemma is evaluating multi-year score matrices and outlining educational interventions...</p>
            </div>
          ) : aiAnalysis ? (
            <div className="w-full text-left space-y-4 prose prose-indigo max-w-none">
              {aiAnalysis.split("\n").map((line, idx) => {
                let cleaned = line.trim();
                if (cleaned.startsWith("### ")) {
                  return <h4 key={idx} className="text-xs font-black text-slate-800 mt-4 mb-2 uppercase tracking-widest">{cleaned.replace("### ", "")}</h4>;
                }
                if (cleaned.startsWith("## ")) {
                  return <h3 key={idx} className="text-sm font-black text-slate-900 mt-5 mb-2 border-b border-slate-100 pb-1 uppercase tracking-wider">{cleaned.replace("## ", "")}</h3>;
                }
                if (cleaned.startsWith("# ")) {
                  return <h2 key={idx} className="text-base font-black text-indigo-800 mt-6 mb-3 uppercase tracking-wide">{cleaned.replace("# ", "")}</h2>;
                }
                if (cleaned.startsWith("* ") || cleaned.startsWith("- ")) {
                  return (
                    <li key={idx} className="ml-4 list-disc text-slate-600 text-xs py-0.5 leading-relaxed font-medium">
                      {cleaned.substring(2).split("**").map((part, i) => i % 2 === 1 ? <strong key={i} className="font-extrabold text-slate-950 bg-slate-100 px-1 rounded-sm">{part}</strong> : part)}
                    </li>
                  );
                }
                if (cleaned === "") {
                  return <div key={idx} className="h-2" />;
                }
                return (
                  <p key={idx} className="text-slate-600 text-xs leading-relaxed mb-1.5 font-medium">
                    {line.split("**").map((part, i) => i % 2 === 1 ? <strong key={i} className="font-extrabold text-slate-950">{part}</strong> : part)}
                  </p>
                );
              })}
            </div>
          ) : (
            <div className="text-center space-y-1">
              <TrendingUp className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-bold">No diagnosis run yet</p>
              <p className="text-[10px] text-slate-400">Select a subject and level above, then trigger Gemma to diagnose trend trajectory anomalies.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
