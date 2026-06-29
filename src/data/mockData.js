export const DOCUMENTS = [
  { id: 1, title: 'Haryana Land Revenue Act 1887',       type: 'Act',       dept: 'Revenue',              year: 2022, status: 'approved', legalStatus: 'active',   pages: 124, uploader: 'Priya Sharma', uploadedAt: '2024-01-15', section: '4',  paragraph: '2',
    desc: 'An Act to amend the law relating to land revenue in Haryana. Section 4. The Financial Commissioner and the Commissioner shall exercise, subject to the control of the State Government, all the powers conferred by this Act. Every Collector shall, subject to the control of the Financial Commissioner and Commissioner, administer the revenue of his district.' },
  { id: 2, title: 'Municipal Corporation Bye-laws 2020', type: 'Bye-law',   dept: 'Urban Development',    year: 2020, status: 'approved', legalStatus: 'active',   pages: 89,  uploader: 'Priya Sharma', uploadedAt: '2024-02-10', section: '12', paragraph: '1',
    desc: 'Bye-laws governing the administration of Municipal Corporations in Haryana. Section 12. Building permissions — No person shall erect or re-erect any building or execute any development work within the municipal limits without prior written permission of the Commissioner.' },
  { id: 3, title: 'Haryana Right to Service Act 2014',   type: 'Act',       dept: 'General Administration', year: 2014, status: 'pending',  legalStatus: 'active',   pages: 45,  uploader: 'Priya Sharma', uploadedAt: '2024-03-05', section: '7',  paragraph: '3',
    desc: 'An Act to provide for time-bound delivery of services to citizens and for matters connected therewith. Section 7. Any person aggrieved by any order or decision of the designated officer may file an appeal before the First Appellate Authority within thirty days of such order.' },
  { id: 4, title: 'Building Plan Approval Guidelines',   type: 'Guideline', dept: 'Urban Development',    year: 2023, status: 'pending',  legalStatus: 'active',   pages: 67,  uploader: 'Priya Sharma', uploadedAt: '2024-03-20', section: '3',  paragraph: '1' },
  { id: 5, title: 'Haryana Panchayati Raj Act 1994',     type: 'Act',       dept: 'Rural Development',    year: 1994, status: 'approved', legalStatus: 'repealed', pages: 210, uploader: 'Priya Sharma', uploadedAt: '2024-01-28', section: '15', paragraph: '4',
    desc: 'An Act to consolidate and amend the law relating to Panchayati Raj institutions in Haryana. Section 15. Gram Panchayat shall have powers to impose and collect taxes on trades, callings and professions. Every panchayat shall maintain a fund to be called the Panchayat Fund.' },
  { id: 6, title: 'Property Tax Assessment Manual 2021', type: 'Manual',    dept: 'Revenue',              year: 2021, status: 'rejected', legalStatus: 'active',   pages: 78,  uploader: 'Priya Sharma', uploadedAt: '2024-02-18', section: '6',  paragraph: '2' },
  { id: 7, title: 'Environmental Clearance Procedures', type: 'Procedure', dept: 'Environment',          year: 2022, status: 'pending',  legalStatus: 'active',   pages: 55,  uploader: 'Priya Sharma', uploadedAt: '2024-03-12', section: '9',  paragraph: '1' },
  { id: 8, title: 'Haryana Shops & Establishments Act', type: 'Act',       dept: 'Labour',               year: 2008, status: 'approved', legalStatus: 'repealed', pages: 92,  uploader: 'Priya Sharma', uploadedAt: '2024-01-05', section: '11', paragraph: '5',
    desc: 'An Act to provide for regulation of conditions of work and employment in shops and commercial establishments. Section 11. Hours of work — No employee in any establishment shall be required to work for more than nine hours in any day or forty-eight hours in any week.' },
  { id: 9,  title: 'Right to Information Act 2005',        type: 'Act',       dept: 'General Administration', year: 2005, status: 'approved', legalStatus: 'active',   pages: 34,  uploader: 'Priya Sharma', uploadedAt: '2024-01-10', section: '6',  paragraph: '1',
    desc: `Preamble. The Right to Information Act 2005 (RTI Act, 2005) is a central legislation enacted by the Parliament of India, which came into force on 12 October 2005. The RTI Act 2005 gives every citizen of India a statutory right to request access to information held by any public authority. Under the Right to Information Act 2005, any public authority must furnish the requested information within thirty days of receipt of application. The Act was enacted to promote openness, transparency and accountability in the working of every public authority, and to contain corruption.

Section 3. Right to information — Subject to the provisions of the Right to Information Act 2005, all citizens shall have the right to information held by or under the control of any public authority.

Section 4. Obligations of public authorities — Every public authority shall maintain all its records duly catalogued and indexed in a manner which facilitates the right to information under the Right to Information Act 2005. All records appropriate to be computerised shall, within a reasonable time, be computerised and connected through a network all over the country on different systems so that access to such records is facilitated.

Section 6. Request for obtaining information — A person who desires to obtain any information under the Right to Information Act 2005 shall make a request in writing or through electronic means in English or Hindi or in the official language of the area, accompanying such fee as may be prescribed, to the concerned State Public Information Officer. An applicant shall not be required to give any reason for requesting the information or any other personal details except those necessary for contacting him.

Section 7. Disposal of request — The State Public Information Officer, on receipt of a request under the Right to Information Act 2005, shall within thirty days either provide the information on payment of such fee as may be prescribed or reject the request for reasons specified in Section 8.

Section 8. Exemption from disclosure — There shall be no obligation under the Right to Information Act 2005 to give any citizen information whose disclosure would prejudicially affect the sovereignty and integrity of India, or lead to incitement of an offence, or constitute contempt of court.` },
  { id: 10, title: 'Haryana RTI Rules 2006',               type: 'Rules & Regulations', dept: 'General Administration', year: 2006, status: 'approved', legalStatus: 'active', pages: 12, uploader: 'Priya Sharma', uploadedAt: '2024-01-12', section: '3', paragraph: '1',
    desc: `In exercise of the powers conferred by sub-section (1) of section 27 of the Right to Information Act 2005, the Government of Haryana hereby makes the following rules:

Rule 3. Application — (1) A person seeking information under the Right to Information Act 2005 shall make an application in Form-A to the concerned State Public Information Officer, accompanied by a fee of ten rupees by way of cash, or by demand draft or by banker's cheque payable to the Accounts Officer of the public authority.

Rule 4. Disposal — The State Public Information Officer shall dispose of a request for information as expeditiously as possible within thirty days from the date of receipt of the application, failing which it shall be deemed to have been refused.

Rule 5. Appeal — Any person aggrieved by the decision of the State Public Information Officer may prefer an appeal within thirty days to the First Appellate Authority, who shall decide the appeal within thirty days of receipt.` },
  { id: 11, title: 'CIC Transparency Guidelines 2019',     type: 'Circular', dept: 'General Administration', year: 2019, status: 'approved', legalStatus: 'active', pages: 8,  uploader: 'Priya Sharma', uploadedAt: '2024-01-20', section: '2', paragraph: '1',
    desc: 'Guidelines issued by the Central Information Commission under Right to Information Act 2005 to ensure proactive disclosure by public authorities. Para 2: Every public authority shall publish suo motu on its website, all information as prescribed under Section 4(1)(b) of the RTI Act 2005, and update the same at regular intervals of every three months.' },
  { id: 13, title: 'The Haryana Clerical (Recruitment and Conditions of Service) Act, 2026', type: 'Act', dept: 'General Administration', year: 2026, status: 'pending', legalStatus: 'active', pages: 22, uploader: 'Priya Sharma', uploadedAt: '2026-06-20',
    fileUrl: '/docs/The Haryana Clerical (Recruitment and Conditions of Service) Act, 2026.pdf',
    desc: 'An Act to regulate the recruitment and conditions of service of clerical staff in Government of Haryana departments.' },
  { id: 14, title: 'The States Reorganisation Act 1956', type: 'Act', dept: 'General Administration', year: 1956, status: 'pending', legalStatus: 'active', pages: 48, uploader: 'Priya Sharma', uploadedAt: '2026-06-22',
    fileUrl: '/docs/The States Reorganisation Act 1956.pdf',
    desc: 'An Act to provide for the reorganisation of the States of India and for matters connected therewith.' },
  { id: 15, title: 'The Haryana Salaries and Allowances of Minister Act, 1970', type: 'Act', dept: 'Finance Department', year: 1970, status: 'pending', legalStatus: 'active', pages: 10, uploader: 'Priya Sharma', uploadedAt: '2026-06-25',
    fileUrl: '/docs/The haryana salaries and allowance of minister act,1970.pdf',
    desc: 'An Act to provide for the salaries and allowances payable to Ministers in the State of Haryana.' },
  { id: 12, title: 'Right to Information (Amendment) Act 2026', type: 'Act', dept: 'General Administration', year: 2026, status: 'approved', legalStatus: 'active', pages: 18, uploader: 'Priya Sharma', uploadedAt: '2026-03-01', section: '3', paragraph: '2',
    desc: `The Right to Information (Amendment) Act 2026 was established on 15 February 2026 and came into force with effect from 1 April 2026, amending the principal Right to Information Act 2005.

The main changes introduced by the Right to Information Act 2026 are as follows:

Section 3. Digital-First Disclosure — Every public authority shall, within ninety days of the commencement of this Amendment Act, make available all records and information in machine-readable digital format on a centralised national RTI portal maintained by the Central Government. Physical applications shall continue to be accepted, however digital submissions shall be accorded priority processing.

Section 4. Revised Time Limits — The time limit for disposal of a request for information is reduced from thirty days to fifteen working days from the date of receipt. For requests involving life and liberty of a person, the limit is reduced from forty-eight hours to twenty-four hours.

Section 5. AI-Assisted Categorisation — Public authorities may use artificial intelligence tools for categorisation and indexing of records, provided that all decisions on disclosure or exemption shall be taken by a designated human officer and not by any automated system.

Section 6. Penalty Enhancement — The penalty for failure to provide information without reasonable cause is enhanced from a maximum of twenty-five thousand rupees to one lakh rupees per case, with provision for recovery from the personal salary of the defaulting officer.

Section 7. Whistleblower Protection — Any person who provides information in good faith under this Act shall be protected from any civil, criminal or departmental proceedings arising from such disclosure, provided the information does not fall within the exemptions prescribed under Section 8 of the principal Act.` },
];

