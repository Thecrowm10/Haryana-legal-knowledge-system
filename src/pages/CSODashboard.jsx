import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { ANALYTICS_STATS, AUDIT_LOGS, GRAPH_NODES, GRAPH_LINKS } from '../data/mockData';
import { FileText, CheckCircle, Clock, XCircle, Search, TrendingUp, GitBranch } from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';

/* ─── helpers ─── */
const CHART_COLORS = ['#1A6B3C', '#3b82f6', '#f59e0b', '#22c55e', '#8b5cf6', '#ef4444'];
const label = { fontSize: 10.5, fontWeight: 700, color: 'var(--text-color-secondary)', letterSpacing: '.07em', textTransform: 'uppercase', fontFamily: 'var(--mono)' };

const TOOLTIP_STYLE = { background: 'var(--surface-card)', border: '1px solid var(--surface-border)', borderRadius: 8, boxShadow: 'var(--card-shadow)', fontSize: 12 };

function SectionTitle({ children }) {
  return <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 16, letterSpacing: '-.01em' }}>{children}</div>;
}

/* ─── Diamond-style stat card ─── */
function StatCard({ icon: Icon, label: lbl, value, sub, iconBg, iconColor, trend }) {
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-color-secondary)', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 10, fontFamily: 'var(--mono)' }}>{lbl}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-heading)', lineHeight: 1, marginBottom: 6, fontFamily: 'var(--mono)' }}>{value}</div>
          {sub && <div style={{ fontSize: 12, color: 'var(--text-color-secondary)' }}>{sub}</div>}
        </div>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={22} color={iconColor} strokeWidth={1.8} />
        </div>
      </div>
      {trend !== undefined && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <TrendingUp size={13} color="#22c55e" />
          <span style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>{trend}</span>
          <span style={{ fontSize: 12, color: 'var(--text-color-secondary)' }}>vs. last month</span>
        </div>
      )}
    </Card>
  );
}

/* ─── Knowledge Graph data (HTML wale se liya, same) ─── */
const KG_NODES = [
  { id: 'const',     label: 'Constitution of India',               type: 'central', year: 1950, dept: 'Law & Justice',          desc: 'Supreme law of India — foundation for all state legislation.' },
  { id: 'rti',       label: 'RTI Act, 2005',                       type: 'central', year: 2005, dept: 'General Administration',  desc: 'Right to Information Act — citizen right to access government information.' },
  { id: 'larr',      label: 'Land Acquisition Act, 2013',          type: 'central', year: 2013, dept: 'Revenue',                 desc: 'Right to Fair Compensation and Transparency in Land Acquisition.' },
  { id: 'factories', label: 'Factories Act, 1948',                 type: 'central', year: 1948, dept: 'Labour',                  desc: 'Regulates health, safety and welfare in factories.' },
  { id: 'pclr',      label: 'Punjab Land Revenue Act, 1887',       type: 'state',   year: 1887, dept: 'Revenue',                 desc: 'Governs land records, mutations and revenue collection in Haryana.' },
  { id: 'hma',       label: 'Haryana Municipal Act, 1973',         type: 'state',   year: 1973, dept: 'Urban Local Bodies',      desc: 'Governs urban local bodies, municipalities and civic administration.' },
  { id: 'rera',      label: 'RERA Haryana, 2017',                  type: 'state',   year: 2017, dept: 'Town & Country Planning', desc: 'Real Estate Regulatory Authority — buyer and developer regulation.' },
  { id: 'hpca',      label: 'Haryana Panchayati Raj Act, 1994',    type: 'state',   year: 1994, dept: 'Panchayati Raj',          desc: 'Governs gram panchayats and rural local bodies in Haryana.' },
  { id: 'labour',    label: 'Haryana Labour Welfare Fund Act',     type: 'state',   year: 1965, dept: 'Labour',                  desc: 'Welfare fund for industrial and agricultural workers.' },
  { id: 'hma_am',    label: 'Haryana Municipal Amendment, 2019',   type: 'amend',   year: 2019, dept: 'Urban Local Bodies',      desc: 'Amendment expanding solid waste management obligations.' },
  { id: 'rti_rules', label: 'Haryana RTI Rules, 2006',             type: 'rules',   year: 2006, dept: 'General Administration',  desc: 'State-level procedural rules for RTI implementation.' },
  { id: 'larr_hr',   label: 'Haryana Land Acquisition Rules',      type: 'rules',   year: 2015, dept: 'Revenue',                 desc: 'State rules supplementing the central Land Acquisition Act.' },
  { id: 'notif1',    label: 'Urban Development Notification, 2021',type: 'notif',   year: 2021, dept: 'Urban Local Bodies',      desc: 'Notification on revised building bylaws for Haryana municipalities.' },
  { id: 'notif2',    label: 'Labour Welfare Order, 2022',          type: 'notif',   year: 2022, dept: 'Labour',                  desc: 'Order revising contribution rates under the Labour Welfare Fund.' },
];

