const fileInput = document.getElementById('fileInput');
const readBtn = document.getElementById('readBtn');
const status = document.getElementById('status');
let pdfText = '';

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function() {
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

    pdfText = text;
    status.textContent = 'Ready to read!';
    readBtn.disabled = false;
  };
  reader.readAsArrayBuffer(file);
});

readBtn.addEventListener('click', () => {
  if (!pdfText) return;
  const utterance = new SpeechSynthesisUtterance(pdfText);
  speechSynthesis.speak(utterance);
});
