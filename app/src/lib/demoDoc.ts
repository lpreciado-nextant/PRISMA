import type { Solution } from "../types";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

/**
 * Stands in for the self-contained HTML payload that would come out of the
 * Dataverse File column. It is rendered in a sandbox with no same-origin
 * access, which is exactly how a real uploaded asset must be treated.
 */
export function demoSrcDoc(solution: Solution, accent: string): string {
  const name = esc(solution.name);
  const rows = [
    ["Open items", "128", "+12 this week"],
    ["Cycle time", "4.2 days", "−1.8 vs baseline"],
    ["Exceptions", "9", "3 need a decision"],
    ["Coverage", "94%", "target 90%"],
  ];

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;font:15px/1.5 "Segoe UI",system-ui,sans-serif;
       color:#e9eff4;background:radial-gradient(90% 70% at 20% 0%, ${accent}33, transparent 60%), #070b10;padding:28px}
  h1{margin:0;font-size:22px;letter-spacing:-.02em}
  .tag{display:inline-block;margin-top:6px;padding:3px 10px;border-radius:99px;font-size:11px;letter-spacing:.12em;
       text-transform:uppercase;color:${accent};border:1px solid ${accent}55;background:${accent}18}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-top:22px}
  .card{padding:16px;border-radius:14px;border:1px solid #ffffff1c;background:#ffffff0c;backdrop-filter:blur(8px)}
  .k{font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:#93a3ae}
  .v{font-size:26px;font-weight:700;margin-top:4px;letter-spacing:-.02em}
  .d{font-size:12px;color:#93a3ae;margin-top:2px}
  .bars{display:flex;align-items:flex-end;gap:8px;height:110px;margin-top:22px;padding:16px;border-radius:14px;
        border:1px solid #ffffff1c;background:#ffffff0c}
  .bars i{flex:1;align-self:flex-end;border-radius:6px 6px 2px 2px;background:linear-gradient(to top, ${accent}, ${accent}55);display:block}
  footer{margin-top:22px;font-size:12px;color:#7a8893}
</style></head>
<body>
  <h1>${name}</h1>
  <span class="tag">Sandboxed demo payload</span>
  <div class="grid">
    ${rows
      .map(
        ([k, v, d]) =>
          `<div class="card"><div class="k">${k}</div><div class="v">${v}</div><div class="d">${d}</div></div>`,
      )
      .join("")}
  </div>
  <div class="bars">
    ${[38, 62, 45, 78, 56, 91, 70, 84]
      .map((h) => `<i style="height:${h}%"></i>`)
      .join("")}
  </div>
  <footer>This frame has no same-origin access to the library. allow-scripts only.</footer>
</body></html>`;
}
