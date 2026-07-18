import React, { useState } from "react";
import { Search, Sparkles, TrendingUp, Award, BookOpen, MapPin, ChevronRight } from "lucide-react";
import { motion } from "motion/react";

interface HomeProps {
  onSearch: (query: string) => void;
  onNavigateTab: (tab: any) => void;
  onSelectSchool: (id: string) => void;
  onSelectDistrict: (id: string) => void;
}

export default function Home({ onSearch, onNavigateTab, onSelectSchool, onSelectDistrict }: HomeProps) {
  const [searchInput, setSearchInput] = useState("");

  const suggestedPrompts = [
    { text: "Compare Budo and Kitende", tab: "compare", query: "Compare King's College Budo and St Mary's Boarding SS, Kitende" },
    { text: "Which districts need intervention?", tab: "policy", query: "Which districts have high poverty rates and low pass rates that need immediate STEM intervention?" },
    { text: "Predict UNEB 2026", tab: "ai", query: "Predict UNEB 2026 performance trends" },
    { text: "Generate National Education Report", tab: "reports", query: "Generate a National Education Report for 2025" },
    { text: "Which schools are improving fastest?", tab: "trends", query: "Show me outstanding school improvers in UCE" },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      onSearch(searchInput);
    }
  };

  const handlePromptClick = (prompt: typeof suggestedPrompts[0]) => {
    onNavigateTab(prompt.tab);
    onSearch(prompt.query);
  };

  return (
    <div className="space-y-12 pb-16">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-radial from-blue-900/10 via-transparent to-transparent py-16 px-4 text-center rounded-3xl border border-slate-200 bg-white">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-500/10 rounded-full filter blur-3xl -z-10" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-6 max-w-4xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase border border-blue-100 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
            Powered by Gemma Model Family
          </div>

          <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-slate-900">
            EduIntel <span className="text-blue-600 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">AI</span>
          </h1>

          <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Transforming Uganda's Education Data into Intelligent Decisions with Gemma
          </p>

          {/* Large Search Box */}
          <form onSubmit={handleSubmit} className="relative max-w-2xl mx-auto mt-8">
            <div className="relative flex items-center bg-white rounded-2xl border-2 border-slate-200 shadow-lg focus-within:border-blue-500 transition-all p-1">
              <Search className="w-6 h-6 text-slate-400 ml-4 shrink-0" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Ask anything about Uganda's education system..."
                className="w-full pl-3 pr-4 py-3.5 bg-transparent border-0 outline-none text-slate-900 text-base placeholder-slate-400"
              />
              <button
                type="submit"
                className="bg-blue-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-blue-700 active:scale-98 transition-all shrink-0 shadow-sm"
              >
                Analyze
              </button>
            </div>
          </form>

          {/* Suggested Prompts */}
          <div className="pt-6">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-3">Suggested queries:</span>
            <div className="flex flex-wrap justify-center gap-2 max-w-3xl mx-auto">
              {suggestedPrompts.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handlePromptClick(prompt)}
                  className="bg-slate-50 border border-slate-200 text-slate-700 hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-700 text-xs font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer shadow-2xs"
                >
                  {prompt.text}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Grid of Key Educational Entry Points */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all space-y-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <Award className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">National Rankings</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Access ranked academic performances of Government and Private schools. Benchmark division passing ratios in O-Level (UCE) and A-Level (UACE).
          </p>
          <button 
            onClick={() => onNavigateTab("compare")} 
            className="text-xs font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 group cursor-pointer"
          >
            Open Rankings <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all space-y-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <TrendingUp className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Longitudinal Trends</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Track performance trajectories across decade-scale examination records (2015–2025). Discover subject-specific strengths or regression correlations.
          </p>
          <button 
            onClick={() => onNavigateTab("trends")} 
            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1 group cursor-pointer"
          >
            Explore Trends <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all space-y-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <BookOpen className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">AI Policy Advisor</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Formulate high-impact national policy models, analyze teacher resource allocation, poverty index correlations, and target STEM interventions.
          </p>
          <button 
            onClick={() => onNavigateTab("policy")} 
            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1 group cursor-pointer"
          >
            Formulate Policy <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>

      {/* Featured Ugandan School Profiles */}
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Uganda's Academic Pillars</h2>
            <p className="text-xs text-slate-500">Quickly drill down into comprehensive data profiles of top historical institutions</p>
          </div>
          <button 
            onClick={() => onNavigateTab("compare")} 
            className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
          >
            Compare All
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { id: "s_budo", name: "King's College Budo", region: "Central", color: "from-amber-500 to-orange-500" },
            { id: "s_kitende", name: "St Mary's Kitende", region: "Central", color: "from-blue-500 to-indigo-500" },
            { id: "s_gayaza", name: "Gayaza High School", region: "Central", color: "from-pink-500 to-rose-500" },
            { id: "s_ntare", name: "Ntare School", region: "Western", color: "from-emerald-500 to-teal-500" },
            { id: "s_namugongo", name: "Uganda Martyrs SS", region: "Central", color: "from-violet-500 to-purple-500" },
          ].map((school) => (
            <button
              key={school.id}
              onClick={() => onSelectSchool(school.id)}
              className="bg-slate-50 hover:bg-white hover:border-blue-400 border border-slate-200 p-4 rounded-xl text-left transition-all cursor-pointer group hover:shadow-sm"
            >
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${school.color} opacity-80 group-hover:opacity-100 mb-3`} />
              <h4 className="text-xs font-bold text-slate-800 line-clamp-1 group-hover:text-blue-600">{school.name}</h4>
              <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                <MapPin className="w-2.5 h-2.5" /> {school.region} Region
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
