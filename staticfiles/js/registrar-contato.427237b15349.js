import { atualizarCardPaciente } from './home.js';
import { showToast } from './message.js';

const formEl = document.getElementById('contact-form');
const nextDateWarning = document.getElementById('contact-next-warning');

async function atualizarSugestaoProximoContato(pacienteId) {
  if (!pacienteId) return;
  if (nextDateWarning) {
    nextDateWarning.textContent = '';
    nextDateWarning.classList.add('hidden');
  }
  try {
    const res = await fetch(`/api/proximo_contato/${pacienteId}/`);
    if (!res.ok) return;
    const data = await res.json();
    const proximo = data?.proximo_contato;
    const contatosNoDia = data?.contatos_no_dia || 0;
        if (proximo && contatosNoDia > 5 && nextDateWarning) {
      nextDateWarning.textContent = `Cuidado, o próximo dia para o contato deste paciente é ${new Date(proximo).toLocaleDateString('pt-BR')}, para este dia você já tem mais de 5 contatos marcados. Deseja continuar?`;
      nextDateWarning.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Erro ao obter próximo contato sugerido', error);
  }
}

// expõe para home.js
// window.atualizarSugestaoProximoContato = atualizarSugestaoProximoContato;

if (formEl) {
  formEl.addEventListener('submit', (e) => {
    e.preventDefault();

    const submitBtn = document.getElementById('btn-registrar-contato');
    const originalLabel = submitBtn ? submitBtn.innerHTML : '';

    const patientId = document.getElementById('contact-patient-id').value;
    const contactType = document.getElementById('contact-type').value;
    const notesField = document.getElementById('contact-notes');
    const notes = (notesField?.value || '').trim();

    const proceed = notes ? Promise.resolve(true) : confirmProceedWithoutNotes();

    proceed
      .then(async (ok) => {
        if (!ok) throw new Error('cancelado');

        const confirmouData = await verificarProximoContato(patientId);
        if (!confirmouData) throw new Error('cancelado');

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<span class="btn-spinner inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin align-middle mr-2"></span> Salvando...';
        }

        const materials = Array.from(document.querySelectorAll('#selected-materials .material-pill'))
          .map((pill) => {
            const nome = pill.dataset.materialName || pill.textContent || '';
            return nome.replace(/\s+-?$/, '').trim();
          })
          .filter(Boolean);

        const response = await fetch('/api/registrar-contato/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken'),
          },
          body: JSON.stringify({
            paciente_id: patientId,
            tipo: contactType,
            anotacao: notes,
            materiais: materials,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.erro || 'Erro ao salvar contato');
        }

        const contactModalEl = document.getElementById('contactModal');
        if (contactModalEl) {
          contactModalEl.classList.add('hidden');
        }

        showToast(data.mensagem, 'success');
        formEl.reset();
        atualizarCardPaciente(patientId);
      })
      .catch((err) => {
        if (err?.message === 'cancelado') return;
        showToast(err.message || 'Erro ao salvar contato', 'error');
        console.error(err);
      })
      .finally(() => {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalLabel || 'Salvar';
        }
      });
  });
}

