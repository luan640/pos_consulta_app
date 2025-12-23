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

function renderizarLoading(container, mensagem) {
  if (!container) return;
  container.innerHTML = `
    <div class="regra-loading">
      <div class="spinner-border text-primary" role="status"></div>
      <span>${mensagem}</span>
    </div>
  `;
}

function ativarLoadingSuave(container) {
  if (!container) return;
  container.classList.add('regra-flow-list--loading');
}

function desativarLoadingSuave(container) {
  if (!container) return;
  container.classList.remove('regra-flow-list--loading');
}

function definirLoadingBotao(botao, loading) {
  if (!botao) return;
  if (loading) {
    botao.dataset.originalHtml = botao.innerHTML;
    botao.disabled = true;
    botao.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
  } else if (botao.dataset.originalHtml) {
    botao.disabled = false;
    botao.innerHTML = botao.dataset.originalHtml;
    delete botao.dataset.originalHtml;
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

function prepararContainerMateriais(container, mensagem) {
  if (!container) return;
  container.textContent = mensagem;
  container.classList.add('text-muted', 'small');
  container.classList.remove('materiais-checkbox-group', 'd-flex', 'flex-wrap', 'gap-2');
}

function moverChip(chip, destino) {
  destino.appendChild(chip);
  chip.classList.add('regras-material-chip--move');
  window.setTimeout(() => {
    chip.classList.remove('regras-material-chip--move');
  }, 200);
}

function habilitarInteracaoMateriais(disponiveisEl, selecionadosEl) {
  if (!disponiveisEl || !selecionadosEl) return;
  if (disponiveisEl.dataset.materiaisBound === 'true') return;
  disponiveisEl.dataset.materiaisBound = 'true';
  selecionadosEl.dataset.materiaisBound = 'true';

  disponiveisEl.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-material-id]');
    if (!chip) return;
    chip.classList.add('regras-material-chip--selected');
    moverChip(chip, selecionadosEl);
  });

  selecionadosEl.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-material-id]');
    if (!chip) return;
    chip.classList.remove('regras-material-chip--selected');
    moverChip(chip, disponiveisEl);
  });
}

