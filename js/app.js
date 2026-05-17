(function () {
  var transactions = JSON.parse(localStorage.getItem("transactions") || "[]");

  var FILTER_YEAR_KEY = "budgetFilterYear";
  var FILTER_MONTH_KEY = "budgetFilterMonth";
  var CHART_MODE_KEY = "budgetChartMode";
  var MONTH_NAMES_RU = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
  ];

  var uiFilterYear = localStorage.getItem(FILTER_YEAR_KEY) || "";
  var uiFilterMonth = localStorage.getItem(FILTER_MONTH_KEY) || "";
  var chartMode = localStorage.getItem(CHART_MODE_KEY) === "income" ? "income" : "expense";

  var MAX_UNDO_STEPS = 50;
  var historyPast = [];
  var historyFuture = [];
  var chartInstance = null;

  function cloneAppState() {
    return {
      transactions: JSON.parse(JSON.stringify(transactions)),
      uiFilterYear: uiFilterYear,
      uiFilterMonth: uiFilterMonth,
      chartMode: chartMode
    };
  }

  function applyAppState(s) {
    transactions = JSON.parse(JSON.stringify(s.transactions));
    uiFilterYear = s.uiFilterYear || "";
    uiFilterMonth = s.uiFilterMonth || "";
    chartMode = s.chartMode === "income" ? "income" : "expense";
    persistFilter();
    persistChartMode();
    syncChartToggleUI();
  }

  function pushUndoSnapshotBeforeChange() {
    historyPast.push(cloneAppState());
    if (historyPast.length > MAX_UNDO_STEPS) historyPast.shift();
    historyFuture = [];
  }

  function undoStep() {
    if (historyPast.length === 0) return;
    historyFuture.push(cloneAppState());
    applyAppState(historyPast.pop());
    save();
    render();
  }

  function redoStep() {
    if (historyFuture.length === 0) return;
    historyPast.push(cloneAppState());
    applyAppState(historyFuture.pop());
    save();
    render();
  }

  function persistFilter() {
    localStorage.setItem(FILTER_YEAR_KEY, uiFilterYear);
    localStorage.setItem(FILTER_MONTH_KEY, uiFilterMonth);
  }

  function persistChartMode() {
    localStorage.setItem(CHART_MODE_KEY, chartMode);
  }

  function syncChartToggleUI() {
    document.querySelectorAll(".chart-toggle").forEach(function (btn) {
      var mode = btn.getAttribute("data-chart-mode");
      btn.classList.toggle("active", mode === chartMode);
      btn.setAttribute("aria-pressed", mode === chartMode ? "true" : "false");
    });
  }

  function setChartMode(mode) {
    if (mode !== "income" && mode !== "expense") return;
    if (mode === chartMode) return;
    chartMode = mode;
    persistChartMode();
    syncChartToggleUI();
    drawChart(getFilteredTransactions());
  }

  function collectYearsFromTransactions() {
    var s = new Set();
    transactions.forEach(function (t) {
      if (!t || !t.date) return;
      var d = new Date(t.date + "T12:00:00");
      if (isNaN(d.getTime())) return;
      s.add(d.getFullYear());
    });
    s.add(new Date().getFullYear());
    return Array.from(s).sort(function (a, b) { return b - a; });
  }

  function rebuildHistoryYearSelect() {
    var sel = document.getElementById("historyYear");
    if (!sel) return;
    var years = collectYearsFromTransactions();
    var opts = ['<option value="">Все годы</option>'].concat(
      years.map(function (y) { return '<option value="' + y + '">' + y + "</option>"; })
    );
    sel.innerHTML = opts.join("");
  }

  function rebuildHistoryMonthSelect() {
    var yearEl = document.getElementById("historyYear");
    var monthEl = document.getElementById("historyMonth");
    if (!yearEl || !monthEl) return;
    var y = yearEl.value;
    if (!y) {
      monthEl.innerHTML = '<option value="">—</option>';
      monthEl.disabled = true;
      return;
    }
    monthEl.disabled = false;
    var parts = ['<option value="">Весь год</option>'];
    for (var i = 0; i < 12; i++) {
      var v = String(i + 1).padStart(2, "0");
      parts.push('<option value="' + v + '">' + MONTH_NAMES_RU[i] + "</option>");
    }
    monthEl.innerHTML = parts.join("");
  }

  function applyFilterToSelects() {
    var yearEl = document.getElementById("historyYear");
    var monthEl = document.getElementById("historyMonth");
    rebuildHistoryYearSelect();
    var yOk = uiFilterYear && Array.prototype.some.call(yearEl.options, function (o) {
      return o.value === uiFilterYear;
    });
    yearEl.value = yOk ? uiFilterYear : "";
    if (!yOk) uiFilterYear = yearEl.value;
    rebuildHistoryMonthSelect();
    if (monthEl.disabled) {
      uiFilterMonth = "";
      persistFilter();
      return;
    }
    var mOk = uiFilterMonth && Array.prototype.some.call(monthEl.options, function (o) {
      return o.value === uiFilterMonth;
    });
    monthEl.value = mOk ? uiFilterMonth : "";
    uiFilterMonth = monthEl.value;
    persistFilter();
  }

  function transactionMatchesPeriod(t) {
    if (!t || !t.date) return false;
    var d = new Date(t.date + "T12:00:00");
    if (isNaN(d.getTime())) return false;
    if (!uiFilterYear) return true;
    if (d.getFullYear() !== Number(uiFilterYear)) return false;
    if (!uiFilterMonth) return true;
    return String(d.getMonth() + 1).padStart(2, "0") === uiFilterMonth;
  }

  function getFilteredTransactions() {
    return transactions.filter(transactionMatchesPeriod);
  }

  function formatPeriodHint() {
    if (!uiFilterYear) return "За всё время";
    if (!uiFilterMonth) return "За " + uiFilterYear + " год";
    var idx = parseInt(uiFilterMonth, 10) - 1;
    if (idx < 0 || idx > 11) return "За " + uiFilterYear + " год";
    return MONTH_NAMES_RU[idx] + " " + uiFilterYear;
  }

  function openClearConfirmModal() {
    document.getElementById("clearModalBackdrop").classList.add("active");
    document.getElementById("clearConfirmModal").classList.add("active");
    document.getElementById("clearModalBackdrop").setAttribute("aria-hidden", "false");
  }

  function closeClearConfirmModal() {
    document.getElementById("clearModalBackdrop").classList.remove("active");
    document.getElementById("clearConfirmModal").classList.remove("active");
    document.getElementById("clearModalBackdrop").setAttribute("aria-hidden", "true");
  }

  function executeClearAllTransactions() {
    pushUndoSnapshotBeforeChange();
    transactions = [];
    uiFilterYear = "";
    uiFilterMonth = "";
    persistFilter();
    save();
    render();
  }

  function save() {
    localStorage.setItem("transactions", JSON.stringify(transactions));
  }

  var INCOME_CATEGORIES = [
    "Зарплата", "Подработка", "Подарок", "Возврат", "Пассивный доход", "Прочий доход"
  ];
  var EXPENSE_CATEGORIES = [
    "Еда", "Жильё", "Транспорт", "Интернет", "Аптека", "Кошка", "Здоровье",
    "Привычки", "Покупки", "Развлечения", "Прочее"
  ];

  function fillCategorySelect() {
    var typeEl = document.getElementById("type");
    var sel = document.getElementById("category");
    if (!typeEl || !sel) return;
    var list = typeEl.value === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    var prev = sel.value;
    sel.innerHTML = list.map(function (c) { return "<option>" + c + "</option>"; }).join("");
    if (list.indexOf(prev) !== -1) sel.value = prev;
  }

  function openModal() {
    fillCategorySelect();
    var dateEl = document.getElementById("date");
    if (dateEl && !dateEl.value) {
      dateEl.value = new Date().toISOString().slice(0, 10);
    }
    document.getElementById("modal").classList.add("active");
  }

  function closeAddModal() {
    document.getElementById("modal").classList.remove("active");
  }

  function addTransaction() {
    var t = {
      date: document.getElementById("date").value,
      amount: parseFloat(document.getElementById("amount").value),
      type: document.getElementById("type").value,
      category: document.getElementById("category").value
    };
    if (!t.date || !t.amount) return alert("Заполни данные");

    pushUndoSnapshotBeforeChange();
    transactions.push(t);
    save();
    closeAddModal();
    render();
  }

  function render() {
    applyFilterToSelects();
    syncChartToggleUI();

    var undoBtn = document.getElementById("undoStepBtn");
    var redoBtn = document.getElementById("redoStepBtn");
    if (undoBtn) undoBtn.disabled = historyPast.length === 0;
    if (redoBtn) redoBtn.disabled = historyFuture.length === 0;

    var periodEl = document.getElementById("periodHint");
    if (periodEl) periodEl.textContent = formatPeriodHint();

    var visible = getFilteredTransactions();
    var list = document.getElementById("list");
    list.innerHTML = "";

    var income = 0;
    var expense = 0;

    visible.forEach(function (t) {
      if (t.type === "income") income += t.amount;
      else expense += t.amount;

      list.innerHTML +=
        '<div class="item ' + t.type + '">' +
        "<div><div>" + t.category + "</div><small style=\"color:var(--muted)\">" + t.date + "</small></div>" +
        "<div>" + t.amount + " ₽</div>" +
        "</div>";
    });

    var balance = income - expense;
    document.getElementById("balance").innerText = balance + " ₽";
    document.getElementById("summary").innerHTML =
      "<b>Доход:</b> " + income + " ₽<br><b>Расход:</b> " + expense + " ₽";

    drawChart(visible);
  }

  function drawChart(rows) {
    var byCategory = {};
    (rows || []).forEach(function (t) {
      if (t.type !== chartMode) return;
      if (!byCategory[t.category]) byCategory[t.category] = 0;
      byCategory[t.category] += t.amount;
    });

    var labels = Object.keys(byCategory);
    var data = Object.values(byCategory);
    var chartTitle = document.getElementById("chartTitle");
    if (chartTitle) {
      chartTitle.textContent = chartMode === "income" ? "Доходы по категориям" : "Расходы по категориям";
    }

    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }

    var tickColor = getComputedStyle(document.documentElement).getPropertyValue("--muted").trim() || "#6b7280";
    var accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#16a34a";

    chartInstance = new Chart(document.getElementById("chart"), {
      type: "doughnut",
      data: {
        labels: labels.length ? labels : ["Нет данных"],
        datasets: [{
          data: data.length ? data : [1],
          backgroundColor: labels.length
            ? undefined
            : ["rgba(100,116,139,0.25)"]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: tickColor, boxWidth: 12, font: { size: 11 } }
          },
          tooltip: {
            enabled: labels.length > 0
          }
        }
      }
    });

    if (!labels.length) {
      chartInstance.data.datasets[0].backgroundColor = ["rgba(100,116,139,0.25)"];
    } else if (chartMode === "income") {
      chartInstance.data.datasets[0].backgroundColor = [
        accent, "#22c55e", "#4ade80", "#86efac", "#bbf7d0", "#dcfce7"
      ];
    } else {
      chartInstance.data.datasets[0].backgroundColor = undefined;
    }
    chartInstance.update();
  }

  BudgetTheme.initTheme("themeToggle", function () { render(); });
  BudgetTheme.registerServiceWorker();

  document.getElementById("type").addEventListener("change", fillCategorySelect);
  fillCategorySelect();
  syncChartToggleUI();

  document.getElementById("historyYear").addEventListener("change", function () {
    uiFilterYear = this.value;
    if (!uiFilterYear) uiFilterMonth = "";
    persistFilter();
    render();
  });
  document.getElementById("historyMonth").addEventListener("change", function () {
    uiFilterMonth = this.value;
    persistFilter();
    render();
  });
  document.getElementById("undoStepBtn").addEventListener("click", undoStep);
  document.getElementById("redoStepBtn").addEventListener("click", redoStep);
  document.getElementById("clearAllBtn").addEventListener("click", openClearConfirmModal);
  document.getElementById("clearModalCancel").addEventListener("click", closeClearConfirmModal);
  document.getElementById("clearModalConfirm").addEventListener("click", function () {
    executeClearAllTransactions();
    closeClearConfirmModal();
  });
  document.getElementById("clearModalBackdrop").addEventListener("click", closeClearConfirmModal);

  document.querySelectorAll(".chart-toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      setChartMode(btn.getAttribute("data-chart-mode"));
    });
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (document.getElementById("clearConfirmModal").classList.contains("active")) {
      closeClearConfirmModal();
    } else if (document.getElementById("modal").classList.contains("active")) {
      closeAddModal();
    }
  });

  window.openModal = openModal;
  window.addTransaction = addTransaction;

  render();
})();
