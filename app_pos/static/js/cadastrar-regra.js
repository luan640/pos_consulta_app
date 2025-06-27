import { showToast } from './message.js';

document.addEventListener('DOMContentLoaded', () => {
  const regraModal = new bootstrap.Modal(document.getElementById('regraModal'));
  const tbody = document.getElementById('regras-tbody');

  const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value;

  function carregarGrupoRegras() {
    fetch('/api/grupo-regras/')
      .then(res => res.json())
      .then(data => {

        if (!data.grupos || data.grupos.length === 0) {
          document.getElementById('sem-regras').classList.remove('d-none');
          return;
        }

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

  function carregarRegras() {

    const idGrupo = document.getElementById('regra-grupo-id').value

    fetch(`/api/regras/${idGrupo}/`)
      .then(res => res.json())
      .then(data => {
        const tbody = document.getElementById('regras-tbody');
        tbody.innerHTML = '';

        data.regras.forEach(regra => {
          const tr = document.createElement('tr');
          tr.dataset.regraId = regra.id;

          tr.innerHTML = `
            <td class="nome">${regra.nome}</td>
            <td class="dias">${regra.dias_apos}</td>
            <td class="descricao">${regra.descricao}</td>
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

          tbody.appendChild(tr);
        });

        // Adiciona o comportamento de edição inline
        tbody.querySelectorAll('.btn-editar').forEach(btn => {
          btn.addEventListener('click', function () {
            const row = btn.closest('tr');
            const id = row.dataset.regraId;
            const nome = row.querySelector('.nome').textContent;
            const dias = row.querySelector('.dias').textContent;
            const descricao = row.querySelector('.descricao').textContent;

            row.innerHTML = `
            <td><input type="text" class="form-control form-control-sm nome-input" value="${nome}"></td>
            <td><input type="number" class="form-control form-control-sm dias-input" value="${dias}"></td>
              <td><input type="text" class="form-control form-control-sm descricao-input" value="${descricao}"></td>
              <td>
                <button class="btn btn-sm btn-success btn-salvar" title="Salvar">
                  <i class="bi bi-check"></i>
                </button>
                <button class="btn btn-sm btn-danger btn-cancelar" title="Cancelar">
                  <i class="bi bi-x"></i>
                </button>
              </td>
            `;

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

  function salvarEdicao(id, row) {

    const grupoId = document.getElementById('regra-grupo-id').value;

    const payload = {
      nome: row.querySelector('.nome-input').value,
      dias_apos: parseInt(row.querySelector('.dias-input').value, 10),
      descricao: row.querySelector('.descricao-input').value,
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
      });
  }

  const novaRegraModalEl = document.getElementById('novaRegraModal');
  const novaRegraModal = new bootstrap.Modal(novaRegraModalEl);

  // Reabrir regraModal após fechar novaRegraModal
  novaRegraModalEl.addEventListener('hidden.bs.modal', function () {
    
    regraModal.show();
  });

  // Submissão do formulário
  document.getElementById('nova-regra-form').addEventListener('submit', function (e) {
    
    e.preventDefault();
    const grupoId = document.getElementById('regra-grupo-id').value

    const payload = {
      nome: document.getElementById('nova-regra-nome').value,
      dias_apos: document.getElementById('nova-regra-dias').value,
      descricao: document.getElementById('nova-regra-descricao').value,
      grupo: grupoId
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
        novaRegraModal.hide(); // Ao esconder, o evento 'hidden.bs.modal' reabrirá regraModal
        showToast('Regra criada com sucesso!', 'success');
        carregarRegras(grupoId); // Atualiza tabela
        carregarGrupoRegras();
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

    carregarRegras(grupoId);
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

        // Adiciona listener para reabrir o modal antigo após fechar este
        novoGrupoModalEl.addEventListener('hidden.bs.modal', function handler() {
          regraModal.show();
          novoGrupoModalEl.removeEventListener('hidden.bs.modal', handler);
        });
        carregarGrupoRegras();
        novoGrupoModal.hide(); // Vai disparar o evento e reabrir o antigo
        showToast('Grupo de regra criado com sucesso!', 'success');
      });
  });

  // botao para editar grupo (nome e descrição)
  document.getElementById('modalEditarGrupoBtn').addEventListener('click', function () {
    const regraModalEl = document.getElementById('regraModal');
    const novoGrupoModalEl = document.getElementById('editarGrupo');

    const regraModal = bootstrap.Modal.getInstance(regraModalEl) || new bootstrap.Modal(regraModalEl);
    const novoGrupoModal = new bootstrap.Modal(novoGrupoModalEl);

    // Oculta o modal antigo
    regraModal.hide();

    const nomeGrupo = document.getElementById('nome-grupo').value;
    const descricaoGrupo = document.getElementById('descricao-grupo').value;

    // Mostra o novo modal
    novoGrupoModal.show();

    document.getElementById('editarGrupoNome').value = nomeGrupo;
    document.getElementById('editarGrupoDescricao').value = descricaoGrupo;

    // Quando o novo modal for fechado (por qualquer motivo: cancelar, clicar fora, etc.)
    novoGrupoModalEl.addEventListener('hidden.bs.modal', function handler() {
      // Reabre o modal antigo
      regraModal.show();

      // Remove o listener para evitar múltiplos disparos
      novoGrupoModalEl.removeEventListener('hidden.bs.modal', handler);
    });
  });

  // botão para salvar grupo salvarGrupoBtn
  document.getElementById('editarGrupoForm').addEventListener('submit', function (e) {
    e.preventDefault();

    const novoGrupoModalEl = document.getElementById('editarGrupo');
    const novoGrupoModal = bootstrap.Modal.getInstance(novoGrupoModalEl);

    const regraModalEl = document.getElementById('regraModal');
    const regraModal = bootstrap.Modal.getInstance(regraModalEl) || new bootstrap.Modal(regraModalEl);

    const grupoId = document.getElementById('regra-grupo-id').value;

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

});

