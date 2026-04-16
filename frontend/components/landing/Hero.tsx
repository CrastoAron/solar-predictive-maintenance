"use client";

import Link from "next/link";
import { ArrowRight, Sun } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <div 
          className="absolute inset-0 bg-cover bg-center transition-transform duration-[20000ms] scale-110 hover:scale-100"
          style={{ backgroundImage: "url('/hero-bg.png')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0f1117]/60 via-[#0f1117]/80 to-[#0f1117] " />
      </div>

      {/* Decorative Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] animate-pulse [animation-delay:2s]" />

      <div className="relative z-10 container mx-auto px-6 pt-20 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8 animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
          <span className="text-orange-400 text-xs font-semibold tracking-wider uppercase">
            AI-Powered Predictive Maintenance
          </span>
        </div>

        <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-white mb-6 tracking-tight leading-tight">
          Protect Your <br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-orange-500 to-amber-500">
            Solar Investment
          </span>
        </h1>

        <p className="max-w-2xl mx-auto text-slate-400 text-lg md:text-xl mb-12 leading-relaxed">
          SolarShield uses advanced Machine Learning to predict faults, monitor efficiency, 
          and extend the life of your solar assets. Experience real-time IoT insights 
          directly from your panels.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/login"
            className="group flex items-center gap-2 px-8 py-4 rounded-2xl bg-orange-500 hover:bg-orange-400 text-white font-bold transition-all duration-300 shadow-2xl shadow-orange-500/30 hover:shadow-orange-500/40 hover:-translate-y-1"
          >
            Enter Dashboard
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="#features"
            className="px-8 py-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold transition-all duration-300 backdrop-blur-md hover:-translate-y-1"
          >
            How it Works
          </Link>
        </div>

        {/* Floating Metrics Preview */}
        <div className="mt-24 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 max-w-4xl mx-auto">
          {[
            { label: "Efficiency", value: "98.4%", color: "text-emerald-400" },
            { label: "Detected Faults", value: "0", color: "text-orange-400" },
            { label: "Healthy Panels", value: "24/24", color: "text-blue-400" },
            { label: "Days Saved", value: "142", color: "text-violet-400" },
          ].map((item, i) => (
            <div 
              key={i} 
              className="glass-card p-4 text-center animate-fade-in-up"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <p className="text-slate-500 text-[10px] uppercase tracking-widest mb-1">{item.label}</p>
              <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
