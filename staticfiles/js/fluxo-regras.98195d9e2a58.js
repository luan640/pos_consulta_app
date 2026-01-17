import { showToast } from './message.js';

const gruposListEl = document.getElementById('regra-grupos-list');
const gruposEmptyEl = document.getElementById('regra-grupos-empty');
const grupoNomeEl = document.getElementById('regra-grupo-nome');
const grupoDescricaoEl = document.getElementById('regra-grupo-descricao');
const regraListEl = document.getElementById('regra-flow-list');
const regraEmptyEl = document.getElementById('regra-flow-empty');
const regraCountEl = document.getElementById('regra-contador');
const regraMateriaisDisponiveisEl = document.getElementById('regra-materiais-disponiveis');
const regraMateriaisSelecionadosEl = document.getElementById('regra-materiais-selecionados');
const regraEditarMateriaisDisponiveisEl = document.getElementById('regra-editar-materiais-disponiveis');
const regraEditarMateriaisSelecionadosEl = document.getElementById('regra-editar-materiais-selecionados');
const grupoRedirecionarWrapper = document.getElementById('grupo-redirecionar-wrapper');
const grupoEditarRedirecionarWrapper = document.getElementById('grupo-editar-redirecionar-wrapper');
const grupoDiasCiclicosWrapper = document.getElementById('grupo-dias-ciclicos-wrapper');
const grupoEditarDiasCiclicosWrapper = document.getElementById('grupo-editar-dias-ciclicos-wrapper');
const grupoDiasCiclicosInput = document.getElementById('grupo-dias-ciclicos');
const grupoEditarDiasCiclicosInput = document.getElementById('grupo-editar-dias-ciclicos');
const grupoRedirecionarSelect = document.getElementById('grupo-redirecionar');
const grupoEditarRedirecionarSelect = document.getElementById('grupo-editar-redirecionar');

const acaoFinalConfigNovo = {
  wrapperRedirecionar: grupoRedirecionarWrapper,
  selectEl: grupoRedirecionarSelect,
  wrapperDias: grupoDiasCiclicosWrapper,
  diasInput: grupoDiasCiclicosInput,
};

const acaoFinalConfigEditar = {
  wrapperRedirecionar: grupoEditarRedirecionarWrapper,
  selectEl: grupoEditarRedirecionarSelect,
  wrapperDias: grupoEditarDiasCiclicosWrapper,
  diasInput: grupoEditarDiasCiclicosInput,
};

const btnNovoGrupo = document.getElementById('btn-novo-grupo');
const btnNovoGrupoLateral = document.getElementById('btn-novo-grupo-lateral');
const btnEditarGrupo = document.getElementById('btn-editar-grupo');
const btnExcluirGrupo = document.getElementById('btn-excluir-grupo');
const btnNovaRegra = document.getElementById('btn-nova-regra');

const modalGrupoNovoEl = document.getElementById('modalGrupoNovo');
const modalGrupoEditarEl = document.getElementById('modalGrupoEditar');
const modalGrupoExcluirEl = document.getElementById('modalGrupoExcluir');
const modalRegraNovaEl = document.getElementById('modalRegraNova');
const modalRegraEditarEl = document.getElementById('modalRegraEditar');
const modalRegraExcluirEl = document.getElementById('modalRegraExcluir');

const modalGrupoNovo = modalGrupoNovoEl ? new bootstrap.Modal(modalGrupoNovoEl) : null;
const modalGrupoEditar = modalGrupoEditarEl ? new bootstrap.Modal(modalGrupoEditarEl) : null;
const modalGrupoExcluir = modalGrupoExcluirEl ? new bootstrap.Modal(modalGrupoExcluirEl) : null;
const modalRegraNova = modalRegraNovaEl ? new bootstrap.Modal(modalRegraNovaEl) : null;
const modalRegraEditar = modalRegraEditarEl ? new bootstrap.Modal(modalRegraEditarEl) : null;
const modalRegraExcluir = modalRegraExcluirEl ? new bootstrap.Modal(modalRegraExcluirEl) : null;

let gruposCache = [];
let grupoSelecionadoId = null;
let regraSelecionadaId = null;
let materiaisCache = [];
let materiaisCarregados = false;
let materiaisPromise = null;

function estilizarGrupoItem(item, ativo) {
  if (!item) return;
  const baseClasses = 'group flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors mb-1 regra-grupo-item';
  item.className = baseClasses;
  if (ativo) {
    item.classList.add('bg-primary/5', 'border', 'border-primary/20', 'active');
  }

  const iconEl = item.querySelector('[data-role="grupo-icon"]');
  if (iconEl) {
    iconEl.className = `size-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
      ativo ? 'bg-white text-primary shadow-sm' : 'bg-slate-100 text-slate-500'
    }`;
  }

  const titleEl = item.querySelector('[data-role="grupo-title"]');
  if (titleEl) {
    titleEl.className = `text-sm font-semibold truncate ${ativo ? 'text-primary' : 'text-slate-700'}`;
  }

  const arrowEl = item.querySelector('[data-role="grupo-arrow"]');
  if (arrowEl) {
    arrowEl.classList.toggle('hidden', !ativo);
  }
}

