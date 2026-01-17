import { showToast } from './message.js';

const TAMANHO_PAGINA = 10;
let paginaAtual = 0;
let carregandoPacientes = false;
let listaCompletaCarregada = false;
let botaoCarregarMais;
let wrapperCarregarMais;

const MODO_LISTA = 'lista';
const MODO_CALENDARIO = 'calendario';
const MODO_VISUALIZACAO_STORAGE_KEY = 'home_view_mode';
let modoVisualizacao = obterModoVisualizacaoInicial();
let calendarioMesAtual = null;
let calendarioAnoAtual = null;
let bloqueiosBotoesVisualizacao = 0;
let ultimaChaveListaCarregada = null;
let ultimaChaveCalendarioCarregada = null;

function paginaHomeDisponivel() {
  return Boolean(document.getElementById('patients-container'));
}

const MESES_PT_BR = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

let carregandoCalendario = false;
let calendarioRequisicaoAtual = 0;

function registrarAvisoLocalStorage(mensagem, erro) {
  if (typeof console !== 'undefined' && typeof console.warn === 'function') {
    if (erro) {
      console.warn(mensagem, erro);
    } else {
      console.warn(mensagem);
    }
  }
}

function obterModoVisualizacaoInicial() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return MODO_LISTA;
    }

    const armazenado = window.localStorage.getItem(MODO_VISUALIZACAO_STORAGE_KEY);

    if (armazenado === MODO_LISTA || armazenado === MODO_CALENDARIO) {
      return armazenado;
    }
  } catch (error) {
    registrarAvisoLocalStorage('Não foi possível recuperar o modo de visualização do localStorage.', error);
  }

  return MODO_LISTA;
}

function salvarModoVisualizacao(valor) {
  if (valor !== MODO_LISTA && valor !== MODO_CALENDARIO) {
    return;
  }

  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    window.localStorage.setItem(MODO_VISUALIZACAO_STORAGE_KEY, valor);
  } catch (error) {
    registrarAvisoLocalStorage('Não foi possível salvar o modo de visualização no localStorage.', error);
  }
}

function obterBotoesVisualizacao() {
  return [
    document.getElementById('view-toggle-list'),
    document.getElementById('view-toggle-calendar'),
  ].filter(Boolean);
}

function definirInteratividadeBotoesVisualizacao(ativado) {
  obterBotoesVisualizacao().forEach((botao) => {
    botao.toggleAttribute('disabled', !ativado);
    botao.setAttribute('aria-disabled', ativado ? 'false' : 'true');
    botao.classList.toggle('disabled', !ativado);
  });
}

function desabilitarBotoesVisualizacao() {
  bloqueiosBotoesVisualizacao += 1;

  if (bloqueiosBotoesVisualizacao === 1) {
    definirInteratividadeBotoesVisualizacao(false);
  }
}

function habilitarBotoesVisualizacao() {
  if (bloqueiosBotoesVisualizacao > 0) {
    bloqueiosBotoesVisualizacao -= 1;
  }

  if (bloqueiosBotoesVisualizacao === 0) {
    definirInteratividadeBotoesVisualizacao(true);
  }
}

