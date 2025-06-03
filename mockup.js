// Data model
let patients = []
const STORAGE_KEY = "nutri-patients"

// DOM Elements
const patientsContainer = document.getElementById("patients-container")
const emptyState = document.getElementById("empty-state")
const patientsList = document.getElementById("patients-list")
const patientForm = document.getElementById("patient-form")
const contactForm = document.getElementById("contact-form")
const totalPatientsEl = document.getElementById("total-patients")
const activeAlertsEl = document.getElementById("active-alerts")
const activePatientsEl = document.getElementById("active-patients")
const avgDaysEl = document.getElementById("avg-days")
const patientCountEl = document.getElementById("patient-count")
const contactPatientNameEl = document.getElementById("contact-patient-name")
const contactPatientIdEl = document.getElementById("contact-patient-id")
const contactTypeEl = document.getElementById("contact-type")
const contactTypeBadgeEl = document.getElementById("contact-type-badge")
const deletePatientNameEl = document.getElementById("delete-patient-name")
const confirmDeleteBtn = document.getElementById("confirm-delete")
const addMaterialBtn = document.getElementById("add-material-btn")
const newMaterialInput = document.getElementById("new-material")
const materialsContainer = document.getElementById("materials-container")

// Bootstrap Modals
const bootstrap = window.bootstrap // Declare the bootstrap variable
const newPatientModal = new bootstrap.Modal(document.getElementById("newPatientModal"))
const contactModal = new bootstrap.Modal(document.getElementById("contactModal"))
const deleteModal = new bootstrap.Modal(document.getElementById("deleteModal"))

// Load patients from localStorage
function loadPatients() {
  const savedPatients = localStorage.getItem(STORAGE_KEY)
  if (savedPatients) {
    patients = JSON.parse(savedPatients)
    renderPatients()
    updateStats()
  }
}

// Save patients to localStorage
function savePatients() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(patients))
  updateStats()
}

// Format date to DD/MM/YYYY
function formatDate(dateString) {
  const date = new Date(dateString)
  return date.toLocaleDateString("pt-BR")
}

// Calculate days since a date
function getDaysSince(dateString) {
  const date = new Date(dateString)
  const now = new Date()
  const diffTime = now.getTime() - date.getTime()
  return Math.floor(diffTime / (1000 * 60 * 60 * 24))
}

// Calculate next contact date
function calculateNextContact(patient) {
  const lastConsultation = new Date(patient.lastConsultation)

  if (!patient.firstContactDone) {
    // First contact after 7 days from consultation
    const firstContact = new Date(lastConsultation)
    firstContact.setDate(firstContact.getDate() + 7)
    return firstContact
  } else {
    // Follow-up every 15 days after last contact
    const lastContact = patient.lastContactDate ? new Date(patient.lastContactDate) : lastConsultation
    const nextContact = new Date(lastContact)
    nextContact.setDate(nextContact.getDate() + 15)
    return nextContact
  }
}

// Get contact status for a patient
function getContactStatus(patient) {
  if (!patient.alertsEnabled) {
    return {
      needsContact: false,
      type: "first",
      daysUntilNext: 0,
      isOverdue: false,
      daysOverdue: 0,
    }
  }

  const now = new Date()
  const nextContactDate = calculateNextContact(patient)
  const diffTime = nextContactDate.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  const needsContact = diffDays <= 0
  const isOverdue = diffDays < 0
  const daysOverdue = isOverdue ? Math.abs(diffDays) : 0
  const daysUntilNext = diffDays > 0 ? diffDays : 0

  return {
    needsContact,
    type: patient.firstContactDone ? "followup" : "first",
    daysUntilNext,
    isOverdue,
    daysOverdue,
  }
}

