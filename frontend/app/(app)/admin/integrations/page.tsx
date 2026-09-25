'use client'

const INTEGRATIONS = [
  { name: 'Airtable', description: 'Create work orders in an Airtable base', status: 'available', icon: '◈' },
  { name: 'ServiceTitan', description: 'Dispatch jobs to ServiceTitan FSM', status: 'coming-soon', icon: '⚙' },
  { name: 'Twilio', description: 'Receive real inbound phone calls', status: 'coming-soon', icon: '☎' },
  { name: 'Slack', description: 'Notify dispatchers on approval requests', status: 'available', icon: '#' },
]

export default function IntegrationsPage() {
  return (
    <div className="flex-1 flex flex-col" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      <header className="px-8 py-5 border-b border-border">
        <h1 className="text-text font-semibold text-lg">Integrations</h1>
        <p className="text-muted text-sm mt-0.5">Connect ArkOps to your existing tools</p>
      </header>
      <div className="p-8 grid grid-cols-2 gap-4 max-w-3xl">
        {INTEGRATIONS.map((i) => (
          <div key={i.name} className="bg-surface border border-border rounded-lg p-5 flex items-start gap-4">
            <span className="text-2xl text-muted font-mono">{i.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-text text-sm font-semibold">{i.name}</span>
                {i.status === 'coming-soon' && (
                  <span className="px-1.5 py-0.5 rounded text-xs bg-surface2 text-dim border border-border">
                    Soon
                  </span>
                )}
              </div>
              <p className="text-muted text-xs mt-1">{i.description}</p>
              {i.status === 'available' && (
                <button className="mt-3 text-xs text-blue hover:underline cursor-pointer">
                  Connect →
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
