document.getElementById('contact-form').addEventListener('submit', function (e) {
    e.preventDefault();

    const patientId = document.getElementById('contact-patient-id').value;
    const contactType = document.getElementById('contact-type').value;
    const notes = document.getElementById('contact-notes').value;

    // Pegamos os materiais selecionados
    const materials = Array.from(document.querySelectorAll('#selected-materials .material-pill'))
    .map(pill => pill.textContent.trim().replace(/\s+×$/, ''));

    fetch('/api/registrar-contato/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')  // função abaixo
        },
        body: JSON.stringify({
            paciente_id: patientId,
            tipo: contactType,
            anotacao: notes,
            materiais: materials
        })
    })
    .then(response => {
        if (!response.ok) throw new Error('Erro ao registrar contato');
            return response.json();
        })
    .then(data => {
        alert('Contato registrado com sucesso!');
        document.getElementById('contact-form').reset();
        contactModal.hide();
        // location.reload(); // ou atualizar somente o card, se preferir
    })
    .catch(err => {
        console.error(err);
        alert('Ocorreu um erro ao registrar o contato.');
    });

});

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
}

