import { showToast } from './message.js';

document.addEventListener('DOMContentLoaded', function () {
  carregarMateriais();
});

async function tentarAtualizarSelecaoMateriais(preSelecionados = []) {
  try {
    const modulo = await import('./home.js');
    if (typeof modulo?.inicializarSelecaoMateriais === 'function') {
      modulo.inicializarSelecaoMateriais(preSelecionados);
    }
  } catch (error) {
    // Ignora em telas onde o modulo nao se aplica.
  }
}

const editarMaterialModalEl = document.getElementById('editarMaterialModal');
const editarMaterialModal = editarMaterialModalEl
    ? new bootstrap.Modal(editarMaterialModalEl)
    : null;
const materialEditarForm = document.getElementById('material-editar-form');
const materialEditarId = document.getElementById('material-editar-id');
const materialEditarDescricao = document.getElementById('material-editar-descricao');
const materialEditarArquivos = document.getElementById('material-editar-arquivos');
const materialEditarRemoverInfo = document.getElementById('material-editar-remover-info');
const materialEditarTipoSelect = materialEditarForm
    ? materialEditarForm.querySelector('select[name="tipo_arquivo"]')
    : null;
const materialEditarRemover = document.getElementById('material-editar-remover');
const excluirMaterialModalEl = document.getElementById('excluirMaterialModal');
const excluirMaterialModal = excluirMaterialModalEl
    ? new bootstrap.Modal(excluirMaterialModalEl)
    : null;
const excluirMaterialNome = document.getElementById('excluir-material-nome');
const excluirMaterialConfirmar = document.getElementById('confirmar-excluir-material');
let materialExclusaoAtual = null;

function abrirModalExcluirMaterial(item) {
    if (!excluirMaterialModal || !excluirMaterialConfirmar) {
        return false;
    }
    materialExclusaoAtual = item;
    const nome = item.querySelector('.descricao')?.textContent || 'selecionado';
    if (excluirMaterialNome) {
        excluirMaterialNome.textContent = nome;
    }
    excluirMaterialModal.show();
    return true;
}

function executarExclusaoMaterial(item) {
    if (!item) return;
    const id = item.dataset.materialId;
    definirLoadingExclusao(item, true);
    fetch(`/api/materiais/${id}/`, {
        method: 'DELETE'
    })
    .then(async res => {
        const data = await res.json();
        if (!res.ok) {
            showToast(data.erro || 'Erro ao deletar material', 'error');
            definirLoadingExclusao(item, false);
            carregarMateriais();
            return;
        }
        showToast(data.mensagem || 'Material deletado com sucesso!', 'success');
        carregarMateriais();
        tentarAtualizarSelecaoMateriais();
    })
    .catch(err => {
        console.error(err);
        showToast('Erro inesperado ao tentar deletar.', 'error');
        definirLoadingExclusao(item, false);
    });
}

if (excluirMaterialConfirmar) {
    excluirMaterialConfirmar.addEventListener('click', () => {
        if (materialExclusaoAtual) {
            executarExclusaoMaterial(materialExclusaoAtual);
        }
        excluirMaterialModal?.hide();
        materialExclusaoAtual = null;
    });
}

function atualizarVisibilidadeArquivos(form) {
    if (!form) return;
    const tipoSelecionado = form.querySelector('[name="tipo_arquivo"]')?.value || '';
    form.querySelectorAll('.material-arquivo-input').forEach((input) => {
        const tipo = input.dataset.tipo;
        const wrapper = input.closest('.material-arquivo-wrapper') || input.closest('.mb-3') || input;
        const ativo = tipoSelecionado && tipoSelecionado === tipo;
        if (!ativo) {
            input.value = '';
        }
        wrapper.classList.toggle('d-none', !ativo);
    });
}

function bindTipoArquivo(form) {
    if (!form) return;
    const select = form.querySelector('select[name="tipo_arquivo"]');
    if (select) {
        select.addEventListener('change', () => {
            atualizarVisibilidadeArquivos(form);
        });
    }
    atualizarVisibilidadeArquivos(form);
}

function obterTipoSelecionado(form) {
    return form.querySelector('[name="tipo_arquivo"]')?.value || '';
}

