import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg text-text flex flex-col" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      <header className="px-6 py-4 border-b border-border flex items-center justify-between max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-blue flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-bg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="font-bold text-sm tracking-tight">ArkOps</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/sign-in" className="text-sm text-muted hover:text-text transition-colors cursor-pointer">
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="text-sm bg-blue text-bg px-4 py-2 rounded-md font-semibold hover:bg-blue/90 transition-colors cursor-pointer"
          >
            Get started
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center max-w-3xl mx-auto w-full gap-8">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-surface text-xs text-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
          AssemblyAI Voice Agent Hackathon — actively building
        </div>

        <h1 className="text-5xl font-bold text-text leading-tight">
          Voice intake.<br />
          <span className="text-blue">Human approval.</span><br />
          Any vertical.
        </h1>

        <p className="text-muted text-lg max-w-xl">
          ArkOps runs a conversational voice agent that gathers service requests,
          processes them through an AI pipeline, and routes to a human dispatcher
          for one-click approval before executing — for any industry.
        </p>

        <div className="flex items-center gap-4">
          <Link
            href="/sign-up"
            className="px-6 py-3 bg-blue text-bg rounded-lg font-semibold text-sm hover:bg-blue/90 transition-colors cursor-pointer"
          >
            Start free →
          </Link>
          <Link
            href="https://github.com/Emmanuelzyronis/voice-triage"
            target="_blank"
            className="px-6 py-3 bg-surface border border-border text-text rounded-lg font-semibold text-sm hover:bg-surface2 transition-colors cursor-pointer"
          >
            GitHub
          </Link>
        </div>

        <div className="flex flex-wrap justify-center gap-3 text-xs text-dim pt-4">
          {['HVAC Dispatch', 'Property Maintenance', 'Medical Triage', 'Legal Intake', 'Any Vertical'].map((v) => (
            <span key={v} className="px-3 py-1.5 rounded-full border border-border bg-surface">{v}</span>
          ))}
        </div>
      </main>
    </div>
  )
}