function executarAcaoVisualizacao(acao) {
  desabilitarBotoesVisualizacao();

  let resultado;

  try {
    resultado = acao();
  } catch (erro) {
    habilitarBotoesVisualizacao();
    throw erro;
  }

  return Promise.resolve(resultado).finally(() => {
    habilitarBotoesVisualizacao();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (!paginaHomeDisponivel()) {
    return;
  }

  const filtroGrupoEl = document.getElementById('filter-group');
  if (filtroGrupoEl) {
    const placeholderOption = filtroGrupoEl.querySelector('option[value=""]');
    const placeholder = placeholderOption?.textContent || 'Grupo de lembrete';

    filtroGrupoEl.disabled = true;
    if (placeholderOption) {
      placeholderOption.textContent = 'Carregando grupos...';
      placeholderOption.setAttribute('data-placeholder', placeholder);
    }

    fetch('/api/grupo-regras/')
      .then((res) => {
        if (!res.ok) {
          throw new Error('Erro ao buscar grupos');
        }
        return res.json();
      })
      .then((data) => {
        const grupos = Array.isArray(data && data.grupos) ? data.grupos : [];
        const existentes = new Set(Array.from(filtroGrupoEl.options).map((opt) => opt.value));
        grupos.forEach((g) => {
          if (!g || !g.id || !g.nome) return;
          const value = String(g.id);
          if (existentes.has(value)) return;
          const opt = document.createElement('option');
          opt.value = value;
          opt.textContent = g.nome;
          filtroGrupoEl.appendChild(opt);
        });
      })
      .catch((err) => {
        console.error(err);
      })
      .finally(() => {
        if (placeholderOption) {
          placeholderOption.textContent = placeholderOption.getAttribute('data-placeholder') || 'Grupo de lembrete';
        }
        filtroGrupoEl.disabled = false;
      });
  }

  // Fechar modal desabilitar lembrete via botÇœes com data-modal-hide
  document.querySelectorAll('[data-modal-hide="desabilitarLembrete"]').forEach((btn) => {
    if (btn.dataset.listenerAdded) return;
    btn.dataset.listenerAdded = 'true';
    btn.addEventListener('click', () => fecharModalPorId('desabilitarLembrete'));
  });

  // Fechar modal excluir paciente via botÇœes com data-modal-hide
  document.querySelectorAll('[data-modal-hide="excluirPacienteModal"]').forEach((btn) => {
    if (btn.dataset.listenerAdded) return;
    btn.dataset.listenerAdded = 'true';
    btn.addEventListener('click', () => fecharModalPorId('excluirPacienteModal'));
  });

  // Abrir/fechar modal de novo material (home)
  const btnNovoMaterialHome = document.getElementById('btnNovoMaterial');
  const novoMaterialModal = document.getElementById('novoMaterialModal');
  if (btnNovoMaterialHome && novoMaterialModal) {
    btnNovoMaterialHome.addEventListener('click', () => {
      marcarProximoModalParaRetorno(novoMaterialModal);
      novoMaterialModal.classList.remove('hidden');
    });
    document.querySelectorAll('[data-modal-hide="novoMaterialModal"]').forEach((btn) => {
      if (btn.dataset.listenerAdded) return;
      btn.dataset.listenerAdded = 'true';
      btn.addEventListener('click', () => {
        novoMaterialModal.classList.add('hidden');
        reabrirCalendarioSeMarcado(novoMaterialModal);
      });
    });
  }

  const calendarEventsModal = document.getElementById('calendarEventsModal');
  if (calendarEventsModal) {
    calendarEventsModal.querySelectorAll('[data-modal-hide="calendarEventsModal"]').forEach((btn) => {
      if (btn.dataset.listenerAdded) return;
      btn.dataset.listenerAdded = 'true';
      btn.addEventListener('click', fecharModalAcoesCalendario);
    });

    const overlay = calendarEventsModal.querySelector('[class*="bg-gray-900/75"]');
    if (overlay && !overlay.dataset.listenerAdded) {
      overlay.dataset.listenerAdded = 'true';
      overlay.addEventListener('click', fecharModalAcoesCalendario);
    }
  }

  botaoCarregarMais = document.getElementById('load-more-patients');
  wrapperCarregarMais = document.getElementById('load-more-wrapper');

  desabilitarBotoesVisualizacao();

  if (botaoCarregarMais) {
    botaoCarregarMais.addEventListener('click', () => {
      botaoCarregarMais.disabled = true;
      botaoCarregarMais.classList.add('loading');
      listarPacientes(false).finally(() => {
        botaoCarregarMais.disabled = false;
        botaoCarregarMais.classList.remove('loading');
      });
    });
  }

  inicializarControleVisualizacao();
  const carregamentoInicial = Promise.resolve(listarPacientes());

  carregamentoInicial
    .catch(() => { })
    .finally(() => {
      habilitarBotoesVisualizacao();
    });

  atualizarCards();

  inicializarDesativarPaciente();
  inicializarDesativarLembrete();
  inicializarHabilitarLembrete();
  inicializarReativarPaciente();
  inicializarRegistroConsulta();
  inicializarBotaoExcluirGrupo();
  inicializarBotaoEditarGrupo();
  inicializarVoltarEditarGrupo();
  inicializarFormularioAtribuirGrupo();
  inicializarEdicaoPaciente();
  inicializarSelecaoMateriais();
  inicializarExcluirPaciente();

  document.querySelectorAll('form').forEach((form) => {
    form.addEventListener('submit', (event) => {
      const submitButton = form.querySelector('[type="submit"]');
      if (submitButton && !submitButton.dataset.loadingAdded) {
        submitButton.dataset.loadingAdded = 'true';
        submitButton.classList.add('loading');
      }
    });
  });

});

// Atualiza o card do paciente na lista pelo id, mostrando loading apenas no card alterado
export function atualizarCardPaciente(pacienteId) {
  const container = document.getElementById('patients-container');
  const oldCard = container ? container.querySelector(`[data-paciente-id="${pacienteId}"]`) : null;
  const calendarEvent = document.querySelector(`.calendar-event[data-paciente-id="${pacienteId}"]`);

  const cardConteudoAnterior = oldCard ? oldCard.innerHTML : null;
  const eventoConteudoAnterior = calendarEvent ? calendarEvent.innerHTML : null;

  if (oldCard) {
    // Mostra loading no próprio card
    oldCard.innerHTML = `
      <div class="d-flex justify-content-center align-items-center" style="min-height: 120px;">
        <div class="spinner-border text-primary" role="status"></div>
      </div>
    `;
  }

  if (calendarEvent) {
    calendarEvent.classList.add('calendar-event--loading');
    calendarEvent.innerHTML = `
      <div class="d-flex justify-content-center align-items-center py-4">
        <div class="spinner-border text-primary" role="status"></div>
      </div>
    `;
  }

  fetch(`/api/paciente/${pacienteId}/`)
    .then((res) => {
      if (!res.ok) {
        throw new Error('Erro ao buscar paciente');
      }
      return res.json();
    })
    .then((updated) => {
      if (oldCard && container) {
        const newCard = renderizarCardPaciente(updated);
        container.replaceChild(newCard, oldCard);
      }

      atualizarEventoCalendario(updated);
    })
    .catch((error) => {
      console.error(error);

      if (oldCard && cardConteudoAnterior !== null) {
        oldCard.innerHTML = cardConteudoAnterior;
      }

      if (calendarEvent && eventoConteudoAnterior !== null) {
        calendarEvent.innerHTML = eventoConteudoAnterior;
        calendarEvent.classList.remove('calendar-event--loading');
      }
    })
    .finally(() => {
      if (calendarEvent && calendarEvent.isConnected) {
        calendarEvent.classList.remove('calendar-event--loading');
      }
    });

  atualizarCards();
}

function removerCardPaciente(pacienteId) {
  const container = document.getElementById('patients-container');
  const card = container?.querySelector(`[data-paciente-id="${pacienteId}"]`);
  if (!card) return false;
  // Tente remove(), se não houver suporte, use removeChild
  if (typeof card.remove === 'function') {
    card.remove();
  } else {
    container.removeChild(card);
  }
  removerEventoCalendario(pacienteId);
  return true;
}

function obterFiltrosPacientes() {
  const nome = document.getElementById('filter-name')?.value?.trim() || '';
  const status = document.getElementById('filter-reminder')?.value?.trim() || '';
  const statusPrazo = document.getElementById('filter-reminder-due')?.value?.trim() || '';
  const grupo = document.getElementById('filter-group')?.value?.trim() || '';
  const sort = document.getElementById('filter-sort')?.value?.trim() || '';

  return {
    nome,
    status,
    statusPrazo,
    grupo,
    sort,
  };
}

function criarChaveLista(filtros) {
  const nome = filtros?.nome || '';
  const status = filtros?.status || '';
  const statusPrazo = filtros?.statusPrazo || '';
  const grupo = filtros?.grupo || '';
  const sort = filtros?.sort || '';
  return JSON.stringify({ nome, status, statusPrazo, grupo, sort });
}

function criarChaveCalendario(filtros, mes, ano) {
  const chaveLista = JSON.parse(criarChaveLista(filtros));
  return JSON.stringify({ ...chaveLista, mes, ano });
}

function obterStatusPrazoLembrete(paciente) {
  if (!paciente || !paciente.proximo_lembrete) {
    return null;
  }

  const data = new Date(paciente.proximo_lembrete);
  if (Number.isNaN(data.getTime())) {
    return null;
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  data.setHours(0, 0, 0, 0);

  return data < hoje ? 'atrasado' : 'emdia';
}

function filtrarPorPrazoLembrete(lista, statusPrazo) {
  if (!statusPrazo) {
    return lista;
  }
  return lista.filter((paciente) => obterStatusPrazoLembrete(paciente) === statusPrazo);
}

export function listarPacientes(reset = true) {

  if (modoVisualizacao === MODO_CALENDARIO) {
    return carregarCalendario();
  }

  if (carregandoPacientes || (!reset && listaCompletaCarregada)) {
    return Promise.resolve();
  }

  const container = document.getElementById('patients-container');
  const listSection = document.getElementById('patients-list');
  const emptyState = document.getElementById('empty-state');

  if (!container || !listSection || !emptyState) {
    return Promise.resolve();
  }

  mostrarVisualizacaoLista();

  if (reset) {
    paginaAtual = 0;
    listaCompletaCarregada = false;
  }

  const { nome: filtroNome, status: filtroStatus, statusPrazo: filtroStatusPrazo, grupo: filtroGrupo, sort: filtroSort } = obterFiltrosPacientes();
  const chaveLista = criarChaveLista({ nome: filtroNome, status: filtroStatus, statusPrazo: filtroStatusPrazo, grupo: filtroGrupo, sort: filtroSort });

  const params = new URLSearchParams();

  if (filtroNome !== '') {
    params.append('nome', filtroNome);
  }

  if (filtroStatus !== '') {
    params.append('status_lembrete', filtroStatus);
  }

  if (filtroSort !== '') {
    params.append('sort', filtroSort);
  }

  if (filtroGrupo !== '') {
    params.append('grupo', filtroGrupo);
  }

  const proximaPagina = reset ? 1 : paginaAtual + 1;
  params.append('page', proximaPagina.toString());
  params.append('page_size', TAMANHO_PAGINA.toString());

  if (botaoCarregarMais) {
    botaoCarregarMais.disabled = true;
  }

  if (reset) {
    container.innerHTML = `
      <div class="text-center py-4">
        <div class="spinner-border text-primary" role="status"></div>
        <div class="mt-2 text-secondary">Carregando pacientes...</div>
      </div>
    `;
    emptyState.classList.add('d-none');
    listSection.classList.remove('d-none');
    if (wrapperCarregarMais) {
      wrapperCarregarMais.classList.add('d-none');
    }
  } else {
    if (wrapperCarregarMais) {
      wrapperCarregarMais.classList.remove('d-none');
    }
  }

  carregandoPacientes = true;

  const requisicao = fetch(`/api/pacientes/?${params.toString()}`)
    .then(response => response.json())
    .then(data => {
      const lista = filtrarPorPrazoLembrete(data?.pacientes || [], filtroStatusPrazo);
      const possuiMais = Boolean(data?.has_more);

      if (reset) {
        container.dataset.loadedKey = chaveLista;
        ultimaChaveListaCarregada = chaveLista;
        container.innerHTML = '';
      }

      if (reset && lista.length === 0) {
        emptyState.classList.remove('d-none');
        listSection.classList.add('d-none');
        listaCompletaCarregada = true;
        paginaAtual = 0;
        if (wrapperCarregarMais) {
          wrapperCarregarMais.classList.add('d-none');
        }
        return;
      }

      emptyState.classList.add('d-none');
      listSection.classList.remove('d-none');

      lista.forEach(paciente => {
        const card = renderizarCardPaciente(paciente);
        container.appendChild(card);
      });

      if (lista.length > 0) {
        paginaAtual = proximaPagina;
      }

      listaCompletaCarregada = !possuiMais;

      if (!listaCompletaCarregada && lista.length > 0) {
        if (wrapperCarregarMais) {
          wrapperCarregarMais.classList.remove('d-none');
        }
        if (botaoCarregarMais) {
          botaoCarregarMais.classList.remove('d-none');
        }
      } else if (wrapperCarregarMais) {
        wrapperCarregarMais.classList.add('d-none');
      }
    })
    .catch(err => {
      showToast('Erro ao carregar pacientes', 'error');

      if (reset) {
        container.innerHTML = '<div class="text-danger text-center py-4">Erro ao carregar pacientes.</div>';
      } else {
        const indicador = document.getElementById('patients-loading-indicator');
        if (indicador) {
          indicador.remove();
        }
        if (wrapperCarregarMais && container.children.length > 0) {
          wrapperCarregarMais.classList.remove('d-none');
        }
      }
    })
    .finally(() => {
      carregandoPacientes = false;
      if (botaoCarregarMais) {
        botaoCarregarMais.disabled = false;
      }
    });

  return requisicao;
}

function inicializarControleVisualizacao() {
  const botaoLista = document.getElementById('view-toggle-list');
  const botaoCalendario = document.getElementById('view-toggle-calendar');
  const botaoAnterior = document.getElementById('calendar-prev');
  const botaoProximo = document.getElementById('calendar-next');
  const seletorMes = document.getElementById('calendar-month-picker');

  const hoje = new Date();
  calendarioMesAtual = hoje.getMonth();
  calendarioAnoAtual = hoje.getFullYear();
  atualizarCabecalhoCalendario();

  if (botaoLista && botaoCalendario) {
    atualizarEstadoBotoesVisualizacao(botaoLista, botaoCalendario);

    botaoLista.addEventListener('click', () => {
      if (modoVisualizacao === MODO_LISTA) {
        return;
      }
      modoVisualizacao = MODO_LISTA;
      calendarioRequisicaoAtual += 1; // invalida requisições de calendário em andamento
      salvarModoVisualizacao(modoVisualizacao);
      atualizarEstadoBotoesVisualizacao(botaoLista, botaoCalendario);
      mostrarVisualizacaoLista();

      const filtros = obterFiltrosPacientes();
      const chaveAtual = criarChaveLista(filtros);
      const container = document.getElementById('patients-container');
      if (container && container.dataset.loadedKey === chaveAtual) {
        ultimaChaveListaCarregada = chaveAtual;
        return;
      }

      executarAcaoVisualizacao(() => listarPacientes());
    });

    botaoCalendario.addEventListener('click', () => {
      if (modoVisualizacao === MODO_CALENDARIO) {
        return;
      }
      modoVisualizacao = MODO_CALENDARIO;
      salvarModoVisualizacao(modoVisualizacao);
      atualizarEstadoBotoesVisualizacao(botaoLista, botaoCalendario);

      const filtros = obterFiltrosPacientes();
      const chaveAtual = criarChaveCalendario(filtros, calendarioMesAtual, calendarioAnoAtual);
      const grid = document.getElementById('calendar-grid');
      if (grid && grid.dataset.loadedKey === chaveAtual && !carregandoCalendario) {
        ultimaChaveCalendarioCarregada = chaveAtual;
        mostrarVisualizacaoCalendario();
        atualizarCabecalhoCalendario();
        return;
      }

      executarAcaoVisualizacao(() => carregarCalendario());
    });
  }

  if (botaoAnterior) {
    botaoAnterior.addEventListener('click', () => {
      if (modoVisualizacao !== MODO_CALENDARIO) {
        return;
      }
      navegarCalendario(-1);
    });
  }

  if (botaoProximo) {
    botaoProximo.addEventListener('click', () => {
      if (modoVisualizacao !== MODO_CALENDARIO) {
        return;
      }
      navegarCalendario(1);
    });
  }

  if (seletorMes) {
    seletorMes.addEventListener('change', () => {
      if (modoVisualizacao !== MODO_CALENDARIO) {
        return;
      }
      const valor = seletorMes.value;
      if (!valor || !valor.includes('-')) {
        return;
      }
      const [anoStr, mesStr] = valor.split('-');
      const novoAno = Number(anoStr);
      const novoMes = Number(mesStr) - 1;
      if (Number.isNaN(novoAno) || Number.isNaN(novoMes) || novoMes < 0 || novoMes > 11) {
        return;
      }
      carregarCalendario(novoMes, novoAno);
    });
  }
}

function atualizarEstadoBotoesVisualizacao(botaoLista, botaoCalendario) {
  if (!botaoLista || !botaoCalendario) {
    return;
  }

  const setActive = (button) => {
    button.classList.add('bg-primary', 'text-white', 'shadow-md');
    button.classList.remove('text-slate-500', 'hover:bg-slate-100', 'bg-transparent');
    button.setAttribute('aria-pressed', 'true');
  };

  const setInactive = (button) => {
    button.classList.remove('bg-primary', 'text-white', 'shadow-md');
    button.classList.add('text-slate-500', 'hover:bg-slate-100', 'bg-transparent');
    button.setAttribute('aria-pressed', 'false');
  };

  const botaoAtivo = modoVisualizacao === MODO_LISTA ? botaoLista : botaoCalendario;
  const botaoInativo = modoVisualizacao === MODO_LISTA ? botaoCalendario : botaoLista;

  setActive(botaoAtivo);
  setInactive(botaoInativo);
}

function mostrarVisualizacaoLista() {
  const listSection = document.getElementById('patients-list');
  const calendarSection = document.getElementById('calendar-view');
  const calendarGridWrapper = document.querySelector('.calendar-grid-wrapper');

  if (calendarSection) {
    calendarSection.classList.add('d-none');
    calendarSection.classList.add('hidden');
    calendarSection.style.display = 'none';
  }
  if (calendarGridWrapper) {
    calendarGridWrapper.classList.add('d-none');
  }

  if (listSection) {
    listSection.classList.remove('d-none');
    listSection.classList.remove('hidden');
    listSection.style.display = '';
  }
}

function mostrarVisualizacaoCalendario() {
  const listSection = document.getElementById('patients-list');
  const calendarSection = document.getElementById('calendar-view');
  const emptyState = document.getElementById('empty-state');
  const calendarGridWrapper = document.querySelector('.calendar-grid-wrapper');

  if (listSection) {
    listSection.classList.add('d-none');
    listSection.classList.add('hidden');
    listSection.style.display = 'none';
  }

  if (calendarSection) {
    calendarSection.classList.remove('d-none');
    calendarSection.classList.remove('hidden');
    calendarSection.style.display = '';
  }
  if (calendarGridWrapper) {
    calendarGridWrapper.classList.remove('d-none');
  }

  if (emptyState) {
    emptyState.classList.add('d-none');
  }

  if (wrapperCarregarMais) {
    wrapperCarregarMais.classList.add('d-none');
  }

  if (botaoCarregarMais) {
    botaoCarregarMais.classList.add('d-none');
  }
}

function atualizarCabecalhoCalendario() {
  const titulo = document.getElementById('calendar-month-label');
  const seletorMes = document.getElementById('calendar-month-picker');

  if (!titulo) {
    return;
  }

  if (calendarioMesAtual === null || calendarioAnoAtual === null) {
    titulo.textContent = '\u00A0';
    if (seletorMes) {
      seletorMes.value = '';
    }
    return;
  }

  titulo.textContent = `${MESES_PT_BR[calendarioMesAtual]} de ${calendarioAnoAtual}`;

  if (seletorMes) {
    const mesFormatado = String(calendarioMesAtual + 1).padStart(2, '0');
    seletorMes.value = `${calendarioAnoAtual}-${mesFormatado}`;
  }
}

async function carregarCalendario(mes = calendarioMesAtual, ano = calendarioAnoAtual) {
  const botaoLista = document.getElementById('view-toggle-list');
  const botaoCalendario = document.getElementById('view-toggle-calendar');
  const emptyState = document.getElementById('calendar-empty-state');
  const grid = document.getElementById('calendar-grid');

  mostrarVisualizacaoCalendario();

  if (botaoLista && botaoCalendario) {
    atualizarEstadoBotoesVisualizacao(botaoLista, botaoCalendario);
  }

  if (typeof mes !== 'number' || Number.isNaN(mes) || typeof ano !== 'number' || Number.isNaN(ano)) {
    const hoje = new Date();
    mes = hoje.getMonth();
    ano = hoje.getFullYear();
  }

  calendarioMesAtual = mes;
  calendarioAnoAtual = ano;

  atualizarCabecalhoCalendario();

  const filtros = obterFiltrosPacientes();
  const chaveCalendario = criarChaveCalendario(filtros, calendarioMesAtual, calendarioAnoAtual);
  if (!carregandoCalendario && grid && grid.dataset.loadedKey === chaveCalendario) {
    ultimaChaveCalendarioCarregada = chaveCalendario;
    return;
  }

  if (emptyState) {
    emptyState.classList.add('d-none');
  }

  if (grid) {
    grid.className = 'calendar-grid';
    grid.innerHTML = `
      <div class="calendar-loading">
        <div class="spinner-border text-primary" role="status"></div>
        <span>Carregando lembretes...</span>
      </div>
    `;
  }

  const requisicaoId = ++calendarioRequisicaoAtual;
  carregandoCalendario = true;

  try {
    const pacientesMes = await buscarEventosCalendario(calendarioMesAtual, calendarioAnoAtual);

    if (requisicaoId !== calendarioRequisicaoAtual || modoVisualizacao !== MODO_CALENDARIO) {
      return;
    }

    const eventos = pacientesMes
      .map((paciente) => formatarEventoCalendario(paciente))
      .filter(Boolean);

    if (emptyState) {
      if (eventos.length === 0) {
        emptyState.classList.remove('d-none');
      } else {
        emptyState.classList.add('d-none');
      }
    }

    renderizarCalendario(eventos);
    if (grid) {
      grid.dataset.loadedKey = chaveCalendario;
      ultimaChaveCalendarioCarregada = chaveCalendario;
    }
  } catch (error) {
    console.error(error);

    if (requisicaoId !== calendarioRequisicaoAtual) {
      return;
    }

    if (grid) {
      grid.innerHTML = `
        <div class="calendar-error">
          <i class="bi bi-emoji-frown"></i>
          <p>Não foi possível carregar os lembretes.</p>
        </div>
      `;
    }

    if (emptyState) {
      emptyState.classList.remove('d-none');
    }

    showToast('Erro ao carregar pacientes do calendário', 'error');
  } finally {
    if (requisicaoId === calendarioRequisicaoAtual) {
      carregandoCalendario = false;
    }
  }
}

function navegarCalendario(offset) {
  if (typeof offset !== 'number' || Number.isNaN(offset)) {
    return;
  }

  if (calendarioMesAtual === null || calendarioAnoAtual === null) {
    const hoje = new Date();
    calendarioMesAtual = hoje.getMonth();
    calendarioAnoAtual = hoje.getFullYear();
  }

  let novoMes = calendarioMesAtual + offset;
  let novoAno = calendarioAnoAtual;

  if (novoMes < 0) {
    novoMes = 11;
    novoAno -= 1;
  } else if (novoMes > 11) {
    novoMes = 0;
    novoAno += 1;
  }

  carregarCalendario(novoMes, novoAno);
}

async function buscarEventosCalendario(mes, ano) {
  if (typeof mes !== 'number' || Number.isNaN(mes) || typeof ano !== 'number' || Number.isNaN(ano)) {
    const hoje = new Date();
    mes = hoje.getMonth();
    ano = hoje.getFullYear();
  }

  const { nome, status, statusPrazo, grupo, sort } = obterFiltrosPacientes();
  const pacientesMes = [];
  let pagina = 1;
  let possuiMais = true;

  while (possuiMais) {
    const params = new URLSearchParams();

    if (nome) {
      params.append('nome', nome);
    }

    if (status) {
      params.append('status_lembrete', status);
    }

    if (sort) {
      params.append('sort', sort);
    }

    if (grupo) {
      params.append('grupo', grupo);
    }

    params.append('page', pagina.toString());
    params.append('page_size', '200');
    params.append('modo', MODO_CALENDARIO);
    params.append('mes', String(mes + 1));
    params.append('ano', String(ano));

    const response = await fetch(`/api/pacientes/?${params.toString()}`);

    if (!response.ok) {
      throw new Error('Erro ao carregar pacientes do calendário');
    }

    const data = await response.json();
    const filtrados = filtrarPorPrazoLembrete(data?.pacientes || [], statusPrazo);
    pacientesMes.push(...filtrados);
    possuiMais = Boolean(data?.has_more);
    pagina += 1;

    if (!possuiMais || pagina > 20) {
      break;
    }
  }

  return pacientesMes;
}

function formatarEventoCalendario(paciente) {
  if (!paciente || !paciente.proximo_lembrete) {
    return null;
  }

  const dataIso = paciente.proximo_lembrete.split('T')[0];

  if (!dataIso) {
    return null;
  }

  const [anoStr, mesStr, diaStr] = dataIso.split('-');

  if (!anoStr || !mesStr || !diaStr) {
    return null;
  }

  const ano = Number(anoStr);
  const mes = Number(mesStr) - 1;
  const dia = Number(diaStr);

  if ([ano, mes, dia].some((valor) => Number.isNaN(valor))) {
    return null;
  }

  const data = new Date(ano, mes, dia);

  return {
    dataISO: formatarDataISO(data),
    data,
    paciente,
  };
}

function formatarDataISO(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function renderizarCalendario(eventos = []) {
  const grid = document.getElementById('calendar-grid');

  if (!grid) {
    return;
  }

  const hoje = new Date();
  const anoReferencia = typeof calendarioAnoAtual === 'number' ? calendarioAnoAtual : hoje.getFullYear();
  const mesReferencia = typeof calendarioMesAtual === 'number' ? calendarioMesAtual : hoje.getMonth();

  const primeiroDiaDoMes = new Date(anoReferencia, mesReferencia, 1);
  const offsetPrimeiroDia = primeiroDiaDoMes.getDay();
  const diasNoMes = new Date(anoReferencia, mesReferencia + 1, 0).getDate();
  const totalCelulas = Math.ceil((offsetPrimeiroDia + diasNoMes) / 7) * 7;
  const dataInicial = new Date(anoReferencia, mesReferencia, 1 - offsetPrimeiroDia);

  const eventosPorDia = eventos.reduce((acc, evento) => {
    if (!evento || !evento.dataISO) {
      return acc;
    }

    if (!acc[evento.dataISO]) {
      acc[evento.dataISO] = [];
    }

    acc[evento.dataISO].push(evento.paciente);
    return acc;
  }, {});

  grid.className = 'calendar-grid';
  grid.innerHTML = '';

  const fragment = document.createDocumentFragment();

  DIAS_SEMANA.forEach((dia) => {
    const cabecalho = document.createElement('div');
    cabecalho.className = 'calendar-weekday';
    cabecalho.textContent = dia;
    fragment.appendChild(cabecalho);
  });

  for (let indice = 0; indice < totalCelulas; indice += 1) {
    const dataAtual = new Date(dataInicial);
    dataAtual.setDate(dataInicial.getDate() + indice);

    const diaDaSemana = dataAtual.getDay();
    const dataISO = formatarDataISO(dataAtual);
    const pacientesDoDia = eventosPorDia[dataISO] || [];

    const celula = document.createElement('div');
    celula.className = 'calendar-day';
    celula.dataset.date = dataISO;

    if (dataAtual.getMonth() !== mesReferencia) {
      celula.classList.add('is-outside-month');
    }

    if (diaDaSemana === 0 || diaDaSemana === 6) {
      celula.classList.add('is-weekend');
    }

    if (
      dataAtual.getFullYear() === hoje.getFullYear() &&
      dataAtual.getMonth() === hoje.getMonth() &&
      dataAtual.getDate() === hoje.getDate()
    ) {
      celula.classList.add('is-today');
    }

    const cabecalhoDia = document.createElement('div');
    cabecalhoDia.className = 'calendar-day-date';
    cabecalhoDia.innerHTML = `<span>${dataAtual.getDate()}</span>`;

    // if (pacientesDoDia.length > 0) {
    //   celula.classList.add('has-events');
    //   const contador = document.createElement('span');
    //   contador.className = 'calendar-day-count';
    //   contador.textContent = pacientesDoDia.length;
    //   cabecalhoDia.appendChild(contador);
    // }

    celula.appendChild(cabecalhoDia);

    if (pacientesDoDia.length > 0) {
      const listaEventos = document.createElement('div');
      listaEventos.className = 'calendar-day-events';

      pacientesDoDia
        .slice()
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
        .forEach((paciente) => {
          const evento = criarEventoCalendario(paciente);
          listaEventos.appendChild(evento);
        });

      celula.appendChild(listaEventos);
    }

    fragment.appendChild(celula);
  }

  grid.appendChild(fragment);
}

function criarEventoCalendario(paciente) {
  const dados = obterInformacoesPaciente(paciente);
  const {
    status,
    badgeClass,
    badgeText,
    proximoDescricao,
    ultimaStr,
    textoUltimo,
    tipoConsulta,
    diasAtrasDescricao,
    telefoneLimpo,
  } = dados;

  const elemento = document.createElement('div');
  elemento.className = `calendar-event calendar-event-${status} calendar-event--compact`;
  elemento.dataset.pacienteId = paciente.id;

  const cabecalho = document.createElement('div');
  cabecalho.className = 'calendar-event-header';

  const titulo = document.createElement('div');
  titulo.className = 'calendar-event-title';
  titulo.textContent = paciente.nome;

  // const statusElemento = document.createElement('span');
  // statusElemento.className = `calendar-event-badge badge ${badgeClass}`;
  // statusElemento.textContent = badgeText;

  cabecalho.appendChild(titulo);
  // cabecalho.appendChild(statusElemento);

  const informacoes = document.createElement('div');
  informacoes.className = 'calendar-event-info-list';

  // const infoProximo = document.createElement('div');
  // infoProximo.className = 'calendar-event-info';
  // infoProximo.innerHTML = `<i class="bi bi-calendar-event"></i> Próximo contato: ${proximoDescricao}`;

  // const infoUltima = document.createElement('div');
  // infoUltima.className = 'calendar-event-info';
  // infoUltima.innerHTML = `<i class="bi bi-calendar-check"></i> ${textoUltimo} ${tipoConsulta}: ${ultimaStr}`;

  // const infoDias = document.createElement('div');
  // infoDias.className = 'calendar-event-info';
  // infoDias.innerHTML = `<i class="bi bi-clock-history"></i> ${diasAtrasDescricao}`;

  // informacoes.appendChild(infoProximo);
  // informacoes.appendChild(infoUltima);
  // informacoes.appendChild(infoDias);

  if (paciente.texto_lembrete) {
    const infoAcao = document.createElement('div');
    infoAcao.className = 'calendar-event-info'; // ou 'calendar-event-info calendar-event-info--clamp'

    const icone = document.createElement('i');
    icone.className = 'bi bi-chat-left-text';
    icone.style.marginRight = '0.35rem';

    const span = document.createElement('span');
    span.textContent = paciente.texto_lembrete; // evita HTML injection e respeita quebras

    infoAcao.appendChild(icone);
    infoAcao.appendChild(span);
    informacoes.appendChild(infoAcao);

  }

  const rodape = document.createElement('div');
  rodape.className = 'calendar-event-footer';

  const acoesEsquerda = document.createElement('div');
  acoesEsquerda.className = 'calendar-event-links';

  if (telefoneLimpo) {
    const whatsapp = document.createElement('a');
    whatsapp.href = `https://wa.me/55${telefoneLimpo}`;
    whatsapp.target = '_blank';
    whatsapp.className = 'calendar-event-whatsapp';
    whatsapp.innerHTML = '<i class="bi bi-whatsapp"></i> WhatsApp';
    acoesEsquerda.appendChild(whatsapp);
  }

  const grupoBtn = document.createElement('button');
  grupoBtn.type = 'button';
  grupoBtn.className = 'btn btn-link p-0 calendar-event-group';
  grupoBtn.innerHTML = `<i class="bi bi-people"></i> ${paciente.grupo_regra_atual || 'Atribuir grupo'}`;
  grupoBtn.addEventListener('click', () => openAtribuirGrupoModal(paciente.id));
  acoesEsquerda.appendChild(grupoBtn);

  const menuAcoes = criarMenuAcoesCalendario(paciente);

  rodape.appendChild(acoesEsquerda);
  rodape.appendChild(menuAcoes.dropdownWrapper || menuAcoes);

  elemento.appendChild(cabecalho);
  elemento.appendChild(informacoes);
  elemento.appendChild(rodape);

  const abrirAcoesModal = () => abrirModalAcoesCalendario(menuAcoes.actionsForModal || [], paciente);

  cabecalho.addEventListener('click', (event) => {
    if (event.target.closest('button, a')) {
      return;
    }
    abrirAcoesModal();
  });

  elemento.addEventListener('click', (event) => {
    if (event.target.closest('.calendar-event-menu') || event.target.closest('a')) {
      return;
    }
    abrirAcoesModal();
  });

  return elemento;
}

function atualizarEventoCalendario(paciente) {
  if (!paciente || typeof paciente.id === 'undefined') {
    return;
  }

  const grid = document.getElementById('calendar-grid');

  if (!grid) {
    return;
  }

  const eventoExistente = grid.querySelector(`.calendar-event[data-paciente-id="${paciente.id}"]`);
  const eventoFormatado = formatarEventoCalendario(paciente);

  if (!eventoFormatado) {
    if (eventoExistente) {
      const diaAnterior = eventoExistente.closest('.calendar-day');
      eventoExistente.remove();
      atualizarEstadoDiaCalendario(diaAnterior);
    }
    atualizarEstadoCalendarioGlobal();
    return;
  }

  const novoDiaISO = eventoFormatado.dataISO;
  const novoDiaElemento = grid.querySelector(`.calendar-day[data-date="${novoDiaISO}"]`);
  const novoEventoElemento = criarEventoCalendario(paciente);

  if (eventoExistente) {
    const diaAnterior = eventoExistente.closest('.calendar-day');
    if (diaAnterior?.dataset.date === novoDiaISO) {
      eventoExistente.replaceWith(novoEventoElemento);
      atualizarEstadoDiaCalendario(diaAnterior);
      atualizarEstadoCalendarioGlobal();
      return;
    }

    eventoExistente.remove();
    atualizarEstadoDiaCalendario(diaAnterior);
  }

  if (!novoDiaElemento) {
    atualizarEstadoCalendarioGlobal();
    return;
  }

  let eventosContainer = novoDiaElemento.querySelector('.calendar-day-events');
  if (!eventosContainer) {
    eventosContainer = document.createElement('div');
    eventosContainer.className = 'calendar-day-events';
    novoDiaElemento.appendChild(eventosContainer);
  }

  inserirEventoCalendarioOrdenado(eventosContainer, novoEventoElemento);
  atualizarEstadoDiaCalendario(novoDiaElemento);
  atualizarEstadoCalendarioGlobal();
}

function removerEventoCalendario(pacienteId) {
  if (typeof pacienteId === 'undefined' || pacienteId === null) {
    return;
  }

  const grid = document.getElementById('calendar-grid');

  if (!grid) {
    return;
  }

  const eventoExistente = grid.querySelector(`.calendar-event[data-paciente-id="${pacienteId}"]`);

  if (!eventoExistente) {
    atualizarEstadoCalendarioGlobal();
    return;
  }

  const diaAnterior = eventoExistente.closest('.calendar-day');
  eventoExistente.remove();
  atualizarEstadoDiaCalendario(diaAnterior);
  atualizarEstadoCalendarioGlobal();
}

function inserirEventoCalendarioOrdenado(container, novoEvento) {
  const novoTitulo = (novoEvento.querySelector('.calendar-event-title')?.textContent || '').trim();
  const eventosExistentes = Array.from(container.querySelectorAll('.calendar-event'));

  const referencia = eventosExistentes.find((evento) => {
    const titulo = (evento.querySelector('.calendar-event-title')?.textContent || '').trim();
    return titulo.localeCompare(novoTitulo, 'pt-BR') > 0;
  });

  if (referencia) {
    container.insertBefore(novoEvento, referencia);
  } else {
    container.appendChild(novoEvento);
  }
}

function atualizarEstadoDiaCalendario(diaElemento) {
  if (!diaElemento) {
    return;
  }

  const eventosContainer = diaElemento.querySelector('.calendar-day-events');
  const eventos = eventosContainer ? Array.from(eventosContainer.querySelectorAll('.calendar-event')) : [];

  if (eventos.length > 0) {
    diaElemento.classList.add('has-events');
  } else {
    diaElemento.classList.remove('has-events');
    if (eventosContainer) {
      eventosContainer.remove();
    }
  }

  const cabecalho = diaElemento.querySelector('.calendar-day-date');
  if (!cabecalho) {
    return;
  }

  // let contador = cabecalho.querySelector('.calendar-day-count');

  if (eventos.length > 0) {
    if (!contador) {
      contador = document.createElement('span');
      contador.className = 'calendar-day-count';
      cabecalho.appendChild(contador);
    }
    contador.textContent = eventos.length;
  } else if (contador) {
    contador.remove();
  }
}

function atualizarEstadoCalendarioGlobal() {
  const grid = document.getElementById('calendar-grid');
  const emptyState = document.getElementById('calendar-empty-state');

  if (!grid || !emptyState) {
    return;
  }

  const possuiEventos = Boolean(grid.querySelector('.calendar-event'));

  if (possuiEventos) {
    emptyState.classList.add('d-none');
  } else {
    emptyState.classList.remove('d-none');
  }
}

function criarMenuAcoesCalendario(paciente) {
  const dropdownWrapper = document.createElement('div');
  dropdownWrapper.className = 'dropdown calendar-event-actions';
  const actionsForModal = [];

  const toggle = document.createElement('button');
  toggle.className = 'btn btn-sm btn-outline-secondary calendar-event-menu';
  toggle.type = 'button';
  toggle.setAttribute('data-bs-toggle', 'dropdown');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.innerHTML = '<i class="bi bi-three-dots"></i>';

  const menu = document.createElement('div');
  menu.className = 'dropdown-menu dropdown-menu-end';

  const registrarAcao = (label, icon, handler) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'dropdown-item d-flex align-items-center gap-2';
    item.innerHTML = `<i class="bi ${icon}"></i><span>${label}</span>`;
    item.addEventListener('click', (event) => {
      event.preventDefault();
      const dropdown = bootstrap.Dropdown.getOrCreateInstance(toggle);
      dropdown.hide();
      handler();
    });
    menu.appendChild(item);
    actionsForModal.push({ label, icon, handler });
  };

  if (paciente.paciente_ativo && paciente.grupo_regra_atual && paciente.lembretes_ativos) {
    registrarAcao('Registrar contato', 'bi-check-circle', () => openContactModal({
      id: paciente.id,
      name: paciente.nome,
      type: paciente.nome_lembrete,
    }));

    registrarAcao('Desativar lembretes', 'bi-bell-slash', () => openDisableLembreteModal({
      id: paciente.id,
      name: paciente.nome,
    }));
  } else if (paciente.paciente_ativo && paciente.grupo_regra_atual && !paciente.lembretes_ativos) {
    registrarAcao('Reativar lembretes', 'bi-bell', () => openEnableLembreteModal({
      id: paciente.id,
      name: paciente.nome,
    }));
  }

  if (paciente.paciente_ativo) {
    registrarAcao('Registrar consulta', 'bi-calendar-plus', () => openRegistrarConsultaModal({
      id: paciente.id,
      name: paciente.nome,
    }));
  }

  registrarAcao('Alterar grupo de regras', 'bi-people', () => openAtribuirGrupoModal(paciente.id));

  registrarAcao('Histórico de consultas', 'bi-journal-medical', () => openHistoricoConsultaModal({
    id: paciente.id,
  }));

  registrarAcao('Histórico de contatos', 'bi-chat-dots', () => openHistoricoContatoModal({
    id: paciente.id,
  }));

  registrarAcao('Editar informações', 'bi-pencil', () => openEditarInfoPacientesModal({
    patient: paciente,
  }));

  if (paciente.paciente_ativo) {
    registrarAcao('Desativar', 'bi-person-dash', () => openDeactivatePatientModal({
      id: paciente.id,
      name: paciente.nome,
    }));
  } else {
    registrarAcao('Reativar paciente', 'bi-person-check', () => openActivatePatientModal({
      id: paciente.id,
      name: paciente.nome,
    }));
  }

  registrarAcao('Excluir', 'bi-trash', () => openExcluirPatientModal({
    patient: paciente,
  }));

  const toggleCalendarEventMenuState = (action) => {
    const calendarEventElement = dropdownWrapper.closest('.calendar-event');
    if (calendarEventElement) {
      calendarEventElement.classList[action]('calendar-event--menu-open');
    }

    const calendarDayEventsElement = dropdownWrapper.closest('.calendar-day-events');
    if (calendarDayEventsElement) {
      calendarDayEventsElement.classList[action]('calendar-day-events--menu-open');
    }

    const calendarDayElement = dropdownWrapper.closest('.calendar-day');
    if (calendarDayElement) {
      calendarDayElement.classList[action]('calendar-day--menu-open');
    }
  };

  dropdownWrapper.addEventListener('show.bs.dropdown', () => {
    toggleCalendarEventMenuState('add');
  });

  dropdownWrapper.addEventListener('hidden.bs.dropdown', () => {
    toggleCalendarEventMenuState('remove');
  });

  dropdownWrapper.appendChild(toggle);
  dropdownWrapper.appendChild(menu);

  return { dropdownWrapper, actionsForModal };
}

const calendarModalReturnState = {
  context: null,
  awaitingNextModal: false,
};

function prepararRetornoParaCalendario(actions = [], paciente = {}) {
  calendarModalReturnState.context = {
    actions: [...actions],
    paciente,
  };
  calendarModalReturnState.awaitingNextModal = true;
}

function marcarProximoModalParaRetorno(modalEl) {
  if (!calendarModalReturnState.awaitingNextModal || !modalEl) {
    return;
  }

  modalEl.dataset.returnToCalendar = 'true';
  calendarModalReturnState.awaitingNextModal = false;
}

function reabrirCalendarioSeMarcado(modalEl) {
  if (!modalEl || modalEl.dataset.returnToCalendar !== 'true') {
    return;
  }

  delete modalEl.dataset.returnToCalendar;

  const { context } = calendarModalReturnState;
  if (context) {
    abrirModalAcoesCalendario(context.actions || [], context.paciente || {});
  }
}

function abrirModalAcoesCalendario(actions = [], paciente = {}) {
  const modalEl = document.getElementById('calendarEventsModal');
  const bodyEl = document.getElementById('calendar-modal-body');
  const titleEl = document.getElementById('calendar-modal-title');
  const subtitleEl = document.getElementById('calendar-modal-date');

  if (!modalEl || !bodyEl) {
    return;
  }

  if (titleEl) {
    titleEl.textContent = paciente.nome || 'Ações do paciente';
  }

  if (subtitleEl) {
    const detalhes = [];
    if (paciente.nome_lembrete) {
      detalhes.push(paciente.nome_lembrete);
    }
    if (paciente.proxima_data) {
      detalhes.push(paciente.proxima_data);
    }
    subtitleEl.textContent = detalhes.join(' • ');
    subtitleEl.classList.toggle('hidden', detalhes.length === 0);
  }

  bodyEl.innerHTML = '';

  if (!actions.length) {
    const vazio = document.createElement('p');
    vazio.className = 'text-sm text-slate-500';
    vazio.textContent = 'Nenhuma ação disponível para este paciente.';
    bodyEl.appendChild(vazio);
  } else {
    actions.forEach(({ label, icon, handler }) => {
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'flex items-center justify-between w-full rounded-lg border border-slate-200 px-4 py-3 text-sm font-semibold text-[#111518] hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';
      botao.innerHTML = `<span class="flex items-center gap-3"><i class="bi ${icon} text-primary"></i>${label}</span><span class="material-symbols-outlined text-base text-slate-400">chevron_right</span>`;
      botao.addEventListener('click', () => {
        prepararRetornoParaCalendario(actions, paciente);
        fecharModalAcoesCalendario();
        if (typeof handler === 'function') {
          handler();
        }
      });
      bodyEl.appendChild(botao);
    });
  }

  modalEl.classList.remove('hidden');
}

function fecharModalAcoesCalendario() {
  const modalEl = document.getElementById('calendarEventsModal');
  if (modalEl) {
    modalEl.classList.add('hidden');
  }
}

document.addEventListener('shown.bs.modal', (event) => {
  marcarProximoModalParaRetorno(event.target);
});

document.addEventListener('hidden.bs.modal', (event) => {
  reabrirCalendarioSeMarcado(event.target);
});

// Suporte para modais que usam data-modal-target/data-modal-hide (estilo Flowbite/custom)
document.addEventListener('click', (event) => {
  const openTrigger = event.target.closest('[data-modal-target]');
  if (openTrigger) {
    const targetId = openTrigger.getAttribute('data-modal-target');
    const modalEl = document.getElementById(targetId);
    marcarProximoModalParaRetorno(modalEl);
  }

  const closeTrigger = event.target.closest('[data-modal-hide]');
  if (closeTrigger) {
    const targetId = closeTrigger.getAttribute('data-modal-hide');
    const modalEl = document.getElementById(targetId);
    reabrirCalendarioSeMarcado(modalEl);
  }
});

function obterInformacoesPaciente(paciente) {
  const consultasOrdenadas = [...(paciente.consultas || [])].sort((a, b) => b.id - a.id);
  const ultimaConsulta = consultasOrdenadas[0];
  const tipoConsulta = ultimaConsulta?.tipo_consulta || 'consulta';
  const textoUltimo = tipoConsulta === 'retorno' ? 'Último' : 'Última';

  const ultimaRaw = ultimaConsulta?.data_consulta || paciente.ultima_consulta;
  const proximoRaw = paciente.proximo_lembrete;

  const ultima = ultimaRaw ? new Date(`${ultimaRaw}T00:00:00`) : null;
  const proximo = proximoRaw ? new Date(`${proximoRaw}T00:00:00`) : null;

  const hoje = new Date();
  const diasAtras = ultima ? Math.floor((hoje - ultima) / (1000 * 60 * 60 * 24)) : null;
  const diasParaProximo = proximo ? Math.ceil((proximo - hoje) / (1000 * 60 * 60 * 24)) : null;
  const atrasado = diasParaProximo !== null && diasParaProximo < 0;

  const ultimaStr = ultima ? ultima.toLocaleDateString('pt-BR') : '---';
  const proximoStr = proximo ? proximo.toLocaleDateString('pt-BR') : '---';
  const proximoDescricao = proximo ? proximo.toLocaleDateString('pt-BR') : 'Sem agendamento';
  const diasAtrasResumo = diasAtras !== null ? `${diasAtras} dias atrás` : '---';
  const diasAtrasDescricao = diasAtras !== null ? `${diasAtras} dias desde a última consulta` : '---';

  let badgeClass = 'badge-waiting';
  let badgeText = diasParaProximo === null ? 'Sem próximo contato' : `Próximo contato em ${diasParaProximo} dias`;
  let status = 'upcoming';

  if (!paciente.paciente_ativo) {
    badgeClass = 'badge-warning';
    badgeText = 'Paciente desativado';
    status = 'inactive';
  } else if (!paciente.grupo_regra_atual) {
    badgeClass = 'badge-warning';
    badgeText = 'Atribua um grupo de regras';
    status = 'no-group';
  } else if (!paciente.lembretes_ativos) {
    badgeClass = 'badge-warning';
    badgeText = 'Habilite lembretes';
    status = 'reminder-disabled';
  } else if (atrasado) {
    badgeClass = 'badge-overdue';
    badgeText = `Atrasado ${Math.abs(diasParaProximo)} dias`;
    status = 'overdue';
  }

  const telefoneLimpo = paciente.telefone?.replace(/\D/g, '') || '';

  return {
    tipoConsulta,
    textoUltimo,
    ultimaStr,
    proximoStr,
    proximoDescricao,
    diasAtrasResumo,
    diasAtrasDescricao,
    diasParaProximo,
    atrasado,
    badgeClass,
    badgeText,
    status,
    telefoneLimpo,
  };
}

export function renderizarCardPaciente(paciente) {
  const dados = obterInformacoesPaciente(paciente);
  const {
    tipoConsulta,
    textoUltimo,
    ultimaStr,
    proximoStr,
    diasAtrasResumo,
    atrasado,
    badgeClass,
    badgeText,
    telefoneLimpo,
  } = dados;

  // Map Bootstrap badge classes to Tailwind
  let tailwindBadgeClass = 'bg-gray-50 text-gray-600 ring-gray-500/10 dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20';
  if (badgeClass.includes('badge-waiting')) {
    tailwindBadgeClass = 'bg-green-50 text-green-700 ring-green-600/10 dark:bg-green-400/10 dark:text-green-400 dark:ring-green-400/20';
  } else if (badgeClass.includes('badge-warning')) {
    tailwindBadgeClass = 'bg-orange-50 text-orange-700 ring-orange-600/10 dark:bg-orange-400/10 dark:text-orange-400 dark:ring-orange-400/20';
  } else if (badgeClass.includes('badge-overdue')) {
    tailwindBadgeClass = 'bg-red-50 text-red-700 ring-red-600/10 dark:bg-red-400/10 dark:text-red-400 dark:ring-red-400/20';
  }

  // Initials
  const initials = paciente.nome
    ? paciente.nome.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
    : '??';

  const card = document.createElement('article');
  card.className = 'flex flex-col justify-between rounded-xl bg-white dark:bg-[#15202b] p-5 shadow-sm ring-1 ring-slate-900/5 transition-all hover:ring-primary/50 mb-4';
  card.dataset.pacienteId = paciente.id;

  // Header Section
  const mb4 = document.createElement('div');
  mb4.className = 'mb-4';

  const headerFlex = document.createElement('div');
  headerFlex.className = 'flex items-start justify-between';

  const profileFlex = document.createElement('div');
  profileFlex.className = 'flex items-center gap-3';

  // Initials Circle
  const initialsDiv = document.createElement('div');
  // Reduced from h-10 w-10 to h-8 w-8, text-sm to text-xs
  initialsDiv.className = 'h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 font-bold text-xs';
  initialsDiv.textContent = initials;
  profileFlex.appendChild(initialsDiv);

  // Name and ID
  const nameDiv = document.createElement('div');
  const h3Name = document.createElement('h3');
  // Removed font-bold, slightly smaller text
  h3Name.className = 'text-sm font-semibold text-slate-900 dark:text-white';
  h3Name.textContent = paciente.nome;
  const pId = document.createElement('p');
  pId.className = 'text-xs text-slate-500';
  pId.textContent = `ID: #${paciente.id} `;
  nameDiv.appendChild(h3Name);
  nameDiv.appendChild(pId);
  profileFlex.appendChild(nameDiv);

  headerFlex.appendChild(profileFlex);

  // Badge
  const badgeSpan = document.createElement('span');
  // Reduced padding (px-2 py-0.5) and text size (text-[10px])
  badgeSpan.className = `inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${tailwindBadgeClass}`;
  badgeSpan.textContent = badgeText;
  headerFlex.appendChild(badgeSpan);

  mb4.appendChild(headerFlex);

  // Info Content Section
  const infoStack = document.createElement('div');
  infoStack.className = 'mt-4 flex flex-col gap-2';

  const createInfoRow = (icon, text) => {
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400';
    row.innerHTML = `<span class="material-symbols-outlined text-[18px] text-slate-400">${icon}</span><span>${text}</span>`;
    return row;
  };

  const lastConsultText = `${textoUltimo} ${tipoConsulta}: <span class="font-medium text-slate-900 dark:text-white">${ultimaStr}</span> (${diasAtrasResumo})`;
  infoStack.appendChild(createInfoRow('event_available', lastConsultText));

  const groupName = paciente.grupo_regra_atual || 'Nenhum';
  const groupTextClass = paciente.grupo_regra_atual ? 'text-slate-900 dark:text-white font-medium' : 'text-slate-400 italic';
  const groupRow = createInfoRow('folder_special', `Grupo: <span class="${groupTextClass}">${groupName}</span>`);

  if (!paciente.grupo_regra_atual) {
    const assignLink = document.createElement('button');
    assignLink.className = 'ml-2 text-primary text-xs font-semibold hover:underline';
    assignLink.textContent = 'Atribuir';
    assignLink.onclick = (e) => { e.stopPropagation(); openAtribuirGrupoModal(paciente.id); };
    groupRow.querySelector('span:last-child').appendChild(assignLink);
  }
  infoStack.appendChild(groupRow);

  if (proximoStr && proximoStr !== '-') {
    const nextRow = createInfoRow('calendar_clock', `Próximo contato: <span class="font-medium text-primary">${proximoStr}</span>`);
    infoStack.appendChild(nextRow);
  }

  if (paciente.texto_lembrete) {
    const reminderRow = createInfoRow('notifications_active', paciente.texto_lembrete);
    infoStack.appendChild(reminderRow);
  }

  if (telefoneLimpo) {
    const waRow = document.createElement('div');
    waRow.className = 'flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 mt-1';
    waRow.innerHTML = `
      <a href="https://wa.me/55${telefoneLimpo}" target="_blank" class="flex items-center gap-2 text-green-600 hover:text-green-700 transition-colors font-medium">
        <i class="bi bi-whatsapp text-[18px]" aria-hidden="true"></i>
      </a>
    `;
    infoStack.appendChild(waRow);
  }
  mb4.appendChild(infoStack);
  card.appendChild(mb4);

  // Footer / Buttons
  const footer = document.createElement('div');
  footer.className = 'border-t border-slate-100 dark:border-slate-800 pt-4 mt-auto';

  const ICON_SYMBOL_MAP = {
    'check-circle': 'task_alt',
    'calendar-plus': 'event_available',
    'bell-slash': 'notifications_off',
    'bell': 'notifications',
    'journal-medical': 'medical_information',
    'chat-dots': 'chat_bubble',
    'swap-horiz': 'swap_horizontal_circle',
    'pencil': 'edit',
    'trash': 'delete',
    'person-dash': 'person_remove',
    'person-check': 'person_add',
  };

  const createBtn = (icon, title, classes, onClick) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `btn-icon ${classes}`;
    btn.setAttribute('data-tooltip', title);
    const symbol = ICON_SYMBOL_MAP[icon] ?? icon;
    btn.innerHTML = `<span class="material-symbols-outlined text-[18px]">${symbol}</span>`;
    if (onClick) btn.onclick = onClick;
    return btn;
  };

  const actionButtons = document.createElement('div');
  actionButtons.className = 'action-buttons';

  const primaryActions = document.createElement('div');
  primaryActions.className = 'primary-actions d-flex gap-2';

  const secondaryActions = document.createElement('div');
  secondaryActions.className = 'secondary-actions d-flex gap-2';

  if (paciente.paciente_ativo) {
    if (paciente.lembretes_ativos && paciente.grupo_regra_atual) {
      const btnContact = createBtn('check-circle', 'Registrar Contato', 'btn-success', () =>
        openContactModal({ id: paciente.id, name: paciente.nome, type: paciente.nome_lembrete })
      );
      primaryActions.appendChild(btnContact);
    }

    const btnConsulta = createBtn('calendar-plus', 'Registrar Consulta', 'btn-primary', () =>
      openRegistrarConsultaModal({ id: paciente.id, name: paciente.nome })
    );
    primaryActions.appendChild(btnConsulta);
  } else {
    const btnReactivate = createBtn('person-check', 'Reativar', 'btn-success', () =>
      openActivatePatientModal({ id: paciente.id, name: paciente.nome })
    );
    primaryActions.appendChild(btnReactivate);
  }

  if (paciente.paciente_ativo && paciente.lembretes_ativos && paciente.grupo_regra_atual) {
    const btnDisableVal = createBtn('bell-slash', 'Desativar Lembretes', 'btn-warning', () =>
      openDisableLembreteModal({ id: paciente.id, name: paciente.nome })
    );
    secondaryActions.appendChild(btnDisableVal);
  } else if (paciente.paciente_ativo && paciente.grupo_regra_atual && !paciente.lembretes_ativos) {
    const btnEnableVal = createBtn('bell', 'Habilitar Lembretes', 'btn-outline-primary', () =>
      openEnableLembreteModal({ id: paciente.id, name: paciente.nome })
    );
    secondaryActions.appendChild(btnEnableVal);
  }

  const btnHistConsult = createBtn('journal-medical', 'Histórico de Consultas', 'btn-outline-primary', () =>
    openHistoricoConsultaModal({ id: paciente.id })
  );
  const btnHistContato = createBtn('chat-dots', 'Histórico de Contatos', 'btn-outline-secondary', () =>
    openHistoricoContatoModal({ id: paciente.id })
  );
  secondaryActions.appendChild(btnHistConsult);
  secondaryActions.appendChild(btnHistContato);

  const btnRule = createBtn('swap-horiz', 'Alterar Regra', 'btn-outline-primary', () =>
    openAtribuirGrupoModal(paciente.id)
  );
  secondaryActions.appendChild(btnRule);

  const btnEdit = createBtn('pencil', 'Editar Paciente', 'btn-outline-primary', () =>
    openEditarInfoPacientesModal({ patient: paciente })
  );
  secondaryActions.appendChild(btnEdit);

  const btnDelete = createBtn('trash', 'Excluir', 'btn-outline-danger', () =>
    openExcluirPatientModal({ patient: paciente })
  );
  secondaryActions.appendChild(btnDelete);

  const toggleBtn = paciente.paciente_ativo
    ? createBtn('person-dash', 'Desativar', 'btn-secondary', () =>
      openDeactivatePatientModal({ id: paciente.id, name: paciente.nome })
    )
    : createBtn('person-check', 'Reativar', 'btn-success', () =>
      openActivatePatientModal({ id: paciente.id, name: paciente.nome })
    );
  secondaryActions.appendChild(toggleBtn);

  actionButtons.appendChild(primaryActions);
  actionButtons.appendChild(secondaryActions);
  footer.appendChild(actionButtons);
  card.appendChild(footer);

  return card;
}

const contactModalEl = document.getElementById('contactModal');
const hideContactModal = () => {
  if (contactModalEl) {
    contactModalEl.classList.add('hidden');
    reabrirCalendarioSeMarcado(contactModalEl);
  }
};
const showContactModal = () => {
  if (contactModalEl) {
    marcarProximoModalParaRetorno(contactModalEl);
    contactModalEl.classList.remove('hidden');
  }
};
const contactPatientNameEl = document.getElementById('contact-patient-name');
const contactPatientIdEl = document.getElementById('contact-patient-id');

// Cache simples para evitar refetch ao abrir o modal de contato repetidas vezes.
const MATERIAIS_CACHE_VERSION_KEY = 'pos_consulta:materiais_version';
const MATERIAIS_CACHE_TTL_MS = 60 * 60 * 1000; // 1h
const MATERIAIS_REGRA_CACHE_TTL_MS = 10 * 60 * 1000; // 10min

const getMateriaisCacheVersion = () => {
  try {
    return localStorage.getItem(MATERIAIS_CACHE_VERSION_KEY) || '0';
  } catch (e) {
    return '0';
  }
};

let materiaisCache = null;
let materiaisCacheFetchedAt = 0;
let materiaisCachePromise = null;
let materiaisCacheVersion = null;

function getMateriaisCached({ force = false } = {}) {
  const now = Date.now();
  const version = getMateriaisCacheVersion();
  const expired = now - materiaisCacheFetchedAt > MATERIAIS_CACHE_TTL_MS;
  const versionChanged = materiaisCacheVersion !== null && version !== materiaisCacheVersion;

  if (!force && materiaisCache && !expired && !versionChanged) {
    return Promise.resolve(materiaisCache);
  }
  if (!force && materiaisCachePromise) {
    return materiaisCachePromise;
  }

  materiaisCachePromise = fetch('/api/materiais/')
    .then((res) => {
      if (!res.ok) {
        throw new Error('Erro ao buscar materiais');
      }
      return res.json();
    })
    .then((data) => {
      materiaisCache = Array.isArray(data && data.materiais) ? data.materiais : [];
      materiaisCacheFetchedAt = Date.now();
      materiaisCacheVersion = version;
      materiaisCachePromise = null;
      return materiaisCache;
    })
    .catch((err) => {
      materiaisCachePromise = null;
      throw err;
    });

  return materiaisCachePromise;
}

const materiaisRegraCache = new Map(); // pacienteId -> { fetchedAt, materiais: string[] }
const materiaisRegraPromiseCache = new Map(); // pacienteId -> Promise<string[]>

function getMateriaisRegraCached(pacienteId, { force = false } = {}) {
  const key = String(pacienteId);
  const now = Date.now();
  const cached = materiaisRegraCache.get(key);
  const expired = cached ? (now - cached.fetchedAt > MATERIAIS_REGRA_CACHE_TTL_MS) : true;

  if (!force && cached && !expired) {
    return Promise.resolve(cached.materiais);
  }
  if (!force && materiaisRegraPromiseCache.has(key)) {
    return materiaisRegraPromiseCache.get(key);
  }

  const promise = fetch(`/api/pacientes/${pacienteId}/materiais-regra/`)
    .then((res) => {
      if (!res.ok) {
        throw new Error('Erro ao buscar materiais da regra');
      }
      return res.json();
    })
    .then((data) => {
      const preSelecionados = Array.isArray(data && data.materiais)
        ? data.materiais
          .map((material) => (material && material.descricao ? material.descricao.trim() : ''))
          .filter(Boolean)
        : [];
      materiaisRegraCache.set(key, { fetchedAt: Date.now(), materiais: preSelecionados });
      materiaisRegraPromiseCache.delete(key);
      return preSelecionados;
    })
    .catch((err) => {
      materiaisRegraPromiseCache.delete(key);
      throw err;
    });

  materiaisRegraPromiseCache.set(key, promise);
  return promise;
}

// Preload do catálogo de materiais no carregamento da página.
try {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => getMateriaisCached().catch(() => { }));
  } else {
    getMateriaisCached().catch(() => { });
  }
} catch (e) { }