function criarSpinnerSuave(mensagem, subtitulo = 'So leva um instante...') {
  const wrapper = document.createElement('div');
  wrapper.className = 'regra-loading flex flex-col items-center justify-center py-8 text-slate-600 gap-2';
  wrapper.innerHTML = `
    <div class="relative inline-flex items-center justify-center">
      <div class="h-12 w-12 rounded-full border-2 border-slate-200"></div>
      <div class="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
      <div class="absolute inset-3 rounded-full bg-white"></div>
    </div>
    <p class="text-sm font-semibold text-slate-700">${mensagem}</p>
    <p class="text-xs text-slate-400">${subtitulo}</p>
  `;
  return wrapper;
}

function renderizarLoading(container, mensagem) {
  if (!container) return;
  container.innerHTML = '';
  container.appendChild(criarSpinnerSuave(mensagem));
}

function ativarLoadingSuave(container) {
  if (!container) return;
  container.classList.add('regra-flow-list--loading');
}

function desativarLoadingSuave(container) {
  if (!container) return;
  container.classList.remove('regra-flow-list--loading');
}

function adicionarOverlayLoading(container, mensagem) {
  if (!container) return;
  removerOverlayLoading(container);
  container.classList.add('relative');

  const overlay = document.createElement('div');
  overlay.className = 'regra-loading-overlay absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10';
  overlay.appendChild(criarSpinnerSuave(mensagem, 'Atualizando visualizacao...'));
  container.appendChild(overlay);
}

function removerOverlayLoading(container) {
  const overlay = container?.querySelector('.regra-loading-overlay');
  if (overlay) {
    overlay.remove();
  }
}

function definirLoadingBotao(botao, loading) {
  if (!botao) return;
  if (loading) {
    if (botao.dataset.loading === 'true') return;
    botao.dataset.loading = 'true';
    botao.disabled = true;
    botao.classList.add('loading');

    if (!botao.querySelector('.btn-spinner')) {
      const spinner = document.createElement('span');
      spinner.className = 'btn-spinner ml-2 inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin align-middle';
      spinner.setAttribute('role', 'status');
      spinner.setAttribute('aria-hidden', 'true');
      botao.appendChild(spinner);
    }
  } else {
    botao.dataset.loading = 'false';
    botao.disabled = false;
    botao.classList.remove('loading');
    const spinner = botao.querySelector('.btn-spinner');
    if (spinner) spinner.remove();
  }
}

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

function setBotaoEstado(botao, habilitado) {
  if (!botao) return;
  botao.disabled = !habilitado;
}

function atualizarUIAcaoFinal(acao, config) {
  if (!config) return;
  const { wrapperRedirecionar, selectEl, wrapperDias, diasInput } = config;
  const mostrarRedirecionar = acao === 'redirect';
  const mostrarDias = acao === 'loop';

  if (wrapperRedirecionar) {
    wrapperRedirecionar.classList.toggle('hidden', !mostrarRedirecionar);
  }
  if (selectEl) {
    selectEl.disabled = !mostrarRedirecionar;
    if (!mostrarRedirecionar) {
      selectEl.value = '';
    }
  }
  if (wrapperDias) {
    wrapperDias.classList.toggle('hidden', !mostrarDias);
  }
  if (diasInput) {
    diasInput.disabled = !mostrarDias;
    if (mostrarDias && !diasInput.value) {
      diasInput.value = 15;
    }
    if (!mostrarDias) {
      diasInput.value = '';
    }
  }
}

function definirAcaoFinal(nomeCampo, config, acao) {
  const radios = document.querySelectorAll(`input[name="${nomeCampo}"]`);
  radios.forEach((radio) => {
    radio.checked = radio.value === acao;
  });
  atualizarUIAcaoFinal(acao, config);
}

function inicializarAcaoFinal(nomeCampo, config) {
  const radios = document.querySelectorAll(`input[name="${nomeCampo}"]`);
  if (!radios.length) return;
  const handler = () => {
    const acaoSelecionada = document.querySelector(`input[name="${nomeCampo}"]:checked`)?.value || 'none';
    atualizarUIAcaoFinal(acaoSelecionada, config);
  };
  radios.forEach((radio) => {
    radio.addEventListener('change', handler);
  });
  handler();
}

function obterDadosAcaoFinal(nomeCampo, config) {
  const acao = document.querySelector(`input[name="${nomeCampo}"]:checked`)?.value || 'none';
  const redirecionarPara = acao === 'redirect' ? config?.selectEl?.value || '' : '';
  const diasCiclicos =
    acao === 'loop' && config?.diasInput?.value !== '' ? Number(config.diasInput.value) : null;

  return {
    acao,
    redirecionarPara,
    diasCiclicos: Number.isNaN(diasCiclicos) ? null : diasCiclicos,
  };
}

