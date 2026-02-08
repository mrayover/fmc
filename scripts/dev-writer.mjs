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
const LOGOS_DIR = path.join(ROOT, "public", "logos")


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

function normalizeFlyer(x) {
  const raw = normalizeString(x)
  if (!raw) return null

  // Allow local flyer paths (written into /public/flyers)
  if (raw.startsWith("/flyers/")) return raw
  if (raw.startsWith("flyers/")) return `/${raw}`

  // Allow absolute image URLs only (avoid treating arbitrary links as flyer images)
  if (/^https?:\/\//i.test(raw)) {
    const isImageLike = /\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(raw)
    return isImageLike ? raw : null
  }

  return null
}

function normalizeEventLink(x) {
  const raw = normalizeString(x)
  if (!raw) return null

  // Only allow absolute http(s) URLs
  if (!/^https?:\/\//i.test(raw)) return null

  // Canonicalize Instagram post/reel/tv links for consistency (optional but nice)
  try {
    const u = new URL(raw)
    const host = (u.hostname || "").toLowerCase()
    if (host.includes("instagram.com") || host.includes("instagr.am")) {
      const m = u.pathname.match(/^\/(?:[^\/]+\/)?(p|reel|tv)\/([^\/\?#]+)\/?/i)
      if (m) {
        const kind = m[1].toLowerCase()
        const code = m[2]
        return `https://www.instagram.com/${kind}/${code}/`
      }
    }
  } catch {
    // ignore
  }

  return raw
}

function inferEventLinkPlatform(url) {
  const u = normalizeString(url).toLowerCase()
  if (!u) return null
  if (u.includes("instagram.com") || u.includes("instagr.am")) return "ig"
  if (u.includes("facebook.com") || u.includes("fb.com")) return "fb"
  return null
}

function normalizeSocialType(x) {
  const s = normalizeString(x).toLowerCase()
  if (s === "ig" || s === "fb") return s
  return null
}

function inferSocialTypeFromUrl(url) {
  const u = normalizeString(url).toLowerCase()
  if (!u) return null
  if (u.includes("instagram.com")) return "ig"
  if (u.includes("facebook.com")) return "fb"
  return null
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
  try {
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

    // ...

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

  // Dev-only: upload a logo into /public/logos/(venues|partners)
  // Expects JSON: { kind: "venue"|"partner", id: "strummers", filename: "logo.png", dataBase64: "<base64 bytes>" }
  if (req.method === "POST" && req.url === "/api/logos/upload") {
    const body = await readBodyJson(req)
    if (!body) return bad(res, "Invalid JSON")

    const kindRaw = normalizeString(body.kind).toLowerCase()
    const idRaw = normalizeString(body.id)
    const filenameRaw = normalizeString(body.filename)
    const dataBase64 = normalizeString(body.dataBase64)

    if (!kindRaw || !idRaw || !filenameRaw || !dataBase64) {
      return bad(res, "Missing required fields: kind, id, filename, dataBase64")
    }

    const kind = kindRaw === "venue" ? "venues" : kindRaw === "partner" ? "partners" : null
    if (!kind) return bad(res, 'Invalid "kind" (must be "venue" or "partner")')

    // Restrict id to safe filename characters
    const safeId = idRaw
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")

    if (!safeId) return bad(res, "Invalid id")

    // Infer extension from original filename
    const baseName = path.basename(filenameRaw)
    const ext = path.extname(baseName).toLowerCase()

    const okExt =
      ext === ".png" ||
      ext === ".jpg" ||
      ext === ".jpeg" ||
      ext === ".webp" ||
      ext === ".gif"

    if (!okExt) {
      return bad(res, "Logo must be an image file (.png, .jpg, .jpeg, .webp, .gif)")
    }

    const outName = `${safeId}${ext}`
    const outDir = path.join(LOGOS_DIR, kind)

    try {
      await ensureDir(outDir)
      const buf = Buffer.from(dataBase64, "base64")
      await fs.writeFile(path.join(outDir, outName), buf)
      return send(res, 200, { ok: true, path: `/logos/${kind}/${outName}` })
    } catch (err) {
      return bad(res, "Failed to write logo to disk")
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
    const lineup = normalizeOptionalString(body.lineup)

    // Flyer: image only (local /flyers/* or absolute image URL)
    // Link: outbound presence/details (IG/FB/etc). If a social link was pasted into flyer,
    // migrate it into `link` when `link` is empty.
    let flyer = normalizeFlyer(body.flyer)
    let link = normalizeEventLink(body.link)

    const flyerAsLink = normalizeEventLink(body.flyer)
    const flyerPlatform = inferEventLinkPlatform(flyerAsLink)
    if (!link && flyerAsLink && flyerPlatform) {
      link = flyerAsLink
      flyer = null
    }

    const nextEvent = {
      id: ensureEventId(body),
      title,
      date,
      time,
      venueId,
      partnerIds,
      genres,
      lineup,
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
    const lineup = normalizeOptionalString(body.lineup)

    // Flyer: image only (local /flyers/* or absolute image URL)
    // Link: outbound presence/details (IG/FB/etc). If a social link was pasted into flyer,
    // migrate it into `link` when `link` is empty.
    let flyer = normalizeFlyer(body.flyer)
    let link = normalizeEventLink(body.link)

    const flyerAsLink = normalizeEventLink(body.flyer)
    const flyerPlatform = inferEventLinkPlatform(flyerAsLink)
    if (!link && flyerAsLink && flyerPlatform) {
      link = flyerAsLink
      flyer = null
    }


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
  lineup,
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


  // Update Venue
  if (req.method === "POST" && req.url === "/api/venues/update") {
    const body = await readBodyJson(req)
    if (!body) return bad(res, "Invalid JSON")

    const id = normalizeString(body.id)
    const name = normalizeString(body.name)

    const logo = normalizeOptionalString(body.logo)

    const website = normalizeOptionalString(body.website)
    const socialType = normalizeSocialType(body.socialType)
    const socialUrl = normalizeOptionalString(body.socialUrl)

    const address = normalizeOptionalString(body.address)
    const mapLink = normalizeOptionalString(body.mapLink)

    if (!id || !name) {
      return bad(res, "Missing required fields: id, name")
    }

    if (!website && !socialUrl) {
      return bad(res, "Missing required fields: website OR socialUrl")
    }

    if (socialUrl && !socialType) {
      return bad(res, "Missing required field: socialType (ig or fb) when socialUrl is provided")
    }

    const existing = await readJsonArray(VENUES_PATH)
    const idx = existing.findIndex((v) => normalizeString(v.id) === id)
    if (idx === -1) return bad(res, "Venue not found")

    const updated = {
      ...existing[idx],
      id,
      name,
      logo,
      website,
      socialType,
      socialUrl,
      address,
      mapLink,
    }

    const next = [
      ...existing.slice(0, idx),
      updated,
      ...existing.slice(idx + 1),
    ]

    await writeJsonArray(VENUES_PATH, next)
    return send(res, 200, { ok: true, data: next })
  }

  // Delete Venue
  if (req.method === "POST" && req.url === "/api/venues/delete") {
    const body = await readBodyJson(req)
    if (!body) return bad(res, "Invalid JSON")

    const id = normalizeString(body.id)
    if (!id) return bad(res, "Missing required field: id")

    const existing = await readJsonArray(VENUES_PATH)
    const next = existing.filter((v) => normalizeString(v.id) !== id)

    await writeJsonArray(VENUES_PATH, next)
    return send(res, 200, { ok: true, data: next })
  }



   // Add Venue
   // Add Venue
  if (req.method === "POST" && (req.url === "/api/venues" || req.url === "/api/venues/add")) {

    const body = await readBodyJson(req)
    if (!body) return bad(res, "Invalid JSON")

    const id = normalizeString(body.id)
    const name = normalizeString(body.name)

    const logo = normalizeOptionalString(body.logo)

    // New fields (all optional, but at least one outbound link is required)
    const website = normalizeOptionalString(body.website)
    const socialType = normalizeSocialType(body.socialType)
    const socialUrl = normalizeOptionalString(body.socialUrl)

    // Keep these (already used elsewhere in UI)
    const address = normalizeOptionalString(body.address)
    const mapLink = normalizeOptionalString(body.mapLink)

    if (!id || !name) {
      return bad(res, "Missing required fields: id, name")
    }

    // Require at least one outbound presence link
    if (!website && !socialUrl) {
      return bad(res, "Missing required fields: website OR socialUrl")
    }

    // If someone provides a socialUrl, they must pick ig/fb
    if (socialUrl && !socialType) {
      return bad(res, "Missing required field: socialType (ig or fb) when socialUrl is provided")
    }

    const nextVenue = {
      id,
      name,
      logo,
      website,
      socialType,
      socialUrl,
      address,
      mapLink,
    }

    const existing = await readJsonArray(VENUES_PATH)
    const withoutDup = existing.filter((v) => normalizeString(v.id) !== id)
    const next = [nextVenue, ...withoutDup]

    await writeJsonArray(VENUES_PATH, next)
    return send(res, 200, { ok: true, data: next })
  }


  // Update Partner
  if (req.method === "POST" && req.url === "/api/partners/update") {
    const body = await readBodyJson(req)
    if (!body) return bad(res, "Invalid JSON")

    const id = normalizeString(body.id)
    const name = normalizeString(body.name)

    const logo = normalizeOptionalString(body.logo)

    let website = normalizeOptionalString(body.website)
    let socialType = normalizeSocialType(body.socialType)
    let socialUrl = normalizeOptionalString(body.socialUrl)

    // Legacy support: body.link
    const legacyLink = normalizeOptionalString(body.link)
    if (legacyLink && !website && !socialUrl) {
      const inferred = inferSocialTypeFromUrl(legacyLink)
      if (inferred) {
        socialType = inferred
        socialUrl = legacyLink
      } else {
        website = legacyLink
      }
    }

    if (!id || !name) {
      return bad(res, "Missing required fields: id, name")
    }

    if (!website && !socialUrl) {
      return bad(res, "Missing required fields: website OR socialUrl")
    }

    if (socialUrl && !socialType) {
      const inferred = inferSocialTypeFromUrl(socialUrl)
      if (inferred) socialType = inferred
      else return bad(res, "Missing required field: socialType (ig or fb) when socialUrl is provided")
    }

    const existing = await readJsonArray(PARTNERS_PATH)
    const idx = existing.findIndex((p) => normalizeString(p.id) === id)
    if (idx === -1) return bad(res, "Partner not found")

    const updated = {
      ...existing[idx],
      id,
      name,
      logo,
      website,
      socialType,
      socialUrl,
    }

    const next = [
      ...existing.slice(0, idx),
      updated,
      ...existing.slice(idx + 1),
    ]

    await writeJsonArray(PARTNERS_PATH, next)
    return send(res, 200, { ok: true, data: next })
  }

  // Delete Partner
  if (req.method === "POST" && req.url === "/api/partners/delete") {
    const body = await readBodyJson(req)
    if (!body) return bad(res, "Invalid JSON")

    const id = normalizeString(body.id)
    if (!id) return bad(res, "Missing required field: id")

    const existing = await readJsonArray(PARTNERS_PATH)
    const next = existing.filter((p) => normalizeString(p.id) !== id)

    await writeJsonArray(PARTNERS_PATH, next)
    return send(res, 200, { ok: true, data: next })
  }


  // Add Partner
  if (req.method === "POST" && (req.url === "/api/partners" || req.url === "/api/partners/add")) {

    const body = await readBodyJson(req)
    if (!body) return bad(res, "Invalid JSON")

    const id = normalizeString(body.id)
    const name = normalizeString(body.name)

    const logo = normalizeOptionalString(body.logo)

    // New parity fields (optional)
    let website = normalizeOptionalString(body.website)
    let socialType = normalizeSocialType(body.socialType)
    let socialUrl = normalizeOptionalString(body.socialUrl)

    // Legacy support: body.link
    const legacyLink = normalizeOptionalString(body.link)
    if (legacyLink && !website && !socialUrl) {
      const inferred = inferSocialTypeFromUrl(legacyLink)
      if (inferred) {
        socialType = inferred
        socialUrl = legacyLink
      } else {
        website = legacyLink
      }
    }

    if (!id || !name) {
      return bad(res, "Missing required fields: id, name")
    }

    // Require at least one outbound presence link
    if (!website && !socialUrl) {
      return bad(res, "Missing required fields: website OR socialUrl")
    }

    // If someone provides a socialUrl, they must pick ig/fb (or it must be inferrable)
    if (socialUrl && !socialType) {
      const inferred = inferSocialTypeFromUrl(socialUrl)
      if (inferred) socialType = inferred
      else return bad(res, "Missing required field: socialType (ig or fb) when socialUrl is provided")
    }

    const nextPartner = {
      id,
      name,
      logo,
      website,
      socialType,
      socialUrl,
    }

    const existing = await readJsonArray(PARTNERS_PATH)
    const withoutDup = existing.filter((p) => normalizeString(p.id) !== id)
    const next = [nextPartner, ...withoutDup]

    await writeJsonArray(PARTNERS_PATH, next)
    return send(res, 200, { ok: true, data: next })
  }

    // If we got here, nothing matched
  return send(res, 404, { ok: false, error: "Not found" })
    } catch (err) {
    return send(res, 500, { ok: false, error: "Server error" })
  }
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