// Sort patients by priority
function sortPatientsByPriority(patientsList) {
  return [...patientsList].sort((a, b) => {
    const statusA = getContactStatus(a)
    const statusB = getContactStatus(b)

    // Disabled alerts go to the end
    if (!a.alertsEnabled && b.alertsEnabled) return 1
    if (a.alertsEnabled && !b.alertsEnabled) return -1
    if (!a.alertsEnabled && !b.alertsEnabled) return 0

    // Overdue contacts first (most overdue first)
    if (statusA.isOverdue && !statusB.isOverdue) return -1
    if (!statusA.isOverdue && statusB.isOverdue) return 1
    if (statusA.isOverdue && statusB.isOverdue) {
      return statusB.daysOverdue - statusA.daysOverdue
    }

    // Contacts needed today
    if (statusA.needsContact && !statusB.needsContact) return -1
    if (!statusA.needsContact && statusB.needsContact) return 1

    // Sort by days until next contact (closest first)
    return statusA.daysUntilNext - statusB.daysUntilNext
  })
}

// Update statistics
function updateStats() {
  if (patients.length === 0) {
    emptyState.classList.remove("d-none")
    patientsList.classList.add("d-none")
    totalPatientsEl.textContent = "0"
    activeAlertsEl.textContent = "0"
    activePatientsEl.textContent = "0"
    avgDaysEl.textContent = "0"
    return
  }

  emptyState.classList.add("d-none")
  patientsList.classList.remove("d-none")

  // Count active alerts
  const activeAlerts = patients.filter((patient) => {
    if (!patient.alertsEnabled) return false
    const status = getContactStatus(patient)
    return status.needsContact
  }).length

  // Count active patients
  const activePatients = patients.filter((p) => p.alertsEnabled).length

  // Calculate average days since last consultation
  const avgDays =
    patients.length > 0
      ? Math.round(patients.reduce((acc, p) => acc + getDaysSince(p.lastConsultation), 0) / patients.length)
      : 0

  totalPatientsEl.textContent = patients.length
  activeAlertsEl.textContent = activeAlerts
  activePatientsEl.textContent = activePatients
  avgDaysEl.textContent = avgDays
  patientCountEl.textContent = patients.length
}

// Render all patients
function renderPatients() {
  patientsContainer.innerHTML = ""

  if (patients.length === 0) {
    updateStats()
    return
  }

  const sortedPatients = sortPatientsByPriority(patients)

  sortedPatients.forEach((patient) => {
    const patientCard = createPatientCard(patient)
    patientsContainer.appendChild(patientCard)
  })

  updateStats()
}

