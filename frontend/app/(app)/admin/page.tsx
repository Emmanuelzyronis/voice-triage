'use client'

import { useState } from 'react'
import { useOrganization } from '@clerk/nextjs'

type Tab = 'intake' | 'categories' | 'hours' | 'voice' | 'integrations'

const TABS: { id: Tab; label: string }[] = [
  { id: 'intake',       label: 'Intake Flow'    },
  { id: 'categories',   label: 'Categories'     },
  { id: 'hours',        label: 'Business Hours' },
  { id: 'voice',        label: 'Voice'          },
  { id: 'integrations', label: 'Integrations'   },
]

const VOICES = ['nova', 'alloy', 'echo', 'fable', 'onyx', 'shimmer']
const DAYS   = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const DEFAULT_CATEGORIES = [
  { name: 'Emergency',         priority: 1, approval: 'human_required', color: 'text-red'   },
  { name: 'Standard Service',  priority: 2, approval: 'human_required', color: 'text-accent'},
  { name: 'Information Request', priority: 3, approval: 'auto_approve',  color: 'text-blue' },
  { name: 'Scheduling',        priority: 4, approval: 'auto_approve',   color: 'text-green' },
]

function IntakeTab() {
  const [greeting, setGreeting] = useState('Thank you for calling. How can I help you today?')
  const [fields, setFields]     = useState(['equipment_type', 'location'])
  const [maxTurns, setMaxTurns] = useState(6)
  const [saved, setSaved]       = useState(false)

  const save = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <div>
        <label className="label">Greeting message</label>
        <textarea
          value={greeting}
          onChange={e => setGreeting(e.target.value)}
          rows={2}
          className="input resize-none mt-1"
        />
        <p className="text-xs text-dim mt-1">Spoken as the first thing callers hear.</p>
      </div>

      <div>
        <label className="label">Required fields</label>
        <div className="flex flex-col gap-2 mt-2">
          {fields.map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={f}
                onChange={e => setFields(ff => ff.map((v, j) => j === i ? e.target.value : v))}
                className="input flex-1 font-mono text-xs"
              />
              <button
                onClick={() => setFields(ff => ff.filter((_, j) => j !== i))}
                className="text-dim hover:text-red transition-colors min-h-[36px] px-2 cursor-pointer"
                aria-label="Remove field"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={() => setFields(ff => [...ff, ''])}
          className="mt-2 text-xs text-blue hover:underline cursor-pointer"
        >
          + Add field
        </button>
      </div>

      <div>
        <label className="label">Max conversation turns</label>
        <input
          type="number"
          min={1}
          max={12}
          value={maxTurns}
          onChange={e => setMaxTurns(Number(e.target.value))}
          className="input w-24 mt-1"
        />
        <p className="text-xs text-dim mt-1">Agent completes intake after this many user turns.</p>
      </div>

      <button
        onClick={save}
        className="self-start min-h-[44px] px-6 py-2 rounded bg-blue text-bg text-sm font-semibold hover:bg-blue/80 transition-colors cursor-pointer"
      >
        {saved ? '✓ Saved' : 'Save'}
      </button>
    </div>
  )
}

function CategoriesTab() {
  const [cats, setCats] = useState(DEFAULT_CATEGORIES)

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <p className="text-xs text-dim">
        Categories map to approval rules. Calls are classified into one of these after the conversation completes.
      </p>
      <div className="flex flex-col gap-3">
        {cats.map((cat, i) => (
          <div key={i} className="panel flex items-center gap-4">
            <span className={`text-[10px] font-mono font-bold w-4 shrink-0 ${cat.color}`}>{cat.priority}</span>
            <input
              value={cat.name}
              onChange={e => setCats(cc => cc.map((c, j) => j === i ? { ...c, name: e.target.value } : c))}
              className="input flex-1 text-sm"
            />
            <select
              value={cat.approval}
              onChange={e => setCats(cc => cc.map((c, j) => j === i ? { ...c, approval: e.target.value } : c))}
              className="input w-40 text-xs"
            >
              <option value="human_required">Human required</option>
              <option value="auto_approve">Auto approve</option>
            </select>
          </div>
        ))}
      </div>
      <button
        onClick={() => setCats(cc => [...cc, { name: 'New Category', priority: cc.length + 1, approval: 'human_required', color: 'text-muted' }])}
        className="self-start text-xs text-blue hover:underline cursor-pointer"
      >
        + Add category
      </button>
    </div>
  )
}

