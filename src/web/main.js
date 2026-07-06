const UNGROUPED_TAG = "";
const UNGROUPED_TAG_LABEL = "未分组";

const state = {
  projects: [],
  tagOrder: [],
  branches: [],
  currentProjectId: undefined,
  draggedProjectId: undefined,
  draggedTagKey: undefined,
  suppressProjectClick: false,
  editingProjectId: undefined,
  tagExpandState: new Map(),
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
const projectTagInput = document.querySelector("#projectTag");
const tagOptions = document.querySelector("#tagOptions");
const projectConfigTitle = document.querySelector("#projectConfigTitle");
const projectSubmit = document.querySelector("#projectSubmit");
const branchPanel = document.querySelector("#branchPanel");
const branchSelect = document.querySelector("#branchSelect");

openProjectConfig.addEventListener("click", () => {
  openCreateProjectModal().catch((error) => setStatus(error.message));
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
  const tag = String(formData.get("tag") ?? "");
  const editingProjectId = state.editingProjectId;

  await request(editingProjectId ? `/api/projects/${editingProjectId}` : "/api/projects", {
    method: editingProjectId ? "PUT" : "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, root, tag }),
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
  state.tagOrder = data.tagOrder ?? deriveTagOrder(state.projects);
  if (!state.projects.some((project) => project.id === state.currentProjectId)) {
    state.currentProjectId = undefined;
    state.branches = [];
    currentProjectTitle.textContent = "请选择项目";
    openProjectRoot.disabled = true;
    hideBranchPanel();
  }
  renderProjects();
}

async function loadTagOptions() {
  const data = await request("/api/tags");
  tagOptions.innerHTML = data.tags
    .map((tag) => `<option value="${escapeHtml(tag)}"></option>`)
    .join("");
}

function deriveTagOrder(projects) {
  const keys = [];
  const seen = new Set();

  for (const project of projects) {
    const tagKey = getProjectTagKey(project);
    if (!seen.has(tagKey)) {
      seen.add(tagKey);
      keys.push(tagKey);
    }
  }

  return keys;
}

function getProjectTagKey(project) {
  return project.tag ?? UNGROUPED_TAG;
}

function getTagLabel(tagKey) {
  return tagKey === UNGROUPED_TAG ? UNGROUPED_TAG_LABEL : tagKey;
}

function getProjectsByTag(tagKey) {
  return state.projects.filter((project) => getProjectTagKey(project) === tagKey);
}

function isTagExpanded(tagKey) {
  if (state.tagExpandState.has(tagKey)) {
    return state.tagExpandState.get(tagKey);
  }

  return tagKey === UNGROUPED_TAG;
}

function toggleTagExpand(tagKey) {
  state.tagExpandState.set(tagKey, !isTagExpanded(tagKey));
  renderProjects();
}

function renderProjects() {
  const tagOrder = state.tagOrder.length > 0 ? state.tagOrder : deriveTagOrder(state.projects);
  projectCount.textContent = `共 ${state.projects.length} 个项目`;

  if (state.projects.length === 0) {
    projectList.innerHTML = `<div class="empty">暂无项目，请点击“新增项目”进行配置。</div>`;
    currentProjectTitle.textContent = "请选择项目";
    openProjectRoot.disabled = true;
    hideBranchPanel();
    scriptList.textContent = "选择左侧项目后读取 scripts";
    return;
  }

  projectList.innerHTML = "";

  for (const tagKey of tagOrder) {
    const projects = getProjectsByTag(tagKey);
    if (projects.length === 0) {
      continue;
    }

    const expanded = isTagExpanded(tagKey);
    const group = document.createElement("section");
    group.className = `tag-group${expanded ? "" : " collapsed"}`;
    group.dataset.tagKey = tagKey;

    const header = document.createElement("div");
    header.className = "tag-header tag-toggle";
    header.dataset.tagKey = tagKey;
    header.innerHTML = `
      <span class="expanded-icon ${expanded ? "expanded" : "collapsed"}"></span>
      <span class="tag-title" draggable="true">${escapeHtml(getTagLabel(tagKey))}</span>
      <span class="tag-count">${projects.length}</span>
    `;
    header.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleTagExpand(tagKey);
    });
    bindTagHeaderDrag(header, tagKey);

    const projectsContainer = document.createElement("div");
    projectsContainer.className = "tag-projects";
    projectsContainer.dataset.tagKey = tagKey;
    projectsContainer.hidden = !expanded;
    bindTagProjectsDropZone(projectsContainer, tagKey);

    for (const project of projects) {
      projectsContainer.append(createProjectCard(project, tagKey));
    }

    group.append(header, projectsContainer);
    projectList.append(group);
  }
}

function createProjectCard(project, tagKey) {
  const card = document.createElement("article");
  card.className = `project-card ${project.id === state.currentProjectId ? "active" : ""}`;
  card.draggable = true;
  card.dataset.projectId = project.id;
  card.dataset.tagKey = tagKey;
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
    state.draggedTagKey = undefined;
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
    event.stopPropagation();
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
    event.stopPropagation();
    card.classList.remove("drop-after");
    moveProject(
      state.draggedProjectId,
      project.id,
      shouldDropAfter(event, card),
      getProjectTagKey(project),
    ).catch((error) => {
      setStatus(error.message);
    });
  });
  card.addEventListener("dragend", () => {
    state.draggedProjectId = undefined;
    card.classList.remove("dragging", "drop-after");
    clearTagDropIndicators();
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
    openEditProjectModal(project).catch((error) => setStatus(error.message));
  });

  return card;
}

