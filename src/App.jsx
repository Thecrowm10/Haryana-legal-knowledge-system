import { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import Login from './pages/Login';
import ChangePasswordScreen from './pages/ChangePasswordScreen';
import Layout from './components/layout/Layout';
import CitizenDashboard from './pages/CitizenDashboard';
import UploaderDashboard from './pages/UploaderDashboard';
import ApproverDashboard from './pages/ApproverDashboard';
import CSODashboard from './pages/CSODashboard';
import AdminDashboard from './pages/AdminDashboard';
import NodalOfficerDashboard from './pages/NodalOfficerDashboard';
import AuditorDashboard from './pages/AuditorDashboard';
import { DOCUMENTS } from './data/mockData';

const DEFAULT_PAGE = {
  citizen:  'home',
  uploader: 'upload',
  approver: 'pending',
  csoffice: 'analytics',
  officer:  'analytics',
  admin:    'users',
  nodal:    'users',
  auditor:  'auditlog',
};

const SEED_RELATIONS = [
  { sourceId: 'mock-1', targetId: 'mock-5', label: 'Amended by' },
  { sourceId: 'mock-3', targetId: 'mock-2', label: 'Applies to' },
  { sourceId: 'mock-2', targetId: 'mock-4', label: 'Governs' },
];

const INITIAL_TAXONOMY = [
  { category: 'Document Types', items: ['Act', 'Amendment', 'Notification', 'Circular', 'Policy', 'Rules & Regulations', 'Order / Gazette', 'Bye Laws', 'Miscellaneous'] },
  { category: 'Departments',    items: ['Urban Local Bodies', 'Revenue & Disaster Mgmt.', 'Home Department', 'Industries & Commerce', 'Labour Department', 'Finance Department', 'Health & Family Welfare', 'Agriculture & Farmers Welfare', 'Panchayati Raj', 'General Administration'] },
  { category: 'Legal Status',   items: ['Active', 'Repealed', 'Amended', 'Under Review', 'Suspended'] },
];

export default function App() {
  const { user, loading, error: authError, loginAsRole, changePass, logout } = useAuth();
  const [activePage, setActivePage]       = useState(null);
  const [auditLog, setAuditLog]           = useState([]);
  const [documents, setDocuments]         = useState(
    DOCUMENTS.map(d => ({ ...d, uid: `mock-${d.id}` }))
  );
  const [relationships, setRelationships] = useState(SEED_RELATIONS);
  const [taxonomy, setTaxonomy]           = useState(INITIAL_TAXONOMY);

  useEffect(() => {
    if (user && activePage === null) {
      const saved = localStorage.getItem('activePage');
      setActivePage(saved || DEFAULT_PAGE[user.role]);
    }
    if (!user) {
      setActivePage(null);
      localStorage.removeItem('activePage');
    }
  }, [user]);

  function navigate(page) {
    setActivePage(page);
    localStorage.setItem('activePage', page);
  }

  function addAuditLog(msg) { setAuditLog(l => [msg, ...l]); }

  function addDocument(doc, rels = []) {
    const uid = doc.uid || `upload-${Date.now()}`;
    setDocuments(d => {
      if (d.some(x => x.uid === uid)) {
        // doc already exists — only merge new relationships, don't duplicate
        return d;
      }
      return [{ ...doc, uid, fileUrl: doc.fileUrl || null }, ...d];
    });
    if (rels.length > 0) {
      setRelationships(r => [...r, ...rels.map(rel => ({ ...rel, sourceId: uid }))]);
    }
    addAuditLog(`Uploaded document: ${doc.title}`);
  }

  // ── NEW: called by ApproverDashboard when approver clicks "Approve" ──────
  function approveDocument(id) {
    const doc = documents.find(d => d.id === id || d.uid === id);
    setDocuments(prev =>
      prev.map(d =>
        (d.id === id || d.uid === id)
          ? {
              ...d,
              status:         'approved',
              workflowStatus: 'published',
              publishedAt:    new Date().toISOString().split('T')[0],
            }
          : d
      )
    );
    addAuditLog(`Approved document: ${doc?.title}`);
  }

  if (!user) return <Login onLogin={loginAsRole} loading={loading} authError={authError} />;
  if (user.mustChangePassword) return <ChangePasswordScreen user={user} onPasswordChanged={changePass} onLogout={logout} reason={user.passwordExpired ? 'expired' : 'first_login'} />;
  if (activePage === null) return null;

  function renderDashboard() {
    switch (user.role) {
      case 'citizen':
        return (
          <CitizenDashboard
            activePage={activePage}
            onAuditLog={addAuditLog}
            documents={documents}
          />
        );
      case 'uploader':
        return (
          <UploaderDashboard
            activePage={activePage}
            onAuditLog={addAuditLog}
            documents={documents}
            onAddDocument={addDocument}
            taxonomy={taxonomy}
          />
        );
      case 'approver':
        return (
          <ApproverDashboard
            activePage={activePage}
            onAuditLog={addAuditLog}
            documents={documents}
            onApprove={approveDocument}   // ← NEW
          />
        );
      case 'csoffice':
      case 'officer':
        return (
          <CSODashboard
            activePage={activePage}
            auditLog={auditLog}
            documents={documents}
            relationships={relationships}
          />
        );
      case 'admin':
        return <AdminDashboard activePage={activePage} taxonomy={taxonomy} onUpdateTaxonomy={setTaxonomy} />;
      case 'nodal':
        return <NodalOfficerDashboard activePage={activePage} />;
      case 'auditor':
        return <AuditorDashboard activePage={activePage} />;
      default:
        return null;
    }
  }

  return (
    <Layout user={user} activePage={activePage} onNavigate={navigate} onLogout={logout} onChangePassword={changePass}>
      {renderDashboard()}
    </Layout>
  );
}