function validarArquivoPorTipo(form, tipoSelecionado, permitirExistente = false) {
    if (!tipoSelecionado) {
        return true;
    }
    const input = form.querySelector(`.material-arquivo-input[data-tipo="${tipoSelecionado}"]`);
    const isArquivo = input && input.type === 'file';
    const valor = input ? input.value.trim() : '';
    if (!input || (isArquivo && (!input.files || input.files.length === 0)) || (!isArquivo && !valor)) {
        if (permitirExistente) {
            const remover = form.querySelector('input[name="remover_arquivo"]');
            const possuiAtual = form.dataset.temArquivo === '1';
            const tipoAtual = form.dataset.tipoAtual || '';
            const tipoCompat = tipoAtual === tipoSelecionado
                || (tipoAtual === 'foto' && tipoSelecionado === 'imagem');
            if (possuiAtual && tipoCompat && !remover?.checked) {
                return true;
            }
        }
        const msg = tipoSelecionado === 'youtube'
            ? 'Informe o link do YouTube.'
            : 'Selecione o arquivo correspondente ao tipo escolhido.';
        showToast(msg, 'error');
        return false;
    }
    return true;
}

function definirLoadingExclusao(item, ativo) {
    if (!item) return;
    const card = item.querySelector('.material-card');
    if (card) {
        card.classList.toggle('material-card--loading', ativo);
        let overlay = card.querySelector('.material-card-loading');
        if (ativo && !overlay) {
            overlay = document.createElement('div');
            overlay.className = 'material-card-loading';
            overlay.innerHTML = `
                <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                Excluindo...
            `;
            card.appendChild(overlay);
        }
        if (!ativo && overlay) {
            overlay.remove();
        }
    } else {
        const botoes = item.querySelectorAll('button');
        botoes.forEach((btn) => {
            btn.disabled = ativo;
        });
        if (ativo) {
            item.dataset.loading = '1';
        } else {
            delete item.dataset.loading;
        }
    }
}

function preencherArquivosAtuais(item) {
    if (!materialEditarArquivos) return;
    materialEditarArquivos.innerHTML = '';
    const links = [];
    const pdfUrl = item.dataset.pdfUrl || '';
    const videoUrl = item.dataset.videoUrl || '';
    const imagemUrl = item.dataset.imagemUrl || '';
    const fotoUrl = item.dataset.fotoUrl || '';
    const youtubeUrl = item.dataset.youtubeUrl || '';

    if (pdfUrl) {
        links.push({ label: 'PDF atual', url: pdfUrl, tipo: 'pdf' });
    }
    if (videoUrl) {
        links.push({ label: 'Video atual', url: videoUrl, tipo: 'video' });
    }
    if (imagemUrl) {
        links.push({ label: 'Imagem atual', url: imagemUrl, tipo: 'imagem' });
    }
    if (fotoUrl) {
        links.push({ label: 'Imagem atual', url: fotoUrl, tipo: 'foto' });
    }
    if (youtubeUrl) {
        links.push({ label: 'Video do YouTube', url: youtubeUrl, tipo: 'youtube' });
    }

    if (!links.length) {
        materialEditarArquivos.textContent = 'Nenhum arquivo anexado.';
        return;
    }

    const lista = document.createElement('ul');
    lista.className = 'material-arquivos-list mb-0';
    links.forEach((itemLink) => {
        const li = document.createElement('li');
        li.className = 'material-arquivo-item';
        const link = document.createElement('a');
        link.href = itemLink.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = itemLink.label;
        const removerBtn = document.createElement('button');
        removerBtn.type = 'button';
        removerBtn.className = 'material-arquivo-remove';
        removerBtn.dataset.tipo = itemLink.tipo;
        removerBtn.setAttribute('aria-label', `Remover ${itemLink.label}`);
        removerBtn.innerHTML = '<i class="bi bi-trash"></i>';
        li.appendChild(link);
        li.appendChild(removerBtn);
        lista.appendChild(li);
    });
    materialEditarArquivos.appendChild(lista);
}

function atualizarAvisoRemover() {
    if (!materialEditarRemover || !materialEditarRemoverInfo) return;
    materialEditarRemoverInfo.classList.toggle('d-none', !materialEditarRemover.checked);
    if (!materialEditarRemover.checked) {
        materialEditarArquivos?.querySelectorAll('.material-arquivo-item').forEach((item) => {
            item.classList.remove('material-arquivo-removido');
        });
    }
}