function renderizarMateriais(disponiveisEl, selecionadosEl, selecionados = []) {
  if (!disponiveisEl || !selecionadosEl) return;

  disponiveisEl.innerHTML = '';
  selecionadosEl.innerHTML = '';
  disponiveisEl.classList.remove('text-muted', 'small');
  selecionadosEl.classList.remove('text-muted', 'small');
  disponiveisEl.classList.add('materiais-checkbox-group', 'd-flex', 'flex-wrap', 'gap-2');
  selecionadosEl.classList.add('materiais-checkbox-group', 'd-flex', 'flex-wrap', 'gap-2');

  if (!materiaisCache.length) {
    disponiveisEl.textContent = 'Nenhum material cadastrado.';
    disponiveisEl.classList.add('text-muted', 'small');
    disponiveisEl.classList.remove('materiais-checkbox-group', 'd-flex', 'flex-wrap', 'gap-2');
    return;
  }

  const selecionadosSet = new Set(selecionados.map((id) => Number(id)));

  materiaisCache.forEach((material) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'btn btn-primary btn-sm regras-material-chip';
    chip.dataset.materialId = material.id;
    chip.textContent = material.descricao;

    if (selecionadosSet.has(Number(material.id))) {
      chip.classList.add('regras-material-chip--selected');
      selecionadosEl.appendChild(chip);
    } else {
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
    regraEmptyEl.classList.remove('d-none');
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
    gruposEmptyEl.classList.remove('d-none');
    atualizarEstadoGrupoSelecionado(null);
    return;
  }

  gruposEmptyEl.classList.add('d-none');
  const fragment = document.createDocumentFragment();

  grupos.forEach((grupo) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'list-group-item list-group-item-action regra-grupo-item';
    item.dataset.grupoId = grupo.id;
    item.innerHTML = `
      <div class="d-flex justify-content-between align-items-center">
        <span>${grupo.nome}</span>
        <span class="badge bg-light text-dark border">${grupo.tamanho_grupo || 0}</span>
      </div>
    `;

    if (grupoSelecionadoId && Number(grupoSelecionadoId) === Number(grupo.id)) {
      item.classList.add('active');
    }

    item.addEventListener('click', () => {
      selecionarGrupo(grupo.id);
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
    regraEmptyEl.classList.remove('d-none');
    return;
  }

  regraEmptyEl.classList.add('d-none');
  const fragment = document.createDocumentFragment();

  regras.forEach((regra, index) => {
    const item = document.createElement('div');
    item.className = 'regra-flow-item';
    item.dataset.regraId = regra.id;

    const diasTexto = regra.dias_apos !== null && regra.dias_apos !== undefined
      ? `${regra.dias_apos} dia${Number(regra.dias_apos) === 1 ? '' : 's'}`
      : '--';

    const materiais = Array.isArray(regra.materiais) ? regra.materiais : [];
    const materiaisHtml = materiais.length
      ? materiais.map((material) => `<span class="badge bg-light text-dark border">${material.descricao}</span>`).join('')
      : '<span class="text-muted small">Sem materiais</span>';

    const isPrimeira = index === 0;
    const isUltima = index === regras.length - 1;

    item.innerHTML = `
      <div class="regra-flow-header">
        <div>
          <h3 class="regra-flow-title">${regra.nome || 'Regra sem titulo'}</h3>
          <div class="regra-flow-meta">Apos ${diasTexto} do ultimo contato</div>
        </div>
        <div class="regra-flow-actions">
          <button class="btn btn-sm btn-outline-primary" data-action="subir" data-id="${regra.id}" ${isPrimeira ? 'disabled' : ''}>
            <i class="bi bi-arrow-up"></i>
          </button>
          <button class="btn btn-sm btn-outline-primary" data-action="descer" data-id="${regra.id}" ${isUltima ? 'disabled' : ''}>
            <i class="bi bi-arrow-down"></i>
          </button>
          <button class="btn btn-sm btn-outline-secondary" data-action="editar" data-id="${regra.id}">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger" data-action="excluir" data-id="${regra.id}">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
      <p class="regra-flow-description mb-0">${regra.descricao || 'Sem descricao.'}</p>
      <div class="regra-flow-materiais">${materiaisHtml}</div>
    `;

    item.dataset.materiaisIds = materiais.map((material) => material.id).join(',');

    fragment.appendChild(item);

    if (index < regras.length - 1) {
      const arrow = document.createElement('div');
      arrow.className = 'regra-flow-arrow';
      arrow.innerHTML = `
        <span class="regra-flow-arrow-icon">
          <i class="bi bi-arrow-down"></i>
        </span>
        <span class="regra-flow-arrow-text">Proxima regra</span>
      `;
      fragment.appendChild(arrow);
    }
  });

  regraListEl.appendChild(fragment);
}

function selecionarGrupo(grupoId) {
  grupoSelecionadoId = grupoId;
  const grupo = gruposCache.find((item) => Number(item.id) === Number(grupoId));
  atualizarEstadoGrupoSelecionado(grupo);

  gruposListEl.querySelectorAll('.regra-grupo-item').forEach((item) => {
    item.classList.toggle('active', Number(item.dataset.grupoId) === Number(grupoId));
  });

  carregarRegras(grupoId);
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

function carregarRegras(grupoId, options = {}) {
  if (!grupoId) return;

  const { suave = false } = options;

  if (!suave) {
    renderizarLoading(regraListEl, 'Carregando regras...');
    regraEmptyEl.classList.add('d-none');
  } else {
    ativarLoadingSuave(regraListEl);
  }

  fetch(`/api/regras/${grupoId}/`)
    .then((res) => res.json())
    .then((data) => {
      const regras = data?.regras || [];
      regraEmptyEl.textContent = 'Nenhuma regra cadastrada para este grupo.';
      renderizarRegras(regras);
      if (suave) {
        desativarLoadingSuave(regraListEl);
      }
    })
    .catch(() => {
      if (suave) {
        desativarLoadingSuave(regraListEl);
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
  modalGrupoNovo?.show();
}

function abrirModalGrupoEditar() {
  const grupo = gruposCache.find((item) => Number(item.id) === Number(grupoSelecionadoId));
  if (!grupo) return;

  document.getElementById('grupo-editar-nome').value = grupo.nome || '';
  document.getElementById('grupo-editar-descricao').value = grupo.descricao || '';
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
      prepararContainerMateriais(regraMateriaisDisponiveisEl, 'Erro ao carregar materiais.');
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
      prepararContainerMateriais(regraEditarMateriaisDisponiveisEl, 'Erro ao carregar materiais.');
    })
    .finally(() => {});
}

function abrirModalRegraExcluir(regraId) {
  regraSelecionadaId = regraId;
  modalRegraExcluir?.show();
}

document.addEventListener('DOMContentLoaded', () => {
  carregarGrupos();

  btnNovoGrupo?.addEventListener('click', abrirModalGrupoNovo);
  btnNovoGrupoLateral?.addEventListener('click', abrirModalGrupoNovo);
  btnEditarGrupo?.addEventListener('click', abrirModalGrupoEditar);
  btnExcluirGrupo?.addEventListener('click', abrirModalGrupoExcluir);
  btnNovaRegra?.addEventListener('click', abrirModalRegraNova);

  document.getElementById('form-grupo-novo')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const nome = document.getElementById('grupo-nome').value.trim();
    const descricao = document.getElementById('grupo-descricao').value.trim();
    const submitBtn = event.target.querySelector('button[type="submit"]');

    definirLoadingBotao(submitBtn, true);
    fetch('/api/grupo-regras/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCookie('csrftoken'),
      },
      body: JSON.stringify({ nome, descricao }),
    })
      .then((res) => res.json())
    .then((data) => {
        modalGrupoNovo?.hide();
        grupoSelecionadoId = data?.id || data?.grupo_id || null;
        showToast('Grupo criado com sucesso!', 'success');
        renderizarLoading(regraListEl, 'Carregando regras...');
        regraEmptyEl.classList.add('d-none');
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
    const submitBtn = event.target.querySelector('button[type="submit"]');

    definirLoadingBotao(submitBtn, true);
    fetch(`/api/grupo-regras/update/${grupoSelecionadoId}/`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCookie('csrftoken'),
      },
      body: JSON.stringify({ nome, descricao }),
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
