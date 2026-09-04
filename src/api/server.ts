// HTTP-palvelin taloni-tietokannalle (issue #32) ja web-käyttöliittymälle. Node:n sisäänrakennettu
// http-moduuli — ei uutta ajonaikaista riippuvuutta. Yksi jaettu API-avain (ks. auth.ts) suojaa
// /api/*-reittejä; /health ja staattinen web-UI ovat julkisia (UI ei sisällä salaisuuksia — avain
// syötetään selaimessa ja tallentuu vain käyttäjän omaan localStorageen).
import { existsSync, readFileSync } from 'node:fs'
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http'
import { homedir } from 'node:os'
import { basename, extname, join, normalize } from 'node:path'
import * as db from '../db/index.js'
import {
  energyEfficiencyReport,
  portfolioReport,
  renovationBudgetReport,
  upcomingObligations,
} from '../report.js'
import {
  extractBearerToken,
  isValidApiKey,
  loadOrCreateApiKeys,
} from './auth.js'
import { findResource, RESOURCES } from './router.js'

const MAX_BODY_BYTES = 1_000_000 // 1 MB — riittää yksittäiselle tietueelle, estää muistin loppumisen

// Kausikatsausten tarkistuslistapohjat — sama sisältö kuin TUI:n SEASONAL_TEMPLATES
// (src/ui/Dashboard.tsx), kopioitu tähän koska TUI-komponentti ei ole jaettu moduuli.
const SEASONAL_TEMPLATES = {
  spring: {
    label: 'Kevätavaus',
    category: 'Kevätavaus',
    month: '05',
    day: '15',
    tasks: [
      'Avaa päävesihana ja tarkista vuodot',
      'Käynnistä vesipumppu ja ilmaa putket',
      'Ota kaivovesinäyte / tarkista veden laatu',
      'Kytke sähköt ja sulakkeet päälle',
      'Tarkista katto, räystäät ja rakenteet talven jäljiltä',
      'Poista pakkasneste hajulukoista ja WC:stä',
      'Tarkista tulisijat ja piippu ennen käyttöä',
    ],
  },
  autumn: {
    label: 'Syyssulku',
    category: 'Syyssulku',
    month: '10',
    day: '01',
    tasks: [
      'Sulje päävesihana',
      'Tyhjennä vesijärjestelmä ja putkistot',
      'Lisää pakkasneste hajulukkoihin ja WC-pönttöön',
      'Tyhjennä ja sulata jääkaappi / pakastin',
      'Katkaise turhat sähköt, jätä peruslämpö päälle',
      'Sulje kaasupullot ja tarkista paloturvallisuus',
      'Vie roskat ja tarkista jätevesisäiliön taso',
    ],
  },
} as const

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body, null, 2)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  })
  res.end(text)
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Pyynnön runko on liian suuri (max 1 MB)'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new Error('Pyynnön runko ei ole kelvollista JSONia'))
      }
    })
    req.on('error', reject)
  })
}

// --- Staattinen web-UI ---

// Löytää rakennetun web-UI:n hakemiston sekä kehityksessä (tsx, src/api/server.ts) että
// tuotannossa (tsup:n bundlaama dist/cli.js, jonka viereen `npm run build` kopioi web/dist:n).
function resolveWebDistDir(): string | null {
  const candidates = [
    join(import.meta.dirname, 'web'), // tuotanto: dist/cli.js viereen kopioitu web/
    join(import.meta.dirname, '..', '..', 'web', 'dist'), // kehitys: src/api/ -> juuri -> web/dist
  ]
  return candidates.find((c) => existsSync(join(c, 'index.html'))) ?? null
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
}

// Palvelee web-UI:n staattiset tiedostot polkuliikkeen (path traversal) estäen; tuntemattomat
// polut palautuvat index.html:ään (SPA-reititys / suora syväreitille lataus).
function serveStatic(
  res: ServerResponse,
  webDistDir: string,
  pathname: string,
): void {
  const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, '')
  const filePath = join(webDistDir, safePath)
  const target =
    filePath.startsWith(webDistDir) && existsSync(filePath) && safePath !== '/'
      ? filePath
      : join(webDistDir, 'index.html')
  const ext = extname(target)
  const body = readFileSync(target)
  res.writeHead(200, {
    'Content-Type': MIME_TYPES[ext] ?? 'application/octet-stream',
    'Content-Length': body.length,
  })
  res.end(body)
}

export interface ServerOptions {
  host: string
  port: number
}

