import { showToast } from './message.js';

const tbody = document.getElementById('pacientes-tbody');
const emptyState = document.getElementById('pacientes-vazio');
const filtrosForm = document.getElementById('pacientes-filtros');
const filtroNome = document.getElementById('filtro-nome');
const filtroTelefone = document.getElementById('filtro-telefone');
const filtroLimpar = document.getElementById('filtro-limpar');

const novoForm = document.getElementById('novo-paciente-form');
const novoModalEl = document.getElementById('novoPacienteModal');
const novoModal = novoModalEl ? new bootstrap.Modal(novoModalEl) : null;

const editarForm = document.getElementById('editar-paciente-form');
const editarModalEl = document.getElementById('editarPacienteModal');
const editarModal = editarModalEl ? new bootstrap.Modal(editarModalEl) : null;

let pacientesCache = [];

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

function renderPacientes(lista) {
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!lista.length) {
        emptyState?.classList.remove('d-none');
        return;
    }

    emptyState?.classList.add('d-none');
    const fragment = document.createDocumentFragment();

    lista.forEach((paciente) => {
        const tr = document.createElement('tr');
        tr.dataset.pacienteId = paciente.id;
        tr.innerHTML = `
            <td class="paciente-nome">${paciente.nome || '-'}</td>
            <td class="paciente-telefone">${paciente.telefone || '-'}</td>
            <td>${paciente.criado_em || '-'}</td>
            <td class="text-end">
                <button type="button" class="btn btn-sm btn-outline-primary btn-editar">
                    <i class="bi bi-pencil"></i>
                    Editar
                </button>
            </td>
        `;
        fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);
}

function aplicarFiltroTelefone(lista, telefone) {
    if (!telefone) return lista;
    const filtro = telefone.trim().toLowerCase();
    if (!filtro) return lista;
    return lista.filter((paciente) => (paciente.telefone || '').toLowerCase().includes(filtro));
}

function carregarPacientes({ nome = '', telefone = '' } = {}) {
    if (!tbody) return;
    tbody.innerHTML = `
        <tr>
            <td colspan="4" class="text-center text-muted py-4">Carregando pacientes...</td>
        </tr>
    `;
    emptyState?.classList.add('d-none');

    const params = new URLSearchParams();
    if (nome) params.set('nome', nome);
    params.set('page', '1');
    params.set('page_size', '200');

    fetch(`/api/pacientes/?${params.toString()}`)
        .then((res) => res.json())
        .then((data) => {
            pacientesCache = data?.pacientes || [];
            const lista = aplicarFiltroTelefone(pacientesCache, telefone);
            renderPacientes(lista);
        })
        .catch(() => {
            tbody.innerHTML = '';
            emptyState?.classList.remove('d-none');
            showToast('Erro ao carregar pacientes', 'error');
        });
}

if (filtrosForm) {
    filtrosForm.addEventListener('submit', (event) => {
        event.preventDefault();
        carregarPacientes({
            nome: filtroNome?.value || '',
            telefone: filtroTelefone?.value || '',
        });
    });
}

if (filtroLimpar) {
    filtroLimpar.addEventListener('click', () => {
        if (filtroNome) filtroNome.value = '';
        if (filtroTelefone) filtroTelefone.value = '';
        carregarPacientes();
    });
}

if (tbody) {
    tbody.addEventListener('click', (event) => {
        const botao = event.target.closest('.btn-editar');
        if (!botao) return;
        const linha = botao.closest('tr');
        if (!linha) return;

        const id = linha.dataset.pacienteId;
        const nome = linha.querySelector('.paciente-nome')?.textContent || '';
        const telefone = linha.querySelector('.paciente-telefone')?.textContent || '';

        const idInput = document.getElementById('editar-paciente-id');
        const nomeInput = document.getElementById('editar-paciente-nome');
        const telefoneInput = document.getElementById('editar-paciente-telefone');

        if (idInput) idInput.value = id;
        if (nomeInput) nomeInput.value = nome === '-' ? '' : nome;
        if (telefoneInput) telefoneInput.value = telefone === '-' ? '' : telefone;

        editarModal?.show();
    });
}

if (editarForm) {
    editarForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const submitBtn = editarForm.querySelector('button[type="submit"]');
        const originalBtnContent = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) {
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Salvando...';
            submitBtn.disabled = true;
        }
        const id = document.getElementById('editar-paciente-id')?.value;
        const nome = document.getElementById('editar-paciente-nome')?.value.trim();
        const telefone = document.getElementById('editar-paciente-telefone')?.value.trim();

        if (!id || !nome) {
            showToast('Nome do paciente e obrigatorio.', 'error');
            if (submitBtn) {
                submitBtn.innerHTML = originalBtnContent;
                submitBtn.disabled = false;
            }
            return;
        }

        fetch(`/api/editar-paciente/${id}/`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken'),
            },
            body: JSON.stringify({ nome, telefone }),
        })
            .then((res) => res.json())
            .then((data) => {
                if (data?.erro) {
                    showToast(data.erro, 'error');
                    return;
                }
                showToast('Paciente atualizado com sucesso!', 'success');
                editarModal?.hide();
                carregarPacientes({
                    nome: filtroNome?.value || '',
                    telefone: filtroTelefone?.value || '',
                });
            })
            .catch(() => {
                showToast('Erro ao atualizar paciente', 'error');
            })
            .finally(() => {
                if (submitBtn) {
                    submitBtn.innerHTML = originalBtnContent;
                    submitBtn.disabled = false;
                }
            });
    });
}

if (novoForm) {
    novoForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const submitBtn = novoForm.querySelector('button[type="submit"]');
        const originalBtnContent = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) {
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Salvando...';
            submitBtn.disabled = true;
        }
        const nome = document.getElementById('novo-paciente-nome')?.value.trim();
        const telefone = document.getElementById('novo-paciente-telefone')?.value.trim();
        const dataUltima = document.getElementById('novo-paciente-data')?.value;
        const tipoConsulta = document.getElementById('novo-paciente-tipo')?.value || 'consulta';

        if (!nome || !dataUltima) {
            showToast('Nome e data da ultima consulta sao obrigatorios.', 'error');
            if (submitBtn) {
                submitBtn.innerHTML = originalBtnContent;
                submitBtn.disabled = false;
            }
            return;
        }

        fetch('/api/pacientes/novo/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken'),
            },
            body: JSON.stringify({
                nome,
                telefone,
                data_ultima_consulta: dataUltima,
                tipo_consulta: tipoConsulta,
            }),
        })
            .then((res) => res.json())
            .then((data) => {
                if (data?.erro) {
                    showToast(data.erro, 'error');
                    return;
                }
                showToast('Paciente cadastrado com sucesso!', 'success');
                novoForm.reset();
                novoModal?.hide();
                carregarPacientes();
            })
            .catch(() => {
                showToast('Erro ao cadastrar paciente', 'error');
            })
            .finally(() => {
                if (submitBtn) {
                    submitBtn.innerHTML = originalBtnContent;
                    submitBtn.disabled = false;
                }
            });
    });
}

carregarPacientes();
