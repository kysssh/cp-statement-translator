export type ButtonState = 'idle' | 'loading' | 'done' | 'error';

let button: HTMLButtonElement | null = null;

export function mountButton(container: HTMLElement, onClick: () => void): HTMLButtonElement {
  button?.remove();
  button = document.createElement('button');
  button.type = 'button';
  button.className = 'cpt-button';
  button.textContent = 'Traducir al español';
  button.addEventListener('click', onClick);
  container.prepend(button);
  return button;
}

export function setButtonState(state: ButtonState, detail?: string): void {
  if (!button) return;
  button.dataset.state = state;
  button.disabled = state === 'loading';
  button.title = state === 'error' ? (detail ?? '') : '';
  button.textContent = {
    idle: 'Traducir al español',
    loading: detail || 'Traduciendo…',
    done: 'Traducido',
    error: `Error: ${detail ?? 'reintentar'}`,
  }[state];
}