export function createApiServer(opts: ServerOptions) {
  const apiKeys = loadOrCreateApiKeys()
  db.initDb()
  const webDistDir = resolveWebDistDir()

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(
        req.url ?? '/',
        `http://${req.headers.host ?? 'localhost'}`,
      )
      const segments = url.pathname.split('/').filter(Boolean)

      if (req.method === 'OPTIONS') {
        sendJson(res, 204, null)
        return
      }
      if (
        req.method === 'GET' &&
        segments.length === 1 &&
        segments[0] === 'health'
      ) {
        sendJson(res, 200, { status: 'ok' })
        return
      }

      // Web-UI: kaikki ei-/api-polut palvelevat staattista käyttöliittymää (ei vaadi API-avainta —
      // UI itse pyytää avaimen selaimessa ja liittää sen omiin /api-kutsuihinsa).
      if (req.method === 'GET' && segments[0] !== 'api') {
        if (webDistDir) {
          serveStatic(res, webDistDir, url.pathname)
        } else {
          sendJson(res, 404, {
            error:
              'Web-UI ei ole rakennettu (web/dist puuttuu) — aja "npm run build" web-hakemistossa.',
          })
        }
        return
      }

      // Auth — kaikki /api/*-reitit vaativat kelvollisen Bearer-tokenin.
      const token = extractBearerToken(req.headers.authorization)
      if (!token || !isValidApiKey(token, apiKeys)) {
        sendJson(res, 401, { error: 'Puuttuva tai virheellinen API-avain' })
        return
      }

      // GET /api/reports/* — samat raportit kuin CLI:ssä (portfolio/alerts/renovations/energy),
      // nyt myös web-UI:n ja muiden asiakkaiden käytettävissä. Ei kirjoita mitään.
      if (req.method === 'GET' && segments[1] === 'reports') {
        const report = segments[2]
        const year = url.searchParams.has('year')
          ? Number(url.searchParams.get('year'))
          : new Date().getFullYear()
        if (report === 'portfolio') {
          sendJson(res, 200, portfolioReport(year))
          return
        }
        if (report === 'alerts') {
          const days = url.searchParams.has('days')
            ? Number(url.searchParams.get('days'))
            : 30
          sendJson(res, 200, upcomingObligations(days))
          return
        }
        if (report === 'renovations') {
          sendJson(res, 200, renovationBudgetReport())
          return
        }
        if (report === 'energy') {
          sendJson(res, 200, energyEfficiencyReport(year))
          return
        }
        // Jätevesijärjestelmien vaatimustenmukaisuusarvio (VNa 157/2017) — sama assessWastewater()
        // jota TUI käyttää, ei uudelleentoteutettu selaimessa. Valinnainen ?property_id= rajaa.
        if (report === 'wastewater') {
          const propertyId = url.searchParams.has('property_id')
            ? Number(url.searchParams.get('property_id'))
            : undefined
          const systems = db.getWastewaterSystems(propertyId)
          sendJson(
            res,
            200,
            systems.map((w) => ({ ...w, assessment: db.assessWastewater(w) })),
          )
          return
        }
        // Kompostoinnin ilmoitusvelvollisuus (jätelaki 646/2011) — sama assessComposting() jota
        // TUI käyttää; palauttaa vain kiinteistöt joilla on kotikompostointi (muille assessment on null).
        if (report === 'composting') {
          const rows = db
            .getProperties()
            .map((p) => ({
              property_id: p.id,
              propertyName: p.name,
              assessment: db.assessComposting(p),
            }))
            .filter((r) => r.assessment !== null)
          sendJson(res, 200, rows)
          return
        }
        sendJson(res, 404, {
          error: `Tuntematon raportti: ${report ?? ''}`,
          available: [
            'portfolio',
            'alerts',
            'renovations',
            'energy',
            'wastewater',
            'composting',
          ],
        })
        return
      }

      if (segments.length === 0 || segments[0] !== 'api') {
        sendJson(res, 404, {
          error: 'Ei löytynyt',
          available: ['/health', ...RESOURCES.map((r) => `/api/${r.path}`)],
        })
        return
      }

      // PATCH /api/tasks/:id/status — toistuvuusmoottorin laukaiseva erikoisreitti (ei geneerinen CRUD).
      if (
        req.method === 'PATCH' &&
        segments.length === 4 &&
        segments[1] === 'tasks' &&
        segments[3] === 'status'
      ) {
        const id = Number(segments[2])
        const body = (await readJsonBody(req)) as { status?: string }
        if (
          !Number.isInteger(id) ||
          (body.status !== 'pending' &&
            body.status !== 'in_progress' &&
            body.status !== 'completed')
        ) {
          sendJson(res, 400, {
            error: 'status tulee olla pending|in_progress|completed',
          })
          return
        }
        db.updateTaskStatus(id, body.status)
        sendJson(res, 200, db.getTasks().find((t) => t.id === id) ?? null)
        return
      }

      // POST /api/fireplaces/bulk-sweep — kertanuohous koko kiinteistölle (ei geneerinen CRUD).
      // Sama advanceRecurrence('yearly')-logiikka jota TUI käyttää, ei uudelleentoteutettu selaimessa.
      if (
        req.method === 'POST' &&
        segments.length === 3 &&
        segments[1] === 'fireplaces' &&
        segments[2] === 'bulk-sweep'
      ) {
        const body = (await readJsonBody(req)) as {
          property_id?: number
          date?: string
          excluded_ids?: number[]
        }
        if (!Number.isInteger(body.property_id) || !body.date) {
          sendJson(res, 400, {
            error: 'property_id (number) ja date (YYYY-MM-DD) vaaditaan',
          })
          return
        }
        const excluded = new Set(body.excluded_ids ?? [])
        const nextSweep = db.advanceRecurrence(body.date, 'yearly')
        let done = 0
        for (const f of db.getFireplaces(body.property_id)) {
          if (excluded.has(f.id)) continue
          db.updateFireplace({
            ...f,
            last_sweep: body.date,
            next_sweep: nextSweep,
          })
          done++
        }
        sendJson(res, 200, { done, excluded: excluded.size })
        return
      }

      // POST /api/bookings/:id/record-income — kirjaa varauksen vuokratulon taloustapahtumaksi
      // (ei geneerinen CRUD). Sama sääntö kuin TUI:n recordBookingIncome(): ei peruttuja varauksia,
      // ei kaksoiskirjausta, ei nollahintaisia.
      if (
        req.method === 'POST' &&
        segments.length === 4 &&
        segments[1] === 'bookings' &&
        segments[3] === 'record-income'
      ) {
        const id = Number(segments[2])
        const booking = db.getBookings().find((b) => b.id === id)
        if (!booking) {
          sendJson(res, 404, { error: `Ei löytynyt: bookings/${segments[2]}` })
          return
        }
        if (booking.status === 'cancelled') {
          sendJson(res, 400, { error: 'Peruttua varausta ei kirjata tuloksi.' })
          return
        }
        if (booking.income_recorded) {
          sendJson(res, 400, {
            error: 'Tämän varauksen tulo on jo kirjattu.',
          })
          return
        }
        if (booking.price <= 0) {
          sendJson(res, 400, {
            error: 'Varauksella ei ole hintaa — ei kirjattavaa tuloa.',
          })
          return
        }
        db.addTransaction({
          property_id: booking.property_id,
          type: 'income',
          category: 'Vuokraus',
          amount: booking.price,
          date: booking.start_date,
          description: `Vuokratulo: ${booking.guest_name} (${booking.start_date}–${booking.end_date})`,
          renovation_id: null,
        })
        db.updateBooking({ ...booking, income_recorded: 1 })
        sendJson(res, 200, db.getBookings().find((b) => b.id === id) ?? null)
        return
      }

      // POST /api/bookings/seasonal-checklist — Kevätavaus/Syyssulku-tarkistuslistan luonti
      // tehtävinä (ei geneerinen CRUD). Sama SEASONAL_TEMPLATES-sisältö kuin TUI:ssa, ei
      // uudelleentoteutettu selaimessa eri sisällöllä.
      if (
        req.method === 'POST' &&
        segments.length === 3 &&
        segments[1] === 'bookings' &&
        segments[2] === 'seasonal-checklist'
      ) {
        const body = (await readJsonBody(req)) as {
          property_id?: number
          season?: 'spring' | 'autumn'
        }
        if (
          !Number.isInteger(body.property_id) ||
          (body.season !== 'spring' && body.season !== 'autumn')
        ) {
          sendJson(res, 400, {
            error: 'property_id (number) ja season (spring|autumn) vaaditaan',
          })
          return
        }
        const tpl = SEASONAL_TEMPLATES[body.season]
        const year = new Date().getFullYear()
        const due = `${year}-${tpl.month}-${tpl.day}`
        for (const title of tpl.tasks) {
          db.addTask({
            property_id: body.property_id as number,
            title,
            status: 'pending',
            priority: 'medium',
            due_date: due,
            category: tpl.category,
            cost: 0,
            recurrence: 'none',
            next_due: null,
          })
        }
        sendJson(res, 200, {
          label: tpl.label,
          created: tpl.tasks.length,
          dueDate: due,
        })
        return
      }

      // GET /api/documents/:id/file — palvelee asiakirjan tiedoston (ei geneerinen CRUD). Vastaa
      // TUI:n [o] openFileWithOS():ia; polku tulee AINA tietokannan document.file_path-kentästä,
      // ei koskaan URL:sta, joten pyyntö ei voi kohdistua mielivaltaiseen palvelimen polkuun URLin
      // kautta (avaimen haltijalla on joka tapauksessa täysi luku/kirjoitusoikeus koko kantaan).
      if (
        req.method === 'GET' &&
        segments.length === 4 &&
        segments[1] === 'documents' &&
        segments[3] === 'file'
      ) {
        const id = Number(segments[2])
        const doc = db.getDocuments().find((d) => d.id === id)
        if (!doc) {
          sendJson(res, 404, { error: `Ei löytynyt: documents/${segments[2]}` })
          return
        }
        const path = doc.file_path.trim()
        const expanded = path.startsWith('~')
          ? path.replace(/^~/, homedir())
          : path
        if (!path || !existsSync(expanded)) {
          sendJson(res, 404, {
            error: 'Tiedostoa ei löytynyt palvelimen tiedostojärjestelmästä.',
          })
          return
        }
        const body = readFileSync(expanded)
        const ext = extname(expanded)
        res.writeHead(200, {
          'Content-Type': MIME_TYPES[ext] ?? 'application/octet-stream',
          'Content-Length': body.length,
          'Content-Disposition': `inline; filename="${basename(expanded).replace(/"/g, '')}"`,
        })
        res.end(body)
        return
      }

      const resourcePath = segments[1]
      const resource = resourcePath ? findResource(resourcePath) : undefined
      if (!resource) {
        sendJson(res, 404, {
          error: `Tuntematon resurssi: ${resourcePath ?? ''}`,
          available: RESOURCES.map((r) => r.path),
        })
        return
      }

      const idSegment = segments[2]
      const propertyIdParam = url.searchParams.get('property_id')
      const propertyId =
        !resource.globalOnly && propertyIdParam
          ? Number(propertyIdParam)
          : undefined

      if (req.method === 'GET' && idSegment === undefined) {
        sendJson(res, 200, resource.list(propertyId))
        return
      }
      if (req.method === 'GET' && idSegment !== undefined) {
        const id = Number(idSegment)
        const item = resource.list().find((x) => x.id === id)
        if (!item) {
          sendJson(res, 404, {
            error: `Ei löytynyt: ${resource.path}/${idSegment}`,
          })
          return
        }
        sendJson(res, 200, item)
        return
      }
      if (req.method === 'POST' && idSegment === undefined) {
        const body = (await readJsonBody(req)) as Record<string, unknown>
        resource.create(body)
        // Paras arvio juuri luodusta tietueesta: uusin id samassa (mahdollisessa) property_id-
        // rajauksessa. Toimii luotettavasti yhden kirjoittajan käytössä; ei atomista taatusti
        // samanaikaisissa kirjoituksissa samaan resurssiin.
        const scope = !resource.globalOnly
          ? (body.property_id as number | undefined)
          : undefined
        const created = resource
          .list(scope)
          .reduce(
            (max, cur) => (cur.id > (max?.id ?? -1) ? cur : max),
            undefined as { id: number } | undefined,
          )
        sendJson(res, 201, created ?? { ok: true })
        return
      }
      if (req.method === 'PUT' && idSegment !== undefined) {
        const id = Number(idSegment)
        const body = (await readJsonBody(req)) as Record<string, unknown>
        resource.update({ ...body, id })
        const updated = resource.list().find((x) => x.id === id)
        sendJson(res, 200, updated ?? { ok: true })
        return
      }
      if (req.method === 'DELETE' && idSegment !== undefined) {
        const id = Number(idSegment)
        resource.remove(id)
        sendJson(res, 204, null)
        return
      }

      sendJson(res, 405, {
        error: `Metodia ${req.method} ei tueta tälle reitille`,
      })
    } catch (e) {
      sendJson(res, 400, { error: (e as Error).message })
    }
  })

  return {
    listen: () =>
      new Promise<void>((resolve) => {
        server.listen(opts.port, opts.host, () => resolve())
      }),
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
    server,
  }
}
