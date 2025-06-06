import { showToast } from './message.js';

document.addEventListener('DOMContentLoaded', () => {
  listarPacientes();
  atualizarCards();
});

function listarPacientes() {
  fetch('/api/pacientes/')
    .then(response => response.json())
    .then(data => {
      const lista = data.pacientes;
      const container = document.getElementById('patients-container');
      const count = document.getElementById('patient-count');
      const listSection = document.getElementById('patients-list');
      const emptyState = document.getElementById('empty-state');

      container.innerHTML = ''; // Limpa o container antes de renderizar

      if (lista.length === 0) {
        emptyState.classList.remove('d-none');
        listSection.classList.add('d-none');
      } else {
        emptyState.classList.add('d-none');
        listSection.classList.remove('d-none');
        count.textContent = lista.length;

        lista.forEach(paciente => {
          
          const card = renderizarCardPaciente(paciente);
          container.appendChild(card);
  
        });
      }
    })
    .catch(err => {
      showToast('Erro ao carregar pacientes', 'error');
    });
}

export function renderizarCardPaciente(paciente) {
  const ultimaRaw = paciente.ultima_consulta;
  const proximoRaw = paciente.proximo_lembrete;
  const textoLembrete = paciente.texto_lembrete;

  const ultima = ultimaRaw ? new Date(ultimaRaw + 'T00:00:00') : null;
  const proximo = proximoRaw ? new Date(proximoRaw + 'T00:00:00') : null;

  const diasAtras = ultima
    ? Math.floor((new Date() - ultima) / (1000 * 60 * 60 * 24))
    : null;

  const diasParaProximo = proximo
    ? Math.ceil((proximo - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  const atrasado = diasParaProximo !== null && diasParaProximo < 0;

  const ultimaStr = ultima ? ultima.toISOString().split('T')[0] : '---';
  const proximoStr = proximo ? proximo.toISOString().split('T')[0] : '---';
  const diasAtrasStr = diasAtras !== null ? `${diasAtras} dias atrás` : '---';

  const badgeClass = atrasado ? 'badge-overdue' : 'badge-waiting';
  const badgeText = atrasado
    ? `Atrasado ${Math.abs(diasParaProximo)} dias`
    : `Próximo contato em ${diasParaProximo} dias`;

  const card = document.createElement('div');
  card.className = 'card patient-card mb-3' + (atrasado ? ' alert-active' : '');
  card.dataset.pacienteId = paciente.id;

  const header = document.createElement('div');
  header.className = 'card-header pb-3';

  const headerRow = document.createElement('div');
  headerRow.className = 'd-flex justify-content-between align-items-start';

  const headerLeft = document.createElement('div');
  headerLeft.className = 'flex-grow-1';

  const title = document.createElement('h5');
  title.className = 'card-title';
  title.textContent = paciente.nome;

  const infos = document.createElement('div');
  infos.className = 'd-flex flex-wrap gap-3 mt-2';

  infos.innerHTML = `
    <div class="patient-info"><i class="bi bi-calendar"></i> Última consulta: ${ultimaStr}</div>
    <div class="patient-info"><i class="bi bi-clock"></i> ${diasAtrasStr}</div>
    <div class="patient-info"><i class="bi bi-calendar text-primary"></i> Próximo: ${proximoStr}</div>
  `;

  const badge = document.createElement('span');
  badge.className = `badge ${badgeClass} ms-2`;
  badge.textContent = badgeText;

  headerLeft.appendChild(title);
  headerLeft.appendChild(infos);
  headerRow.appendChild(headerLeft);
  headerRow.appendChild(badge);
  header.appendChild(headerRow);
  card.appendChild(header);

  const body = document.createElement('div');
  body.className = 'card-body';

  const topRow = document.createElement('div');
  topRow.className = 'd-flex justify-content-between align-items-center mb-3';

  const contato = document.createElement('div');
  contato.className = 'whatsapp-contact d-flex gap-2 align-items-center text-secondary';

  // Garante que o telefone esteja em formato apenas números
  const telefoneLimpo = paciente.telefone?.replace(/\D/g, '');

  if (telefoneLimpo) {
    contato.innerHTML = `
      <a href="https://wa.me/55${telefoneLimpo}" target="_blank" class="text-success" style="text-decoration: none;">
        <i class="bi bi-whatsapp" style="font-size: 1.2rem;"></i>
      </a>
      <span>${paciente.telefone}</span>
    `;
  } else {
    contato.innerHTML = `<i class="bi bi-whatsapp"></i> ---`;
  }

  const botoesContainer = document.createElement('div');
  botoesContainer.className = 'd-flex gap-2';

  if (paciente.lembretes_ativos && paciente.proximo_lembrete) {
    const contactBtn = document.createElement('button');
    contactBtn.className = 'btn btn-sm btn-success';
    contactBtn.innerHTML = '<i class="bi bi-check-circle me-1"></i> Registrar Contato';
    contactBtn.addEventListener('click', () => openContactModal({
      id: paciente.id,
      name: paciente.nome,
      type: paciente.nome_lembrete?.toLowerCase().includes("primeiro") ? "first" : "followup"
    }));
    botoesContainer.appendChild(contactBtn);
  }

  const disableBtn = document.createElement('button');
  disableBtn.className = 'btn btn-sm btn-outline-secondary';
  disableBtn.innerHTML = '<i class="bi bi-bell-slash me-1"></i> Desabilitar';
  botoesContainer.appendChild(disableBtn);

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn btn-sm btn-outline-danger';
  deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
  botoesContainer.appendChild(deleteBtn);

  topRow.appendChild(contato);
  topRow.appendChild(botoesContainer);
  body.appendChild(topRow);

  if (atrasado) {
    const alertBox = document.createElement('div');
    alertBox.className = 'alert-box';
    alertBox.innerHTML = `
      <div class="d-flex gap-2">
        <i class="bi bi-exclamation-triangle text-warning mt-1"></i>
        <div>
          <p class="alert-title">${paciente.nome_lembrete || 'Lembrete Pendente'}</p>
          <p class="alert-text">${paciente.texto_lembrete || '---'}</p>
          <p class="alert-overdue">⚠️ Contato em atraso há ${Math.abs(diasParaProximo)} dias</p>
        </div>
      </div>
    `;
    body.appendChild(alertBox);
  }

  card.appendChild(body);
  return card;
}

const contactModal = new bootstrap.Modal(document.getElementById('contactModal'));
const contactPatientNameEl = document.getElementById('contact-patient-name');
const contactPatientIdEl = document.getElementById('contact-patient-id');
const contactTypeBadgeEl = document.getElementById('contact-type-badge');
const contactTypeEl = document.getElementById('contact-type');
const materialsContainer = document.getElementById('materials-container');

function getContactStatus(patient) {
  return {
    type: patient.nome_lembrete?.toLowerCase().includes("primeiro") ? "first" : "followup"
  };
}

function openContactModal(patient) {
  contactPatientNameEl.textContent = patient.name;
  contactPatientIdEl.value = patient.id;

  const status = getContactStatus(patient);
  contactTypeEl.value = status.type;

  document.getElementById("contact-notes").value = "";
  // materialsContainer.innerHTML = "";

  contactModal.show();
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('patient-form');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    const nome = document.getElementById('name').value.trim();
    const telefone = document.getElementById('phone').value.trim();
    const dataConsulta = document.getElementById('lastConsultation').value;

    const hoje = new Date();

    if (new Date(dataConsulta) > hoje) {
      showToast('A data da última consulta não pode ser no futuro.', 'error');
      submitBtn.disabled = false;
      return;
    } 

    const payload = {
      nome: nome,
      telefone: telefone,
      data_ultima_consulta: dataConsulta,
    };

    try {
      const response = await fetch('/api/pacientes/novo/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCookie('csrftoken'),
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok) {
        // Fecha modal, limpa formulário e recarrega lista
        const modalInstance = bootstrap.Modal.getInstance(document.getElementById('newPatientModal')) 
                            || new bootstrap.Modal(document.getElementById('newPatientModal'));
        modalInstance.hide();
        form.reset();
        
        listarPacientes();
        
        showToast(result.mensagem, 'success');

      } else {
        alert(result.erro || 'Erro ao cadastrar paciente.');
      }
    } catch (err) {
      showToast('Erro inesperado ao cadastrar paciente.', 'error');
    } finally {
      submitBtn.disabled = false;
    }

  });

});