function carregarMateriais(force = false) {
  if (materiaisCarregados && !force) {
    return Promise.resolve(materiaisCache);
  }
  if (materiaisPromise && !force) {
    return materiaisPromise;
  }

  materiaisPromise = fetch('/api/materiais/')
    .then((res) => {
      if (!res.ok) {
        throw new Error('Erro ao carregar materiais');
      }
      return res.json();
    })
    .then((data) => {
      materiaisCache = data?.materiais || [];
      materiaisCarregados = true;
      return materiaisCache;
    })
    .catch((error) => {
      materiaisCache = [];
      materiaisCarregados = true;
      throw error;
    })
    .finally(() => {
      materiaisPromise = null;
    });

  return materiaisPromise;
}

function prepararContainerMateriais(container, mensagem, linkHref = null) {
  if (!container) return;
  container.innerHTML = '';
  const span = document.createElement('span');
  if (linkHref) {
    span.append(document.createTextNode(`${mensagem} `));
    const link = document.createElement('a');
    link.href = linkHref;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = 'inline-flex items-center px-3 py-1 text-xs font-semibold text-primary border border-primary rounded-md hover:bg-primary/10 ml-2';
    link.textContent = 'Adicionar materiais';
    span.appendChild(link);
  } else {
    span.textContent = mensagem;
  }
  container.appendChild(span);
  container.classList.add('text-slate-500', 'text-xs');
  container.classList.remove('materiais-checkbox-group', 'd-flex', 'flex-wrap', 'gap-2');
  container.classList.add('flex', 'flex-wrap', 'gap-2');
}

function moverChip(chip, destino) {
  destino.appendChild(chip);
  if (chip.animate) {
    chip.animate(
      [
        { transform: 'scale(0.96)', opacity: 0.85 },
        { transform: 'scale(1)', opacity: 1 },
      ],
      { duration: 180, easing: 'ease-out' }
    );
  }
}

function aplicarClasseChip(chip, selecionado = false, destacar = false) {
  if (!chip) return;
  atualizarConteudoChip(chip, selecionado);
  const base = [
    'regras-material-chip',
    'inline-flex',
    'items-center',
    'justify-center',
    'px-3',
    'py-1.5',
    'rounded-full',
    'text-xs',
    'font-semibold',
    'tracking-tight',
    'transition',
    'duration-200',
    'border',
    'shadow-sm',
  ];

  const disponivel = [
    'bg-indigo-50',
    'text-indigo-700',
    'border-indigo-200',
    'hover:bg-indigo-100',
    'hover:-translate-y-px',
    'active:translate-y-0',
  ];

  const escolhido = [
    'bg-emerald-600',
    'text-white',
    'border-emerald-600',
    'shadow-lg',
    'hover:bg-emerald-700',
  ];

  chip.className = '';
  const classes = [...base, ...(selecionado ? escolhido : disponivel)];
  if (destacar) {
    classes.push('ring-2', 'ring-offset-2', selecionado ? 'ring-emerald-200' : 'ring-indigo-100');
  }
  chip.classList.add(...classes);

  if (destacar) {
    setTimeout(() => {
      chip.classList.remove('ring-2', 'ring-offset-2', 'ring-emerald-200', 'ring-indigo-100');
    }, 220);
  }
}

function atualizarConteudoChip(chip, selecionado) {
  const labelWrapper = document.createElement('span');
  labelWrapper.className = 'flex items-center gap-2 truncate';

  const label = document.createElement('span');
  label.textContent = chip.dataset.materialLabel || chip.textContent || '';
  label.className = 'truncate';

  const tipoLabel = chip.dataset.materialTypeLabel || '';
  if (tipoLabel) {
    const tipo = document.createElement('span');
    tipo.className = selecionado
      ? 'text-[10px] font-semibold uppercase tracking-wide text-white/70'
      : 'text-[10px] font-semibold uppercase tracking-wide text-slate-500';
    tipo.textContent = tipoLabel;
    labelWrapper.appendChild(label);
    labelWrapper.appendChild(tipo);
  } else {
    labelWrapper.appendChild(label);
  }

  const close = document.createElement('span');
  close.className = 'ml-2 text-[11px] font-bold opacity-80';
  close.textContent = 'x';
  close.setAttribute('aria-hidden', 'true');

  chip.innerHTML = '';
  chip.appendChild(labelWrapper);
  if (selecionado) {
    chip.appendChild(close);
  }
}

function obterTipoMaterial(material) {
  if (!material) return '';
  return material.tipo_arquivo || (
    material.pdf_url ? 'pdf' :
      material.video_url ? 'video' :
        material.imagem_url ? 'imagem' :
          material.foto_url ? 'foto' :
            material.youtube_url ? 'youtube' :
              ''
  );
}

function formatarTipoMaterial(tipo) {
  const mapa = {
    pdf: 'PDF',
    video: 'Video',
    imagem: 'Imagem',
    foto: 'Foto',
    youtube: 'YouTube',
  };
  return mapa[tipo] || '';
}



