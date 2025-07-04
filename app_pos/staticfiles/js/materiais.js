import { showToast } from './message.js';
import { inicializarSelecaoMateriais } from './home.js';

document.addEventListener('DOMContentLoaded', function () {
  carregarMateriais();

});

function carregarMateriais() {
    fetch('/api/materiais/')
        .then(res => res.json())
        .then(data => {
        const tbody = document.getElementById('materiais-tbody');
        tbody.innerHTML = '';
        
        const semMaterial = document.getElementById('sem-materiais');
        if (data.materiais.length === 0) {
            semMaterial.classList.remove('d-none');
        } else {
            semMaterial.classList.add('d-none');
        }

        data.materiais.forEach(material => {
            const tr = document.createElement('tr');
            tr.dataset.materialId = material.id;
            tr.innerHTML = `
            <td class="descricao">${material.descricao}</td>
            <td class="acoes d-flex gap-2">
                <button class="btn btn-sm btn-info btn-editar" title="Editar">
                <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-danger btn-excluir" title="Excluir">
                <i class="bi bi-trash"></i>
                </button>
            </td>
            `;
            tbody.appendChild(tr);
        });

        // Edição inline
        tbody.querySelectorAll('.btn-editar').forEach(btn => {
            btn.addEventListener('click', function () {
            const row = btn.closest('tr');
            const id = row.dataset.materialId;
            const descricao = row.querySelector('.descricao').textContent;

            row.innerHTML = `
                <td><input type="text" class="form-control form-control-sm descricao-input" value="${descricao}"></td>
                <td class="d-flex gap-2">
                <button class="btn btn-sm btn-success btn-salvar" title="Salvar">
                    <span class="btn-salvar-content"><i class="bi bi-check"></i></span>
                </button>
                <button class="btn btn-sm btn-danger btn-cancelar" title="Cancelar">
                    <i class="bi bi-x"></i>
                </button>
                </td>
            `;

            const btnSalvar = row.querySelector('.btn-salvar');
            btnSalvar.addEventListener('click', () => {
                const novaDescricao = row.querySelector('.descricao-input').value.trim();
                if (!novaDescricao) {
                    alert('Descrição não pode ser vazia.');
                    return;
                }

                // Mostra loading
                const salvarContent = btnSalvar.querySelector('.btn-salvar-content');
                salvarContent.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>`;
                btnSalvar.disabled = true;

                fetch(`/api/materiais/${id}/`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCookie('csrftoken')
                    },
                    body: JSON.stringify({ descricao: novaDescricao })
                })
                .then(async res => {
                    const data = await res.json();
                    if (!res.ok) {
                        showToast(data.erro || 'Erro ao atualizar material', 'error');
                        carregarMateriais();
                        return;
                    }
                    showToast(data.mensagem || 'Material atualizado com sucesso!', 'success');
                    carregarMateriais();
                    inicializarSelecaoMateriais();
                })
                .catch(err => {
                    console.error(err);
                    showToast('Erro inesperado ao tentar salvar.', 'error');
                });
            });

            row.querySelector('.btn-cancelar').addEventListener('click', carregarMateriais);
            });
        });

        // Exclusão
        tbody.querySelectorAll('.btn-excluir').forEach(btn => {
            btn.addEventListener('click', function () {
            const row = btn.closest('tr');
            const id = row.dataset.materialId;
            if (confirm('Deseja excluir este material?')) {
                fetch(`/api/materiais/${id}/`, {
                method: 'DELETE'
                })
                .then(async res => {
                const data = await res.json();
                if (!res.ok) {
                    showToast(data.erro || 'Erro ao deletar material', 'error');
                    carregarMateriais();
                    return;
                }
                    showToast(data.mensagem || 'Material deletado com sucesso!', 'success');
                    carregarMateriais();
                    inicializarSelecaoMateriais();

                })
                .catch(err => {
                    console.error(err);
                    showToast('Erro inesperado ao tentar deletar.', 'error');
                });
            }
            });
        });

        });
}

// submissão do formulario novo-material-form
const novoMaterialForm = document.getElementById('novo-material-form');
const btnSalvarNovoMaterial = novoMaterialForm.querySelector('button[type="submit"]');

novoMaterialForm.addEventListener('submit', function (e) {
    e.preventDefault();

    const descricaoInput = novoMaterialForm.querySelector('[name="novo-material-nome"]');
    const descricao = descricaoInput.value.trim();

    if (!descricao) {
        showToast('Descrição não pode ser vazia.', 'error');
        return;
    }

    // Mostra loading no botão
    const originalBtnContent = btnSalvarNovoMaterial.innerHTML;
    btnSalvarNovoMaterial.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Salvando...`;
    btnSalvarNovoMaterial.disabled = true;

    fetch('/api/materiais/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify({ descricao })
    })
    .then(async res => {
        const data = await res.json();
        if (!res.ok) {
            showToast(data.erro || 'Erro ao adicionar material', 'error');
            return;
        }
        showToast(data.mensagem || 'Material adicionado com sucesso!', 'success');
        descricaoInput.value = '';
        inicializarSelecaoMateriais();
        carregarMateriais();

        const modalGerenciarMaterialEl = document.getElementById('gerenciarMateriaisModal');
        const modalGerenciarMaterial = bootstrap.Modal.getInstance(modalGerenciarMaterialEl) || new bootstrap.Modal(modalGerenciarMaterialEl);

        const modalNovoMaterialEl = document.getElementById('novoMaterialModal');
        const modalNovoMaterial = bootstrap.Modal.getInstance(modalNovoMaterialEl) || new bootstrap.Modal(modalNovoMaterialEl);

        modalNovoMaterial.hide();
        modalGerenciarMaterial.show();

    })
    .catch(err => {
        console.error(err);
        showToast('Erro inesperado ao tentar adicionar.', 'error');
    })
    .finally(() => {
        // Restaura o botão
        btnSalvarNovoMaterial.innerHTML = originalBtnContent;
        btnSalvarNovoMaterial.disabled = false;
    });
});

const modalGerenciarMaterialEl = document.getElementById('gerenciarMateriaisModal');
const modalGerenciarMaterial = bootstrap.Modal.getInstance(modalGerenciarMaterialEl) || new bootstrap.Modal(modalGerenciarMaterialEl);
const modalNovoMaterialEl = document.getElementById('novoMaterialModal');

modalNovoMaterialEl.addEventListener('hidden.bs.modal', function () {
    modalGerenciarMaterial.show();
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