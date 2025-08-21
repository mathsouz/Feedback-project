(() => {
  const STORAGE_KEY = "feedbacks";

  /** @type {Array<{id:string,name:string,rating:number,comment?:string,createdAt:number}>} */
  let feedbacks = [];
  /** @type {Chart | null} */
  let ratingChart = null;
  /** @type {Chart | null} */
  let ratingDonutChart = null;

  const form = document.getElementById("feedback-form");
  const nameInput = document.getElementById("nameInput");
  const commentInput = document.getElementById("commentInput");
  const formError = document.getElementById("formError");
  const feedbackList = document.getElementById("feedbackList");
  const avgScoreEl = document.getElementById("avgScore");
  const totalFeedbacksEl = document.getElementById("totalFeedbacks");
  const chartCanvas = document.getElementById("ratingChart");
  const donutCanvas = document.getElementById("ratingDonutChart");
  const dashboardPanel = document.getElementById("dashboardPanel");
  const btnLogin = document.getElementById("btnLogin");
  const btnLogout = document.getElementById("btnLogout");
  const loginModal = document.getElementById("loginModal");
  const loginForm = document.getElementById("loginForm");
  const loginPassword = document.getElementById("loginPassword");
  const loginError = document.getElementById("loginError");
  const closeLoginModal = document.getElementById("closeLoginModal");

  document.addEventListener("DOMContentLoaded", () => {
    feedbacks = loadFeedbacks();
    syncAuthUI();
    renderAll();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    formError.textContent = "";

    const name = String(nameInput.value || "").trim();
    const ratingStr = getSelectedStar();
    const comment = String(commentInput.value || "").trim();
    const rating = Number(ratingStr);

    if (!name) {
      formError.textContent = "Informe seu nome.";
      nameInput.focus();
      return;
    }
    if (!ratingStr || Number.isNaN(rating) || rating < 1 || rating > 5) {
      formError.textContent = "Selecione uma nota entre 1 e 5.";
      focusFirstStar();
      return;
    }

    const feedback = {
      id: cryptoRandomId(),
      name,
      rating,
      comment: comment || undefined,
      createdAt: Date.now(),
    };

    feedbacks.push(feedback);
    saveFeedbacks(feedbacks);

    form.reset();
    renderAll();
  });

  function renderAll() {
    renderStats();
    renderList();
    renderChart();
    syncAuthUI();
  }

  function renderStats() {
    const total = feedbacks.length;
    totalFeedbacksEl.textContent = String(total);
    const avg = total === 0 ? 0 : feedbacks.reduce((a, b) => a + b.rating, 0) / total;
    avgScoreEl.textContent = avg.toFixed(1);
  }

  function renderList() {
    feedbackList.innerHTML = "";
    const sorted = [...feedbacks].sort((a, b) => b.createdAt - a.createdAt);

    if (sorted.length === 0) {
      const li = document.createElement("li");
      li.className = "feedback-item";
      li.innerHTML = `<span class="muted">Nenhum feedback ainda. Seja o primeiro!</span>`;
      feedbackList.appendChild(li);
      return;
    }

    for (const fb of sorted) {
      const li = document.createElement("li");
      li.className = "feedback-item";
      const date = new Date(fb.createdAt);
      const dateStr = date.toLocaleString(undefined, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      li.innerHTML = `
        <div class="feedback-item-header">
          <strong>${escapeHtml(fb.name)}</strong>
          <span class="badge">${renderStars(fb.rating)}</span>
        </div>
        ${fb.comment ? `<div>${escapeHtml(fb.comment)}</div>` : ""}
        <div class="muted" style="font-size:12px;">${dateStr}</div>
      `;
      feedbackList.appendChild(li);
    }
  }

  function renderStars(rating) {
    const full = "★".repeat(Math.max(0, Math.min(5, Math.floor(rating))));
    const empty = "☆".repeat(5 - full.length);
    return `${full}${empty}`;
  }

  function renderChart() {
    if (!dashboardIsVisible()) return;
    if (!chartCanvas || !donutCanvas) return;
    const data = getRatingDistribution(feedbacks);
    const labels = ["1", "2", "3", "4", "5"];
    const values = labels.map((l) => data[Number(l)] || 0);

    const dataset = {
      label: "Quantidade",
      data: values,
      backgroundColor: [
        "#ff7171",
        "#ffa257",
        "#ffd056",
        "#8bd17c",
        "#5b8cff",
      ],
      borderColor: "rgba(255,255,255,0.08)",
      borderWidth: 1,
      borderRadius: 6,
    };

    if (ratingChart) {
      ratingChart.data.labels = labels;
      ratingChart.data.datasets[0].data = values;
      ratingChart.update();
    }
    if (!ratingChart) {
      ratingChart = new Chart(chartCanvas.getContext("2d"), {
        type: "bar",
        data: { labels, datasets: [dataset] },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          resizeDelay: 100,
          scales: {
            x: {
              grid: { color: "rgba(255,255,255,0.06)" },
              ticks: { color: "#cdd6f4" },
            },
            y: {
              beginAtZero: true,
              precision: 0,
              grid: { color: "rgba(255,255,255,0.06)" },
              ticks: { color: "#cdd6f4" },
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => `Quantidade: ${ctx.parsed.y}`,
              },
            },
          },
        },
      });
    }

    // Donut chart
    const donutDataset = {
      label: "Quantidade",
      data: values,
      backgroundColor: [
        "#ff7171",
        "#ffa257",
        "#ffd056",
        "#8bd17c",
        "#5b8cff",
      ],
      borderColor: "rgba(0,0,0,0)",
    };

    if (ratingDonutChart) {
      ratingDonutChart.data.labels = labels;
      ratingDonutChart.data.datasets[0].data = values;
      ratingDonutChart.update();
    }
    if (!ratingDonutChart) {
      ratingDonutChart = new Chart(donutCanvas.getContext("2d"), {
        type: "doughnut",
        data: { labels, datasets: [donutDataset] },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          resizeDelay: 100,
          plugins: {
            legend: { position: "top", labels: { color: "#cdd6f4" } },
            title: { display: true, text: "Distribuição de Notas (Pizza)", color: "#cdd6f4" },
          },
        },
      });
    }
  }

  // --- Rating stars helpers ---
  function getSelectedStar() {
    const radios = document.querySelectorAll('input[name="ratingStar"]');
    for (const r of radios) if (r.checked) return r.value;
    return "";
  }
  function focusFirstStar() {
    const star = document.getElementById("star1");
    if (star) star.focus();
  }

  function getRatingDistribution(items) {
    const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const it of items) {
      if (it.rating >= 1 && it.rating <= 5) dist[it.rating]++;
    }
    return dist;
  }

  // --- Auth (simples) ---
  const SESSION_KEY = "session.isAuthenticated";
  function isAuthenticated() {
    try { return sessionStorage.getItem(SESSION_KEY) === "true"; } catch { return false; }
  }
  function setAuthenticated(v) {
    try { sessionStorage.setItem(SESSION_KEY, v ? "true" : "false"); } catch {}
  }
  function dashboardIsVisible() {
    return isAuthenticated() && dashboardPanel && dashboardPanel.style.display !== "none";
  }
  function syncAuthUI() {
    const authed = isAuthenticated();
    if (dashboardPanel) dashboardPanel.style.display = authed ? "block" : "none";
    if (btnLogin) btnLogin.style.display = authed ? "none" : "inline-flex";
    if (btnLogout) btnLogout.style.display = authed ? "inline-flex" : "none";
    if (!authed) {
      // destruir gráfico quando esconder para evitar erros de canvas nulo
      if (ratingChart) {
        ratingChart.destroy();
        ratingChart = null;
      }
      if (ratingDonutChart) {
        ratingDonutChart.destroy();
        ratingDonutChart = null;
      }
    } else {
      renderChart();
    }
  }

  if (btnLogin) btnLogin.addEventListener("click", () => openLoginModal());
  if (btnLogout) btnLogout.addEventListener("click", () => { setAuthenticated(false); syncAuthUI(); });

  function openLoginModal() {
    if (!loginModal) return;
    loginModal.classList.add("show");
    loginModal.style.display = "block";
    if (loginPassword) loginPassword.value = "";
    if (loginError) loginError.textContent = "";
    setTimeout(() => loginPassword && loginPassword.focus(), 0);
  }
  function closeLogin() {
    if (!loginModal) return;
    loginModal.classList.remove("show");
    loginModal.style.display = "none";
  }
  if (closeLoginModal) closeLoginModal.addEventListener("click", closeLogin);
  if (loginModal) loginModal.addEventListener("click", (e) => { if (e.target === loginModal) closeLogin(); });
  if (loginForm) loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const pwd = String(loginPassword?.value || "").trim();
    if (pwd === "admin123") {
      setAuthenticated(true);
      closeLogin();
      syncAuthUI();
    } else {
      if (loginError) loginError.textContent = "Senha incorreta.";
    }
  });

  function saveFeedbacks(items) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (err) {
      console.error("Erro ao salvar no LocalStorage", err);
    }
  }

  function loadFeedbacks() {
    try {
      const str = localStorage.getItem(STORAGE_KEY);
      if (!str) return [];
      const arr = JSON.parse(str);
      if (!Array.isArray(arr)) return [];
      return arr.filter((x) => typeof x === "object" && x && typeof x.rating === "number");
    } catch {
      return [];
    }
  }

  function cryptoRandomId() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return (
      Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
    );
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }
})();