function atualizarChipVisual(chip, destino) {
  if (!chip || !destino) return;
  const paraSelecionados = destino?.id?.includes('selecionados');

  aplicarClasseChip(chip, paraSelecionados, true);
  if (chip.animate) {
    chip.animate(
      [
        { transform: 'scale(0.95)', opacity: 0.9 },
        { transform: 'scale(1)', opacity: 1 },
      ],
      { duration: 180, easing: 'ease-out' }
    );
  }
}

function habilitarInteracaoMateriais(disponiveisEl, selecionadosEl) {
  if (!disponiveisEl || !selecionadosEl) return;
  if (disponiveisEl.dataset.materiaisBound === 'true') return;
  disponiveisEl.dataset.materiaisBound = 'true';
  selecionadosEl.dataset.materiaisBound = 'true';

  disponiveisEl.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-material-id]');
    if (!chip) return;
    atualizarChipVisual(chip, selecionadosEl);
    moverChip(chip, selecionadosEl);
  });

  selecionadosEl.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-material-id]');
    if (!chip) return;
    atualizarChipVisual(chip, disponiveisEl);
    moverChip(chip, disponiveisEl);
  });
}

function renderizarMateriais(disponiveisEl, selecionadosEl, selecionados = []) {
  if (!disponiveisEl || !selecionadosEl) return;

  disponiveisEl.innerHTML = '';
  selecionadosEl.innerHTML = '';
  disponiveisEl.classList.remove('text-muted', 'small');
  selecionadosEl.classList.remove('text-muted', 'small');
  disponiveisEl.classList.remove('materiais-checkbox-group', 'd-flex');
  selecionadosEl.classList.remove('materiais-checkbox-group', 'd-flex');
  disponiveisEl.classList.add('flex', 'flex-wrap', 'gap-2');
  selecionadosEl.classList.add('flex', 'flex-wrap', 'gap-2');

  if (!materiaisCache.length) {
    prepararContainerMateriais(
      disponiveisEl,
      'Voce ainda nao cadastrou nenhum material.',
      '/materiais/'
    );
    return;
  }

  const selecionadosSet = new Set(selecionados.map((id) => Number(id)));

  materiaisCache.forEach((material) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.dataset.materialId = material.id;
    chip.dataset.materialLabel = material.descricao;
    const tipoMaterial = obterTipoMaterial(material);
    chip.dataset.materialTypeLabel = formatarTipoMaterial(tipoMaterial);
    chip.textContent = material.descricao;

    if (selecionadosSet.has(Number(material.id))) {
      aplicarClasseChip(chip, true);
      selecionadosEl.appendChild(chip);
    } else {
      aplicarClasseChip(chip, false);
      disponiveisEl.appendChild(chip);
    }
  });

  habilitarInteracaoMateriais(disponiveisEl, selecionadosEl);
}

function obterMateriaisSelecionados(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll('[data-material-id]'))
    .map((item) => Number(item.dataset.materialId))
    .filter((id) => !Number.isNaN(id));
}

function atualizarEstadoGrupoSelecionado(grupo) {
  if (!grupo) {
    grupoNomeEl.textContent = 'Selecione um grupo';
    grupoDescricaoEl.textContent = 'Escolha um grupo para visualizar e editar as regras.';
    regraListEl.innerHTML = '';
    regraEmptyEl.classList.remove('hidden');
    regraCountEl.textContent = '0 regras';
    setBotaoEstado(btnEditarGrupo, false);
    setBotaoEstado(btnExcluirGrupo, false);
    setBotaoEstado(btnNovaRegra, false);
    return;
  }

  grupoNomeEl.textContent = grupo.nome || 'Grupo sem nome';
  grupoDescricaoEl.textContent = grupo.descricao || 'Sem descricao.';
  setBotaoEstado(btnEditarGrupo, true);
  setBotaoEstado(btnExcluirGrupo, true);
  setBotaoEstado(btnNovaRegra, true);
}

function renderizarGrupos(grupos) {
  gruposListEl.innerHTML = '';

  if (!grupos.length) {
    gruposEmptyEl.classList.remove('hidden');
    atualizarEstadoGrupoSelecionado(null);
    return;
  }

  gruposEmptyEl.classList.add('hidden');
  const fragment = document.createDocumentFragment();

  grupos.forEach((grupo) => {
    const item = document.createElement('div');
    item.className = 'group flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors mb-1 regra-grupo-item';
    item.dataset.grupoId = grupo.id;

    item.innerHTML = `
      <div class="size-10 rounded-lg flex items-center justify-center shrink-0 transition-colors bg-slate-100 text-slate-500" data-role="grupo-icon">
        <span class="material-symbols-outlined">folder_open</span>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-semibold text-slate-700 truncate" data-role="grupo-title">${grupo.nome}</p>
        <p class="text-xs text-slate-500 truncate">${grupo.tamanho_grupo || 0} regras</p>
      </div>
      <span class="material-symbols-outlined text-primary text-[20px] hidden" data-role="grupo-arrow">chevron_right</span>
    `;

    const isActive = grupoSelecionadoId && Number(grupoSelecionadoId) === Number(grupo.id);
    estilizarGrupoItem(item, Boolean(isActive));

    item.addEventListener('click', () => {
      selecionarGrupo(grupo.id, { suave: true });
    });

    fragment.appendChild(item);
  });

  gruposListEl.appendChild(fragment);

  if (!grupoSelecionadoId && grupos.length) {
    selecionarGrupo(grupos[0].id);
  }
}