function marcarRemocaoArquivo() {
    if (!materialEditarRemover) return;
    materialEditarRemover.checked = true;
    atualizarAvisoRemover();
    if (materialEditarTipoSelect) {
        materialEditarTipoSelect.value = '';
    }
    atualizarVisibilidadeArquivos(materialEditarForm);
    materialEditarArquivos?.querySelectorAll('.material-arquivo-item').forEach((item) => {
        item.classList.add('material-arquivo-removido');
    });
}

function abrirModalEditarMaterial(item) {
    if (!editarMaterialModal || !materialEditarForm || !materialEditarId || !materialEditarDescricao) {
        return;
    }

    materialEditarForm.reset();
    materialEditarId.value = item.dataset.materialId || '';
    materialEditarDescricao.value = item.querySelector('.descricao')?.textContent || '';
    const tipoAtual = item.dataset.tipoArquivo || '';
    const temArquivo = Boolean(item.dataset.pdfUrl || item.dataset.videoUrl || item.dataset.imagemUrl || item.dataset.fotoUrl);
    materialEditarForm.dataset.tipoAtual = tipoAtual;
    const temYoutube = Boolean(item.dataset.youtubeUrl);
    materialEditarForm.dataset.temArquivo = (temArquivo || temYoutube) ? '1' : '0';
    if (materialEditarTipoSelect) {
        const tipoSelect = tipoAtual === 'foto' ? 'imagem' : (tipoAtual || '');
        materialEditarTipoSelect.value = tipoSelect;
    }
    if (materialEditarRemover) {
        materialEditarRemover.checked = false;
    }
    atualizarAvisoRemover();
    atualizarVisibilidadeArquivos(materialEditarForm);
    preencherArquivosAtuais(item);
    if (materialEditarArquivos) {
        materialEditarArquivos.querySelectorAll('.material-arquivo-remove').forEach((btn) => {
            btn.addEventListener('click', () => {
                marcarRemocaoArquivo();
            });
        });
    }
    editarMaterialModal.show();
}

