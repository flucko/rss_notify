/* Shared request feedback and keyboard support for both pages. */
function notify(message, error = false) {
    const notice = document.getElementById('appNotice');
    notice.textContent = message;
    notice.dataset.error = String(error);
    notice.hidden = false;
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => { notice.hidden = true; }, error ? 10000 : 5000);
}

async function request(url, options) {
    try {
        const response = await fetch(url, options);
        if (!response.ok) throw new Error(`Request failed (${response.status}). Please try again.`);
        return response;
    } catch (error) {
        notify(error.message || 'Could not connect. Please try again.', true);
        throw error;
    }
}

function safeUrl(value) {
    try {
        const url = new URL(value);
        return ['http:', 'https:'].includes(url.protocol) ? url.href : '#';
    } catch { return '#'; }
}

function escapeText(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('button[title]').forEach(button => button.setAttribute('aria-label', button.title));
    document.querySelectorAll('.modal-overlay').forEach((modal, index) => {
        const heading = modal.querySelector('h2');
        heading.id ||= `dialog-title-${index}`;
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', heading.id);
        modal.querySelectorAll('button').forEach(button => {
            if (button.querySelector('.fa-xmark')) button.setAttribute('aria-label', 'Close dialog');
        });
        modal.querySelectorAll('label').forEach(label => {
            const input = label.parentElement.querySelector('input:not([type="hidden"])');
            if (input?.id) label.htmlFor = input.id;
        });
        let opener;
        let wasOpen = false;
        new MutationObserver(() => {
            const open = modal.classList.contains('active');
            if (open === wasOpen) return;
            wasOpen = open;
            if (open) {
                opener = document.activeElement;
                const panels = document.querySelectorAll('.modal-overlay.active');
                panels.forEach(panel => { panel.style.zIndex = panel === modal ? '60' : '50'; });
                modal.querySelector('input:not([type="hidden"]), button')?.focus();
            } else if (opener?.isConnected) opener.focus();
            document.body.style.overflow = document.querySelector('.modal-overlay.active') ? 'hidden' : '';
        }).observe(modal, {attributes: true, attributeFilter: ['class']});
        modal.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                event.stopPropagation();
                modal.classList.remove('active');
            }
            if (event.key !== 'Tab') return;
            const controls = [...modal.querySelectorAll('button, input, select, a[href], [tabindex="0"]')].filter(el => !el.disabled && el.getClientRects().length);
            const first = controls[0], last = controls.at(-1);
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        });
    });
    for (const [id, label] of Object.entries({feedName:'Feed name', feedUrl:'RSS URL', feedFilterTarget:'Where to match keywords'})) {
        document.getElementById(id)?.setAttribute('aria-label', label);
    }
});
