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

  let badgeClass, badgeText;

  if (!paciente.paciente_ativo) {
    badgeClass = 'badge-warning';
    badgeText = 'Paciente desativado';
  } else if (!paciente.lembretes_ativos) {
    badgeClass = 'badge-warning';
    badgeText = 'Habilite lembretes';
  } else if (atrasado) {
    badgeClass = 'badge-overdue';
    badgeText = `Atrasado ${Math.abs(diasParaProximo)} dias`;
  } else {
    badgeClass = 'badge-waiting';
    badgeText = `Próximo contato em ${diasParaProximo} dias`;
  }

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
  contato.className = 'text-decoration-none'; // Garante que o link não tenha sublinhado

  // Garante que o telefone esteja em formato apenas números
  const telefoneLimpo = paciente.telefone?.replace(/\D/g, '');

  if (telefoneLimpo) {
    contato.innerHTML = `
      <a href="https://wa.me/55${telefoneLimpo}" target="_blank" class="whatsapp-contact d-flex gap-2 align-items-center text-success text-decoration-none">
        <i class="bi bi-whatsapp" style="font-size: 1.2rem;"></i>
        <span>${paciente.telefone}</span>
      </a>
    `;
  } else {
    contato.innerHTML = `<i class="bi bi-whatsapp"></i> ---`;
  }

  const botoesContainer = document.createElement('div');
  botoesContainer.className = 'd-flex gap-2';

  const togglePatientBtn = document.createElement('button');
  togglePatientBtn.className = paciente.paciente_ativo
    ? 'btn btn-sm btn-disable-paciente'
    : 'btn btn-sm btn-enable-paciente';

  if (paciente.paciente_ativo) {

    if (paciente.lembretes_ativos) {
      const contactBtn = document.createElement('button');
      contactBtn.className = 'btn btn-sm btn-success';
      contactBtn.innerHTML = '<i class="bi bi-check-circle me-1"></i> Registrar Contato';
      contactBtn.addEventListener('click', () => openContactModal({
        id: paciente.id,
        name: paciente.nome,
        type: paciente.nome_lembrete
      }));
      botoesContainer.appendChild(contactBtn);

      const disableBtn = document.createElement('button');
      disableBtn.className = 'btn btn-sm btn-disable-reminder';
      disableBtn.addEventListener('click', () => openDisableLembreteModal({
          id: paciente.id,
          name: paciente.nome,
      }));
      botoesContainer.appendChild(disableBtn);
    } else {

      const enableBtn = document.createElement('button');
      enableBtn.className = 'btn btn-sm btn-enable-reminder';
      enableBtn.innerHTML = 'Habilitar';
      enableBtn.addEventListener('click', () => openEnableLembreteModal({
          id: paciente.id,
          name: paciente.nome,
      }));

      botoesContainer.appendChild(enableBtn);
    }

    const contactBtn = document.createElement('button');
    contactBtn.className = 'btn btn-sm btn-registrar-consulta';
    contactBtn.innerHTML = '<i class="bi bi-calendar-check me-1"></i> Registrar Consulta';
    contactBtn.addEventListener('click', () => openRegistrarConsultaModal({
      id: paciente.id,
      name: paciente.nome,
    }));
    botoesContainer.appendChild(contactBtn);

    togglePatientBtn.innerHTML = 'Desativar paciente';
    togglePatientBtn.title = 'Desativar paciente';
  } else {
    togglePatientBtn.innerHTML = 'Reativar paciente';
    togglePatientBtn.title = 'Ativar paciente';
  }

  togglePatientBtn.addEventListener('click', () => {
    if (paciente.paciente_ativo) {
      openDeactivatePatientModal({
        id: paciente.id,
        name: paciente.nome,
      });
    } else {
      openActivatePatientModal({
        id: paciente.id,
        name: paciente.nome,
      });
    }
  });

  botoesContainer.appendChild(togglePatientBtn);

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

function openContactModal(patient) {
  contactPatientNameEl.textContent = patient.name;
  contactPatientIdEl.value = patient.id;

  contactModal.show();
}

function openDisableLembreteModal(patient) {

  const disableLembreteModal = new bootstrap.Modal(document.getElementById('desabilitarLembrete'));
  const nomePaciente = document.getElementById('patient-name-disable');
  const idPaciente = document.getElementById('disable-patient-id');

  nomePaciente.textContent = patient.name;
  idPaciente.value = patient.id;

  disableLembreteModal.show();
}

function openRegistrarConsultaModal(patient) {

  const disableLembreteModal = new bootstrap.Modal(document.getElementById('registrarConsultaModal'));
  const nomePaciente = document.getElementById('consulta-patient-name');
  const idPaciente = document.getElementById('consulta-patient-id');

  nomePaciente.textContent = patient.name;
  idPaciente.value = patient.id;

  disableLembreteModal.show();
}