function openContactModal(patient) {
  if (!contactModalEl || !contactPatientNameEl || !contactPatientIdEl) {
    return;
  }

  contactPatientNameEl.textContent = patient.name;
  contactPatientIdEl.value = patient.id;

  const contactTypeEl = document.getElementById('contact-type');
  if (contactTypeEl) {
    contactTypeEl.value = patient.type || '';
  }

  const notesEl = document.getElementById('contact-notes');
  if (notesEl) {
    notesEl.value = '';
  }

  const selectedContainer = document.getElementById('selected-materials');
  if (selectedContainer) {
    selectedContainer.innerHTML = '<span class="text-muted small">Carregando materiais da regra...</span>';
  }

  const suggestionsContainer = document.getElementById('material-suggestions');
  if (suggestionsContainer) {
    suggestionsContainer.innerHTML = '<span class="text-muted small">Carregando sugestões...</span>';
  }

  getMateriaisRegraCached(patient.id)
    .then((preSelecionados) => inicializarSelecaoMateriais(preSelecionados))
    .catch((error) => {
      console.error('Erro ao carregar materiais da regra:', error);
      inicializarSelecaoMateriais();
    });

  if (typeof window.atualizarSugestaoProximoContato === 'function') {
    window.atualizarSugestaoProximoContato(patient.id);
  }

  showContactModal();
}

