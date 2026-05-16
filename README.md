# MP Financial Interests Tracker

A self-hosted web app that pulls declared financial interests for UK MPs from the [Register of Members' Financial Interests](https://www.parliament.uk/mps-lords-and-offices/standards-and-financial-interests/parliamentary-commissioner-for-standards/registers-of-interests/register-of-members-financial-interests/), cross-references companies with [Companies House](https://companieshouse.gov.uk), and visualises the data as a bar chart, force-directed network graph, treemap, and itemised breakdown.

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)
- A **Companies House API key** (free — see below)

---

## Getting a Companies House API key

1. Go to **[developer.company-information.service.gov.uk](https://developer.company-information.service.gov.uk)**
2. Click **Sign in / Register** and create a free account
3. Once logged in, go to **Your applications** → **Create an application**
4. Give it any name (e.g. "MP Tracker"), select **Live** environment
5. Under **API keys**, click **Create key**
6. Copy the key — you'll need it in the next step

---

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/RGaskinLtd/mp-investments-lookup.git
cd mp-investments-lookup
```

### 2. Create your `.env` file

```bash
cp .env.example .env
```

Open `.env` and paste your Companies House API key:

```env
COMPANIES_HOUSE_API_KEY=your_key_here
```

### 3. Start everything with Docker

```bash
docker compose up --build
```

This starts three containers:
| Container | Port | Description |
|-----------|------|-------------|
| `db` | 5432 | PostgreSQL database (auto-migrated on first run) |
| `server` | 3001 | Node/Express API |
| `frontend` | 3000 | Nuxt 3 SPA |

First build takes ~2–3 minutes. Subsequent starts are fast.

### 4. Open the app

Navigate to **[http://localhost:3000](http://localhost:3000)**

---

## Usage

1. **Select a party** from the dropdown (fetched live from the Parliament API)
2. **Drag the slider** to choose how many MPs to load (5–50)
3. Click **Load data**
4. Switch between views using the tabs: **Bar chart**, **Network**, **Treemap**, **Investments**
5. Use the **Red Flag watchlist** to mark companies of interest — any MP with a matching declared investment will be highlighted across all views

> **Note:** The first load for a party fetches all MPs and their interests from the Parliament API, which can take 10–30 seconds. Results are cached in PostgreSQL for 24 hours, so subsequent loads are instant.

---

## Accessing on your local network (e.g. from a phone)

Find your machine's local IP (e.g. `192.168.1.x`) and open:

```
http://192.168.1.x:3000
```

The frontend proxies all API requests server-side, so no CORS or cross-origin issues.

---

## Stopping

```bash
docker compose down
```

To also delete the cached database data:

```bash
docker compose down -v
```

---

## Data sources

| Source | What it provides |
|--------|-----------------|
| [UK Parliament Members API](https://members-api.parliament.uk) | MP names, parties, constituencies, photos, and declared financial interests |
| [Companies House API](https://developer.company-information.service.gov.uk) | Company status and SIC codes for cross-referencing declared interests |

All data is cached locally in PostgreSQL with a 24-hour TTL. No data is sent to any third-party service beyond the two APIs above.

---

---

## Deploying to Vercel + Neon (free)

The app can run entirely on Vercel (frontend + API) with [Neon](https://neon.tech) for the database. No separate backend server needed.

### 1. Create a Neon database

1. Sign up at **[neon.tech](https://neon.tech)** (free tier is fine)
2. Create a new project — choose the region closest to your users
3. Copy the **Connection string** (looks like `postgres://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`)

### 2. Deploy to Vercel

1. Push the repo to GitHub (already done)
2. Go to **[vercel.com](https://vercel.com)** → **Add New Project** → import from GitHub
3. On the **Configure Project** screen set:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Nuxt.js (auto-detected)
4. Under **Environment Variables**, add:
   | Name | Value |
   |------|-------|
   | `DATABASE_URL` | your Neon connection string |
   | `COMPANIES_HOUSE_API_KEY` | your Companies House API key |
5. Click **Deploy**

> **Note on first load:** The first time a party is loaded, the app fetches all MPs from the Parliament API (~20 requests). This may take 15–30 seconds. Vercel's Pro plan allows up to 60-second function timeouts; the Hobby plan caps at 10 seconds, which may timeout on cold first loads. After the first load, everything is cached in Neon and subsequent loads are instant.

---

## Tech stack

- **Backend:** Nuxt 3 Nitro (API routes) · PostgreSQL (local) / Neon (Vercel)
- **Frontend:** Nuxt 3 (SPA mode) · Vue 3 · D3.js · ECharts · Chart.js
- **Infrastructure:** Docker Compose (local) · Vercel + Neon (production)