function openEnableLembreteModal(patient) {

  const enableLembreteModal = new bootstrap.Modal(document.getElementById('habilitarLembrete'));
  const nomePaciente = document.getElementById('patient-name-enable');
  const idPaciente = document.getElementById('enable-patient-id');

  nomePaciente.textContent = patient.name;
  idPaciente.value = patient.id;

  enableLembreteModal.show();
}

function openDeactivatePatientModal(patient) {

  const deactivatePatientModal = new bootstrap.Modal(document.getElementById('desativarPacienteModal'));
  const nomePaciente = document.getElementById('patient-name-deactivate');
  const idPaciente = document.getElementById('deactivate-patient-id');

  nomePaciente.textContent = patient.name;
  idPaciente.value = patient.id;

  deactivatePatientModal.show();
}

function openActivatePatientModal(patient) {

  const reativarPatientModal = new bootstrap.Modal(document.getElementById('reativarPacienteModal'));
  const nomePaciente = document.getElementById('patient-name-reactivate');
  const idPaciente = document.getElementById('reactivate-patient-id');

  nomePaciente.textContent = patient.name;
  idPaciente.value = patient.id;

  reativarPatientModal.show();
}

// ao clicar no botão registrar-contato deve enviar uma requisição post para o servidor
document.getElementById('btn-registrar-consulta').addEventListener('click', async () => {
  
  const idPaciente = document.getElementById('consulta-patient-id').value;
  const tipoConsulta = document.getElementById('consulta-tipo').value;
  const dataConsulta = document.getElementById('consulta-data').value;
  const submitBtn = document.getElementById('btn-registrar-consulta');

  submitBtn.disabled = true;

  try {
    const response = await fetch(`/api/registrar-consulta-retorno/${idPaciente}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCookie('csrftoken'),
      },
      body: JSON.stringify({
        tipoConsulta: tipoConsulta,
        dataConsulta: dataConsulta
      }),
    });

    const result = await response.json();

    if (response.ok) {
      const modalInstance = bootstrap.Modal.getInstance(document.getElementById('registrarConsultaModal'));
      modalInstance?.hide();
      listarPacientes();
      showToast(result.mensagem, 'success');
    } else {
      showToast(result.erro || 'Erro ao registrar consulta.', 'error');
    }
  } catch (err) {
    showToast('Erro inesperado ao registrar consulta.', 'error');
  } finally {
    submitBtn.disabled = false;
  }
});

// ao clicar no botão confirm-reactivate-patient deve enviar uma requisição post para o servidor
document.getElementById('confirm-reactivate-patient').addEventListener('click', async () => {
  const idPaciente = document.getElementById('reactivate-patient-id').value;
  const submitBtn = document.getElementById('confirm-reactivate-patient');
  submitBtn.disabled = true;

  try {
    const response = await fetch(`/api/status-paciente/${idPaciente}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCookie('csrftoken'),
      },
      body: JSON.stringify({ estado: 'habilitar' }),
    });

    const result = await response.json();

    if (response.ok) {
      const modalInstance = bootstrap.Modal.getInstance(document.getElementById('reativarPacienteModal'));
      modalInstance?.hide();
      listarPacientes();
      showToast(result.mensagem, 'success');
    } else {
      showToast(result.erro || 'Erro ao desativar paciente.', 'error');
    }
  } catch (err) {
    showToast('Erro inesperado ao desativar paciente.', 'error');
  } finally {
    submitBtn.disabled = false;
  }
});

// ao clicar no botão confirm-deactivate-patient deve enviar uma requisição post para o servidor
document.getElementById('confirm-deactivate-patient').addEventListener('click', async () => {
  const idPaciente = document.getElementById('deactivate-patient-id').value;
  const submitBtn = document.getElementById('confirm-deactivate-patient');
  submitBtn.disabled = true;

  try {
    const response = await fetch(`/api/status-paciente/${idPaciente}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCookie('csrftoken'),
      },
      body: JSON.stringify({ estado: 'desabilitar' }),
    });

    const result = await response.json();

    if (response.ok) {
      const modalInstance = bootstrap.Modal.getInstance(document.getElementById('desativarPacienteModal'));
      modalInstance?.hide();
      listarPacientes();
      showToast(result.mensagem, 'success');
    } else {
      showToast(result.erro || 'Erro ao desativar paciente.', 'error');
    }
  } catch (err) {
    showToast('Erro inesperado ao desativar paciente.', 'error');
  } finally {
    submitBtn.disabled = false;
  }
});

// ao clicar no botão confirm-disable-reminder deve enviar uma requisição post para o servidor
document.getElementById('confirm-disable-reminder').addEventListener('click', async () => {
  const idPaciente = document.getElementById('disable-patient-id').value;
  const submitBtn = document.getElementById('confirm-disable-reminder');
  submitBtn.disabled = true;

  try {
    const response = await fetch(`/api/status-lembrete/${idPaciente}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCookie('csrftoken'),
      },
      body: JSON.stringify({ estado: 'desabilitar' }),
    });

    const result = await response.json();

    if (response.ok) {
      const modalInstance = bootstrap.Modal.getInstance(document.getElementById('desabilitarLembrete'));
      modalInstance?.hide();
      listarPacientes();
      showToast(result.mensagem, 'success');
    } else {
      showToast(result.erro || 'Erro ao desabilitar lembrete.', 'error');
    }
  } catch (err) {
    showToast('Erro inesperado ao desabilitar lembrete.', 'error');
  } finally {
    submitBtn.disabled = false;
  }
});