if (contactModalEl) {
  document.querySelectorAll('[data-modal-hide="contactModal"]').forEach((btn) => {
    btn.addEventListener('click', hideContactModal);
  });
}

function openDisableLembreteModal(patient) {

  const disableLembreteModalEl = document.getElementById('desabilitarLembrete');
  const disableLembreteModal = new bootstrap.Modal(disableLembreteModalEl);
  const nomePaciente = document.getElementById('patient-name-disable');
  const idPaciente = document.getElementById('disable-patient-id');

  nomePaciente.textContent = patient.name;
  idPaciente.value = patient.id;

  marcarProximoModalParaRetorno(disableLembreteModalEl);
  disableLembreteModal.show();
}

// Utilidade: fecha modal por id, com suporte a Bootstrap ou fallback ocultando
function fecharModalPorId(id) {
  const el = document.getElementById(id);
  if (!el) return;

  if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
    const instance = bootstrap.Modal.getInstance(el) || new bootstrap.Modal(el);
    instance.hide();
  } else {
    el.classList.add('hidden');
    reabrirCalendarioSeMarcado(el);
  }
}

function openRegistrarConsultaModal(patient) {

  const disableLembreteModalEl = document.getElementById('registrarConsultaModal');
  const disableLembreteModal = new bootstrap.Modal(disableLembreteModalEl);
  const nomePaciente = document.getElementById('consulta-patient-name');
  const idPaciente = document.getElementById('consulta-patient-id');

  nomePaciente.textContent = patient.name;
  idPaciente.value = patient.id;

  marcarProximoModalParaRetorno(disableLembreteModalEl);
  disableLembreteModal.show();
}

