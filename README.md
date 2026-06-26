# HTCAA Backend API 🚀

A robust, enterprise-grade RESTful API built with **NestJS**, **MongoDB**, and **MinIO Object Storage**, designed to handle content management, secure document streaming, user authentication, and system communications.

---

## 🌟 Features

* **Authentication & Authorization**: Role-based access control with secure JWT access/refresh token rotation.
* **Document & Content Management**: Publish/unpublish flows for Legal Documents, FAQ categories, and general publications.
* **Secure File Storage**: Deeply integrated with **MinIO** storage to handle streaming file downloads, custom previews, and media asset hosting.
* **User Communications**: Newsletter/Contact submissions with automated status validation and admin review queues.
* **Security Hardening**:
  * **Helmet** header protection integrated.
  * Robust, dynamic CORS mapping supporting credentialed origins.
  * Input sanitization and Regular Expression Denial of Service (ReDoS) protection on search parameters.
  * Mongoose output filters to prevent PII exposure (e.g., hiding password hashes and refresh token signatures).
  * Pure-JS `bcryptjs` migration to ensure compile-free portability.
* **Documentation**: Automated, live endpoint docs powered by **Swagger UI**.

---

## 🛠️ Technology Stack

* **Core Framework**: NestJS (TypeScript)
* **Database**: MongoDB (via Mongoose ODM)
* **Caching**: Redis (available for key/value cache queues)
* **Object Storage**: MinIO (S3-compatible)
* **Security & Auth**: Passport JWT, Helmet, bcryptjs
* **Email Dispatcher**: Resend API Integration

---

## 📦 Prerequisite Services

Ensure you have the following installed locally or accessible in your cloud setup:
1. **Node.js**: `v18+` (LTS recommended)
2. **MongoDB**: A running instance (local or Atlas cloud cluster)
3. **Docker**: (Optional, for running local MinIO/Redis instances)

---

## ⚙️ Environment Configuration

1. Copy the environment configuration template:
   ```bash
   cp .env-example .env
   ```
2. Open `.env` and fill in your connection details:
   - **`PORT`**: Server port (default: `4000`)
   - **`MONGODB_URI`**: MongoDB Connection string
   - **`JWT_ACCESS_SECRET` & `JWT_REFRESH_SECRET`**: High-entropy strings for securing tokens
   - **`MINIO_*`**: Configuration for accessing S3 buckets (host endpoint, credentials, bucket name)
   - **`RESEND_API_KEY`**: API token for email capabilities

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Supporting Services (Docker)
A basic `docker-compose.yml` is provided for running MinIO locally:
```bash
docker-compose up -d
# If your MinIO container is stopped, wake it up:
docker start minio
```

### 3. Run the Application
```bash
# Development / Hot-Reload mode
npm run start:dev

# Production build and run
npm run build
npm run start:prod
```

Once running successfully, the cute ASCII startup card will print:
```text
 █   █  █████  █   █  █████  █   █   ██   ██
 ██ ██    █    █  █   █   █  ██  █  ████ ████
 █ █ █    █    ███    █████  █ █ █  █████████
 █   █    █    █  █   █   █  █  ██   ███████
 █   █  █████  █   █  █   █  █   █    █████
                                        ███
```

---

## 📚 API Documentation

Once the server has started, navigate to:
* **Swagger API UI**: [http://localhost:4000/api/docs](http://localhost:4000/api/docs)

This page provides interactive testing tools for all controllers, payloads, schemas, and response validation.

---

## 📁 Directory Structure

```text
src/
├── app.module.ts           # Central root module registering database, helmet, & feature domains
├── main.ts                 # Bootstrap server script setting up CORS, Helmet, and global interceptors
├── banner/                 # Core server banner and ASCII console status cards
├── utils/                  # Shared helper utilities (e.g. regex safety filters)
├── schema/                 # Mongoose database models & entity hooks
├── module/                 # Feature components
│   ├── news/               # Publications, slugs, and thumbnail media bindings
│   ├── legal-docs/         # Categorized documents, downloads, and preview builders
│   ├── faqs/               # Help center questions, rating modules, and categories
│   ├── minio/              # Upload adapters and pre-signed S3 stream generators
│   └── contact/            # Support ticket submissions and status queues
└── users/                  # User accounts, CurrentUser types, and Authentication modules
```

---

## 🔒 Security Practices & Conventions

When editing or creating new components in this codebase, ensure you maintain these standards:
1. **Password Hashing**: Always import `bcryptjs` (do NOT use native `bcrypt` as it fails cross-compiling in CI pipelines).
2. **Decorator Injection**: Use the `@CurrentUser('id')` and `@CurrentUser('role')` parameters instead of manual parsing from the Express Request object.
3. **Database Queries**: Sanitize all incoming client search strings using the regex-escaping helper to avoid ReDoS vulnerability issues:
   ```typescript
   import { escapeRegex } from '../../utils/escape-regex';
   const safeQuery = escapeRegex(userInputString);
   ```
4. **File Streams**: Never return a raw JSON structure directly inside stream response routes. In case of access errors, throw standard Nest HTTP exceptions so the error middleware handles response headers correctly.

---

## 📄 License
This codebase is [MIT licensed](LICENSE).
