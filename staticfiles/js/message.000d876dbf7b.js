// Toast notification system
export function showToast(message, type = "success") {
  const existingToast = document.querySelector(".custom-toast");
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement("div");
  toast.className = `custom-toast toast-${type}`;
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");

  const typeConfig = {
    success: {
      label: "Sucesso",
      hint: "Tudo certo!",
      icon: "check_circle",
    },
    error: {
      label: "Erro",
      hint: "Atenção necessária",
      icon: "error",
    },
    info: {
      label: "Info",
      hint: "Mensagem informativa",
      icon: "info",
    },
  };

  const { label, hint, icon } = typeConfig[type] || typeConfig.info;

  toast.innerHTML = `
    <div class="toast-sheen"></div>
    <div class="toast-icon">
      <span class="material-symbols-outlined">${icon}</span>
    </div>
    <div class="toast-content">
      <span class="toast-label">${label}</span>
      <span class="toast-message">${message}</span>
      <small>${hint}</small>
    </div>
    <button type="button" class="toast-close" aria-label="Fechar">
      <span class="material-symbols-outlined">close</span>
    </button>
    <span class="toast-progress"></span>
  `;

  const closeToast = () => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 280);
  };

  toast.querySelector(".toast-close")?.addEventListener("click", closeToast);

  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));

  setTimeout(closeToast, 4800);
}
