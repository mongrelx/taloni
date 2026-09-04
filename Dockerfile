# taloni REST API — production image (issue #18/#32).
# Runs `taloni serve`; the interactive TUI is not meant to run in a container.
#
# Node >= 22.5 is required for the native node:sqlite module used throughout the app.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsup.config.ts ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist

# Luodaan tietokantahakemisto ja asetetaan omistajuus ENNEN node-käyttäjään vaihtoa — muuten
# Dockerin nimetty volyymi luodaan juurikäyttäjän omistamana eikä node-käyttäjä (uid 1000) pysty
# kirjoittamaan sinne (initDb() epäonnistuu: "unable to open database file").
RUN mkdir -p /home/node/.taloni && chown -R node:node /home/node/.taloni

# Käytetään node-käyttäjää (uid 1000, jo olemassa virallisessa node-imagessa) — ei rootina ajoa.
USER node
ENV HOME=/home/node
ENV TALONI_API_HOST=0.0.0.0
ENV TALONI_API_PORT=3000

# Tietokanta ja API-avain elävät täällä — liitä pysyvä volyymi tähän polkuun tuotannossa,
# muuten data häviää kontin poistuessa.
VOLUME ["/home/node/.taloni"]

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+ (process.env.TALONI_API_PORT||3000) +'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/cli.js", "serve"]
