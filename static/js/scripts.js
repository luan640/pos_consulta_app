// Mock Data
const mockPatients = [
  { id: 1, name: "Maria Silva", phone: "(11) 98765-4321", lastContact: "2025-01-10", email: "maria@email.com" },
  { id: 2, name: "João Santos", phone: "(11) 97654-3210", lastContact: "2025-01-12", email: "joao@email.com" },
  { id: 3, name: "Ana Costa", phone: "(11) 96543-2109", lastContact: "2025-01-15", email: "ana@email.com" },
  { id: 4, name: "Pedro Oliveira", phone: "(11) 95432-1098", lastContact: "2025-01-08", email: "pedro@email.com" },
  { id: 5, name: "Carla Mendes", phone: "(11) 94321-0987", lastContact: "2025-01-14", email: "carla@email.com" },
]

const mockReminders = [
  {
    id: 1,
    patientId: 1,
    patient: "Maria Silva",
    phone: "(11) 98765-4321",
    type: "Envio de material",
    description: "Enviar Ebook receitas fit",
    date: "2025-01-20",
    status: "pending",
  },
  {
    id: 2,
    patientId: 2,
    patient: "João Santos",
    phone: "(11) 97654-3210",
    type: "Retorno",
    description: "Lembrar retorno",
    date: "2025-01-18",
    status: "pending",
  },
  {
    id: 3,
    patientId: 3,
    patient: "Ana Costa",
    phone: "(11) 96543-2109",
    type: "Envio de material",
    description: "Enviar Ebook receita doce",
    date: "2025-01-22",
    status: "pending",
  },
  {
    id: 4,
    patientId: 4,
    patient: "Pedro Oliveira",
    phone: "(11) 95432-1098",
    type: "Pós-consulta",
    description: "Follow-up consulta",
    date: "2025-01-16",
    status: "overdue",
  },
  {
    id: 5,
    patientId: 5,
    patient: "Carla Mendes",
    phone: "(11) 94321-0987",
    type: "Retorno",
    description: "Agendar retorno",
    date: "2025-01-19",
    status: "pending",
  },
  {
    id: 6,
    patientId: 1,
    patient: "Maria Silva",
    phone: "(11) 98765-4321",
    type: "Retorno",
    description: "Check-up mensal",
    date: "2025-01-25",
    status: "pending",
  },
]

const mockMaterials = [
  {
    id: 1,
    title: "Ebook receitas fit",
    type: "ebook",
    description: "Guia completo com 50 receitas saudáveis e práticas",
    link: "#",
  },
  {
    id: 2,
    title: "Ebook receita doce",
    type: "ebook",
    description: "Sobremesas fitness sem açúcar refinado",
    link: "#",
  },
  {
    id: 3,
    title: "Guia de exercícios em casa",
    type: "pdf",
    description: "Treino completo para fazer em casa sem equipamentos",
    link: "#",
  },
  {
    id: 4,
    title: "Vídeo: Como montar um prato equilibrado",
    type: "video",
    description: "Tutorial prático sobre nutrição balanceada",
    link: "#",
  },
]

const mockRuleGroups = [
  {
    id: 1,
    name: "Grupo de Regras 1 - Nutrição",
    steps: [
      { id: 1, days: 7, action: "enviar_material", description: "Enviar Ebook receitas fit" },
      { id: 2, days: 15, action: "enviar_material", description: "Enviar Ebook receita doce" },
      { id: 3, days: 30, action: "lembrar_retorno", description: "Lembrar retorno para avaliação" },
    ],
  },
]

let currentFilter = "all"
const allReminders = [...mockReminders]
const allPatients = [...mockPatients]
const allMaterials = [...mockMaterials]
let ruleGroups = JSON.parse(JSON.stringify(mockRuleGroups))

// Dashboard Functions
function loadReminders() {
  filterReminders("all")
}

