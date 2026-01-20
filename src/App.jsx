import { useEffect, useMemo, useState } from "react"

import events from "./data/events.json"
import venues from "./data/venues.json"
import partners from "./data/partners.json"

const NAV_ITEMS = [
  { key: "home", label: "Today" },
  { key: "venues", label: "Venues" },
  { key: "partners", label: "Partners" },
  // Genres is handled separately (button opens the genre UI)
  { key: "about", label: "About" },
  { key: "contact", label: "Contact" },
  // Dev Tools is conditionally added below
]

const GENRES = [
  "Alternative",
  "Blues",
  "Bluegrass",
  "Classical",
  "Country",
  "Electronic",
  "Funk",
  "Hip Hop",
  "Indie",
  "Jazz",
  "Latin",
  "Metal",
  "Pop",
  "Punk",
  "Reggae",
  "Rock",
  "R & B"
]

function formatDateLabel(dateInput) {
  const yyyyMmDd = normalizeDateToYMD(dateInput)
  if (!yyyyMmDd) return String(dateInput || "")

  const [y, m, d] = yyyyMmDd.split("-").map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}


function parseTimeToMinutes(timeStr) {
  // Accepts formats like "7:00 PM", "7 PM", "19:00"
  const s = String(timeStr || "").trim()
  if (!s) return Number.POSITIVE_INFINITY // "Time TBA" goes last

  const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i)
  if (!m) return Number.POSITIVE_INFINITY

  let h = Number(m[1])
  const mins = Number(m[2] || "0")
  const ampm = m[3] ? m[3].toLowerCase() : null

  if (Number.isNaN(h) || Number.isNaN(mins)) return Number.POSITIVE_INFINITY
  if (mins < 0 || mins > 59) return Number.POSITIVE_INFINITY
  if (h < 0 || h > 23) return Number.POSITIVE_INFINITY

  if (ampm) {
    // 12-hour clock normalization
    if (h < 1 || h > 12) return Number.POSITIVE_INFINITY
    if (ampm === "am") h = h === 12 ? 0 : h
    if (ampm === "pm") h = h === 12 ? 12 : h + 12
  }

  return h * 60 + mins
}


function getTodayYMD() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}
function normalizeDateToYMD(input) {
  const s = String(input || "").trim()
  if (!s) return null

  // Already YYYY-MM-DD
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return s

  // Accept MM/DD/YYYY
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (us) {
    const mm = String(us[1]).padStart(2, "0")
    const dd = String(us[2]).padStart(2, "0")
    const yyyy = us[3]
    return `${yyyy}-${mm}-${dd}`
  }

  return null
}

function groupEventsByDate(eventList) {
  const today = getTodayYMD()

  const groups = new Map()
  for (const e of eventList) {
    const dateKey = normalizeDateToYMD(e.date)
    if (!dateKey) continue

    // Past dates remain excluded (Today & Upcoming behavior)
    if (dateKey < today) continue

    if (!groups.has(dateKey)) groups.set(dateKey, [])
    groups.get(dateKey).push(e)
  }

  // Sort dates ascending (start → future)
  const dates = Array.from(groups.keys()).sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0
  )

  // Sort events within a date by time
  for (const date of dates) {
    groups.get(date).sort((a, b) => {
      const ta = parseTimeToMinutes(a.time)
      const tb = parseTimeToMinutes(b.time)
      if (ta !== tb) return ta - tb
      return String(a.title || "").localeCompare(String(b.title || ""))
    })
  }

  return dates.map((date) => ({ date, events: groups.get(date) }))
}


function getVenueById(id) {
  return venues.find((v) => v.id === id) || null
}

function getPartnerById(id) {
  return partners.find((p) => p.id === id) || null
}

