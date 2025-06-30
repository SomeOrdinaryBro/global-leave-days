const countrySelect = document.getElementById("countrySelect");
const yearSelect = document.getElementById("yearSelect");
const monthSelect = document.getElementById("monthSelect");
const calendarBtn = document.getElementById("calendarViewBtn");
const listBtn = document.getElementById("holidayViewBtn");
const allBtn = document.getElementById("allViewBtn");
const exportBtn = document.getElementById("exportCsvBtn");
const calContainer = document.getElementById("calendarContainer");
const listContainer = document.getElementById("holidayTableContainer");

let cache = {}, view = "calendar", all = false;

async function fetchData(year) {
  const country = countrySelect.value;
  const cacheKey = `${country}-${year}`;
  if (cache[cacheKey]) return cache[cacheKey];

  let raw = [];

  if (country === "SL") {
    raw = await fetch(
      `https://raw.githubusercontent.com/Dilshan-H/srilanka-holidays/main/json/${year}.json`
    ).then(r => r.json());
    raw = raw
      .filter(h => /Poya/i.test(h.summary))
      .map(h => ({ date: h.start, name: h.summary }));

  } else if (country === "CA") {
    raw = await fetch("assets/ca-holidays-2025.json").then(r => r.json());

  } else if (country === "US") {
    raw = await fetch(
      `https://date.nager.at/api/v3/PublicHolidays/${year}/US`
    ).then(r => r.json());
    raw = raw
      .filter(h => h.global)
      .map(h => ({ date: h.date, name: h.localName }));

  } else if (country === "AU") {
    raw = await fetch(
      `https://date.nager.at/api/v3/PublicHolidays/${year}/AU`
    ).then(r => r.json());
    raw = raw.map(h => ({ date: h.date, name: h.localName }));

  } else if (country === "GB") {
    raw = await fetch("assets/gb-bank-holidays-2025-27.json").then(r => r.json());
  }

  cache[cacheKey] = raw;
  return raw;
}

function createCalendar(m, y, days) {
  const first = new Date(y, m, 1).getDay();
  const total = new Date(y, m + 1, 0).getDate();
  let d = 1, cells = "";
  for (let i = 0; i < 42; i++) {
    const day = (i >= first && d <= total) ? d++ : "";
    const id = day
      ? `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      : null;
    const hol = day && days.find(x => x.date === id);
    cells += `
      <div class="cal-cell ${hol ? 'holiday' : ''}">
        <span>${day}</span>
        ${hol ? `<span>${hol.name}</span>` : ''}
      </div>`;
  }
  const hdr = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]
    .map(d => `<div class="cal-header">${d}</div>`)
    .join("");
  return `<div class="cal-grid">${hdr}${cells}</div>`;
}

function createList(days) {
  const rows = days.map(h => {
    const dt = new Date(h.date);
    const monthName = dt.toLocaleString("default", { month: "long" });
    return `
      <tr>
        <td>${monthName}</td>
        <td>${dt.toLocaleDateString()}</td>
        <td>${dt.toLocaleString("default",{weekday:"short"})}</td>
        <td>${h.name}</td>
      </tr>`;
  }).join("");

  return `
    <table class="glass-card">
      <thead>
        <tr>
          <th>Month</th>
          <th>Date</th>
          <th>Day</th>
          <th>Holiday</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>`;
}

/**
 * Displays the next upcoming holiday based on sorted days array.
 */
function updateNextHoliday(days) {
  const today = new Date().toISOString().slice(0,10);
  const next = days.find(h => h.date >= today);
  const el = document.getElementById('nextHolidayText');
  if (!next) {
    el.textContent = 'None left this year';
  } else {
    const dt = new Date(next.date);
    el.textContent = `${dt.toLocaleDateString()} – ${next.name}`;
  }
}

async function render() {
  const y = +yearSelect.value, m = +monthSelect.value;
  const days = await fetchData(y);
  calContainer.innerHTML = "";
  listContainer.innerHTML = "";

  if (all) {
    listContainer.innerHTML = createList(days);
    listContainer.classList.remove("hidden");
  } else {
    if (view === "list") {
      const filtered = days.filter(h => new Date(h.date).getMonth() === m);
      listContainer.innerHTML = createList(filtered);
      listContainer.classList.remove("hidden");
    } else {
      calContainer.innerHTML = createCalendar(m, y, days);
    }
  }

  // Update the next holiday display
  updateNextHoliday(days);
}

function updateButtons() {
  [calendarBtn, listBtn, allBtn].forEach(b => b.classList.remove("active"));
  const active = all ? allBtn : (view === "calendar" ? calendarBtn : listBtn);
  active.classList.add("active");
}

function toggleView(v, isAll = false) {
  view = v;
  all = isAll;
  updateButtons();
  render();
}

function exportCSV() {
  const y = +yearSelect.value;
  fetchData(y).then(days => {
    const out = ["Month,Date,Day,Holiday"];
    days.forEach(h => {
      const dt = new Date(h.date);
      const monthName = dt.toLocaleString("default", { month: "long" });
      out.push(
        `${monthName},${dt.toLocaleDateString()},${dt.toLocaleString("default",{weekday:"short"})},"${h.name}"`
      );
    });
    const blob = new Blob([out.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `holidays_${countrySelect.value}_${y}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
}

function addJsonLdEvents(year) {
  fetchData(year).then(days => {
    const events = days.map(h => ({
      "@type": "Event",
      name: h.name,
      startDate: h.date,
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      eventStatus: "https://schema.org/EventScheduled",
      location: {
        "@type": "Place",
        name: countrySelect.value === "SL" ? "Sri Lanka"
          : countrySelect.value === "CA" ? "Canada"
          : countrySelect.value === "US" ? "United States"
          : countrySelect.value === "AU" ? "Australia"
          : "United Kingdom"
      }
    }));
    const tag = document.createElement("script");
    tag.type = "application/ld+json";
    tag.text = JSON.stringify({ "@context": "https://schema.org", "@graph": events }, null, 2);
    document.head.appendChild(tag);
  });
}

function init() {
  const y = new Date().getFullYear();
  for (let i = y - 1; i <= y + 1; i++) yearSelect.add(new Option(i, i));
  for (let m = 0; m < 12; m++) monthSelect.add(
    new Option(new Date(0, m).toLocaleString("default", { month: "long" }), m)
  );
  yearSelect.value = y;
  monthSelect.value = new Date().getMonth();

  countrySelect.addEventListener("change", () => toggleView(view, false));
  yearSelect.addEventListener("change", () => toggleView(view, false));
  monthSelect.addEventListener("change", () => toggleView(view, false));

  calendarBtn.addEventListener("click", () => toggleView("calendar", false));
  listBtn.addEventListener("click", () => toggleView("list", false));
  allBtn.addEventListener("click", () => toggleView("list", true));
  exportBtn.addEventListener("click", exportCSV);

  updateButtons();
  render();
  addJsonLdEvents(y);
}

init();
