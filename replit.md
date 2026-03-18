# Patrol Log

A fully offline PWA (Progressive Web App) for logging patrol station and zone times across 12-hour night shifts (18:00–06:00). Works without internet. Can be installed to a phone's home screen.

## Overview

A time-tracking tool for security/patrol workers:
- Add multiple patrol stations with patrol zones
- Log start/end times per zone (manually or via "Now" button)
- Auto-calculates duration per zone
- Copy formatted log text to clipboard
- **100% offline** — data saved instantly to device storage
- **Installable** — add to home screen as an app (PWA)
- **Per-user isolation** — each device/browser has its own data

## Tech Stack

- **Frontend**: React 19 + TypeScript, Vite 6, Tailwind CSS v4
- **PWA**: vite-plugin-pwa with Workbox service worker
- **Storage**: localStorage (instant, offline, per-device)
- **Backend**: Express + SQLite (kept for future use, not used by frontend)
- **Icons**: lucide-react

## Project Structure

```
src/
  App.tsx         - Main React component (all storage via localStorage)
  main.tsx        - React entry point
  index.css       - Global styles
public/
  icon.svg        - App icon (source)
  icon-192.png    - PWA icon 192x192
  icon-512.png    - PWA icon 512x512
server.ts         - Express backend (not used by frontend, kept for reference)
patrol.db         - SQLite database (backend only)
index.html        - HTML shell with PWA meta tags
vite.config.ts    - Vite config with PWA plugin
```

## Data Storage

- Each browser generates a unique `userId` stored in `localStorage`
- Data key: `patrol_log_<userId>_<shiftId>`
- Shift ID: the calendar date when 18:00 begins (e.g. `2024-01-15`)
- If current time is 00:00–05:59, shift date = yesterday

## User Isolation

Each browser/device gets its own randomly-generated `userId`. Users never share or overwrite each other's data, even on the same deployed URL.

## Shift Logic

- Shift runs 18:00–06:00 (12 hours)
- If current time is 00:00–05:59, the shift started the previous day at 18:00

## Development

```bash
npm install
npm run dev          # Vite dev server on port 5000 (frontend)
npm run dev:server   # Express backend on port 3001 (optional, not used by frontend)
```

## Deployment

Configured as a static site (`vite build` → `dist/`). The service worker is only active in the production build — in development, localStorage still works offline.
