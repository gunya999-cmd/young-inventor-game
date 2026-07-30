export type RunControl = 'pause' | 'resume' | 'stop' | 'restart';

export function controlAllowedAfterCompletion(completed: boolean, control: RunControl): boolean {
  if (!completed) return true;
  return control === 'stop' || control === 'restart';
}

/**
 * GameApp currently represents both a normal pause and a completed run with the
 * `paused` mode. This DOM guard prevents the completed state from being resumed
 * until the player explicitly chooses Stop or "Ещё раз".
 */
export function installCompletionGuard(): void {
  const root = document.querySelector<HTMLElement>('#app');
  const pauseButton = document.querySelector<HTMLButtonElement>('#pause-button');
  if (!root || !pauseButton) return;

  const completed = (): boolean => root.classList.contains('completed');
  const syncPauseButton = (): void => {
    if (completed()) {
      pauseButton.disabled = true;
      pauseButton.setAttribute('aria-disabled', 'true');
      pauseButton.title = 'Симуляция завершена. Нажми «Ещё раз» или «Стоп».';
    } else {
      pauseButton.removeAttribute('aria-disabled');
      pauseButton.removeAttribute('title');
    }
  };

  pauseButton.addEventListener('click', (event) => {
    if (controlAllowedAfterCompletion(completed(), 'resume')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, { capture: true });

  document.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() !== 'p' || controlAllowedAfterCompletion(completed(), 'resume')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, { capture: true });

  new MutationObserver(syncPauseButton).observe(root, { attributes: true, attributeFilter: ['class'] });
  syncPauseButton();
}
