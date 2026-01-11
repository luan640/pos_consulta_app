import { showToast } from './message.js';

const tbody = document.getElementById('pacientes-tbody');
const emptyState = document.getElementById('pacientes-vazio');
const filtrosForm = document.getElementById('pacientes-filtros');
const filtroNome = document.getElementById('filtro-nome');
const filtroTelefone = document.getElementById('filtro-telefone');
const filtroLimpar = document.getElementById('filtro-limpar');
const paginacaoStatus = document.getElementById('pacientes-paginacao-status');
const paginacaoPrev = document.getElementById('pacientes-prev');
const paginacaoNext = document.getElementById('pacientes-next');
const btnNovoPaciente = document.getElementById('btn-novo-paciente');

const PAGE_SIZE = 15;
let paginaAtual = 1;
let pacientesCache = [];
let pacientesFiltrados = [];
let hasMaisPaginas = false;
let totalRegistros = null;
let filtrosAtuais = { nome: '', telefone: '' };

const novoForm = document.getElementById('novo-paciente-form');
const novoModalEl = document.getElementById('novoPacienteModal');
const novoModal = criarModalController(novoModalEl);

const editarForm = document.getElementById('editar-paciente-form');
const editarModalEl = document.getElementById('editarPacienteModal');
const editarModal = criarModalController(editarModalEl);

function criarModalController(el) {
    if (!el) return null;
    if (typeof bootstrap !== 'undefined' && bootstrap?.Modal) {
        const instance = bootstrap.Modal.getInstance(el) || new bootstrap.Modal(el);
        return {
            show: () => instance.show(),
            hide: () => instance.hide(),
        };
    }
    return {
        show: () => el.classList.remove('hidden'),
        hide: () => el.classList.add('hidden'),
    };
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

function renderPacientes(lista, { page = 1, hasMore = false, total = null } = {}) {
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!lista.length) {
        emptyState?.classList.remove('d-none');
        if (paginacaoStatus) paginacaoStatus.textContent = 'Nenhum resultado';
        if (paginacaoPrev) paginacaoPrev.disabled = true;
        if (paginacaoNext) paginacaoNext.disabled = true;
        return;
    }

    emptyState?.classList.add('d-none');
    paginaAtual = Math.max(1, page);
    const inicio = (paginaAtual - 1) * PAGE_SIZE;
    const fim = inicio + lista.length;
    const paginaItens = lista;

    const fragment = document.createDocumentFragment();

    paginaItens.forEach((paciente) => {
        const tr = document.createElement('tr');
        tr.dataset.pacienteId = paciente.id;
        tr.className = 'hover:bg-gray-50 transition-colors group';

        const initials = paciente.nome ? paciente.nome.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '??';

        tr.innerHTML = `
            <td class="py-3 px-4">
                <div class="flex items-center gap-3">
                    <div class="size-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-bold">
                        ${initials}
                    </div>
                    <div>
                        <p class="text-sm font-medium text-[#111518] paciente-nome">${paciente.nome || '-'}</p>
                    </div>
                </div>
            </td>
            <td class="py-3 px-4">
                <div class="inline-flex items-center gap-1.5 text-sm text-[#111518]">
                    <span class="material-symbols-outlined text-[18px] text-green-600">chat</span>
                    <span class="paciente-telefone">${paciente.telefone || '-'}</span>
                </div>
            </td>
            <td class="py-3 px-4">
                <span class="text-sm text-[#64748b]">${paciente.criado_em || '-'}</span>
            </td>
            <td class="py-3 px-4 text-right">
                <button type="button" class="text-[#94a3b8] hover:text-primary p-1 rounded hover:bg-blue-50 transition-colors btn-editar" title="Editar">
                    <span class="material-symbols-outlined text-[20px]">edit</span>
                </button>
            </td>
        `;
        fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);

    if (paginacaoStatus) {
        const exibindoInicio = lista.length === 0 ? 0 : inicio + 1;
        const exibindoFim = lista.length === 0 ? 0 : fim;
        const totalTexto = total ? ` de ${total} resultados` : hasMore ? ' de mais resultados' : ` de ${exibindoFim} resultados`;
        paginacaoStatus.textContent = `Mostrando ${exibindoInicio}-${exibindoFim}${totalTexto}`;
    }
    if (paginacaoPrev) paginacaoPrev.disabled = paginaAtual <= 1;
    const podeAvancar = hasMore || (total ? fim < total : lista.length === PAGE_SIZE && hasMore);
    if (paginacaoNext) paginacaoNext.disabled = !podeAvancar;
}

function aplicarFiltroTelefone(lista, telefone) {
    if (!telefone) return lista;
    const filtro = telefone.trim().toLowerCase();
    if (!filtro) return lista;
    return lista.filter((paciente) => (paciente.telefone || '').toLowerCase().includes(filtro));
}

function carregarPacientes({ nome = '', telefone = '', page = 1 } = {}) {
    if (!tbody) return;
    tbody.innerHTML = '';
    emptyState?.classList.add('d-none');
    if (paginacaoStatus) paginacaoStatus.textContent = 'Carregando pacientes...';

    filtrosAtuais = { nome, telefone };
    paginaAtual = page;

    const params = new URLSearchParams();
    if (nome) params.set('nome', nome);
    params.set('page', String(page));
    params.set('page_size', String(PAGE_SIZE));

    fetch(`/api/pacientes/?${params.toString()}`)
        .then((res) => res.json())
        .then((data) => {
            pacientesCache = data?.pacientes || [];
            pacientesFiltrados = aplicarFiltroTelefone(pacientesCache, telefone);
            totalRegistros = typeof data?.total === 'number' ? data.total : null;
            hasMaisPaginas = Boolean(data?.has_more);
            renderPacientes(pacientesFiltrados, {
                page,
                hasMore: hasMaisPaginas,
                total: totalRegistros,
            });
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
            page: 1,
        });
    });
}

if (filtroLimpar) {
    filtroLimpar.addEventListener('click', () => {
        if (filtroNome) filtroNome.value = '';
        if (filtroTelefone) filtroTelefone.value = '';
        carregarPacientes({ page: 1 });
    });
}

if (paginacaoPrev) {
    paginacaoPrev.addEventListener('click', () => {
        if (paginaAtual > 1) {
            carregarPacientes({ ...filtrosAtuais, page: paginaAtual - 1 });
        }
    });
}

if (paginacaoNext) {
    paginacaoNext.addEventListener('click', () => {
        if (hasMaisPaginas || pacientesFiltrados.length === PAGE_SIZE) {
            carregarPacientes({ ...filtrosAtuais, page: paginaAtual + 1 });
        }
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

if (btnNovoPaciente && novoModal) {
    btnNovoPaciente.addEventListener('click', () => {
        novoModal.show();
    });
}

document.querySelectorAll('[data-modal-hide="novoPacienteModal"]').forEach((btn) => {
    btn.addEventListener('click', () => novoModal?.hide());
});
document.querySelectorAll('[data-modal-hide="editarPacienteModal"]').forEach((btn) => {
    btn.addEventListener('click', () => editarModal?.hide());
});

carregarPacientes();
