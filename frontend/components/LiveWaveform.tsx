'use client'

export default function LiveWaveform({ bars = 6 }: { bars?: number }) {
  return (
    <div className="flex items-center gap-0.5 h-5" aria-hidden="true" role="presentation">
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className="w-0.5 rounded-full bg-green"
          style={{ animation: `arkwave 0.9s ease-in-out ${i * 0.12}s infinite alternate` }}
        />
      ))}
      <style>{`
        @keyframes arkwave {
          from { height: 4px; opacity: 0.35; }
          to   { height: 20px; opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .waveform-bar { animation: none !important; height: 10px !important; opacity: 0.6 !important; }
        }
      `}</style>
    </div>
  )
}
