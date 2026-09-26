import Link from 'next/link'

const FEATURES = [
  {
    title: 'Real-time voice intake',
    desc: 'AssemblyAI universal-3-5-pro streaming. Callers speak naturally — no IVR trees, no hold music.',
    icon: (
      <svg className="w-4 h-4 text-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M12 2a3 3 0 013 3v7a3 3 0 01-6 0V5a3 3 0 013-3z" />
        <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v3M8 22h8" />
      </svg>
    ),
  },
  {
    title: '8-stage AI pipeline',
    desc: 'LangGraph orchestrates listen → classify → understand → draft → approve in under 3 seconds.',
    icon: (
      <svg className="w-4 h-4 text-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
        <path d="M7 12h3M14 12h3" />
      </svg>
    ),
  },
  {
    title: 'Human approval gate',
    desc: 'Every action holds for dispatcher sign-off. One-click approve or reject before anything executes.',
    icon: (
      <svg className="w-4 h-4 text-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
      </svg>
    ),
  },
  {
    title: 'Multi-tenant by default',
    desc: 'Clerk organizations = separate workspaces. Each tenant gets their own intake URL and queue.',
    icon: (
      <svg className="w-4 h-4 text-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3" />
      </svg>
    ),
  },
  {
    title: 'Configurable per vertical',
    desc: 'Custom categories, business hours, voice, and approval rules per org — zero code changes needed.',
    icon: (
      <svg className="w-4 h-4 text-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M4 6h16M4 12h10M4 18h6" /><circle cx="19" cy="12" r="2" /><circle cx="14" cy="18" r="2" />
      </svg>
    ),
  },
  {
    title: 'Webhook integrations',
    desc: 'POST approved call data to ServiceTitan, Airtable, Slack, or any custom endpoint.',
    icon: (
      <svg className="w-4 h-4 text-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
      </svg>
    ),
  },
]

const PIPELINE_STAGES = [
  { label: 'LISTEN', state: 'done' },
  { label: 'CLASSIFY', state: 'done' },
  { label: 'UNDERSTAND', state: 'done' },
  { label: 'DRAFT', state: 'done' },
  { label: 'REVIEW', state: 'done' },
  { label: 'APPROVE', state: 'active' },
  { label: 'EXECUTE', state: 'pending' },
  { label: 'LOG', state: 'pending' },
] as const

