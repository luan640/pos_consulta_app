// Mock Data
const mockData = {
  patients: [
    {
      id: 1,
      name: "Maria Silva Santos",
      phone: "(11) 98765-4321",
      email: "maria.silva@email.com",
      lastConsult: "2024-12-10",
    },
    {
      id: 2,
      name: "João Pedro Oliveira",
      phone: "(11) 97654-3210",
      email: "joao.oliveira@email.com",
      lastConsult: "2024-12-12",
    },
    {
      id: 3,
      name: "Ana Carolina Souza",
      phone: "(11) 96543-2109",
      email: "ana.souza@email.com",
      lastConsult: "2024-12-15",
    },
    { id: 4, name: "Carlos Eduardo Lima", phone: "(11) 95432-1098", email: "", lastConsult: "2024-12-08" },
    {
      id: 5,
      name: "Fernanda Costa",
      phone: "(11) 94321-0987",
      email: "fernanda.costa@email.com",
      lastConsult: "2024-12-14",
    },
  ],

  reminders: [
    {
      id: 1,
      patientId: 1,
      patientName: "Maria Silva Santos",
      type: "Enviar Ebook de receitas fit",
      date: "2024-12-17",
      status: "pending",
      groupId: 1,
    },
    {
      id: 2,
      patientId: 2,
      patientName: "João Pedro Oliveira",
      type: "Ligar para agendar retorno",
      date: "2024-12-16",
      status: "overdue",
      groupId: null,
    },
    {
      id: 3,
      patientId: 3,
      patientName: "Ana Carolina Souza",
      type: "Enviar material educativo",
      date: "2024-12-18",
      status: "pending",
      groupId: null,
    },
    {
      id: 4,
      patientId: 1,
      patientName: "Maria Silva Santos",
      type: "Verificar progresso do plano alimentar",
      date: "2024-12-15",
      status: "done",
      groupId: null,
    },
    {
      id: 5,
      patientId: 4,
      patientName: "Carlos Eduardo Lima",
      type: "Enviar Ebook de receitas fit",
      date: "2024-12-17",
      status: "pending",
      groupId: 1,
    },
  ],

  ruleGroups: [
    {
      id: 1,
      name: "Grupo de Regras 1",
      description: "Fluxo de envio de materiais pós-consulta",
      rules: [
        { trigger: "7 dias após a consulta", action: "Lembrar de enviar Ebook de receitas fit" },
        { trigger: "15 dias após esse contato", action: "Lembrar de enviar Ebook de receitas doces" },
      ],
    },
  ],

  materials: [
    {
      id: 1,
      title: "Ebook de receitas fit",
      type: "PDF",
      description: "Receitas saudáveis e práticas para o dia a dia",
    },
    { id: 2, title: "Ebook de receitas doces", type: "PDF", description: "Sobremesas saudáveis e sem culpa" },
    { id: 3, title: "Guia de hidratação", type: "PDF", description: "Como manter-se hidratado durante o treino" },
    { id: 4, title: "Plano alimentar base", type: "Documento", description: "Template editável para plano alimentar" },
    { id: 5, title: "Vídeo: Preparando marmitas", type: "Vídeo", description: "Tutorial prático de meal prep" },
    { id: 6, title: "Checklist de compras", type: "PDF", description: "Lista organizada para supermercado" },
  ],
}

// State management
let currentFilter = "today"
let currentView = "list"
let currentDate = new Date()
let selectedDay = null

// Initialize app
document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners()
})

// Event Listeners
function setupEventListeners() {
  // Login
  document.getElementById("login-form")?.addEventListener("submit", handleLogin)

  // Sidebar toggle
  document.getElementById("toggle-sidebar")?.addEventListener("click", toggleSidebar)

  // Navigation
  document.querySelectorAll("[data-page]").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault()
      navigateTo(e.target.closest("[data-page]").dataset.page)
    })
  })

  // Logout
  document.getElementById("logout-btn")?.addEventListener("click", handleLogout)

  // Dashboard filters
  document.querySelectorAll('input[name="filter"]').forEach((radio) => {
    radio.addEventListener("change", handleFilterChange)
  })

  // View toggle
  document.querySelectorAll('input[name="view"]').forEach((radio) => {
    radio.addEventListener("change", handleViewChange)
  })

  // Search
  document.getElementById("search-reminders")?.addEventListener("input", handleReminderSearch)
  document.getElementById("search-patients")?.addEventListener("input", handlePatientSearch)

  // Calendar navigation
  document.getElementById("prev-month")?.addEventListener("click", () => changeMonth(-1))
  document.getElementById("next-month")?.addEventListener("click", () => changeMonth(1))
  document.getElementById("today-btn")?.addEventListener("click", goToToday)

  // Simulate rules
  document.getElementById("simulate-rules")?.addEventListener("click", simulateRules)
}

