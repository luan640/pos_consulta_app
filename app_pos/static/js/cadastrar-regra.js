import { showToast } from './message.js';

document.addEventListener('DOMContentLoaded', () => {
  const regraModal = new bootstrap.Modal(document.getElementById('regraModal'));
  const form = document.getElementById('regra-form');

  const idInput = document.getElementById('regra-id');
  const nomeInput = document.getElementById('regra-nome');
  const diasInput = document.getElementById('regra-dias');
  const descInput = document.getElementById('regra-descricao');
  const ordemInput = document.getElementById('regra-ordem');
  const tbody = document.getElementById('regras-tbody');

  const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value;

  function carregarRegras() {
    fetch('/api/regras/')
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
              <button class="btn btn-sm btn-outline-primary btn-editar" title="Editar">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-sm btn-outline-secondary" data-up="${regra.id}" title="Mover para cima">
                <i class="bi bi-arrow-up"></i>
              </button>
              <button class="btn btn-sm btn-outline-secondary" data-down="${regra.id}" title="Mover para baixo">
                <i class="bi bi-arrow-down"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger" data-excluir="${regra.id}" title="Excluir">
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
                <button class="btn btn-sm btn-outline-success btn-salvar" title="Salvar">
                  <i class="bi bi-check"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger btn-cancelar" title="Cancelar">
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

    if (excluirBtn) {
      const id = excluirBtn.getAttribute('data-excluir');
      if (confirm('Tem certeza que deseja excluir esta regra?')) {
        fetch(`/api/regras/${id}/`, {
          method: 'DELETE',
          headers: { 'X-CSRFToken': csrfToken }
        }).then(() => {
          showToast('Regra excluída com sucesso!', 'success');
          carregarRegras()
        });
      }
    }

    if (upBtn || downBtn) {
      const id = (upBtn || downBtn).getAttribute('data-up') || (upBtn || downBtn).getAttribute('data-down');
      const direction = upBtn ? 'up' : 'down';

      fetch(`/api/regras/${id}/mover-${direction}/`, {
        method: 'POST',
        headers: { 'X-CSRFToken': csrfToken }
      }).then(() => {
        showToast('Salvo', 'success');
        carregarRegras()
      });
    }
  });

  carregarRegras();

  function salvarEdicao(id, row) {
    const payload = {
      nome: row.querySelector('.nome-input').value,
      dias_apos: parseInt(row.querySelector('.dias-input').value, 10),
      descricao: row.querySelector('.descricao-input').value,
    };

    fetch(`/api/regras/${id}/`, {
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

    const payload = {
      nome: document.getElementById('nova-regra-nome').value,
      dias_apos: document.getElementById('nova-regra-dias').value,
      descricao: document.getElementById('nova-regra-descricao').value,
    };

    fetch('/api/regras/', {
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
        carregarRegras(); // Atualiza tabela
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

});

