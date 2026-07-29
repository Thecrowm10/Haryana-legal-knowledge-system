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
const CHART_COLORS = ['#214aab', '#0d6efd', '#ffc107', '#198754', '#8b5cf6', '#dc3545'];
const label = { fontSize: 10.5, fontWeight: 700, color: 'var(--text-color-secondary)', letterSpacing: '.07em', textTransform: 'uppercase', fontFamily: 'var(--mono)' };

const TOOLTIP_STYLE = { background: 'var(--surface-card)', border: '1px solid var(--surface-border)', borderRadius: 8, boxShadow: 'var(--card-shadow)', fontSize: 12 };

function SectionTitle({ children }) {
  return <div style={{ fontSize: 'var(--font-size-p2)', fontWeight: 700, color: 'var(--text-heading)', marginBottom: 16, letterSpacing: '-.01em' }}>{children}</div>;
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
          <TrendingUp size={13} color="#198754" />
          <span style={{ fontSize: 12, color: '#1e40af', fontWeight: 600 }}>{trend}</span>
          <span style={{ fontSize: 12, color: 'var(--text-color-secondary)' }}>vs. last month</span>
        </div>
      )}
    </Card>
  );
}

/* ─── Per-node amendment history ─── */
const NODE_HISTORY = {
  const: {
    enacted: '26 Jan 1950', status: 'Active',
    amendments: [
      {
        year: 1976, date: '18 Dec 1976',
        title: '42nd Constitutional Amendment Act, 1976',
        by: 'Parliament of India',
        gazette: 'Gazette of India Extraordinary, Part II, Sec. 1, No. 312, dated 18 Dec 1976',
        changes: [
          { chapter: 'Preamble', section: 'Preamble', subsection: '—', page: 'p. 1', type: 'Amended',
            before: '"We, the people of India, having solemnly resolved to constitute India into a Sovereign Democratic Republic…"',
            after:  '"We, the people of India, having solemnly resolved to constitute India into a Sovereign Socialist Secular Democratic Republic…"' },
          { chapter: 'Part IV — Directive Principles', section: 'Art. 31C', subsection: '—', page: 'p. 18', type: 'Expanded',
            before: 'Notwithstanding anything in Art. 13, no law giving effect to Arts. 39(b) and 39(c) shall be deemed void on ground of inconsistency with Arts. 14, 19.',
            after:  'Protection extended: no law giving effect to ANY Directive Principle (not just 39(b)/(c)) shall be deemed void — courts cannot examine such laws for violation of Arts. 14, 19.' },
          { chapter: 'Part XX — Amendment', section: 'Art. 368', subsection: 'Cl. (4) & (5)', page: 'p. 84', type: 'Inserted',
            before: '(Sub-clauses did not exist) — Parliament\'s constituent power was subject to implied basic-structure doctrine.',
            after:  'Inserted Cl. (4): No amendment shall be questioned in any court. Inserted Cl. (5): Parliament\'s constituent power is unlimited and not subject to Art. 13. [Later struck down in Minerva Mills, 1980]' },
        ],
      },
      {
        year: 1978, date: '20 Jun 1978',
        title: '44th Constitutional Amendment Act, 1978',
        by: 'Parliament of India',
        gazette: 'Gazette of India Extraordinary, Part II, Sec. 1, No. 158, dated 20 Jun 1978',
        changes: [
          { chapter: 'Part XVIII — Emergency', section: 'Art. 352', subsection: 'Cl. (1)', page: 'p. 79', type: 'Substituted',
            before: '"If the President is satisfied that a grave emergency exists whereby the security of India or of any part of the territory thereof is threatened, whether by war or external aggression or internal disturbance…"',
            after:  '"Internal disturbance" substituted with "armed rebellion" — threshold for proclamation of Emergency raised; Cabinet\'s written advice to President now mandatory.' },
          { chapter: 'Part III — Fundamental Rights', section: 'Art. 19(1)(f)', subsection: '—', page: 'p. 10', type: 'Deleted',
            before: 'Art. 19(1)(f): All citizens shall have the right to acquire, hold and dispose of property.',
            after:  'Article omitted entirely. Right to property converted from Fundamental Right to constitutional right under Art. 300A — can now be taken away by law without constitutional challenge under Art. 13.' },
        ],
      },
      {
        year: 2019, date: '12 Jan 2019',
        title: '103rd Constitutional Amendment Act, 2019',
        by: 'Parliament of India',
        gazette: 'Gazette of India Extraordinary, Part II, Sec. 1, No. 4, dated 14 Jan 2019',
        changes: [
          { chapter: 'Part III — Fundamental Rights', section: 'Art. 15', subsection: 'Cl. (6)', page: 'p. 8', type: 'Inserted',
            before: '(Sub-clause did not exist) — State was prohibited from making special provisions for citizens on ground of economic weakness under general category.',
            after:  'Inserted Cl. (6): State may make special provision (up to 10%) for advancement of economically weaker sections of citizens other than SC/ST/OBC, for admission to educational institutions and public employment.' },
          { chapter: 'Part III — Fundamental Rights', section: 'Art. 16', subsection: 'Cl. (6)', page: 'p. 9', type: 'Inserted',
            before: '(Sub-clause did not exist) — No reservation in public employment for EWS of general category.',
            after:  'Inserted Cl. (6): State may reserve up to 10% of posts in public employment for economically weaker sections (EWS) of citizens other than SC/ST/OBC.' },
        ],
      },
    ],
  },

  hma: {
    enacted: '01 Oct 1973', status: 'Active — as amended',
    amendments: [
      {
        year: 2010, date: '15 Mar 2010',
        title: 'Haryana Municipal (Amendment) Act, 2010',
        by: 'Haryana State Legislature',
        gazette: 'Haryana Government Gazette Extraordinary, dated 15 Mar 2010',
        changes: [
          { chapter: 'Chapter III — Municipal Committees', section: 'Sec. 15', subsection: 'Sub-sec. (2)', page: 'p. 12', type: 'Amended',
            before: 'Ward committees shall consist of elected members only. Meetings shall be chaired by the elected ward member.',
            after:  'Ward committees shall consist of elected members plus nominated women representatives. Minimum 1/3rd seats in ward committees reserved for women. Chairperson to be elected from among ward committee members by rotation.' },
        ],
      },
      {
        year: 2019, date: '22 Jul 2019',
        title: 'Haryana Municipal Amendment, 2019',
        by: 'Haryana State Legislature',
        gazette: 'Haryana Government Gazette Extraordinary, No. 143, dated 22 Jul 2019',
        changes: [
          { chapter: 'Chapter VII — Sanitation', section: 'Sec. 67', subsection: 'Sub-sec. (1) & (2)', page: 'p. 44', type: 'Substituted',
            before: 'Sub-sec. (1): Every municipality shall make arrangements for the removal of filth, rubbish, night-soil and other obnoxious or polluting matter from the municipal area. Sub-sec. (2): The municipality may charge a sanitation tax for this purpose.',
            after:  'Sub-sec. (1): Every municipality shall implement source segregation of waste at household level, door-to-door collection, processing, treatment and scientific disposal of solid waste in compliance with the Solid Waste Management Rules, 2016 and all orders of the National Green Tribunal. Sub-sec. (2): Municipalities must submit monthly compliance reports to Haryana Urban Development Authority.' },
          { chapter: 'Chapter XII — Miscellaneous', section: 'Sec. 100A', subsection: '—', page: 'p. 68', type: 'Inserted',
            before: '(Section did not previously exist in the Act)',
            after:  'New Sec. 100A — Smart City Provisions: Municipalities notified under the Smart Cities Mission by the Government of India shall (a) maintain digitised property tax records accessible online, (b) provide minimum 12 citizen services through online portal, (c) establish a Grievance Redressal Cell with 7-day resolution mandate, and (d) publish monthly performance dashboard on municipal website.' },
        ],
      },
    ],
  },

  rti: {
    enacted: '12 Oct 2005', status: 'Active — as amended',
    amendments: [
      {
        year: 2019, date: '25 Jul 2019',
        title: 'Right to Information (Amendment) Act, 2019',
        by: 'Parliament of India',
        gazette: 'Gazette of India Extraordinary, Part II, Sec. 1, No. 37, dated 25 Jul 2019',
        changes: [
          { chapter: 'Chapter III — Central Information Commission', section: 'Sec. 13', subsection: 'Sub-sec. (1) & (5)', page: 'p. 11', type: 'Amended',
            before: 'Sub-sec. (1): The Chief Information Commissioner shall hold office for a term of 5 years from the date on which he enters office. Sub-sec. (5): Salary, allowances and other service conditions of the CIC shall be the same as those of the Chief Election Commissioner.',
            after:  'Sub-sec. (1): The Chief Information Commissioner shall hold office for such term as may be prescribed by the Central Government. Sub-sec. (5): The salary, allowances and other service conditions of the CIC shall be such as may be prescribed by the Central Government — removes statutory equivalence with Chief Election Commissioner.' },
          { chapter: 'Chapter IV — State Information Commissions', section: 'Sec. 16', subsection: 'Sub-sec. (1) & (5)', page: 'p. 13', type: 'Amended',
            before: 'Sub-sec. (1): State CIC shall hold office for a term of 5 years. Sub-sec. (5): Salary of State CIC shall be the same as an Election Commissioner; salary of State ICs shall be same as Chief Secretary to State Government.',
            after:  'Sub-sec. (1): State CIC shall hold office for such term as may be prescribed by the Central Government. Sub-sec. (5): Salary, allowances and service conditions of State CIC and State ICs to be prescribed by the Central Government — removes fixed statutory parity.' },
        ],
      },
    ],
  },

  larr: {
    enacted: '01 Jan 2014', status: 'Active',
    amendments: [
      {
        year: 2015, date: '29 Dec 2014',
        title: 'Right to Fair Compensation and Transparency in Land Acquisition, Rehabilitation and Resettlement (Amendment) Ordinance, 2015',
        by: 'President of India (Ordinance No. 9 of 2014)',
        gazette: 'Gazette of India Extraordinary, Part II, Sec. 1, No. 85, dated 31 Dec 2014',
        changes: [
          { chapter: 'Chapter I — Preliminary', section: 'Sec. 10A', subsection: '—', page: 'p. 7', type: 'Inserted',
            before: '(Section did not exist) — Consent of 80% affected families and Social Impact Assessment (SIA) were mandatory for ALL land acquisition under the Act.',
            after:  'New Sec. 10A: Consent and SIA provisions shall NOT apply to acquisition for 5 categories: (i) defence and national security, (ii) rural infrastructure, (iii) affordable housing for poor, (iv) industrial corridors set up by Government, (v) infrastructure projects including PPP where ownership of land continues with Government.' },
          { chapter: 'Chapter II-A — Urgency Clause', section: 'Ch. II-A (Secs. 40A–40F)', subsection: 'Secs. 40A–40F', page: 'p. 31', type: 'Inserted',
            before: '(Chapter did not exist) — Emergency/urgency acquisition was governed by the old Land Acquisition Act, 1894 urgency provisions, which provided very limited compensation.',
            after:  'New Chapter II-A inserted: Urgency Clause — Collector may take possession of land for infrastructure projects after depositing 75% of estimated compensation (remaining 25% to be paid within 6 months). National Monument Authority and State Government consent required. Applies only to projects where immediate possession is essential.' },
        ],
      },
    ],
  },

  hpca: {
    enacted: '22 Apr 1994', status: 'Active — as amended',
    amendments: [
      {
        year: 2016, date: '11 Mar 2016',
        title: 'Haryana Panchayati Raj (Amendment) Act, 2016',
        by: 'Haryana State Legislature',
        gazette: 'Haryana Government Gazette Extraordinary, No. 67, dated 11 Mar 2016',
        changes: [
          { chapter: 'Chapter XII — Disqualifications', section: 'Sec. 175', subsection: 'Cl. (q)', page: 'p. 103', type: 'Inserted',
            before: '(Clause did not exist) — No disqualification from Panchayat election on grounds of number of children.',
            after:  'New Cl. (q): A person shall be disqualified from being chosen as, or for being, a Sarpanch, Panch or member of Panchayat Samiti or Zila Parishad if such person has more than two living children on or after a date to be notified by the State Government. Exception: children born of a single pregnancy producing more than one child shall be counted as one.' },
          { chapter: 'Chapter IX — Gram Panchayat Proceedings', section: 'Sec. 163', subsection: 'Sub-sec. (3)', page: 'p. 89', type: 'Amended',
            before: 'Sub-sec. (3): No business shall be transacted at a meeting of the Gram Panchayat unless at least one-third of the total members of the Gram Panchayat are present.',
            after:  'Sub-sec. (3): No business shall be transacted at a meeting of the Gram Panchayat unless at least one-half of the total members are present. Provided that for passing resolutions relating to levy of taxes, fees or user charges, a quorum of two-thirds of total members shall be required.' },
        ],
      },
    ],
  },
};

