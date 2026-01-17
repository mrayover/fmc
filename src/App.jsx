import { useMemo, useState } from "react"

import events from "./data/events.json"
import venues from "./data/venues.json"
import partners from "./data/partners.json"

const NAV_ITEMS = [
  { key: "home", label: "Home" },
  { key: "venues", label: "Venues" },
  { key: "partners", label: "Partners" },
  { key: "about", label: "About" },
  // Dev Tools is conditionally added below
]
function formatDateLabel(yyyyMmDd) {
  // Keep it boring: local date label, no external libs.
  const [y, m, d] = yyyyMmDd.split("-").map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

function groupEventsByDate(eventList) {
  const groups = new Map()
  for (const e of eventList) {
    if (!groups.has(e.date)) groups.set(e.date, [])
    groups.get(e.date).push(e)
  }

  // Sort dates ascending
  const dates = Array.from(groups.keys()).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))

  // Sort events within a date by time string (best-effort)
  for (const date of dates) {
    groups.get(date).sort((a, b) => String(a.time || "").localeCompare(String(b.time || "")))
  }

  return dates.map((date) => ({ date, events: groups.get(date) }))
}

function getVenueById(id) {
  return venues.find((v) => v.id === id) || null
}

function getPartnerById(id) {
  return partners.find((p) => p.id === id) || null
}
function DateGroup({ date, children }) {
  return (
    <section className="space-y-2">
      <div className="sticky top-0 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <h3 className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1 text-sm font-medium">
          {formatDateLabel(date)}
        </h3>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

function EventCard({ event }) {
  const venue = getVenueById(event.venueId)
  const href = event.link || venue?.link || null

  return (
    <article className="rounded-xl border border-neutral-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="font-semibold leading-snug">{event.title}</h4>
          <div className="mt-1 text-sm text-neutral-700">
            <span className="font-medium">{event.time || "Time TBA"}</span>
            {" · "}
            <span>{venue?.name || "Venue TBA"}</span>
          </div>
        </div>

        {href ? (
          <a
            className="shrink-0 rounded-full border border-neutral-200 px-3 py-1.5 text-sm hover:bg-neutral-50"
            href={href}
            target="_blank"
            rel="noreferrer"
          >
            Link
          </a>
        ) : null}
      </div>

      {event.flyer ? (
        <div className="mt-3 overflow-hidden rounded-lg border border-neutral-200">
          {href ? (
            <a href={href} target="_blank" rel="noreferrer">
              <img
                src={event.flyer}
                alt={`${event.title} flyer`}
                className="block w-full max-h-[420px] object-contain bg-neutral-100"
                loading="lazy"
              />
            </a>
          ) : (
            <img
              src={event.flyer}
              alt={`${event.title} flyer`}
              className="block w-full max-h-[420px] object-contain bg-neutral-100"
              loading="lazy"
            />
          )}
        </div>
      ) : null}
    </article>
  )
}

function NavButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full px-3 py-1.5 text-sm",
        "border border-neutral-200",
        active ? "bg-neutral-900 text-white" : "bg-white text-neutral-900",
      ].join(" ")}
    >
      {children}
    </button>
  )
}

function Shell({ activeTab, setActiveTab, children }) {
  const navItems = useMemo(() => {
    const items = [...NAV_ITEMS]
    if (import.meta.env.DEV) items.push({ key: "dev", label: "Dev Tools" })
    return items
  }, [])

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <header className="border-b border-neutral-200">
        <div className="mx-auto max-w-xl px-4 py-4">
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="text-xl font-semibold tracking-tight">
              Fresno Music Calendar
            </h1>
            <div className="text-xs text-neutral-500">
              Fresno, CA
            </div>
          </div>

          <nav className="mt-3 flex flex-wrap gap-2">
            {navItems.map((item) => (
              <NavButton
                key={item.key}
                active={activeTab === item.key}
                onClick={() => setActiveTab(item.key)}
              >
                {item.label}
              </NavButton>
            ))}
          </nav>
        </div>
      </header>

      <main>
        <div className="mx-auto max-w-xl px-4 py-6">{children}</div>
      </main>

      <footer className="border-t border-neutral-200">
        <div className="mx-auto max-w-xl px-4 py-5 text-sm text-neutral-600">
          <p>
            Send show info or a flyer:{" "}
            <a className="underline" href="mailto:YOUR_EMAIL_HERE">
              YOUR_EMAIL_HERE
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
}