function confirmProceedWithoutNotes() {
  return new Promise((resolve) => {
    let modalEl = document.getElementById('emptyNotesConfirmModal');

    if (!modalEl) {
      modalEl = document.createElement('div');
      modalEl.id = 'emptyNotesConfirmModal';
      modalEl.className = 'fixed inset-0 z-50 hidden';
      modalEl.innerHTML = `
        <div class="fixed inset-0 bg-gray-900/75 backdrop-blur-sm"></div>
        <div class="fixed inset-0 z-10 w-screen overflow-y-auto">
          <div class="flex min-h-full items-center justify-center p-4 text-center">
            <div class="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-md">
              <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div class="sm:flex sm:items-start">
                  <div class="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-yellow-100 sm:mx-0 sm:h-10 sm:w-10">
                    <span class="material-symbols-outlined text-yellow-600">warning</span>
                  </div>
                  <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 class="text-base font-semibold leading-6 text-gray-900">Sem anotações</h3>
                    <div class="mt-2">
                      <p class="text-sm text-gray-500">Você não escreveu nada em "Anotações do Contato". Deseja salvar mesmo assim?</p>
                    </div>
                  </div>
                </div>
              </div>
              <div class="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                <button type="button" class="inline-flex w-full justify-center rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 sm:ml-3 sm:w-auto" id="confirm-empty-notes-btn">Salvar sem anotações</button>
                <button type="button" class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto" data-dismiss="modal">Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modalEl);
    }

    const confirmBtn = modalEl.querySelector('#confirm-empty-notes-btn');
    const cancelBtn = modalEl.querySelector('[data-dismiss="modal"]');

    const hideModal = () => modalEl.classList.add('hidden');
    const cleanup = () => {
      confirmBtn?.removeEventListener('click', onConfirm);
      cancelBtn?.removeEventListener('click', onCancel);
    };

    const onConfirm = () => {
      cleanup();
      hideModal();
      resolve(true);
    };

    const onCancel = () => {
      cleanup();
      hideModal();
      resolve(false);
    };

    confirmBtn?.addEventListener('click', onConfirm);
    cancelBtn?.addEventListener('click', onCancel);

    modalEl.classList.remove('hidden');
  });
}

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop().split(';').shift();
  }
}

async function verificarProximoContato(pacienteId) {
  if (!pacienteId) return true;

  const formatarData = (iso) => {
    const d = iso ? new Date(iso) : null;
    return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('pt-BR') : '';
  };

  const mostrarAviso = (mensagem) => {
    if (nextDateWarning) {
      nextDateWarning.textContent = mensagem;
      nextDateWarning.classList.remove('hidden');
    }
  };

  const limparAviso = () => {
    if (nextDateWarning) {
      nextDateWarning.textContent = '';
      nextDateWarning.classList.add('hidden');
    }
  };

  // Prioriza a data digitada pelo usuário; se estiver vazia, considera sugestão do backend
  let dataAlvo = '';

  // try {
  //   const res = await fetch(`/api/proximo_contato/${pacienteId}/`);
  //   if (res.ok) {
  //     const data = await res.json();
  //     const proximo = data?.proximo_contato;
  //     const contatosNoDia = data?.contatos_no_dia || 0;

  //     if (proximo && !dataAlvo) {
  //       dataAlvo = proximo;
  //     }

  //     limparAviso();

  //     if (proximo && contatosNoDia > 5) {
  //       const mensagem = `Cuidado, o próximo dia para o contato deste paciente é ${formatarData(proximo)}, para este dia você já tem mais de 5 contatos marcados. Deseja continuar?`;
  //       mostrarAviso(mensagem);
  //       return window.confirm(mensagem);
  //     }
  //   }
  // } catch (error) {
  //   console.error('Erro ao verificar próximo contato', error);
  // }

  // if (dataAlvo) {
  //   try {
  //     const historicoRes = await fetch(`/api/historico-contatos/${pacienteId}/`);
  //     if (historicoRes.ok) {
  //       const historicoData = await historicoRes.json();
  //       const contatos = Array.isArray(historicoData.contatos) ? historicoData.contatos : [];
  //       const totalNoDia = contatos.filter((c) => {
  //         const dia = (c.data_contato || c.criado_em || '').substring(0, 10);
  //         return dia === dataAlvo;
  //       }).length;
  //       if (totalNoDia > 5) {
  //         const mensagem = `Cuidado, o próximo dia para o contato deste paciente é ${formatarData(dataAlvo)}, para este dia você já tem mais de 5 contatos marcados. Deseja continuar?`;
  //         mostrarAviso(mensagem);
  //         return window.confirm(mensagem);
  //       }
  //     }
  //   } catch (error) {
  //     console.error('Erro ao checar histórico de contatos', error);
  //   }
  // }

  limparAviso();
  return true;
}
