export interface TechnologyNameCheck {
  typed: string;
  suggested: string;
  /** Existing label this input duplicates; adding selects it instead of creating a new technology. */
  existing?: string;
  error?: string;
  similar: string[];
}

const KNOWN_WORDS = new Map([
  "AI", "API", "APIs", "AD", "ADF", "ADLS", "AKS", "AWS", "BI", "CI", "CD", "CLI", "CRM", "CSS", "CSV", "DAX", "DB", "DNS", "EC2", "ECS", "EKS",
  "ERP", "ETL", "GCP", "GPT", "GPU", "HTML", "HTTP", "IaC", "IIS", "IoT", "JSON", "JWT", "KQL", "LDAP", "LLM", "LLMs", "ML", "MCP", "NLP",
  "OCR", "PDF", "RAG", "RDS", "REST", "RPA", "SaaS", "SAML", "SAP", "SDK", "SNS", "SQL", "SQS", "SSO", "UI", "UX", "VM", "VPN", "XML", "YAML",
  "ABAP", "COBOL", "HANA", "IBM", "MAUI", "MATLAB", "PHP", "SAS", "SPSS", "SSAS", "SSIS", "SSRS", "WPF",
  ".NET", "ASP.NET", "VB.NET", "AngularJS", "BigQuery", "ChatGPT", "CloudFormation", "CouchDB", "DevOps", "DynamoDB", "FastAPI", "GitHub",
  "GitLab", "GraphQL", "HubSpot", "JavaScript", "jQuery", "LangChain", "LangGraph", "LinkedIn", "LlamaIndex", "MariaDB", "MLOps", "MongoDB",
  "MySQL", "NestJS", "NetSuite", "NoSQL", "NumPy", "OAuth", "OneDrive", "OneNote", "OpenAI", "OpenAPI", "OpenSearch", "PostgreSQL",
  "PowerPoint", "PowerShell", "PySpark", "PyTorch", "QuickBooks", "RabbitMQ", "RStudio", "SageMaker", "SciPy", "ServiceNow", "SharePoint",
  "SignalR", "SonarQube", "SQLite", "TensorFlow", "TypeScript", "UiPath", "VMware", "WinForms", "WordPress", "YouTube",
  "dbt", "gRPC", "iOS", "iPadOS", "iPhone", "macOS", "npm", "pandas", "pnpm", "scikit-learn", "webpack",
].map(word => [word.toLowerCase(), word]));

const SMALL_WORDS = new Set(["a", "an", "and", "as", "at", "by", "for", "from", "in", "into", "of", "on", "or", "the", "to", "via", "with"]);

// Alternative names that resolve to a canonical technology when that technology is listed (keys as produced by technologyKey).
const ALIASES = new Map(Object.entries({
  ado: ["azuredevops", "vsts"], fabric: ["microsoftfabric"], microsoftfoundry: ["azureaifoundry", "aifoundry", "azurefoundry"],
  microsoftteams: ["teams", "msteams"], dynamics365: ["d365", "dynamics", "microsoftdynamics", "microsoftdynamics365"],
  postgresql: ["postgres"], nodejs: ["node"], net: ["dotnet"], typescript: ["ts"], javascript: ["js"], microsoftgraph: ["msgraph", "graphapi"],
  azureopenai: ["aoai"], azureaisearch: ["cognitivesearch", "azurecognitivesearch"], azuredatafactory: ["adf"], azurelogicapps: ["logicapps"],
  sqlserver: ["mssql", "microsoftsqlserver"], kubernetes: ["k8s"], powerautomate: ["microsoftflow", "msflow"],
  copilotstudio: ["powervirtualagents", "pva"], dataverse: ["commondataservice"], aws: ["amazonwebservices"], go: ["golang"],
  sharepoint: ["sharepointonline", "spo"], powerbi: ["microsoftpowerbi"], powerapps: ["microsoftpowerapps"],
}).flatMap(([canonical, aliases]) => aliases.map(alias => [alias, canonical])));

const PLACEHOLDERS = new Set(["na", "none", "nothing", "other", "others", "misc", "miscellaneous", "tbd", "tbc", "todo", "test", "unknown", "various", "etc", "null", "undefined"]);