// Login handler
function handleLogin(e) {
  e.preventDefault()
  document.getElementById("login-screen").classList.add("d-none")
  document.getElementById("app").classList.remove("d-none")

  // Initialize dashboard
  renderReminders()
  renderPatients()
  renderRuleGroups()
  renderMaterials()
  renderCalendar()
}

// Logout handler
function handleLogout(e) {
  e.preventDefault()
  document.getElementById("app").classList.add("d-none")
  document.getElementById("login-screen").classList.remove("d-none")
}

// Sidebar toggle
function toggleSidebar() {
  const sidebar = document.getElementById("sidebar")
  const mainContent = document.getElementById("main-content")
  sidebar.classList.toggle("collapsed")
  mainContent.classList.toggle("expanded")
}

// Navigation
function navigateTo(page) {
  // Update sidebar active state
  document.querySelectorAll(".sidebar .nav-link").forEach((link) => {
    link.classList.remove("active")
  })
  document.querySelector(`[data-page="${page}"]`).classList.add("active")

  // Show page
  document.querySelectorAll(".page-content").forEach((p) => p.classList.remove("active"))
  document.getElementById(`page-${page}`).classList.add("active")

  // Render content if needed
  if (page === "calendar") {
    renderCalendar()
  }
}

// Filter change handler
function handleFilterChange(e) {
  currentFilter = e.target.id.replace("filter-", "")
  renderReminders()
}

// View change handler
function handleViewChange(e) {
  currentView = e.target.id.replace("view-", "")
  if (currentView === "list") {
    document.getElementById("reminders-list").classList.remove("d-none")
    document.getElementById("calendar-view").classList.add("d-none")
  } else {
    document.getElementById("reminders-list").classList.add("d-none")
    document.getElementById("calendar-view").classList.remove("d-none")
    renderMiniCalendar()
  }
}

