import { showToast } from './message.js';

document.addEventListener('DOMContentLoaded', () => {
  const regraModal = new bootstrap.Modal(document.getElementById('regraModal'));
  const tbody = document.getElementById('regras-tbody');

  const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value;
  const novaRegraModalEl = document.getElementById('novaRegraModal');
  const novaRegraModal = novaRegraModalEl ? new bootstrap.Modal(novaRegraModalEl) : null;
  const materiaisContainer = document.getElementById('nova-regra-materiais');

  let materiaisCache = [];
  let materiaisCacheCarregado = false;
  let materiaisCachePromise = null;

  function atualizarMateriaisCache(force = false) {
    if (materiaisCacheCarregado && !force) {
      return Promise.resolve(materiaisCache);
    }
    if (materiaisCachePromise && !force) {
      return materiaisCachePromise;
    }

    materiaisCachePromise = fetch('/api/materiais/')
      .then(res => {
        if (!res.ok) {
          throw new Error('Falha ao buscar materiais');
        }
        return res.json();
      })
      .then(data => {
        materiaisCache = data?.materiais || [];
        materiaisCacheCarregado = true;
        return materiaisCache;
      })
      .catch(err => {
        materiaisCache = [];
        materiaisCacheCarregado = true;
        throw err;
      })
      .finally(() => {
        materiaisCachePromise = null;
      });

    return materiaisCachePromise;
  }

  function mostrarMensagemMateriais(container, mensagem, tipo = 'muted') {
    if (!container) return;

    container.classList.remove('d-flex', 'flex-wrap', 'gap-2');
    container.classList.remove('materiais-checkbox-group');
    if (tipo === 'muted') {
      container.classList.add('text-muted');
    } else {
      container.classList.remove('text-muted');
    }
    container.innerHTML = '';

    const span = document.createElement('span');
    span.className = `${tipo === 'danger' ? 'text-danger' : 'text-muted'} small`;
    span.textContent = mensagem;
    container.appendChild(span);
  }

  function renderizarMateriaisCheckbox(container, selecionados = [], prefixo = 'material') {
    if (!container) return;

    container.innerHTML = '';
    container.classList.add('materiais-checkbox-group', 'd-flex', 'flex-wrap', 'gap-2');
    container.classList.remove('text-muted');

    if (!materiaisCache.length) {
      mostrarMensagemMateriais(container, 'Nenhum material cadastrado.');
      return;
    }

    const fragment = document.createDocumentFragment();

    materiaisCache.forEach(material => {
      const inputId = `${prefixo}-${material.id}`;
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.className = 'btn-check';
      input.id = inputId;
      input.value = material.id;
      input.autocomplete = 'off';
      if (selecionados.includes(Number(material.id))) {
        input.checked = true;
      }

      const label = document.createElement('label');
      label.className = 'btn btn-outline-primary btn-sm materiais-chip me-2 mb-2';
      label.setAttribute('for', inputId);
      label.textContent = material.descricao;

      fragment.appendChild(input);
      fragment.appendChild(label);
    });

    container.appendChild(fragment);
  }

  function obterMateriaisSelecionados(container) {
    if (!container) return [];
    return Array.from(container.querySelectorAll('input[type="checkbox"]:checked'))
      .map(input => Number(input.value))
      .filter(id => !Number.isNaN(id));
  }

  function limparSelecaoMateriais(container) {
    if (!container) return;
    container.querySelectorAll('input[type="checkbox"]').forEach(input => {
      input.checked = false;
    });
  }

  function prepararMateriaisModal() {
    if (!materiaisContainer) {
      return;
    }

    const selecionadosAtuais = obterMateriaisSelecionados(materiaisContainer);
    mostrarMensagemMateriais(materiaisContainer, 'Carregando materiais...');

    atualizarMateriaisCache(true)
      .then(() => {
        renderizarMateriaisCheckbox(materiaisContainer, selecionadosAtuais, 'modal-material');
      })
      .catch(err => {
        console.error('Erro ao carregar materiais:', err);
        mostrarMensagemMateriais(materiaisContainer, 'Erro ao carregar materiais.', 'danger');
      });
  }

  if (novaRegraModalEl) {
    novaRegraModalEl.addEventListener('show.bs.modal', () => {
      prepararMateriaisModal();
    });

    novaRegraModalEl.addEventListener('hidden.bs.modal', function () {
      if (regraModal) {
        regraModal.show();
      }
    });
  }

  function carregarGrupoRegras() {
    fetch('/api/grupo-regras/')
      .then(res => res.json())
      .then(data => {

        // Preenche o <select> dropdown (se existir)
        const grupoSelect = document.getElementById('grupo-regras');
        if (grupoSelect) {
          grupoSelect.innerHTML = '';
          data.grupos.forEach(grupo => {
            const option = document.createElement('option');
            option.value = grupo.id;
            option.textContent = grupo.nome;
            grupoSelect.appendChild(option);
          });
        }

        // Preenche o painel lateral
        const gruposLista = document.getElementById('grupos-lista');
        gruposLista.innerHTML = '';
        
        data.grupos.forEach((grupo, index) => {
          
          const a = document.createElement('a');
          a.href = '#';
          a.className = 'list-group-item list-group-item-action' + (index === 0 ? ' active' : '');
          a.dataset.grupoId = grupo.id;
          a.dataset.nomeGrupo = grupo.nome;
          a.dataset.descricaoGrupo = grupo.descricao;
          
          a.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
              <span>${grupo.nome}</span>
              <span class="badge bg-primary rounded-pill">${grupo.tamanho_grupo || 0}</span>
            </div>
          `;

          // Adiciona evento de clique
          a.addEventListener('click', (e) => {
            e.preventDefault();

            // Remove classe active dos outros
            gruposLista.querySelectorAll('.list-group-item').forEach(el => el.classList.remove('active'));
            a.classList.add('active');

            // Define ID do grupo no campo oculto
            document.getElementById('regra-grupo-id').value = grupo.id;
            document.getElementById('nome-grupo').value = grupo.nome;
            document.getElementById('descricao-grupo').value = grupo.descricao;

            // Carrega regras do grupo
            carregarRegras(grupo.id);
          });

          gruposLista.appendChild(a);
        });

        // Força o clique no primeiro item após preencher
        const primeiroGrupo = gruposLista.querySelector('.list-group-item');
        if (primeiroGrupo) primeiroGrupo.click();
      })
      .catch(err => console.error('Erro ao carregar grupos de regras:', err));
  }

  function carregarRegras(grupoIdParam) {
    const idGrupo = (typeof grupoIdParam === 'number' || typeof grupoIdParam === 'string')
      ? grupoIdParam
      : document.getElementById('regra-grupo-id').value;
    const tbody = document.getElementById('regras-tbody');
    
    // Mostra um loading na tabela
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Carregando...</span>
          </div>
        </td>
      </tr>
    `;

    fetch(`/api/regras/${idGrupo}/`)
      .then(res => res.json())
      .then(data => {
        tbody.innerHTML = '';

        data.regras.forEach(regra => {
          const tr = document.createElement('tr');
          tr.dataset.regraId = regra.id;
          tr.dataset.materiaisIds = (regra.materiais_ids || []).join(',');

          tr.innerHTML = `
            <td class="nome"></td>
            <td class="dias"></td>
            <td class="descricao"></td>
            <td class="materiais"></td>
            <td class="acoes d-flex gap-2">
              <button class="btn btn-sm btn-info btn-editar" title="Editar">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-sm btn-success" data-up="${regra.id}" title="Mover para cima">
                <i class="bi bi-arrow-up"></i>
              </button>
              <button class="btn btn-sm btn-success" data-down="${regra.id}" title="Mover para baixo">
                <i class="bi bi-arrow-down"></i>
              </button>
              <button class="btn btn-sm btn-danger" data-excluir="${regra.id}" title="Excluir">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          `;

          tr.querySelector('.nome').textContent = regra.nome || '';
          tr.querySelector('.dias').textContent = regra.dias_apos ?? '';
          tr.querySelector('.descricao').textContent = regra.descricao || '';

          const materiaisTd = tr.querySelector('.materiais');
          materiaisTd.innerHTML = '';
          const materiais = Array.isArray(regra.materiais) ? regra.materiais : [];
          if (materiais.length) {
            materiais.forEach(material => {
              const badge = document.createElement('span');
              badge.className = 'badge bg-light text-dark border me-1';
              badge.textContent = material.descricao;
              materiaisTd.appendChild(badge);
            });
          } else {
            materiaisTd.innerHTML = '<span class="text-muted">Nenhum</span>';
          }

          tbody.appendChild(tr);
        });

        // Adiciona o comportamento de edição inline
        tbody.querySelectorAll('.btn-editar').forEach(btn => {
          btn.addEventListener('click', async function () {
            const row = btn.closest('tr');
            const id = row.dataset.regraId;
            const nome = row.querySelector('.nome').textContent;
            const dias = row.querySelector('.dias').textContent;
            const descricao = row.querySelector('.descricao').textContent;
            const materiaisIds = (row.dataset.materiaisIds || '')
              .split(',')
              .filter(Boolean)
              .map(Number);

            let carregamentoOk = true;
            try {
              await atualizarMateriaisCache();
            } catch (error) {
              carregamentoOk = false;
              console.error('Não foi possível atualizar a lista de materiais:', error);
            }

            row.innerHTML = `
            <td><input type="text" class="form-control form-control-sm nome-input" value="${nome}"></td>
            <td><input type="number" class="form-control form-control-sm dias-input" value="${dias}"></td>
              <td><input type="text" class="form-control form-control-sm descricao-input" value="${descricao}"></td>
              <td>
                <div class="materiais-editor-container border rounded p-2 small text-muted" style="max-height: 200px; overflow-y: auto;">
                  Carregando materiais...
                </div>
              </td>
              <td>
                <button class="btn btn-sm btn-success btn-salvar" title="Salvar">
                  <i class="bi bi-check"></i>
                </button>
                <button class="btn btn-sm btn-danger btn-cancelar" title="Cancelar">
                  <i class="bi bi-x"></i>
                </button>
              </td>
            `;

            const editorContainer = row.querySelector('.materiais-editor-container');
            if (materiaisCache.length) {
              renderizarMateriaisCheckbox(
                editorContainer,
                materiaisIds,
                `row-${id}-material`
              );
            } else if (carregamentoOk) {
              mostrarMensagemMateriais(editorContainer, 'Nenhum material cadastrado.');
            } else {
              mostrarMensagemMateriais(editorContainer, 'Erro ao carregar materiais.', 'danger');
            }

            row.querySelector('.btn-salvar').addEventListener('click', () => salvarEdicao(id, row));
            row.querySelector('.btn-cancelar').addEventListener('click', carregarRegras);
          });
        });
      });
  }

  // Ações de editar e mover
  tbody.addEventListener('click', e => {
    const upBtn = e.target.closest('[data-up]');
    const downBtn = e.target.closest('[data-down]');
    const excluirBtn = e.target.closest('[data-excluir]');
    const grupoId = document.getElementById('regra-grupo-id').value;

    if (excluirBtn) {
      const id = excluirBtn.getAttribute('data-excluir');

      if (confirm('Tem certeza que deseja excluir esta regra?')) {
        fetch(`/api/regras/update/${id}/${grupoId}/`, {
          method: 'DELETE',
          headers: { 'X-CSRFToken': csrfToken }
        }).then(() => {
          showToast('Regra excluída com sucesso!', 'success');
          carregarRegras(grupoId)
        });
      }
    }

    if (upBtn || downBtn) {
      const id = (upBtn || downBtn).getAttribute('data-up') || (upBtn || downBtn).getAttribute('data-down');
      const direction = upBtn ? 'up' : 'down';

      fetch(`/api/regras/${id}/${grupoId}/mover-${direction}/`, {
        method: 'POST',
        headers: { 'X-CSRFToken': csrfToken }
      }).then(() => {
        showToast('Salvo', 'success');
        carregarRegras(grupoId)
      });
    }
  });

  carregarGrupoRegras();
  inicializarBotaoEditarGrupoModal();
  atualizarMateriaisCache().catch(() => {});

  function salvarEdicao(id, row) {
    const grupoId = document.getElementById('regra-grupo-id').value;
    const btnSalvar = row.querySelector('.btn-salvar');

    // Cria spinner se não existir
    let spinner = btnSalvar.querySelector('.spinner-border');
    if (!spinner) {
      spinner = document.createElement('span');
      spinner.className = 'spinner-border spinner-border-sm ms-2'; // pequeno spinner, margem esquerda
      spinner.setAttribute('role', 'status');
      spinner.setAttribute('aria-hidden', 'true');
      btnSalvar.appendChild(spinner);
    }

    // Mostra spinner e desabilita botão
    spinner.style.display = 'inline-block';
    btnSalvar.disabled = true;

    const materiaisContainerInline = row.querySelector('.materiais-editor-container');
    const materiaisSelecionados = obterMateriaisSelecionados(materiaisContainerInline);

    const diasValue = row.querySelector('.dias-input').value;
    const diasNumero = diasValue !== '' ? Number(diasValue) : null;

    const payload = {
      nome: row.querySelector('.nome-input').value,
      dias_apos: diasNumero,
      descricao: row.querySelector('.descricao-input').value,
      materiais: materiaisSelecionados,
    };

    fetch(`/api/regras/update/${id}/${grupoId}/`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCookie('csrftoken')
      },
      body: JSON.stringify(payload)
    })
      .then(res => {
        if (!res.ok) throw new Error('Erro ao salvar');
        return res.json();
      })
      .then(() => {
        showToast('Regra editada com sucesso!', 'success');
        carregarRegras();
      })
      .catch(err => {
        alert('Erro ao salvar edição');
        console.error(err);
      })
      .finally(() => {
        // Esconde spinner e habilita botão novamente
        spinner.style.display = 'none';
        btnSalvar.disabled = false;
      });
  }

  // Submissão do formulário
  document.getElementById('nova-regra-form').addEventListener('submit', function (e) {
    e.preventDefault();
    const grupoId = document.getElementById('regra-grupo-id').value;
    const materiaisSelecionados = obterMateriaisSelecionados(materiaisContainer);

    const submitBtn = document.getElementById('salvarRegraBtn');
    const originalBtnHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Salvando...`;

    const payload = {
      nome: document.getElementById('nova-regra-nome').value,
      dias_apos: document.getElementById('nova-regra-dias').value,
      descricao: document.getElementById('nova-regra-descricao').value,
      grupo: grupoId,
      materiais: materiaisSelecionados,
    };

    fetch(`/api/regras/${grupoId}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCookie('csrftoken')
      },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(() => {
        document.getElementById('nova-regra-form').reset();
        if (materiaisContainer) {
          limparSelecaoMateriais(materiaisContainer);
          materiaisContainer.scrollTop = 0;
        }
        if (novaRegraModal) {
          novaRegraModal.hide(); // Ao esconder, o evento 'hidden.bs.modal' reabrirá regraModal
        }
        showToast('Regra criada com sucesso!', 'success');
        carregarRegras(grupoId); // Atualiza tabela
        carregarGrupoRegras();
      })
      .finally(() => {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
      });
  });

  document.getElementById('grupos-lista').addEventListener('click', function (e) {
    const link = e.target.closest('a[data-grupo-id]');
    if (!link) return;

    // Remove .active de todos os itens e aplica ao clicado
    document.querySelectorAll('#grupos-lista .list-group-item').forEach(el => el.classList.remove('active'));
    link.classList.add('active');

    const grupoId = link.dataset.grupoId;
    const nomeGrupo = link.dataset.nomeGrupo;
    const descricaoGrupo = link.dataset.descricaoGrupo;

    // Salva o ID no input escondido do modal
    document.getElementById('regra-grupo-id').value = grupoId;
    document.getElementById('grupo-selecionado-titulo').innerHTML = nomeGrupo;
    document.getElementById('grupo-descricao').innerHTML = descricaoGrupo || 'Sem descrição';

    // carregarRegras(grupoId);
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

  // abre modal para criar nome para novo grupo
  document.getElementById('novoGrupoBtn').addEventListener('click', function () {
    const regraModalEl = document.getElementById('regraModal');
    const novoGrupoModalEl = document.getElementById('novoGrupoModal');

    const regraModal = bootstrap.Modal.getInstance(regraModalEl) || new bootstrap.Modal(regraModalEl);
    const novoGrupoModal = new bootstrap.Modal(novoGrupoModalEl);

    // Oculta o modal antigo
    regraModal.hide();

    // Mostra o novo modal
    novoGrupoModal.show();

    // Quando o novo modal for fechado (por qualquer motivo: cancelar, clicar fora, etc.)
    novoGrupoModalEl.addEventListener('hidden.bs.modal', function handler() {
      // Reabre o modal antigo
      regraModal.show();

      // Remove o listener para evitar múltiplos disparos
      novoGrupoModalEl.removeEventListener('hidden.bs.modal', handler);
    });
  });

  // botão para salvar grupo salvarGrupoBtn
  document.getElementById('grupoForm').addEventListener('submit', function (e) {
    e.preventDefault();

    const novoGrupoModalEl = document.getElementById('novoGrupoModal');
    const novoGrupoModal = bootstrap.Modal.getInstance(novoGrupoModalEl);

    const regraModalEl = document.getElementById('regraModal');
    const regraModal = bootstrap.Modal.getInstance(regraModalEl) || new bootstrap.Modal(regraModalEl);

    const submitBtn = document.getElementById('salvarGrupoBtn');
    const originalBtnHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Salvando...`;

    const payload = {
      nome: document.getElementById('grupoNome').value,
      descricao: document.getElementById('grupoDescricao').value
    };

    fetch(`/api/grupo-regras/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCookie('csrftoken')
      },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(() => {
        document.getElementById('grupoForm').reset();

        novoGrupoModalEl.addEventListener('hidden.bs.modal', function handler() {
          regraModal.show();
          novoGrupoModalEl.removeEventListener('hidden.bs.modal', handler);
        });
        carregarGrupoRegras();
        novoGrupoModal.hide();
        showToast('Grupo de regra criado com sucesso!', 'success');
      })
      .finally(() => {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
      });
  });

  // botao para editar grupo (nome e descrição)
  function inicializarBotaoEditarGrupoModal() {
    const btn = document.getElementById('modalEditarGrupoBtn');

    if (btn && !btn.dataset.listenerAdded) {
      btn.dataset.listenerAdded = 'true';

      btn.addEventListener('click', function () {
        const regraModalEl = document.getElementById('regraModal');
        const novoGrupoModalEl = document.getElementById('editarGrupo');

        const regraModal = bootstrap.Modal.getInstance(regraModalEl) || new bootstrap.Modal(regraModalEl);
        const novoGrupoModal = new bootstrap.Modal(novoGrupoModalEl, { show: false }); // evitar auto-show

        // Oculta o modal antigo
        regraModal.hide();

        // Preenche os campos do modal de edição
        const nomeGrupo = document.getElementById('nome-grupo').value;
        const descricaoGrupo = document.getElementById('descricao-grupo').value;

        document.getElementById('editarGrupoNome').value = nomeGrupo;
        document.getElementById('editarGrupoDescricao').value = descricaoGrupo;

        // Mostra o novo modal
        novoGrupoModal.show();

        // Protege o botão cancelar contra múltiplos listeners
        const cancelarBtn = novoGrupoModalEl.querySelector('.btn-cancelar-grupo');
        if (cancelarBtn && !cancelarBtn.dataset.listenerAdded) {
          cancelarBtn.dataset.listenerAdded = 'true';

          cancelarBtn.addEventListener('click', function () {
            novoGrupoModal.hide();
            regraModal.show();
          });
        }
      });
    }
  }

  // botão para salvar grupo salvarGrupoBtn
  document.getElementById('editarGrupoForm').addEventListener('submit', function (e) {
    e.preventDefault();

    const novoGrupoModalEl = document.getElementById('editarGrupo');
    const novoGrupoModal = bootstrap.Modal.getInstance(novoGrupoModalEl);

    const regraModalEl = document.getElementById('regraModal');
    const regraModal = bootstrap.Modal.getInstance(regraModalEl) || new bootstrap.Modal(regraModalEl);

    const grupoId = document.getElementById('regra-grupo-id').value;

    const submitBtn = document.getElementById('editarGrupoBtn');
    const originalBtnHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Salvando...`;

    const payload = {
      nome: document.getElementById('editarGrupoNome').value,
      descricao: document.getElementById('editarGrupoDescricao').value
    };

    fetch(`/api/grupo-regras/update/${grupoId}/`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCookie('csrftoken')
      },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(() => {
        document.getElementById('editarGrupoForm').reset();

        // Adiciona listener para reabrir o modal antigo após fechar este
        novoGrupoModalEl.addEventListener('hidden.bs.modal', function handler() {
          regraModal.show();
          novoGrupoModalEl.removeEventListener('hidden.bs.modal', handler);
        });
        carregarGrupoRegras();
        novoGrupoModal.hide(); // Vai disparar o evento e reabrir o antigo
        showToast('Grupo de regra editado com sucesso!', 'success');
      })
      .finally(() => {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
      });
  });

  document.getElementById('btnNovaRegra').addEventListener('click', function () {

    const grupoId = document.getElementById('regra-grupo-id').value;

    if(!grupoId){
      return showToast('Crie um grupo de regras','error');
    } else {
      const novaRegraModalEl = document.getElementById('novaRegraModal');
      const novaRegraModal = bootstrap.Modal.getInstance(novaRegraModalEl) || new bootstrap.Modal(novaRegraModalEl);

      const regraModalEl = document.getElementById('regraModal');
      const regraModal = bootstrap.Modal.getInstance(regraModalEl) || new bootstrap.Modal(regraModalEl);

      regraModal.hide();
      novaRegraModal.show();

    }

  });

  document.getElementById('confirmar-exclusao-grupo-btn').addEventListener('click', function () {
    const grupoId = document.getElementById('regra-grupo-id').value;
    const excluirGrupoModalEl = document.getElementById('confirmarExclusaoGrupoModal');
    const excluirGrupoModal = bootstrap.Modal.getInstance(excluirGrupoModalEl);

    const btn = this;
    const originalBtnHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Excluindo...`;

    fetch(`/api/excluir-grupo-regra/${grupoId}/`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCookie('csrftoken')
      },
      body: JSON.stringify({ id: grupoId })
    })
      .then(res => {
        if (!res.ok) throw new Error('Erro ao excluir grupo');
        return res.json();
      })
      .then(() => {
        excluirGrupoModal.hide();
        showToast('Grupo excluído com sucesso!', 'success');
        carregarGrupoRegras();
      })
      .catch(() => {
        showToast('Erro ao excluir grupo', 'error');
      })
      .finally(() => {
        btn.disabled = false;
        btn.innerHTML = originalBtnHtml;
      });
  });

});
