import type { AreaMeta, BusinessCalendar, Solution, SpecializationArea } from "../types";
import { calculateEffort, usesDirectHours } from "../lib/effort.ts";

export const BUILDERS = [
  { id: "mparry", name: "Michael Parry", email: "mparry@nextant.com" },
  { id: "jcastelblanco", name: "Juliana Castelblanco", email: "jcastelblanco@nextant.com" },
  { id: "lpreciado", name: "Luis David Preciado", email: "lpreciado@nextant.com" },
  { id: "mcubillos", name: "Mauricio Cubillos", email: "mcubillos@nextant.com" },
];

export const DEFAULT_BUSINESS_CALENDAR_ID = "us-federal-2026";

export const BUSINESS_CALENDARS: BusinessCalendar[] = [
  {
    id: DEFAULT_BUSINESS_CALENDAR_ID, name: "US business calendar (2026)",
    startDate: "2026-01-01", endDate: "2026-12-31",
    holidays: [
      "2026-01-01", "2026-01-19", "2026-02-16", "2026-05-25",
      "2026-06-19", "2026-07-03", "2026-09-07", "2026-10-12",
      "2026-11-11", "2026-11-26", "2026-12-25",
    ],
  },
];

export const AREAS: Record<SpecializationArea, AreaMeta> = {
  ai: {
    id: "ai",
    name: "AI & Automation",
    short: "AI",
    note: "Agents, copilots and automated workflows, built on Power Platform, Copilot Studio and Azure.",
    cssVar: "var(--sa-ai)",
  },
  data: {
    id: "data",
    name: "Data Solutions",
    short: "Data",
    note: "Data platforms, models and reporting — the work that makes the numbers trustworthy before anything is built on them.",
    cssVar: "var(--sa-data)",
  },
  ibo: {
    id: "ibo",
    name: "Intelligent Business Operations",
    short: "IBO",
    note: "Process redesign and the systems that run the operation day to day.",
    cssVar: "var(--sa-ibo)",
  },
};

export const AREA_ORDER: SpecializationArea[] = ["ai", "data", "ibo"];

