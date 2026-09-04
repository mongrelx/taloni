// Kopioi rakennetun web-UI:n (web/dist) dist/web:iin, jotta src/api/server.ts löytää sen samasta
// suhteellisesta polusta sekä paikallisesti (node dist/cli.js serve) että Dockerissa.
import { cpSync, existsSync } from 'node:fs'

if (!existsSync('web/dist')) {
  console.error('web/dist puuttuu — aja ensin "npm run build:web".')
  process.exit(1)
}
cpSync('web/dist', 'dist/web', { recursive: true })
console.log('Kopioitu: web/dist -> dist/web')
