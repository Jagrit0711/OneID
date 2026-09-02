import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import {
  ArrowDownRight,
  ArrowRight,
  Check,
  Fingerprint,
  LockKeyhole,
  QrCode,
  ScanLine,
  ShieldCheck,
  Sparkles,
  WalletCards,
  UserCheck,
  FolderLock,
  Eye,
} from "lucide-react";
import { OneIdLogo } from "@/components/brand/OneIdLogo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "OneID — Human-First Offline Identity & Document Vault" },
      {
        name: "description",
        content:
          "Private identity verification kiosk and citizen document locker powered by InsightFace ArcFace 512-dim AI face matching.",
      },
    ],
  }),
  component: OneIDHome,
});

const documents = [
  { title: "PAN Card", detail: "Tax identity", tag: "PAN", x: -360, y: -176, rotate: -13, tint: "saffron" },
  { title: "Driving License", detail: "Mobility proof", tag: "DL", x: 300, y: -162, rotate: 12, tint: "celadon" },
  { title: "Ration Card", detail: "Family record", tag: "RC", x: -390, y: 158, rotate: 10, tint: "blue" },
  { title: "Board Marksheet", detail: "Education proof", tag: "EDU", x: 350, y: 150, rotate: -10, tint: "rose" },
  { title: "Aadhaar Card", detail: "Primary identity", tag: "UID", x: 28, y: 256, rotate: -4, tint: "ivory" },
] as const;

const codeCells = [1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1, 0, 1];

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

function StatusPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 border border-white/12 bg-white/[0.055] px-3.5 py-1.5 text-[0.64rem] font-semibold uppercase tracking-[0.16em] text-white/80 backdrop-blur-md rounded-full">
      <span className="h-2 w-2 rounded-full bg-saffron shadow-[0_0_12px_#F4A24A] animate-pulse" />
      {children}
    </span>
  );
}

function DocumentCard({
  item,
  index,
  progress,
}: {
  item: (typeof documents)[number];
  index: number;
  progress: MotionValue<number>;
}) {
  const x = useTransform(progress, [0, 0.68, 1], [item.x, item.x * 0.07, 0]);
  const y = useTransform(progress, [0, 0.68, 1], [item.y, item.y * 0.07, 0]);
  const rotate = useTransform(progress, [0, 0.68, 1], [item.rotate, item.rotate * 0.15, 0]);
  const scale = useTransform(progress, [0, 0.74, 1], [1, 0.88, 0.68]);
  const opacity = useTransform(progress, [0, 0.8, 1], [1, 0.86, 0.16]);

  const tintClass = {
    saffron: "from-saffron/22 to-transparent",
    celadon: "from-celadon/18 to-transparent",
    blue: "from-blue-400/20 to-transparent",
    rose: "from-rose-300/17 to-transparent",
    ivory: "from-ivory/20 to-transparent",
  }[item.tint];

  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 lg:block" style={{ zIndex: 10 + index }}>
      <motion.article
        style={{ x, y, rotate, scale, opacity }}
        className="doc-card relative h-[135px] w-[230px] overflow-hidden border border-white/16 bg-[#20264A]/92 p-4 shadow-[0_25px_55px_rgba(0,0,0,0.32)] backdrop-blur-xl rounded-2xl"
      >
        <div className={`absolute inset-0 bg-gradient-to-br ${tintClass}`} />
        <div className="relative flex h-full flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="font-mono text-[0.61rem] tracking-[0.15em] text-white/50">00{index + 1} / ONEID</span>
            <span className="border border-white/16 px-1.5 py-0.5 font-mono text-[0.56rem] tracking-[0.1em] text-white/70 rounded">{item.tag}</span>
          </div>
          <div>
            <p className="font-display text-[1.25rem] leading-none tracking-[-0.04em] text-ivory">{item.title}</p>
            <p className="mt-1.5 text-[0.64rem] font-medium uppercase tracking-[0.14em] text-white/44">{item.detail}</p>
          </div>
          <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-white/45 to-transparent" />
        </div>
      </motion.article>
    </div>
  );
}