export default function LandingPage() {
  return (
    <div
      className="min-h-screen bg-bg text-text flex flex-col"
      style={{
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        backgroundImage:
          'radial-gradient(ellipse 100% 60% at 15% 25%, rgba(59,130,246,0.07) 0%, transparent 65%), radial-gradient(ellipse 70% 50% at 85% 75%, rgba(99,102,241,0.05) 0%, transparent 65%)',
      }}
    >
      {/* ── Sticky header ───────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50 border-b border-border/60"
        style={{
          backdropFilter: 'blur(16px) saturate(160%)',
          WebkitBackdropFilter: 'blur(16px) saturate(160%)',
          background: 'rgba(10, 13, 20, 0.82)',
        }}
      >
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg gradient-brand flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="font-bold text-sm tracking-tight">ArkOps</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/sign-in" className="text-sm text-muted hover:text-text transition-colors px-3 py-2 rounded-lg">
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="text-sm px-4 py-2.5 rounded-lg font-semibold text-white transition-all"
              style={{
                background: 'linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)',
                boxShadow: '0 4px 16px rgba(59,130,246,0.3)',
              }}
            >
              Get started →
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center px-6 py-24 text-center relative overflow-hidden">
        {/* Background orb */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)', filter: 'blur(40px)' }}
          aria-hidden
        />

        <div className="relative max-w-3xl mx-auto flex flex-col items-center gap-6">
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs text-muted border"
            style={{ borderColor: 'rgba(59,130,246,0.2)', background: 'rgba(59,130,246,0.05)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
            AssemblyAI Voice Agent Hackathon — live build
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl font-extrabold leading-[1.05] tracking-tight">
            Voice intake.<br />
            <span className="text-gradient">Human approval.</span>
          </h1>

          <p className="text-lg text-muted leading-relaxed max-w-xl">
            An AI voice agent that gathers service requests, runs them through an 8-stage pipeline,
            and holds for human dispatcher approval before any action executes — for every regulated vertical.
          </p>

          {/* CTAs */}
          <div className="flex items-center gap-3 pt-2">
            <Link
              href="/sign-up"
              className="px-6 py-3 rounded-xl font-semibold text-sm text-white transition-all"
              style={{
                background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
                boxShadow: '0 4px 20px rgba(59,130,246,0.35)',
              }}
            >
              Start for free →
            </Link>
            <Link
              href="/demo"
              className="px-6 py-3 rounded-xl font-semibold text-sm text-text border border-border hover:border-border-strong hover:bg-surface transition-colors"
            >
              View demo
            </Link>
          </div>

          {/* Pipeline visualization */}
          <div
            className="w-full mt-10 rounded-xl border border-border/60 overflow-hidden animate-entrance"
            style={{ background: 'rgba(17,24,39,0.85)', boxShadow: '0 8px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset' }}
          >
            <div className="px-5 py-3 border-b border-border/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red animate-pulse" />
                <span className="text-xs font-mono text-muted">pipeline.active</span>
              </div>
              <span className="text-xs font-mono text-dim">apex-field-services</span>
            </div>
            <div className="p-5 flex items-center gap-1.5 overflow-x-auto">
              {PIPELINE_STAGES.map((stage, i) => (
                <div key={stage.label} className="flex items-center gap-1.5 shrink-0">
                  <div
                    className={`px-2.5 py-1.5 rounded text-[10px] font-mono font-semibold border transition-colors ${
                      stage.state === 'done'
                        ? 'border-green/20 bg-green/5 text-green'
                        : stage.state === 'active'
                          ? 'border-accent/40 bg-accent/10 text-accent'
                          : 'border-border bg-transparent text-dim'
                    }`}
                  >
                    {stage.label}
                  </div>
                  {i < PIPELINE_STAGES.length - 1 && (
                    <svg className="w-3 h-3 text-dim shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
            {/* Status bar */}
            <div className="px-5 py-3 border-t border-border/40 flex items-center gap-4 bg-surface/30">
              <span className="flex items-center gap-1.5 text-[11px] text-dim">
                <span className="w-1 h-1 rounded-full bg-green" />
                HVAC compressor failure — 2901 Oak Ave
              </span>
              <span className="ml-auto flex items-center gap-1.5 text-[11px] font-mono text-accent font-semibold">
                Awaiting dispatcher approval
              </span>
            </div>
          </div>

          {/* Verticals */}
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {['Field Service', 'Healthcare', 'Property Mgmt', 'Legal Intake', 'Any Vertical'].map(v => (
              <span
                key={v}
                className="px-3 py-1.5 rounded-full border border-border/50 bg-surface/30 text-xs text-dim"
              >
                {v}
              </span>
            ))}
          </div>
        </div>
      </main>

      {/* ── Features ────────────────────────────────────────────────────────── */}
      <section className="border-t border-border/50 px-6 py-16">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-xs font-mono uppercase tracking-widest text-dim mb-10">Platform capabilities</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {FEATURES.map(f => (
              <div
                key={f.title}
                className="panel group cursor-default transition-all duration-200 hover:border-blue/20"
                style={{ willChange: 'border-color' }}
              >
                <div className="w-8 h-8 rounded-lg bg-surface2 border border-border flex items-center justify-center mb-4 group-hover:border-blue/20 transition-colors">
                  {f.icon}
                </div>
                <h3 className="text-sm font-semibold text-text mb-1.5">{f.title}</h3>
                <p className="text-xs text-dim leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border/40 px-6 py-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md gradient-brand flex items-center justify-center">
              <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-muted">ArkOps</span>
          </div>
          <p className="text-xs text-dim">Built for the AssemblyAI Voice Agent Hackathon · Sep 2026</p>
        </div>
      </footer>
    </div>
  )
}