// ao clicar no botão confirm-enable-reminder deve enviar uma requisição post para o servidor
document.getElementById('confirm-enable-reminder').addEventListener('click', async () => {
  const idPaciente = document.getElementById('enable-patient-id').value;
  const submitBtn = document.getElementById('confirm-enable-reminder');
  submitBtn.disabled = true;

  try {
    const response = await fetch(`/api/status-lembrete/${idPaciente}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCookie('csrftoken'),
      },
      body: JSON.stringify({ estado: 'habilitar' }),
    });

    const result = await response.json();

    if (response.ok) {
      const modalInstance = bootstrap.Modal.getInstance(document.getElementById('habilitarLembrete'));
      modalInstance?.hide();
      listarPacientes();
      showToast(result.mensagem, 'success');
    } else {
      showToast(result.erro || 'Erro ao habilitar lembrete.', 'error');
    }
  } catch (err) {
    showToast('Erro inesperado ao habilitar lembrete.', 'error');
  } finally {
    submitBtn.disabled = false;
  }
});

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

        const modalAtribuirGrupoEl = document.getElementById('atribuirGrupoModal');
        const modalAtribuirGrupo = bootstrap.Modal.getInstance(modalAtribuirGrupoEl) || new bootstrap.Modal(modalAtribuirGrupoEl);
        
        carregarGrupoRegras();

        document.getElementById('paciente-id').value = result.id_paciente;

        modalAtribuirGrupo.show();

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

document.getElementById('atribuir-grupo-form').addEventListener('submit', function (e) {
  e.preventDefault();

  const grupoId = document.getElementById('grupo-select').value;
  const pacienteId = document.getElementById('paciente-id').value;

  const modalAtribuirGrupoModalEl = document.getElementById('atribuirGrupoModal');
  const modalAtribuirGrupoModal = bootstrap.Modal.getInstance(modalAtribuirGrupoModalEl) || new bootstrap.Modal(modalAtribuirGrupoModalEl);

  fetch(`/api/atribuir-grupo/${grupoId}/${pacienteId}/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCookie('csrftoken')
    },
    body: {}
  })
    .then(res => res.json())
    .then(() => {
      document.getElementById('atribuir-grupo-form').reset();

      modalAtribuirGrupoModal.hide(); // Vai disparar o evento e reabrir o antigo

      // Atualiza apenas o card do paciente
      fetch(`/api/paciente/${pacienteId}/`)
      .then(res => res.json())
      .then(updated => {
          
          const container = document.getElementById('patients-container');
          const oldCard = container.querySelector(`[data-paciente-id="${updated.id}"]`);
          const newCard = renderizarCardPaciente(updated);

          if (oldCard) {
              container.replaceChild(newCard, oldCard);
          }
      });

      showToast('Sucesso!', 'success');
    });
});

function carregarGrupoRegras() {
  fetch('/api/grupo-regras/')
    .then(res => res.json())
    .then(data => {
      
      const selectGrupo = document.getElementById('grupo-select');
        
      if (!data.grupos || data.grupos.length === 0) {
        selectGrupo.innerHTML = '';
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Crie grupo de regras';
        option.disabled = true;
        option.selected = true;
        selectGrupo.appendChild(option);
        return;
      }

      // Preenche o <select> dropdown (se existir)
      const grupoSelect = document.getElementById('grupo-select');
      if (grupoSelect) {
        grupoSelect.innerHTML = '';
        data.grupos.forEach(grupo => {
          const option = document.createElement('option');
          option.value = grupo.id;
          option.textContent = grupo.nome;
          grupoSelect.appendChild(option);
        });
      }

    })
    .catch(err => console.error('Erro ao carregar grupos de regras:', err));
}

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