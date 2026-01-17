import http from "node:http"
import { promises as fs } from "node:fs"
import path from "node:path"

const PORT = 8787

const ROOT = process.cwd()
const DATA_DIR = path.join(ROOT, "src", "data")

const EVENTS_PATH = path.join(DATA_DIR, "events.json")
const VENUES_PATH = path.join(DATA_DIR, "venues.json")
const PARTNERS_PATH = path.join(DATA_DIR, "partners.json")

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
    return send(res, 200, { ok: true, data: events })
  }
  if (req.method === "GET" && req.url === "/api/venues") {
    const venues = await readJsonArray(VENUES_PATH)
    return send(res, 200, { ok: true, data: venues })
  }
  if (req.method === "GET" && req.url === "/api/partners") {
    const partners = await readJsonArray(PARTNERS_PATH)
    return send(res, 200, { ok: true, data: partners })
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
    const flyer = normalizeOptionalString(body.flyer)
    const link = normalizeOptionalString(body.link)

    const nextEvent = { title, date, time, venueId, partnerIds, flyer, link }

    const existing = await readJsonArray(EVENTS_PATH)
    const next = sortEvents([nextEvent, ...existing])

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
  })


server.listen(PORT, () => {
  console.log(`Dev writer running on http://localhost:${PORT}`)
  console.log("Writes to:")
  console.log(`- ${EVENTS_PATH}`)
  console.log(`- ${VENUES_PATH}`)
  console.log(`- ${PARTNERS_PATH}`)
})