function filterReminders(filter) {
  currentFilter = filter
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const filtered = allReminders.filter((r) => {
    const reminderDate = new Date(r.date)
    reminderDate.setHours(0, 0, 0, 0)

    switch (filter) {
      case "today":
        return reminderDate.getTime() === today.getTime() && r.status !== "completed"
      case "overdue":
        return reminderDate < today && r.status !== "completed"
      case "next7":
        const next7 = new Date(today)
        next7.setDate(next7.getDate() + 7)
        return reminderDate >= today && reminderDate <= next7 && r.status !== "completed"
      default:
        return r.status !== "completed"
    }
  })

  renderReminders(filtered)
}

function searchReminders(query) {
  const filtered = allReminders.filter(
    (r) =>
      r.patient.toLowerCase().includes(query.toLowerCase()) ||
      r.description.toLowerCase().includes(query.toLowerCase()),
  )
  renderReminders(filtered)
}

function renderReminders(reminders) {
  const container = document.getElementById("remindersContainer")
  const countEl = document.getElementById("reminderCount")

  if (!container) return

  countEl.textContent = `${reminders.length} lembrete${reminders.length !== 1 ? "s" : ""}`

  if (reminders.length === 0) {
    container.innerHTML =
      '<div class="empty-state"><div class="empty-state-icon">📭</div><p>Nenhum lembrete encontrado</p></div>'
    return
  }

  container.innerHTML = reminders
    .map(
      (r) => `
        <div class="reminder-card">
            <div class="reminder-header">
                <div>
                    <div class="reminder-patient">${r.patient}</div>
                    <div class="reminder-phone">${r.phone}</div>
                </div>
                <span class="reminder-status status-${r.status}">
                    ${r.status === "pending" ? "A realizar" : r.status === "completed" ? "Realizado" : "Atrasado"}
                </span>
            </div>
            <div class="reminder-info">
                <div class="reminder-type">${r.type}</div>
                <div class="reminder-date">${formatDate(r.date)}</div>
                <div class="mt-2 text-muted" style="font-size: 0.9rem;">${r.description}</div>
            </div>
            <div class="reminder-actions">
                <button class="btn btn-sm btn-success" onclick="markCompleted(${r.id})">Marcar realizado</button>
                <button class="btn btn-sm btn-outline-secondary" onclick="reschedule(${r.id})">Reagendar</button>
                <a href="paciente-detalhe.html?id=${r.patientId}" class="btn btn-sm btn-outline-primary">Ver detalhes</a>
            </div>
        </div>
    `,
    )
    .join("")
}

function markCompleted(id) {
  const reminder = allReminders.find((r) => r.id === id)
  if (reminder) {
    reminder.status = "completed"
    filterReminders(currentFilter)
  }
}

function reschedule(id) {
  const newDate = prompt("Nova data (AAAA-MM-DD):")
  if (newDate) {
    const reminder = allReminders.find((r) => r.id === id)
    if (reminder) {
      reminder.date = newDate
      filterReminders(currentFilter)
    }
  }
}

// Calendar Functions
let currentDate = new Date()

function initCalendar() {
  renderCalendar()

  document.getElementById("prevMonth")?.addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() - 1)
    renderCalendar()
  })

  document.getElementById("nextMonth")?.addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() + 1)
    renderCalendar()
  })

  document.getElementById("todayBtn")?.addEventListener("click", () => {
    currentDate = new Date()
    renderCalendar()
  })

  document.getElementById("viewMonth")?.addEventListener("click", () => {
    document.getElementById("viewMonth").classList.add("active")
    document.getElementById("viewList").classList.remove("active")
    document.getElementById("calendarMonth").classList.remove("d-none")
    document.getElementById("calendarList").classList.add("d-none")
  })

  document.getElementById("viewList")?.addEventListener("click", () => {
    document.getElementById("viewList").classList.add("active")
    document.getElementById("viewMonth").classList.remove("active")
    document.getElementById("calendarMonth").classList.add("d-none")
    document.getElementById("calendarList").classList.remove("d-none")
    renderListView()
  })
}

