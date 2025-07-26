import { listarPacientes } from './home.js';

document.addEventListener('DOMContentLoaded', () => {

    inicializarFiltrosPacientes();

});

export function inicializarFiltrosPacientes() {
    const aplicarBtn = document.getElementById('apply-filters');
    const resetarBtn = document.getElementById('reset-filters');
    
    const filtroNome = document.getElementById('filter-name');
    const filtroStatus = document.getElementById('filter-status');
    const filtroSort = document.getElementById('filter-sort');

    if (aplicarBtn) {
        aplicarBtn.addEventListener('click', (e) => {
            e.preventDefault();
            listarPacientes();
        });
    }

    if (resetarBtn) {
        resetarBtn.addEventListener('click', (e) => {
        e.preventDefault();

        if (filtroNome) filtroNome.value = '';
        if (filtroStatus) filtroStatus.value = '';
        if (filtroSort) filtroSort.value = '';

        listarPacientes();
        });
    }
}
