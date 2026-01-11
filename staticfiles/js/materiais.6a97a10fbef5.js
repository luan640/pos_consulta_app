import { showToast } from './message.js';

document.addEventListener('DOMContentLoaded', function () {
    carregarMateriais();
});

let materiaisData = [];
let filtroAtual = 'all';
const buscaInput = document.getElementById('materiais-busca');
const buscaBtn = document.getElementById('materiais-filtrar');

function tipoMaterial(material) {
    return material.tipo_arquivo || (
        material.pdf_url ? 'pdf' :
            material.video_url ? 'video' :
                material.imagem_url ? 'imagem' :
                    material.foto_url ? 'foto' :
                        material.youtube_url ? 'youtube' :
                            'link'
    );
}

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
const editarMaterialModal = criarModalController(editarMaterialModalEl);
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
const excluirMaterialModal = criarModalController(excluirMaterialModalEl);
const excluirMaterialNome = document.getElementById('excluir-material-nome');
const excluirMaterialConfirmar = document.getElementById('confirmar-excluir-material');
const visualizarMaterialModalEl = document.getElementById('visualizarMaterialModal');
const visualizarMaterialModal = criarModalController(visualizarMaterialModalEl);
const visualizarMaterialTitle = document.getElementById('visualizar-material-title');
const visualizarMaterialBody = document.getElementById('visualizar-material-body');
let materialExclusaoAtual = null;

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
        wrapper.classList.toggle('hidden', !ativo);
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

function construirYoutubeEmbedUrl(url) {
    if (!url) return '';
    try {
        const parsed = new URL(url);
        const hostname = parsed.hostname.toLowerCase();
        if (hostname.includes('youtu.be')) {
            const id = parsed.pathname.replace('/', '').trim();
            return id ? `https://www.youtube.com/embed/${id}` : '';
        }
        if (hostname.includes('youtube.com')) {
            const id = parsed.searchParams.get('v') || '';
            return id ? `https://www.youtube.com/embed/${id}` : '';
        }
    } catch (error) {
        return '';
    }
    return '';
}