function renderCalendar() {
  const monthEl = document.getElementById("currentMonth")
  if (!monthEl) return

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  monthEl.textContent = new Date(year, month).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  const daysContainer = document.getElementById("calendarDays")
  if (!daysContainer) return

  let html = ""
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Previous month days
  for (let i = firstDay - 1; i >= 0; i--) {
    html += `<div class="calendar-day other-month"><div class="calendar-day-number">${daysInPrevMonth - i}</div></div>`
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day)
    date.setHours(0, 0, 0, 0)
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    const dayReminders = allReminders.filter((r) => r.date === dateStr)
    const isToday = date.getTime() === today.getTime()

    html += `
            <div class="calendar-day ${isToday ? "today" : ""}" onclick="showDayDetails('${dateStr}')">
                <div class="calendar-day-number">${day}</div>
                ${dayReminders.map(() => '<span class="calendar-reminder-dot"></span>').join("")}
            </div>
        `
  }

  // Next month days
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7
  const remainingCells = totalCells - (firstDay + daysInMonth)
  for (let i = 1; i <= remainingCells; i++) {
    html += `<div class="calendar-day other-month"><div class="calendar-day-number">${i}</div></div>`
  }

  daysContainer.innerHTML = html
}

function renderListView() {
  const container = document.getElementById("calendarList")
  if (!container) return

  const sorted = [...allReminders].sort((a, b) => new Date(a.date) - new Date(b.date))

  container.innerHTML = sorted
    .map(
      (r) => `
        <div class="calendar-list-item">
            <div class="d-flex justify-content-between">
                <div>
                    <strong>${r.patient}</strong>
                    <div class="text-muted" style="font-size: 0.9rem;">${r.description}</div>
                </div>
                <div class="text-end">
                    <div>${formatDate(r.date)}</div>
                    <span class="reminder-status status-${r.status} mt-1 d-inline-block">${r.status === "pending" ? "A realizar" : r.status === "completed" ? "Realizado" : "Atrasado"}</span>
                </div>
            </div>
        </div>
    `,
    )
    .join("")
}

function showDayDetails(dateStr) {
  const dayReminders = allReminders.filter((r) => r.date === dateStr)
  const modal = document.getElementById("dayDetailsModal")
  const modalDate = document.getElementById("modalDate")
  const modalReminders = document.getElementById("modalReminders")

  if (!modal) return

  modalDate.textContent = formatDate(dateStr)

  if (dayReminders.length === 0) {
    modalReminders.innerHTML = '<p class="text-muted">Nenhum lembrete para este dia</p>'
  } else {
    modalReminders.innerHTML = dayReminders
      .map(
        (r) => `
            <div class="mb-3 p-3" style="background: var(--light-bg); border-radius: 6px;">
                <strong>${r.patient}</strong>
                <div class="text-muted">${r.description}</div>
                <span class="reminder-status status-${r.status} mt-2 d-inline-block">${r.status === "pending" ? "A realizar" : r.status === "completed" ? "Realizado" : "Atrasado"}</span>
            </div>
        `,
      )
      .join("")
  }

  modal.classList.remove("d-none")
}

function closeDayDetails() {
  const modal = document.getElementById("dayDetailsModal")
  if (modal) modal.classList.add("d-none")
}

// Patients Functions
function loadPatients() {
  renderPatients(allPatients)
}

function searchPatients(query) {
  const filtered = allPatients.filter(
    (p) => p.name.toLowerCase().includes(query.toLowerCase()) || p.phone.includes(query),
  )
  renderPatients(filtered)
}

function renderPatients(patients) {
  const tbody = document.getElementById("patientsTable")
  if (!tbody) return

  tbody.innerHTML = patients
    .map((p) => {
      const patientReminders = allReminders.filter((r) => r.patientId === p.id && r.status !== "completed")
      const nextReminder = patientReminders.length > 0 ? patientReminders[0].date : "-"

      return `
            <tr>
                <td><strong>${p.name}</strong></td>
                <td>${p.phone}</td>
                <td>${formatDate(p.lastContact)}</td>
                <td>${patientReminders.length} lembrete${patientReminders.length !== 1 ? "s" : ""}</td>
                <td><a href="paciente-detalhe.html?id=${p.id}" class="btn btn-sm btn-outline-primary">Ver detalhes</a></td>
            </tr>
        `
    })
    .join("")
}

