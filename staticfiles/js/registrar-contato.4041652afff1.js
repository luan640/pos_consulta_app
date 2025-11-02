import { atualizarCardPaciente } from './home.js';
import { showToast } from './message.js';

document.getElementById('contact-form').addEventListener('submit', function (e) {
  e.preventDefault();

  const submitBtn = document.getElementById('btn-registrar-contato');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Salvando...';

  const patientId = document.getElementById('contact-patient-id').value;
  const contactType = document.getElementById('contact-type').value;
  const notes = document.getElementById('contact-notes').value;

  // Pegamos os materiais selecionados
  const materials = Array.from(document.querySelectorAll('#selected-materials .material-pill'))
    .map((pill) => {
      const nome = pill.dataset.materialName || pill.textContent || '';
      return nome.replace(/\s+×?$/, '').trim();
    })
    .filter(Boolean);

  fetch('/api/registrar-contato/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCookie('csrftoken') // função abaixo
    },
    body: JSON.stringify({
      paciente_id: patientId,
      tipo: contactType,
      anotacao: notes,
      materiais: materials
    })
  })
    .then((response) =>
      response.json().then((data) => {
        if (!response.ok) {
          throw new Error(data.erro);
        }
        return data;
      })
    )
    .then((data) => {
      const contactModalEl = document.getElementById('contactModal');
      const contactModal = bootstrap.Modal.getInstance(contactModalEl);

      showToast(data.mensagem, 'success');

      document.getElementById('contact-form').reset();
      if (contactModal) {
        contactModal.hide();
      }

      atualizarCardPaciente(patientId);
    })
    .catch((err) => {
      showToast(err.message, 'error');
      console.error(err);
    })
    .finally(() => {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Salvar';
    });
});

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop().split(';').shift();
  }
}