/** Generated stand-in for an `nx_solutionimage` screenshot payload. */
function shot(label: string, from: string, to: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>` +
    `</linearGradient></defs>` +
    `<rect width="640" height="400" fill="url(#g)"/>` +
    `<rect x="24" y="24" width="280" height="160" rx="12" fill="rgba(255,255,255,0.16)"/>` +
    `<rect x="328" y="24" width="288" height="76" rx="12" fill="rgba(255,255,255,0.11)"/>` +
    `<rect x="328" y="108" width="288" height="76" rx="12" fill="rgba(255,255,255,0.11)"/>` +
    `<rect x="24" y="208" width="592" height="144" rx="12" fill="rgba(255,255,255,0.08)"/>` +
    `<text x="32" y="384" font-family="Segoe UI, sans-serif" font-size="22" font-weight="600" fill="rgba(255,255,255,0.85)">${label}</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const catalogue: Solution[] = [
  {
    id: "bso-quota",
    name: "BSO Quota",
    summary: "A governed, auditable quota cycle for a global partner sales organisation.",
    whatItDoes:
      "Two personas share one dataset. Every edit is audited against the WWIC ML3 baseline, cells outside the ±0.5% band are flagged before submission, and a grounded copilot answers questions or builds the chart you ask for. Nothing loads into MINT until the window closes clean.",
    businessValue:
      "A cycle that ran on email and 47 uploaded workbooks runs in one place, and every number that reaches the system of record carries a name and a reason.",
    useCase: "Run a governed quota cycle without email threads and spreadsheet uploads",
    specializationArea: "ai",
    contributors: [
      { id: "bso-mp", builtBy: BUILDERS[0], startDate: "2026-01-05", endDate: "2026-02-11", allocation: 75, calendarId: DEFAULT_BUSINESS_CALENDAR_ID },
      { id: "bso-lp", builtBy: BUILDERS[2], startDate: "2026-01-19", endDate: "2026-02-06", allocation: 50, calendarId: DEFAULT_BUSINESS_CALENDAR_ID },
    ],
    status: "Working prototype",
    publicationStatus: "Published",
    safetyAcknowledged: true,
    clientSafeReviewed: true,
    clientContext: "Contoso Global Partner Sales",
    clientContextRedacted: "a global technology vendor's partner organisation",
    dateAdded: "2026-02-11",
    libraryNotes: "Copilot answers are scripted for the demo path — avoid freeform questions on stage.",
    searchKeywords:
      "quota partner MSX MINT WWIC variance copilot excel EMEA sales allocation governance audit",
    capabilities: ["AI & agents", "Planning & analytics"],
    technologies: ["React", "Power Apps code app", "Dataverse", "Fluent 2", "Grounded copilot"],
    industries: ["Technology"],
    projects: [
      { id: "bso-p1", projectName: "Contoso — FY26 partner quota cycle", projectOwner: "Michael Parry" },
    ],
    images: [
      { id: "bso-img-1", src: shot("Quota workspace · EMEA view", "#1C567C", "#0F2734"), caption: "The shared quota workspace, filtered to EMEA" },
      { id: "bso-img-2", src: shot("Variance flags before submission", "#123F5D", "#57468C"), caption: "Cells outside the ±0.5% band, flagged before submit" },
      { id: "bso-img-3", src: shot("Grounded copilot answering", "#0B6157", "#1C567C"), caption: "The copilot builds the chart you ask for" },
    ],
    assets: [
      {
        id: "bso-html",
        name: "BSO Quota demo",
        assetType: "Self-contained HTML file",
        allowsEmbedding: true,
        sortOrder: 1,
      },
      {
        id: "bso-onepager",
        name: "BSO Quota one-pager",
        assetType: "Client-ready one-pager / slide",
        allowsEmbedding: false,
        sortOrder: 2,
      },
    ],
  },
  {
    id: "adoption-plan-studio",
    name: "Adoption Plan Studio",
    summary: "An agent that builds the account adoption plan from the systems that already hold the answers.",
    whatItDoes:
      "Search an account and the assistant assembles the plan from MSX, MSXi, Lynx and SPM — 158 fields straight through, 60 more derived. What is left is a short list of open questions, split into the ones the account team can answer and the ones only the customer can. The workbook fills in behind the conversation and downloads complete.",
    businessValue:
      "The adoption plan stops being a workbook filled in from memory the night before a review, and the customer answers questions about their own business instead of someone guessing at them.",
    useCase: "Assemble account adoption plans from the systems that already hold the answers",
    specializationArea: "ai",
    contributors: [
      { id: "adoption-mp", builtBy: BUILDERS[0], startDate: "2026-02-16", endDate: "2026-03-04", allocation: 100, calendarId: DEFAULT_BUSINESS_CALENDAR_ID },
    ],
    status: "Working prototype",
    publicationStatus: "Published",
    safetyAcknowledged: true,
    clientSafeReviewed: true,
    clientContext: "Internal build — three invented accounts",
    dateAdded: "2026-03-04",
    searchKeywords:
      "adoption consumption plan agent assistant MSX MSXi Lynx SPM workbook sponsor milestone copilot",
    capabilities: ["AI & agents", "Planning & analytics"],
    technologies: ["Agentic assistant", "Azure OpenAI", "Excel round-trip", "Power Automate"],
    industries: ["Technology", "Professional services"],
    assets: [
      {
        id: "adoption-html",
        name: "Adoption Plan Studio demo",
        assetType: "Self-contained HTML file",
        embedHint: "Pick a sample account, then say “show the plan”.",
        allowsEmbedding: true,
        sortOrder: 1,
      },
    ],
  },
  {
    id: "project-health-scorecard",
    name: "Project Health Scorecard",
    summary: "Portfolio delivery risk, from check-ins that take a project lead two minutes.",
    whatItDoes:
      "Eight weighted dimensions roll into one 0–100 health score with a six-week trend. The portfolio opens on where you're needed this week, and the check-in form pre-fills last week's answers so a lead changes only what moved.",
    businessValue:
      "Status decks disappear and risk surfaces the week it appears rather than at the quarterly review. The check-in is short enough that leads actually complete it, which is the only reason an executive view is ever current.",
    useCase: "Surface portfolio delivery risk the week it appears",
    specializationArea: "ibo",
    contributors: [
      { id: "score-mp", builtBy: BUILDERS[0], startDate: "2026-01-05", endDate: "2026-01-22", allocation: 50, calendarId: DEFAULT_BUSINESS_CALENDAR_ID },
    ],
    status: "Client demo",
    publicationStatus: "Published",
    safetyAcknowledged: true,
    clientSafeReviewed: true,
    clientContext: "Seven sample engagements",
    dateAdded: "2026-01-22",
    searchKeywords:
      "portfolio delivery RAG health check-in engagement risk fluent dataverse executive scorecard PMO",
    capabilities: ["Planning & analytics", "Workflow & approvals"],
    technologies: ["Power Apps code app", "Fluent 2", "Dataverse"],
    industries: ["Cross-industry"],
    images: [
      { id: "score-img-1", src: shot("Portfolio · where you're needed", "#57468C", "#123F5D"), caption: "The portfolio opens on this week's risk" },
      { id: "score-img-2", src: shot("Two-minute weekly check-in", "#1C567C", "#0B6157"), caption: "The check-in pre-fills last week's answers" },
    ],
    assets: [
      {
        id: "scorecard-html",
        name: "Scorecard demo",
        assetType: "Self-contained HTML file",
        embedHint: "Try the weekly check-in tab.",
        allowsEmbedding: true,
        sortOrder: 1,
      },
      {
        id: "scorecard-video",
        name: "Two-minute walkthrough",
        assetType: "Video walkthrough only",
        allowsEmbedding: true,
        sortOrder: 2,
      },
    ],
  },
  {
    id: "caip-budget",
    name: "CAIP Budget Management",
    summary: "One auditable queue for every GTM budget request, from draft to purchase order.",
    whatItDoes:
      "A requester raises an ask with amount, category and fiscal year and watches it move through team review and executive review. The budget owner decides with their remaining allocation in view, and can fund it from team budget or approve only the incremental gap.",
    businessValue:
      "Approvers stop reconstructing the allocation impact from a mail thread, nothing stalls invisibly, and finance sees committed demand before the invoice arrives.",
    useCase: "Track every budget request from ask to purchase order in one queue",
    specializationArea: "ibo",
    contributors: [
      { id: "caip-jc", builtBy: BUILDERS[1], startDate: "2026-02-09", endDate: "2026-02-27", allocation: 75, calendarId: DEFAULT_BUSINESS_CALENDAR_ID },
    ],
    status: "Working prototype",
    publicationStatus: "Published",
    safetyAcknowledged: true,
    clientSafeReviewed: true,
    clientContext: "Sample budget requests",
    dateAdded: "2026-02-28",
    searchKeywords:
      "budget request approval GTM programs purchase order finance allocation requester owner react",
    capabilities: ["Workflow & approvals"],
    technologies: ["React", "Dataverse", "Power Automate", "Role-based views"],
    industries: ["Professional services", "Technology"],
    assets: [
      {
        id: "caip-html",
        name: "CAIP demo",
        assetType: "Self-contained HTML file",
        embedHint: "Switch between requester and budget owner.",
        allowsEmbedding: true,
        sortOrder: 1,
      },
    ],
  },
  {
    id: "padelscope",
    name: "PadelScope Analysis",
    summary: "A purpose-built match-analysis app, taken from idea to a live URL on Azure.",
    whatItDoes:
      "Upload a match video, tag rallies as they play, and the app returns shot distribution, court coverage and unforced-error patterns per player. Built end to end in under three weeks to prove how fast a bespoke vertical app can reach production.",
    businessValue:
      "A concrete answer to “can you build us something bespoke, hosted, and real?” — with a URL a prospect can open on their own phone.",
    useCase: "Prove a bespoke vertical app can reach production in weeks",
    specializationArea: "ai",
    contributors: [
      { id: "padel-lp", builtBy: BUILDERS[2], startDate: "2026-03-23", endDate: "2026-04-09", allocation: 100, calendarId: DEFAULT_BUSINESS_CALENDAR_ID },
    ],
    status: "Live in production",
    publicationStatus: "Published",
    safetyAcknowledged: true,
    clientSafeReviewed: true,
    clientContext: "Internal build",
    dateAdded: "2026-04-09",
    searchKeywords: "padel sport video analysis azure app service computer vision rally tagging",
    capabilities: ["AI & agents"],
    technologies: ["Azure App Service", "Python", "Computer vision", "React"],
    industries: ["Sports & entertainment"],
    assets: [
      {
        id: "padel-url",
        name: "PadelScope live app",
        assetType: "Hosted web app (URL)",
        externalUrl: "https://wapp-padel-mvp-e5gtayfyepd5h8fz.eastus-01.azurewebsites.net/",
        embedHint:
          "This is the live app on Azure, loading over the network. If the panel stays blank, the app is refusing to display inside another page.",
        allowsEmbedding: true,
        sortOrder: 1,
      },
    ],
  },
  {
    id: "kairo",
    name: "KAIRO Talent Intelligence",
    summary: "Match the right person to the right role from the skills data you already hold.",
    whatItDoes:
      "KAIRO reads role requirements, scores the bench against them, and explains every match in plain language — which skills carry the score, which are inferred from project history, and where the gap is.",
    businessValue:
      "Staffing decisions stop depending on who the resourcing manager happens to remember, and the reasoning behind a placement survives the conversation.",
    useCase: "Match the right person to the right role from existing skills data",
    specializationArea: "data",
    contributors: [
      { id: "kairo-mc", builtBy: BUILDERS[3], startDate: "2026-03-02", endDate: "2026-05-15", allocation: 60, calendarId: DEFAULT_BUSINESS_CALENDAR_ID },
      { id: "kairo-jc", builtBy: BUILDERS[1], startDate: "2026-04-06", endDate: "2026-05-01", allocation: 25, calendarId: DEFAULT_BUSINESS_CALENDAR_ID },
    ],
    status: "Live in production",
    publicationStatus: "Published",
    safetyAcknowledged: false,
    clientSafeReviewed: false,
    clientContext: "Northwind Staffing Group",
    clientContextRedacted: "a European professional-services firm",
    dateAdded: "2026-05-16",
    libraryNotes: "Real headcount figures in the skills matrix — do not screenshot outside present mode.",
    searchKeywords: "talent skills matching resourcing bench staffing people analytics power apps",
    capabilities: ["AI & agents", "Planning & analytics"],
    technologies: ["Power Apps", "Dataverse", "Azure OpenAI"],
    industries: ["Professional services"],
    projects: [
      { id: "kairo-p1", projectName: "Northwind Staffing — bench matching rollout", projectOwner: "Mauricio Cubillos" },
      { id: "kairo-p2", projectName: "Proseware Consulting — skills baseline", projectOwner: "Mauricio Cubillos" },
    ],
    assets: [
      {
        id: "kairo-pa",
        name: "KAIRO in Power Apps",
        assetType: "Power Apps",
        externalUrl:
          "https://apps.powerapps.com/play/e/f422918d-589b-e94c-9f08-d52183f8490b/a/3eb4b1f8-dfe2-4234-8249-b14887bea4b7",
        embedHint:
          "Power Apps sign-in stalls inside an embedded frame, so this one always opens in a new tab.",
        allowsEmbedding: false,
        sortOrder: 1,
      },
      {
        id: "kairo-video",
        name: "KAIRO walkthrough",
        assetType: "Video walkthrough only",
        allowsEmbedding: true,
        sortOrder: 2,
      },
    ],
  },
  {
    id: "supply-signal",
    name: "Supply Signal",
    summary: "A near-real-time view of inbound stock risk, assembled from four systems that never agreed.",
    whatItDoes:
      "Fabric pipelines land ERP, carrier, customs and weather feeds into one medallion model. A semantic layer resolves the three competing definitions of “on time”, and the report opens on the twelve shipments that will miss their window.",
    businessValue:
      "The daily supply stand-up stops arguing about whose number is right and starts deciding what to expedite.",
    useCase: "See inbound stock risk before shipments miss their window",
    specializationArea: "data",
    contributors: [
      { id: "supply-jc", builtBy: BUILDERS[1], startDate: "2026-04-01", endDate: "2026-06-02", allocation: 75, calendarId: DEFAULT_BUSINESS_CALENDAR_ID },
    ],
    status: "Client demo",
    publicationStatus: "Published",
    safetyAcknowledged: true,
    clientSafeReviewed: true,
    clientContext: "Fabrikam Logistics",
    clientContextRedacted: "a national logistics provider",
    dateAdded: "2026-06-02",
    searchKeywords:
      "supply chain fabric lakehouse medallion power bi semantic model shipments ETA logistics",
    capabilities: ["Data platform", "Planning & analytics"],
    technologies: ["Microsoft Fabric", "Power BI", "Data Factory", "Semantic model"],
    industries: ["Logistics", "Manufacturing"],
    projects: [
      { id: "supply-p1", projectName: "Fabrikam Logistics — inbound risk pilot", projectOwner: "Juliana Castelblanco" },
    ],
    assets: [
      {
        id: "supply-pbi",
        name: "Supply Signal report",
        assetType: "Power BI",
        externalUrl: "https://app.powerbi.com/",
        embedHint: "Power BI is deep-linked rather than embedded — authentication is unreliable in frames.",
        allowsEmbedding: false,
        sortOrder: 1,
      },
      {
        id: "supply-video",
        name: "Report walkthrough",
        assetType: "Video walkthrough only",
        allowsEmbedding: true,
        sortOrder: 2,
      },
    ],
  },
  {
    id: "ledger-reconciler",
    name: "Ledger Reconciler",
    summary: "Month-end reconciliation that explains its own exceptions instead of listing them.",
    whatItDoes:
      "Matches sub-ledger to GL across four entities, clusters the breaks by probable cause, and drafts the journal narrative for the accountant to approve or reject. Everything it proposes is traceable to the source rows.",
    businessValue:
      "Close moves from nine days to four, and the exceptions that remain arrive with a hypothesis attached.",
    useCase: "Shorten month-end close by explaining reconciliation breaks",
    specializationArea: "data",
    contributors: [
      { id: "ledger-mc", builtBy: BUILDERS[3], startDate: "2026-07-01", endDate: "2026-07-17", allocation: 50, calendarId: DEFAULT_BUSINESS_CALENDAR_ID },
    ],
    status: "Working prototype",
    publicationStatus: "Published",
    safetyAcknowledged: true,
    clientSafeReviewed: true,
    clientContext: "Internal build",
    dateAdded: "2026-07-18",
    searchKeywords: "finance close reconciliation general ledger journal exceptions audit fabric sql",
    capabilities: ["Data platform", "Workflow & approvals"],
    technologies: ["Azure SQL", "Python", "Power Apps code app"],
    industries: ["Financial services"],
    assets: [
      {
        id: "ledger-html",
        name: "Reconciler demo",
        assetType: "Self-contained HTML file",
        allowsEmbedding: true,
        sortOrder: 1,
      },
    ],
  },
  {
    id: "intake-triage",
    name: "Service Intake Triage",
    summary: "Every inbound request classified, routed and acknowledged before a human reads it.",
    whatItDoes:
      "A Copilot Studio agent takes requests from Teams, email and the portal, classifies them against the service catalogue, asks for the one missing field it needs, then opens the right work item with the right queue and priority.",
    businessValue:
      "First-response time drops from hours to seconds, and the service desk stops spending its morning sorting mail.",
    useCase: "Reduce manual triage of inbound service requests",
    specializationArea: "ibo",
    contributors: [
      { id: "intake-lp", builtBy: BUILDERS[2], startDate: "2026-07-20", endDate: "2026-08-05", allocation: 50, calendarId: DEFAULT_BUSINESS_CALENDAR_ID },
    ],
    status: "Client demo",
    publicationStatus: "Published",
    safetyAcknowledged: true,
    clientSafeReviewed: true,
    clientContext: "Tailwind Traders shared services",
    clientContextRedacted: "a multinational retailer's shared-services centre",
    dateAdded: "2026-08-05",
    searchKeywords:
      "service desk intake triage classification copilot studio teams routing queue ITSM shared services",
    capabilities: ["AI & agents", "Workflow & approvals"],
    technologies: ["Copilot Studio", "Power Automate", "Dataverse", "Teams"],
    industries: ["Retail", "Professional services"],
    projects: [
      { id: "intake-p1", projectName: "Tailwind Traders — shared-services triage", projectOwner: "Luis David Preciado" },
    ],
    assets: [
      {
        id: "intake-video",
        name: "Triage walkthrough",
        assetType: "Video walkthrough only",
        allowsEmbedding: true,
        sortOrder: 1,
      },
      {
        id: "intake-onepager",
        name: "Triage one-pager",
        assetType: "Client-ready one-pager / slide",
        allowsEmbedding: false,
        sortOrder: 2,
      },
    ],
  },
  {
    id: "field-ops-companion",
    name: "Field Ops Companion",
    summary: "The offline-first job sheet that engineers actually fill in, on the van's worst signal day.",
    whatItDoes:
      "Job list, asset history, parts, photos and sign-off in one screen that works with no connection and reconciles when it finds one. Voice capture writes the visit note while the engineer's hands are busy.",
    businessValue:
      "Paperwork that used to land three days late lands before the engineer leaves site, which is the only way the invoice goes out on time.",
    useCase: "Capture field job data offline, before the engineer leaves site",
    specializationArea: "ibo",
    contributors: [
      { id: "field-jc", builtBy: BUILDERS[1], startDate: "2026-08-31", endDate: "2026-09-01", allocation: 25, calendarId: DEFAULT_BUSINESS_CALENDAR_ID },
    ],
    status: "Idea / concept",
    publicationStatus: "Published",
    safetyAcknowledged: false,
    clientSafeReviewed: false,
    clientContext: "Concept for an upcoming utilities pursuit",
    dateAdded: "2026-09-01",
    libraryNotes: "Concept only — no working build yet. Do not show to clients.",
    searchKeywords: "field service offline mobile engineer job sheet PWA utilities voice capture",
    capabilities: ["Workflow & approvals"],
    technologies: ["React", "PWA", "Dataverse"],
    industries: ["Utilities", "Manufacturing"],
    assets: [
      {
        id: "field-onepager",
        name: "Concept one-pager",
        assetType: "Client-ready one-pager / slide",
        allowsEmbedding: false,
        sortOrder: 1,
      },
    ],
  },
];

export const SOLUTIONS: Solution[] = catalogue.map((solution) => ({
  ...solution,
  contributors: solution.contributors.map((contributor) => usesDirectHours(solution.status) ? {
    ...contributor,
    effortMode: "direct",
    directHours: calculateEffort(contributor, BUSINESS_CALENDARS.find((calendar) => calendar.id === contributor.calendarId)).hours,
    startDate: "", endDate: "", allocation: 0,
  } : { ...contributor, effortMode: "calendar" }),
}));