function HomeView({ filter }) {
  const filteredEvents = useMemo(() => {
    let list = events

    if (filter?.type === "venue" && filter?.id) {
      list = list.filter((e) => e.venueId === filter.id)
    }

    if (filter?.type === "partner" && filter?.id) {
      list = list.filter((e) => Array.isArray(e.partnerIds) && e.partnerIds.includes(filter.id))
    }

    return list
  }, [filter])

  const grouped = useMemo(() => groupEventsByDate(filteredEvents), [filteredEvents])

  const filterLabel = useMemo(() => {
    if (!filter?.type || !filter?.id) return null
    if (filter.type === "venue") return getVenueById(filter.id)?.name || "Venue"
    if (filter.type === "partner") return getPartnerById(filter.id)?.name || "Partner"
    return null
  }, [filter])

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">Upcoming</h2>
        {filterLabel ? (
          <div className="text-xs text-neutral-500">
            Filter: <span className="text-neutral-800">{filterLabel}</span>
          </div>
        ) : null}
      </div>

{grouped.length === 0 ? (
  <div className="rounded-xl border border-neutral-200 p-4 text-sm text-neutral-600">
    No events yet.
  </div>
) : (
  <div className="space-y-5">
    {grouped.map((group) => (
      <DateGroup key={group.date} date={group.date}>
        {group.events.map((e, idx) => (
          <EventCard key={`${group.date}-${e.title}-${idx}`} event={e} />
        ))}
      </DateGroup>
    ))}
  </div>
)}

    </div>
  )
}


