# ───────────────────────────────────────────────────
# Stage 1 — build
# ───────────────────────────────────────────────────
FROM node:20-slim AS build

# Install OS-level deps needed by argon2, sharp, exiftool
RUN apt-get update && apt-get install -y --no-install-recommends \
    libvips-dev \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js
RUN npm run build

# ───────────────────────────────────────────────────
# Stage 2 — runtime
# ───────────────────────────────────────────────────
FROM node:20-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    libvips \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./

EXPOSE 3000

# Run DB migrations, then start app
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
