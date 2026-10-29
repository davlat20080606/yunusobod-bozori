// Loud two-tone "ding-dong" for new orders: a butcher with wet hands hears it without looking.
// Browsers allow sound only after the first tap, so the audio is unlocked on the first touch.
let ctx = null;

function audio() {
  if (!ctx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
  }
  return ctx;
}

if (typeof window !== 'undefined') {
  const unlock = () => { try { audio()?.resume(); } catch {} };
  window.addEventListener('pointerdown', unlock, { once: true });
}

export function dingDong() {
  const ac = audio();
  if (!ac) return;
  try {
    ac.resume();
    [[880, 0], [660, 0.28]].forEach(([freq, at]) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = ac.currentTime + at;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.6, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.6);
      osc.connect(gain).connect(ac.destination);
      osc.start(start);
      osc.stop(start + 0.65);
    });
  } catch {}
  try { navigator.vibrate?.([200, 100, 200]); } catch {}
}

// Calls dingDong when a list gets a new id (not on the first load)
export function newIdsWatcher() {
  let known = null;
  return (ids) => {
    const next = new Set(ids);
    const fresh = known && [...next].some((id) => !known.has(id));
    known = next;
    if (fresh) dingDong();
  };
}