function bindTagHeaderDrag(header, tagKey) {
  const dragHandle = header.querySelector(".tag-title");

  dragHandle.addEventListener("dragstart", (event) => {
    state.draggedTagKey = tagKey;
    state.draggedProjectId = undefined;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-tag-key", tagKey);
    header.classList.add("dragging");
  });
  header.addEventListener("dragover", (event) => {
    if (state.draggedProjectId) {
      const draggedProject = state.projects.find((project) => project.id === state.draggedProjectId);
      if (draggedProject && getProjectTagKey(draggedProject) !== tagKey) {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "move";
        header.classList.add("collapsed-drop-target");
      }
      return;
    }

    if (state.draggedTagKey === undefined || state.draggedTagKey === tagKey) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    header.classList.toggle("drop-after", shouldDropAfter(event, header));
  });
  header.addEventListener("dragleave", (event) => {
    if (event.currentTarget.contains(event.relatedTarget)) {
      return;
    }
    header.classList.remove("drop-after", "collapsed-drop-target");
  });
  header.addEventListener("drop", (event) => {
    if (state.draggedProjectId) {
      const draggedProject = state.projects.find((project) => project.id === state.draggedProjectId);
      if (!draggedProject || getProjectTagKey(draggedProject) === tagKey) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      header.classList.remove("collapsed-drop-target");
      state.tagExpandState.set(tagKey, true);
      moveProjectToTagEnd(state.draggedProjectId, tagKey).catch((error) => {
        setStatus(error.message);
      });
      return;
    }

    if (state.draggedTagKey === undefined || state.draggedTagKey === tagKey) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    header.classList.remove("drop-after");
    moveTagGroup(state.draggedTagKey, tagKey, shouldDropAfter(event, header)).catch((error) => {
      setStatus(error.message);
    });
  });
  dragHandle.addEventListener("dragend", () => {
    state.draggedTagKey = undefined;
    header.classList.remove("dragging", "drop-after", "collapsed-drop-target");
    clearTagDropIndicators();
  });
}