export const AUDIT_LOGS = [
  { id: 1, user: 'Priya Sharma',  role: 'uploader', action: 'Uploaded document',  doc: 'Environmental Clearance Procedures', time: '2024-03-12 09:14' },
  { id: 2, user: 'Sunil Verma',   role: 'approver', action: 'Approved document',  doc: 'Haryana Land Revenue Act 1887',       time: '2024-03-12 10:32' },
  { id: 3, user: 'Ramesh Kumar',  role: 'citizen',  action: 'Searched documents', doc: 'Query: land revenue',                time: '2024-03-12 11:05' },
  { id: 4, user: 'Sunil Verma',   role: 'approver', action: 'Rejected document',  doc: 'Property Tax Assessment Manual 2021', time: '2024-03-12 11:48' },
  { id: 5, user: 'Priya Sharma',  role: 'uploader', action: 'Uploaded document',  doc: 'Building Plan Approval Guidelines',  time: '2024-03-12 13:20' },
  { id: 6, user: 'Anita Singh',   role: 'csoffice', action: 'Viewed audit log',   doc: '—',                                  time: '2024-03-12 14:00' },
  { id: 7, user: 'Ramesh Kumar',  role: 'citizen',  action: 'Viewed document',    doc: 'Haryana Panchayati Raj Act 1994',    time: '2024-03-12 14:35' },
  { id: 8, user: 'Priya Sharma',  role: 'uploader', action: 'Uploaded document',  doc: 'Haryana Right to Service Act 2014',  time: '2024-03-13 09:00' },
];