const KG_LINKS = [
  { source: 'const',     target: 'hma',       label: 'Empowers' },
  { source: 'const',     target: 'hpca',      label: 'Empowers' },
  { source: 'const',     target: 'rti',        label: 'Art. 19 basis' },
  { source: 'const',     target: 'larr',       label: 'Art. 300A basis' },
  { source: 'rti',       target: 'rti_rules',  label: 'Implemented by' },
  { source: 'larr',      target: 'larr_hr',    label: 'Supplemented by' },
  { source: 'larr',      target: 'pclr',       label: 'Land records link' },
  { source: 'factories', target: 'labour',     label: 'Labour provisions' },
  { source: 'hma',       target: 'hma_am',     label: 'Amended by' },
  { source: 'hma',       target: 'notif1',     label: 'Notified under' },
  { source: 'hpca',      target: 'pclr',       label: 'Revenue records' },
  { source: 'labour',    target: 'notif2',     label: 'Order under' },
  { source: 'rera',      target: 'hma',        label: 'Coordination' },
  { source: 'rti_rules', target: 'notif1',     label: 'Referenced in' },
];

const NODE_COLORS = {
  central: '#00c9a7',
  state:   '#5b8af7',
  rules:   '#f5a623',
  amend:   '#3ecf8e',
  notif:   '#ff4d6a',
};

const LEGEND_ITEMS = [
  ['Central / Constitutional Acts', '#00c9a7'],
  ['Haryana State Acts',            '#5b8af7'],
  ['Rules & Regulations',           '#f5a623'],
  ['Amendments',                    '#3ecf8e'],
  ['Notifications / Orders',        '#ff4d6a'],
];

