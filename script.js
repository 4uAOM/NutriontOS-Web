function formatCzas(sec) {
  if (sec > 60) {
    const min = Math.floor(sec / 60);
    const s = (sec % 60).toFixed(2);
    return `${min}m ${s}s`;
  }
  return `${sec.toFixed(2)}s`;
}

function updateClock() {
  const el = document.getElementById("datetime");
  if (el) {
    const now = new Date();
    el.textContent = now.toLocaleString('pl-PL', { dateStyle: 'full', timeStyle: 'medium' });
  }
}
setInterval(updateClock, 1000);
updateClock();

async function saveTrainingToServer(trening) {
  const res = await fetch('save_training.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(trening)
  });
  if (!res.ok) alert('Błąd zapisu na serwerze');
}

document.addEventListener('DOMContentLoaded', () => {
  const path = location.pathname.split('/').pop();

  if (path === 'add.html') initAdd();
  if (path === 'show.html') initShow();
  if (path === 'edit.html') initEdit();
});

function initAdd() {
  const dateInput = document.getElementById('training-date');
  const desc = document.getElementById('desc');
  const intervals = document.getElementById('intervals');
  const addBtn = document.getElementById('add-interval');
  const finishBtn = document.getElementById('finish-training');

  dateInput.valueAsDate = new Date();

  addBtn.onclick = () => {
    const div = document.createElement('div');
    div.className = 'interval';
    div.innerHTML = `
      <input type="number" placeholder="Długość (m)" class="i-length">
      <input type="number" placeholder="Założenie (s)" class="i-target">
      <input type="number" placeholder="Wynik (s)" class="i-result">
      <input type="number" placeholder="Przerwa (min)" class="i-rest">
    `;
    intervals.appendChild(div);
  };

  finishBtn.onclick = async () => {
    const items = [...intervals.querySelectorAll('.interval')].map((n, i) => {
      const length = parseFloat(n.querySelector('.i-length').value) || 0;
      const target = parseFloat(n.querySelector('.i-target').value) || 0;
      const result = parseFloat(n.querySelector('.i-result').value) || 0;
      const rest = parseFloat(n.querySelector('.i-rest').value) || 0;
      return {
        odcinek: i + 1,
        dlugosc: length,
        zalozenie: target,
        wynik: result,
        wynik_sformatowany: formatCzas(result),
        przerwa_min: rest
      };
    });

    const kwas = parseFloat(prompt('Kwas (mmol/l):', '0')) || 0;
    const samopoczucie = parseFloat(prompt('Samopoczucie (0-10):', '7')) || 0;
    const ciezkosc = parseFloat(prompt('Ciężkość (0-10):', '7')) || 0;

    const trening = {
      id: Date.now(),
      data: new Date(dateInput.value).toISOString(),
      opis: desc.value,
      odcinki: items,
      kwas,
      samopoczucie,
      ciezkosc
    };

    await saveTrainingToServer(trening);
    alert('Trening zapisany na serwerze.');
    location.href = 'show.html';
  };
}

function initShow() {
  const list = document.getElementById('trainings-list');
  list.innerHTML = '<p>Wczytywanie z serwera...</p>';
  fetch('Treningi/')
    .then(() => list.innerHTML = '<p>Treningi zapisane na serwerze (JSON pliki w folderze /Treningi).</p>');
}

function initEdit() {
  document.getElementById('edit-form').innerHTML = '<p>Edytor do wdrożenia</p>';
}