function slugifyId(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
function DateGroup({ date, children }) {
  const key = normalizeDateToYMD(date) || String(date || "")
  return (
    <section id={`date-${key}`} className="space-y-2">
      <div className="mb-2 flex justify-center">
        <h3 className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1 text-sm font-medium">
          {formatDateLabel(date)}
        </h3>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

function EventCard({ event, isOpen, onToggle }) {
  const venue = getVenueById(event.venueId)
  const href = event.link || venue?.link || null

  const partnerName = (() => {
    const ids = Array.isArray(event.partnerIds) ? event.partnerIds : []
    if (ids.length === 0) return null
    const want = slugifyId(ids[0])
    return partners.find((p) => slugifyId(p.id) === want)?.name || ids[0]
  })()

  const genreText = (() => {
    const gs = Array.isArray(event.genres) ? event.genres : []
    if (gs.length === 0) return null
    return gs.join(", ")
  })()

  const venueAddress = venue?.address ? String(venue.address) : null
  const venueMapLink = venue?.mapLink ? String(venue.mapLink) : null

  return (

        <article
      className="rounded-xl border border-neutral-200 p-4 cursor-pointer select-none"
      onClick={onToggle}
      role="button"
      tabIndex={0}
      aria-expanded={!!isOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onToggle?.()
        }
      }}
    >
            {/* MOBILE collapsed header row (always visible) */}
            {/* MOBILE collapsed header row (always visible) */}
      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 md:hidden">
        <div className="min-w-0 font-semibold leading-snug truncate">
          {event.title}
        </div>
        <div className="text-sm text-neutral-700 whitespace-nowrap">
          {event.time || "Time TBA"}
        </div>
        <div className="text-sm text-neutral-700 whitespace-nowrap truncate max-w-[10rem]">
          {venue?.name || "Venue TBA"}
        </div>
      </div>
     {/* DESKTOP temporary fallback (Step 5 will replace with the locked desktop layouts) */}
      <div className="hidden md:flex items-start justify-between gap-3">
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
            onClick={(e) => e.stopPropagation()}
          >
            Link
          </a>
        ) : null}
      </div>
      {/* MOBILE expanded body */}
      {isOpen ? (
        <div className="mt-3 space-y-2 md:hidden">
          {/* Venue – Address (Map Link) */}
          <div className="text-sm text-neutral-800">
            <span className="font-medium">{venue?.name || "Venue TBA"}</span>
            {venueAddress ? (
              <>
                {" — "}
                {venueMapLink ? (
                  <a
                    href={venueMapLink}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {venueAddress}
                  </a>
                ) : (
                  <span>{venueAddress}</span>
                )}
              </>
            ) : null}
          </div>

          {/* Genre | Partner* (no placeholders) */}
          {(genreText || partnerName) ? (
            <div className="grid grid-cols-2 gap-3 text-sm text-neutral-700">
              <div className="min-w-0 truncate">{genreText || ""}</div>
              <div className="min-w-0 truncate text-right">
                {partnerName || ""}
              </div>
            </div>
          ) : null}

          {/* Flyer* (standardized size already established) */}
          {event.flyer ? (
            <div className="overflow-hidden rounded-lg border border-neutral-200">
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <img
                    src={event.flyer}
                    alt={`${event.title} flyer`}
                    className="block w-full max-h-[420px] object-contain bg-neutral-100"
                    loading="lazy"
                    onClick={(e) => e.stopPropagation()}
                  />
                </a>
              ) : (
                <img
                  src={event.flyer}
                  alt={`${event.title} flyer`}
                  className="block w-full max-h-[420px] object-contain bg-neutral-100"
                  loading="lazy"
                  onClick={(e) => e.stopPropagation()}
                />
              )}
            </div>
          ) : null}

          {/* Event Link (no placeholder) */}
          {href ? (
            <div className="pt-1">
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm hover:bg-neutral-50"
                onClick={(e) => e.stopPropagation()}
              >
                Event Link
              </a>
            </div>
          ) : null}
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
      aria-current={active ? "page" : undefined}
      className={[
        "text-sm leading-none",
        "px-1 py-1",
        "transition-colors",
        active ? "text-neutral-900" : "text-neutral-500 hover:text-neutral-800",
      ].join(" ")}
    >
      {children}
    </button>
  )
}


