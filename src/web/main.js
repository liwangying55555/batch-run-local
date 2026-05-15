const state = {
  projects: [],
  branches: [],
  currentProjectId: undefined,
  draggedProjectId: undefined,
  suppressProjectClick: false,
  editingProjectId: undefined,
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
const projectRootInput = document.querySelector("#projectRoot");
const projectConfigTitle = document.querySelector("#projectConfigTitle");
const projectSubmit = document.querySelector("#projectSubmit");
const branchPanel = document.querySelector("#branchPanel");
const branchSelect = document.querySelector("#branchSelect");

openProjectConfig.addEventListener("click", openCreateProjectModal);

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
  const editingProjectId = state.editingProjectId;

  await request(editingProjectId ? `/api/projects/${editingProjectId}` : "/api/projects", {
    method: editingProjectId ? "PUT" : "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, root }),
  });

  projectForm.reset();
  closeConfigModal();
  setStatus(editingProjectId ? `已更新项目：${name}` : `已新增项目：${name}`);
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

branchSelect.addEventListener("change", async () => {
  if (!state.currentProjectId || !branchSelect.value) {
    return;
  }

  const branch = branchSelect.value;
  branchSelect.disabled = true;
  scriptList.textContent = `正在切换到 ${branch}...`;

  try {
    const data = await request(`/api/projects/${state.currentProjectId}/branches/switch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ branch }),
    });
    renderBranches(data);
    renderScripts(state.currentProjectId, data.scripts);
    setStatus(`已切换到分支：${data.current ?? branch}`);
  } finally {
    branchSelect.disabled = false;
  }
});

async function loadProjects() {
  const data = await request("/api/projects");
  state.projects = data.projects;
  if (!state.projects.some((project) => project.id === state.currentProjectId)) {
    state.currentProjectId = undefined;
    state.branches = [];
    currentProjectTitle.textContent = "请选择项目";
    openProjectRoot.disabled = true;
    hideBranchPanel();
  }
  renderProjects();
}

function renderProjects() {
  projectCount.textContent = `共 ${state.projects.length} 个项目`;

  if (state.projects.length === 0) {
    projectList.innerHTML = `<div class="empty">暂无项目，请点击“项目配置”进行配置。</div>`;
    currentProjectTitle.textContent = "请选择项目";
    openProjectRoot.disabled = true;
    hideBranchPanel();
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
      <div class="project-actions">
        <button class="project-edit" type="button" aria-label="编辑 ${escapeHtml(project.name)}">编辑</button>
        <button class="danger project-delete" type="button" aria-label="删除 ${escapeHtml(project.name)}">删除</button>
      </div>
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
    card.querySelector(".project-edit").addEventListener("click", (event) => {
      event.stopPropagation();
      openEditProjectModal(project);
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
  branchPanel.hidden = false;
  branchSelect.innerHTML = `<option value="">读取中...</option>`;
  branchSelect.disabled = true;

  const [scriptData, branchData] = await Promise.all([
    request(`/api/projects/${projectId}/scripts`),
    request(`/api/projects/${projectId}/branches`).catch((error) => ({
      current: undefined,
      branches: [],
      message: error.message,
    })),
  ]);
  renderBranches(branchData);
  renderScripts(projectId, scriptData.scripts);
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
      <button type="button" class="secondary">执行</button>
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

function renderBranches(data) {
  state.branches = data.branches ?? [];

  if (data.message) {
    branchSelect.innerHTML = `<option value="">${escapeHtml(data.message)}</option>`;
    branchSelect.disabled = true;
    return;
  }

  branchPanel.hidden = false;

  if (state.branches.length === 0) {
    branchSelect.innerHTML = `<option value="">未读取到分支</option>`;
    branchSelect.disabled = true;
    return;
  }

  branchSelect.innerHTML = state.branches
    .map((branch) => {
      const selected = branch.current ? " selected" : "";
      return `<option value="${escapeHtml(branch.name)}"${selected}>${escapeHtml(branch.name)}</option>`;
    })
    .join("");
  branchSelect.disabled = false;
}

function hideBranchPanel() {
  branchPanel.hidden = true;
  branchSelect.innerHTML = "";
  branchSelect.disabled = true;
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

function openCreateProjectModal() {
  state.editingProjectId = undefined;
  projectForm.reset();
  projectConfigTitle.textContent = "项目配置";
  projectSubmit.textContent = "新增项目";
  projectConfigModal.hidden = false;
  projectNameInput.focus();
}

function openEditProjectModal(project) {
  state.editingProjectId = project.id;
  projectConfigTitle.textContent = "编辑项目";
  projectSubmit.textContent = "保存修改";
  projectNameInput.value = project.name;
  projectRootInput.value = project.root;
  projectConfigModal.hidden = false;
  projectNameInput.focus();
}

function closeConfigModal() {
  projectConfigModal.hidden = true;
  state.editingProjectId = undefined;
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
    state.branches = [];
    currentProjectTitle.textContent = "请选择项目";
    openProjectRoot.disabled = true;
    hideBranchPanel();
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
