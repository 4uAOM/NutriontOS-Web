// app.js - frontend logic: register/login/save/list/get/decrypt + basic UI hooks

// helper display
function el(id){ return document.getElementById(id); }
function q(sel){ return document.querySelector(sel); }

// formatting
function formatCzas(sec){
  if (!sec && sec !== 0) return '0s';
  if (sec >= 60){
    const m = Math.floor(sec/60);
    const s = (sec%60).toFixed(2);
    return `${m}m ${s}s`;
  }
  return `${sec.toFixed(2)}s`;
}

async function apiPost(path, body){
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res;
}

async function apiGet(path){
  const res = await fetch(path, { method:'GET', credentials:'include' });
  return res;
}

// ---- AUTH UI (index.html) ----
async function initAuthUI(){
  const loginForm = el('login-form');
  const registerForm = el('register-form');
  if (!loginForm || !registerForm) return;

  loginForm.onsubmit = async (e) => {
    e.preventDefault();
    const u = el('login-username').value.trim();
    const p = el('login-password').value;
    if(!u||!p) return alert('Wypełnij pola');
    const res = await apiPost('/api/login',{username:u,password:p});
    const j = await res.json();
    if(res.ok) return location.href = '/show.html';
    alert(j.error || 'Błąd logowania');
  };

  registerForm.onsubmit = async (e) => {
    e.preventDefault();
    const u = el('reg-username').value.trim();
    const p = el('reg-password').value;
    const magic = el('reg-magic').value;
    if(!u||!p||!magic) return alert('Wypełnij pola');
    const magicHash = await sha256_hex_str(magic);
    const res = await apiPost('/api/register',{username:u,password:p,magic_hash:magicHash});
    const j = await res.json();
    if(res.ok) return location.href = '/show.html';
    alert(j.error || 'Błąd rejestracji');
  };
}

// ---- ADD PAGE ----
function initAddPage(){
  const dateInput = el('training-date');
  const desc = el('desc');
  const intervals = el('intervals');
  const addIntervalBtn = el('add-interval');
  const finishBtn = el('finish-training');

  if(!dateInput) return;
  dateInput.valueAsDate = new Date();

  function addInterval(data){
    const d = document.createElement('div');
    d.className = 'interval';
    d.innerHTML = `
      <input class="i-length" type="number" placeholder="Długość (m)" value="${data?.dlugosc||300}">
      <input class="i-target" type="number" placeholder="Założenie (s)" value="${data?.zalozenie||0}">
      <input class="i-result" type="number" placeholder="Wynik (s)" value="${data?.wynik||0}">
      <input class="i-rest" type="number" placeholder="Przerwa (min)" value="${data?.przerwa_min||2}">
      <button class="remove-interval btn small danger">Usuń</button>
    `;
    d.querySelector('.remove-interval').onclick = ()=>d.remove();
    intervals.appendChild(d);
  }

  addIntervalBtn.onclick = ()=>addInterval();
  addInterval(); // first

  finishBtn.onclick = async () => {
    const items = [...intervals.querySelectorAll('.interval')].map((n,i)=>{
      const length = parseFloat(n.querySelector('.i-length').value) || 0;
      const target = parseFloat(n.querySelector('.i-target').value) || 0;
      const result = parseFloat(n.querySelector('.i-result').value) || 0;
      const rest = parseFloat(n.querySelector('.i-rest').value) || 0;
      return { odcinek: i+1, dlugosc: length, zalozenie: target, wynik: result, wynik_sformatowany: formatCzas(result), przerwa_min: rest };
    });

    const kwas = parseFloat(prompt('Kwas (mmol/l):','0')) || 0;
    const samop = parseFloat(prompt('Samopoczucie (0-10):','7')) || 0;
    const ciez = parseFloat(prompt('Ciężkość (0-10):','7')) || 0;

    // Build training object
    const training = {
      opis: desc.value || '',
      odcinki: items,
      kwas, samopoczucie: samop, ciezkosc: ciez,
      trainingDate: new Date(dateInput.value).toISOString(),
      createdAtClient: new Date().toISOString()
    };

    // prompt for password + magic phrase to derive key on client
    const password = prompt('Podaj hasło (do odszyfrowania):');
    const magicPhrase = prompt('Podaj Magic Phrase (potrzebne do zapisu):');
    if(!password || !magicPhrase) return alert('Hasło i Magic Phrase wymagane');

    // encrypt
    try {
      const encPayload = await encryptObject(training, password, magicPhrase);
      // send to server (server uses session username)
      const magicHash = await sha256_hex_str(magicPhrase);
      const body = {
        ciphertext: encPayload.ciphertext,
        iv: encPayload.iv,
        salt: encPayload.salt,
        kdf: encPayload.kdf,
        meta: { filenameHint: `trening_${Date.now()}` },
        filename: `trening_${Date.now()}.json`,
        magic_hash: magicHash
      };
      const res = await apiPost('/api/save_encrypted', body);
      const j = await res.json();
      if(!res.ok) {
        alert(j.error || 'Błąd zapisu na serwerze');
      } else {
        alert('Zapisano zaszyfrowany trening na serwerze');
        location.href = '/show.html';
      }
    } catch(e){
      alert('Błąd szyfrowania: ' + e.message);
    }
  };
}

