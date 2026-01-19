import http from "node:http"
import { promises as fs } from "node:fs"
import path from "node:path"

const PORT = 8787

const ROOT = process.cwd()
const DATA_DIR = path.join(ROOT, "src", "data")

const EVENTS_PATH = path.join(DATA_DIR, "events.json")
const VENUES_PATH = path.join(DATA_DIR, "venues.json")
const PARTNERS_PATH = path.join(DATA_DIR, "partners.json")
const FLYERS_DIR = path.join(ROOT, "public", "flyers")

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true })
}

async function readJsonArray(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8")
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeJsonArray(filePath, arr) {
  await ensureDir(path.dirname(filePath))
  const out = JSON.stringify(arr, null, 2) + "\n"
  await fs.writeFile(filePath, out, "utf8")
}

function send(res, code, obj) {
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  })
  res.end(JSON.stringify(obj))
}

function bad(res, msg) {
  send(res, 400, { ok: false, error: msg })
}

async function readBodyJson(req) {
  const chunks = []
  for await (const c of req) chunks.push(c)
  const raw = Buffer.concat(chunks).toString("utf8")
  try {
    return JSON.parse(raw || "{}")
  } catch {
    return null
  }
}

function normalizeString(x) {
  return String(x ?? "").trim()
}

function normalizeOptionalString(x) {
  const s = normalizeString(x)
  return s.length ? s : null
}

function normalizePartnerIds(x) {
  if (!Array.isArray(x)) return []
  return x.map((v) => normalizeString(v)).filter(Boolean)
}
function normalizeGenres(x) {
  if (Array.isArray(x)) return x.map((v) => normalizeString(v)).filter(Boolean)
  // allow comma-separated string as a convenience (optional)
  return normalizeString(x)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}