/* ─── Knowledge Graph data ─── */
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
  {
    source: 'const', target: 'hma', label: 'Empowers',
    srcSection: 'Art. 243P – 243ZG', srcChapter: 'Part IXA — Municipalities', srcPage: 'p. 118',
    detail: 'Part IXA (inserted by the 74th Constitutional Amendment, 1992) constitutionally mandates the establishment of Municipalities and directs State Legislatures to enact municipal governance laws — directly enabling the Haryana Municipal Act, 1973.',
  },
  {
    source: 'const', target: 'hpca', label: 'Empowers',
    srcSection: 'Art. 243 – 243O', srcChapter: 'Part IX — Panchayats', srcPage: 'p. 112',
    detail: 'Part IX (inserted by the 73rd Constitutional Amendment, 1992) constitutionally mandates the establishment of Gram Panchayats at the village level and empowers State Legislatures to enact Panchayati Raj laws, directly enabling the Haryana Panchayati Raj Act, 1994.',
  },
  {
    source: 'const', target: 'rti', label: 'Art. 19 basis',
    srcSection: 'Art. 19(1)(a)', srcChapter: 'Part III — Fundamental Rights', srcPage: 'p. 10',
    detail: 'Art. 19(1)(a) guarantees freedom of speech and expression. The Supreme Court in Union of India v. Association for Democratic Reforms (2002) held that this right includes the right to information. The RTI Act, 2005 gives statutory form to this constitutional right.',
  },
  {
    source: 'const', target: 'larr', label: 'Art. 300A basis',
    srcSection: 'Art. 300A', srcChapter: 'Part XII — Finance, Property, Contracts', srcPage: 'p. 131',
    detail: 'Art. 300A provides that no person shall be deprived of their property save by authority of law. This is the constitutional foundation for all compulsory land acquisition legislation including the Right to Fair Compensation and Transparency in Land Acquisition Act, 2013.',
  },
  {
    source: 'rti', target: 'rti_rules', label: 'Implemented by',
    srcSection: 'Sec. 27', srcChapter: 'Chapter VI — Miscellaneous', srcPage: 'p. 22',
    detail: 'Sec. 27 of the RTI Act empowers State Governments to make rules to carry out the provisions of the Act. Haryana exercised this power to frame the Haryana Right to Information Rules, 2006 prescribing procedure for filing RTI applications.',
  },
  {
    source: 'larr', target: 'larr_hr', label: 'Supplemented by',
    srcSection: 'Sec. 109', srcChapter: 'Chapter XI — Miscellaneous', srcPage: 'p. 66',
    detail: 'Sec. 109 empowers State Governments to make rules under the Act. Haryana framed the Haryana Land Acquisition Rules, 2015 to specify the methodology for calculation of market value, Social Impact Assessment procedures, and R&R package in the State.',
  },
  {
    source: 'larr', target: 'pclr', label: 'Land records link',
    srcSection: 'Sec. 11 & Schedule II', srcChapter: 'Chapter II — Determination of Social Impact', srcPage: 'p. 9',
    detail: 'Sec. 11 requires the Administrator to prepare a Social Impact Assessment report using land records maintained under revenue laws. Schedule II mandates use of jamabandi, khasra, and khatoni records — maintained under Punjab Land Revenue Act, 1887 — for determining ownership and occupancy rights.',
  },
  {
    source: 'factories', target: 'labour', label: 'Labour provisions',
    srcSection: 'Sec. 111A', srcChapter: 'Chapter X — Penalties and Procedure', srcPage: 'p. 58',
    detail: 'Sec. 111A (inserted by Amendment Act 1987) empowers the State Government to make provisions for welfare of workers. Haryana\'s Labour Welfare Fund Act draws from this enabling power to establish a welfare fund for workers in factories and establishments.',
  },
  {
    source: 'hma', target: 'hma_am', label: 'Amended by',
    srcSection: 'Sec. 67 & Sec. 100A', srcChapter: 'Ch. VII — Sanitation & Ch. XII — Misc.', srcPage: 'p. 44 & p. 68',
    detail: 'The 2019 Amendment Act substituted Sec. 67 (solid waste management obligations) and inserted new Sec. 100A (Smart City provisions). These two sections are the specific locus of amendment in the parent Haryana Municipal Act, 1973.',
  },
  {
    source: 'hma', target: 'notif1', label: 'Notified under',
    srcSection: 'Sec. 188 read with Sec. 257', srcChapter: 'Ch. XIV — Building Regulations', srcPage: 'p. 118',
    detail: 'Sec. 188 empowers municipalities to make bye-laws for building construction, and Sec. 257 empowers the State Government to issue notifications overriding or supplementing bye-laws. The Urban Development Notification, 2021 was issued under these powers to revise building bylaws across all Haryana municipalities.',
  },
  {
    source: 'hpca', target: 'pclr', label: 'Revenue records',
    srcSection: 'Sec. 73 & Sec. 74', srcChapter: 'Ch. VI — Panchayat Property', srcPage: 'p. 46',
    detail: 'Sec. 73 requires Gram Panchayats to maintain a register of Shamlat Deh (common land), and Sec. 74 requires them to reconcile Panchayat property records with jamabandi records maintained by the Patwari under Punjab Land Revenue Act, 1887.',
  },
  {
    source: 'labour', target: 'notif2', label: 'Order under',
    srcSection: 'Sec. 11', srcChapter: 'Ch. II — Haryana Labour Welfare Fund', srcPage: 'p. 8',
    detail: 'Sec. 11 empowers the State Government to revise contribution rates payable by employer and employee to the Fund by notification in the Official Gazette. The Labour Welfare Order, 2022 exercised this power to revise the employer and worker contribution rates.',
  },
  {
    source: 'rera', target: 'hma', label: 'Coordination',
    srcSection: 'Sec. 40 & Sec. 58', srcChapter: 'Ch. IV — Functions of Authority', srcPage: 'p. 24',
    detail: 'Sec. 40 requires RERA to coordinate with local authorities regarding layout approvals, and Sec. 58 requires Municipal Committees to share building plan approval data with RERA. This creates a direct operational link between RERA Haryana, 2017 and the Municipal Act.',
  },
  {
    source: 'rti_rules', target: 'notif1', label: 'Referenced in',
    srcSection: 'Rule 4(3)', srcChapter: 'Part II — Procedure for Seeking Information', srcPage: 'p. 4',
    detail: 'Rule 4(3) of Haryana RTI Rules, 2006 directs that all proactive disclosures made by municipalities (including notifications, circulars, and bye-laws) must be made available on the municipal website. The Urban Development Notification, 2021 was required to be displayed under this rule.',
  },
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
function KnowledgeGraph({ focusId, allNodes = KG_NODES, allLinks = KG_LINKS, onNodeClick }) {
  const svgRef         = useRef(null);
  const tooltipRef     = useRef(null);
  const onNodeClickRef = useRef(onNodeClick);
  useEffect(() => { onNodeClickRef.current = onNodeClick; }, [onNodeClick]);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const svg = d3.select(el);
    svg.selectAll('*').remove();
    const W = el.clientWidth || 700;
    const H = 580;
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

    // ── pre-position nodes in type rings before simulation ──
    const RING = { central: 0, state: 160, rules: 270, amend: 270, notif: 270 };
    const byType = {};
    nodes.forEach(n => { (byType[n.type] = byType[n.type] || []).push(n); });
    Object.entries(byType).forEach(([type, group]) => {
      const r = RING[type] ?? 210;
      group.forEach((n, i) => {
        const angle = (2 * Math.PI * i) / group.length - Math.PI / 2;
        n.x = W / 2 + r * Math.cos(angle);
        n.y = H / 2 + r * Math.sin(angle);
      });
    });

    // ── simulation ──
    const sim = d3.forceSimulation(nodes)
      .force('link',      d3.forceLink(links).id(d => d.id).distance(160).strength(0.5))
      .force('charge',    d3.forceManyBody().strength(-600))
      .force('center',    d3.forceCenter(W / 2, H / 2).strength(0.08))
      .force('forceX',    d3.forceX(W / 2).strength(0.04))
      .force('forceY',    d3.forceY(H / 2).strength(0.04))
      .force('collision', d3.forceCollide(56))
      .alphaDecay(0.018);

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
      .on('mouseleave', () => tip.style('display', 'none'))
      .on('click', (event, d) => {
        event.stopPropagation();
        tip.style('display', 'none');
        onNodeClickRef.current?.(d);
      });

    // ── tick ──
    const pad = 36;
    sim.on('tick', () => {
      nodes.forEach(d => {
        d.x = Math.max(pad, Math.min(W - pad, d.x));
        d.y = Math.max(pad, Math.min(H - pad, d.y));
      });
      linkG
        .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
      linkLabel
        .attr('x', d => (d.source.x + d.target.x) / 2)
        .attr('y', d => (d.source.y + d.target.y) / 2 - 4);
      nodeG.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    return () => sim.stop();
  }, [focusId]);

  return (
    <div style={{ position: 'relative' }}>
      <svg ref={svgRef} style={{ width: '100%', minHeight: 580, display: 'block' }} />

      {/* Tooltip */}
      <div ref={tooltipRef} style={{
        display: 'none', position: 'absolute', pointerEvents: 'none',
        background: '#fff', border: '1px solid #e2e8f0',
        borderRadius: 8, padding: '10px 14px',
        fontSize: 12, color: '#374151', maxWidth: 220, lineHeight: 1.5,
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)', zIndex: 10,
      }} />

      {/* Legend */}
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
  approve: ['rgba(25, 135, 84,.1)','#1e40af','rgba(25, 135, 84,.25)','APPROVE'],
  reject:  ['rgba(220, 53, 69,.1)','#b91c1c','rgba(220, 53, 69,.25)','REJECT'],
  submit:  ['rgba(255, 193, 7,.1)','#b45309','rgba(255, 193, 7,.25)','UPLOAD'],
  search:  ['rgba(33, 74, 171,.1)','#214aab','rgba(33, 74, 171,.25)','SEARCH'],
  view:    ['rgba(13, 110, 253,.1)','#1d4ed8','rgba(13, 110, 253,.25)','VIEW'],
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

/* ─── Node Detail Panel (full-width, below graph) ─── */
const CHANGE_COLORS = { Amended: '#ffc107', Substituted: '#0d6efd', Inserted: '#198754', Deleted: '#dc3545', Expanded: '#8b5cf6' };

function NodeDetailPanel({ node, allNodes, allLinks, onClose }) {
  const [tab, setTab] = useState('timeline');
  const [expandedLink, setExpandedLink] = useState(null);
  const [expandedAmend, setExpandedAmend] = useState(null); // index of open amendment, null = all collapsed
  const history    = NODE_HISTORY[node.id];
  const nodeColor  = NODE_COLORS[node.type] || '#94a3b8';
  const totalAmendCount  = history ? history.amendments.reduce((s, a) => s + a.changes.length, 0) : 0;

  const getNodeId = x => typeof x === 'object' ? x.id : x;
  const outgoing = allLinks.filter(l => getNodeId(l.source) === node.id);
  const incoming = allLinks.filter(l => getNodeId(l.target) === node.id);

  return (
    <div style={{ border: '1px solid var(--primary-border)', borderRadius: 12, background: 'var(--surface-card)', overflow: 'hidden', animation: 'fadeSlideIn .25s ease' }}>

      {/* ══ Header band ══════════════════════════════════════════ */}
      <div style={{ background: nodeColor + '12', borderBottom: `2px solid ${nodeColor}30`, padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          {/* Left: title block */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{ width: 11, height: 11, borderRadius: '50%', background: nodeColor, flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, color: nodeColor, textTransform: 'uppercase', letterSpacing: '.07em', background: nodeColor + '18', padding: '2px 8px', borderRadius: 20 }}>
                {node.type}
              </span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, fontWeight: 600, color: 'var(--text-color-secondary)' }}>
                {node.year} &nbsp;·&nbsp; {node.dept}
              </span>
              <span style={{
                fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700,
                color: history?.status?.includes('Active') ? '#16a34a' : '#dc2626',
                background: history?.status?.includes('Active') ? 'rgba(22,163,74,.1)' : 'rgba(220,38,38,.1)',
                padding: '2px 8px', borderRadius: 20,
              }}>{history?.status ?? 'Active'}</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-heading)', lineHeight: 1.25, marginBottom: 6 }}>{node.label}</div>
            {node.desc && <div style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-color-secondary)', lineHeight: 1.55 }}>{node.desc}</div>}
          </div>

          {/* Right: stats + close */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, flexShrink: 0 }}>
            <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--surface-border)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-color-secondary)', padding: '4px 10px', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font)' }}>✕ Close</button>
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { label: 'Enacted', value: history?.enacted ?? node.year },
                { label: 'Amendments', value: history ? history.amendments.length : 0 },
                { label: 'Provisions changed', value: totalAmendCount },
              ].map(({ label: lbl, value }) => (
                <div key={lbl} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-heading)', fontFamily: 'var(--mono)', lineHeight: 1 }}>{value}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-color-secondary)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '.05em', fontFamily: 'var(--mono)' }}>{lbl}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 4, marginTop: 14 }}>
          {[['timeline', `Amendment Timeline (${history?.amendments.length ?? 0})`], ['relations', `Relationships (${outgoing.length + incoming.length})`]].map(([key, lbl]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              padding: '6px 14px', borderRadius: 7, border: `1px solid ${tab === key ? nodeColor : 'var(--surface-border)'}`,
              cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font)',
              background: tab === key ? nodeColor : 'var(--surface-card)',
              color: tab === key ? '#fff' : 'var(--text-color-secondary)',
              transition: 'all .15s',
            }}>{lbl}</button>
          ))}
        </div>
      </div>

      {/* ══ Content ══════════════════════════════════════════════ */}
      <div style={{ padding: '20px 24px' }}>

        {/* ── Timeline tab ── */}
        {tab === 'timeline' && (
          !history
            ? <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--text-color-secondary)', fontSize: 13 }}>No amendment history recorded for this document in the repository.</div>
            : <div style={{ position: 'relative' }}>
                {/* Spine line */}
                <div style={{ position: 'absolute', left: 19, top: 20, bottom: 0, width: 2, background: 'var(--surface-border)' }} />

                {/* ── Enactment entry ── */}
                <div style={{ display: 'flex', gap: 16, marginBottom: 24, position: 'relative', zIndex: 1 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: nodeColor + '20', border: `2.5px solid ${nodeColor}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: nodeColor, fontFamily: 'var(--mono)' }}>
                    {node.year}
                  </div>
                  <div style={{ flex: 1, paddingTop: 8 }}>
                    <div style={{ fontSize: 'var(--font-size-p2)', fontWeight: 700, color: 'var(--text-heading)' }}>Original Enactment — {history.enacted}</div>
                    <div style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-color-secondary)', marginTop: 2 }}>{node.label} came into force on {history.enacted}.</div>
                  </div>
                </div>

                {/* ── Each amendment ── */}
                {history.amendments.map((amend, ai) => {
                  const isOpen = expandedAmend === ai;
                  return (
                  <div key={ai} style={{ display: 'flex', gap: 16, marginBottom: 16, position: 'relative', zIndex: 1 }}>
                    {/* Year bubble */}
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: isOpen ? 'rgba(13, 110, 253,.25)' : 'rgba(13, 110, 253,.12)', border: `2.5px solid #0d6efd`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, fontWeight: 700, color: '#1d4ed8', fontFamily: 'var(--mono)', textAlign: 'center', lineHeight: 1.1, transition: 'background .2s' }}>
                      {amend.year}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* ── Clickable amendment heading ── */}
                      <div
                        onClick={() => setExpandedAmend(isOpen ? null : ai)}
                        style={{ background: isOpen ? 'rgba(33, 74, 171,.04)' : 'var(--surface-ground)', border: `1px solid ${isOpen ? 'var(--primary-border)' : 'var(--surface-border)'}`, borderRadius: isOpen ? '10px 10px 0 0' : 10, padding: '11px 16px', cursor: 'pointer', transition: 'background .3s, border-color .3s, border-radius .3s', userSelect: 'none' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 'var(--font-size-p2)', fontWeight: 700, color: 'var(--text-heading)', marginBottom: 3 }}>{amend.title}</div>
                            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                              <span style={{ fontSize: 11.5, color: 'var(--text-color-secondary)' }}>
                                <strong style={{ color: 'var(--text-color)' }}>Authority:</strong> {amend.by}
                              </span>
                              <span style={{ fontSize: 11.5, color: 'var(--text-color-secondary)' }}>
                                <strong style={{ color: 'var(--text-color)' }}>Date:</strong> {amend.date}
                              </span>
                              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: 'rgba(13, 110, 253,.1)', color: '#1d4ed8' }}>
                                {amend.changes.length} provision{amend.changes.length !== 1 ? 's' : ''} changed
                              </span>
                            </div>
                          </div>
                          {/* Expand chevron */}
                          <div style={{ flexShrink: 0, width: 28, height: 28, borderRadius: '50%', background: isOpen ? 'var(--primary)' : 'var(--surface-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .3s' }}>
                            <span style={{ fontSize: 13, color: isOpen ? '#fff' : 'var(--text-color-secondary)', lineHeight: 1, display: 'inline-block', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .35s ease, color .3s' }}>⌄</span>
                          </div>
                        </div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-color-secondary)', marginTop: 5, fontFamily: 'var(--mono)', opacity: isOpen ? 0 : 0.75, maxHeight: isOpen ? 0 : '2em', overflow: 'hidden', transition: 'opacity .25s, max-height .3s ease' }}>
                          {amend.gazette}
                        </div>
                      </div>

                      {/* ── Expandable changes panel (always in DOM, height-animated) ── */}
                      <div style={{ maxHeight: isOpen ? '2400px' : 0, overflow: 'hidden', transition: 'max-height .45s cubic-bezier(.4,0,.2,1)', borderRadius: '0 0 10px 10px' }}>
                        <div style={{ border: '1px solid var(--primary-border)', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: isOpen ? '14px 16px' : '0 16px', opacity: isOpen ? 1 : 0, transition: 'opacity .3s ease .1s, padding .3s ease', background: 'var(--surface-card)' }}>
                          <div style={{ fontSize: 10.5, color: 'var(--text-color-secondary)', fontFamily: 'var(--mono)', marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid var(--surface-border)' }}>
                            {amend.gazette}
                          </div>

                          {/* Change type summary chips */}
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                            {Object.entries(
                              amend.changes.reduce((acc, ch) => { acc[ch.type] = (acc[ch.type] || 0) + 1; return acc; }, {})
                            ).map(([type, count]) => {
                              const cc = CHANGE_COLORS[type] || '#94a3b8';
                              return (
                                <span key={type} style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: cc + '18', color: cc, border: `1px solid ${cc}35` }}>
                                  {count}× {type}
                                </span>
                              );
                            })}
                          </div>

                          {/* Changes — one card per change */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {amend.changes.map((ch, ci) => {
                              const cc = CHANGE_COLORS[ch.type] || '#94a3b8';
                              return (
                                <div key={ci} style={{ border: `1px solid ${cc}30`, borderRadius: 10, overflow: 'hidden' }}>
                                  {/* Change location header */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: cc + '0d', borderBottom: `1px solid ${cc}25`, flexWrap: 'wrap' }}>
                                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: cc + '20', color: cc, border: `1px solid ${cc}40`, whiteSpace: 'nowrap' }}>
                                      {ch.type}
                                    </span>
                                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                                      <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-heading)', fontFamily: 'var(--mono)' }}>{ch.section}</span>
                                      {ch.subsection && ch.subsection !== '—' && (
                                        <span style={{ fontSize: 11, color: 'var(--text-color-secondary)', fontFamily: 'var(--mono)' }}>Sub-sec: {ch.subsection}</span>
                                      )}
                                      <span style={{ fontSize: 11, color: 'var(--text-color-secondary)', fontFamily: 'var(--mono)' }}>Chapter: {ch.chapter}</span>
                                      <span style={{ fontSize: 11, color: 'var(--text-color-secondary)', fontFamily: 'var(--mono)', fontWeight: 600 }}>{ch.page}</span>
                                    </div>
                                  </div>
                                  {/* Before */}
                                  <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(220, 53, 69,.12)', background: 'rgba(220, 53, 69,.03)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                                      <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, fontWeight: 800, color: '#dc3545', background: 'rgba(220, 53, 69,.12)', padding: '2px 8px', borderRadius: 4, letterSpacing: '.06em' }}>BEFORE</span>
                                      <span style={{ fontSize: 10.5, color: 'var(--text-color-secondary)', fontStyle: 'italic' }}>Original provision</span>
                                    </div>
                                    <div style={{ fontSize: 12.5, color: '#7f1d1d', lineHeight: 1.7, fontStyle: 'italic', paddingLeft: 4, borderLeft: '3px solid rgba(220, 53, 69,.3)' }}>"{ch.before}"</div>
                                  </div>
                                  {/* After */}
                                  <div style={{ padding: '10px 14px', background: 'rgba(22,163,74,.03)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                                      <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, fontWeight: 800, color: '#16a34a', background: 'rgba(22,163,74,.12)', padding: '2px 8px', borderRadius: 4, letterSpacing: '.06em' }}>AFTER</span>
                                      <span style={{ fontSize: 10.5, color: 'var(--text-color-secondary)', fontStyle: 'italic' }}>As amended</span>
                                    </div>
                                    <div style={{ fontSize: 12.5, color: '#14532d', lineHeight: 1.7, paddingLeft: 4, borderLeft: '3px solid rgba(22,163,74,.4)', fontWeight: 500 }}>"{ch.after}"</div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
        )}

        {/* ── Relationships tab ── */}
        {tab === 'relations' && (
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {[
              { title: 'Outgoing Relationships', subtitle: 'Documents this act empowers, amends, or governs — click to see the specific provision', items: outgoing, getOther: l => getNodeId(l.target), dirLabel: 'FROM THIS DOC', arrow: '→' },
              { title: 'Incoming Relationships', subtitle: 'Acts and instruments that reference or depend on this document — click to see the specific provision', items: incoming, getOther: l => getNodeId(l.source), dirLabel: 'FROM OTHER DOC', arrow: '←' },
            ].map(({ title, subtitle, items, getOther, dirLabel, arrow }) => (
              <div key={title} style={{ flex: 1, minWidth: 280 }}>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 'var(--font-size-p2)', fontWeight: 700, color: 'var(--text-heading)' }}>{title}</div>
                  <div style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-color-secondary)' }}>{subtitle}</div>
                </div>
                {items.length === 0
                  ? <div style={{ padding: '16px', borderRadius: 8, background: 'var(--surface-ground)', fontSize: 12.5, color: 'var(--text-color-secondary)', textAlign: 'center' }}>None recorded</div>
                  : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {items.map((l, i) => {
                        const otherId = getOther(l);
                        const other = allNodes.find(n => n.id === otherId);
                        const oc = NODE_COLORS[other?.type] ?? '#94a3b8';
                        const linkKey = `${getNodeId(l.source)}-${getNodeId(l.target)}-${l.label}`;
                        const isOpen  = expandedLink === linkKey;
                        const hasDetail = l.srcSection || l.detail;

                        return (
                          <div key={i} style={{ borderRadius: 10, border: `1px solid ${isOpen ? 'var(--primary-border)' : 'var(--surface-border)'}`, overflow: 'hidden', transition: 'border-color .15s', background: isOpen ? 'rgba(33, 74, 171,.02)' : 'var(--surface-ground)' }}>
                            {/* Card header — always visible */}
                            <div
                              onClick={() => hasDetail && setExpandedLink(isOpen ? null : linkKey)}
                              style={{ display: 'flex', gap: 12, padding: '10px 14px', alignItems: 'center', cursor: hasDetail ? 'pointer' : 'default' }}
                            >
                              <span style={{ width: 10, height: 10, borderRadius: '50%', background: oc, flexShrink: 0 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-heading)' }}>{other?.label ?? otherId}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-color-secondary)', fontFamily: 'var(--mono)', marginTop: 1 }}>{other?.year} · {other?.dept}</div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: 'rgba(33, 74, 171,.1)', color: 'var(--primary)', whiteSpace: 'nowrap' }}>{arrow} {l.label}</span>
                                {hasDetail && (
                                  <span style={{ fontSize: 14, color: 'var(--text-color-secondary)', lineHeight: 1, transition: 'transform .2s', display: 'inline-block', transform: isOpen ? 'rotate(180deg)' : 'none' }}>⌄</span>
                                )}
                              </div>
                            </div>

                            {/* Expanded detail — specific provision */}
                            {isOpen && hasDetail && (
                              <div style={{ borderTop: '1px solid var(--primary-border)', background: 'var(--surface-card)', padding: '14px 16px', animation: 'fadeSlideIn .15s ease' }}>
                                {/* Provision location row */}
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, color: 'var(--text-color-secondary)', textTransform: 'uppercase', letterSpacing: '.06em', marginRight: 4 }}>{dirLabel}</span>
                                  {l.srcSection && (
                                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: 'var(--primary)', background: 'var(--primary-light)', padding: '2px 9px', borderRadius: 20, border: '1px solid var(--primary-border)' }}>
                                      {l.srcSection}
                                    </span>
                                  )}
                                  {l.srcChapter && (
                                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-color)', background: 'var(--surface-ground)', padding: '2px 9px', borderRadius: 20, border: '1px solid var(--surface-border)' }}>
                                      {l.srcChapter}
                                    </span>
                                  )}
                                  {l.srcPage && (
                                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-color-secondary)', background: 'var(--surface-ground)', padding: '2px 9px', borderRadius: 20, border: '1px solid var(--surface-border)' }}>
                                      {l.srcPage}
                                    </span>
                                  )}
                                </div>
                                {/* Detail explanation */}
                                {l.detail && (
                                  <div style={{ fontSize: 12.5, color: 'var(--text-color)', lineHeight: 1.65, paddingLeft: 10, borderLeft: '3px solid var(--primary-border)' }}>
                                    {l.detail}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )
                }
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Graph Tab with selector ─── */
function GraphTab({ documents, relationships }) {
  const [focusId, setFocusId]       = useState(null);
  const [search, setSearch]         = useState('');
  const [showDrop, setShowDrop]     = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const detailRef = useRef(null);

  // Auto-scroll to detail panel whenever a node is selected
  useEffect(() => {
    if (selectedNode && detailRef.current) {
      setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    }
  }, [selectedNode?.id]);

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
            <div style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-color-secondary)', marginTop: -8 }}>
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

        {/* Graph — full width */}
        <div style={{ background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', borderRadius: 10, overflow: 'hidden', position: 'relative' }}>
          <KnowledgeGraph
            focusId={focusId}
            allNodes={allNodes}
            allLinks={allLinks}
            onNodeClick={node => setSelectedNode(prev => prev?.id === node.id ? null : node)}
          />
          {!selectedNode && (
            <div style={{ position: 'absolute', bottom: 58, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,.55)', color: '#fff', fontSize: 11.5, fontWeight: 500, padding: '5px 14px', borderRadius: 20, pointerEvents: 'none', whiteSpace: 'nowrap', backdropFilter: 'blur(4px)' }}>
              Click any node to view amendment history
            </div>
          )}
        </div>

        {/* Detail panel — below graph, full width */}
        {selectedNode && (
          <div ref={detailRef} style={{ marginTop: 16, scrollMarginTop: 16 }}>
            <NodeDetailPanel
              node={selectedNode}
              allNodes={allNodes}
              allLinks={allLinks}
              onClose={() => setSelectedNode(null)}
            />
          </div>
        )}
      </Card>
    </div>
  );
}

const AUDIT_FILTERS = ['All', 'Approved', 'Rejected', 'Uploaded', 'Searched', 'Viewed'];

// Shared once per return — mirrors the <style> convention used in the other dashboards.
const CSO_RESPONSIVE_CSS = `
  @media (max-width: 1024px) {
    .cso-stats-grid { grid-template-columns: repeat(2,1fr) !important; }
  }
  @media (max-width: 640px) {
    .cso-stats-grid { grid-template-columns: 1fr !important; }
    .cso-chart-grid { grid-template-columns: 1fr !important; }
  }
`;

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
        <style>{CSO_RESPONSIVE_CSS}</style>
        <div className="cso-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <StatCard icon={FileText}    label="Total Documents" value={s.totalDocuments} sub="In the system"         iconBg="rgba(33, 74, 171,.12)"  iconColor="#214aab" trend="+12%" />
          <StatCard icon={CheckCircle} label="Approved"        value={s.approved}       sub="Published docs"        iconBg="rgba(25, 135, 84,.12)"  iconColor="#198754" />
          <StatCard icon={Clock}       label="Pending"         value={s.pending}        sub="Awaiting review"       iconBg="rgba(255, 193, 7,.12)" iconColor="#ffc107" />
          <StatCard icon={XCircle}     label="Rejected"        value={s.rejected}       sub="Returned to uploader"  iconBg="rgba(220, 53, 69,.12)"  iconColor="#dc3545" />
        </div>

        <div className="cso-chart-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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

        <div className="cso-chart-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card>
            <SectionTitle>Status Distribution</SectionTitle>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={[{name:'Approved',value:s.approved},{name:'Pending',value:s.pending},{name:'Rejected',value:s.rejected}]}
                  cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                  {['#214aab','#ffc107','#dc3545'].map((c, i) => <Cell key={i} fill={c} />)}
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
                { label: 'Total Searches', value: s.totalSearches, color: '#0d6efd', pct: 100 },
                { label: 'Active Users',   value: s.activeUsers,   color: '#214aab', pct: 80 },
                { label: 'Approval Rate',  value: `${Math.round(s.approved / s.totalDocuments * 100)}%`, color: '#198754', pct: Math.round(s.approved / s.totalDocuments * 100) },
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

  /* ── MIS Report tab ── */
  return (
    <div style={{ animation: 'fadeSlideIn .3s ease' }}>
      <style>{CSO_RESPONSIVE_CSS}</style>
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
        <div className="table-scroll-wrap">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface-50)', borderBottom: '1px solid var(--surface-border)' }}>
              {['Timestamp', 'User', 'Role', 'Action', 'Detail', 'ZG Verified'].map((h, i) => (
                <th key={h} scope="col" style={{ ...label, padding: '12px 16px', textAlign: 'left', ...(i > 0 && { borderLeft: '1px solid var(--surface-border)' }) }}>{h}</th>
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
                <td style={{ padding: '11px 16px', borderLeft: '1px solid var(--surface-border)', fontSize: 13, fontWeight: 600, color: 'var(--text-heading)' }}>{log.user}</td>
                <td style={{ padding: '11px 16px', borderLeft: '1px solid var(--surface-border)' }}><Badge label={log.role} variant={log.role} /></td>
                <td style={{ padding: '11px 16px', borderLeft: '1px solid var(--surface-border)' }}><ActionPill action={log.action} /></td>
                <td style={{ padding: '11px 16px', borderLeft: '1px solid var(--surface-border)', fontSize: 12, color: 'var(--text-color-secondary)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.doc !== '—' ? log.doc : log.action}</td>
                <td style={{ padding: '11px 16px', borderLeft: '1px solid var(--surface-border)' }}>
                  {(log.action.toLowerCase().includes('searched') || log.action.toLowerCase().includes('viewed'))
                    ? <span style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, color: '#1e40af', background: 'rgba(25, 135, 84,.1)', border: '1px solid rgba(25, 135, 84,.25)', padding: '2px 8px', borderRadius: 5 }}>ZG ✓</span>
                    : <span style={{ color: 'var(--surface-200)', fontSize: 13 }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  );
}