# Haryana State Legal Knowledge System (HLKS)

Role-based legal document management and semantic search portal for Government of Haryana.
Built for HARTRON TOR reference: **TOR-CSO/2026-27/03**

---

## Prerequisites

Make sure these are installed on your system before starting:

- [Node.js](https://nodejs.org/) v18 or higher
- npm (comes with Node.js)

To check if already installed:
```bash
node -v
npm -v
```

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Thecrowm10/Haryana-legal-knowledge-system.git
cd Haryana-legal-knowledge-system
```

### 2. Install dependencies

```bash
npm install
```

### 3. Run the development server

```bash
npm run dev
```

App will open at: **http://localhost:5173**

---

## Login Credentials

The app currently runs on mock data. Use these credentials to access each role:

| Role | Username | Password |
|------|----------|----------|
| Document Uploader | `dept.uploader` | `upload123` |
| Approver | `dept.approver` | `approve123` |
| CS Office | `cs.office` | `admin123` |
| Admin | `sys.admin` | `admin123` |
| Auditor | `auditor.user` | `audit123` |

> **Citizen portal** — No login required. Click "Public Access" on the landing page.

---

## Project Structure

```
src/
├── pages/              # One file per role dashboard
│   ├── Login.jsx
│   ├── CitizenDashboard.jsx
│   ├── UploaderDashboard.jsx
│   ├── ApproverDashboard.jsx
│   ├── CSODashboard.jsx
│   ├── AdminDashboard.jsx
│   └── AuditorDashboard.jsx
├── components/
│   ├── layout/         # Sidebar, Topbar, Layout wrapper
│   └── ui/             # Shared UI components (Badge, Card)
├── data/
│   └── mockData.js     # All seed documents, audit logs, analytics
├── hooks/
│   └── useAuth.js      # Authentication logic
├── services/           # API endpoints (ready for backend integration)
│   ├── api.js
│   ├── documents.js
│   └── analytics.js
└── App.jsx             # Root component, shared state, routing
```

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build locally |

---

## Tech Stack

- **React 19** + **Vite**
- **Recharts** — Analytics charts
- **D3.js** — Knowledge graph visualization
- **Lucide React** — Icons
- **Axios** — HTTP client (for backend integration)

---

## Backend Integration

The project is API-ready. To switch from mock data to a real backend:

1. Open `src/data/users.js` and set:
   ```js
   export const API_MODE = true;
   ```
2. Update the base URL in `src/services/api.js`:
   ```js
   const api = axios.create({ baseURL: 'https://your-backend-url/api' });
   ```
3. All API endpoints are already defined in `src/services/documents.js` and `src/services/analytics.js`.
Username: dept.uploader
Password: upload123