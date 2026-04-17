/**
 * Audio controls UI — Plan I §10.
 * mountAudioControls(root, audio) — renders volume slider + mute toggle.
 * Works with any DOM container.
 */

/**
 * Mount volume slider + mute button into root element.
 * Reads initial state from audio system; two-way binding.
 *
 * @param {HTMLElement} root     Container element to render into
 * @param {object} audio         createAudioSystem return value
 */
export function mountAudioControls(root, audio) {
  if (!root || !audio) return;

  root.innerHTML = `
    <div class="audio-controls" aria-label="오디오 설정">
      <button class="audio-mute-btn" type="button" title="음소거 토글" aria-pressed="false">
        <span class="audio-mute-icon">🔊</span>
      </button>
      <input
        class="audio-volume-slider"
        type="range"
        min="0"
        max="1"
        step="0.05"
        aria-label="마스터 볼륨"
        value="0.8"
      />
    </div>
  `;

  const muteBtn = root.querySelector(".audio-mute-btn");
  const icon = root.querySelector(".audio-mute-icon");
  const slider = root.querySelector(".audio-volume-slider");

  function syncFromAudio() {
    const muted = audio.getMuted();
    const vol = audio.getMasterVolume();
    slider.value = String(vol);
    muteBtn.setAttribute("aria-pressed", String(muted));
    icon.textContent = muted ? "🔇" : vol < 0.01 ? "🔇" : vol < 0.5 ? "🔉" : "🔊";
  }

  syncFromAudio();

  slider.addEventListener("input", () => {
    audio.setMasterVolume(parseFloat(slider.value));
    syncFromAudio();
  });

  muteBtn.addEventListener("click", () => {
    audio.setMuted(!audio.getMuted());
    syncFromAudio();
  });
}