async function openHistoricoConsultaModal(patient) {
  // Abre o modal imediatamente e mostra loading
  const historicoConsultaModalEl = document.getElementById('consultasModal');
  const historicoConsultaModal = bootstrap.Modal.getInstance(historicoConsultaModalEl) || new bootstrap.Modal(historicoConsultaModalEl);
  const modalBody = document.getElementById('consultas-historico-body');
  modalBody.innerHTML = '<div class="text-center text-secondary py-3"><div class="spinner-border spinner-border-sm"></div> Carregando...</div>';
  marcarProximoModalParaRetorno(historicoConsultaModalEl);
  historicoConsultaModal.show();

  try {
    const response = await fetch(`/api/historico-consulta/${patient.id}/`);
    if (!response.ok) throw new Error('Erro ao buscar histórico');
    const data = await response.json();

    if (data.consultas && data.consultas.length > 0) {
      modalBody.innerHTML = data.consultas.map(consulta => {
        const tipo = consulta.tipo_consulta === 'retorno'
          ? '<span class="history-type text-info">Retorno</span>'
          : '<span class="history-type text-success">Consulta</span>';
        return `
          <div class="history-item consulta mb-3">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <div>
                ${tipo}
                <div class="history-date">${consulta.data_consulta}</div>
              </div>
            </div>
          </div>
        `;
      }).join('');
    } else {
      modalBody.innerHTML = '<div class="text-center text-secondary py-3">Nenhuma consulta registrada.</div>';
    }
  } catch (e) {
    modalBody.innerHTML = '<div class="text-danger text-center py-3">Erro ao carregar histórico.</div>';
  }
}