// ---- SHOW PAGE ----
async function initShowPage(){
  const list = el('trainings-list');
  if(!list) return;
  list.innerHTML = '<p>Ładowanie...</p>';
  const res = await apiGet('/api/list_encrypted');
  if(!res.ok){ list.innerHTML = '<p>Brak dostępu. Zaloguj się.</p>'; return; }
  const arr = await res.json();
  if(!arr.length){ list.innerHTML = '<p>Brak treningów.</p>'; return; }
  list.innerHTML = '';
  for(const f of arr){
    const card = document.createElement('div'); card.className='card';
    const head = document.createElement('div'); head.innerHTML = `<strong>${f.file}</strong> — ${f.mtime}`;
    const actions = document.createElement('div'); actions.className='card-actions';
    const btnGet = document.createElement('button'); btnGet.className='btn small'; btnGet.textContent='Pobierz i odszyfruj';
    btnGet.onclick = async ()=>{
      const pwd = prompt('Hasło (to samo co przy zapisie):');
      const magic = prompt('Magic Phrase (to samo):');
      if(!pwd || !magic) return alert('Potrzebne do odszyfrowania');
      const r = await apiPost('/api/get_encrypted', { filename: f.file });
      if(!r.ok){ const j = await r.json(); return alert(j.error||'Błąd pobierania'); }
      const payload = await r.json();
      try {
        const obj = await decryptObject(payload.payload, pwd, magic);
        // wyświetl w okienku lub otwórz w nowej karcie jako JSON
        const w = window.open(); w.document.body.innerHTML = `<pre>${JSON.stringify(obj, null, 2)}</pre>`;
      } catch(e){
        alert('Błąd odszyfrowania: ' + e.message);
      }
    };
    const btnDel = document.createElement('button'); btnDel.className='btn small danger'; btnDel.textContent='Usuń';
    btnDel.onclick = async ()=>{
      if(!confirm('Usunąć plik na serwerze?')) return;
      // delete via GET of list then server-side delete not implemented; simpler: user can implement delete endpoint
      alert('Funkcja usuwania niezaimplementowana w tym buildzie. Możesz dodać endpoint /api/delete_encrypted.');
    };
    actions.append(btnGet, btnDel);
    card.append(head, actions);
    list.append(card);
  }
}

// ---- EDIT PAGE ----
async function initEditPage(){
  // Edit page expects ?file=filename in query string
  const params = new URLSearchParams(location.search);
  const filename = params.get('file');
  const container = el('edit-form');
  if(!filename || !container){ return container && (container.innerHTML = '<p>Brak pliku do edycji</p>'); }
  container.innerHTML = '<p>Załaduj zaszyfrowany plik przez "Pobierz i odszyfruj" na stronie show.html, edycja po stronie klienta do dodania.</p>';
  // For full edit flow: fetch, decrypt, render form, allow modify, re-encrypt and save back.
}

// ---- INIT based on pathname ----
document.addEventListener('DOMContentLoaded', ()=>{
  initAuthUI().catch(()=>{});
  const p = window.location.pathname.split('/').pop();
  if(p === '' || p === 'index.html') {
    // index page: bind auth UI
    // there should be forms on index if you want login/register on index
  }
  if(p === 'add.html') initAddPage();
  if(p === 'show.html') initShowPage();
  if(p === 'edit.html') initEditPage();
});