function carregarMateriais() {
    const cardsContainer = document.getElementById('materiais-cards');
    const semMaterial = document.getElementById('sem-materiais');
    if (cardsContainer) {
        cardsContainer.innerHTML = `
            <div class="col-12">
                <div class="text-center py-4">
                    <div class="spinner-border text-primary" role="status"></div>
                    <div class="mt-2 text-secondary">Carregando materiais...</div>
                </div>
            </div>
        `;
    }
    if (semMaterial) {
        semMaterial.classList.add('d-none');
    }

    fetch('/api/materiais/')
        .then(res => res.json())
        .then(data => {
        const tbody = document.getElementById('materiais-tbody');
        if (tbody) {
            tbody.innerHTML = '';
        }
        if (cardsContainer) {
            cardsContainer.innerHTML = '';
        }
        
        const semMaterial = document.getElementById('sem-materiais');
        if (data.materiais.length === 0) {
            semMaterial.classList.remove('d-none');
        } else {
            semMaterial.classList.add('d-none');
        }

        const renderTabela = () => {
            if (!tbody) return;
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
        };

        const renderCards = () => {
            if (!cardsContainer) return;
            data.materiais.forEach(material => {
                const tipoArquivo = material.tipo_arquivo || (
                    material.pdf_url ? 'pdf' :
                    material.video_url ? 'video' :
                    material.imagem_url ? 'imagem' :
                    material.foto_url ? 'foto' :
                    material.youtube_url ? 'youtube' :
                    ''
                );
                const coverLabelMap = {
                    pdf: 'PDF',
                    video: 'Video',
                    imagem: 'Imagem',
                    foto: 'Imagem',
                    youtube: 'YouTube',
                };
                const coverIconMap = {
                    pdf: 'bi-file-earmark-pdf',
                    video: 'bi-camera-video',
                    imagem: 'bi-image',
                    foto: 'bi-image',
                    youtube: 'bi-youtube',
                };
                const coverLabel = coverLabelMap[tipoArquivo] || 'Sem arquivo';
                const coverIcon = coverIconMap[tipoArquivo] || 'bi-file-earmark';
                const arquivoUrl = material.youtube_url || material.pdf_url || material.video_url || material.imagem_url || material.foto_url || '';
                const col = document.createElement('div');
                col.className = 'col-12 col-md-6 col-xl-4';
                col.dataset.materialId = material.id;
                col.dataset.tipoArquivo = tipoArquivo || '';
                col.dataset.pdfUrl = material.pdf_url || '';
                col.dataset.videoUrl = material.video_url || '';
                col.dataset.imagemUrl = material.imagem_url || '';
                col.dataset.fotoUrl = material.foto_url || '';
                col.dataset.youtubeUrl = material.youtube_url || '';
                col.innerHTML = `
                    <div class="card material-card h-100 shadow-sm border-light-subtle">
                        <div class="material-card-cover material-card-cover--${tipoArquivo || 'none'}">
                            <div class="material-card-cover-icon">
                                <i class="bi ${coverIcon}"></i>
                            </div>
                            <span class="material-card-cover-label">${coverLabel}</span>
                        </div>
                        <div class="card-body material-card-body">
                            <div class="descricao material-card-title">${material.descricao}</div>
                            ${arquivoUrl ? '' : '<span class="material-no-attachment">Sem anexo</span>'}
                        </div>
                        <div class="card-footer material-card-footer bg-white border-0">
                            ${arquivoUrl ? `
                            <a class="btn btn-sm btn-outline-primary" href="${arquivoUrl}" target="_blank" rel="noopener noreferrer">
                                <i class="bi bi-box-arrow-up-right"></i>
                                Ver arquivo
                            </a>
                            ` : ''}
                            <button class="btn btn-sm btn-primary btn-editar" title="Editar">
                                <i class="bi bi-pencil"></i>
                                Editar
                            </button>
                            <button class="btn btn-sm btn-danger btn-excluir" title="Excluir">
                                <i class="bi bi-trash"></i>
                                Excluir
                            </button>
                        </div>
                    </div>
                `;
                cardsContainer.appendChild(col);
            });
        };

        if (cardsContainer) {
            renderCards();
        } else {
            renderTabela();
        }

        const scope = cardsContainer || tbody;
        if (!scope) return;

        // Edicao inline
        scope.querySelectorAll('.btn-editar').forEach(btn => {
            btn.addEventListener('click', function () {
            const item = btn.closest('[data-material-id]');
            const id = item.dataset.materialId;
            const descricao = item.querySelector('.descricao').textContent;

            if (cardsContainer && editarMaterialModalEl) {
                abrirModalEditarMaterial(item);
                return;
            }

            if (cardsContainer) {
                item.innerHTML = `
                    <div class="card material-card h-100 shadow-sm border-light-subtle">
                        <div class="material-card-cover material-card-cover--editing">
                            <span class="material-card-cover-label">Editando</span>
                        </div>
                        <div class="card-body material-card-body">
                            <input type="text" class="form-control form-control-sm descricao-input" value="${descricao}">
                        </div>
                        <div class="card-footer material-card-footer bg-white border-0">
                            <button class="btn btn-sm btn-success btn-salvar" title="Salvar">
                                <span class="btn-salvar-content"><i class="bi bi-check"></i></span>
                                Salvar
                            </button>
                            <button class="btn btn-sm btn-secondary btn-cancelar" title="Cancelar">
                                <i class="bi bi-x"></i>
                                Cancelar
                            </button>
                        </div>
                    </div>
                `;
            } else {
                item.innerHTML = `
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
            }

            const btnSalvar = item.querySelector('.btn-salvar');
            btnSalvar.addEventListener('click', () => {
                const novaDescricao = item.querySelector('.descricao-input').value.trim();
                if (!novaDescricao) {
                    alert('Descricao nao pode ser vazia.');
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
                    tentarAtualizarSelecaoMateriais();
                })
                .catch(err => {
                    console.error(err);
                    showToast('Erro inesperado ao tentar salvar.', 'error');
                });
            });

            item.querySelector('.btn-cancelar').addEventListener('click', carregarMateriais);
            });
        });

        // Exclusao
        scope.querySelectorAll('.btn-excluir').forEach(btn => {
            btn.addEventListener('click', function () {
            const item = btn.closest('[data-material-id]');
            if (abrirModalExcluirMaterial(item)) {
                return;
            }
            if (confirm('Deseja excluir este material?')) {
                executarExclusaoMaterial(item);
            }
            });
        });

        });
}

// submissão do formulario novo-material-form
const novoMaterialForm = document.getElementById('novo-material-form');
const btnSalvarNovoMaterial = novoMaterialForm
    ? novoMaterialForm.querySelector('button[type="submit"]')
    : null;

if (novoMaterialForm) {
    bindTipoArquivo(novoMaterialForm);
    novoMaterialForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const descricaoInput = novoMaterialForm.querySelector('[name="descricao"]');
        const descricao = descricaoInput.value.trim();
        const tipoSelecionado = obterTipoSelecionado(novoMaterialForm);

        if (!descricao) {
            showToast('Descrição não pode ser vazia.', 'error');
            return;
        }
        if (!validarArquivoPorTipo(novoMaterialForm, tipoSelecionado)) {
            return;
        }

        // Mostra loading no botão
        const originalBtnContent = btnSalvarNovoMaterial.innerHTML;
        btnSalvarNovoMaterial.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Salvando...`;
        btnSalvarNovoMaterial.disabled = true;

        const formData = new FormData(novoMaterialForm);
        formData.set('descricao', descricao);

        fetch('/api/materiais/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: formData
        })
        .then(async res => {
            const data = await res.json();
            if (!res.ok) {
                showToast(data.erro || 'Erro ao adicionar material', 'error');
                return;
            }
            showToast(data.mensagem || 'Material adicionado com sucesso!', 'success');
            descricaoInput.value = '';
        tentarAtualizarSelecaoMateriais();
            carregarMateriais();

            const modalGerenciarMaterialEl = document.getElementById('gerenciarMateriaisModal');
            const modalNovoMaterialEl = document.getElementById('novoMaterialModal');
            const modalGerenciarMaterial = modalGerenciarMaterialEl
                ? bootstrap.Modal.getInstance(modalGerenciarMaterialEl) || new bootstrap.Modal(modalGerenciarMaterialEl)
                : null;
            const modalNovoMaterial = modalNovoMaterialEl
                ? bootstrap.Modal.getInstance(modalNovoMaterialEl) || new bootstrap.Modal(modalNovoMaterialEl)
                : null;

            modalNovoMaterial?.hide();
            modalGerenciarMaterial?.show();
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
}

if (materialEditarForm) {
    bindTipoArquivo(materialEditarForm);
    if (materialEditarRemover) {
        materialEditarRemover.addEventListener('change', atualizarAvisoRemover);
    }
}

if (materialEditarForm) {
    materialEditarForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const id = materialEditarId?.value;
        const descricao = materialEditarDescricao?.value.trim();
        const tipoSelecionado = obterTipoSelecionado(materialEditarForm);
        if (!id || !descricao) {
            showToast('Descricao nao pode ser vazia.', 'error');
            return;
        }
        if (!validarArquivoPorTipo(materialEditarForm, tipoSelecionado, true)) {
            return;
        }

        const submitBtn = materialEditarForm.querySelector('button[type="submit"]');
        const originalBtnContent = submitBtn.innerHTML;
        submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Salvando...`;
        submitBtn.disabled = true;

        const formData = new FormData(materialEditarForm);
        formData.set('descricao', descricao);

        fetch(`/api/materiais/${id}/`, {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: formData
        })
        .then(async res => {
            const data = await res.json();
            if (!res.ok) {
                showToast(data.erro || 'Erro ao atualizar material', 'error');
                return;
            }
            showToast(data.mensagem || 'Material atualizado com sucesso!', 'success');
            editarMaterialModal?.hide();
            carregarMateriais();
            tentarAtualizarSelecaoMateriais();
        })
        .catch(err => {
            console.error(err);
            showToast('Erro inesperado ao tentar salvar.', 'error');
        })
        .finally(() => {
            submitBtn.innerHTML = originalBtnContent;
            submitBtn.disabled = false;
        });
    });
}

const modalGerenciarMaterialEl = document.getElementById('gerenciarMateriaisModal');
const modalNovoMaterialEl = document.getElementById('novoMaterialModal');
const modalGerenciarMaterial = modalGerenciarMaterialEl
    ? bootstrap.Modal.getInstance(modalGerenciarMaterialEl) || new bootstrap.Modal(modalGerenciarMaterialEl)
    : null;

if (modalGerenciarMaterial && modalNovoMaterialEl) {
    modalNovoMaterialEl.addEventListener('hidden.bs.modal', function () {
        modalGerenciarMaterial.show();
    });
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
