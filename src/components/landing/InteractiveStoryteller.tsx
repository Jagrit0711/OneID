import { useState } from "react";
import { ShieldCheck, Lock, Eye, Sparkles, ChevronDown } from "lucide-react";

export function InteractiveStoryteller() {
  const [activeTab, setActiveTab] = useState<number>(1);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const STAGE_CONTENT = [
    {
      step: "01",
      title: "Cryptographic QR Decoding",
      subtitle: "Instant RSA 2048-bit digital signature proof.",
      body: "Scan any official Aadhaar Secure QR code. OneID decodes demographic data and validates official UIDAI RSA signatures instantly on device without any network calls.",
    },
    {
      step: "02",
      title: "All Credentials in One Place",
      subtitle: "Store PAN, Driving License, Ration Card & Marksheet.",
      body: "Keep your official documents securely in your personal vault. You set the rules on which documents verifiers can inspect.",
    },
    {
      step: "03",
      title: "InsightFace ArcFace 512-dim AI Match",
      subtitle: "99.86% LFW benchmark facial recognition accuracy.",
      body: "Compares live camera streams against historical document photos using 512-dimensional L2-normalized embeddings, accounting for aging, lighting, and low resolution.",
    },
    {
      step: "04",
      title: "Live Audit Logs & Consent",
      subtitle: "Complete transparency for citizens and verifiers.",
      body: "Every document inspection generates a real-time audit record showing who verified your identity, when, and which specific documents were accessed.",
    },
  ];

  const FAQS = [
    {
      q: "How safe and secure is my identity data?",
      a: "100% safe. OneID operates completely offline in your device memory. No photos, face embeddings, or Aadhaar numbers are ever sent to cloud servers or stored in remote databases.",
    },
    {
      q: "Can verifiers access my PAN or Driving License without my permission?",
      a: "No. You control access permissions inside your Citizen Vault. Verifiers can only inspect documents that you have explicitly enabled and that pass biometric face verification.",
    },
    {
      q: "How does InsightFace ArcFace face verification work?",
      a: "InsightFace ArcFace maps facial landmarks into 512-dimensional vector space. It calculates L2 cosine distance between live webcam frames and your Aadhaar photo, achieving 99.86% LFW accuracy.",
    },
  ];

  return (
    <section className="mx-auto max-w-6xl px-6 py-20 text-foreground select-none">
      {/* ── Storytelling Feature Showcase (Superpower Style) ── */}
      <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
        {/* Left Side: Text & Step Selector */}
        <div className="lg:col-span-5 space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-bold text-emerald-400">
            <Sparkles className="size-3.5" /> Story of OneID
          </div>

          <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl leading-tight">
            All your identity data, <br />
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              in one private place.
            </span>
          </h2>

          {/* Interactive Step Switcher (01, 02, 03, 04) */}
          <div className="space-y-4 pt-2">
            {STAGE_CONTENT.map((item, idx) => (
              <div
                key={item.step}
                onClick={() => setActiveTab(idx)}
                className={`cursor-pointer rounded-2xl border p-5 transition-all duration-300 ${
                  activeTab === idx
                    ? "border-emerald-500/50 bg-card shadow-xl shadow-emerald-500/5"
                    : "border-border/60 bg-card/40 hover:border-border"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs font-mono font-bold ${
                        activeTab === idx ? "text-emerald-400" : "text-muted-foreground"
                      }`}
                    >
                      {item.step}
                    </span>
                    <h3 className="text-base font-bold text-foreground">{item.title}</h3>
                  </div>
                  {activeTab === idx && (
                    <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
                  )}
                </div>

                {activeTab === idx && (
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground transition-all">
                    {item.body}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right Side: 3D Holographic Visual Card Frame */}
        <div className="lg:col-span-7 flex justify-center">
          <div className="group relative w-full max-w-lg overflow-hidden rounded-3xl border border-emerald-500/30 bg-slate-950 p-4 shadow-2xl">
            <div className="relative aspect-square overflow-hidden rounded-2xl border border-slate-800">
              <img
                src="/oneid_biometric_card.png"
                alt="OneID Holographic Card"
                className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />

              <div className="absolute bottom-6 left-6 right-6 space-y-2 rounded-2xl border border-emerald-500/40 bg-slate-900/90 p-4 backdrop-blur-md">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="size-4" /> InsightFace ArcFace Active
                  </span>
                  <span>99.86% Accuracy</span>
                </div>
                <p className="text-xs text-slate-300">
                  {STAGE_CONTENT[activeTab]?.subtitle || ""}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Interactive FAQ Accordions (Superpower Style) ── */}
      <div className="mt-24 border-t border-border/60 pt-16">
        <div className="text-center">
          <h3 className="text-3xl font-extrabold tracking-tight">Frequently Asked Questions</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Everything you need to know about OneID offline security and consent controls.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-3xl space-y-4">
          {FAQS.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl border border-border/60 bg-card/60 overflow-hidden transition-all"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="flex w-full items-center justify-between p-6 text-left font-bold text-foreground"
                >
                  <span className="text-base">{faq.q}</span>
                  <ChevronDown
                    className={`size-5 text-muted-foreground transition-transform duration-300 ${
                      isOpen ? "rotate-180 text-emerald-400" : ""
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-6 pb-6 text-xs leading-relaxed text-muted-foreground border-t border-border/40 pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
