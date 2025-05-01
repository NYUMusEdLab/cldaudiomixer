
const canvas = document.getElementById('mixerCanvas');
const ctx = canvas.getContext('2d');
const playButton = document.getElementById('playToggle');
const progressBar = document.getElementById('progressBar');

const numTracks = 6;
const radius = 200;
const centerX = canvas.width / 2;
const centerY = canvas.height / 2;
const trackNames = ["BaritoneGuitar", "Bass", "BGVocals", "Drums", "LeadVocals", "Piano"];
const audioFiles = [
  "ATCBaritoneGuitar_03.mp3",
  "ATCBass_03.mp3",
  "ATCBGVocals_03.mp3",
  "ATCDrums_03.mp3",
  "ATCLeadVocals_03.mp3",
  "ATCPiano_03.mp3"
];

let audioCtx, sources = [], gains = [], analyzers = [], buffers = [];
let isPlaying = false;
let trackStates = new Array(numTracks).fill(false);
let keyStates = new Array(numTracks).fill(false);
let startTime = 0;
let trackDuration = 0;

function drawCircles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < numTracks; i++) {
    const angle = (i / numTracks) * Math.PI * 2;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);

    let level = 0;
    if (analyzers[i]) {
      const data = new Uint8Array(analyzers[i].frequencyBinCount);
      analyzers[i].getByteFrequencyData(data);
      level = data.reduce((a, b) => a + b) / data.length / 255 * 10;
    }

    ctx.beginPath();
    ctx.arc(x, y, 40 + level, 0, Math.PI * 2);
    ctx.fillStyle = trackStates[i] ? '#00ff88' : '#444';
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText((i + 1) + ": " + trackNames[i], x, y + 4);
  }
}

function updateProgress() {
  if (!isPlaying) return;
  const elapsed = audioCtx.currentTime - startTime;
  const percent = (elapsed / trackDuration) * 100;
  progressBar.style.width = percent + "%";
  requestAnimationFrame(updateProgress);
}

function getClickedCircle(x, y) {
  for (let i = 0; i < numTracks; i++) {
    const angle = (i / numTracks) * Math.PI * 2;
    const cx = centerX + radius * Math.cos(angle);
    const cy = centerY + radius * Math.sin(angle);
    if (Math.hypot(cx - x, cy - y) < 50) return i;
  }
  return -1;
}

canvas.addEventListener('click', e => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const clicked = getClickedCircle(x, y);
  if (clicked >= 0) {
    trackStates[clicked] = !trackStates[clicked];
    gains[clicked].gain.setValueAtTime(trackStates[clicked] ? 1 : 0, audioCtx.currentTime);
    drawCircles();
  }
});

playButton.addEventListener('click', async () => {
  if (!audioCtx) await initAudio();

  if (!isPlaying) {
    playButton.textContent = 'Pause';
    sources.forEach(source => source.start(0));
    startTime = audioCtx.currentTime;
    requestAnimationFrame(updateProgress);
  } else {
    playButton.textContent = 'Play';
    sources.forEach(source => source.stop());
    sources = [];
    await initAudio();
  }
  isPlaying = !isPlaying;
});

async function initAudio() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  sources = [];
  gains = [];
  analyzers = [];

  for (let i = 0; i < numTracks; i++) {
    const res = await fetch('data/' + audioFiles[i]);
    const arrayBuffer = await res.arrayBuffer();
    buffers[i] = await audioCtx.decodeAudioData(arrayBuffer);
    if (i === 0) trackDuration = buffers[i].duration;
  }

  for (let i = 0; i < numTracks; i++) {
    const source = audioCtx.createBufferSource();
    const gainNode = audioCtx.createGain();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;

    gainNode.gain.value = 0;
    source.buffer = buffers[i];
    source.loop = true;

    source.connect(gainNode).connect(analyser).connect(audioCtx.destination);

    sources.push(source);
    gains.push(gainNode);
    analyzers.push(analyser);
  }

  setInterval(drawCircles, 100);
}

// --- Key Controls for Soloing ---
document.addEventListener('keydown', (e) => {
  const key = parseInt(e.key);
  if (key >= 1 && key <= 6) {
    const i = key - 1;
    if (!keyStates[i]) {
      keyStates[i] = true;
      trackStates[i] = true;
      if (gains[i]) gains[i].gain.setValueAtTime(1, audioCtx.currentTime);
      drawCircles();
    }
  }
});

document.addEventListener('keyup', (e) => {
  const key = parseInt(e.key);
  if (key >= 1 && key <= 6) {
    const i = key - 1;
    keyStates[i] = false;
    trackStates[i] = false;
    if (gains[i]) gains[i].gain.setValueAtTime(0, audioCtx.currentTime);
    drawCircles();
  }
});

drawCircles();
