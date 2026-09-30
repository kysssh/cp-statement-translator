export type ButtonState = 'idle' | 'loading' | 'done' | 'original' | 'error';

let button: HTMLButtonElement | null = null;

export function mountButton(container: HTMLElement, onClick: (state: ButtonState) => void): HTMLButtonElement {
  button?.remove();
  button = document.createElement('button');
  button.type = 'button';
  button.className = 'cpt-button';
  button.dataset.state = 'idle';
  button.textContent = 'Traducir al español';
  button.addEventListener('click', () => onClick(getButtonState()));
  container.prepend(button);
  return button;
}

export function getButtonState(): ButtonState {
  return (button?.dataset.state as ButtonState | undefined) ?? 'idle';
}

/**
 * `detail` es el mensaje de progreso en 'loading', el motivo en 'error',
 * y una nota (tooltip) en 'done'/'original'.
 */
export function setButtonState(state: ButtonState, detail?: string): void {
  if (!button) return;
  button.dataset.state = state;
  button.disabled = state === 'loading';
  button.title = state === 'loading' ? '' : (detail ?? '');
  button.textContent = {
    idle: 'Traducir al español',
    loading: state === 'loading' && detail ? detail : 'Traduciendo…',
    done: 'Ver original (EN)',
    original: 'Ver traducción (ES)',
    error: `Error: ${detail ?? 'desconocido'} — clic para reintentar`,
  }[state];
}
