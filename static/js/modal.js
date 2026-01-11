/**
 * Modal Utility for Tailwind CSS
 * Replaces Bootstrap Modal functionality.
 */

const Modal = {
    show: (modalId) => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            document.body.classList.add('overflow-hidden'); // Lock body scroll
        }
    },
    hide: (modalId) => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            document.body.classList.remove('overflow-hidden');
        }
    },
    toggle: (modalId) => {
        const modal = document.getElementById(modalId);
        if (modal) {
            if (modal.classList.contains('hidden')) {
                Modal.show(modalId);
            } else {
                Modal.hide(modalId);
            }
        }
    }
};

// Global Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('click', (event) => {
        // Close when clicking backdrop (marked with data-modal-backdrop)
        if (event.target.hasAttribute('data-modal-backdrop')) {
            Modal.hide(event.target.id);
        }

        // Handle data-modal-toggle
        const toggleTrigger = event.target.closest('[data-modal-toggle]');
        if (toggleTrigger) {
            const targetId = toggleTrigger.getAttribute('data-modal-toggle');
            Modal.toggle(targetId);
            event.preventDefault();
        }

        // Handle data-modal-hide (Close buttons)
        const hideTrigger = event.target.closest('[data-modal-hide]');
        if (hideTrigger) {
            const targetId = hideTrigger.getAttribute('data-modal-hide');
            Modal.hide(targetId);
            event.preventDefault();
        }

        // Compatibility with Bootstrap data attributes (data-bs-dismiss="modal")
        const bsDismiss = event.target.closest('[data-bs-dismiss="modal"]');
        if (bsDismiss) {
            const modal = bsDismiss.closest('[id]'); // Find closest parent with ID (the modal)
            if (modal) {
                Modal.hide(modal.id);
            }
            event.preventDefault();
        }
    });
});

// Polyfill for bootstrap.Modal
const bootstrapInstances = new Map();
class BootstrapModal {
    constructor(element) {
        const target = typeof element === 'string' ? document.getElementById(element) : element;
        this.id = target?.id || null;
    }
    show() {
        if (!this.id) return;
        Modal.show(this.id);
    }
    hide() {
        if (!this.id) return;
        Modal.hide(this.id);
    }
    toggle() {
        if (!this.id) return;
        Modal.toggle(this.id);
    }
    static getInstance(element) {
        const target = typeof element === 'string' ? document.getElementById(element) : element;
        if (!target || !target.id) {
            return null;
        }
        if (!bootstrapInstances.has(target.id)) {
            bootstrapInstances.set(target.id, new BootstrapModal(target));
        }
        return bootstrapInstances.get(target.id);
    }
}

window.bootstrap = {
    Modal: BootstrapModal,
};

window.Modal = Modal;
