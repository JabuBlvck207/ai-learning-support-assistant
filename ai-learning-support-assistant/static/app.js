const state = {
  material: "",
  filename: "",
  level: "Beginner",
  task: "summary",
  activities: Number(sessionStorage.getItem("studyActivities") || 0),
  latestScore: sessionStorage.getItem("studyLatestScore") || "",
  completed: false,
  currentResult: ""
};

const $ = (id) => document.getElementById(id);
const taskNames = {
  summary: "Study summary",
  explain: "Topic explanation",
  quiz: "Practice quiz",
  revision: "Revision plan"
};
const runNames = {
  summary: "Generate my summary",
  explain: "Explain this topic",
  quiz: "Generate practice quiz",
  revision: "Create revision plan"
};

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 2800);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}

// Minimal Markdown display for model output; raw HTML is escaped first.
function renderMarkdown(text) {
  const escaped = escapeHTML(text || "");
  const lines = escaped.split(/\r?\n/);
  let html = "", listType = null;
  const closeList = () => {
    if (listType) { html += `</${listType}>`; listType = null; }
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { closeList(); continue; }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const bullet = line.match(/^[-*]\s+(.+)$/);
    const numbered = line.match(/^\d+[.)]\s+(.+)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      html += `<h${level}>${inlineFormat(heading[2])}</h${level}>`;
    } else if (bullet || numbered) {
      const type = bullet ? "ul" : "ol";
      if (listType !== type) { closeList(); html += `<${type}>`; listType = type; }
      html += `<li>${inlineFormat((bullet || numbered)[1])}</li>`;
    } else {
      closeList();
      html += `<p>${inlineFormat(line)}</p>`;
    }
  }
  closeList();
  return html;
}
function inlineFormat(text) {
  return text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");
}

function updateProgress() {
  $("activity-count").textContent = state.activities;
  $("summary-count").textContent = state.activities;
  $("quiz-score").textContent = state.latestScore === "" ? "—" : `${state.latestScore}%`;
  $("progress-bar").style.width = `${Math.min(100, state.activities * 20)}%`;
  $("progress-caption").textContent = state.activities === 0
    ? "Complete a learning activity to get started."
    : `${Math.min(100, state.activities * 20)}% session progress · keep going.`;
  sessionStorage.setItem("studyActivities", String(state.activities));
  if (state.latestScore !== "") sessionStorage.setItem("studyLatestScore", String(state.latestScore));
}

function renderTaskFields() {
  const container = $("task-fields");
  if (state.task === "summary") {
    container.innerHTML = `<div class="field"><label for="task-extra">What should the summary focus on? (optional)</label><input class="task-input" id="task-extra" placeholder="e.g. key definitions and exam concepts"></div>`;
  } else if (state.task === "explain") {
    container.innerHTML = `<div class="field"><label for="task-extra">Which topic do you want explained?</label><input class="task-input" id="task-extra" required placeholder="e.g. supervised learning"></div>`;
  } else if (state.task === "quiz") {
    container.innerHTML = `<div class="field"><label for="task-extra">Any topic to focus on? (optional)</label><input class="task-input" id="task-extra" placeholder="e.g. chapters 2 and 3"></div>`;
  } else {
    container.innerHTML = `<div class="field"><label for="task-extra">Your quiz results or topics you found difficult</label><textarea class="task-input" id="task-extra" required placeholder="e.g. Scored 3/5. I struggled with classification and model evaluation."></textarea></div>`;
  }
}

function selectTask(task) {
  state.task = task;
  state.completed = false;
  document.querySelectorAll(".tool-card").forEach((card) => {
    card.classList.toggle("selected", card.dataset.task === task);
  });
  $("run-label").textContent = runNames[task];
  renderTaskFields();
}

document.querySelectorAll(".tool-card").forEach((card) => {
  card.addEventListener("click", () => selectTask(card.dataset.task));
});
document.querySelectorAll(".level-option").forEach((button) => {
  button.addEventListener("click", () => {
    state.level = button.dataset.level;
    document.querySelectorAll(".level-option").forEach((b) => b.classList.toggle("active", b === button));
  });
});