function saveNewPatient() {
  const name = document.getElementById("patientName").value
  const phone = document.getElementById("patientPhone").value

  if (name && phone) {
    const newPatient = {
      id: allPatients.length + 1,
      name,
      phone,
      lastContact: new Date().toISOString().split("T")[0],
      email: document.getElementById("patientEmail").value,
    }

    allPatients.push(newPatient)
    renderPatients(allPatients)

    const modal = window.bootstrap.Modal.getInstance(document.getElementById("newPatientModal"))
    modal.hide()
    document.getElementById("newPatientForm").reset()
  }
}

// Patient Detail Functions
function loadPatientDetails() {
  const params = new URLSearchParams(window.location.search)
  const patientId = Number.parseInt(params.get("id"))
  const patient = mockPatients.find((p) => p.id === patientId)

  if (!patient) return

  document.getElementById("patientName").textContent = patient.name
  document.getElementById("patientBreadcrumb").textContent = patient.name
  document.getElementById("patientContact").textContent = `${patient.phone} • ${patient.email}`

  // Timeline
  const timeline = document.getElementById("timelineContainer")
  timeline.innerHTML = `
        <div class="timeline-item">
            <div class="timeline-date">15 de janeiro de 2025</div>
            <div class="timeline-content">
                <strong>Retorno agendado</strong>
                <div class="text-muted mt-1">Avaliação de progresso</div>
            </div>
        </div>
        <div class="timeline-item">
            <div class="timeline-date">10 de janeiro de 2025</div>
            <div class="timeline-content">
                <strong>Consulta realizada</strong>
                <div class="text-muted mt-1">Primeira consulta - Anamnese completa</div>
            </div>
        </div>
    `

  // Retornos
  const retornos = document.getElementById("retornosContainer")
  const patientReminders = allReminders.filter((r) => r.patientId === patientId && r.type.includes("Retorno"))
  if (patientReminders.length === 0) {
    retornos.innerHTML = '<div class="empty-state"><p>Nenhum retorno agendado</p></div>'
  } else {
    retornos.innerHTML = patientReminders
      .map(
        (r) => `
            <div class="p-3 mb-3" style="background: var(--light-bg); border-radius: 6px;">
                <div class="d-flex justify-content-between">
                    <div>
                        <strong>${r.description}</strong>
                        <div class="text-muted">${formatDate(r.date)}</div>
                    </div>
                    <span class="reminder-status status-${r.status}">${r.status === "pending" ? "Agendado" : "Realizado"}</span>
                </div>
            </div>
        `,
      )
      .join("")
  }

  // Materiais
  const materiais = document.getElementById("materiaisEnviadosContainer")
  materiais.innerHTML = `
        <div class="p-3 mb-3" style="background: var(--light-bg); border-radius: 6px;">
            <strong>Ebook receitas fit</strong>
            <div class="text-muted">Enviado em 17 de janeiro de 2025</div>
        </div>
    `
}

function saveContact() {
  alert("Contato registrado com sucesso!")
  const modal = window.bootstrap.Modal.getInstance(document.getElementById("contactModal"))
  modal.hide()
}

function saveReminder() {
  alert("Lembrete criado com sucesso!")
  const modal = window.bootstrap.Modal.getInstance(document.getElementById("reminderModal"))
  modal.hide()
}

// Rules Functions
let currentGroupId = null
let currentStepId = null
let editingStep = false

function loadRuleGroups() {
  renderRuleGroups()
}