function renderizarRegras(regras) {
  regraListEl.innerHTML = '';
  regraCountEl.textContent = `${regras.length} regra${regras.length === 1 ? '' : 's'}`;

  if (!regras.length) {
    regraEmptyEl.classList.remove('hidden');
    return;
  }

  regraEmptyEl.classList.add('hidden');
  const fragment = document.createDocumentFragment();

  regras.forEach((regra, index) => {
    const item = document.createElement('div');
    item.className = 'flex gap-6 group/step regra-flow-item';
    item.dataset.regraId = regra.id;

    const dias = Number(regra.dias_apos || 0);
    const diasTexto = dias === 0 ? 'Imediato' : `${dias} dia${dias === 1 ? '' : 's'} depois`;

    let colorClass = 'bg-blue-500';
    let ringClass = 'ring-slate-50';
    let icon = 'mail';

    if (dias === 0) {
      colorClass = 'bg-green-500';
      icon = 'bolt';
    } else if (dias > 15) {
      colorClass = 'bg-amber-500';
      icon = 'notifications_active';
    }

    const materiais = Array.isArray(regra.materiais) ? regra.materiais : [];
    const materiaisHtml = materiais.length
      ? materiais.map((material) => `<span class="bg-slate-100 text-slate-600 text-xs font-semibold px-2 py-1 rounded border border-slate-200">${material.descricao}</span>`).join('')
      : '<span class="text-slate-400 text-xs italic">Sem materiais</span>';

    const isPrimeira = index === 0;
    const isUltima = index === regras.length - 1;

    item.innerHTML = `
      <!-- Connector -->
      <div class="flex flex-col items-center w-12 shrink-0">
        <div class="size-8 rounded-full ${colorClass} text-white flex items-center justify-center shadow-sm z-10 ring-4 ${ringClass}">
          <span class="material-symbols-outlined text-[18px]">${icon}</span>
        </div>
        <div class="w-0.5 bg-slate-200 h-full -mt-2 group-last/step:h-0"></div>
      </div>
      
      <!-- Content Card -->
      <div class="flex-1 pb-8">
        <div class="bg-white border border-[#e5e7eb] rounded-xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group/card">
          <div class="absolute left-0 top-0 bottom-0 w-1 ${colorClass.replace('bg-', 'bg-')}"></div>
           
          <div class="p-5">
            <div class="flex justify-between items-start mb-3">
              <div class="flex items-center gap-3">
                <span class="bg-slate-100 text-slate-600 text-xs font-semibold px-2.5 py-1 rounded-md border border-slate-200 flex items-center gap-1">
                  <span class="material-symbols-outlined text-[14px]">schedule</span>
                  ${diasTexto}
                </span>
                <h3 class="font-semibold text-[#111518] regra-flow-title">${regra.nome || 'Regra sem título'}</h3>
              </div>
              
              <div class="flex items-center group-hover/card:opacity-100 transition-opacity gap-1 regra-flow-actions">
                 <button class="size-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-primary transition-colors" data-action="subir" data-id="${regra.id}" ${isPrimeira ? 'disabled' : ''} title="Mover para Cima">
                  <span class="material-symbols-outlined text-[18px]">arrow_upward</span>
                </button>
                <button class="size-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-primary transition-colors" data-action="descer" data-id="${regra.id}" ${isUltima ? 'disabled' : ''} title="Mover para Baixo">
                  <span class="material-symbols-outlined text-[18px]">arrow_downward</span>
                </button>
                <button class="size-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-primary transition-colors" data-action="editar" data-id="${regra.id}" title="Editar">
                  <span class="material-symbols-outlined text-[18px]">edit</span>
                </button>
                <button class="size-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-red-500 transition-colors" data-action="excluir" data-id="${regra.id}" title="Excluir">
                  <span class="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            </div>
            
            <p class="text-sm text-[#64748b] mb-3 regra-flow-description line-clamp-2">${regra.descricao || 'Sem descrição.'}</p>
            <div class="flex flex-wrap gap-2 regra-flow-materiais">
                ${materiaisHtml}
            </div>
            
             <div class="hidden regra-flow-meta">${diasTexto}</div>
          </div>
        </div>
      </div>
    `;

    item.dataset.materiaisIds = materiais.map((material) => material.id).join(',');
    fragment.appendChild(item);
  });

  regraListEl.appendChild(fragment);
}
function selecionarGrupo(grupoId, options = {}) {
  grupoSelecionadoId = grupoId;
  const grupo = gruposCache.find((item) => Number(item.id) === Number(grupoId));
  atualizarEstadoGrupoSelecionado(grupo);

  gruposListEl.querySelectorAll('.regra-grupo-item').forEach((item) => {
    const ativo = Number(item.dataset.grupoId) === Number(grupoId);
    estilizarGrupoItem(item, ativo);
  });

  carregarRegras(grupoId, options);
}