$("upload-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const file = $("document").files[0];
  if (!file) return toast("Choose a PDF file first.");
  if (file.size > 12 * 1024 * 1024) return toast("The file must be smaller than 12 MB.");
  const button = $("upload-button");
  button.disabled = true;
  button.textContent = "Reading document…";
  $("document-status").className = "document-status muted";
  $("document-status").textContent = "Extracting text from your PDF…";
  try {
    const body = new FormData();
    body.append("document", file);
    const response = await fetch("/api/upload", { method: "POST", body });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Upload failed.");
    state.material = data.material;
    state.filename = data.filename;
    $("document-status").className = "document-status success";
    $("document-status").textContent = `${data.filename} · ${data.character_count.toLocaleString()} characters extracted`;
    $("document-preview").textContent = data.preview + (data.character_count > 1200 ? "\n…" : "");
    $("document-preview").classList.remove("hidden");
    toast("Your notes are ready to study.");
  } catch (error) {
    $("document-status").className = "document-status error";
    $("document-status").textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = "Upload notes";
  }
});

$("task-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.material) return toast("Upload a PDF first so the AI can use your notes.");
  const extra = $("task-extra") ? $("task-extra").value.trim() : "";
  if ((state.task === "explain" || state.task === "revision") && !extra) return toast("Please complete the requested field.");
  const button = $("run-button");
  button.disabled = true;
  $("run-label").textContent = "Working on it…";
  $("result-section").classList.remove("hidden");
  $("result-title").textContent = taskNames[state.task];
  $("result-content").innerHTML = "<p>Preparing your learning result. This can take a little while…</p>";
  $("completion-status").textContent = "";
  state.completed = false;
  try {
    const response = await fetch("/api/learn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ material: state.material, task: state.task, level: state.level, extra })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "The learning request failed.");
    state.currentResult = data.result;
    $("result-content").innerHTML = renderMarkdown(data.result);
    $("result-section").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    $("result-content").innerHTML = `<p class="error">${escapeHTML(error.message)}</p>`;
  } finally {
    button.disabled = false;
    $("run-label").textContent = runNames[state.task];
  }
});

$("ask-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.material) return toast("Upload a PDF first so the AI can use your notes.");
  const question = $("question-input").value.trim();
  if (!question) return;
  const button = $("ask-form").querySelector("button");
  button.disabled = true;
  $("ask-result").classList.remove("hidden");
  $("ask-result").textContent = "Thinking through your question…";
  try {
    const response = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ material: state.material, question, level: state.level })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not answer this question.");
    $("ask-result").innerHTML = renderMarkdown(data.result);
    $("question-input").value = "";
  } catch (error) {
    $("ask-result").textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

$("complete-activity").addEventListener("click", () => {
  if (!state.currentResult) return toast("Generate a result before marking it complete.");
  if (state.completed) return toast("This result is already marked complete.");
  state.activities += 1;
  state.completed = true;
  updateProgress();
  $("completion-status").textContent = "Activity completed";
  toast("Progress updated for this session.");
});

$("copy-result").addEventListener("click", async () => {
  if (!state.currentResult) return toast("There is no result to copy yet.");
  try {
    await navigator.clipboard.writeText(state.currentResult);
    toast("Result copied to clipboard.");
  } catch {
    toast("Clipboard access is unavailable in this browser.");
  }
});

$("save-score").addEventListener("click", () => {
  const raw = $("score-input").value;
  if (raw === "" || Number(raw) < 0 || Number(raw) > 100) return toast("Enter a score between 0 and 100.");
  state.latestScore = String(Math.round(Number(raw)));
  updateProgress();
  toast("Quiz score saved for this session.");
});

$("reset-progress").addEventListener("click", () => {
  if (!confirm("Reset activity count and quiz score for this browser session?")) return;
  state.activities = 0;
  state.latestScore = "";
  sessionStorage.removeItem("studyActivities");
  sessionStorage.removeItem("studyLatestScore");
  $("score-input").value = "";
  updateProgress();
  toast("Session progress reset.");
});

selectTask("summary");
updateProgress();