// Render reminders
function renderReminders() {
  const container = document.getElementById("reminders-list")
  let reminders = [...mockData.reminders]

  // Apply filter
  const today = new Date().toISOString().split("T")[0]
  if (currentFilter === "today") {
    reminders = reminders.filter((r) => r.date === today)
  } else if (currentFilter === "overdue") {
    reminders = reminders.filter((r) => r.status === "overdue")
  } else if (currentFilter === "upcoming") {
    reminders = reminders.filter((r) => r.date > today && r.status === "pending")
  }

  if (reminders.length === 0) {
    container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon"><i class="bi bi-calendar-check"></i></div>
                <div class="empty-state-title">Nenhum lembrete encontrado</div>
                <div class="empty-state-description">Não há lembretes para o filtro selecionado</div>
            </div>
        `
    return
  }

  container.innerHTML = reminders
    .map(
      (reminder) => `
        <div class="reminder-card">
            <div class="reminder-info">
                <div class="reminder-patient">${reminder.patientName}</div>
                <div class="reminder-type">${reminder.type}</div>
                <div class="reminder-date">
                    <i class="bi bi-calendar3"></i>
                    ${formatDate(reminder.date)}
                </div>
            </div>
            <div class="reminder-actions">
                <span class="status-badge status-${reminder.status}">
                    ${getStatusLabel(reminder.status)}
                </span>
                ${
                  reminder.status === "pending" || reminder.status === "overdue"
                    ? `
                    <button class="btn btn-sm btn-success" onclick="markAsDone(${reminder.id})">
                        <i class="bi bi-check-lg"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-secondary" onclick="rescheduleReminder(${reminder.id})">
                        <i class="bi bi-clock"></i>
                    </button>
                `
                    : ""
                }
            </div>
        </div>
    `,
    )
    .join("")
}

// Mark reminder as done
window.markAsDone = (id) => {
  const reminder = mockData.reminders.find((r) => r.id === id)
  if (reminder) {
    reminder.status = "done"
    renderReminders()
    showToast("Lembrete marcado como realizado", "success")
  }
}

// Reschedule reminder
window.rescheduleReminder = (id) => {
  showToast("Funcionalidade de reagendamento será integrada com o backend", "info")
}

// Render patients table
function renderPatients() {
  const tbody = document.getElementById("patients-tbody")
  tbody.innerHTML = mockData.patients
    .map(
      (patient) => `
        <tr>
            <td><strong>${patient.name}</strong></td>
            <td>${patient.phone}</td>
            <td>${patient.email || "-"}</td>
            <td>${formatDate(patient.lastConsult)}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="viewPatientDetail(${patient.id})">
                    Ver detalhes
                </button>
            </td>
        </tr>
    `,
    )
    .join("")
}

// View patient detail
window.viewPatientDetail = (id) => {
  const patient = mockData.patients.find((p) => p.id === id)
  if (patient) {
    document.getElementById("patient-detail-name").textContent = patient.name

    // Mock timeline
    document.getElementById("patient-timeline").innerHTML = `
            <div class="timeline">
                <div class="mb-3 pb-3 border-bottom">
                    <small class="text-muted">10/12/2024</small>
                    <div class="mt-1"><strong>Consulta inicial</strong></div>
                    <div class="text-muted small">Avaliação nutricional completa realizada</div>
                </div>
                <div class="mb-3 pb-3 border-bottom">
                    <small class="text-muted">17/12/2024</small>
                    <div class="mt-1"><strong>Material enviado</strong></div>
                    <div class="text-muted small">Ebook de receitas fit</div>
                </div>
            </div>
        `

    document.getElementById("patient-returns").innerHTML = `
            <p class="text-muted">Próximo retorno agendado para 10/01/2025</p>
        `

    document.getElementById("patient-materials").innerHTML = `
            <ul class="list-unstyled">
                <li class="mb-2"><i class="bi bi-file-pdf text-danger me-2"></i> Ebook de receitas fit</li>
                <li class="mb-2"><i class="bi bi-file-pdf text-danger me-2"></i> Guia de hidratação</li>
            </ul>
        `

    // Assuming bootstrap is declared elsewhere in the codebase
    const Modal = window.bootstrap.Modal
    new Modal(document.getElementById("patientDetailModal")).show()
  }
}

// Search patients
function handlePatientSearch(e) {
  const query = e.target.value.toLowerCase()
  const rows = document.querySelectorAll("#patients-tbody tr")

  rows.forEach((row) => {
    const text = row.textContent.toLowerCase()
    row.style.display = text.includes(query) ? "" : "none"
  })
}

// Search reminders
function handleReminderSearch(e) {
  const query = e.target.value.toLowerCase()
  const cards = document.querySelectorAll(".reminder-card")

  cards.forEach((card) => {
    const text = card.textContent.toLowerCase()
    card.style.display = text.includes(query) ? "" : "none"
  })
}

// Render rule groups
function renderRuleGroups() {
  const container = document.getElementById("rule-groups-container")
  container.innerHTML = mockData.ruleGroups
    .map(
      (group) => `
        <div class="rule-group-card">
            <div class="rule-group-header">
                <div>
                    <div class="rule-group-title">${group.name}</div>
                    <small class="text-muted">${group.description}</small>
                </div>
                <button class="btn btn-sm btn-outline-secondary">
                    <i class="bi bi-pencil"></i>
                </button>
            </div>
            <div class="rule-group-body">
                ${group.rules
                  .map(
                    (rule) => `
                    <div class="rule-item">
                        <div class="rule-content">
                            <div class="rule-trigger">${rule.trigger}</div>
                            <div class="rule-action">${rule.action}</div>
                        </div>
                    </div>
                `,
                  )
                  .join("")}
            </div>
        </div>
    `,
    )
    .join("")
}

// Simulate rules
function simulateRules() {
  const newReminders = [
    {
      id: Date.now(),
      patientId: 5,
      patientName: "Fernanda Costa",
      type: "Enviar Ebook de receitas doces",
      date: "2024-12-29",
      status: "pending",
      groupId: 1,
    },
  ]

  mockData.reminders.push(...newReminders)
  renderReminders()
  showToast("Novos lembretes gerados a partir das regras configuradas", "success")
}

// Render materials
function renderMaterials() {
  const container = document.getElementById("materials-grid")
  container.innerHTML = mockData.materials
    .map(
      (material) => `
        <div class="col-md-6 col-lg-4">
            <div class="material-card">
                <div class="material-icon">
                    <i class="bi ${getMaterialIcon(material.type)}"></i>
                </div>
                <div class="material-title">${material.title}</div>
                <span class="material-type">${material.type}</span>
                <div class="material-description">${material.description}</div>
            </div>
        </div>
    `,
    )
    .join("")
}

// Calendar rendering
function renderCalendar() {
  const monthNames = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ]
  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

  document.getElementById("current-month-year").textContent =
    `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`

  const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
  const prevLastDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0)

  const firstDayIndex = firstDay.getDay()
  const lastDayDate = lastDay.getDate()
  const prevLastDayDate = prevLastDay.getDate()

  let html = '<div class="calendar-header">'
  dayNames.forEach((day) => {
    html += `<div class="calendar-header-day">${day}</div>`
  })
  html += '</div><div class="calendar-body">'

  // Previous month days
  for (let i = firstDayIndex; i > 0; i--) {
    html += `<div class="calendar-day other-month"><div class="calendar-day-number">${prevLastDayDate - i + 1}</div></div>`
  }

  // Current month days
  const today = new Date()
  for (let i = 1; i <= lastDayDate; i++) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), i)
    const dateString = date.toISOString().split("T")[0]
    const isToday = dateString === today.toISOString().split("T")[0]
    const dayReminders = mockData.reminders.filter((r) => r.date === dateString)

    html += `<div class="calendar-day ${isToday ? "today" : ""}" onclick="selectDay('${dateString}')">
            <div class="calendar-day-number">${i}</div>`

    dayReminders.slice(0, 3).forEach((reminder) => {
      html += `<div class="calendar-event">${reminder.patientName}</div>`
    })

    if (dayReminders.length > 3) {
      html += `<div class="calendar-event">+${dayReminders.length - 3} mais</div>`
    }

    html += "</div>"
  }

  // Next month days
  const totalCells = firstDayIndex + lastDayDate
  const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7)
  for (let i = 1; i <= remainingCells; i++) {
    html += `<div class="calendar-day other-month"><div class="calendar-day-number">${i}</div></div>`
  }

  html += "</div>"
  document.getElementById("calendar-grid").innerHTML = html
}

// Mini calendar for dashboard view
function renderMiniCalendar() {
  document.getElementById("calendar-view").innerHTML =
    '<div class="alert alert-info">Visualização em calendário integrada ao dashboard</div>'
}

// Select day in calendar
window.selectDay = (dateString) => {
  selectedDay = dateString
  const dayReminders = mockData.reminders.filter((r) => r.date === dateString)

  let html = `<h5 class="mb-3">Lembretes para ${formatDate(dateString)}</h5>`

  if (dayReminders.length === 0) {
    html += '<p class="text-muted">Nenhum lembrete para este dia</p>'
  } else {
    html += '<div class="reminders-container">'
    dayReminders.forEach((reminder) => {
      html += `
                <div class="reminder-card">
                    <div class="reminder-info">
                        <div class="reminder-patient">${reminder.patientName}</div>
                        <div class="reminder-type">${reminder.type}</div>
                    </div>
                    <span class="status-badge status-${reminder.status}">${getStatusLabel(reminder.status)}</span>
                </div>
            `
    })
    html += "</div>"
  }

  document.getElementById("day-details").innerHTML = html
}

// Calendar navigation
function changeMonth(delta) {
  currentDate.setMonth(currentDate.getMonth() + delta)
  renderCalendar()
}

function goToToday() {
  currentDate = new Date()
  renderCalendar()
}

// Helper functions
function formatDate(dateString) {
  const date = new Date(dateString + "T12:00:00")
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const dateOnly = date.toISOString().split("T")[0]
  const todayOnly = today.toISOString().split("T")[0]
  const tomorrowOnly = tomorrow.toISOString().split("T")[0]

  if (dateOnly === todayOnly) return "Hoje"
  if (dateOnly === tomorrowOnly) return "Amanhã"

  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function getStatusLabel(status) {
  const labels = {
    pending: "A realizar",
    done: "Realizado",
    overdue: "Atrasado",
  }
  return labels[status] || status
}

function getMaterialIcon(type) {
  const icons = {
    PDF: "bi-file-pdf",
    Documento: "bi-file-text",
    Vídeo: "bi-play-circle",
  }
  return icons[type] || "bi-file-earmark"
}

function showToast(message, type = "info") {
  const toastContainer = document.getElementById("toast-container")
  const toastId = "toast-" + Date.now()

  const bgClass =
    {
      success: "bg-success",
      error: "bg-danger",
      info: "bg-primary",
    }[type] || "bg-secondary"

  const toast = document.createElement("div")
  toast.id = toastId
  toast.className = "toast align-items-center text-white border-0 " + bgClass
  toast.setAttribute("role", "alert")
  toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">${message}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `

  toastContainer.appendChild(toast)
  const bsToast = new window.bootstrap.Toast(toast)
  bsToast.show()

  toast.addEventListener("hidden.bs.toast", () => {
    toast.remove()
  })
}

// API integration points - These functions would connect to your backend
// Example:
// async function fetchReminders() {
//     const response = await fetch('/api/reminders');
//     return response.json();
// }
