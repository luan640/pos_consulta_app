import { showToast } from './message.js';

const TAMANHO_PAGINA = 10;
let paginaAtual = 0;
let carregandoPacientes = false;
let listaCompletaCarregada = false;
let botaoCarregarMais;
let wrapperCarregarMais;
let modoVisualizacao = 'lista';
let calendarioMesAtual = null;
let calendarioAnoAtual = null;

const MESES_PT_BR = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

let carregandoCalendario = false;
let calendarioRequisicaoAtual = 0;

document.addEventListener('DOMContentLoaded', () => {
  botaoCarregarMais = document.getElementById('load-more-patients');
  wrapperCarregarMais = document.getElementById('load-more-wrapper');

  if (botaoCarregarMais) {
    botaoCarregarMais.addEventListener('click', () => listarPacientes(false));
  }

  inicializarControleVisualizacao();
  listarPacientes();
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
  const sort = document.getElementById('filter-sort')?.value?.trim() || '';

  return {
    nome,
    status,
    sort,
  };
}

export function listarPacientes(reset = true) {
  if (modoVisualizacao === 'calendario') {
    carregarCalendario();
    return;
  }

  if (carregandoPacientes || (!reset && listaCompletaCarregada)) {
    return;
  }

  const container = document.getElementById('patients-container');
  const listSection = document.getElementById('patients-list');
  const emptyState = document.getElementById('empty-state');

  if (!container || !listSection || !emptyState) {
    return;
  }

  mostrarVisualizacaoLista();

  if (reset) {
    paginaAtual = 0;
    listaCompletaCarregada = false;
  }

  const { nome: filtroNome, status: filtroStatus, sort: filtroSort } = obterFiltrosPacientes();

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
    const indicadorCarregando = document.createElement('div');
    indicadorCarregando.id = 'patients-loading-indicator';
    indicadorCarregando.className = 'text-center py-3';
    indicadorCarregando.innerHTML = '<div class="spinner-border text-primary" role="status"></div>';
    container.appendChild(indicadorCarregando);
    if (wrapperCarregarMais) {
      wrapperCarregarMais.classList.add('d-none');
    }
  }

  carregandoPacientes = true;

  fetch(`/api/pacientes/?${params.toString()}`)
    .then(response => response.json())
    .then(data => {
      const lista = data?.pacientes || [];
      const possuiMais = Boolean(data?.has_more);

      if (reset) {
        container.innerHTML = '';
      } else {
        const indicador = document.getElementById('patients-loading-indicator');
        if (indicador) {
          indicador.remove();
        }
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
}

function inicializarControleVisualizacao() {
  const botaoLista = document.getElementById('view-toggle-list');
  const botaoCalendario = document.getElementById('view-toggle-calendar');
  const botaoAnterior = document.getElementById('calendar-prev');
  const botaoProximo = document.getElementById('calendar-next');

  const hoje = new Date();
  calendarioMesAtual = hoje.getMonth();
  calendarioAnoAtual = hoje.getFullYear();
  atualizarCabecalhoCalendario();

  if (botaoLista && botaoCalendario) {
    atualizarEstadoBotoesVisualizacao(botaoLista, botaoCalendario);

    botaoLista.addEventListener('click', () => {
      if (modoVisualizacao === 'lista') {
        return;
      }
      modoVisualizacao = 'lista';
      atualizarEstadoBotoesVisualizacao(botaoLista, botaoCalendario);
      mostrarVisualizacaoLista();
      listarPacientes();
    });

    botaoCalendario.addEventListener('click', () => {
      if (modoVisualizacao === 'calendario') {
        return;
      }
      modoVisualizacao = 'calendario';
      atualizarEstadoBotoesVisualizacao(botaoLista, botaoCalendario);
      carregarCalendario();
    });
  }

  if (botaoAnterior) {
    botaoAnterior.addEventListener('click', () => {
      if (modoVisualizacao !== 'calendario') {
        return;
      }
      navegarCalendario(-1);
    });
  }

  if (botaoProximo) {
    botaoProximo.addEventListener('click', () => {
      if (modoVisualizacao !== 'calendario') {
        return;
      }
      navegarCalendario(1);
    });
  }
}

function atualizarEstadoBotoesVisualizacao(botaoLista, botaoCalendario) {
  if (!botaoLista || !botaoCalendario) {
    return;
  }

  const botaoAtivo = modoVisualizacao === 'lista' ? botaoLista : botaoCalendario;
  const botaoInativo = modoVisualizacao === 'lista' ? botaoCalendario : botaoLista;

  botaoAtivo.classList.add('active', 'btn-primary');
  botaoAtivo.classList.remove('btn-outline-primary');
  botaoAtivo.setAttribute('aria-pressed', 'true');

  botaoInativo.classList.remove('active', 'btn-primary');
  botaoInativo.classList.add('btn-outline-primary');
  botaoInativo.setAttribute('aria-pressed', 'false');
}

function mostrarVisualizacaoLista() {
  const listSection = document.getElementById('patients-list');
  const calendarSection = document.getElementById('calendar-view');

  if (calendarSection) {
    calendarSection.classList.add('d-none');
  }

  if (listSection) {
    listSection.classList.remove('d-none');
  }
}

function mostrarVisualizacaoCalendario() {
  const listSection = document.getElementById('patients-list');
  const calendarSection = document.getElementById('calendar-view');
  const emptyState = document.getElementById('empty-state');

  if (listSection) {
    listSection.classList.add('d-none');
  }

  if (calendarSection) {
    calendarSection.classList.remove('d-none');
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

  if (!titulo) {
    return;
  }

  if (calendarioMesAtual === null || calendarioAnoAtual === null) {
    titulo.textContent = '\u00A0';
    return;
  }

  titulo.textContent = `${MESES_PT_BR[calendarioMesAtual]} de ${calendarioAnoAtual}`;
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

    if (requisicaoId !== calendarioRequisicaoAtual) {
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

  const { nome, status, sort } = obterFiltrosPacientes();
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

    params.append('page', pagina.toString());
    params.append('page_size', '200');
    params.append('modo', 'calendario');
    params.append('mes', String(mes + 1));
    params.append('ano', String(ano));

    const response = await fetch(`/api/pacientes/?${params.toString()}`);

    if (!response.ok) {
      throw new Error('Erro ao carregar pacientes do calendário');
    }

    const data = await response.json();
    pacientesMes.push(...(data?.pacientes || []));
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

    if (pacientesDoDia.length > 0) {
      celula.classList.add('has-events');
      const contador = document.createElement('span');
      contador.className = 'calendar-day-count';
      contador.textContent = pacientesDoDia.length;
      cabecalhoDia.appendChild(contador);
    }

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
  elemento.className = `calendar-event calendar-event-${status}`;
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
  rodape.appendChild(menuAcoes);

  elemento.appendChild(cabecalho);
  elemento.appendChild(informacoes);
  elemento.appendChild(rodape);

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

  let contador = cabecalho.querySelector('.calendar-day-count');

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
  dropdownWrapper.className = 'dropdown calendar-event-actions'; // Use 'dropup' em vez de 'dropdown'

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
    patient: paciente.id,
  }));

  registrarAcao('Histórico de contatos', 'bi-chat-dots', () => openHistoricoContatoModal({
    patient: paciente.id,
  }));

  registrarAcao('Editar informações', 'bi-pencil', () => openEditarInfoPacientesModal({
    patient: paciente,
  }));

  if (paciente.paciente_ativo) {
    registrarAcao('Desativar paciente', 'bi-person-dash', () => openDeactivatePatientModal({
      id: paciente.id,
      name: paciente.nome,
    }));
  } else {
    registrarAcao('Reativar paciente', 'bi-person-check', () => openActivatePatientModal({
      id: paciente.id,
      name: paciente.nome,
    }));
  }

  registrarAcao('Excluir paciente', 'bi-trash', () => openExcluirPatientModal({
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

  return dropdownWrapper;
}

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
    <div class="patient-info"><i class="bi bi-clock"></i> ${diasAtrasResumo}</div>
    <div class="patient-info"><i class="bi bi-calendar text-primary"></i> Próximo contato: ${proximoStr}</div>
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
  contato.className = 'd-flex align-items-center gap-3'; // Para alinhar lado a lado

  // Garante que o telefone esteja em formato apenas números
  // Bloco WhatsApp
  let whatsappHtml = '';
  if (telefoneLimpo) {
    whatsappHtml = `
      <a href="https://wa.me/55${telefoneLimpo}" target="_blank" class="whatsapp-contact d-flex gap-2 align-items-center text-success text-decoration-none">
        <i class="bi bi-whatsapp" style="font-size: 1.2rem;"></i>
        <span>${paciente.telefone}</span>
      </a>
    `;
  } else {
    whatsappHtml = `<i class="bi bi-whatsapp"></i> ---`;
  }

  // Bloco texto do lembrete
  let lembreteHtml = '';
  if (paciente.texto_lembrete) {
    lembreteHtml = `
      <span class="lembrete-text text-secondary" style="font-size: 0.95rem;">
        <i class="bi bi-chat-left-text me-1"></i>Ação: ${paciente.texto_lembrete}
      </span>
    `;
  }

  contato.innerHTML = whatsappHtml + lembreteHtml;

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
      patient: paciente.id
  }));
  
  const historicoContatoBt = document.createElement('button');
    historicoContatoBt.className = 'btn-icon btn-outline-secondary';
    historicoContatoBt.setAttribute('data-tooltip', 'Histórico de Contatos');
    historicoContatoBt.innerHTML = '<i class="bi bi-chat-dots"></i>';
    historicoContatoBt.addEventListener('click', () => openHistoricoContatoModal({
      patient: paciente.id

  }));

  const EditarPacienteBt = document.createElement('button');
    EditarPacienteBt.className = 'btn-icon btn-outline-primary';
    EditarPacienteBt.setAttribute('data-tooltip', 'Editar Paciente');
    EditarPacienteBt.innerHTML = '<i class="bi bi-pencil"></i>';
    EditarPacienteBt.addEventListener('click', () => openEditarInfoPacientesModal({
      patient: paciente
  }));

  const ExcluirPaciente = document.createElement('button');
    ExcluirPaciente.className = 'btn-icon btn-outline-danger';
    ExcluirPaciente.setAttribute('data-tooltip', 'Excluir Paciente');
    ExcluirPaciente.innerHTML = '<i class="bi bi-trash"></i>';
    ExcluirPaciente.addEventListener('click', () => openExcluirPatientModal({
      patient: paciente
  }));

  secondaryActions.appendChild(historicoConsultaBt);
  secondaryActions.appendChild(historicoContatoBt);
  secondaryActions.appendChild(EditarPacienteBt);
  secondaryActions.appendChild(ExcluirPaciente);

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

async function openHistoricoConsultaModal(patient) {
  // Abre o modal imediatamente e mostra loading
  const historicoConsultaModalEl = document.getElementById('consultasModal');
  const historicoConsultaModal = bootstrap.Modal.getInstance(historicoConsultaModalEl) || new bootstrap.Modal(historicoConsultaModalEl);
  const modalBody = document.getElementById('consultas-historico-body');
  modalBody.innerHTML = '<div class="text-center text-secondary py-3"><div class="spinner-border spinner-border-sm"></div> Carregando...</div>';
  historicoConsultaModal.show();

  try {
    const response = await fetch(`/api/historico-consulta/${patient.patient}/`);
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
  historicoContatoModal.show();

  try {
    const resp = await fetch(`/api/historico-contatos/${patient.patient}/`);
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
  editarInfoPacienteModal.show();
}

// Evento para enviar PUT ao editar paciente
function inicializarEdicaoPaciente() {
  const btn = document.getElementById('salvarEdicaoPacienteBtn');

  if (btn && !btn.dataset.listenerAdded) {
    btn.dataset.listenerAdded = 'true';

    btn.addEventListener('click', async function () {
      btn.disabled = true;

      // Cria spinner "Salvando..."
      let spinner = document.createElement('span');
      spinner.className = 'ms-2 spinner-border spinner-border-sm align-middle';
      spinner.setAttribute('role', 'status');
      spinner.setAttribute('aria-hidden', 'true');
      spinner.id = 'saving-spinner';

      let savingText = document.createElement('span');
      savingText.className = 'ms-1 align-middle';
      spinner.appendChild(savingText);

      if (!btn.querySelector('#saving-spinner')) {
        btn.appendChild(spinner);
      }

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
        showToast('Erro de conexão ao atualizar paciente.', 'error');

      } finally {
        btn.disabled = false;
        const existingSpinner = btn.querySelector('#saving-spinner');
        if (existingSpinner) {
          btn.removeChild(existingSpinner);
        }
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

function openExcluirPatientModal(patient) {

  const excluirPatientModal = new bootstrap.Modal(document.getElementById('excluirPacienteModal'));
  const nomePaciente = document.getElementById('patient-name-excluir');
  const idPaciente = document.getElementById('excluir-patient-id');

  nomePaciente.textContent = patient.patient.nome;
  idPaciente.value = patient.patient.id;

  excluirPatientModal.show();
}

function openActivatePatientModal(patient) {

  const reativarPatientModal = new bootstrap.Modal(document.getElementById('reativarPacienteModal'));
  const nomePaciente = document.getElementById('patient-name-reactivate');
  const idPaciente = document.getElementById('reactivate-patient-id');

  nomePaciente.textContent = patient.name;
  idPaciente.value = patient.id;

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
          // listarPacientes();
          atualizarCardPaciente(idPaciente);
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
        submitBtn.disabled = false;
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
          // listarPacientes();
          atualizarCardPaciente(idPaciente);
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
      submitBtn.disabled = true;

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
        submitBtn.disabled = false;
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
          // listarPacientes();
          atualizarCardPaciente(idPaciente);
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
          // listarPacientes();
          atualizarCardPaciente(idPaciente);
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
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('patient-form');
  if (!form.dataset.listenerAdded) {
    form.dataset.listenerAdded = 'true';

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;

      // Cria o spinner "Salvando..."
      let spinner = document.createElement('span');
      spinner.className = 'ms-2 spinner-border spinner-border-sm align-middle';
      spinner.setAttribute('role', 'status');
      spinner.setAttribute('aria-hidden', 'true');
      spinner.id = 'saving-spinner';
      let savingText = document.createElement('span');
      savingText.className = 'ms-1 align-middle';
      // savingText.textContent = 'Salvando...';
      spinner.appendChild(savingText);

      // Adiciona o spinner ao botão se ainda não existe
      if (!submitBtn.querySelector('#saving-spinner')) {
        submitBtn.appendChild(spinner);
      }

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
        submitBtn.disabled = false;
        // Remove o spinner
        if (submitBtn.querySelector('#saving-spinner')) {
          submitBtn.removeChild(submitBtn.querySelector('#saving-spinner'));
        }
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

      const modalAtribuirGrupoModalEl = document.getElementById('atribuirGrupoModal');
      const modalAtribuirGrupoModal = bootstrap.Modal.getInstance(modalAtribuirGrupoModalEl) 
        || new bootstrap.Modal(modalAtribuirGrupoModalEl);

      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;

      // Cria spinner "Salvando..."
      let spinner = document.createElement('span');
      spinner.className = 'ms-2 spinner-border spinner-border-sm align-middle';
      spinner.setAttribute('role', 'status');
      spinner.setAttribute('aria-hidden', 'true');
      spinner.id = 'saving-spinner';
      let savingText = document.createElement('span');
      savingText.className = 'ms-1 align-middle';
      spinner.appendChild(savingText);

      if (!submitBtn.querySelector('#saving-spinner')) {
        submitBtn.appendChild(spinner);
      }

      fetch(`/api/atribuir-grupo/${grupoId}/${pacienteId}/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCookie('csrftoken')
        },
        body: {}  // corpo vazio, como no original
      })
        .then(res => res.json())
        .then(() => {
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
        .catch(() => {
          showToast('Erro ao atribuir grupo.', 'error');
        })
        .finally(() => {
          submitBtn.disabled = false;
          const existingSpinner = submitBtn.querySelector('#saving-spinner');
          if (existingSpinner) {
            submitBtn.removeChild(existingSpinner);
          }
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

  // Mostra spinner de loading em cada card
  cardTotalPatientes.innerHTML = `<span class="spinner-border text-primary" role="status"></span>`;
  cardTotalLembretes.innerHTML = `<span class="spinner-border text-primary" role="status"></span>`;
  cardLembreteAtrasado.innerHTML = `<span class="spinner-border text-primary" role="status"></span>`;

  fetch('/api/cards-home/')
    .then(response => response.json())
    .then(data => {
      cardTotalPatientes.textContent = data.total_pacientes;
      cardTotalLembretes.textContent = data.alertas_ativos;
      cardLembreteAtrasado.textContent = data.lembretes_atrasados;
    })
    .catch(err => {
      showToast('Erro ao carregar estatísticas', 'error');
      cardTotalPatientes.textContent = '--';
      cardTotalLembretes.textContent = '--';
      cardLembreteAtrasado.textContent = '--';
    });
}