/* ─── Knowledge Graph component ─── */
function KnowledgeGraph({ focusId, allNodes = KG_NODES, allLinks = KG_LINKS }) {
  const svgRef     = useRef(null);
  const tooltipRef = useRef(null);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const svg = d3.select(el);
    svg.selectAll('*').remove();
    const W = el.clientWidth || 700;
    const H = 520;
    svg.attr('width', W).attr('height', H);

    let nodes, links;
    if (focusId) {
      const neighborIds = new Set([focusId]);
      allLinks.forEach(l => {
        const src = typeof l.source === 'object' ? l.source.id : l.source;
        const tgt = typeof l.target === 'object' ? l.target.id : l.target;
        if (src === focusId || tgt === focusId) { neighborIds.add(src); neighborIds.add(tgt); }
      });
      nodes = allNodes.filter(n => neighborIds.has(n.id)).map(n => ({ ...n }));
      links = allLinks
        .filter(l => {
          const src = typeof l.source === 'object' ? l.source.id : l.source;
          const tgt = typeof l.target === 'object' ? l.target.id : l.target;
          return neighborIds.has(src) && neighborIds.has(tgt);
        })
        .map(l => ({ ...l, source: typeof l.source === 'object' ? l.source.id : l.source, target: typeof l.target === 'object' ? l.target.id : l.target }));
    } else {
      nodes = allNodes.map(n => ({ ...n }));
      links = allLinks.map(l => ({ ...l, source: typeof l.source === 'object' ? l.source.id : l.source, target: typeof l.target === 'object' ? l.target.id : l.target }));
    }

    // ── defs: arrow + grid ──
    const defs = svg.append('defs');

    defs.append('marker')
      .attr('id', 'hlks-arrow').attr('viewBox', '0 -5 10 10')
      .attr('refX', 28).attr('refY', 0)
      .attr('markerWidth', 6).attr('markerHeight', 6).attr('orient', 'auto')
      .append('path').attr('d', 'M0,-5L10,0L0,5').attr('fill', '#cbd5e1');

    const pattern = defs.append('pattern')
      .attr('id', 'hlks-grid').attr('width', 32).attr('height', 32)
      .attr('patternUnits', 'userSpaceOnUse');
    pattern.append('path')
      .attr('d', 'M 32 0 L 0 0 0 32')
      .attr('fill', 'none')
      .attr('stroke', '#e2e8f0')
      .attr('stroke-width', '0.8');

    svg.append('rect').attr('width', W).attr('height', H).attr('fill', 'url(#hlks-grid)');

    // ── simulation ──
    const sim = d3.forceSimulation(nodes)
      .force('link',      d3.forceLink(links).id(d => d.id).distance(130).strength(0.6))
      .force('charge',    d3.forceManyBody().strength(-420))
      .force('center',    d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide(44));

    // ── links ──
    const linkG = svg.append('g').selectAll('line').data(links).join('line')
      .attr('stroke', '#cbd5e1').attr('stroke-width', 1.5)
      .attr('marker-end', 'url(#hlks-arrow)');

    const linkLabel = svg.append('g').selectAll('text').data(links).join('text')
      .attr('font-size', 9.5).attr('fill', '#94a3b8')
      .attr('text-anchor', 'middle').attr('font-family', 'var(--mono)')
      .text(d => d.label);

    // ── nodes ──
    const nodeG = svg.append('g').selectAll('g').data(nodes).join('g')
      .attr('cursor', 'pointer')
      .call(d3.drag()
        .on('start', (e, d) => { if (!e.active) sim.alphaTarget(.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag',  (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on('end',   (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; })
      );

    nodeG.append('circle')
      .attr('r',            d => d.type === 'central' ? 22 : 16)
      .attr('fill',         d => NODE_COLORS[d.type] + '22')
      .attr('stroke',       d => NODE_COLORS[d.type])
      .attr('stroke-width', d => d.type === 'central' ? 2.5 : 1.8);

    nodeG.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size',      d => d.type === 'central' ? 8 : 7.5)
      .attr('font-family',    'var(--mono)')
      .attr('font-weight',    '600')
      .attr('fill',           d => NODE_COLORS[d.type])
      .attr('pointer-events', 'none')
      .each(function(d) {
        const words = d.label.split(' ');
        const mid   = Math.ceil(words.length / 2);
        const line1 = words.slice(0, mid).join(' ');
        const line2 = words.slice(mid).join(' ');
        const sel   = d3.select(this);
        sel.append('tspan').attr('x', 0).attr('dy', '-0.5em').text(line1);
        if (line2) sel.append('tspan').attr('x', 0).attr('dy', '1.1em').text(line2);
      });

    // ── tooltip ──
    const tip = d3.select(tooltipRef.current);

    nodeG
      .on('mouseenter', (event, d) => {
        tip.style('display', 'block')
           .html(`<strong style="color:${NODE_COLORS[d.type]};display:block;margin-bottom:3px;font-size:11px">${d.label}</strong>${d.year} · ${d.dept}<br/><span style="color:#6b7280;font-size:11px">${d.desc}</span>`);
        const rect = el.getBoundingClientRect();
        tip.style('left', (event.clientX - rect.left + 14) + 'px')
           .style('top',  (event.clientY - rect.top  - 10) + 'px');
      })
      .on('mousemove', (event) => {
        const rect = el.getBoundingClientRect();
        tip.style('left', (event.clientX - rect.left + 14) + 'px')
           .style('top',  (event.clientY - rect.top  - 10) + 'px');
      })
      .on('mouseleave', () => tip.style('display', 'none'));

    // ── tick ──
    sim.on('tick', () => {
      linkG
        .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
      linkLabel
        .attr('x', d => (d.source.x + d.target.x) / 2)
        .attr('y', d => (d.source.y + d.target.y) / 2);
      nodeG.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    return () => sim.stop();
  }, [focusId]);

  return (
    <div style={{ position: 'relative' }}>
      <svg ref={svgRef} style={{ width: '100%', minHeight: 520, display: 'block' }} />

      {/* Tooltip */}
      <div ref={tooltipRef} style={{
        display: 'none', position: 'absolute', pointerEvents: 'none',
        background: '#fff', border: '1px solid #e2e8f0',
        borderRadius: 8, padding: '10px 14px',
        fontSize: 12, color: '#374151', maxWidth: 220, lineHeight: 1.5,
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)', zIndex: 10,
      }} />

      {/* Legend — bottom-left, HTML wale jaisa */}
      <div style={{
        position: 'absolute', bottom: 16, left: 16,
        background: 'rgba(255,255,255,0.92)',
        border: '1px solid #e2e8f0', borderRadius: 9,
        padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 7,
        backdropFilter: 'blur(4px)',
      }}>
        {LEGEND_ITEMS.map(([lbl, color]) => (
          <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#6b7280', fontFamily: 'var(--mono)' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
            {lbl}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Action Pill ─── */
const ACTION_PILL = {
  approve: ['rgba(34,197,94,.1)','#15803d','rgba(34,197,94,.25)','APPROVE'],
  reject:  ['rgba(239,68,68,.1)','#b91c1c','rgba(239,68,68,.25)','REJECT'],
  submit:  ['rgba(245,158,11,.1)','#b45309','rgba(245,158,11,.25)','UPLOAD'],
  search:  ['rgba(26,107,60,.1)','#1A6B3C','rgba(26,107,60,.25)','SEARCH'],
  view:    ['rgba(59,130,246,.1)','#1d4ed8','rgba(59,130,246,.25)','VIEW'],
};
function ActionPill({ action }) {
  const k = action.toLowerCase().includes('approved') ? 'approve'
    : action.toLowerCase().includes('rejected') ? 'reject'
    : action.toLowerCase().includes('uploaded') ? 'submit'
    : action.toLowerCase().includes('searched') ? 'search'
    : action.toLowerCase().includes('viewed') ? 'view'
    : null;
  const [bg, c, b, lbl] = ACTION_PILL[k] || ['var(--surface-100)','var(--text-color-secondary)','var(--surface-200)', action.split(' ')[0].toUpperCase()];
  return <span style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 5, letterSpacing: '.04em', textTransform: 'uppercase', background: bg, color: c, border: `1px solid ${b}`, whiteSpace: 'nowrap' }}>{lbl}</span>;
}

/* ─── Graph Tab with selector ─── */
function GraphTab({ documents, relationships }) {
  const [focusId, setFocusId] = useState(null);
  const [search, setSearch]   = useState('');
  const [showDrop, setShowDrop] = useState(false);

  // Build live nodes from uploaded documents that have relationships
  const connectedIds = new Set(relationships.flatMap(r => [r.sourceId, r.targetId]));
  const liveNodes = documents
    .filter(d => connectedIds.has(d.uid))
    .map(d => ({
      id: d.uid,
      label: d.title,
      type: d.type === 'Act' ? 'state' : d.type === 'Amendment' ? 'amend' : d.type === 'Notification' || d.type === 'Circular' ? 'notif' : 'rules',
      year: d.year,
      dept: d.dept,
      desc: `${d.type} · ${d.dept} · ${d.legalStatus || 'active'}`,
    }));
  const liveLinks = relationships.map(r => ({ source: r.sourceId, target: r.targetId, label: r.label }));

  // Merge with static KG_NODES/KG_LINKS (fallback/seed data)
  const liveIds   = new Set(liveNodes.map(n => n.id));
  const allNodes  = [...liveNodes, ...KG_NODES.filter(n => !liveIds.has(n.id))];
  const allLinks  = [...liveLinks, ...KG_LINKS];

  const focusNode = allNodes.find(n => n.id === focusId);
  const filtered  = allNodes.filter(n => n.label.toLowerCase().includes(search.toLowerCase()));

  function select(id) {
    setFocusId(id);
    setSearch('');
    setShowDrop(false);
  }

  return (
    <div style={{ animation: 'fadeSlideIn .3s ease' }}>
      <Card>
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <SectionTitle>Legal Document Knowledge Graph</SectionTitle>
            <div style={{ fontSize: 12.5, color: 'var(--text-color-secondary)', marginTop: -8 }}>
              {focusId ? `Showing relationships for: ` : 'Drag nodes · Select a document to focus · Arrows show dependencies'}
              {focusNode && <strong style={{ color: 'var(--primary)' }}>{focusNode.label}</strong>}
            </div>
          </div>

          {/* Document selector */}
          <div style={{ position: 'relative', minWidth: 260 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-color-secondary)', pointerEvents: 'none' }} />
                <input
                  value={search}
                  onChange={e => { setSearch(e.target.value); setShowDrop(true); }}
                  onFocus={() => setShowDrop(true)}
                  placeholder="Search & select a document…"
                  style={{ width: '100%', background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', borderRadius: 8, color: 'var(--text-color)', fontFamily: 'var(--font)', fontSize: 12.5, padding: '8px 12px 8px 30px', outline: 'none', transition: 'border-color .2s', boxSizing: 'border-box' }}
                  onBlur={() => setTimeout(() => setShowDrop(false), 150)}
                />
              </div>
              {focusId && (
                <button onClick={() => { setFocusId(null); setSearch(''); }}
                  style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: 'var(--text-color-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', whiteSpace: 'nowrap' }}>
                  Show All
                </button>
              )}
            </div>

            {/* Dropdown */}
            {showDrop && filtered.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surface-card)', border: '1px solid var(--surface-border)', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,.12)', zIndex: 50, marginTop: 4, maxHeight: 240, overflowY: 'auto' }}>
                {filtered.map(n => (
                  <div key={n.id} onMouseDown={() => select(n.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', cursor: 'pointer', borderBottom: '1px solid var(--surface-border)', transition: 'background .15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: NODE_COLORS[n.type], flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-heading)' }}>{n.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-color-secondary)', fontFamily: 'var(--mono)' }}>{n.year} · {n.dept}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Focus chips — show connected docs count */}
        {focusId && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            {allLinks.filter(l => l.source === focusId || l.target === focusId).map((l, i) => {
              const otherId = l.source === focusId ? l.target : l.source;
              const other   = allNodes.find(n => n.id === otherId);
              return (
                <div key={i} onClick={() => select(otherId)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', cursor: 'pointer', fontSize: 11.5, color: 'var(--text-color-secondary)', fontFamily: 'var(--mono)', transition: 'all .15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--surface-border)'; e.currentTarget.style.color = 'var(--text-color-secondary)'; }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: NODE_COLORS[other?.type] }} />
                  {l.label} → {other?.label}
                </div>
              );
            })}
          </div>
        )}

        <div style={{ background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', borderRadius: 10, overflow: 'hidden', position: 'relative' }}>
          <KnowledgeGraph focusId={focusId} allNodes={allNodes} allLinks={allLinks} />
        </div>
      </Card>
    </div>
  );
}

const AUDIT_FILTERS = ['All', 'Approved', 'Rejected', 'Uploaded', 'Searched', 'Viewed'];

/* ─── MAIN ─── */
export default function CSODashboard({ activePage, auditLog, documents = [], relationships = [] }) {
  const [auditFilter, setAuditFilter] = useState('All');
  const [auditSearch, setAuditSearch] = useState('');
  const s = ANALYTICS_STATS;

  const liveEntries = auditLog.map((msg, i) => ({
    id: `live-${i}`, user: 'System', role: 'csoffice', action: msg, doc: '—',
    time: new Date().toLocaleTimeString('en-IN'),
  }));
  const allLogs = [...liveEntries, ...AUDIT_LOGS];
  const filteredLogs = allLogs.filter(l => {
    const mF = auditFilter === 'All' || l.action.toLowerCase().includes(auditFilter.toLowerCase());
    const mS = !auditSearch || l.user.toLowerCase().includes(auditSearch.toLowerCase()) || l.action.toLowerCase().includes(auditSearch.toLowerCase());
    return mF && mS;
  });

  /* ── Analytics tab ── */
  if (activePage === 'analytics') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, animation: 'fadeSlideIn .3s ease' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <StatCard icon={FileText}    label="Total Documents" value={s.totalDocuments} sub="In the system"         iconBg="rgba(26,107,60,.12)"  iconColor="#1A6B3C" trend="+12%" />
          <StatCard icon={CheckCircle} label="Approved"        value={s.approved}       sub="Published docs"        iconBg="rgba(34,197,94,.12)"  iconColor="#22c55e" />
          <StatCard icon={Clock}       label="Pending"         value={s.pending}        sub="Awaiting review"       iconBg="rgba(245,158,11,.12)" iconColor="#f59e0b" />
          <StatCard icon={XCircle}     label="Rejected"        value={s.rejected}       sub="Returned to uploader"  iconBg="rgba(239,68,68,.12)"  iconColor="#ef4444" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card>
            <SectionTitle>Documents by Department</SectionTitle>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={s.deptBreakdown} barSize={28} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'var(--mono)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'var(--mono)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'var(--surface-hover)' }} />
                <Bar dataKey="docs" fill="var(--primary)" radius={[6, 6, 0, 0]} name="Documents" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <SectionTitle>Monthly Upload Trend</SectionTitle>
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={s.monthlyUploads} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'var(--mono)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'var(--mono)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Line type="monotone" dataKey="uploads" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 4, fill: 'var(--primary)', strokeWidth: 0 }} activeDot={{ r: 6 }} name="Uploads" />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card>
            <SectionTitle>Status Distribution</SectionTitle>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={[{name:'Approved',value:s.approved},{name:'Pending',value:s.pending},{name:'Rejected',value:s.rejected}]}
                  cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                  {['#1A6B3C','#f59e0b','#ef4444'].map((c, i) => <Cell key={i} fill={c} />)}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <SectionTitle>System Overview</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Total Searches', value: s.totalSearches, color: '#3b82f6', pct: 100 },
                { label: 'Active Users',   value: s.activeUsers,   color: '#1A6B3C', pct: 80 },
                { label: 'Approval Rate',  value: `${Math.round(s.approved / s.totalDocuments * 100)}%`, color: '#22c55e', pct: Math.round(s.approved / s.totalDocuments * 100) },
              ].map(row => (
                <div key={row.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 12.5, color: 'var(--text-color)' }}>{row.label}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text-heading)' }}>{row.value}</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--surface-border)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${row.pct}%`, background: row.color, borderRadius: 99, transition: 'width .8s ease' }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  /* ── Knowledge Graph tab ── */
  if (activePage === 'graph') {
    return <GraphTab documents={documents} relationships={relationships} />;
  }

  /* ── Audit Log tab ── */
  return (
    <div style={{ animation: 'fadeSlideIn .3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {AUDIT_FILTERS.map(f => (
          <button key={f} onClick={() => setAuditFilter(f)} style={{
            fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.05em',
            padding: '5px 14px', borderRadius: 20, cursor: 'pointer',
            border: `1px solid ${auditFilter === f ? 'var(--primary-border)' : 'var(--surface-border)'}`,
            background: auditFilter === f ? 'var(--primary-light)' : 'var(--surface-card)',
            color: auditFilter === f ? 'var(--primary)' : 'var(--text-color-secondary)',
            transition: 'all .18s', textTransform: 'uppercase',
          }}>{f}</button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-color-secondary)' }} />
          <input value={auditSearch} onChange={e => setAuditSearch(e.target.value)} placeholder="Search logs…"
            style={{ background: 'var(--surface-card)', border: '1px solid var(--surface-border)', borderRadius: 8, color: 'var(--text-color)', fontFamily: 'var(--font)', fontSize: 12.5, padding: '7px 14px 7px 32px', outline: 'none', width: 210, transition: 'border-color .2s' }}
            onFocus={e => e.target.style.borderColor = 'var(--primary)'}
            onBlur={e => e.target.style.borderColor = 'var(--surface-border)'} />
        </div>
      </div>

      <Card padding="0">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface-50)', borderBottom: '1px solid var(--surface-border)' }}>
              {['Timestamp', 'User', 'Role', 'Action', 'Detail', 'ZG Verified'].map(h => (
                <th key={h} style={{ ...label, padding: '12px 16px', textAlign: 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 && (
              <tr><td colSpan={6} style={{ padding: '52px 0', textAlign: 'center', color: 'var(--text-color-secondary)', fontSize: 13 }}>No log entries match the filter.</td></tr>
            )}
            {filteredLogs.map(log => (
              <tr key={log.id} style={{ borderBottom: '1px solid var(--surface-border)', transition: 'background .15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '11px 16px', fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--text-color-secondary)', whiteSpace: 'nowrap' }}>{log.time}</td>
                <td style={{ padding: '11px 16px', fontSize: 13, fontWeight: 600, color: 'var(--text-heading)' }}>{log.user}</td>
                <td style={{ padding: '11px 16px' }}><Badge label={log.role} variant={log.role} /></td>
                <td style={{ padding: '11px 16px' }}><ActionPill action={log.action} /></td>
                <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--text-color-secondary)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.doc !== '—' ? log.doc : log.action}</td>
                <td style={{ padding: '11px 16px' }}>
                  {(log.action.toLowerCase().includes('searched') || log.action.toLowerCase().includes('viewed'))
                    ? <span style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, color: '#15803d', background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.25)', padding: '2px 8px', borderRadius: 5 }}>ZG ✓</span>
                    : <span style={{ color: 'var(--surface-200)', fontSize: 13 }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}