export const ANALYTICS_STATS = {
  totalDocuments: 8,
  approved: 4,
  pending: 3,
  rejected: 1,
  totalSearches: 142,
  activeUsers: 4,
  deptBreakdown: [
    { name: 'Revenue',     docs: 2 },
    { name: 'Urban',       docs: 2 },
    { name: 'Rural',       docs: 1 },
    { name: 'Labour',      docs: 1 },
    { name: 'Environment', docs: 1 },
    { name: 'General',     docs: 1 },
  ],
  monthlyUploads: [
    { month: 'Jan', uploads: 3 },
    { month: 'Feb', uploads: 2 },
    { month: 'Mar', uploads: 3 },
  ],
};

export const GRAPH_NODES = [
  { id: 'act1',  label: 'Land Revenue Act',        type: 'act',       x: 300, y: 200 },
  { id: 'act2',  label: 'Panchayati Raj Act',       type: 'act',       x: 600, y: 150 },
  { id: 'act3',  label: 'Right to Service Act',     type: 'act',       x: 150, y: 350 },
  { id: 'bylaw', label: 'Municipal Bye-laws',        type: 'bylaw',     x: 500, y: 350 },
  { id: 'guide', label: 'Building Plan Guidelines', type: 'guideline', x: 700, y: 300 },
  { id: 'man',   label: 'Property Tax Manual',       type: 'manual',    x: 400, y: 400 },
];

export const GRAPH_LINKS = [
  { source: 'act1', target: 'man',   label: 'defines basis' },
  { source: 'act2', target: 'act3',  label: 'references' },
  { source: 'bylaw', target: 'guide', label: 'governs' },
  { source: 'act1', target: 'act2',  label: 'amended by' },
  { source: 'act3', target: 'bylaw', label: 'applies to' },
];
