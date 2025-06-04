// Toast notification system
export function showToast(message, type = "success") {
  // Remove existing toast if any
  const existingToast = document.querySelector(".custom-toast")
  if (existingToast) {
    existingToast.remove()
  }

  // Create toast element
  const toast = document.createElement("div")
  toast.className = `custom-toast toast-${type}`

  const icon = type === "success" ? "bi-check-circle-fill" : "bi-exclamation-triangle-fill"
  const iconColor = type === "success" ? "text-success" : "text-danger"

  toast.innerHTML = `
    <div class="toast-content">
      <i class="bi ${icon} ${iconColor} me-2"></i>
      <span>${message}</span>
    </div>
    <button type="button" class="toast-close" onclick="this.parentElement.remove()">
      <i class="bi bi-x"></i>
    </button>
  `

  // Add to body
  document.body.appendChild(toast)

  // Show toast with animation
  setTimeout(() => toast.classList.add("show"), 100)

  // Auto remove after 5 seconds
  setTimeout(() => {
    if (toast.parentElement) {
      toast.classList.remove("show")
      setTimeout(() => toast.remove(), 300)
    }
  }, 5000)
}