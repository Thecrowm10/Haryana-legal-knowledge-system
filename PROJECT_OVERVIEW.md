# Haryana Legal Knowledge System — Project Overview

## 1. Purpose

The **Haryana Legal Knowledge System** is a bilingual (Hindi / English), role-based digital document management portal built for the **Government of Haryana**. It enables government departments to upload, review, approve, and publish legal documents — such as Acts, Rules, Notifications, Circulars, Orders, and Policies — in a secure, auditable, and searchable environment. Citizens can access published documents through a public portal without logging in.

---

## 2. System Architecture

The system is split into two independent applications that communicate over a REST API.

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite |
| Backend API | FastAPI (Python 3.12) |
| Database | MySQL |
| ORM | SQLAlchemy 2.0 |
| AI / Semantic Search | Ollama LLM + ChromaDB Vector Store |
| File Storage | Local filesystem (`uploads/`) |

---

## 3. Key Features

### Document Management
- Upload PDF and DOCX legal documents with rich metadata (title, department, type, year, tags, etc.)
- Automatic text extraction from PDFs using **PyMuPDF**; scanned documents fall back to **Tesseract OCR** (supports English and Hindi Devanagari script)
- Version management — multiple document versions tracked per Act
- Department-level cross-referencing between related documents

### Approval Workflow
- Uploaders submit documents; Approvers review and approve or reject with written remarks
- Act Parts (sections, schedules, annexures, appendices, forms) have their own independent approval workflow
- Full audit trail of every approval decision

### Semantic Search & RAG
- Every uploaded document page is embedded and stored in **ChromaDB** (vector database)
- Users can perform natural-language semantic search over the entire document corpus
- A **RAG (Retrieval-Augmented Generation)** pipeline using **Ollama LLM** answers questions directly from document content

### AI Summarisation
- Uploaded documents are automatically summarised using the `llama3.2` LLM model running locally via Ollama

### Security & Authentication
- **Citizen / Officer / Uploader / Approver / Nodal Officer / Admin:** Username + password login protected by a custom CAPTCHA
- **Super Admin:** Mobile OTP-only login (no password)
- Login payloads are **RSA-encrypted** before transmission from the browser
- Passwords hashed with **bcrypt**; 6-month password-expiry policy enforced
- First-login mobile OTP verification for all non-super-admin users
- JWT Bearer tokens for session management (30-minute expiry)

### Bilingual UI
- Full Hindi and English support via **i18next**
- In-browser **Hindi keyboard input** component for Devanagari text entry
- OCR configured for both `eng` and `hin` Tesseract language packs

### Notifications & Communication
- **BSNL SMS API** (DLT-compliant) for OTP delivery
- **SMTP Email** for password-reset OTPs
- In-app browser notifications for document status changes

### Audit & Compliance
- Every significant action (login, upload, approval, user update) is written to an audit log with actor, IP address, timestamp, and diff of changes
- Dedicated **Auditor** role for read-only audit log access
- CSV export of audit logs

### Analytics
- Dashboard charts (Recharts + D3.js) showing document counts, department activity, approval rates, and upload trends
- Role-specific analytics views for CSO (Chief Secretary Office) and Admins

---

## 4. User Roles

| Role | Access Level | Key Responsibilities |
|---|---|---|
| **Citizen** | Public, read-only | Search and view published legal documents |
| **Uploader** | Authenticated | Upload documents, manage drafts, submit for approval |
| **Approver** | Authenticated | Review, approve or reject submitted documents and act parts |
| **Nodal Officer** | Authenticated | Manage users and documents within assigned departments |
| **Admin** | Authenticated | User management, department configuration, role assignment |
| **Super Admin** | OTP-authenticated | Full system control — all departments, users, roles, limits |
| **CSO (CS Office)** | Authenticated | System-wide analytics and oversight |
| **Auditor** | Authenticated | Read-only access to full audit logs |

---

## 5. Document Types Supported

- Act
- Amendment
- Notification
- Circular
- Policy
- Rules & Regulations
- Order / Gazette
- Bye Laws
- Miscellaneous

---

## 6. Act Parts Module

Legal Acts can be broken down into structured parts with their own independent submission and approval lifecycle:

- **Sections** (with optional chapter grouping)
- **Schedules**
- **Annexures**
- **Appendices**
- **Forms**

Each part type can have associated file uploads (PDF / DOCX) and is submitted separately for approval.

---

## 7. Technology Stack Summary

### Frontend
| Library | Purpose |
|---|---|
| React 19 | UI framework |
| Vite | Build tool |
| React Router DOM 7 | Client-side routing |
| Axios | HTTP client |
| PDF.js | In-browser PDF rendering |
| Mammoth | DOCX to HTML conversion |
| ExcelJS | Excel export |
| Recharts + D3.js | Analytics charts |
| JSEncrypt | RSA payload encryption |
| i18next | Hindi / English internationalisation |
| Lucide React | Icon library |

### Backend
| Library | Purpose |
|---|---|
| FastAPI | REST API framework |
| SQLAlchemy 2 | ORM (MySQL via PyMySQL) |
| PyMuPDF | PDF text extraction |
| Tesseract OCR | Scanned document OCR |
| python-docx | DOCX processing |
| Ollama | Local LLM (llama3.2 + nomic-embed-text) |
| ChromaDB | Vector store for semantic search |
| bcrypt + PyJWT | Password hashing and JWT auth |
| cryptography | RSA key management |
| Twilio / BSNL SMS | SMS OTP delivery |

---

## 8. Data Flow — Document Upload to Publication

```
Uploader uploads PDF / DOCX
        │
        ▼
Backend extracts text (PyMuPDF → Tesseract fallback)
        │
        ├──► Ollama LLM generates summary
        │
        └──► ChromaDB indexes pages as embeddings
        │
        ▼
Approver reviews document in portal
        │
        ▼
Approver approves → document published
        │
        ▼
Citizen can search & view via public portal
```

---

## 9. Data Flow — Semantic Search (RAG)

```
User types natural-language query
        │
        ▼
ChromaDB finds most relevant document pages (cosine similarity)
        │
        ▼
Ollama LLM generates answer using retrieved pages as context
        │
        ▼
Answer returned with source document references
```

---

## 10. Security Highlights

- RSA-encrypted login payloads (prevents credential interception even over HTTP)
- CAPTCHA on login (blocks automated attacks)
- Role-based access control (RBAC) enforced at API level via FastAPI dependencies
- Per-department per-role user caps (prevents overcrowding of roles within a department)
- Password expiry (6 months) with forced reset
- JWT token expiry (30 minutes)
- OTP expiry (10 minutes)
- Full audit trail with IP address tracking
- Path-traversal protection on file-serve endpoints

---

*Document generated: August 2026*
