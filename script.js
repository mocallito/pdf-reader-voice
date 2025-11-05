const fileInput = document.getElementById('fileInput');
const readBtn = document.getElementById('readBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resumeBtn = document.getElementById('resumeBtn');
const stopBtn = document.getElementById('stopBtn');
const status = document.getElementById('status');
const output = document.getElementById('output');
const voiceSelect = document.getElementById('voiceSelect');

let pdfText = '';
let utterance = null;
let chunks = [];
let currentChunk = 0;
let isPaused = false;

// ✅ PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

// 🗣 Load voices
function loadVoices() {
  const voices = speechSynthesis.getVoices();
  voiceSelect.innerHTML = '';
  voices.forEach((voice, i) => {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = `${voice.name} (${voice.lang})`;
    voiceSelect.appendChild(option);
  });
}
speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();

// 📂 Handle file upload
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function() {
    try {
      const typedarray = new Uint8Array(this.result);
      const pdf = await pdfjsLib.getDocument(typedarray).promise;

      status.textContent = 'Extracting text...';
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const strings = content.items.map(item => item.str);
        text += strings.join(' ') + '\n';
      }

      pdfText = text.trim();
      output.textContent = pdfText;
      status.textContent = 'Ready to read!';
      readBtn.disabled = false;
    } catch (err) {
      console.error(err);
      status.textContent = 'Error reading PDF!';
    }
  };
  reader.readAsArrayBuffer(file);
});

// 🔧 Split text into smaller parts for stable TTS
function splitTextIntoChunks(text, maxLength = 500) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks = [];
  let current = '';

  sentences.forEach(sentence => {
    if ((current + sentence).length > maxLength) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  });

  if (current) chunks.push(current.trim());
  return chunks;
}

// 🗣 Read Aloud
readBtn.addEventListener('click', () => {
  if (!pdfText) return;

  // Reset
  speechSynthesis.cancel();
  removeHighlight();

  const voices = speechSynthesis.getVoices();
  const selectedVoice = voices[voiceSelect.value] || null;

  chunks = splitTextIntoChunks(pdfText, 1);
  currentChunk = 0;
  isPaused = false;

  function speakNextChunk() {
    if (currentChunk >= chunks.length || isPaused) return;

    utterance = new SpeechSynthesisUtterance(chunks[currentChunk]);
    utterance.voice = selectedVoice;

    utterance.onstart = () => {
      status.textContent = `Reading chunk ${currentChunk + 1}/${chunks.length}...`;
      pauseBtn.disabled = false;
      stopBtn.disabled = false;
      highlightText(currentChunk);
    };

    utterance.onend = () => {
      if (!isPaused) {
        currentChunk++;
        if (currentChunk < chunks.length) {
          speakNextChunk();
        } else {
          status.textContent = 'Done!';
          pauseBtn.disabled = resumeBtn.disabled = stopBtn.disabled = true;
          removeHighlight();
        }
      }
    };

    speechSynthesis.speak(utterance);
  }

  window.pauseReading = () => {
    isPaused = true;
    speechSynthesis.pause();
    pauseBtn.disabled = true;
    resumeBtn.disabled = false;
    status.textContent = 'Paused.';
  };

  window.resumeReading = () => {
    isPaused = false;
    speechSynthesis.resume();
    pauseBtn.disabled = false;
    resumeBtn.disabled = true;
    status.textContent = 'Resuming...';
    speakNextChunk();
  };

  window.stopReading = () => {
    isPaused = false;
    currentChunk = chunks.length;
    speechSynthesis.cancel();
    status.textContent = 'Stopped.';
    pauseBtn.disabled = resumeBtn.disabled = stopBtn.disabled = true;
    removeHighlight();
  };

  speakNextChunk();
});

// 🕹 Buttons
pauseBtn.addEventListener('click', () => window.pauseReading());
resumeBtn.addEventListener('click', () => window.resumeReading());
stopBtn.addEventListener('click', () => window.stopReading());

// ✨ Highlight helper
function highlightText(index) {
  const before = chunks.slice(0, index).join(' ');
  const current = chunks[index];
  const after = chunks.slice(index + 1).join(' ');
  output.innerHTML = `${escapeHTML(before)} <span class="highlight">${escapeHTML(current)}</span> ${escapeHTML(after)}`;
}

function removeHighlight() {
  output.innerHTML = escapeHTML(pdfText);
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[c]));
}