function renderRuleGroups() {
  const container = document.getElementById("ruleGroupsContainer")
  if (!container) return

  container.innerHTML = ruleGroups
    .map(
      (group) => `
        <div class="rule-group">
            <div class="rule-group-header">
                <h5>${group.name}</h5>
                <div>
                    <button class="btn btn-sm btn-outline-primary" onclick="addStep(${group.id})">Adicionar etapa</button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteRuleGroup(${group.id})">Excluir grupo</button>
                </div>
            </div>
            <div class="rule-steps" data-group-id="${group.id}">
                ${group.steps
                  .map(
                    (step, index) => `
                    <div class="rule-step" draggable="true" data-step-id="${step.id}" data-group-id="${group.id}">
                        <div class="rule-step-number">${index + 1}</div>
                        <div class="rule-step-content">
                            <div class="rule-step-info">
                                <div class="rule-step-days">${step.days} dias após ${index === 0 ? "consulta" : "etapa anterior"}</div>
                                <div class="rule-step-description">${step.description}</div>
                                <div class="rule-step-action">${getActionLabel(step.action)}</div>
                            </div>
                            <div class="rule-step-actions">
                                <button class="btn btn-sm btn-outline-secondary" onclick="editStep(${group.id}, ${step.id})">Editar</button>
                                <button class="btn btn-sm btn-outline-danger" onclick="deleteStep(${group.id}, ${step.id})">Remover</button>
                            </div>
                        </div>
                    </div>
                    ${index < group.steps.length - 1 ? '<div class="rule-arrow">↓</div>' : ""}
                `,
                  )
                  .join("")}
            </div>
        </div>
    `,
    )
    .join("")

  // Add drag and drop listeners
  document.querySelectorAll(".rule-step").forEach((step) => {
    step.addEventListener("dragstart", handleDragStart)
    step.addEventListener("dragover", handleDragOver)
    step.addEventListener("drop", handleDrop)
    step.addEventListener("dragend", handleDragEnd)
  })
}

let draggedElement = null

function handleDragStart(e) {
  draggedElement = this
  this.classList.add("dragging")
  e.dataTransfer.effectAllowed = "move"
}

function handleDragOver(e) {
  if (e.preventDefault) {
    e.preventDefault()
  }

  const groupId = this.dataset.groupId
  if (draggedElement && draggedElement.dataset.groupId === groupId) {
    this.classList.add("drag-over")
  }

  e.dataTransfer.dropEffect = "move"
  return false
}

function handleDrop(e) {
  if (e.stopPropagation) {
    e.stopPropagation()
  }

  if (draggedElement !== this && draggedElement.dataset.groupId === this.dataset.groupId) {
    const groupId = Number.parseInt(this.dataset.groupId)
    const draggedStepId = Number.parseInt(draggedElement.dataset.stepId)
    const targetStepId = Number.parseInt(this.dataset.stepId)

    const group = ruleGroups.find((g) => g.id === groupId)
    const draggedIndex = group.steps.findIndex((s) => s.id === draggedStepId)
    const targetIndex = group.steps.findIndex((s) => s.id === targetStepId)

    // Reorder steps
    const [removed] = group.steps.splice(draggedIndex, 1)
    group.steps.splice(targetIndex, 0, removed)

    renderRuleGroups()
  }

  return false
}

function handleDragEnd(e) {
  this.classList.remove("dragging")
  document.querySelectorAll(".rule-step").forEach((step) => {
    step.classList.remove("drag-over")
  })
}

function getActionLabel(action) {
  const labels = {
    enviar_material: "Enviar material educativo",
    lembrar_retorno: "Lembrar retorno",
    contato_telefone: "Contato telefônico",
  }
  return labels[action] || action
}

function addRuleGroup() {
  const name = prompt("Nome do novo grupo de regras:")
  if (name) {
    ruleGroups.push({
      id: ruleGroups.length + 1,
      name,
      steps: [],
    })
    renderRuleGroups()
  }
}

function deleteRuleGroup(groupId) {
  if (confirm("Deseja realmente excluir este grupo de regras?")) {
    ruleGroups = ruleGroups.filter((g) => g.id !== groupId)
    renderRuleGroups()
  }
}