// Função para pegar o CSRF token do cookie
function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const trimmed = cookie.trim();
      if (trimmed.startsWith(name + '=')) {
        cookieValue = decodeURIComponent(trimmed.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("new-material")
  const suggestionsContainer = document.getElementById("material-suggestions")
  const selectedContainer = document.getElementById("selected-materials")
  const selectedMaterials = new Set()

  // Carrega sugestões
  fetch("/api/materiais/")
    .then((res) => res.json())
    .then((data) => {
      data.materiais.forEach((nome) => {
        const chip = document.createElement("div")
        chip.className = "material-chip"
        chip.textContent = nome
        chip.addEventListener("click", () => addMaterial(nome))
        suggestionsContainer.appendChild(chip)
      })
    })

  // Adiciona ao input visual
  function addMaterial(nome) {
    if (selectedMaterials.has(nome)) return

    selectedMaterials.add(nome)
    renderSelected()
  }

  // Renderiza os selecionados
  function renderSelected() {
    selectedContainer.innerHTML = ""
    selectedMaterials.forEach((nome) => {
      const pill = document.createElement("div")
      pill.className = "material-pill"
      pill.innerHTML = `${nome} <i class="bi bi-x-circle-fill" title="Remover"></i>`

      pill.querySelector("i").addEventListener("click", () => {
        selectedMaterials.delete(nome)
        renderSelected()
      })

      selectedContainer.appendChild(pill)
    })
  }
})

function atualizarCards() {

  const cardTotalPatientes = document.getElementById('total-patients');
  const cardTotalLembretes = document.getElementById('active-alerts');
  const cardLembreteAtrasado = document.getElementById('lembrete-atrasado');

  fetch('/api/cards-home/')
    .then(response => response.json())
    .then(data => {
      cardTotalPatientes.textContent = data.total_pacientes;
      cardTotalLembretes.textContent = data.alertas_ativos;
      cardLembreteAtrasado.textContent = data.lembretes_atrasados;
    })
    .catch(err => {
      showToast('Erro ao carregar estatísticas', 'error');
    });


}