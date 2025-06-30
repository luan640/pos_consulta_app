import { showToast } from './message.js';

document.addEventListener('DOMContentLoaded', () => {
  listarPacientes();
  atualizarCards();
  inicializarSelecaoMateriais();
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

  // Ordena as consultas por id
  const consultasOrdenadas = paciente.consultas.sort((a, b) => b.id - a.id);

  // Pega a última consulta (a primeira do array ordenado)
  const ultimaConsulta = consultasOrdenadas[0];
  const tipoConsulta = ultimaConsulta?.tipo_consulta || 'consulta';
  const textoUltimo = tipoConsulta === 'retorno' ? 'Último' : 'Última';

  const ultimaRaw = ultimaConsulta?.data_consulta || paciente.ultima_consulta;
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
  } else if (!paciente.grupo_regra_atual) {
    badgeClass = 'badge-warning';
    badgeText = 'Atribua um grupo de regras';
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
    <div class="patient-info">
      <i class="bi bi-calendar"></i> 
      ${textoUltimo} ${tipoConsulta}: ${ultimaStr}
    </div>
    <div class="patient-info"><i class="bi bi-clock"></i> ${diasAtrasStr}</div>
    <div class="patient-info"><i class="bi bi-calendar text-primary"></i> Próximo: ${proximoStr}</div>
    <button class="btn btn-link p-0" id="btnAlterarGrupo" data-patient-id="${paciente.id}">
      <div class="patient-info">
          <i class="bi bi-people text-primary"></i>
        ${paciente.grupo_regra_atual || 'Atribuir grupo'}
      </div>
    </button>
  `;

  infos.addEventListener('click', function(e) {
    if (e.target.closest('#btnAlterarGrupo')) {
      openAtribuirGrupoModal(paciente.id);
    }
  });

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
  botoesContainer.className = 'action-buttons'; // container geral

  // Primary Actions container
  const primaryActions = document.createElement('div');
  primaryActions.className = 'primary-actions d-flex gap-2';

  // Secondary Actions container
  const secondaryActions = document.createElement('div');
  secondaryActions.className = 'secondary-actions d-flex gap-2';

  const togglePatientBtn = document.createElement('button');
  togglePatientBtn.className = paciente.paciente_ativo
    ? 'btn-icon btn-secondary'
    : 'btn-icon btn-success';

  if (paciente.paciente_ativo) {

    if (paciente.lembretes_ativos && paciente.grupo_regra_atual) {
      // Registrar Contato
      const contactBtn = document.createElement('button');
      contactBtn.className = 'btn-icon btn-success';
      contactBtn.setAttribute('data-tooltip', 'Registrar Contato');
      contactBtn.innerHTML = '<i class="bi bi-check-circle"></i>';
      contactBtn.addEventListener('click', () => openContactModal({
        id: paciente.id,
        name: paciente.nome,
        type: paciente.nome_lembrete
      }));
      primaryActions.appendChild(contactBtn);

      // Desativar Lembretes
      const disableBtn = document.createElement('button');
      disableBtn.className = 'btn-icon btn-warning';
      disableBtn.setAttribute('data-tooltip', 'Desativar Lembretes');
      disableBtn.innerHTML = '<i class="bi bi-bell-slash"></i>';
      disableBtn.addEventListener('click', () => openDisableLembreteModal({
        id: paciente.id,
        name: paciente.nome,
      }));
      secondaryActions.appendChild(disableBtn);
    } else if (paciente.grupo_regra_atual && !paciente.lembretes_ativos) {
      const enableBtn = document.createElement('button');
      enableBtn.setAttribute('data-tooltip', 'Reativar Lembretes');
      enableBtn.className = 'btn-icon btn-info';
      enableBtn.innerHTML = '<i class="bi bi-bell"></i>';
      enableBtn.addEventListener('click', () => openEnableLembreteModal({
        id: paciente.id,
        name: paciente.nome,
      }));
      secondaryActions.appendChild(enableBtn);
    }

    // Registrar Consulta
    const registrarConsultaBtn = document.createElement('button');
    registrarConsultaBtn.className = 'btn-icon btn-primary';
    registrarConsultaBtn.setAttribute('data-tooltip', 'Registrar Consulta');
    registrarConsultaBtn.innerHTML = '<i class="bi bi-calendar-plus"></i>';
    registrarConsultaBtn.addEventListener('click', () => openRegistrarConsultaModal({
      id: paciente.id,
      name: paciente.nome,
    }));
    primaryActions.appendChild(registrarConsultaBtn);

    togglePatientBtn.setAttribute('data-tooltip', 'Desativar Paciente');
    togglePatientBtn.innerHTML = '<i class="bi bi-person-dash"></i>';
  } else {
    togglePatientBtn.setAttribute('data-tooltip', 'Reativar Paciente');
    togglePatientBtn.innerHTML = '<i class="bi bi-person-check"></i>';
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

  const historicoConsultaBt = document.createElement('button');
  historicoConsultaBt.className = 'btn-icon btn-outline-primary';
  historicoConsultaBt.setAttribute('data-tooltip', 'Histórico de Consultas');
  historicoConsultaBt.innerHTML = '<i class="bi bi-journal-medical"></i>';
  historicoConsultaBt.addEventListener('click', () => openHistoricoConsultaModal({
  }));
  
  const historicoContatoBt = document.createElement('button');
  historicoContatoBt.className = 'btn-icon btn-outline-secondary';
  historicoContatoBt.setAttribute('data-tooltip', 'Histórico de Contatos');
  historicoContatoBt.innerHTML = '<i class="bi bi-chat-dots"></i>';
  historicoContatoBt.addEventListener('click', () => openHistoricoContatoModal({
  }));

  const EditarPacienteBt = document.createElement('button');
  EditarPacienteBt.className = 'btn-icon btn-outline-primary';
  EditarPacienteBt.setAttribute('data-tooltip', 'Editar Paciente');
  EditarPacienteBt.innerHTML = '<i class="bi bi-pencil"></i>';
  EditarPacienteBt.addEventListener('click', () => openEditarInfoPacientesModal({
  }));

  secondaryActions.appendChild(historicoConsultaBt);
  secondaryActions.appendChild(historicoContatoBt);
  secondaryActions.appendChild(EditarPacienteBt);

  // Adiciona togglePaciente ao container de ações secundárias para ficar ao lado dos outros botões secundários
  secondaryActions.appendChild(togglePatientBtn);

  // Junta os dois grupos dentro do container principal
  botoesContainer.appendChild(primaryActions);
  botoesContainer.appendChild(secondaryActions);

  // Depois, anexa ao seu elemento pai conforme já faz
  topRow.appendChild(contato);
  topRow.appendChild(botoesContainer);
  body.appendChild(topRow);


  // if (!paciente.grupo_regra_atual) {
    
  //   const atribuirGrupo = document.createElement('button');
  //   atribuirGrupo.className = 'btn btn-sm btn-enable-reminder';
  //   atribuirGrupo.innerHTML = 'Atribuir grupo';
  //   atribuirGrupo.addEventListener('click', () => openAtribuirGrupoModal(paciente.id));

  //   botoesContainer.appendChild(atribuirGrupo);

  // }

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

function openHistoricoConsultaModal(patient) {

  const historicoConsultaModal = new bootstrap.Modal(document.getElementById('consultasModal'));

  historicoConsultaModal.show();
}

function openHistoricoContatoModal(patient) {

  const historicoContatoModal = new bootstrap.Modal(document.getElementById('contatosModal'));

  historicoContatoModal.show();
}

function openEditarInfoPacientesModal(patient) {

  const editarInfoPacienteModal = new bootstrap.Modal(document.getElementById('editarPacienteModal'));

  editarInfoPacienteModal.show();
}

function openEnableLembreteModal(patient) {

  const enableLembreteModal = new bootstrap.Modal(document.getElementById('habilitarLembrete'));
  const nomePaciente = document.getElementById('patient-name-enable');
  const idPaciente = document.getElementById('enable-patient-id');

  nomePaciente.textContent = patient.name;
  idPaciente.value = patient.id;

  enableLembreteModal.show();
}

function openAtribuirGrupoModal(patient) {

  document.getElementById('paciente-id').value = patient;

  const modalAtribuirGrupoEl = document.getElementById('atribuirGrupoModal');
  const modalAtribuirGrupo = bootstrap.Modal.getInstance(modalAtribuirGrupoEl) || new bootstrap.Modal(modalAtribuirGrupoEl);
  
  modalAtribuirGrupo.show();

  carregarGrupoRegras();

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
document.getElementById('btn-registrar-consulta').addEventListener('click', async (event) => {

  event.preventDefault(); // Isso previne o refresh da página

  const idPaciente = document.getElementById('consulta-patient-id').value;
  const tipoConsulta = document.getElementById('consulta-tipo').value;
  const dataConsulta = document.getElementById('consulta-data').value;
  const submitBtn = document.getElementById('btn-registrar-consulta');

  // verifica se a data escolhida é maior que hoje, se for não deixar enviar
  const hoje = new Date();
  const dataSelecionada = new Date(dataConsulta);
  if (dataSelecionada > hoje) {
    showToast('A data da consulta não pode ser no futuro.', 'error');
    return;
  }

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

      // apagar modal anterior
      const modalInstance = bootstrap.Modal.getInstance(document.getElementById('reativarPacienteModal')) 
                    || new bootstrap.Modal(document.getElementById('reativarPacienteModal'));
      modalInstance.hide();

      openAtribuirGrupoModal(idPaciente);
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

export function inicializarSelecaoMateriais() {
  const suggestionsContainer = document.getElementById("material-suggestions");
  const selectedContainer = document.getElementById("selected-materials");
  const selectedMaterials = new Set();
  
  suggestionsContainer.innerHTML = '';
  selectedContainer.innerHTML = '';

  // Carrega sugestões
  fetch("/api/materiais/")
    .then((res) => res.json())
    .then((data) => {
      data.materiais.forEach((material) => {
        const chip = document.createElement("div");
        chip.className = "material-chip";
        chip.textContent = material.descricao;
        chip.dataset.materialId = material.id; // se precisar do id mais tarde
        chip.addEventListener("click", () => addMaterial(material.descricao));
        suggestionsContainer.appendChild(chip);
      });
    });

  // Adiciona ao input visual
  function addMaterial(nome) {
    if (selectedMaterials.has(nome)) return;

    selectedMaterials.add(nome);
    renderSelected();
  }

  // Renderiza os selecionados
  function renderSelected() {
    selectedContainer.innerHTML = "";
    selectedMaterials.forEach((nome) => {
      const pill = document.createElement("div");
      pill.className = "material-pill";
      pill.innerHTML = `${nome} <i class="bi bi-x-circle-fill" title="Remover"></i>`;

      pill.querySelector("i").addEventListener("click", () => {
        selectedMaterials.delete(nome);
        renderSelected();
      });

      selectedContainer.appendChild(pill);
    });
  }
}

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