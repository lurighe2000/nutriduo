import { spawnSync } from "node:child_process";
// Uses the user's existing Git Credential Manager session; never logs credentials.
const operation = process.argv[2] || "status";
const result = spawnSync(
  "git",
  ["-c", "credential.interactive=false", "credential", "fill"],
  {
    input: "protocol=https\nhost=github.com\n\n",
    encoding: "utf8",
    timeout: 15000,
    windowsHide: true,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  },
);
const fields = Object.fromEntries(
  (result.stdout || "")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [
      l.slice(0, l.indexOf("=")),
      l.slice(l.indexOf("=") + 1).trim(),
    ]),
);
if (!fields.password)
  throw new Error("GitHub no está autenticado en Git Credential Manager.");
const headers = {
  Authorization: "Bearer " + fields.password,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "NutriDuo-deploy",
};
async function api(path, method = "GET", body) {
  const r = await fetch("https://api.github.com" + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = {};
  if (r.status !== 204) data = await r.json();
  return { status: r.status, data };
}
const user = await api("/user");
if (user.data.login !== "lurighe2000")
  throw new Error("La sesión de GitHub no corresponde a la cuenta esperada.");
const repo = "/repos/lurighe2000/nutriduo";
if (operation === "create") {
  const existing = await api(repo);
  if (existing.status === 404) {
    const created = await api("/user/repos", "POST", {
      name: "nutriduo",
      description:
        "Aplicación local-first de nutrición, entrenamiento y progreso. React, TypeScript y PWA.",
      private: false,
      auto_init: false,
    });
    if (created.status !== 201)
      throw new Error(
        "No se pudo crear el repositorio: " +
          created.status +
          " " +
          created.data.message,
      );
    console.log(JSON.stringify({ created: true, url: created.data.html_url }));
  } else if (existing.status === 200)
    console.log(
      JSON.stringify({
        created: false,
        url: existing.data.html_url,
        empty: existing.data.size === 0,
      }),
    );
  else throw new Error("No se pudo consultar GitHub: " + existing.status);
} else if (operation === "enable") {
  const current = await api(repo + "/pages");
  if (current.status === 404) {
    const r = await api(repo + "/pages", "POST", {
      build_type: "workflow",
      source: { branch: "main", path: "/" },
    });
    if (r.status !== 201)
      throw new Error(
        "No se pudo activar Pages: " + r.status + " " + r.data.message,
      );
    console.log(JSON.stringify({ pages: r.data.html_url, status: r.status }));
  } else if (current.status === 200)
    console.log(JSON.stringify({ pages: current.data.html_url, status: 200 }));
  else throw new Error("No se pudo consultar Pages: " + current.status);
} else {
  const runs = await api(repo + "/actions/runs?per_page=3");
  const pages = await api(repo + "/pages");
  console.log(
    JSON.stringify({
      pagesStatus: pages.status,
      pages: pages.data.html_url,
      build: pages.data.status,
      runs: (runs.data.workflow_runs || []).map((r) => ({
        id: r.id,
        status: r.status,
        conclusion: r.conclusion,
        url: r.html_url,
        sha: r.head_sha,
      })),
    }),
  );
  if (process.argv[3]) {
    const jobs = await api(repo + "/actions/runs/" + process.argv[3] + "/jobs");
    console.log(
      JSON.stringify({
        jobs: (jobs.data.jobs || []).map((j) => ({
          name: j.name,
          status: j.status,
          conclusion: j.conclusion,
          steps: j.steps?.map((s) => ({
            name: s.name,
            status: s.status,
            conclusion: s.conclusion,
          })),
        })),
      }),
    );
  }
}