async function openHistoricoContatoModal(patient) {
  // Abre o modal imediatamente e mostra loading
  const historicoContatoModalEl = document.getElementById('contatosModal');
  const historicoContatoModal = bootstrap.Modal.getInstance(historicoContatoModalEl) || new bootstrap.Modal(historicoContatoModalEl);
  const body = document.getElementById('contatosModalBody');
  body.innerHTML = '<div class="text-center text-secondary py-3"><div class="spinner-border spinner-border-sm"></div> Carregando...</div>';
  marcarProximoModalParaRetorno(historicoContatoModalEl);
  historicoContatoModal.show();

  try {
    const resp = await fetch(`/api/historico-contatos/${patient.id}/`);
    if (!resp.ok) throw new Error('Erro ao buscar histórico');
    const data = await resp.json();

    if (!data.contatos || data.contatos.length === 0) {
      body.innerHTML = '<div class="text-center text-secondary py-3"><i class="bi bi-info-circle"></i> Nenhum contato registrado.</div>';
    } else {
      body.innerHTML = data.contatos.map(contato => {
        // Formata data/hora
        const dataContato = contato.criado_em ? new Date(contato.criado_em) : null;
        const dataFormatada = dataContato
          ? dataContato.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) +
          ' - ' +
          dataContato.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          : '';

        // Tipo de contato (badge)
        let tipoBadge = '';
        if (contato.tipo) {
          if (contato.tipo.toLowerCase() === 'whatsapp') {
            tipoBadge = '<span class="badge bg-warning text-dark">WhatsApp</span>';
          } else if (contato.tipo.toLowerCase() === 'telefone') {
            tipoBadge = '<span class="badge bg-primary">Telefone</span>';
          } else {
            tipoBadge = `<span class="badge bg-secondary">${contato.tipo}</span>`;
          }
        }

        // Anotações e materiais
        let anotacoesHtml = '';
        if (contato.anotacoes && contato.anotacoes.length > 0) {
          anotacoesHtml = contato.anotacoes.map(anotacao => {
            let materiaisHtml = '';
            if (anotacao.materiais_enviados && anotacao.materiais_enviados.length > 0) {
              materiaisHtml = `
                <div class="materials-list">
                  <strong>Materiais entregues:</strong>
                  ${anotacao.materiais_enviados.map(mat => `
                    <div class="material-item">
                      <i class="bi bi-file-earmark-text me-1"></i> ${mat.descricao || ''}
                    </div>
                  `).join('')}
                </div>
              `;
            }
            return `
              <p class="mb-2"><strong>Anotação:</strong> ${anotacao.texto || ''}</p>
              ${materiaisHtml}
            `;
          }).join('');
        }

        return `
          <div class="history-item contato mb-4 pb-2 border-bottom">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <div>
                <span class="history-type text-warning">Contato</span>
                <div class="history-date">${dataFormatada}</div>
              </div>
              ${tipoBadge}
            </div>
            ${anotacoesHtml}
          </div>
        `;
      }).join('');
    }
  } catch (e) {
    body.innerHTML = '<div class="text-danger text-center py-3">Erro ao carregar histórico de contatos.</div>';
  }
}

// Função para abrir o modal e preencher os campos
function openEditarInfoPacientesModal(patient) {

  document.getElementById('editarPacienteId').value = patient.patient.id;
  document.getElementById('nomeInput').value = patient.patient.nome || '';
  document.getElementById('telefoneInput').value = patient.patient.telefone || '';
  const editarInfoPacienteModal = new bootstrap.Modal(document.getElementById('editarPacienteModal'));
  marcarProximoModalParaRetorno(document.getElementById('editarPacienteModal'));
  editarInfoPacienteModal.show();
}

// Evento para enviar PUT ao editar paciente
function inicializarEdicaoPaciente() {
  const btn = document.getElementById('salvarEdicaoPacienteBtn');

  if (btn && !btn.dataset.listenerAdded) {
    btn.dataset.listenerAdded = 'true';

    btn.addEventListener('click', async function () {
      const clearLoading = setButtonLoading(btn);

      const id = document.getElementById('editarPacienteId').value;
      const nome = document.getElementById('nomeInput').value;
      const telefone = document.getElementById('telefoneInput').value;

      const data = { nome, telefone };

      try {
        const response = await fetch(`/api/editar-paciente/${id}/`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': (document.querySelector('[name=csrfmiddlewaretoken]') || {}).value || ''
          },
          body: JSON.stringify(data)
        });

        if (response.ok) {
          bootstrap.Modal.getInstance(document.getElementById('editarPacienteModal'))?.hide();
          // listarPacientes();
          atualizarCardPaciente(id);
          showToast('Paciente atualizado com sucesso!', 'success');
        } else {
          showToast('Erro ao atualizar paciente.', 'error');
        }
      } catch (e) {
        showToast('Erro de conex?o ao atualizar paciente.', 'error');
      } finally {
        clearLoading();
      }
    });
  }
}