const fold = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
/** Comparison key: ignores case, accents, spacing and punctuation, but keeps # and + (C, C#, C++ stay distinct). */
export const technologyKey = (value: string) => fold(value).replace(/[^\p{L}\p{N}#+]/gu, "");
const technologyWords = (value: string) => ` ${fold(value).split(/[^\p{L}\p{N}#+]+/u).filter(Boolean).join(" ")} `;

const letters = (value: string) => value.replace(/[^\p{L}]/gu, "");
const capitalize = (value: string) => /^\p{Ll}/u.test(value) ? value[0].toUpperCase() + value.slice(1) : value;

function learnedWords(labels: readonly string[]) {
  const words = new Map<string, string>();
  for (const word of labels.flatMap(label => label.split(/\s+/))) {
    const text = letters(word);
    if (text !== text.toLowerCase() && (text !== text.toUpperCase() || text.length <= 5) && !words.has(word.toLowerCase())) words.set(word.toLowerCase(), word);
  }
  return words;
}

function capitalizeWord(word: string, first: boolean, learned: Map<string, string>) {
  const lower = word.toLowerCase();
  const known = KNOWN_WORDS.get(lower);
  if (known) return known;
  if (!first && SMALL_WORDS.has(lower)) return lower;
  const learnedWord = learned.get(lower);
  if (learnedWord) return learnedWord;
  return word.split(/([-/])/).map((part, position) => {
    if (part === "-" || part === "/") return part;
    const match = KNOWN_WORDS.get(part.toLowerCase()) ?? learned.get(part.toLowerCase());
    if (match) return match;
    const text = letters(part);
    // Mixed case (jQuery, iOS) and short all-caps acronyms (AWS) are deliberate; all-lowercase and shouted words are not.
    if (text && (text === text.toLowerCase() || (text === text.toUpperCase() && text.length > 4))) return position === 0 ? capitalize(part.toLowerCase()) : part.toLowerCase();
    return part;
  }).join("");
}

export function capitalizeTechnology(name: string, labels: readonly string[] = []) {
  const learned = learnedWords(labels);
  return name.split(" ").map((word, index) => capitalizeWord(word, index === 0, learned)).join(" ");
}

function distance(left: string, right: string) {
  const rows = Array.from({ length: left.length + 1 }, (_, row) => Array.from({ length: right.length + 1 }, (_, column) => row === 0 ? column : column === 0 ? row : 0));
  for (let row = 1; row <= left.length; row++) for (let column = 1; column <= right.length; column++) {
    rows[row][column] = Math.min(rows[row - 1][column] + 1, rows[row][column - 1] + 1, rows[row - 1][column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1));
    if (row > 1 && column > 1 && left[row - 1] === right[column - 2] && left[row - 2] === right[column - 1]) rows[row][column] = Math.min(rows[row][column], rows[row - 2][column - 2] + 1);
  }
  return rows[left.length][right.length];
}

function similarity(typed: string, label: string) {
  const [typedKey, labelKey] = [technologyKey(typed), technologyKey(label)];
  const shorter = Math.min(typedKey.length, labelKey.length);
  const extra = Math.abs(typedKey.length - labelKey.length);
  if (shorter >= 4 && extra <= 2) {
    const edits = distance(typedKey, labelKey);
    if (edits <= (shorter >= 8 ? 2 : 1)) return edits;
  }
  if ([typedKey + "s", typedKey + "es"].includes(labelKey) || [labelKey + "s", labelKey + "es"].includes(typedKey)) return 1;
  // The same words in another order ("OpenAI on Azure", "Azure OpenAI"), ignoring small words.
  const significant = (value: string) => new Set(technologyWords(value).trim().split(" ").filter(word => word && !SMALL_WORDS.has(word)));
  const [typedSet, labelSet] = [significant(typed), significant(label)];
  if (typedSet.size >= 2 && typedSet.size === labelSet.size && [...typedSet].every(word => labelSet.has(word))) return 2;
  // Short names only match whole words, so Kubernetes does not suggest .NET.
  const [typedWords, labelWords] = [technologyWords(typed), technologyWords(label)];
  if (shorter >= 2 && (typedWords.includes(labelWords) || labelWords.includes(typedWords))) return 3 + extra / 1000;
  if (shorter >= 5 && (typedKey.includes(labelKey) || labelKey.includes(typedKey))) return 3 + extra / 1000;
  return undefined;
}

export function checkTechnologyName(input: string, labels: readonly string[]): TechnologyNameCheck {
  const typed = input.normalize("NFC").replace(/\s+/g, " ").trim();
  const key = technologyKey(typed);
  const error = !typed ? "Enter a technology name."
    : /\p{Cc}/u.test(typed) ? "Remove control characters."
    : typed.length > 100 ? "Use 100 characters or fewer."
    : /[,;]/.test(typed) ? "Add one technology at a time."
    : !/\p{L}/u.test(typed) ? "Include at least one letter."
    : PLACEHOLDERS.has(key) ? "Name the specific technology."
    : undefined;
  if (error) return { typed, suggested: typed, error, similar: [] };
  const alias = ALIASES.get(key);
  const existing = labels.find(label => technologyKey(label) === key) ?? (alias ? labels.find(label => technologyKey(label) === alias) : undefined);
  if (existing) return { typed, suggested: existing, existing, similar: [] };
  const similar = [...new Set(labels)].map(label => ({ label, score: similarity(typed, label) }))
    .filter((entry): entry is { label: string; score: number } => entry.score !== undefined)
    .sort((left, right) => left.score - right.score || left.label.localeCompare(right.label))
    .slice(0, 4).map(entry => entry.label);
  return { typed, suggested: capitalizeTechnology(typed, labels), similar };
}

export interface NewTechnology {
  name: string;
  /** Existing technologies this one may duplicate, closest first: an exact variant (`existing`) leads. */
  similar: string[];
}

/**
 * Technologies on a submission that no other published solution uses yet, with the existing names they resemble, so a
 * reviewer can catch "OpenAI on Azure" next to "Azure OpenAI" before it reaches the library filters. Informational only.
 */
export function newTechnologies(selected: readonly string[], usedElsewhere: ReadonlySet<string>, labels: readonly string[]): NewTechnology[] {
  return selected.filter(name => !usedElsewhere.has(name)).map(name => {
    const others = labels.filter(label => label !== name);
    const check = checkTechnologyName(name, others);
    return { name, similar: [...new Set([...(check.existing ? [check.existing] : []), ...check.similar])] };
  });
}
