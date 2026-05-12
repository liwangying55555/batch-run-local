const state = {
  projects: [],
  currentProjectId: undefined,
};

const projectList = document.querySelector("#projectList");
const scriptList = document.querySelector("#scriptList");
const statusBox = document.querySelector("#status");
const currentProjectTitle = document.querySelector("#currentProjectTitle");
const projectForm = document.querySelector("#projectForm");
const refreshProjects = document.querySelector("#refreshProjects");
const openProjectRoot = document.querySelector("#openProjectRoot");

projectForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(projectForm);
  const name = String(formData.get("name") ?? "");
  const root = String(formData.get("root") ?? "");

  await request("/api/projects", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, root }),
  });

  projectForm.reset();
  setStatus(`已新增项目：${name}`);
  await loadProjects();
});

refreshProjects.addEventListener("click", loadProjects);

openProjectRoot.addEventListener("click", async () => {
  if (!state.currentProjectId) {
    return;
  }

  await request(`/api/projects/${state.currentProjectId}/open`, {
    method: "POST",
  });
  setStatus("已打开项目目录。");
});

async function loadProjects() {
  const data = await request("/api/projects");
  state.projects = data.projects;
  if (!state.projects.some((project) => project.id === state.currentProjectId)) {
    state.currentProjectId = undefined;
    currentProjectTitle.textContent = "请选择项目";
    openProjectRoot.disabled = true;
  }
  renderProjects();
}

function renderProjects() {
  if (state.projects.length === 0) {
    projectList.innerHTML = `<div class="empty">暂无项目，请先新增。</div>`;
    currentProjectTitle.textContent = "请选择项目";
    openProjectRoot.disabled = true;
    scriptList.textContent = "选择左侧项目后读取 scripts";
    return;
  }

  projectList.innerHTML = "";

  for (const project of state.projects) {
    const card = document.createElement("article");
    card.className = `project-card ${project.id === state.currentProjectId ? "active" : ""}`;
    card.innerHTML = `
      <h3>${escapeHtml(project.name)}</h3>
      <div class="path">${escapeHtml(project.root)}</div>
    `;

    card.addEventListener("click", () => selectProject(project.id));
    projectList.append(card);
  }
}

async function selectProject(projectId) {
  state.currentProjectId = projectId;
  renderProjects();

  const project = state.projects.find((item) => item.id === projectId);
  currentProjectTitle.textContent = project?.name ?? "请选择项目";
  openProjectRoot.disabled = !project;
  scriptList.textContent = "正在读取 scripts...";

  const data = await request(`/api/projects/${projectId}/scripts`);
  renderScripts(projectId, data.scripts);
}

function renderScripts(projectId, scripts) {
  const entries = Object.entries(scripts);

  if (entries.length === 0) {
    scriptList.innerHTML = `<div class="empty">该项目 package.json 中没有 scripts。</div>`;
    return;
  }

  scriptList.innerHTML = "";

  for (const [name, command] of entries) {
    const card = document.createElement("article");
    card.className = "script-card";
    card.innerHTML = `
      <div>
        <h3>${escapeHtml(name)}</h3>
        <div class="command">${escapeHtml(command)}</div>
      </div>
      <button type="button">执行</button>
    `;

    card.querySelector("button").addEventListener("click", () => runScript(projectId, name));
    scriptList.append(card);
  }
}

async function runScript(projectId, script) {
  const data = await request(`/api/projects/${projectId}/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ script }),
  });

  setStatus(`已打开 Git Bash 执行：npm run ${script}${data.pid ? `\nPID: ${data.pid}` : ""}`);
}

async function request(url, options) {
  const response = await fetch(url, options);
  const contentType = response.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json") ? await response.json() : {};

  if (!response.ok) {
    const message = data.message ?? `请求失败：${response.status}`;
    setStatus(message);
    throw new Error(message);
  }

  return data;
}

function setStatus(message) {
  statusBox.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

loadProjects().catch((error) => setStatus(error.message));
