// HTTP-palvelin taloni-tietokannalle (issue #32). Node:n sisäänrakennettu http-moduuli — ei uutta
// riippuvuutta. Yksi jaettu API-avain (ks. auth.ts) suojaa kaikkia reittejä paitsi /health.
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http'
import * as db from '../db/index.js'
import {
  extractBearerToken,
  isValidApiKey,
  loadOrCreateApiKeys,
} from './auth.js'
import { findResource, RESOURCES } from './router.js'

const MAX_BODY_BYTES = 1_000_000 // 1 MB — riittää yksittäiselle tietueelle, estää muistin loppumisen

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body, null, 2)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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

export interface ServerOptions {
  host: string
  port: number
}

export function createApiServer(opts: ServerOptions) {
  const apiKeys = loadOrCreateApiKeys()
  db.initDb()

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

      // Auth — kaikki muut reitit paitsi /health vaativat kelvollisen Bearer-tokenin.
      const token = extractBearerToken(req.headers.authorization)
      if (!token || !isValidApiKey(token, apiKeys)) {
        sendJson(res, 401, { error: 'Puuttuva tai virheellinen API-avain' })
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
