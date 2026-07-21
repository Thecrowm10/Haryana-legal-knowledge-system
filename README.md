# Haryana Digital Repository

Role-based legal document management and semantic search portal for Government of Haryana.
Built for HARTRON TOR reference: **TOR-CSO/2026-27/03**

---

## Prerequisites

Make sure the following are installed before starting:

| Tool | Version | Check |
|------|---------|-------|
| [Node.js](https://nodejs.org/) | v18 or higher | `node -v` |
| npm | comes with Node.js | `npm -v` |
| Git | any recent version | `git --version` |

---

## Setup on a New System

### Step 1 — Clone the repository

```bash
git clone https://github.com/Thecrowm10/Haryana-legal-knowledge-system.git
cd Haryana-legal-knowledge-system
```

### Step 2 — Install dependencies

```bash
npm install
```

This installs React, Vite, PDF.js, Recharts, D3, Axios, and all other packages listed in `package.json`.

### Step 3 — Configure backend URL (if using live backend)

Open `vite.config.js` and update the proxy target to your backend server:

```js
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8000',  // change this to your backend URL
      changeOrigin: true,
    },
  },
},
```

> If you are running **frontend only (demo mode)**, skip this step — the app works with mock data out of the box.

### Step 4 — Start the development server

```bash
npm run dev
```

App will be available at: **http://localhost:5173**

---

## Login Credentials

| Role | Username | Password | Access |
|------|----------|----------|--------|
| Document Uploader | `dept.uploader` | `upload123` | Upload & manage documents |
| Approver | `dept.approver` | `approve123` | Review, approve, reject |
| CS Office | `cs.office` | `admin123` | Analytics & oversight |
| IT Admin | `sys.admin` | `admin123` | User & system management |
| Auditor | `auditor.user` | `audit123` | Audit logs only |

> **Citizen / Public Access** — No login required. Click "Public Access" on the landing page.

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (localhost:5173) |
| `npm run build` | Build for production (output: `dist/`) |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint checks |

---

## Project Structure

```
hlks-demo/
├── public/
│   └── docs/               # Static PDF documents served directly
├── src/
│   ├── assets/             # Images and static assets
│   ├── components/
│   │   ├── layout/         # Sidebar, Topbar, Layout wrapper
│   │   ├── ui/             # Shared UI components (Badge, Card, SelectField)
│   │   └── NotificationBell.jsx
│   ├── data/
│   │   └── mockData.js     # Seed documents, audit logs, analytics data
│   ├── hooks/
│   │   └── useAuth.js      # Authentication logic (JWT decode + API login)
│   ├── pages/              # One file per role dashboard
│   │   ├── Login.jsx
│   │   ├── CitizenDashboard.jsx
│   │   ├── UploaderDashboard.jsx
│   │   ├── ApproverDashboard.jsx
│   │   ├── CSODashboard.jsx
│   │   ├── AdminDashboard.jsx
│   │   └── AuditorDashboard.jsx
│   ├── services/           # All API calls (axios)
│   │   ├── api.js          # Axios instance with auth interceptor
│   │   ├── pdf.js          # Upload, review, search endpoints
│   │   ├── departments.js  # Department & document type endpoints
│   │   ├── users.js        # User management endpoints
│   │   ├── analytics.js    # Analytics endpoints
│   │   └── notifications.js # Local notification store (localStorage)
│   └── App.jsx             # Root component, role-based routing, shared state
├── vite.config.js          # Vite config with API proxy
└── package.json
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend Framework | React 19 + Vite |
| Charts | Recharts |
| Graph Visualization | D3.js |
| PDF Rendering | PDF.js (pdfjs-dist) |
| Icons | Lucide React |
| HTTP Client | Axios |
| Fonts | Plus Jakarta Sans |

---

## Backend Integration

The frontend is fully API-ready. By default it connects to `http://localhost:8000/api/v1`.

To connect to a real backend:

1. Update the proxy in `vite.config.js`:
   ```js
   target: 'http://your-backend-server:port'
   ```

2. Make sure your backend exposes these endpoints:

   | Endpoint | Method | Description |
   |----------|--------|-------------|
   | `/api/v1/auth/login` | POST | Returns JWT token |
   | `/api/v1/pdf/upload-file` | POST | Upload PDF file |
   | `/api/v1/pdf/upload` | POST | Save document metadata |
   | `/api/v1/pdf/my-documents` | GET | Uploader's own documents |
   | `/api/v1/pdf/approver/documents` | GET | All docs for approver |
   | `/api/v1/pdf/review` | POST | Approve or reject a document |
   | `/api/v1/pdf/search-documents` | GET | Search documents |

3. Login with real credentials created in your backend — the mock credentials above will not work once backend is live.

---

## Notifications

Notifications between uploader and approver are stored in the browser's **localStorage** (no backend endpoint needed). They reset when browser data is cleared.

- Uploader uploads a document → Approver gets a bell notification
- Approver approves/rejects → Uploader gets a notification with remarks

---

## Common Issues

| Problem | Fix |
|---------|-----|
| `npm install` fails | Make sure Node.js v18+ is installed |
| App shows blank page | Check browser console for errors; run `npm run dev` again |
| Login fails with real credentials | Confirm backend is running and proxy URL in `vite.config.js` is correct |
| PDF not loading | Check that the file exists under `public/docs/` |
| Port 5173 already in use | Run `npm run dev -- --port 3000` to use a different port |