function Shell({
  activeTab,
  setActiveTab,
  jumpDate,
  setJumpDate,
  selectedGenres,
  setSelectedGenres,
  resetGenresToAll,
  clearGenres,
  searchQuery,
  setSearchQuery,
  children,
}) {

  const navItems = useMemo(() => {
    const items = [...NAV_ITEMS]
    if (import.meta.env.DEV) items.push({ key: "dev", label: "Dev Tools" })
    return items
  }, [])

  const [isGenreOpen, setIsGenreOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  function toggleAllGenres() {
    const count = selectedGenres?.size || 0
    const isAllSelected = count === GENRES.length
    if (isAllSelected) clearGenres()
    else resetGenresToAll()
  }


  return (
    <div
      className="min-h-screen text-neutral-900"
      style={{
        fontFamily:
          '"Segoe UI Light","Segoe UI",system-ui,-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif',
      }}
    >
            {/* Global frame: inert | active | inert */}
      <div className="min-h-screen w-full grid grid-cols-[1fr_minmax(0,36rem)_1fr]">



        {/* Inert field (left) */}
<div
  aria-hidden="true"
  className="min-h-screen bg-[#B87333]"
/>
        {/* Active content column */}
<div className="min-h-screen bg-[#fffbf7] w-full col-start-2">
<header
  className="sticky top-0 z-50 border-b border-neutral-200 bg-[#fffbf7]"
  style={{ position: "sticky", top: 0, zIndex: 50 }}
>
  {/* Row 1: Title only */}
  <div
    className="h-16 px-4 flex items-center justify-center"
    style={{ height: 64 }}
  >
      <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-center">
        FRESNO MUSIC CALENDAR
      </h1>
    </div>

    {/* Row 2: Navigation (desktop + mobile variants) */}
  <div
    className="h-10 px-4 flex items-center border-t border-neutral-200"
    style={{ height: 40 }}
  >
      {/* Desktop nav */}
      <nav className="hidden md:flex w-full items-center justify-between">
        <div className="flex items-center gap-6">
          {/* Today */}
          <NavButton
            active={activeTab === "home"}
            onClick={() => {
              setJumpDate("")
              setActiveTab("home")
            }}
          >
            Today
          </NavButton>

          {/* Venues */}
          <NavButton
            active={activeTab === "venues"}
            onClick={() => setActiveTab("venues")}
          >
            Venues
          </NavButton>

          {/* Partners */}
          <NavButton
            active={activeTab === "partners"}
            onClick={() => setActiveTab("partners")}
          >
            Partners
          </NavButton>

          {/* Genres (desktop) */}
          {activeTab === "home" ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsGenreOpen((v) => !v)}
                className={[
                  "text-sm leading-none px-1 py-1 transition-colors",
                  isGenreOpen
                    ? "text-neutral-900"
                    : "text-neutral-500 hover:text-neutral-800",
                ].join(" ")}
              >
                Genres
              </button>

              {isGenreOpen ? (
                <div className="absolute left-0 z-20 mt-2 w-72 rounded-xl border border-neutral-200 bg-white p-3 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Genres</div>
                    <button
                      type="button"
                      className="text-xs underline text-neutral-600"
                      onClick={toggleAllGenres}
                    >
                      All
                    </button>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {GENRES.map((g) => {
                      const checked = selectedGenres?.has(g)
                      return (
                        <label
                          key={g}
                          className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={!!checked}
                            onChange={(e) => {
                              const on = e.target.checked
                              setSelectedGenres((prev) => {
                                const next = new Set(prev || [])
                                if (on) next.add(g)
                                else next.delete(g)
                                return next
                              })
                            }}
                          />
                          <span className="truncate">{g}</span>
                        </label>
                      )
                    })}
                  </div>

                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm hover:bg-neutral-50"
                      onClick={() => setIsGenreOpen(false)}
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* About */}
          <NavButton
            active={activeTab === "about"}
            onClick={() => setActiveTab("about")}
          >
            About
          </NavButton>

          {/* Contact */}
          <NavButton
            active={activeTab === "contact"}
            onClick={() => setActiveTab("contact")}
          >
            Contact
          </NavButton>

          {/* Dev Tools (desktop, optional) */}
          {import.meta.env.DEV ? (
            <NavButton
              active={activeTab === "dev"}
              onClick={() => setActiveTab("dev")}
            >
              Dev Tools
            </NavButton>
          ) : null}
        </div>

        {/* Date picker (desktop) */}
        <input
          type="date"
          value={jumpDate || ""}
          onChange={(e) => {
            setJumpDate(e.target.value)
            setActiveTab("home")
          }}
          className="text-sm border border-neutral-200 rounded-md px-2 py-1 bg-white"
          aria-label="Jump to date"
        />
      </nav>

      {/* Mobile nav */}
      <nav className="md:hidden w-full flex items-center justify-between">
        {/* Left: Menu (dropdown) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((v) => !v)}
            className={[
              "text-sm leading-none px-1 py-1 transition-colors",
              isMobileMenuOpen
                ? "text-neutral-900"
                : "text-neutral-500 hover:text-neutral-800",
            ].join(" ")}
          >
            Menu
          </button>

          {isMobileMenuOpen ? (
            <div className="absolute left-0 z-30 mt-2 w-44 rounded-xl border border-neutral-200 bg-white p-2 shadow-lg">
              {["venues", "partners", "about", "contact"].map((key) => {
                const item = navItems.find((n) => n.key === key)
                if (!item) return null
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false)
                      setActiveTab(item.key)
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 rounded-lg"
                  >
                    {item.label}
                  </button>
                )
              })}

              {import.meta.env.DEV ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false)
                    setActiveTab("dev")
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 rounded-lg"
                >
                  Dev Tools
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Middle-left: Today */}
        <NavButton
          active={activeTab === "home"}
          onClick={() => {
            setJumpDate("")
            setActiveTab("home")
          }}
        >
          Today
        </NavButton>

        {/* Middle-right: Genre (mobile) */}
        {activeTab === "home" ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsGenreOpen((v) => !v)}
              className={[
                "text-sm leading-none px-1 py-1 transition-colors",
                isGenreOpen
                  ? "text-neutral-900"
                  : "text-neutral-500 hover:text-neutral-800",
              ].join(" ")}
            >
              Genre
            </button>

            {isGenreOpen ? (
              <div className="absolute left-0 z-30 mt-2 w-72 rounded-xl border border-neutral-200 bg-white p-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Genres</div>
                  <button
                    type="button"
                    className="text-xs underline text-neutral-600"
                    onClick={toggleAllGenres}
                  >
                    All
                  </button>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  {GENRES.map((g) => {
                    const checked = selectedGenres?.has(g)
                    return (
                      <label
                        key={g}
                        className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={!!checked}
                          onChange={(e) => {
                            const on = e.target.checked
                            setSelectedGenres((prev) => {
                              const next = new Set(prev || [])
                              if (on) next.add(g)
                              else next.delete(g)
                              return next
                            })
                          }}
                        />
                        <span className="truncate">{g}</span>
                      </label>
                    )
                  })}
                </div>

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm hover:bg-neutral-50"
                    onClick={() => setIsGenreOpen(false)}
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <span />
        )}

        {/* Right: Date picker (calendar icon acceptable) */}
        <input
          type="date"
          value={jumpDate || ""}
          onChange={(e) => {
            setJumpDate(e.target.value)
            setActiveTab("home")
          }}
          className="w-10 text-sm border border-neutral-200 rounded-md px-1 py-1 bg-white"
          aria-label="Jump to date"
          title="Jump to date"
        />
      </nav>
    </div>

    {/* Row 3: Search input only */}
  <div
    className="h-10 px-4 flex items-center border-t border-neutral-200"
    style={{ height: 40 }}
  >
<input
  type="text"
  value={activeTab === "home" ? searchQuery : ""}
  onChange={(e) => {
    if (activeTab === "home") setSearchQuery(e.target.value)
  }}
  placeholder="Search Events"
  disabled={activeTab !== "home"}
  className="w-full rounded-full border border-neutral-200 bg-white px-3 py-2 text-sm
             placeholder:text-neutral-400 focus:placeholder-transparent
             disabled:opacity-0"
  aria-label="Search events"
/>

    </div>
  </header>



<main className="overflow-x-hidden">
  <div className="w-full px-4 py-3">{children}</div>
</main>

        <footer className="border-t border-neutral-200">
          <div className="w-full px-4 py-5 text-sm text-neutral-600">
              <p>
                Send show info or a flyer:{" "}
                <a className="underline" href="mailto:fresnomusiccalendar@gmail.com">
                  fresnomusiccalendar@gmail.com
                </a>
              </p>
            </div>
          </footer>
        </div>

        {/* Inert field (right) */}
<div
  aria-hidden="true"
  className="min-h-screen bg-[#B87333]"
/>
      </div>
</div>
  )
}
function HomeView({ filter, anchorDate, selectedGenres, searchQuery }) {
  const filteredEvents = useMemo(() => {
    let list = events

    if (filter?.type === "venue" && filter?.id) {
      list = list.filter((e) => e.venueId === filter.id)
    }

    if (filter?.type === "partner" && filter?.id) {
      const want = slugifyId(filter.id)
      list = list.filter((e) => {
        const ids = Array.isArray(e.partnerIds) ? e.partnerIds : []
        return ids.some((pid) => slugifyId(pid) === want)
      })
    }

    // Genre filter (additive).
    // If none selected, show nothing.
    // If ALL selected, treat as "no genre filter" so events without genres still show.
    if (selectedGenres instanceof Set) {
      if (selectedGenres.size === 0) return []
      if (selectedGenres.size !== GENRES.length) {
        list = list.filter((e) => {
          const gs = Array.isArray(e.genres) ? e.genres : []
          return gs.some((g) => selectedGenres.has(g))
        })
      }
    }


    // Search (title-only, case-insensitive)
    const q = String(searchQuery || "").trim().toLowerCase()
    if (q) {
      list = list.filter((e) => String(e.title || "").toLowerCase().includes(q))
    }
    return list

  }, [filter, selectedGenres, searchQuery])

const grouped = useMemo(
  () => groupEventsByDate(filteredEvents),
  [filteredEvents]
)


  useEffect(() => {
    const key = normalizeDateToYMD(anchorDate)
    if (!key) return

    requestAnimationFrame(() => {
      const el = document.getElementById(`date-${key}`)
      if (!el) return

      const headerEl = document.querySelector("header")
      const headerH = headerEl ? headerEl.getBoundingClientRect().height : 0

      const y =
        el.getBoundingClientRect().top + window.scrollY - headerH - 8

      window.scrollTo({ top: Math.max(0, y), behavior: "smooth" })
    })
  }, [anchorDate, grouped.length])

  // Step 2: persistent open state (multiple cards can be open)
  const [openEventIds, setOpenEventIds] = useState(() => new Set())

  function toggleEventOpen(id) {
    setOpenEventIds((prev) => {
      const next = new Set(prev || [])
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filterLabel = useMemo(() => {
    if (!filter?.type || !filter?.id) return null
    if (filter.type === "venue") {
      return getVenueById(filter.id)?.name || "Venue"
    }
    if (filter.type === "partner") {
      const want = slugifyId(filter.id)
      return partners.find((p) => slugifyId(p.id) === want)?.name || "Partner"
    }
    return null
  }, [filter])



return (
  <div className="space-y-2">
    <div className="flex flex-col items-center gap-0">
      <h2 className="text-base font-medium leading-tight">Today & Upcoming</h2>

      {filterLabel ? (
        <div className="text-xs text-neutral-500">
          Filter: <span className="text-neutral-800">{filterLabel}</span>
        </div>
      ) : null}
    </div>



{grouped.length === 0 ? (
  <div className="rounded-xl border border-neutral-200 p-4 text-sm text-neutral-600">
    {String(searchQuery || "").trim()
      ? "No results."
      : "No events yet."}
  </div>
) : (
  <div className="space-y-5">
    {grouped.map((group) => (
      <DateGroup key={group.date} date={group.date}>
        {group.events.map((e) => (
          <EventCard
            key={e.id}
            event={e}
            isOpen={openEventIds.has(e.id)}
            onToggle={() => toggleEventOpen(e.id)}
          />
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
function ContactView() {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Contact</h2>
      <div className="space-y-2 text-sm text-neutral-700 leading-relaxed">
        <p>
          For corrections, venue updates, partnerships, or anything else:
        </p>
        <p>
          <a
            className="underline"
            href="mailto:fresnomusiccalendar@gmail.com"
          >
            fresnomusiccalendar@gmail.com
          </a>
        </p>
      </div>
    </div>
  )
}
function DevToolsView() {
  const API = "http://localhost:8787"

  const [status, setStatus] = useState("")
  const [eventsJson, setEventsJson] = useState("")
  const [eventsList, setEventsList] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [venuesJson, setVenuesJson] = useState("")
  const [partnersJson, setPartnersJson] = useState("")
  const [flyerFiles, setFlyerFiles] = useState([])
  const [isUploadingFlyer, setIsUploadingFlyer] = useState(false)


  const [eventDraft, setEventDraft] = useState({
    title: "",
    date: "",
    time: "",
    venueId: "",
    partnerIds: "",
    genres: [],
    flyer: "",
    link: "",
  })

  const [venueDraft, setVenueDraft] = useState({
    id: "",
    name: "",
    link: "",
    address: "",
    mapLink: "",
  })
  const [partnerDraft, setPartnerDraft] = useState({ id: "", name: "", link: "" })


  function parsePartnerIds(input) {
    return String(input || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  }

  function parseGenres(input) {
    return String(input || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  }
  async function uploadFlyer(file) {
    if (!file) return null

    try {
      setIsUploadingFlyer(true)
      setStatus("Uploading flyer…")

      const ab = await file.arrayBuffer()
      const base64 = btoa(
        String.fromCharCode(...new Uint8Array(ab))
      )

      const res = await fetch(`${API}/api/flyers/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          dataBase64: base64,
        }),
      })

      const out = await res.json()
      if (!out.ok) throw new Error(out.error || "Failed to upload flyer")

      // Refresh flyer list so it appears immediately
      const f = await fetch(`${API}/api/flyers`).then((r) => r.json())
      if (f.ok) setFlyerFiles(Array.isArray(f.data) ? f.data : [])

      setStatus("Flyer uploaded.")
      return out.path || null
    } catch (err) {
      setStatus(`Error: ${err?.message || String(err)}`)
      return null
    } finally {
      setIsUploadingFlyer(false)
    }
  }


  async function fetchAll() {
    try {
      setStatus("Loading…")

      const [e, v, p, f] = await Promise.all([
        fetch(`${API}/api/events`).then((r) => r.json()),
        fetch(`${API}/api/venues`).then((r) => r.json()),
        fetch(`${API}/api/partners`).then((r) => r.json()),
        fetch(`${API}/api/flyers`).then((r) => r.json()),
      ])

      if (!e.ok) throw new Error(e.error || "Failed to load events")
      if (!v.ok) throw new Error(v.error || "Failed to load venues")
      if (!p.ok) throw new Error(p.error || "Failed to load partners")
      if (!f.ok) throw new Error(f.error || "Failed to load flyers")

      setEventsJson(JSON.stringify(e.data, null, 2))
      setEventsList(Array.isArray(e.data) ? e.data : [])
      setVenuesJson(JSON.stringify(v.data, null, 2))
      setPartnersJson(JSON.stringify(p.data, null, 2))
      setFlyerFiles(Array.isArray(f.data) ? f.data : [])

      setStatus("Loaded.")

    } catch (err) {
      setStatus(`Error: ${err?.message || String(err)}`)
    }
  }
  function startEdit(ev) {
    setEditingId(ev.id)
    setEventDraft({
      title: ev.title || "",
      date: ev.date || "",
      time: ev.time || "",
      venueId: ev.venueId || "",
      partnerIds: Array.isArray(ev.partnerIds) ? ev.partnerIds.join(", ") : "",
      genres: Array.isArray(ev.genres) ? ev.genres : [],
      flyer: ev.flyer || "",
      link: ev.link || "",
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setEventDraft({
      title: "",
      date: "",
      time: "",
      venueId: "",
      partnerIds: "",
      genres: [],
      flyer: "",
      link: "",
    })
  }

  async function saveEdit() {
    try {
      if (!editingId) return
      setStatus("Updating event…")

      const payload = {
        id: editingId,
        title: eventDraft.title.trim(),
        date: normalizeDateToYMD(eventDraft.date) || eventDraft.date.trim(),
        time: eventDraft.time.trim(),
        venueId: eventDraft.venueId.trim(),
        partnerIds: parsePartnerIds(eventDraft.partnerIds),
        genres: Array.isArray(eventDraft.genres) ? eventDraft.genres : [],
        flyer: eventDraft.flyer.trim() || null,
        link: eventDraft.link.trim() || null,
      }

      const res = await fetch(`${API}/api/events/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const out = await res.json()
      if (!out.ok) throw new Error(out.error || "Failed to update event")

      setEventsJson(JSON.stringify(out.data, null, 2))
      setEventsList(Array.isArray(out.data) ? out.data : [])
      setStatus("Event updated.")
      cancelEdit()
    } catch (err) {
      setStatus(`Error: ${err?.message || String(err)}`)
    }
  }

  async function deleteEvent(id) {
    try {
      setStatus("Deleting event…")

      const res = await fetch(`${API}/api/events/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      const out = await res.json()
      if (!out.ok) throw new Error(out.error || "Failed to delete event")

      setEventsJson(JSON.stringify(out.data, null, 2))
      setEventsList(Array.isArray(out.data) ? out.data : [])
      setStatus("Event deleted.")
      if (editingId === id) cancelEdit()
    } catch (err) {
      setStatus(`Error: ${err?.message || String(err)}`)
    }
  }

  async function addEvent() {
    try {
      setStatus("Saving event…")

      const payload = {
        title: eventDraft.title.trim(),
        date: normalizeDateToYMD(eventDraft.date) || eventDraft.date.trim(),
        time: eventDraft.time.trim(),
        venueId: eventDraft.venueId.trim(),
        partnerIds: parsePartnerIds(eventDraft.partnerIds),
        genres: Array.isArray(eventDraft.genres) ? eventDraft.genres : [],
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
        genres: [],
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
        address: venueDraft.address.trim(),
        mapLink: venueDraft.mapLink.trim(),
      }

      const res = await fetch(`${API}/api/venues/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const out = await res.json()
      if (!out.ok) throw new Error(out.error || "Failed to save venue")

      setVenueDraft({
        id: "",
        name: "",
        link: "",
        address: "",
        mapLink: "",
      })
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
            <label className="text-sm font-medium">Genres (optional)</label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {GENRES.map((g) => {
                const checked = Array.isArray(eventDraft.genres) && eventDraft.genres.includes(g)
                return (
                  <label
                    key={g}
                    className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const on = e.target.checked
                        setEventDraft((d) => {
                          const curr = Array.isArray(d.genres) ? d.genres : []
                          const next = on ? [...curr, g] : curr.filter((x) => x !== g)
                          return { ...d, genres: next }
                        })
                      }}
                    />
                    <span className="truncate">{g}</span>
                  </label>
                )
              })}
            </div>
          </div>

            <div>
    <label className="text-sm font-medium">Flyer (optional)</label>

    <div className="mt-1 grid gap-2">
      {/* Pick from existing files in /public/flyers */}
      <select
        className="w-full border border-neutral-200 px-2 py-1 text-sm"
        value={eventDraft.flyer || ""}
        onChange={(e) => setEventDraft((d) => ({ ...d, flyer: e.target.value }))}
      >
        <option value="">No flyer</option>
        {flyerFiles.map((name) => {
          const value = `/flyers/${name}`
          return (
            <option key={name} value={value}>
              {name}
            </option>
          )
        })}
      </select>

      {/* OS file picker -> uploads into /public/flyers and auto-selects */}
      <input
        type="file"
        accept="image/*"
        disabled={isUploadingFlyer}
        className="w-full border border-neutral-200 px-2 py-1 text-sm"
        onChange={async (e) => {
          const file = e.target.files?.[0] || null
          if (!file) return
          const savedPath = await uploadFlyer(file)
          if (savedPath) setEventDraft((d) => ({ ...d, flyer: savedPath }))
          // reset input so selecting same file again triggers onChange
          e.target.value = ""
        }}
      />

      {/* manual override, still allowed */}
      <input
        className="w-full border border-neutral-200 px-2 py-1 text-sm"
        value={eventDraft.flyer}
        onChange={(e) => setEventDraft((d) => ({ ...d, flyer: e.target.value }))}
        placeholder="/flyers/example.png"
      />
    </div>
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

{editingId ? (
  <div className="flex gap-2">
    <button
      type="button"
      onClick={saveEdit}
      className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
    >
      Save changes
    </button>
    <button
      type="button"
      onClick={cancelEdit}
      className="rounded-lg border border-neutral-200 px-4 py-2 text-sm hover:bg-neutral-50"
    >
      Cancel
    </button>
  </div>
) : (
  <button
    type="button"
    onClick={addEvent}
    className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
  >
    Add event (write to disk)
  </button>
)}


        </div>
      </div>
      {/* Manage Events */}
      <div className="rounded-xl border border-neutral-200 p-4 space-y-3">
        <h3 className="font-medium">Manage Events</h3>

        {eventsList.length === 0 ? (
          <div className="text-sm text-neutral-600">No events loaded. Click “Reload from disk”.</div>
        ) : (
          <div className="space-y-2">
            {eventsList.map((ev) => {
              const venue = venues.find((v) => v.id === ev.venueId)
              return (
                <div
                  key={ev.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{ev.title}</div>
                    <div className="truncate text-xs text-neutral-500">
                      {ev.date} · {ev.time} · {venue?.name || ev.venueId}
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(ev)}
                      className="rounded-md border border-neutral-200 px-2 py-1 text-xs hover:bg-neutral-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Delete "${ev.title}"?`)) deleteEvent(ev.id)
                      }}
                      className="rounded-md border border-neutral-200 px-2 py-1 text-xs hover:bg-neutral-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
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

          <div>
            <label className="text-sm font-medium">address</label>
            <input
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              value={venueDraft.address}
              onChange={(e) => setVenueDraft((d) => ({ ...d, address: e.target.value }))}
              placeholder="e.g. 933 Van Ness Ave, Fresno, CA 93721"
            />
          </div>

          <div>
            <label className="text-sm font-medium">mapLink</label>
            <input
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              value={venueDraft.mapLink}
              onChange={(e) => setVenueDraft((d) => ({ ...d, mapLink: e.target.value }))}
              placeholder="e.g. https://maps.google.com/?q=..."
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
  const [jumpDate, setJumpDate] = useState("")
  const [selectedGenres, setSelectedGenres] = useState(() => new Set(GENRES))
  const [searchQuery, setSearchQuery] = useState("")

  function resetGenresToAll() {
    setSelectedGenres(new Set(GENRES))
  }

  function clearGenres() {
    setSelectedGenres(new Set())
  }


  function goHomeWithFilter(nextFilter) {
    setFilter(nextFilter)
    setActiveTab("home")
  }

  function clearFilter() {
    setFilter(null)
  }

const setActiveTabWrapped = (key) => {
  // If we’re navigating to Home via programmatic actions (date picker),
  // ensure Home is the default "Today & Upcoming" view (no filters).
  if (key === "home") setFilter(null)
  setActiveTab(key)
}


  return (
    <Shell
      activeTab={activeTab}
      setActiveTab={setActiveTabWrapped}
      jumpDate={jumpDate}
      setJumpDate={setJumpDate}
      selectedGenres={selectedGenres}
      setSelectedGenres={setSelectedGenres}
      resetGenresToAll={resetGenresToAll}
      clearGenres={clearGenres}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
    >


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

<HomeView
  filter={filter}
  anchorDate={jumpDate}
  selectedGenres={selectedGenres}
  searchQuery={searchQuery}
/>


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
      {activeTab === "contact" && <ContactView />}
      {activeTab === "dev" && import.meta.env.DEV && <DevToolsView />}
    </Shell>
  )
}