function makeEventId() {
  // Short, stable-enough local id: evt_ + timestamp + random suffix
  return `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function ensureEventId(e) {
  const id = normalizeString(e?.id)
  return id ? id : makeEventId()
}

function withEventIds(list) {
  let changed = false
  const next = list.map((e) => {
    const id = normalizeString(e?.id)
    if (id) return e
    changed = true
    return { ...e, id: makeEventId() }
  })
  return { next, changed }
}

function sortEvents(events) {
  // Sort by date asc, then time string asc as best-effort.
  return [...events].sort((a, b) => {
    const ad = normalizeString(a.date)
    const bd = normalizeString(b.date)
    if (ad < bd) return -1
    if (ad > bd) return 1
    const at = normalizeString(a.time)
    const bt = normalizeString(b.time)
    return at.localeCompare(bt)
  })
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 200, { ok: true })

  // Health check
  if (req.method === "GET" && req.url === "/api/health") {
    return send(res, 200, { ok: true })
  }

  // Read current files
  if (req.method === "GET" && req.url === "/api/events") {
    const events = await readJsonArray(EVENTS_PATH)
    const { next, changed } = withEventIds(events)
    if (changed) await writeJsonArray(EVENTS_PATH, next)
    return send(res, 200, { ok: true, data: next })
  }

  if (req.method === "GET" && req.url === "/api/venues") {
    const venues = await readJsonArray(VENUES_PATH)
    return send(res, 200, { ok: true, data: venues })
  }
  if (req.method === "GET" && req.url === "/api/partners") {
    const partners = await readJsonArray(PARTNERS_PATH)
    return send(res, 200, { ok: true, data: partners })
  }
  // List flyers (newest first)
  if (req.method === "GET" && req.url === "/api/flyers") {
    try {
      await ensureDir(FLYERS_DIR)
      const names = (await fs.readdir(FLYERS_DIR))
        .filter((n) => n && !n.startsWith("."))

      const withMeta = await Promise.all(
        names.map(async (name) => {
          try {
            const st = await fs.stat(path.join(FLYERS_DIR, name))
            return { name, mtimeMs: st.mtimeMs || 0, isFile: st.isFile() }
          } catch {
            return { name, mtimeMs: 0, isFile: false }
          }
        })
      )

      const files = withMeta
        .filter((x) => x.isFile)
        .sort((a, b) => (b.mtimeMs || 0) - (a.mtimeMs || 0))
        .map((x) => x.name)

      return send(res, 200, { ok: true, data: files })
    } catch (err) {
      return send(res, 200, { ok: true, data: [] })
    }
  }

  // Dev-only: upload a flyer into /public/flyers
  // Expects JSON: { filename: "Arcana_VI.png", dataBase64: "<base64 bytes>" }
  if (req.method === "POST" && req.url === "/api/flyers/upload") {
    const body = await readBodyJson(req)
    if (!body) return bad(res, "Invalid JSON")

    const filenameRaw = normalizeString(body.filename)
    const dataBase64 = normalizeString(body.dataBase64)

    if (!filenameRaw || !dataBase64) {
      return bad(res, "Missing required fields: filename, dataBase64")
    }

    // Prevent path traversal; keep only the base filename
    const safeName = path.basename(filenameRaw)

    // Basic allowlist: images only
    const lower = safeName.toLowerCase()
    const okExt =
      lower.endsWith(".png") ||
      lower.endsWith(".jpg") ||
      lower.endsWith(".jpeg") ||
      lower.endsWith(".webp") ||
      lower.endsWith(".gif")

    if (!okExt) {
      return bad(res, "Flyer must be an image file (.png, .jpg, .jpeg, .webp, .gif)")
    }

    try {
      await ensureDir(FLYERS_DIR)
      const buf = Buffer.from(dataBase64, "base64")
      await fs.writeFile(path.join(FLYERS_DIR, safeName), buf)
      return send(res, 200, { ok: true, path: `/flyers/${safeName}` })
    } catch (err) {
      return bad(res, "Failed to write flyer to disk")
    }
  }


  // Add Event
  if (req.method === "POST" && req.url === "/api/events") {
    const body = await readBodyJson(req)
    if (!body) return bad(res, "Invalid JSON")

    const title = normalizeString(body.title)
    const date = normalizeString(body.date) // YYYY-MM-DD
    const time = normalizeString(body.time)
    const venueId = normalizeString(body.venueId)

    if (!title || !date || !time || !venueId) {
      return bad(res, "Missing required fields: title, date, time, venueId")
    }

    const partnerIds = normalizePartnerIds(body.partnerIds)
    const genres = normalizeGenres(body.genres)
    const flyer = normalizeOptionalString(body.flyer)
    const link = normalizeOptionalString(body.link)

    const nextEvent = {
      id: ensureEventId(body),
      title,
      date,
      time,
      venueId,
      partnerIds,
      genres,
      flyer,
      link,
    }

    const existing = await readJsonArray(EVENTS_PATH)
    const { next: existingWithIds, changed } = withEventIds(existing)
    const next = sortEvents([nextEvent, ...existingWithIds])

    await writeJsonArray(EVENTS_PATH, next)
    return send(res, 200, { ok: true, data: next })

  }
    // Update Event
  if (req.method === "POST" && req.url === "/api/events/update") {
    const body = await readBodyJson(req)
    if (!body) return bad(res, "Invalid JSON")

    const id = normalizeString(body.id)
    if (!id) return bad(res, "Missing required field: id")

    const title = normalizeString(body.title)
    const date = normalizeString(body.date) // YYYY-MM-DD
    const time = normalizeString(body.time)
    const venueId = normalizeString(body.venueId)

    if (!title || !date || !time || !venueId) {
      return bad(res, "Missing required fields: title, date, time, venueId")
    }

    const partnerIds = normalizePartnerIds(body.partnerIds)
    const genres = normalizeGenres(body.genres)
    const flyer = normalizeOptionalString(body.flyer)
    const link = normalizeOptionalString(body.link)

    const existing = await readJsonArray(EVENTS_PATH)
    const { next: existingWithIds, changed } = withEventIds(existing)
    if (changed) await writeJsonArray(EVENTS_PATH, existingWithIds)

    const idx = existingWithIds.findIndex((e) => normalizeString(e.id) === id)
    if (idx === -1) return bad(res, "Event not found")

    const updated = {
      ...existingWithIds[idx],
      id,
      title,
      date,
      time,
      venueId,
      partnerIds,
      genres,
      flyer,
      link,
    }

    const next = sortEvents([
      ...existingWithIds.slice(0, idx),
      updated,
      ...existingWithIds.slice(idx + 1),
    ])

    await writeJsonArray(EVENTS_PATH, next)
    return send(res, 200, { ok: true, data: next })
  }

  // Delete Event
  if (req.method === "POST" && req.url === "/api/events/delete") {
    const body = await readBodyJson(req)
    if (!body) return bad(res, "Invalid JSON")

    const id = normalizeString(body.id)
    if (!id) return bad(res, "Missing required field: id")

    const existing = await readJsonArray(EVENTS_PATH)
    const { next: existingWithIds, changed } = withEventIds(existing)
    if (changed) await writeJsonArray(EVENTS_PATH, existingWithIds)

    const next = existingWithIds.filter((e) => normalizeString(e.id) !== id)

    await writeJsonArray(EVENTS_PATH, next)
    return send(res, 200, { ok: true, data: next })
  }



    // Add Venue
  if (req.method === "POST" && (req.url === "/api/venues" || req.url === "/api/venues/add")) {
    const body = await readBodyJson(req)
    if (!body) return bad(res, "Invalid JSON")

    const id = normalizeString(body.id)
    const name = normalizeString(body.name)
    const link = normalizeString(body.link)

    if (!id || !name || !link) {
      return bad(res, "Missing required fields: id, name, link")
    }

    const existing = await readJsonArray(VENUES_PATH)
    const withoutDup = existing.filter((v) => normalizeString(v.id) !== id)
    const next = [{ id, name, link }, ...withoutDup]

    await writeJsonArray(VENUES_PATH, next)
    return send(res, 200, { ok: true, data: next })
  }

  // Add Partner
  if (req.method === "POST" && (req.url === "/api/partners" || req.url === "/api/partners/add")) {
    const body = await readBodyJson(req)
    if (!body) return bad(res, "Invalid JSON")

    const id = normalizeString(body.id)
    const name = normalizeString(body.name)
    const link = normalizeString(body.link)

    if (!id || !name || !link) {
      return bad(res, "Missing required fields: id, name, link")
    }

    const existing = await readJsonArray(PARTNERS_PATH)
    const withoutDup = existing.filter((p) => normalizeString(p.id) !== id)
    const next = [{ id, name, link }, ...withoutDup]

    await writeJsonArray(PARTNERS_PATH, next)
    return send(res, 200, { ok: true, data: next })
  }
    // If we got here, nothing matched
  return send(res, 404, { ok: false, error: "Not found" })
  })

server.listen(PORT, () => {
  console.log(`Dev writer running on http://localhost:${PORT}`)
  console.log("Writes to:")
  console.log(`- ${EVENTS_PATH}`)
  console.log(`- ${VENUES_PATH}`)
  console.log(`- ${PARTNERS_PATH}`)
  console.log("Reads/writes flyers to:")
  console.log(`- ${FLYERS_DIR}`)
})