function carregarGrupos() {
  renderizarLoading(gruposListEl, 'Carregando grupos...');
  return fetch('/api/grupo-regras/')
    .then((res) => res.json())
    .then((data) => {
      gruposCache = data?.grupos || [];
      renderizarGrupos(gruposCache);
    })
    .catch(() => {
      showToast('Erro ao carregar grupos de regras', 'error');
    });
}

function atualizarSelectRedirecionamento(selectEl, { excluirId = null, selecionadoId = null } = {}) {
  if (!selectEl) return;
  selectEl.innerHTML = '';
  const optionPadrao = document.createElement('option');
  optionPadrao.value = '';
  optionPadrao.textContent = 'Nao redirecionar';
  selectEl.appendChild(optionPadrao);

  gruposCache.forEach((grupo) => {
    if (excluirId && Number(grupo.id) === Number(excluirId)) return;
    const option = document.createElement('option');
    option.value = grupo.id;
    option.textContent = grupo.nome || 'Grupo sem nome';
    if (selecionadoId && Number(grupo.id) === Number(selecionadoId)) {
      option.selected = true;
    }
    selectEl.appendChild(option);
  });
}

function carregarRegras(grupoId, options = {}) {
  if (!grupoId) return;

  const { suave = false } = options;

  removerOverlayLoading(regraListEl);

  if (!suave) {
    renderizarLoading(regraListEl, 'Carregando regras...');
    regraEmptyEl.classList.add('hidden');
  } else {
    ativarLoadingSuave(regraListEl);
    adicionarOverlayLoading(regraListEl, 'Carregando regras do grupo...');
  }

  fetch(`/api/regras/${grupoId}/`)
    .then((res) => res.json())
    .then((data) => {
      const regras = data?.regras || [];
      regraEmptyEl.textContent = 'Nenhuma regra cadastrada para este grupo.';
      renderizarRegras(regras);
      if (suave) {
        desativarLoadingSuave(regraListEl);
        removerOverlayLoading(regraListEl);
      }
    })
    .catch(() => {
      if (suave) {
        desativarLoadingSuave(regraListEl);
        removerOverlayLoading(regraListEl);
        showToast('Erro ao carregar regras', 'error');
      } else {
        regraEmptyEl.textContent = 'Erro ao carregar regras.';
        showToast('Erro ao carregar regras', 'error');
      }
    });
}

function abrirModalGrupoNovo() {
  const form = document.getElementById('form-grupo-novo');
  if (form) form.reset();
  if (grupoDiasCiclicosInput) {
    grupoDiasCiclicosInput.value = 15;
  }
  definirAcaoFinal('grupo-acao-final', acaoFinalConfigNovo, 'loop');
  atualizarSelectRedirecionamento(
    document.getElementById('grupo-redirecionar'),
    {}
  );
  modalGrupoNovo?.show();
}

function abrirModalGrupoEditar() {
  const grupo = gruposCache.find((item) => Number(item.id) === Number(grupoSelecionadoId));
  if (!grupo) return;

  document.getElementById('grupo-editar-nome').value = grupo.nome || '';
  document.getElementById('grupo-editar-descricao').value = grupo.descricao || '';
  if (grupoEditarDiasCiclicosInput) {
    grupoEditarDiasCiclicosInput.value = grupo.dias_recorrentes || 15;
  }
  atualizarSelectRedirecionamento(
    document.getElementById('grupo-editar-redirecionar'),
    { excluirId: grupo.id, selecionadoId: grupo.redirecionar_para_id }
  );
  const acaoFinal = grupo.acao_final || (grupo.redirecionar_para_id ? 'redirect' : 'loop');
  definirAcaoFinal('grupo-editar-acao-final', acaoFinalConfigEditar, acaoFinal);
  modalGrupoEditar?.show();
}

function abrirModalGrupoExcluir() {
  modalGrupoExcluir?.show();
}

function abrirModalRegraNova() {
  const form = document.getElementById('form-regra-nova');
  if (form) form.reset();
  prepararContainerMateriais(regraMateriaisDisponiveisEl, 'Carregando materiais...');
  if (regraMateriaisSelecionadosEl) {
    regraMateriaisSelecionadosEl.innerHTML = '';
  }

  modalRegraNova?.show();

  carregarMateriais(true)
    .then(() => {
      renderizarMateriais(regraMateriaisDisponiveisEl, regraMateriaisSelecionadosEl, []);
    })
    .catch(() => {
      prepararContainerMateriais(regraMateriaisDisponiveisEl, 'Voce ainda nao cadastrou nenhum material.', '/materiais/');
    });
}