function AadhaarVaultCard({ progress }: { progress: MotionValue<number> }) {
  const scale = useTransform(progress, [0, 0.45, 1], [0.93, 1, 1.04]);
  const y = useTransform(progress, [0, 0.5, 1], [18, 0, -8]);
  const haloOpacity = useTransform(progress, [0.45, 0.78, 1], [0, 0.35, 0.9]);
  const scanY = useTransform(progress, [0.56, 0.92], [-40, 180]);

  return (
    <motion.div style={{ scale, y }} className="relative z-30 w-[290px] sm:w-[350px]">
      <motion.div style={{ opacity: haloOpacity }} className="vault-halo absolute -inset-20 -z-10 rounded-full" />
      <div className="absolute -inset-3 -z-10 border border-saffron/20 rounded-3xl" />
      <div className="absolute -inset-1.5 -z-10 border border-celadon/14 rounded-2xl" />
      <div className="relative overflow-hidden border border-ivory/28 bg-ivory p-[1px] shadow-[0_35px_85px_rgba(0,0,0,0.46)] rounded-2xl">
        <div className="relative min-h-[424px] overflow-hidden bg-[#F5F0E7] px-5 pb-5 pt-5 text-[#151A35] sm:min-h-[448px] sm:px-6 sm:pt-6 rounded-2xl">
          <div className="absolute inset-0 opacity-[0.32] [background-image:radial-gradient(rgba(17,25,54,0.3)_0.55px,transparent_0.55px)] [background-size:4px_4px]" />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[0.45rem] font-bold tracking-[0.2em] text-[#151A35]/30 [writing-mode:vertical-rl]">ONEID • IDENTITY • VAULT 01</div>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-2">
              <OneIdLogo size="sm" />
              <div>
                <p className="font-sans text-[0.55rem] font-bold uppercase tracking-[0.22em] text-[#151A35]/50">Connected Vault</p>
                <p className="font-display text-[1.2rem] leading-none tracking-[-0.04em]">OneID Identity</p>
              </div>
            </div>
            <span className="border border-[#151A35]/20 px-2 py-1 font-mono text-[0.53rem] tracking-[0.14em] text-[#151A35]/70 rounded">LIVE</span>
          </div>

          <div className="relative mt-6 flex gap-4">
            <div className="relative h-[100px] w-[78px] shrink-0 overflow-hidden rounded-xl border border-slate-700 bg-[#151A35]">
              <div className="flex size-full items-center justify-center bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-400 font-bold text-slate-950 text-xl shadow-inner">
                🇮🇳
              </div>
            </div>
            <div className="min-w-0 pt-1">
              <p className="font-sans text-[0.58rem] font-bold uppercase tracking-[0.19em] text-[#151A35]/45">Primary Cardholder</p>
              <h3 className="mt-1 font-display text-[1.75rem] leading-[0.88] tracking-[-0.065em]">Rahul Sharma</h3>
              <p className="mt-3 font-mono text-[0.62rem] tracking-[0.18em] text-[#151A35]/70">XXXX XXXX 8901</p>
              <div className="mt-3 flex items-center gap-1.5 text-[0.55rem] font-bold uppercase tracking-[0.15em] text-[#151A35]/58">
                <Check className="h-3.5 w-3.5 text-[#AE5B11]" /> Verified to OneID Vault
              </div>
            </div>
          </div>

          <div className="relative mt-7 border-y border-[#151A35]/15 py-4">
            <div className="flex items-center justify-between text-[0.56rem] font-bold uppercase tracking-[0.17em] text-[#151A35]/52">
              <span>Attached Proofs</span>
              <span>05 Secured</span>
            </div>
            <div className="mt-3 flex -space-x-2">
              {documents.map((doc, idx) => (
                <span key={doc.title} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#F5F0E7] bg-[#151A35] font-mono text-[0.55rem] text-[#F5F0E7]" style={{ zIndex: documents.length - idx }}>
                  {doc.tag.slice(0, 1)}
                </span>
              ))}
            </div>
          </div>

          <div className="relative mt-5 flex items-end justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-[0.55rem] font-bold uppercase tracking-[0.14em] text-[#151A35]/56">
                <ShieldCheck className="h-3.5 w-3.5 text-[#AE5B11]" /> Sealed in OneID
              </div>
              <p className="mt-2 max-w-[145px] text-[0.62rem] leading-relaxed text-[#151A35]/55">Document access stays strictly in your hands.</p>
            </div>
            <div aria-label="Decorative non-scannable vault pattern" className="grid w-[62px] grid-cols-5 gap-0.5 border border-[#151A35]/20 bg-[#F5F0E7] p-1.5 rounded">
              {codeCells.map((cell, index) => <span key={index} className={`aspect-square ${cell ? "bg-[#151A35]" : "bg-transparent"}`} />)}
            </div>
          </div>
          <div className="absolute bottom-1 left-0 right-0 flex justify-between px-4 font-mono text-[0.42rem] tracking-[0.16em] text-[#151A35]/36"><span>GATE / 01</span><span>VLT—ONEID</span></div>
          <motion.div style={{ y: scanY }} className="pointer-events-none absolute left-0 right-0 h-[2px] bg-saffron/75 shadow-[0_0_15px_#F4A24A]" />
        </div>
      </div>
      <div className="absolute -bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2 border border-white/10 bg-[#11162F]/90 px-4 py-2 text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-white/80 backdrop-blur-xl rounded-full">
        <Fingerprint className="h-3.5 w-3.5 text-saffron" /> Biometrically Sealed OneID Vault
      </div>
    </motion.div>
  );
}

function VaultJourney() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  const progress = useSpring(scrollYProgress, { stiffness: 75, damping: 23, restDelta: 0.001 });
  const labelOpacity = useTransform(progress, [0, 0.17, 0.45, 0.8], [1, 1, 0, 0]);
  const revealOpacity = useTransform(progress, [0.37, 0.62, 1], [0, 0, 1]);
  const orbitOpacity = useTransform(progress, [0.66, 1], [0.3, 1]);

  return (
    <section id="vault-journey" ref={sectionRef} className="relative h-[230vh] bg-ink">
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <div className="absolute inset-0 vault-grid opacity-40" />
        <motion.div style={{ opacity: orbitOpacity }} className="absolute left-1/2 top-1/2 h-[580px] w-[580px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-saffron/18 sm:h-[680px] sm:w-[680px]" />
        <motion.div style={{ opacity: orbitOpacity }} className="absolute left-1/2 top-1/2 h-[470px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-celadon/15" />
        <div className="absolute left-1/2 top-1/2 h-[560px] w-[980px] -translate-x-1/2 -translate-y-1/2 rotate-[-14deg] rounded-[50%] border border-white/[0.055]" />
        <div className="absolute left-[10%] top-[26%] hidden h-2 w-2 rounded-full bg-saffron shadow-[0_0_19px_#F4A24A] lg:block" />
        <div className="absolute right-[15%] top-[31%] hidden h-1.5 w-1.5 rounded-full bg-celadon shadow-[0_0_16px_#9DD9C5] lg:block" />

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-6 sm:p-10">
          <div className="flex items-center gap-3">
            <span className="h-px w-7 bg-saffron" />
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-white/46">The Vault in Motion</p>
          </div>
          <motion.p style={{ opacity: orbitOpacity }} className="hidden text-right text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-white/44 sm:block">05 Proofs, One Private Center</motion.p>
        </div>

        <motion.div style={{ opacity: labelOpacity }} className="pointer-events-none absolute left-6 top-1/2 z-40 max-w-[210px] -translate-y-1/2 sm:left-12 sm:max-w-[270px]">
          <p className="font-display text-[2.3rem] leading-[0.92] tracking-[-0.065em] text-ivory sm:text-[3.2rem]">Life scatters proof.</p>
          <p className="mt-5 max-w-[230px] text-sm leading-relaxed text-white/54">Your documents do not need to live in different places. Watch as scroll motion pulls them into a single center.</p>
        </motion.div>

        <div className="relative mx-auto h-[580px] w-full max-w-[1180px] sm:h-[650px]">
          {documents.map((item, index) => <DocumentCard key={item.title} item={item} index={index} progress={progress} />)}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <AadhaarVaultCard progress={progress} />
          </div>
        </div>

        <motion.div style={{ opacity: revealOpacity }} className="pointer-events-none absolute bottom-8 left-1/2 z-40 w-[min(92vw,540px)] -translate-x-1/2 text-center sm:bottom-12">
          <div className="mx-auto mb-5 h-px w-14 bg-saffron" />
          <p className="font-display text-[2rem] leading-none tracking-[-0.055em] text-ivory sm:text-[2.7rem]">One scan. A quieter life.</p>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-white/55">Your Aadhaar QR becomes the starting point—not the finish line—for all the proofs you choose to keep ready.</p>
        </motion.div>
      </div>
    </section>
  );
}