function HoursTab() {
  const [openHour, setOpenHour]   = useState(7)
  const [closeHour, setCloseHour] = useState(19)
  const [days, setDays]           = useState([0, 1, 2, 3, 4, 5]) // Mon–Sat
  const [emergency, setEmergency] = useState(true)
  const [saved, setSaved]         = useState(false)

  const toggleDay = (i: number) =>
    setDays(dd => dd.includes(i) ? dd.filter(d => d !== i) : [...dd, i].sort())

  const fmt = (h: number) => {
    const suffix = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 === 0 ? 12 : h % 12
    return `${h12}:00 ${suffix}`
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <div>
        <label className="label mb-2 block">Open days</label>
        <div className="flex gap-2 flex-wrap">
          {DAYS.map((d, i) => (
            <button
              key={d}
              onClick={() => toggleDay(i)}
              className={`px-3 py-1.5 rounded border text-xs font-medium transition-colors cursor-pointer min-h-[36px] ${
                days.includes(i)
                  ? 'bg-blue border-blue text-bg'
                  : 'bg-surface2 border-border text-muted hover:border-border-strong'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-6">
        <div>
          <label className="label">Open time</label>
          <div className="flex items-center gap-2 mt-1">
            <input type="range" min={0} max={23} value={openHour} onChange={e => setOpenHour(Number(e.target.value))} className="w-32 accent-blue" />
            <span className="text-sm text-text font-mono w-16">{fmt(openHour)}</span>
          </div>
        </div>
        <div>
          <label className="label">Close time</label>
          <div className="flex items-center gap-2 mt-1">
            <input type="range" min={0} max={23} value={closeHour} onChange={e => setCloseHour(Number(e.target.value))} className="w-32 accent-blue" />
            <span className="text-sm text-text font-mono w-16">{fmt(closeHour)}</span>
          </div>
        </div>
      </div>

      <label className="flex items-center gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={emergency}
          onChange={e => setEmergency(e.target.checked)}
          className="w-4 h-4 accent-blue"
        />
        <span className="text-sm text-text">24/7 emergency line (callers outside business hours still reach the voice agent)</span>
      </label>

      <button
        onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000) }}
        className="self-start min-h-[44px] px-6 py-2 rounded bg-blue text-bg text-sm font-semibold hover:bg-blue/80 transition-colors cursor-pointer"
      >
        {saved ? '✓ Saved' : 'Save'}
      </button>
    </div>
  )
}

function VoiceTab() {
  const [voice, setVoice]   = useState('nova')
  const [rate, setRate]     = useState(1.0)
  const [saved, setSaved]   = useState(false)

  return (
    <div className="flex flex-col gap-6 max-w-md">
      <div>
        <label className="label">Voice</label>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {VOICES.map(v => (
            <button
              key={v}
              onClick={() => setVoice(v)}
              className={`px-3 py-2.5 rounded border text-sm font-medium transition-colors cursor-pointer min-h-[44px] ${
                voice === v
                  ? 'bg-blue border-blue text-bg'
                  : 'bg-surface2 border-border text-muted hover:border-border-strong hover:text-text'
              }`}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        <p className="text-xs text-dim mt-2">All voices powered by Azure OpenAI gpt-4o-mini-tts.</p>
      </div>

      <div>
        <label className="label">Speaking rate</label>
        <div className="flex items-center gap-3 mt-1">
          <input type="range" min={0.7} max={1.5} step={0.05} value={rate} onChange={e => setRate(Number(e.target.value))} className="w-48 accent-blue" />
          <span className="text-sm font-mono text-text w-10">{rate.toFixed(2)}x</span>
        </div>
      </div>

      <button
        onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000) }}
        className="self-start min-h-[44px] px-6 py-2 rounded bg-blue text-bg text-sm font-semibold hover:bg-blue/80 transition-colors cursor-pointer"
      >
        {saved ? '✓ Saved' : 'Save'}
      </button>
    </div>
  )
}

function IntegrationsTab() {
  return (
    <div className="flex flex-col gap-4 max-w-lg">
      {[
        { name: 'Webhook',   desc: 'POST approved call data to your own endpoint',       status: 'available' },
        { name: 'Airtable',  desc: 'Create records in an Airtable base automatically',   status: 'coming_soon' },
        { name: 'ServiceTitan', desc: 'Create work orders in ServiceTitan',              status: 'coming_soon' },
        { name: 'Slack',     desc: 'Send approval notifications to a Slack channel',     status: 'coming_soon' },
      ].map(({ name, desc, status }) => (
        <div key={name} className="panel flex items-center gap-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-text">{name}</p>
            <p className="text-xs text-dim mt-0.5">{desc}</p>
          </div>
          {status === 'available' ? (
            <button className="min-h-[36px] px-4 py-1.5 text-xs font-semibold rounded bg-blue/10 text-blue border border-blue/25 hover:bg-blue hover:text-bg transition-colors cursor-pointer">
              Configure
            </button>
          ) : (
            <span className="text-[10px] font-mono text-dim border border-border rounded px-2 py-1">Soon</span>
          )}
        </div>
      ))}
    </div>
  )
}

const TAB_CONTENT: Record<Tab, React.ReactNode> = {
  intake:       <IntakeTab />,
  categories:   <CategoriesTab />,
  hours:        <HoursTab />,
  voice:        <VoiceTab />,
  integrations: <IntegrationsTab />,
}

export default function AdminPage() {
  const { organization } = useOrganization()
  const [tab, setTab] = useState<Tab>('intake')

  return (
    <div className="flex-1 flex flex-col" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      <header className="px-8 py-5 border-b border-border shrink-0">
        <h1 className="text-text font-semibold">Configure</h1>
        <p className="text-muted text-sm mt-0.5">
          {organization?.name ?? 'Your organization'}
        </p>
      </header>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tab bar */}
        <div className="flex gap-1 px-6 pt-4 border-b border-border shrink-0">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium rounded-t border-b-2 transition-colors cursor-pointer -mb-px ${
                tab === t.id
                  ? 'border-blue text-blue bg-surface2'
                  : 'border-transparent text-muted hover:text-text'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-6">
          {TAB_CONTENT[tab]}
        </div>
      </div>
    </div>
  )
}