function abrirModalRegraEditar(regraId) {
  const regraEl = regraListEl.querySelector(`[data-regra-id="${regraId}"]`);
  if (!regraEl) return;

  const titulo = regraEl.querySelector('.regra-flow-title')?.textContent || '';
  const descricao = regraEl.querySelector('.regra-flow-description')?.textContent || '';
  const meta = regraEl.querySelector('.regra-flow-meta')?.textContent || '';
  const diasMatch = meta.match(/\d+/);
  const dias = diasMatch ? diasMatch[0] : '';

  document.getElementById('regra-editar-nome').value = titulo;
  document.getElementById('regra-editar-descricao').value = descricao;
  document.getElementById('regra-editar-dias').value = dias;

  regraSelecionadaId = regraId;
  const materiaisIds = (regraEl.dataset.materiaisIds || '')
    .split(',')
    .map((item) => Number(item))
    .filter((id) => !Number.isNaN(id));

  prepararContainerMateriais(regraEditarMateriaisDisponiveisEl, 'Carregando materiais...');
  if (regraEditarMateriaisSelecionadosEl) {
    regraEditarMateriaisSelecionadosEl.innerHTML = '';
  }

  modalRegraEditar?.show();

  carregarMateriais(true)
    .then(() => {
      renderizarMateriais(regraEditarMateriaisDisponiveisEl, regraEditarMateriaisSelecionadosEl, materiaisIds);
    })
    .catch(() => {
      prepararContainerMateriais(regraEditarMateriaisDisponiveisEl, 'Voce ainda nao cadastrou nenhum material.', '/materiais/');
    })
    .finally(() => { });
}

function abrirModalRegraExcluir(regraId) {
  regraSelecionadaId = regraId;
  modalRegraExcluir?.show();
}