function addStep(groupId) {
  currentGroupId = groupId
  currentStepId = null
  editingStep = false

  document.getElementById("stepModalTitle").textContent = "Adicionar Etapa"
  document.getElementById("stepDays").value = 7
  document.getElementById("stepAction").value = "enviar_material"
  document.getElementById("stepDescription").value = ""

  const modal = new window.bootstrap.Modal(document.getElementById("stepModal"))
  modal.show()
}

function editStep(groupId, stepId) {
  currentGroupId = groupId
  currentStepId = stepId
  editingStep = true

  const group = ruleGroups.find((g) => g.id === groupId)
  const step = group.steps.find((s) => s.id === stepId)

  document.getElementById("stepModalTitle").textContent = "Editar Etapa"
  document.getElementById("stepDays").value = step.days
  document.getElementById("stepAction").value = step.action
  document.getElementById("stepDescription").value = step.description

  const modal = new window.bootstrap.Modal(document.getElementById("stepModal"))
  modal.show()
}

function saveStep() {
  const days = Number.parseInt(document.getElementById("stepDays").value)
  const action = document.getElementById("stepAction").value
  const description = document.getElementById("stepDescription").value

  if (!description) {
    alert("Preencha a descrição da etapa")
    return
  }

  const group = ruleGroups.find((g) => g.id === currentGroupId)

  if (editingStep) {
    const step = group.steps.find((s) => s.id === currentStepId)
    step.days = days
    step.action = action
    step.description = description
  } else {
    group.steps.push({
      id: Date.now(),
      days,
      action,
      description,
    })
  }

  renderRuleGroups()

  const modal = window.bootstrap.Modal.getInstance(document.getElementById("stepModal"))
  modal.hide()
}

function deleteStep(groupId, stepId) {
  if (confirm("Deseja realmente remover esta etapa?")) {
    const group = ruleGroups.find((g) => g.id === groupId)
    group.steps = group.steps.filter((s) => s.id !== stepId)
    renderRuleGroups()
  }
}

function simulateReminders() {
  const totalSteps = ruleGroups.reduce((sum, g) => sum + g.steps.length, 0)
  alert(
    `Simulação concluída!\n\n${totalSteps} novos lembretes seriam gerados com base nas regras configuradas.\n\nOs lembretes aparecerão no dashboard após consultas futuras.`,
  )
}

// Materials Functions
function loadMaterials() {
  renderMaterials()
}

function renderMaterials() {
  const container = document.getElementById("materialsContainer")
  if (!container) return

  container.innerHTML = allMaterials
    .map(
      (m) => `
        <div class="col-md-6 col-lg-4">
            <div class="material-card">
                <div class="material-header">
                    <div>
                        <div class="material-title">${m.title}</div>
                        <span class="material-type">${m.type.toUpperCase()}</span>
                    </div>
                </div>
                <div class="material-description">${m.description}</div>
                <div class="d-flex gap-2">
                    <a href="${m.link}" class="btn btn-sm btn-outline-primary">Ver material</a>
                    <button class="btn btn-sm btn-outline-secondary" onclick="editMaterial(${m.id})">Editar</button>
                </div>
            </div>
        </div>
    `,
    )
    .join("")
}

function saveMaterial() {
  const title = document.getElementById("materialTitle").value
  const type = document.getElementById("materialType").value
  const description = document.getElementById("materialDescription").value
  const link = document.getElementById("materialLink").value

  if (title && description) {
    allMaterials.push({
      id: allMaterials.length + 1,
      title,
      type,
      description,
      link: link || "#",
    })

    renderMaterials()

    const modal = window.bootstrap.Modal.getInstance(document.getElementById("materialModal"))
    modal.hide()
    document.getElementById("materialForm").reset()
  }
}

function editMaterial(id) {
  alert("Função de edição será implementada")
}

// Utility Functions
function formatDate(dateStr) {
  const date = new Date(dateStr)
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
}

// Declare bootstrap variable
window.bootstrap = window.bootstrap || {}
