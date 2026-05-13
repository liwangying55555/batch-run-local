const state = {
  projects: [],
  currentProjectId: undefined,
  draggedProjectId: undefined,
  suppressProjectClick: false,
};

const projectList = document.querySelector("#projectList");
const scriptList = document.querySelector("#scriptList");
const statusBox = document.querySelector("#status");
const currentProjectTitle = document.querySelector("#currentProjectTitle");
const projectForm = document.querySelector("#projectForm");
const projectCount = document.querySelector("#projectCount");
const refreshProjects = document.querySelector("#refreshProjects");
const openProjectRoot = document.querySelector("#openProjectRoot");
const openProjectConfig = document.querySelector("#openProjectConfig");
const closeProjectConfig = document.querySelector("#closeProjectConfig");
const projectConfigModal = document.querySelector("#projectConfigModal");
const projectNameInput = document.querySelector("#projectName");

openProjectConfig.addEventListener("click", () => {
  projectConfigModal.hidden = false;
  projectNameInput.focus();
});

closeProjectConfig.addEventListener("click", closeConfigModal);

projectConfigModal.addEventListener("click", (event) => {
  if (event.target === projectConfigModal) {
    closeConfigModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !projectConfigModal.hidden) {
    closeConfigModal();
  }
});

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
  closeConfigModal();
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
  projectCount.textContent = `共 ${state.projects.length} 个项目`;

  if (state.projects.length === 0) {
    projectList.innerHTML = `<div class="empty">暂无项目，请点击“项目配置”进行配置。</div>`;
    currentProjectTitle.textContent = "请选择项目";
    openProjectRoot.disabled = true;
    scriptList.textContent = "选择左侧项目后读取 scripts";
    return;
  }

  projectList.innerHTML = "";

  for (const project of state.projects) {
    const card = document.createElement("article");
    card.className = `project-card ${project.id === state.currentProjectId ? "active" : ""}`;
    card.draggable = true;
    card.dataset.projectId = project.id;
    card.innerHTML = `
      <div class="project-card-main">
        <h3>${escapeHtml(project.name)}</h3>
        <div class="path">${escapeHtml(project.root)}</div>
      </div>
      <button class="danger project-delete" type="button" aria-label="删除 ${escapeHtml(project.name)}">删除</button>
    `;

    card.addEventListener("click", () => {
      if (state.suppressProjectClick) {
        return;
      }
      selectProject(project.id);
    });
    card.addEventListener("dragstart", (event) => {
      state.draggedProjectId = project.id;
      state.suppressProjectClick = true;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", project.id);
      card.classList.add("dragging");
    });
    card.addEventListener("dragover", (event) => {
      if (!state.draggedProjectId || state.draggedProjectId === project.id) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      card.classList.toggle("drop-after", shouldDropAfter(event, card));
    });
    card.addEventListener("dragleave", () => {
      card.classList.remove("drop-after");
    });
    card.addEventListener("drop", (event) => {
      if (!state.draggedProjectId) {
        return;
      }

      event.preventDefault();
      card.classList.remove("drop-after");
      moveProject(state.draggedProjectId, project.id, shouldDropAfter(event, card)).catch((error) => {
        setStatus(error.message);
      });
    });
    card.addEventListener("dragend", () => {
      state.draggedProjectId = undefined;
      card.classList.remove("dragging", "drop-after");
      setTimeout(() => {
        state.suppressProjectClick = false;
      }, 0);
    });
    card.querySelector(".project-delete").addEventListener("click", (event) => {
      event.stopPropagation();
      deleteProject(project);
    });
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

async function moveProject(draggedProjectId, targetProjectId, insertAfterTarget) {
  if (draggedProjectId === targetProjectId) {
    return;
  }

  const nextProjects = [...state.projects];
  const draggedIndex = nextProjects.findIndex((project) => project.id === draggedProjectId);
  if (draggedIndex < 0) {
    return;
  }

  const [draggedProject] = nextProjects.splice(draggedIndex, 1);
  const targetIndex = nextProjects.findIndex((project) => project.id === targetProjectId);
  if (targetIndex < 0) {
    return;
  }

  nextProjects.splice(targetIndex + (insertAfterTarget ? 1 : 0), 0, draggedProject);
  state.projects = nextProjects;
  renderProjects();

  try {
    const data = await request("/api/projects/order", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectIds: state.projects.map((project) => project.id),
      }),
    });
    state.projects = data.projects;
    renderProjects();
    setStatus("项目排序已保存。");
  } catch (error) {
    await loadProjects();
    throw error;
  }
}

function shouldDropAfter(event, element) {
  const rect = element.getBoundingClientRect();
  return event.clientY > rect.top + rect.height / 2;
}

function closeConfigModal() {
  projectConfigModal.hidden = true;
}

async function deleteProject(project) {
  const confirmed = window.confirm(`确定要删除项目“${project.name}”吗？\n\n${project.root}`);
  if (!confirmed) {
    return;
  }

  await request(`/api/projects/${project.id}`, {
    method: "DELETE",
  });

  if (state.currentProjectId === project.id) {
    state.currentProjectId = undefined;
    currentProjectTitle.textContent = "请选择项目";
    openProjectRoot.disabled = true;
    scriptList.textContent = "选择左侧项目后读取 scripts";
  }

  setStatus(`已删除项目：${project.name}`);
  await loadProjects();
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
