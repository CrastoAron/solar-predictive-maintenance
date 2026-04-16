"use client";

import { Globe, Send, Briefcase, Camera, Sun } from "lucide-react";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-white/5 py-12 bg-black/20">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-12">
          <div className="flex flex-col items-center md:items-start">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
                <Sun className="w-4 h-4 text-white" />
              </div>
              <span className="text-white font-bold text-lg">SolarShield</span>
            </div>
            <p className="text-slate-500 text-sm text-center md:text-left max-w-xs">
              Next-generation solar panel monitoring and predictive maintenance, 
              powered by IoT and Machine Learning.
            </p>
          </div>

          <div className="flex flex-col items-center md:items-start">
            <p className="text-white font-semibold mb-4">Company</p>
            <nav className="flex flex-col items-center md:items-start gap-2">
              <Link href="#" className="text-slate-400 hover:text-orange-400 text-sm transition-colors text-nowrap">About Project</Link>
              <Link href="#" className="text-slate-400 hover:text-orange-400 text-sm transition-colors text-nowrap">Technical Specs</Link>
              <Link href="#" className="text-slate-400 hover:text-orange-400 text-sm transition-colors text-nowrap">Support</Link>
            </nav>
          </div>

          <div className="flex flex-col items-center md:items-start">
            <p className="text-white font-semibold mb-4">Join Community</p>
            <div className="flex items-center gap-4">
              {[Globe, Send, Briefcase, Camera].map((Icon, i) => (
                <Link 
                  key={i} 
                  href="#" 
                  className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:bg-orange-500 hover:text-white transition-all duration-300"
                >
                  <Icon className="w-4 h-4" />
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-slate-600 text-xs text-nowrap">
            © {new Date().getFullYear()} SolarShield. All rights reserved. Built for sustainability.
          </p>
          <div className="flex items-center gap-6">
            <Link href="#" className="text-slate-600 hover:text-slate-400 text-xs text-nowrap transition-colors">Privacy Policy</Link>
            <Link href="#" className="text-slate-600 hover:text-slate-400 text-xs text-nowrap transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