function VenuesView({ onSelectVenue }) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Venues</h2>

      {venues.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 p-4 text-sm text-neutral-600">
          No venues yet.
        </div>
      ) : (
        <div className="space-y-2">
          {venues.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 p-4"
            >
              <button
                type="button"
                onClick={() => onSelectVenue(v.id)}
                className="min-w-0 text-left"
              >
                <div className="font-medium">{v.name}</div>
                <div className="mt-1 text-xs text-neutral-500">Tap to filter events</div>
              </button>

              {v.link ? (
                <a
                  className="shrink-0 rounded-full border border-neutral-200 px-3 py-1.5 text-sm hover:bg-neutral-50"
                  href={v.link}
                  target="_blank"
                  rel="noreferrer"
                >
                  Link
                </a>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


function PartnersView({ onSelectPartner }) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Partners</h2>

      {partners.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 p-4 text-sm text-neutral-600">
          No partners yet.
        </div>
      ) : (
        <div className="space-y-2">
          {partners.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 p-4"
            >
              <button
                type="button"
                onClick={() => onSelectPartner(p.id)}
                className="min-w-0 text-left"
              >
                <div className="font-medium">{p.name}</div>
                <div className="mt-1 text-xs text-neutral-500">Tap to filter events</div>
              </button>

              {p.link ? (
                <a
                  className="shrink-0 rounded-full border border-neutral-200 px-3 py-1.5 text-sm hover:bg-neutral-50"
                  href={p.link}
                  target="_blank"
                  rel="noreferrer"
                >
                  Link
                </a>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


function AboutView() {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">About</h2>
      <div className="space-y-2 text-sm text-neutral-700 leading-relaxed">
        <p>
          Fresno Music Calendar is a mobile-first bulletin board for live music events
          in Fresno, CA.
        </p>
        <p>
          It’s human-maintained, link-first, and intentionally simple.
        </p>
      </div>
    </div>
  )
}

function DevToolsView() {
  const API = "http://localhost:8787"

  const [status, setStatus] = useState("")
  const [eventsJson, setEventsJson] = useState("")
  const [venuesJson, setVenuesJson] = useState("")
  const [partnersJson, setPartnersJson] = useState("")

  const [eventDraft, setEventDraft] = useState({
    title: "",
    date: "",
    time: "",
    venueId: "",
    partnerIds: "",
    flyer: "",
    link: "",
  })

  const [venueDraft, setVenueDraft] = useState({ id: "", name: "", link: "" })
  const [partnerDraft, setPartnerDraft] = useState({ id: "", name: "", link: "" })

  function parsePartnerIds(input) {
    return String(input || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  }

  async function fetchAll() {
    try {
      setStatus("Loading…")

      const [e, v, p] = await Promise.all([
        fetch(`${API}/api/events`).then((r) => r.json()),
        fetch(`${API}/api/venues`).then((r) => r.json()),
        fetch(`${API}/api/partners`).then((r) => r.json()),
      ])

      if (!e.ok) throw new Error(e.error || "Failed to load events")
      if (!v.ok) throw new Error(v.error || "Failed to load venues")
      if (!p.ok) throw new Error(p.error || "Failed to load partners")

      setEventsJson(JSON.stringify(e.data, null, 2))
      setVenuesJson(JSON.stringify(v.data, null, 2))
      setPartnersJson(JSON.stringify(p.data, null, 2))

      setStatus("Loaded.")
    } catch (err) {
      setStatus(`Error: ${err?.message || String(err)}`)
    }
  }

  async function addEvent() {
    try {
      setStatus("Saving event…")

      const payload = {
        title: eventDraft.title.trim(),
        date: eventDraft.date.trim(),
        time: eventDraft.time.trim(),
        venueId: eventDraft.venueId.trim(),
        partnerIds: parsePartnerIds(eventDraft.partnerIds),
        flyer: eventDraft.flyer.trim() || null,
        link: eventDraft.link.trim() || null,
      }

      const res = await fetch(`${API}/api/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const out = await res.json()
      if (!out.ok) throw new Error(out.error || "Failed to save event")

      setEventsJson(JSON.stringify(out.data, null, 2))
      setStatus("Event saved to src/data/events.json. Refresh Home if needed.")

      setEventDraft({
        title: "",
        date: "",
        time: "",
        venueId: "",
        partnerIds: "",
        flyer: "",
        link: "",
      })
    } catch (err) {
      setStatus(`Error: ${err?.message || String(err)}`)
    }
  }

    async function addVenue() {
    try {
      setStatus("Saving venue…")

      const payload = {
        id: venueDraft.id.trim(),
        name: venueDraft.name.trim(),
        link: venueDraft.link.trim(),
      }

      const res = await fetch(`${API}/api/venues/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const out = await res.json()
      if (!out.ok) throw new Error(out.error || "Failed to save venue")

      setVenueDraft({ id: "", name: "", link: "" })
      await fetchAll()
    } catch (err) {
      setStatus(`Error: ${err?.message || String(err)}`)
    }
  }

  async function addPartner() {
    try {
      setStatus("Saving partner…")

      const payload = {
        id: partnerDraft.id.trim(),
        name: partnerDraft.name.trim(),
        link: partnerDraft.link.trim(),
      }

      const res = await fetch(`${API}/api/partners/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const out = await res.json()
      if (!out.ok) throw new Error(out.error || "Failed to save partner")

      setPartnerDraft({ id: "", name: "", link: "" })
      await fetchAll()
    } catch (err) {
      setStatus(`Error: ${err?.message || String(err)}`)
    }
  }


  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">Dev Tools</h2>
        <button
          type="button"
          onClick={fetchAll}
          className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm hover:bg-neutral-50"
        >
          Reload from disk
        </button>
      </div>

      <div className="rounded-xl border border-neutral-200 p-3 text-sm text-neutral-700">
        <div className="font-medium">Status</div>
        <div className="mt-1 text-xs text-neutral-600">{status || "Writer not checked yet."}</div>
        <div className="mt-2 text-xs text-neutral-500">
          Make sure <code>npm run writer</code> is running (Terminal B).
        </div>
      </div>

      {/* Add Event */}
      <div className="rounded-xl border border-neutral-200 p-4 space-y-3">
        <h3 className="font-medium">Add Event (writes to disk)</h3>

        <div className="grid gap-3">
          <div>
            <label className="text-sm font-medium">Title</label>
            <input
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              value={eventDraft.title}
              onChange={(e) => setEventDraft((d) => ({ ...d, title: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Date</label>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                value={eventDraft.date}
                onChange={(e) => setEventDraft((d) => ({ ...d, date: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Time</label>
              <input
                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                value={eventDraft.time}
                onChange={(e) => setEventDraft((d) => ({ ...d, time: e.target.value }))}
                placeholder="7:00 PM"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Venue</label>
            <select
              className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
              value={eventDraft.venueId}
              onChange={(e) => setEventDraft((d) => ({ ...d, venueId: e.target.value }))}
            >
              <option value="">Select a venue…</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">Partners (optional)</label>
            <input
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              value={eventDraft.partnerIds}
              onChange={(e) => setEventDraft((d) => ({ ...d, partnerIds: e.target.value }))}
              placeholder="comma-separated partner ids"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Flyer path (optional)</label>
            <input
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              value={eventDraft.flyer}
              onChange={(e) => setEventDraft((d) => ({ ...d, flyer: e.target.value }))}
              placeholder="/flyers/example.jpg"
            />
          </div>

          <div>
            <label className="text-sm font-medium">External link (optional)</label>
            <input
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              value={eventDraft.link}
              onChange={(e) => setEventDraft((d) => ({ ...d, link: e.target.value }))}
              placeholder="https://..."
            />
          </div>

          <button
            type="button"
            onClick={addEvent}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
          >
            Add event (write to disk)
          </button>
        </div>
      </div>

      {/* Add Venue */}
      <div className="rounded-xl border border-neutral-200 p-4 space-y-3">
        <h3 className="font-medium">Add Venue (writes to disk)</h3>

        <div className="grid gap-3">
          <div>
            <label className="text-sm font-medium">id</label>
            <input
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              value={venueDraft.id}
              onChange={(e) => setVenueDraft((d) => ({ ...d, id: e.target.value }))}
              placeholder="e.g. strummers"
            />
          </div>

          <div>
            <label className="text-sm font-medium">name</label>
            <input
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              value={venueDraft.name}
              onChange={(e) => setVenueDraft((d) => ({ ...d, name: e.target.value }))}
            />
          </div>

          <div>
            <label className="text-sm font-medium">link</label>
            <input
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              value={venueDraft.link}
              onChange={(e) => setVenueDraft((d) => ({ ...d, link: e.target.value }))}
            />
          </div>

          <button
            type="button"
            onClick={addVenue}
            className="rounded-lg border border-neutral-200 px-4 py-2 text-sm hover:bg-neutral-50"
          >
            Add venue (write to disk)
          </button>
        </div>
      </div>

      {/* Add Partner */}
      <div className="rounded-xl border border-neutral-200 p-4 space-y-3">
        <h3 className="font-medium">Add Partner (writes to disk)</h3>

        <div className="grid gap-3">
          <div>
            <label className="text-sm font-medium">id</label>
            <input
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              value={partnerDraft.id}
              onChange={(e) => setPartnerDraft((d) => ({ ...d, id: e.target.value }))}
              placeholder="e.g. jazz-tuesdayz"
            />
          </div>

          <div>
            <label className="text-sm font-medium">name</label>
            <input
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              value={partnerDraft.name}
              onChange={(e) => setPartnerDraft((d) => ({ ...d, name: e.target.value }))}
            />
          </div>

          <div>
            <label className="text-sm font-medium">link</label>
            <input
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              value={partnerDraft.link}
              onChange={(e) => setPartnerDraft((d) => ({ ...d, link: e.target.value }))}
            />
          </div>

          <button
            type="button"
            onClick={addPartner}
            className="rounded-lg border border-neutral-200 px-4 py-2 text-sm hover:bg-neutral-50"
          >
            Add partner (write to disk)
          </button>
        </div>
      </div>

      {/* Debug panes */}
      <div className="rounded-xl border border-neutral-200 p-4 space-y-3">
        <h3 className="font-medium">On-disk JSON (debug)</h3>

        <div className="space-y-2">
          <div className="text-xs text-neutral-500">events.json</div>
          <textarea
            className="h-40 w-full rounded-lg border border-neutral-200 p-3 font-mono text-xs"
            readOnly
            value={eventsJson}
            placeholder="Click “Reload from disk” to load."
          />
        </div>

        <div className="space-y-2">
          <div className="text-xs text-neutral-500">venues.json</div>
          <textarea
            className="h-32 w-full rounded-lg border border-neutral-200 p-3 font-mono text-xs"
            readOnly
            value={venuesJson}
            placeholder="Click “Reload from disk” to load."
          />
        </div>

        <div className="space-y-2">
          <div className="text-xs text-neutral-500">partners.json</div>
          <textarea
            className="h-32 w-full rounded-lg border border-neutral-200 p-3 font-mono text-xs"
            readOnly
            value={partnersJson}
            placeholder="Click “Reload from disk” to load."
          />
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [activeTab, setActiveTab] = useState("home")
  const [filter, setFilter] = useState(null)

  function goHomeWithFilter(nextFilter) {
    setFilter(nextFilter)
    setActiveTab("home")
  }

  function clearFilter() {
    setFilter(null)
  }

  return (
    <Shell activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === "home" && (
        <div className="space-y-3">
          {filter ? (
            <button
              type="button"
              onClick={clearFilter}
              className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50"
            >
              Clear filter
            </button>
          ) : null}

          <HomeView filter={filter} />
        </div>
      )}

      {activeTab === "venues" && (
        <VenuesView
          onSelectVenue={(venueId) => goHomeWithFilter({ type: "venue", id: venueId })}
        />
      )}

      {activeTab === "partners" && (
        <PartnersView
          onSelectPartner={(partnerId) => goHomeWithFilter({ type: "partner", id: partnerId })}
        />
      )}

      {activeTab === "about" && <AboutView />}
      {activeTab === "dev" && import.meta.env.DEV && <DevToolsView />}
    </Shell>
  )
}