function bindTagProjectsDropZone(container, tagKey) {
  container.addEventListener("dragover", (event) => {
    if (!state.draggedProjectId) {
      return;
    }

    const draggedProject = state.projects.find((project) => project.id === state.draggedProjectId);
    if (!draggedProject || getProjectTagKey(draggedProject) === tagKey) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    container.classList.add("drag-over");
  });
  container.addEventListener("dragleave", (event) => {
    if (event.currentTarget.contains(event.relatedTarget)) {
      return;
    }
    container.classList.remove("drag-over");
  });
  container.addEventListener("drop", (event) => {
    if (!state.draggedProjectId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    container.classList.remove("drag-over");
    moveProjectToTagEnd(state.draggedProjectId, tagKey).catch((error) => {
      setStatus(error.message);
    });
  });
}

function clearTagDropIndicators() {
  for (const element of projectList.querySelectorAll(
    ".tag-header.drop-after, .tag-header.collapsed-drop-target, .tag-projects.drag-over",
  )) {
    element.classList.remove("drop-after", "collapsed-drop-target", "drag-over");
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

async function moveProject(draggedProjectId, targetProjectId, insertAfterTarget, targetTagKey) {
  if (draggedProjectId === targetProjectId) {
    return;
  }

  const draggedProject = state.projects.find((project) => project.id === draggedProjectId);
  if (!draggedProject) {
    return;
  }

  const normalizedTag = targetTagKey === UNGROUPED_TAG ? undefined : targetTagKey;
  const tagChanged = getProjectTagKey(draggedProject) !== targetTagKey;

  if (tagChanged) {
    await request(`/api/projects/${draggedProjectId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: draggedProject.name,
        root: draggedProject.root,
        tag: normalizedTag,
      }),
    });
    draggedProject.tag = normalizedTag;
  }

  const nextProjects = [...state.projects];
  const draggedIndex = nextProjects.findIndex((project) => project.id === draggedProjectId);
  if (draggedIndex < 0) {
    return;
  }

  const [movingProject] = nextProjects.splice(draggedIndex, 1);
  const updatedProject = { ...movingProject, tag: normalizedTag };
  const targetIndex = nextProjects.findIndex((project) => project.id === targetProjectId);
  if (targetIndex < 0) {
    return;
  }

  nextProjects.splice(targetIndex + (insertAfterTarget ? 1 : 0), 0, updatedProject);
  await persistProjectOrder(nextProjects, tagChanged ? "项目已移动到新标签。" : "项目排序已保存。");
}

async function moveProjectToTagEnd(draggedProjectId, targetTagKey) {
  const draggedProject = state.projects.find((project) => project.id === draggedProjectId);
  if (!draggedProject) {
    return;
  }

  const normalizedTag = targetTagKey === UNGROUPED_TAG ? undefined : targetTagKey;
  const tagChanged = getProjectTagKey(draggedProject) !== targetTagKey;

  if (tagChanged) {
    await request(`/api/projects/${draggedProjectId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: draggedProject.name,
        root: draggedProject.root,
        tag: normalizedTag,
      }),
    });
    draggedProject.tag = normalizedTag;
  }

  const nextProjects = state.projects.filter((project) => project.id !== draggedProjectId);
  const updatedProject = { ...draggedProject, tag: normalizedTag };
  const projectsInTargetTag = nextProjects.filter((project) => getProjectTagKey(project) === targetTagKey);
  const lastProject = projectsInTargetTag[projectsInTargetTag.length - 1];

  if (lastProject) {
    const lastIndex = nextProjects.findIndex((project) => project.id === lastProject.id);
    nextProjects.splice(lastIndex + 1, 0, updatedProject);
  } else {
    const tagOrder = state.tagOrder.length > 0 ? state.tagOrder : deriveTagOrder(state.projects);
    const targetTagIndex = tagOrder.indexOf(targetTagKey);
    if (targetTagIndex < 0) {
      nextProjects.push(updatedProject);
    } else {
      let insertIndex = nextProjects.length;
      for (let index = targetTagIndex + 1; index < tagOrder.length; index += 1) {
        const nextTagProjectIndex = nextProjects.findIndex(
          (project) => getProjectTagKey(project) === tagOrder[index],
        );
        if (nextTagProjectIndex >= 0) {
          insertIndex = nextTagProjectIndex;
          break;
        }
      }
      nextProjects.splice(insertIndex, 0, updatedProject);
    }
  }

  await persistProjectOrder(nextProjects, "项目已移动到新标签。");
}

async function moveTagGroup(draggedTagKey, targetTagKey, insertAfterTarget) {
  if (draggedTagKey === targetTagKey) {
    return;
  }

  const nextTagOrder = [...(state.tagOrder.length > 0 ? state.tagOrder : deriveTagOrder(state.projects))];
  const draggedIndex = nextTagOrder.indexOf(draggedTagKey);
  if (draggedIndex < 0) {
    return;
  }

  nextTagOrder.splice(draggedIndex, 1);
  const targetIndex = nextTagOrder.indexOf(targetTagKey);
  if (targetIndex < 0) {
    return;
  }

  nextTagOrder.splice(targetIndex + (insertAfterTarget ? 1 : 0), 0, draggedTagKey);
  state.tagOrder = nextTagOrder;
  renderProjects();

  try {
    const data = await request("/api/tag-order", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tagKeys: nextTagOrder }),
    });
    state.projects = data.projects;
    state.tagOrder = data.tagOrder ?? nextTagOrder;
    renderProjects();
    setStatus("标签排序已保存。");
  } catch (error) {
    await loadProjects();
    throw error;
  }
}

async function persistProjectOrder(nextProjects, successMessage) {
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
    state.tagOrder = data.tagOrder ?? deriveTagOrder(state.projects);
    renderProjects();
    setStatus(successMessage);
  } catch (error) {
    await loadProjects();
    throw error;
  }
}

function shouldDropAfter(event, element) {
  const rect = element.getBoundingClientRect();
  return event.clientY > rect.top + rect.height / 2;
}

async function openCreateProjectModal() {
  state.editingProjectId = undefined;
  projectForm.reset();
  projectConfigTitle.textContent = "项目配置";
  projectSubmit.textContent = "新增项目";
  await loadTagOptions();
  projectConfigModal.hidden = false;
  projectNameInput.focus();
}

async function openEditProjectModal(project) {
  state.editingProjectId = project.id;
  projectConfigTitle.textContent = "编辑项目";
  projectSubmit.textContent = "保存修改";
  await loadTagOptions();
  projectNameInput.value = project.name;
  projectRootInput.value = project.root;
  projectTagInput.value = project.tag ?? "";
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