// Create a patient card element
function createPatientCard(patient) {
  const status = getContactStatus(patient)
  const daysSinceConsultation = getDaysSince(patient.lastConsultation)

  // Create card element
  const card = document.createElement("div")
  card.className = `card patient-card ${status.needsContact && patient.alertsEnabled ? "alert-active" : ""}`

  // Create card header
  const cardHeader = document.createElement("div")
  cardHeader.className = "card-header pb-3"

  const headerContent = document.createElement("div")
  headerContent.className = "d-flex justify-content-between align-items-start"

  // Patient name and dates
  const patientInfo = document.createElement("div")
  patientInfo.className = "flex-grow-1"

  const patientName = document.createElement("h5")
  patientName.className = "card-title"
  patientName.textContent = patient.name

  const consultationDates = document.createElement("div")
  consultationDates.className = "d-flex flex-wrap gap-3 mt-2"

  // Last consultation date
  const lastConsultation = document.createElement("div")
  lastConsultation.className = "patient-info"
  lastConsultation.innerHTML = `<i class="bi bi-calendar"></i> Última consulta: ${formatDate(patient.lastConsultation)}`

  // Days since consultation
  const daysSince = document.createElement("div")
  daysSince.className = "patient-info"
  daysSince.innerHTML = `<i class="bi bi-clock"></i> ${daysSinceConsultation} dias atrás`

  consultationDates.appendChild(lastConsultation)
  consultationDates.appendChild(daysSince)

  // Next consultation if available
  if (patient.nextConsultation) {
    const nextConsultation = document.createElement("div")
    nextConsultation.className = "patient-info"
    nextConsultation.innerHTML = `<i class="bi bi-calendar text-primary"></i> Próxima: ${formatDate(patient.nextConsultation)}`
    consultationDates.appendChild(nextConsultation)
  }

  patientInfo.appendChild(patientName)
  patientInfo.appendChild(consultationDates)

  // Last contact date if available
  if (patient.lastContactDate) {
    const lastContact = document.createElement("div")
    lastContact.className = "patient-info mt-1"
    lastContact.innerHTML = `<i class="bi bi-check-circle text-success"></i> Último contato: ${formatDate(patient.lastContactDate)}`
    patientInfo.appendChild(lastContact)
  }

  // Status badge
  const badgeClass = !patient.alertsEnabled
    ? "badge-disabled"
    : status.isOverdue
      ? "badge-overdue"
      : status.needsContact
        ? "badge-first-contact"
        : "badge-waiting"

  const badgeText = !patient.alertsEnabled
    ? "Alertas Desabilitados"
    : status.isOverdue
      ? `Atrasado ${status.daysOverdue} dias`
      : status.needsContact
        ? status.type === "first"
          ? "Primeiro Contato Pendente"
          : "Acompanhamento Pendente"
        : `Próximo contato em ${status.daysUntilNext} dias`

  const statusBadge = document.createElement("span")
  statusBadge.className = `badge ${badgeClass} ms-2`
  statusBadge.textContent = badgeText

  headerContent.appendChild(patientInfo)
  headerContent.appendChild(statusBadge)
  cardHeader.appendChild(headerContent)

  // Create card body
  const cardBody = document.createElement("div")
  cardBody.className = "card-body pt-0"

  // Contact info and action buttons
  const contactRow = document.createElement("div")
  contactRow.className = "d-flex justify-content-between align-items-center mb-3"

  const contactInfo = document.createElement("div")
  contactInfo.className = "d-flex gap-3 text-secondary"

  if (patient.email) {
    const emailInfo = document.createElement("div")
    emailInfo.className = "patient-info"
    emailInfo.innerHTML = `<i class="bi bi-envelope"></i> ${patient.email}`
    contactInfo.appendChild(emailInfo)
  }

  if (patient.phone) {
    const phoneInfo = document.createElement("div")
    phoneInfo.className = "patient-info"
    phoneInfo.innerHTML = `<i class="bi bi-telephone"></i> ${patient.phone}`
    contactInfo.appendChild(phoneInfo)
  }

  const actionButtons = document.createElement("div")
  actionButtons.className = "d-flex gap-2"

  // History button if there are contacts
  if (patient.contacts && patient.contacts.length > 0) {
    const historyBtn = document.createElement("button")
    historyBtn.className = "btn btn-sm btn-outline-secondary"
    historyBtn.innerHTML = `<i class="bi bi-file-text me-1"></i> Histórico (${patient.contacts.length})`
    historyBtn.addEventListener("click", () => toggleHistory(patient.id))
    actionButtons.appendChild(historyBtn)
  }

  // Register contact button
  if (status.needsContact && patient.alertsEnabled) {
    const contactBtn = document.createElement("button")
    contactBtn.className = "btn btn-sm btn-success"
    contactBtn.innerHTML = '<i class="bi bi-check-circle me-1"></i> Registrar Contato'
    contactBtn.addEventListener("click", () => openContactModal(patient))
    actionButtons.appendChild(contactBtn)
  }

  // Toggle alerts button
  const alertsBtn = document.createElement("button")
  alertsBtn.className = `btn btn-sm btn-outline-secondary ${!patient.alertsEnabled ? "bg-light" : ""}`
  alertsBtn.innerHTML = patient.alertsEnabled
    ? '<i class="bi bi-bell-slash me-1"></i> Desabilitar'
    : '<i class="bi bi-bell me-1"></i> Habilitar'
  alertsBtn.addEventListener("click", () => toggleAlerts(patient.id))
  actionButtons.appendChild(alertsBtn)

  // Delete button
  const deleteBtn = document.createElement("button")
  deleteBtn.className = "btn btn-sm btn-outline-danger"
  deleteBtn.innerHTML = '<i class="bi bi-trash"></i>'
  deleteBtn.addEventListener("click", () => openDeleteModal(patient))
  actionButtons.appendChild(deleteBtn)

  contactRow.appendChild(contactInfo)
  contactRow.appendChild(actionButtons)
  cardBody.appendChild(contactRow)

  // History section (hidden by default)
  if (patient.contacts && patient.contacts.length > 0) {
    const historySection = document.createElement("div")
    historySection.className = "history-section d-none mb-3 p-3 bg-light rounded border"
    historySection.id = `history-${patient.id}`

    const historyTitle = document.createElement("h6")
    historyTitle.className = "mb-2"
    historyTitle.textContent = "Histórico de Contatos"

    const historyContainer = document.createElement("div")
    historyContainer.className = "history-container"

    // Sort contacts by date (newest first)
    const sortedContacts = [...patient.contacts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    sortedContacts.forEach((contact) => {
      const historyItem = document.createElement("div")
      historyItem.className = "history-item"

      const historyHeader = document.createElement("div")
      historyHeader.className = "history-header"

      const contactTypeBadge = document.createElement("span")
      contactTypeBadge.className = `badge ${contact.type === "first" ? "badge-first-contact" : "badge-followup"} badge-sm`
      contactTypeBadge.textContent = contact.type === "first" ? "Primeiro Contato" : "Acompanhamento"

      const contactDate = document.createElement("span")
      contactDate.className = "history-date"
      contactDate.textContent = formatDate(contact.date)

      historyHeader.appendChild(contactTypeBadge)
      historyHeader.appendChild(contactDate)
      historyItem.appendChild(historyHeader)

      if (contact.notes) {
        const notes = document.createElement("p")
        notes.className = "history-notes mb-1"
        notes.textContent = contact.notes
        historyItem.appendChild(notes)
      }

      if (contact.materials && contact.materials.length > 0) {
        const materialsContainer = document.createElement("div")
        materialsContainer.className = "d-flex flex-wrap"

        contact.materials.forEach((material) => {
          const materialTag = document.createElement("span")
          materialTag.className = "material-tag"
          materialTag.textContent = material
          materialsContainer.appendChild(materialTag)
        })

        historyItem.appendChild(materialsContainer)
      }

      historyContainer.appendChild(historyItem)
    })

    historySection.appendChild(historyTitle)
    historySection.appendChild(historyContainer)
    cardBody.appendChild(historySection)
  }

  // Alert box for contacts needed
  if (status.needsContact && patient.alertsEnabled) {
    const alertBox = document.createElement("div")
    alertBox.className = "alert-box"

    const alertContent = document.createElement("div")
    alertContent.className = "d-flex gap-2"

    const alertIcon = document.createElement("i")
    alertIcon.className = "bi bi-exclamation-triangle text-warning mt-1"

    const alertTextContainer = document.createElement("div")

    const alertTitle = document.createElement("p")
    alertTitle.className = "alert-title"
    alertTitle.textContent = status.type === "first" ? "Primeiro Contato Pós-Consulta" : "Acompanhamento Necessário"

    const alertText = document.createElement("p")
    alertText.className = "alert-text"
    alertText.textContent =
      status.type === "first"
        ? "Envie materiais educativos, ebooks e faça o primeiro acompanhamento."
        : "Entre em contato para verificar como está o progresso do paciente."

    alertTextContainer.appendChild(alertTitle)
    alertTextContainer.appendChild(alertText)

    if (status.isOverdue) {
      const overdueText = document.createElement("p")
      overdueText.className = "alert-overdue"
      overdueText.innerHTML = `⚠️ Contato em atraso há ${status.daysOverdue} dias`
      alertTextContainer.appendChild(overdueText)
    }

    alertContent.appendChild(alertIcon)
    alertContent.appendChild(alertTextContainer)
    alertBox.appendChild(alertContent)

    cardBody.appendChild(alertBox)
  }

  card.appendChild(cardHeader)
  card.appendChild(cardBody)

  return card
}

// Toggle history section visibility
function toggleHistory(patientId) {
  const historySection = document.getElementById(`history-${patientId}`)
  if (historySection.classList.contains("d-none")) {
    historySection.classList.remove("d-none")
  } else {
    historySection.classList.add("d-none")
  }
}

// Open contact modal
function openContactModal(patient) {
  contactPatientNameEl.textContent = patient.name
  contactPatientIdEl.value = patient.id

  const status = getContactStatus(patient)
  contactTypeEl.value = status.type

  contactTypeBadgeEl.textContent = status.type === "first" ? "Primeiro Contato Pós-Consulta" : "Acompanhamento"
  contactTypeBadgeEl.className = `badge ${status.type === "first" ? "badge-first-contact" : "badge-followup"}`

  // Clear form
  document.getElementById("contact-notes").value = ""
  materialsContainer.innerHTML = ""

  contactModal.show()
}

// Open delete confirmation modal
function openDeleteModal(patient) {
  deletePatientNameEl.textContent = patient.name
  confirmDeleteBtn.onclick = () => {
    deletePatient(patient.id)
    deleteModal.hide()
  }
  deleteModal.show()
}

// Add a new patient
function addPatient(event) {
  event.preventDefault()

  const name = document.getElementById("name").value
  const email = document.getElementById("email").value
  const phone = document.getElementById("phone").value
  const lastConsultation = document.getElementById("lastConsultation").value
  const nextConsultation = document.getElementById("nextConsultation").value

  if (!name || !lastConsultation) {
    alert("Nome e data da última consulta são obrigatórios!")
    return
  }

  const newPatient = {
    id: Date.now().toString(),
    name,
    email,
    phone,
    lastConsultation,
    nextConsultation: nextConsultation || null,
    firstContactDone: false,
    alertsEnabled: true,
    createdAt: new Date().toISOString(),
    contacts: [],
  }

  patients.push(newPatient)
  savePatients()
  renderPatients()

  // Reset form and close modal
  patientForm.reset()
  newPatientModal.hide()
}

// Register a contact
function registerContact(event) {
  event.preventDefault()

  const patientId = contactPatientIdEl.value
  const contactType = contactTypeEl.value
  const notes = document.getElementById("contact-notes").value

  // Get materials from the container
  const materials = []
  const materialElements = materialsContainer.querySelectorAll(".material-badge")
  materialElements.forEach((el) => {
    materials.push(el.dataset.material)
  })

  // Find patient
  const patientIndex = patients.findIndex((p) => p.id === patientId)
  if (patientIndex === -1) return

  // Create new contact
  const newContact = {
    id: Date.now().toString(),
    date: new Date().toISOString(),
    type: contactType,
    notes,
    materials,
    createdAt: new Date().toISOString(),
  }

  // Update patient
  patients[patientIndex].firstContactDone = true
  patients[patientIndex].lastContactDate = new Date().toISOString()
  patients[patientIndex].contacts.push(newContact)

  savePatients()
  renderPatients()

  // Close modal
  contactModal.hide()
}

// Toggle alerts for a patient
function toggleAlerts(patientId) {
  const patientIndex = patients.findIndex((p) => p.id === patientId)
  if (patientIndex === -1) return

  patients[patientIndex].alertsEnabled = !patients[patientIndex].alertsEnabled

  savePatients()
  renderPatients()
}

// Delete a patient
function deletePatient(patientId) {
  patients = patients.filter((p) => p.id !== patientId)

  savePatients()
  renderPatients()
}

// Add material to the list
function addMaterial() {
  const material = newMaterialInput.value.trim()
  if (!material) return

  const materialBadge = document.createElement("span")
  materialBadge.className = "material-badge"
  materialBadge.dataset.material = material
  materialBadge.innerHTML = `
    ${material}
    <i class="bi bi-x remove-material"></i>
  `

  const removeBtn = materialBadge.querySelector(".remove-material")
  removeBtn.addEventListener("click", () => materialBadge.remove())

  materialsContainer.appendChild(materialBadge)
  newMaterialInput.value = ""
  newMaterialInput.focus()
}

// Handle material input keypress
function handleMaterialKeypress(event) {
  if (event.key === "Enter") {
    event.preventDefault()
    addMaterial()
  }
}

// Event Listeners
document.addEventListener("DOMContentLoaded", loadPatients)
patientForm.addEventListener("submit", addPatient)
contactForm.addEventListener("submit", registerContact)
addMaterialBtn.addEventListener("click", addMaterial)
newMaterialInput.addEventListener("keypress", handleMaterialKeypress)