function openEnableLembreteModal(patient) {

  const enableLembreteModal = new bootstrap.Modal(document.getElementById('habilitarLembrete'));
  const nomePaciente = document.getElementById('patient-name-enable');
  const idPaciente = document.getElementById('enable-patient-id');

  nomePaciente.textContent = patient.name;
  idPaciente.value = patient.id;

  marcarProximoModalParaRetorno(document.getElementById('habilitarLembrete'));
  enableLembreteModal.show();
}

function openAtribuirGrupoModal(patient) {

  document.getElementById('paciente-id').value = patient;

  const ultimaConsultaEl = document.getElementById('atribuir-ultima-consulta');
  const dataInicioEl = document.getElementById('atribuir-data-inicio');
  if (ultimaConsultaEl) {
    ultimaConsultaEl.textContent = 'Última consulta: carregando...';
  }
  if (dataInicioEl) {
    dataInicioEl.value = '';
  }

  const modalAtribuirGrupoEl = document.getElementById('atribuirGrupoModal');
  const modalAtribuirGrupo = bootstrap.Modal.getInstance(modalAtribuirGrupoEl) || new bootstrap.Modal(modalAtribuirGrupoEl);

  marcarProximoModalParaRetorno(modalAtribuirGrupoEl);
  modalAtribuirGrupo.show();

  carregarGrupoRegras();

  fetch(`/api/paciente/${patient}/`)
    .then((res) => res.json())
    .then((data) => {
      const ultima = data?.ultima_consulta || null;
      if (ultimaConsultaEl) {
        const formatarPtBr = (valor) => {
          if (!valor) return null;
          // Evita bug de fuso (YYYY-MM-DD vira UTC e pode voltar 1 dia no pt-BR)
          if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valor)) {
            const [y, m, d] = valor.slice(0, 10).split('-').map(Number);
            if ([y, m, d].some((n) => Number.isNaN(n))) return null;
            return new Date(y, m - 1, d).toLocaleDateString('pt-BR');
          }
          const d = new Date(valor);
          if (Number.isNaN(d.getTime())) return null;
          return d.toLocaleDateString('pt-BR');
        };
        const ultimaFmt = formatarPtBr(ultima);
        ultimaConsultaEl.textContent = ultimaFmt ? `Última consulta foi dia ${ultimaFmt}` : 'Última consulta não informada.';
      }
      if (dataInicioEl) {
        const hoje = new Date();
        const hojeIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
        dataInicioEl.value = (typeof ultima === 'string' && ultima.length >= 10) ? ultima.slice(0, 10) : hojeIso;
      }
    })
    .catch(() => {
      if (ultimaConsultaEl) {
        ultimaConsultaEl.textContent = 'Última consulta não informada.';
      }
    });

}

function openDeactivatePatientModal(patient) {

  const deactivatePatientModalEl = document.getElementById('desativarPacienteModal');
  const deactivatePatientModal = new bootstrap.Modal(deactivatePatientModalEl);
  const nomePaciente = document.getElementById('patient-name-deactivate');
  const idPaciente = document.getElementById('deactivate-patient-id');

  nomePaciente.textContent = patient.name;
  idPaciente.value = patient.id;

  marcarProximoModalParaRetorno(deactivatePatientModalEl);
  deactivatePatientModal.show();
}

function openExcluirPatientModal(patient) {

  const excluirPatientModalEl = document.getElementById('excluirPacienteModal');
  const excluirPatientModal = new bootstrap.Modal(excluirPatientModalEl);
  const nomePaciente = document.getElementById('patient-name-excluir');
  const idPaciente = document.getElementById('excluir-patient-id');

  nomePaciente.textContent = patient.patient.nome;
  idPaciente.value = patient.patient.id;

  marcarProximoModalParaRetorno(excluirPatientModalEl);
  excluirPatientModal.show();
}

function openActivatePatientModal(patient) {

  const reativarPatientModalEl = document.getElementById('reativarPacienteModal');
  const reativarPatientModal = new bootstrap.Modal(reativarPatientModalEl);
  const nomePaciente = document.getElementById('patient-name-reactivate');
  const idPaciente = document.getElementById('reactivate-patient-id');

  nomePaciente.textContent = patient.name;
  idPaciente.value = patient.id;

  marcarProximoModalParaRetorno(reativarPatientModalEl);
  reativarPatientModal.show();
}

// Função para abrir o modal de exclusão e esconder o de edição
function openModalExcluirGrupo() {
  // Esconde o modal de editar grupo
  const editarGrupoModalEl = document.getElementById('editarGrupo');
  const editarGrupoModal = bootstrap.Modal.getInstance(editarGrupoModalEl) || new bootstrap.Modal(editarGrupoModalEl);
  editarGrupoModal.hide();

  // Abre o modal de confirmação de exclusão
  const modalEl = document.getElementById('confirmarExclusaoGrupoModal');
  const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
  modal.show();
}

// Botão "Excluir" no modal de editar grupo
function inicializarBotaoExcluirGrupo() {
  const btn = document.getElementById('excluirGrupoBtn');
  if (btn && !btn.dataset.listenerAdded) {
    btn.dataset.listenerAdded = 'true';
    btn.addEventListener('click', openModalExcluirGrupo);
  }
}

function inicializarBotaoEditarGrupo() {
  const btn = document.getElementById('excluirGrupoBtn');
  if (btn && !btn.dataset.listenerAdded) {
    btn.dataset.listenerAdded = 'true';
    btn.addEventListener('click', openModalExcluirGrupo);
  }
}

// Botão "Voltar" no modal de confirmação de exclusão
function inicializarVoltarEditarGrupo() {
  const voltarBtn = document.getElementById('voltar-editar-grupo-btn');
  if (voltarBtn && !voltarBtn.dataset.listenerAdded) {
    voltarBtn.dataset.listenerAdded = 'true';

    voltarBtn.addEventListener('click', () => {
      const excluirModal = bootstrap.Modal.getInstance(document.getElementById('confirmarExclusaoGrupoModal'));
      if (excluirModal) excluirModal.hide();

      const editarModalEl = document.getElementById('editarGrupo');
      let editarModal = bootstrap.Modal.getInstance(editarModalEl);

      if (!editarModal) {
        editarModal = new bootstrap.Modal(editarModalEl, { show: false }); // prevenindo auto-show
      }

      editarModal.show(); // só aqui que realmente mostra
    });
  }
}

// ao clicar no botão registrar-contato deve enviar uma requisição post para o servidor
function inicializarRegistroConsulta() {
  const btn = document.getElementById('btn-registrar-consulta');

  if (btn && !btn.dataset.listenerAdded) {
    btn.dataset.listenerAdded = 'true';

    btn.addEventListener('click', async (event) => {
      event.preventDefault();

      const idPaciente = document.getElementById('consulta-patient-id').value;
      const tipoConsulta = document.getElementById('consulta-tipo').value;
      const dataConsulta = document.getElementById('consulta-data').value;
      const submitBtn = btn;

      // RETIRANDO A VERIFICAÇÃO DE DATA FUTURA AO REGISTRAR CONSULTA

      // const hoje = new Date();
      // const dataSelecionada = new Date(dataConsulta);
      // if (dataSelecionada > hoje) {
      //   showToast('A data da consulta não pode ser no futuro.', 'error');
      //   return;
      // }

      const clearLoading = setButtonLoading(submitBtn);

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
          // listarPacientes();
          atualizarCardPaciente(idPaciente);
          showToast(result.mensagem, 'success');
        } else {
          showToast(result.erro || 'Erro ao registrar consulta.', 'error');
        }
      } catch (err) {
        showToast('Erro inesperado ao registrar consulta.', 'error');
      } finally {
        clearLoading();
      }
    });
  }
}

// ao clicar no botão confirm-reactivate-patient deve enviar uma requisição post para o servidor
function inicializarReativarPaciente() {
  const btn = document.getElementById('confirm-reactivate-patient');

  if (btn && !btn.dataset.listenerAdded) {
    btn.dataset.listenerAdded = 'true';

    btn.addEventListener('click', async () => {
      const idPaciente = document.getElementById('reactivate-patient-id').value;
      const submitBtn = btn;
      const clearLoading = setButtonLoading(submitBtn);

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
          // listarPacientes();
          atualizarCardPaciente(idPaciente);
          showToast(result.mensagem, 'success');
        } else {
          showToast(result.erro || 'Erro ao desativar paciente.', 'error');

          // Fechar modal atual
          const modalInstance = bootstrap.Modal.getInstance(document.getElementById('reativarPacienteModal'))
            || new bootstrap.Modal(document.getElementById('reativarPacienteModal'));
          modalInstance.hide();

          // Abrir modal de atribuição de grupo
          openAtribuirGrupoModal(idPaciente);
        }
      } catch (err) {
        showToast('Erro inesperado ao desativar paciente.', 'error');
      } finally {
        clearLoading();
      }
    });
  }
}

// ao clicar no botão confirm-deactivate-patient deve enviar uma requisição post para o servidor
function inicializarDesativarPaciente() {
  const btn = document.getElementById('confirm-deactivate-patient');

  if (btn && !btn.dataset.listenerAdded) {
    btn.dataset.listenerAdded = 'true';

    btn.addEventListener('click', async () => {
      const idPaciente = document.getElementById('deactivate-patient-id').value;
      const submitBtn = btn;
      const clearLoading = setButtonLoading(submitBtn);

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
          // listarPacientes();
          atualizarCardPaciente(idPaciente);
          showToast(result.mensagem, 'success');
        } else {
          showToast(result.erro || 'Erro ao desativar paciente.', 'error');
        }
      } catch (err) {
        showToast('Erro inesperado ao desativar paciente.', 'error');
      } finally {
        clearLoading();
      }
    });
  }
}