function FeatureRow({ number, title, body }: { number: string; title: string; body: string }) {
  return (
    <article className="group relative grid gap-5 border-t border-[#151A35]/12 py-8 sm:grid-cols-[72px_1fr_0.9fr] sm:gap-8 sm:py-10">
      <span className="font-mono text-xs tracking-[0.18em] text-[#151A35]/43">{number}</span>
      <div>
        <h3 className="font-display text-[2rem] leading-[0.95] tracking-[-0.055em] sm:text-[2.25rem]">{title}</h3>
      </div>
      <p className="max-w-sm self-end text-sm leading-7 text-[#151A35]/63">{body}</p>
    </article>
  );
}

function OneIDHome() {
  const [isPortraitKiosk, setIsPortraitKiosk] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const kioskParam = params.get("kiosk");
    const savedPortrait =
      localStorage.getItem("oneid_portrait_kiosk") === "true" ||
      kioskParam === "portrait";

    if (savedPortrait) {
      setIsPortraitKiosk(true);
      document.documentElement.classList.add("kiosk-mode-active");
    }
  }, []);

  const togglePortraitKiosk = () => {
    const next = !isPortraitKiosk;
    setIsPortraitKiosk(next);
    localStorage.setItem("oneid_portrait_kiosk", String(next));
    if (next) {
      document.documentElement.classList.add("kiosk-mode-active");
    } else {
      document.documentElement.classList.remove("kiosk-mode-active");
    }
  };

  // ── Dedicated Portrait Kiosk Mode View ──
  if (isPortraitKiosk) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-between bg-ink px-6 py-8 text-white select-none text-center">
        {/* Top Header */}
        <div className="w-full flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase">
              Portrait Kiosk Terminal Active
            </span>
          </div>
          <button
            type="button"
            onClick={togglePortraitKiosk}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/20"
          >
            Full Site
          </button>
        </div>

        {/* Center Content: Logo & Big Login Buttons */}
        <div className="my-auto w-full max-w-sm space-y-8 py-6">
          <div className="flex flex-col items-center justify-center gap-2">
            <OneIdLogo size="xl" />
            <h1 className="mt-2 font-display text-3xl text-ivory">OneID Kiosk</h1>
            <p className="text-xs text-white/60">Select your portal to begin biometric verification</p>
          </div>

          <div className="space-y-4 pt-2">
            {/* Button 1: Citizen Login */}
            <Link
              to="/user"
              className="group flex w-full items-center justify-between rounded-3xl border border-teal-500/40 bg-gradient-to-r from-teal-950/80 via-slate-900 to-slate-900 p-5 shadow-xl hover:border-teal-400 active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-4 text-left">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-teal-500/20 text-teal-300 ring-1 ring-teal-500/30">
                  <FolderLock className="size-7" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-ivory">Citizen Login</h2>
                  <p className="text-xs text-white/60">Document Locker &amp; Permissions</p>
                </div>
              </div>
              <ArrowRight className="size-6 text-teal-400 transition-transform group-hover:translate-x-1" />
            </Link>

            {/* Button 2: Official Login */}
            <Link
              to="/official"
              className="group flex w-full items-center justify-between rounded-3xl border border-saffron/40 bg-gradient-to-r from-amber-950/80 via-slate-900 to-slate-900 p-5 shadow-xl hover:border-saffron active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-4 text-left">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-saffron/20 text-saffron ring-1 ring-saffron/30">
                  <UserCheck className="size-7" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-ivory">Official Login</h2>
                  <p className="text-xs text-white/60">Verification Terminal &amp; Logs</p>
                </div>
              </div>
              <ArrowRight className="size-6 text-saffron transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>

        {/* Footer info */}
        <div className="w-full border-t border-white/10 pt-4 text-[10px] text-white/40">
          100% Offline &amp; Privacy-First Biometric Identity Terminal
        </div>
      </main>
    );
  }

  return (
    <main id="top" className="overflow-x-clip bg-ink text-white select-none">
      {/* ── Header ── */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.075] bg-ink/72 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-6xl items-center justify-between px-6 sm:h-[84px]">
          <Link to="/" className="group flex items-center">
            <OneIdLogo size="md" />
          </Link>

          <nav className="hidden items-center gap-7 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-white/57 md:flex" aria-label="Primary navigation">
            <button type="button" onClick={() => scrollTo("vault-journey")} className="transition-colors hover:text-ivory">The Orbit</button>
            <button type="button" onClick={() => scrollTo("portals")} className="transition-colors hover:text-ivory">Portals</button>
            <button type="button" onClick={() => scrollTo("how-it-works")} className="transition-colors hover:text-ivory">How It Works</button>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              to="/super"
              className="inline-flex items-center gap-1.5 rounded-xl border border-violet-500/40 bg-violet-500/15 px-3 py-2 text-[0.6rem] font-bold uppercase tracking-[0.15em] text-violet-300 transition-all hover:bg-violet-500/25 active:scale-[0.97]"
            >
              Super Admin
            </Link>
            <Link
              to="/kiosk"
              className="inline-flex items-center gap-2 rounded-xl border border-white/18 bg-white/[0.07] px-4 py-2.5 text-[0.6rem] font-bold uppercase tracking-[0.15em] text-ivory transition-all duration-200 hover:border-saffron hover:bg-saffron hover:text-ink active:scale-[0.97]"
            >
              Kiosk Terminal <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <section className="relative flex min-h-screen items-end overflow-hidden pb-12 pt-28 sm:pb-16 sm:pt-32">
        <div className="hero-shade absolute inset-0" />
        <div className="vault-grid absolute inset-0 opacity-40" />

        <div className="relative z-10 mx-auto max-w-6xl w-full px-6">
          <div className="max-w-[760px]">
            <StatusPill>100% Offline Biometric Identity Kiosk</StatusPill>

            <h1 className="mt-7 font-display text-[clamp(3.8rem,9vw,8rem)] leading-[0.82] tracking-[-0.075em] text-ivory">
              Everything <em className="font-display font-normal text-saffron">you prove.</em><br />
              One place to <span className="relative inline-block">keep it.<span className="absolute -bottom-2 left-[6%] h-px w-[86%] bg-celadon/80" /></span>
            </h1>

            <p className="mt-8 max-w-[480px] text-base leading-7 text-white/64 sm:text-lg">
              OneID brings your Aadhaar QR, PAN Card, Driving License, Ration Card, and Marksheets into one personal, offline-first biometric vault.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                to="/kiosk"
                className="group inline-flex items-center gap-3 bg-saffron px-6 py-4 text-[0.64rem] font-bold uppercase tracking-[0.16em] text-ink transition-colors hover:bg-ivory active:scale-[0.97] rounded-xl shadow-lg"
              >
                Kiosk Terminal <ScanLine className="h-4 w-4" />
              </Link>
              <Link
                to="/consumer"
                className="group inline-flex items-center gap-3 border border-white/20 bg-white/[0.06] px-6 py-4 text-[0.64rem] font-bold uppercase tracking-[0.16em] text-ivory transition-colors hover:bg-white/10 active:scale-[0.97] rounded-xl"
              >
                Citizen App <FolderLock className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-saffron/60 to-transparent" />
      </section>

      {/* ── 3D Card Orbit Convergence Journey ── */}
      <VaultJourney />

      {/* ── Portal Cards Section ── */}
      <section id="portals" className="relative border-t border-white/10 bg-[#172044] px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <StatusPill>Four-Portal Architecture</StatusPill>
            <h2 className="mt-6 font-display text-[clamp(2.8rem,5vw,4.5rem)] leading-[0.88] text-ivory">
              Choose your entry point.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-white/60">
              Authenticated via live Aadhaar QR decoding and InsightFace ArcFace 512-dim neural face checks.
            </p>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
            {/* Kiosk Terminal */}
            <div className="relative flex flex-col justify-between rounded-3xl border border-saffron/30 bg-gradient-to-br from-amber-950/60 via-slate-900/90 to-slate-900/90 p-8 shadow-2xl">
              <div>
                <span className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-saffron">For Verifying Officers · Physical Terminal</span>
                <h3 className="mt-3 font-display text-3xl text-ivory">Kiosk Terminal</h3>
                <p className="mt-3 text-sm text-white/60 leading-relaxed">
                  Official logs in with Aadhaar + face. Scans citizens, selects documents, gates additional doc access behind citizen face scan. Auto-resets after each session.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {["Official Aadhaar Login", "Citizen QR Scan", "Doc Selection", "Face Gate", "Auto-Reset"].map((tag) => (
                    <span key={tag} className="rounded-full border border-saffron/30 bg-saffron/10 px-2.5 py-0.5 text-[0.58rem] font-semibold text-saffron/80">{tag}</span>
                  ))}
                </div>
              </div>
              <div className="mt-8">
                <Link to="/kiosk" className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-saffron font-bold text-ink hover:bg-amber-400 transition-all active:scale-[0.98]">
                  Enter Kiosk Terminal <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>

            {/* Consumer App */}
            <div className="relative flex flex-col justify-between rounded-3xl border border-celadon/30 bg-gradient-to-br from-teal-950/60 via-slate-900/90 to-slate-900/90 p-8 shadow-2xl">
              <div>
                <span className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-celadon">For Citizens · Personal App</span>
                <h3 className="mt-3 font-display text-3xl text-ivory">Consumer App</h3>
                <p className="mt-3 text-sm text-white/60 leading-relaxed">
                  Log in with Aadhaar QR + face. Upload PAN, DL, Ration Card, Marksheets in JP2 format. Control verifier permissions. See who accessed your data and when.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {["Document Vault", "JP2 Format", "Access Log", "Permission Toggles", "Privacy First"].map((tag) => (
                    <span key={tag} className="rounded-full border border-celadon/30 bg-celadon/10 px-2.5 py-0.5 text-[0.58rem] font-semibold text-celadon/80">{tag}</span>
                  ))}
                </div>
              </div>
              <div className="mt-8">
                <Link to="/consumer" className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-celadon/40 bg-celadon/10 font-bold text-ivory hover:bg-celadon/20 transition-all active:scale-[0.98]">
                  Enter Consumer App <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>

            {/* Super-Official */}
            <div className="relative flex flex-col justify-between rounded-3xl border border-violet-500/30 bg-gradient-to-br from-violet-950/60 via-slate-900/90 to-slate-900/90 p-8 shadow-2xl">
              <div>
                <span className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-violet-400">For Administrators · Command Center</span>
                <h3 className="mt-3 font-display text-3xl text-ivory">Super-Official Dashboard</h3>
                <p className="mt-3 text-sm text-white/60 leading-relaxed">
                  Global audit logs across all sessions. Citizen lookup with full access history. Official management, enable/disable officials, record updates and live stats.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {["Global Audit", "Citizen Lookup", "Official Mgmt", "PIN Auth", "Live Stats"].map((tag) => (
                    <span key={tag} className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-0.5 text-[0.58rem] font-semibold text-violet-400/80">{tag}</span>
                  ))}
                </div>
              </div>
              <div className="mt-8">
                <Link to="/super" className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-violet-500/40 bg-violet-500/10 font-bold text-ivory hover:bg-violet-500/20 transition-all active:scale-[0.98]">
                  Enter Super-Official <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>

            {/* Legacy portals */}
            <div className="relative flex flex-col justify-between rounded-3xl border border-white/10 bg-slate-900/60 p-8 shadow-xl">
              <div>
                <span className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-white/40">Legacy · Previous Version</span>
                <h3 className="mt-3 font-display text-2xl text-white/60">Original Portals</h3>
                <p className="mt-3 text-sm text-white/40 leading-relaxed">
                  Previous official &amp; citizen portals (v1). Still accessible for reference.
                </p>
              </div>
              <div className="mt-8 flex gap-3">
                <Link to="/official" className="flex-1 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.05] text-sm font-semibold text-white/50 hover:bg-white/10 transition-all active:scale-[0.98]">
                  Official (v1)
                </Link>
                <Link to="/user" className="flex-1 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.05] text-sm font-semibold text-white/50 hover:bg-white/10 transition-all active:scale-[0.98]">
                  Citizen (v1)
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="relative overflow-hidden bg-ivory px-6 py-24 text-ink sm:py-32">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-24">
            <div>
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-[#AE5B11]">A story in three moves</p>
              <h2 className="mt-6 max-w-md font-display text-[clamp(3rem,5vw,5rem)] leading-[0.84] tracking-[-0.075em]">The simple way to keep your proof close.</h2>
              <p className="mt-7 max-w-md text-[0.98rem] leading-7 text-[#151A35]/62">OneID is designed around an everyday truth: your documents should support your life, not interrupt it.</p>
            </div>
            <div>
              <FeatureRow number="01" title="Begin with your Aadhaar QR." body="Scan your Aadhaar QR as the starting point. You choose what to link and what remains separate." />
              <FeatureRow number="02" title="Bring the right proofs together." body="PAN card, Driving License, Ration card, Marksheets—the documents you rely on live in a calm, organized view." />
              <FeatureRow number="03" title="Biometric Face Verification." body="InsightFace ArcFace 512-dim neural matching unlocks selected permitted documents safely on device." />
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.08] bg-ink px-6 py-8">
        <div className="mx-auto max-w-6xl flex flex-col justify-between gap-5 text-[0.61rem] font-semibold uppercase tracking-[0.15em] text-white/38 sm:flex-row sm:items-center">
          <Link to="/" className="flex items-center">
            <OneIdLogo size="sm" />
          </Link>
          <p>© 2026 OneID. 100% Offline &amp; Privacy First.</p>
        </div>
      </footer>
    </main>
  );
}