document.addEventListener('DOMContentLoaded', () => {
  carregarGrupos();
  inicializarAcaoFinal('grupo-acao-final', acaoFinalConfigNovo);
  inicializarAcaoFinal('grupo-editar-acao-final', acaoFinalConfigEditar);

  btnNovoGrupo?.addEventListener('click', abrirModalGrupoNovo);
  btnNovoGrupoLateral?.addEventListener('click', abrirModalGrupoNovo);
  btnEditarGrupo?.addEventListener('click', abrirModalGrupoEditar);
  btnExcluirGrupo?.addEventListener('click', abrirModalGrupoExcluir);
  btnNovaRegra?.addEventListener('click', abrirModalRegraNova);

  document.getElementById('form-grupo-novo')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const nome = document.getElementById('grupo-nome').value.trim();
    const descricao = document.getElementById('grupo-descricao').value.trim();
    const { acao, redirecionarPara, diasCiclicos } = obterDadosAcaoFinal(
      'grupo-acao-final',
      acaoFinalConfigNovo
    );
    const submitBtn = event.target.querySelector('button[type="submit"]');

    definirLoadingBotao(submitBtn, true);
    fetch('/api/grupo-regras/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCookie('csrftoken'),
      },
      body: JSON.stringify({
        nome,
        descricao,
        redirecionar_para: acao === 'redirect' ? redirecionarPara || null : null,
        acao_final: acao,
        dias_recorrentes: acao === 'loop' ? diasCiclicos : null,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        modalGrupoNovo?.hide();
        grupoSelecionadoId = data?.id || data?.grupo_id || null;
        showToast('Grupo criado com sucesso!', 'success');
        renderizarLoading(regraListEl, 'Carregando regras...');
        regraEmptyEl.classList.add('hidden');
        carregarRegras(grupoSelecionadoId);
        carregarGrupos();
      })
      .catch(() => {
        showToast('Erro ao criar grupo', 'error');
      })
      .finally(() => {
        definirLoadingBotao(submitBtn, false);
      });
  });

  document.getElementById('form-grupo-editar')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const nome = document.getElementById('grupo-editar-nome').value.trim();
    const descricao = document.getElementById('grupo-editar-descricao').value.trim();
    const { acao, redirecionarPara, diasCiclicos } = obterDadosAcaoFinal(
      'grupo-editar-acao-final',
      acaoFinalConfigEditar
    );
    const submitBtn = event.target.querySelector('button[type="submit"]');

    definirLoadingBotao(submitBtn, true);
    fetch(`/api/grupo-regras/update/${grupoSelecionadoId}/`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCookie('csrftoken'),
      },
      body: JSON.stringify({
        nome,
        descricao,
        redirecionar_para: acao === 'redirect' ? redirecionarPara || null : null,
        acao_final: acao,
        dias_recorrentes: acao === 'loop' ? diasCiclicos : null,
      }),
    })
      .then((res) => res.json())
      .then(() => {
        modalGrupoEditar?.hide();
        showToast('Grupo atualizado!', 'success');
        carregarGrupos();
      })
      .catch(() => {
        showToast('Erro ao editar grupo', 'error');
      })
      .finally(() => {
        definirLoadingBotao(submitBtn, false);
      });
  });

  document.getElementById('btn-confirmar-exclusao-grupo')?.addEventListener('click', () => {
    const btn = document.getElementById('btn-confirmar-exclusao-grupo');
    definirLoadingBotao(btn, true);
    fetch(`/api/excluir-grupo-regra/${grupoSelecionadoId}/`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCookie('csrftoken'),
      },
      body: JSON.stringify({ id: grupoSelecionadoId }),
    })
      .then(() => {
        modalGrupoExcluir?.hide();
        showToast('Grupo excluido!', 'success');
        grupoSelecionadoId = null;
        carregarGrupos();
      })
      .catch(() => {
        showToast('Erro ao excluir grupo', 'error');
      })
      .finally(() => {
        definirLoadingBotao(btn, false);
      });
  });

  document.getElementById('form-regra-nova')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const nome = document.getElementById('regra-nome').value.trim();
    const dias = document.getElementById('regra-dias').value;
    const descricao = document.getElementById('regra-descricao').value.trim();
    const materiaisSelecionados = obterMateriaisSelecionados(regraMateriaisSelecionadosEl);
    const submitBtn = event.target.querySelector('button[type="submit"]');

    definirLoadingBotao(submitBtn, true);
    const payload = {
      nome,
      dias_apos: dias !== '' ? Number(dias) : null,
      descricao,
      grupo: grupoSelecionadoId,
      materiais: materiaisSelecionados,
    };

    fetch(`/api/regras/${grupoSelecionadoId}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCookie('csrftoken'),
      },
      body: JSON.stringify(payload),
    })
      .then((res) => res.json())
      .then(() => {
        modalRegraNova?.hide();
        showToast('Regra criada!', 'success');
        carregarRegras(grupoSelecionadoId);
        carregarGrupos();
      })
      .catch(() => {
        showToast('Erro ao criar regra', 'error');
      })
      .finally(() => {
        definirLoadingBotao(submitBtn, false);
      });
  });

  document.getElementById('form-regra-editar')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const nome = document.getElementById('regra-editar-nome').value.trim();
    const dias = document.getElementById('regra-editar-dias').value;
    const descricao = document.getElementById('regra-editar-descricao').value.trim();
    const materiaisSelecionados = obterMateriaisSelecionados(regraEditarMateriaisSelecionadosEl);
    const submitBtn = event.target.querySelector('button[type="submit"]');

    definirLoadingBotao(submitBtn, true);
    const payload = {
      nome,
      dias_apos: dias !== '' ? Number(dias) : null,
      descricao,
      materiais: materiaisSelecionados,
    };

    fetch(`/api/regras/update/${regraSelecionadaId}/${grupoSelecionadoId}/`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCookie('csrftoken'),
      },
      body: JSON.stringify(payload),
    })
      .then((res) => res.json())
      .then(() => {
        modalRegraEditar?.hide();
        showToast('Regra atualizada!', 'success');
        carregarRegras(grupoSelecionadoId);
      })
      .catch(() => {
        showToast('Erro ao editar regra', 'error');
      })
      .finally(() => {
        definirLoadingBotao(submitBtn, false);
      });
  });

  regraListEl?.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;
    const regraId = target.dataset.id;

    if (action === 'editar') {
      abrirModalRegraEditar(regraId);
    }

    if (action === 'subir') {
      ativarLoadingSuave(regraListEl);
      definirLoadingBotao(target, true);
      fetch(`/api/regras/${regraId}/${grupoSelecionadoId}/mover-up/`, {
        method: 'POST',
        headers: {
          'X-CSRFToken': getCookie('csrftoken'),
        },
      })
        .then(() => {
          showToast('Regra movida para cima!', 'success');
          return carregarRegras(grupoSelecionadoId, { suave: true });
        })
        .catch(() => {
          showToast('Erro ao mover regra', 'error');
        })
        .finally(() => {
          definirLoadingBotao(target, false);
          desativarLoadingSuave(regraListEl);
        });
    }

    if (action === 'descer') {
      ativarLoadingSuave(regraListEl);
      definirLoadingBotao(target, true);
      fetch(`/api/regras/${regraId}/${grupoSelecionadoId}/mover-down/`, {
        method: 'POST',
        headers: {
          'X-CSRFToken': getCookie('csrftoken'),
        },
      })
        .then(() => {
          showToast('Regra movida para baixo!', 'success');
          return carregarRegras(grupoSelecionadoId, { suave: true });
        })
        .catch(() => {
          showToast('Erro ao mover regra', 'error');
        })
        .finally(() => {
          definirLoadingBotao(target, false);
          desativarLoadingSuave(regraListEl);
        });
    }

    if (action === 'excluir') {
      abrirModalRegraExcluir(regraId);
    }
  });

  document.getElementById('btn-confirmar-exclusao-regra')?.addEventListener('click', () => {
    const btn = document.getElementById('btn-confirmar-exclusao-regra');
    definirLoadingBotao(btn, true);
    fetch(`/api/regras/update/${regraSelecionadaId}/${grupoSelecionadoId}/`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCookie('csrftoken'),
      },
    })
      .then(() => {
        modalRegraExcluir?.hide();
        showToast('Regra excluida!', 'success');
        carregarRegras(grupoSelecionadoId);
        carregarGrupos();
      })
      .catch(() => {
        showToast('Erro ao excluir regra', 'error');
      })
      .finally(() => {
        definirLoadingBotao(btn, false);
      });
  });
});
