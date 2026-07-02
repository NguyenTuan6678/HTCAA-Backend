# =========================
# 1. Build stage
# =========================
FROM --platform=linux/amd64 node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build


# =========================
# 2. Production stage
# =========================
FROM --platform=linux/amd64 node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./

RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

RUN mkdir -p files invoice logs/audit

EXPOSE 4000

CMD ["npm", "run", "start:prod"]
