"use client";

import { Cpu, Zap, Activity, ShieldCheck, Database, BarChart3 } from "lucide-react";

const FEATURES = [
  {
    title: "ML Predictive Models",
    description: "XGBoost and Random Forest algorithms predict faults before they cause downtime.",
    icon: Cpu,
    color: "bg-orange-500/10 text-orange-400",
  },
  {
    title: "IoT Edge Computing",
    description: "Real-time data processing on ESP32 with MQTT low-latency communication.",
    icon: Zap,
    color: "bg-blue-500/10 text-blue-400",
  },
  {
    title: "InfluxDB Time-Series",
    description: "High-performance data storage for millions of sensor readings and historical trends.",
    icon: Database,
    color: "bg-violet-500/10 text-violet-400",
  },
  {
    title: "Fault Classification",
    description: "Identifies partial shading, dust accumulation, and hardware failures instantly.",
    icon: ShieldCheck,
    color: "bg-emerald-500/10 text-emerald-400",
  },
  {
    title: "Advanced Analytics",
    description: "Interactive Recharts visualization for voltage, current, power, and environmental metrics.",
    icon: BarChart3,
    color: "bg-amber-500/10 text-amber-400",
  },
  {
    title: "Predictive Maintenance",
    description: "Optimize cleaning and repair schedules to maintain maximum panel efficiency.",
    icon: Activity,
    color: "bg-red-500/10 text-red-400",
  },
];

export default function Features() {
  return (
    <section id="features" className="py-24 relative">
      <div className="container mx-auto px-6">
        <div className="text-center mb-20">
          <h2 className="text-white text-3xl md:text-4xl font-bold mb-4 tracking-tight">
            Integrated Solar intelligence
          </h2>
          <div className="w-16 h-1 bg-orange-500 mx-auto rounded-full mb-6" />
          <p className="text-slate-400 max-w-2xl mx-auto">
            Our platform bridges the gap between hardware sensors and cloud-based AI 
            to provide a complete solution for solar asset management.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((feature, i) => (
            <div 
              key={i}
              className="group glass-card p-8 hover:bg-white/[0.05] transition-all duration-300 hover:-translate-y-2 border-white/[0.05]"
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 ${feature.color}`}>
                <feature.icon className="w-6 h-6" />
              </div>
              <h3 className="text-white text-xl font-bold mb-3">{feature.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