// ao clicar no botão confirm-excluir-patient deve enviar uma requisição post para o servidor
function inicializarExcluirPaciente() {
  const btn = document.getElementById('confirm-excluir-patient');

  if (btn && !btn.dataset.listenerAdded) {
    btn.dataset.listenerAdded = 'true';

    btn.addEventListener('click', async () => {
      const idPaciente = document.getElementById('excluir-patient-id').value;
      const submitBtn = btn;
      const clearLoading = setButtonLoading(submitBtn);

      try {
        const response = await fetch(`/api/status-paciente/${idPaciente}/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken'),
          },
          body: JSON.stringify({ estado: 'excluir' }),
        });

        const result = await response.json();

        if (response.ok) {
          const modalInstance = bootstrap.Modal.getInstance(document.getElementById('excluirPacienteModal'));
          modalInstance?.hide();
          // listarPacientes();
          removerCardPaciente(idPaciente);
          atualizarCards();
          showToast(result.mensagem, 'success');
        } else {
          showToast(result.erro || 'Erro ao excluir paciente.', 'error');
        }
      } catch (err) {
        showToast('Erro inesperado ao excluir paciente.', 'error');
      } finally {
        clearLoading();
      }
    });
  }
}

// ao clicar no botão confirm-disable-reminder deve enviar uma requisição post para o servidor
function inicializarDesativarLembrete() {
  const btn = document.getElementById('confirm-disable-reminder');

  if (btn && !btn.dataset.listenerAdded) {
    btn.dataset.listenerAdded = 'true';

    btn.addEventListener('click', async () => {
      const idPaciente = document.getElementById('disable-patient-id').value;
      const submitBtn = btn;
      const clearLoading = setButtonLoading(submitBtn);

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
          // listarPacientes();
          atualizarCardPaciente(idPaciente);
          showToast(result.mensagem, 'success');
        } else {
          showToast(result.erro || 'Erro ao desabilitar lembrete.', 'error');
        }
      } catch (err) {
        showToast('Erro inesperado ao desabilitar lembrete.', 'error');
      } finally {
        clearLoading();
      }
    });
  }
}

// ao clicar no botão confirm-enable-reminder deve enviar uma requisição post para o servidor
function inicializarHabilitarLembrete() {
  const btn = document.getElementById('confirm-enable-reminder');

  if (btn && !btn.dataset.listenerAdded) {
    btn.dataset.listenerAdded = 'true';

    btn.addEventListener('click', async () => {
      const idPaciente = document.getElementById('enable-patient-id').value;
      const submitBtn = btn;
      const clearLoading = setButtonLoading(submitBtn);

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
          // listarPacientes();
          atualizarCardPaciente(idPaciente);
          showToast(result.mensagem, 'success');
        } else {
          showToast(result.erro || 'Erro ao habilitar lembrete.', 'error');
        }
      } catch (err) {
        showToast('Erro inesperado ao habilitar lembrete.', 'error');
      } finally {
        clearLoading();
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (!paginaHomeDisponivel()) {
    return;
  }

  const form = document.getElementById('patient-form');
  if (!form.dataset.listenerAdded) {
    form.dataset.listenerAdded = 'true';

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('button[type="submit"]');
      const clearLoading = setButtonLoading(submitBtn);

      const nome = document.getElementById('name').value.trim();
      const telefone = document.getElementById('phone').value.trim();
      const dataConsulta = document.getElementById('lastConsultation').value;
      const tipoConsulta = document.getElementById('tipoConsulta').value;

      // ========= DESABILITANDO A VERIFICAÇÃO DE DATA MAIOR QUE HOJE PARA CONSULTA

      // const hoje = new Date();
      // if (new Date(dataConsulta) > hoje) {
      //   showToast('A data da última consulta não pode ser no futuro.', 'error');
      //   submitBtn.disabled = false;
      //   if (submitBtn.querySelector('#saving-spinner')) {
      //     submitBtn.removeChild(submitBtn.querySelector('#saving-spinner'));
      //   }
      //   return;
      // } 

      const payload = {
        nome: nome,
        telefone: telefone,
        data_ultima_consulta: dataConsulta,
        tipo_consulta: tipoConsulta,
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

          showToast(result.mensagem, 'success');

          const modalAtribuirGrupoEl = document.getElementById('atribuirGrupoModal');
          const modalAtribuirGrupo = bootstrap.Modal.getInstance(modalAtribuirGrupoEl) || new bootstrap.Modal(modalAtribuirGrupoEl);

          carregarGrupoRegras();

          document.getElementById('paciente-id').value = result.id_paciente;

          modalAtribuirGrupo.show();

          listarPacientes();
          atualizarCardPaciente(result.id_paciente);

        } else {
          showToast(result.erro, 'error');
        }
      } catch (err) {
        showToast('Erro inesperado ao cadastrar paciente.', 'error');
      } finally {
        clearLoading();
      }


    });
  }
});

function inicializarFormularioAtribuirGrupo() {
  const form = document.getElementById('atribuir-grupo-form');

  if (form && !form.dataset.listenerAdded) {
    form.dataset.listenerAdded = 'true';

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      const grupoId = document.getElementById('grupo-select').value;
      const pacienteId = document.getElementById('paciente-id').value;
      const dataInicio = document.getElementById('atribuir-data-inicio')?.value;

      if (!dataInicio) {
        showToast('Informe a data de início da contagem.', 'error');
        return;
      }

      const modalAtribuirGrupoModalEl = document.getElementById('atribuirGrupoModal');
      const modalAtribuirGrupoModal = bootstrap.Modal.getInstance(modalAtribuirGrupoModalEl)
        || new bootstrap.Modal(modalAtribuirGrupoModalEl);

      const submitBtn = form.querySelector('button[type="submit"]');
      const clearLoading = setButtonLoading(submitBtn);

      fetch(`/api/atribuir-grupo/${grupoId}/${pacienteId}/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify({ data_inicio: dataInicio })
      })
        .then(res => res.json())
        .then((data) => {
          if (data && data.erro) {
            throw new Error(data.erro);
          }
          form.reset();
          modalAtribuirGrupoModal.hide(); // Fecha modal

          // Atualiza o card do paciente
          // fetch(`/api/paciente/${pacienteId}/`)
          //   .then(res => res.json())
          //   .then(updated => {
          //     const container = document.getElementById('patients-container');
          //     const oldCard = container.querySelector(`[data-paciente-id="${updated.id}"]`);
          //     const newCard = renderizarCardPaciente(updated);
          //     if (oldCard) {
          //       container.replaceChild(newCard, oldCard);
          //     }
          // });
          atualizarCardPaciente(pacienteId);

          showToast('Sucesso!', 'success');
        })
        .catch((err) => {
          showToast(err?.message || 'Erro ao atribuir grupo.', 'error');
        })
        .finally(() => {
          clearLoading();
        });
    });
  }
}

function carregarGrupoRegras() {

  const selectGrupo = document.getElementById('grupo-select');
  if (selectGrupo) {
    selectGrupo.innerHTML = '';
    const loadingOption = document.createElement('option');
    loadingOption.value = '';
    loadingOption.textContent = 'Carregando...';
    loadingOption.disabled = true;
    loadingOption.selected = true;
    selectGrupo.appendChild(loadingOption);
  }

  fetch('/api/grupo-regras/?com_regras=true')
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

// Coloca o botÇœo em estado de loading e devolve uma funÇõÇœo para limpar
function setButtonLoading(button) {
  if (!button) return () => {};
  button.disabled = true;
  button.classList.add('loading');

  let spinner = button.querySelector('.btn-spinner');
  if (!spinner) {
    spinner = document.createElement('span');
    spinner.className = 'btn-spinner ml-2 inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin';
    spinner.setAttribute('role', 'status');
    spinner.setAttribute('aria-hidden', 'true');
    button.appendChild(spinner);
  }

  return () => {
    button.disabled = false;
    button.classList.remove('loading');
    const existing = button.querySelector('.btn-spinner');
    if (existing) {
      existing.remove();
    }
  };
}

export function inicializarSelecaoMateriais(preSelecionados = []) {
  const suggestionsContainer = document.getElementById('material-suggestions');
  const selectedContainer = document.getElementById('selected-materials');
  if (!suggestionsContainer || !selectedContainer) {
    return;
  }

  const normalizar = (nome) => (nome || '').trim();
  const selectedMaterials = new Map();

  const formatarTipo = (tipo) => {
    const valor = (tipo || '').trim().toLowerCase();
    if (!valor) return '';
    const labels = {
      pdf: 'PDF',
      video: 'Video',
      imagem: 'Imagem',
      foto: 'Foto',
      youtube: 'YouTube'
    };
    return labels[valor] || valor;
  };

  function renderSelected() {
    selectedContainer.innerHTML = '';

    if (!selectedMaterials.size) {
      const vazio = document.createElement('span');
      vazio.className = 'text-muted small';
      vazio.textContent = 'Nenhum material selecionado.';
      selectedContainer.appendChild(vazio);
      return;
    }

    selectedMaterials.forEach((tipo, nome) => {
      const pill = document.createElement('div');
      pill.className = 'material-pill';
      pill.dataset.materialName = nome;
      const tipoLabel = formatarTipo(tipo);
      const tipoSpan = tipoLabel ? `<span class="material-pill-type">${tipoLabel}</span>` : '';
      pill.innerHTML = `${nome}${tipoSpan} <i class="bi bi-x-circle-fill" title="Remover"></i>`;

      const removerBtn = pill.querySelector('i');
      if (removerBtn) {
        removerBtn.addEventListener('click', () => {
          selectedMaterials.delete(nome);
          renderSelected();
        });
      }

      selectedContainer.appendChild(pill);
    });
  }

  function addMaterial(nome, tipo) {
    const valor = normalizar(nome);
    if (!valor || selectedMaterials.has(valor)) {
      return;
    }
    selectedMaterials.set(valor, tipo || '');
    renderSelected();
  }

  suggestionsContainer.innerHTML = '';
  selectedContainer.innerHTML = '';

  preSelecionados
    .map(normalizar)
    .filter(Boolean)
    .forEach((nome) => selectedMaterials.set(nome, ''));

  renderSelected();

  suggestionsContainer.innerHTML = '<span class="text-muted small">Carregando sugestões...</span>';

  getMateriaisCached()
    .then((materiais) => {
      suggestionsContainer.innerHTML = '';

      if (!materiais || !materiais.length) {
        suggestionsContainer.innerHTML = '<span class="text-muted small">Voce ainda nao cadastrou nenhum material. <a class="btn btn-outline-primary btn-sm ms-2" target="_blank" rel="noopener noreferrer" href="/materiais/">Clique aqui para adicionar materiais</a></span>';
        return;
      }

      materiais.forEach((material) => {
        const descricao = normalizar(material.descricao);
        if (!descricao) {
          return;
        }

        const tipoLabel = formatarTipo(material.tipo_arquivo);
        const chip = document.createElement('div');
        chip.className = 'material-chip';
        chip.textContent = tipoLabel ? `${descricao} (${tipoLabel})` : descricao;
        chip.dataset.materialId = material.id;
        chip.dataset.materialType = material.tipo_arquivo || '';
        chip.addEventListener('click', () => addMaterial(descricao, material.tipo_arquivo));
        suggestionsContainer.appendChild(chip);
      });
    })
    .catch((error) => {
      console.error('Erro ao carregar materiais:', error);
      suggestionsContainer.innerHTML = '<span class="text-danger small">Voce ainda nao cadastrou nenhum material. <a class="btn btn-outline-primary btn-sm ms-2" target="_blank" rel="noopener noreferrer" href="/materiais/">Clique aqui para adicionar materiais</a></span>';
    });
}

function atualizarCards() {
  const cardTotalPatientes = document.getElementById('total-patients');
  const cardNovosPacientes = document.getElementById('new-patients-vs-last-month');
  const cardTendenciaPacientes = document.getElementById('patients-trend');
  const cardTotalLembretes = document.getElementById('active-alerts');
  const cardAgendadosHoje = document.getElementById('scheduled-today');
  const cardLembreteAtrasado = document.getElementById('lembrete-atrasado');
  const cardSemRegra = document.getElementById('patients-no-rule');

  if (!cardTotalPatientes || !cardTotalLembretes || !cardLembreteAtrasado) {
    return;
  }

  // Mostra spinner de loading em cada card
  cardTotalPatientes.innerHTML = `<span class="spinner-border text-primary" role="status"></span>`;
  if (cardNovosPacientes) {
    cardNovosPacientes.textContent = 'Carregando...';
  }
  if (cardTendenciaPacientes) {
    cardTendenciaPacientes.className = 'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-slate-400';
    cardTendenciaPacientes.textContent = '';
  }
  cardTotalLembretes.innerHTML = `<span class="spinner-border text-primary" role="status"></span>`;
  if (cardAgendadosHoje) {
    cardAgendadosHoje.textContent = 'Carregando...';
  }
  cardLembreteAtrasado.innerHTML = `<span class="spinner-border text-primary" role="status"></span>`;
  if (cardSemRegra) {
    cardSemRegra.innerHTML = `<span class="spinner-border text-primary" role="status"></span>`;
  }

  fetch('/api/cards-home/')
    .then(response => response.json())
    .then(data => {
      cardTotalPatientes.textContent = data.total_pacientes;
      if (cardTendenciaPacientes) {
        const novosMes = Number(data.novos_pacientes_mes ?? 0);
        const novosMesPassado = Number(data.novos_pacientes_mes_passado ?? 0);
        let variacao = 0;
        if (novosMesPassado > 0) {
          variacao = Math.round(((novosMes - novosMesPassado) / novosMesPassado) * 100);
        } else if (novosMes > 0) {
          variacao = 100;
        }

        const sinal = variacao > 0 ? '+' : '';
        if (variacao > 0) {
          cardTendenciaPacientes.className = 'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold bg-green-100 text-green-700';
          cardTendenciaPacientes.innerHTML = `<span class="material-symbols-outlined text-[14px]">arrow_upward</span>${sinal}${variacao}%`;
        } else if (variacao < 0) {
          cardTendenciaPacientes.className = 'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold bg-red-100 text-red-700';
          cardTendenciaPacientes.innerHTML = `<span class="material-symbols-outlined text-[14px]">arrow_downward</span>${variacao}%`;
        } else {
          cardTendenciaPacientes.className = 'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold bg-slate-100 text-slate-500';
          cardTendenciaPacientes.innerHTML = `<span class="material-symbols-outlined text-[14px]">arrow_forward</span>0%`;
        }

        if (cardNovosPacientes) {
          cardNovosPacientes.textContent = 'vs mês passado';
        }
      } else if (cardNovosPacientes) {
        cardNovosPacientes.textContent = 'vs mês passado';
      }
      cardTotalLembretes.textContent = data.alertas_ativos;
      if (cardAgendadosHoje) {
        cardAgendadosHoje.textContent = `Agendados hoje: ${data.agendados_hoje ?? '-'}`;
      }
      cardLembreteAtrasado.textContent = data.lembretes_atrasados;
      if (cardSemRegra) {
        cardSemRegra.textContent = data.pacientes_sem_regra ?? '-';
      }
    })
    .catch(err => {
      showToast('Erro ao carregar estatisticas', 'error');
      cardTotalPatientes.textContent = '--';
      if (cardNovosPacientes) {
        cardNovosPacientes.textContent = '--';
      }
      if (cardTendenciaPacientes) {
        cardTendenciaPacientes.textContent = '';
      }
      cardTotalLembretes.textContent = '--';
      if (cardAgendadosHoje) {
        cardAgendadosHoje.textContent = '--';
      }
      cardLembreteAtrasado.textContent = '--';
      if (cardSemRegra) {
        cardSemRegra.textContent = '--';
      }
    });
}