function abrirModalVisualizarMaterial(item) {
    if (!visualizarMaterialModal || !visualizarMaterialBody) return;
    const tipoArquivo = item?.dataset.tipoArquivo || '';
    const descricao = item?.querySelector('.descricao')?.textContent || 'Visualizar material';
    const pdfUrl = item?.dataset.pdfUrl || '';
    const videoUrl = item?.dataset.videoUrl || '';
    const imagemUrl = item?.dataset.imagemUrl || '';
    const fotoUrl = item?.dataset.fotoUrl || '';
    const youtubeUrl = item?.dataset.youtubeUrl || '';

    if (visualizarMaterialTitle) {
        visualizarMaterialTitle.textContent = descricao;
    }

    let conteudo = '';
    if (tipoArquivo === 'pdf' && pdfUrl) {
        conteudo = `<iframe src="${pdfUrl}" class="w-full h-[60vh] rounded border border-slate-200" title="PDF"></iframe>`;
    } else if ((tipoArquivo === 'video' || tipoArquivo === 'youtube') && (videoUrl || youtubeUrl)) {
        if (tipoArquivo === 'youtube') {
            const embedUrl = construirYoutubeEmbedUrl(youtubeUrl);
            conteudo = embedUrl
                ? `<iframe src="${embedUrl}" class="w-full h-[60vh] rounded border border-slate-200" title="YouTube" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
                : `<div class="text-sm text-slate-500 py-8">Link do YouTube invalido.</div>`;
        } else {
            conteudo = `<video src="${videoUrl}" class="w-full max-h-[60vh] rounded border border-slate-200" controls></video>`;
        }
    } else if ((tipoArquivo === 'imagem' || tipoArquivo === 'foto') && (imagemUrl || fotoUrl)) {
        const src = imagemUrl || fotoUrl;
        conteudo = `<img src="${src}" alt="Visualizacao do material" class="w-full max-h-[60vh] object-contain rounded border border-slate-200" />`;
    } else {
        conteudo = `<div class="text-sm text-slate-500 py-8">Arquivo nao disponivel para visualizacao.</div>`;
    }

    visualizarMaterialBody.innerHTML = conteudo;
    visualizarMaterialModal.show();
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
    materialEditarRemoverInfo.classList.toggle('hidden', !materialEditarRemover.checked);
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
        semMaterial.classList.add('hidden');
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

            materiaisData = data.materiais || [];
            const semMaterial = document.getElementById('sem-materiais');
            semMaterial?.classList.toggle('hidden', materiaisData.length !== 0);

            const renderTabela = (lista) => {
                if (!tbody) return;
                tbody.innerHTML = '';
                lista.forEach(material => {
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

            const renderCards = (lista) => {
                if (!cardsContainer) return;

                cardsContainer.innerHTML = '';

                lista.forEach(material => {
                    const tipoArquivo = tipoMaterial(material);

                    // Theme Logic
                    let theme = {
                        headerBg: 'bg-slate-50',
                        iconColor: 'text-slate-400',
                        icon: 'description',
                        badgeClass: 'bg-slate-100 text-slate-600',
                        label: 'Arquivo'
                    };

                    if (tipoArquivo === 'pdf') {
                        theme = {
                            headerBg: 'bg-slate-50',
                            iconColor: 'text-red-500',
                            icon: 'picture_as_pdf',
                            badgeClass: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10',
                            label: 'PDF'
                        };
                    } else if (['video', 'youtube'].includes(tipoArquivo)) {
                        theme = {
                            headerBg: 'bg-slate-900',
                            iconColor: 'text-white',
                            icon: 'play_circle',
                            badgeClass: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/10',
                            label: 'Vídeo'
                        };
                    } else if (['imagem', 'foto'].includes(tipoArquivo)) {
                        theme = {
                            headerBg: 'bg-slate-50',
                            iconColor: 'text-blue-500',
                            icon: 'image',
                            badgeClass: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-700/10',
                            label: 'Imagem'
                        };
                    }

                    const arquivoUrl = material.youtube_url || material.pdf_url || material.video_url || material.imagem_url || material.foto_url || '';

                    const card = document.createElement('div');
                    card.className = 'group relative flex flex-col bg-white rounded-xl border border-[#e5e7eb] shadow-sm hover:shadow-md hover:border-primary/50 transition-all duration-200 material-card-item';
                    card.dataset.materialId = material.id;
                    card.dataset.tipoArquivo = tipoArquivo;
                    // Preserve data attributes for Edit modal
                    if (material.pdf_url) card.dataset.pdfUrl = material.pdf_url;
                    if (material.video_url) card.dataset.videoUrl = material.video_url;
                    if (material.imagem_url) card.dataset.imagemUrl = material.imagem_url;
                    if (material.foto_url) card.dataset.fotoUrl = material.foto_url;
                    if (material.youtube_url) card.dataset.youtubeUrl = material.youtube_url;

                    // Header Content
                    let headerContent = '';
                    if (['video', 'youtube'].includes(tipoArquivo)) {
                        // Video style header
                        headerContent = `
                        <div class="absolute inset-0 opacity-40 bg-cover bg-center" style="background-image: url('https://placehold.co/600x400/101a22/FFF?text=Video');"></div>
                        <div class="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors"></div>
                        <span class="material-symbols-outlined text-5xl text-white z-10 drop-shadow-md group-hover:scale-110 transition-transform">play_circle</span>
                     `;
                    } else {
                        // Default/PDF style header
                        headerContent = `
                        <div class="absolute inset-0 opacity-10 bg-[radial-gradient(#1392ec_1px,transparent_1px)] [background-size:16px_16px]"></div>
                        <span class="material-symbols-outlined text-6xl ${theme.iconColor} group-hover:scale-110 transition-transform duration-300">${theme.icon}</span>
                    `;
                    }

                    card.innerHTML = `
                    <div class="relative h-40 w-full overflow-hidden rounded-t-xl ${theme.headerBg} flex items-center justify-center">
                        ${headerContent}
                        <div class="absolute top-3 right-3 z-10">
                            <span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${theme.badgeClass}">${theme.label}</span>
                        </div>
                    </div>
                    
                    <div class="flex flex-1 flex-col p-4">
                        <h3 class="text-base font-bold text-[#111518] line-clamp-1 descricao">${material.descricao}</h3>
                        <p class="mt-1 text-sm text-slate-500 line-clamp-2 flex-1">Material educativo.</p>
                        
                        <div class="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                            <span class="text-xs text-slate-400">---</span> <!-- Size/Duration placeholder -->
                            <div class="flex gap-1">
                                ${arquivoUrl ? `
                                <button type="button" class="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded transition-colors btn-visualizar" title="Visualizar">
                                    <span class="material-symbols-outlined text-[18px]">visibility</span>
                                </button>` : ''}
                                
                                <button class="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded transition-colors btn-editar" title="Editar">
                                    <span class="material-symbols-outlined text-[18px]">edit</span>
                                </button>
                                <button class="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors btn-excluir" title="Excluir">
                                    <span class="material-symbols-outlined text-[18px]">delete</span>
                                </button>
                            </div>
                        </div>
                    </div>
                `;

                    cardsContainer.appendChild(card);
                });
            };

            const buscaTermo = (buscaInput?.value || '').trim().toLowerCase();
            const listaFiltrada = materiaisData.filter((m) => {
                const tipo = tipoMaterial(m);
                if (filtroAtual === 'pdf') return tipo === 'pdf';
                if (filtroAtual === 'imagem') return tipo === 'imagem' || tipo === 'foto';
                if (filtroAtual === 'video') return tipo === 'video';
                if (filtroAtual === 'youtube') return tipo === 'youtube';
                const matchesTipo = true;
                const matchesBusca = !buscaTermo || (m.descricao || '').toLowerCase().includes(buscaTermo);
                return matchesTipo && matchesBusca;
            });

            if (cardsContainer) {
                renderCards(listaFiltrada);
            } else {
                renderTabela(listaFiltrada);
            }

            const scope = cardsContainer || tbody;
    if (!scope) return;

            scope.querySelectorAll('.btn-visualizar').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const item = btn.closest('[data-material-id]');
                    if (item) {
                        abrirModalVisualizarMaterial(item);
                    }
                });
            });

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

                const modalGerenciarMaterial = criarModalController(document.getElementById('gerenciarMateriaisModal'));
                const modalNovoMaterial = criarModalController(document.getElementById('novoMaterialModal'));

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
const modalGerenciarMaterial = criarModalController(modalGerenciarMaterialEl);
const modalNovoMaterial = criarModalController(modalNovoMaterialEl);

// Botão para abrir modal de novo material (fallback Tailwind)
const btnNovoMaterial = document.getElementById('btnNovoMaterial');
if (btnNovoMaterial && modalNovoMaterial) {
    btnNovoMaterial.addEventListener('click', () => modalNovoMaterial.show());
}

// Filtros de tipo
const filtroBotoes = document.querySelectorAll('[data-material-filter]');
if (filtroBotoes.length) {
    filtroBotoes.forEach((btn) => {
        btn.addEventListener('click', () => {
            filtroAtual = btn.dataset.materialFilter || 'all';
            filtroBotoes.forEach((b) => b.classList.remove('bg-[#111518]', 'text-white'));
            btn.classList.add('bg-[#111518]', 'text-white');
            carregarMateriais();
        });
    });
}

if (buscaBtn) {
    buscaBtn.addEventListener('click', () => {
        carregarMateriais();
    });
}

if (buscaInput) {
    buscaInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            carregarMateriais();
        }
    });
}

// Botões para fechar modais via data-modal-hide
document.querySelectorAll('[data-modal-hide="novoMaterialModal"]').forEach((btn) => {
    btn.addEventListener('click', () => modalNovoMaterial?.hide());
});
document.querySelectorAll('[data-modal-hide="editarMaterialModal"]').forEach((btn) => {
    btn.addEventListener('click', () => editarMaterialModal?.hide());
});
document.querySelectorAll('[data-modal-hide="excluirMaterialModal"]').forEach((btn) => {
    btn.addEventListener('click', () => excluirMaterialModal?.hide());
});
document.querySelectorAll('[data-modal-hide="visualizarMaterialModal"]').forEach((btn) => {
    btn.addEventListener('click', () => visualizarMaterialModal?.hide());
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
