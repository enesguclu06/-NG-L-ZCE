import { login, logout, getSession, getRecentWords } from '../lib/supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
  const loginScreen = document.getElementById('loginScreen');
  const authScreen = document.getElementById('authScreen');
  const logoutBtn = document.getElementById('logoutBtn');
  
  const loginForm = document.getElementById('loginForm');
  const loginBtn = document.getElementById('loginBtn');
  const loginError = document.getElementById('loginError');
  
  const addBtn = document.getElementById('addBtn');
  const manualWord = document.getElementById('manualWord');
  const addError = document.getElementById('addError');
  
  const wordList = document.getElementById('wordList');
  const loadingWords = document.getElementById('loadingWords');

  // Check auth state on load
  const session = await getSession();
  if (session) {
    showAuthScreen();
  } else {
    showLoginScreen();
  }

  // ── PDF Mode: auto-fill from clipboard if opened via Ctrl+Shift+S on a PDF ──
  const { pdfMode } = await chrome.storage.session.get('pdfMode');
  if (pdfMode && session) {
    await chrome.storage.session.remove('pdfMode');
    try {
      const text = await navigator.clipboard.readText();
      const word = text?.trim().split(/\s+/).slice(0, 4).join(' '); // max 4 words
      if (word && word.length > 0 && word.length < 60) {
        manualWord.value = word;
      }
    } catch { /* clipboard permission denied — just focus empty input */ }
    manualWord.focus();
    manualWord.select();
  }

  // ── Login Flow ─────────────────────────────────────────────────────────────
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    loginBtn.disabled = true;
    loginBtn.textContent = 'Giriş Yapılıyor...';
    loginError.textContent = '';

    try {
      await login(email, password);
      showAuthScreen();
    } catch (err) {
      loginError.textContent = err.message;
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = 'Giriş Yap';
    }
  });

  // ── Logout Flow ────────────────────────────────────────────────────────────
  logoutBtn.addEventListener('click', async () => {
    await logout();
    showLoginScreen();
  });

  // ── Manual Word Add ───────────────────────────────────────────────────────
  addBtn.addEventListener('click', () => {
    const word = manualWord.value.trim();
    if (!word) return;

    addBtn.disabled = true;
    addError.textContent = 'Kaydediliyor...';
    addError.style.color = '#94A3B8'; // Info color

    chrome.runtime.sendMessage({ action: "manual_save", word: word }, (response) => {
      addBtn.disabled = false;
      if (response && response.success) {
        manualWord.value = '';
        addError.textContent = '✅ Eklendi!';
        addError.style.color = '#4ADE80'; // Success color
        loadRecentWords(); // Refresh list
        setTimeout(() => addError.textContent = '', 2000);
      } else {
        addError.textContent = (response && response.error) ? response.error : 'Hata oluştu';
        addError.style.color = '#F87171'; // Error color
      }
    });
  });

  manualWord.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addBtn.click();
  });

  // ── UI State Toggles ──────────────────────────────────────────────────────
  function showLoginScreen() {
    loginScreen.style.display = 'block';
    authScreen.style.display = 'none';
    logoutBtn.style.display = 'none';
  }

  function showAuthScreen() {
    loginScreen.style.display = 'none';
    authScreen.style.display = 'block';
    logoutBtn.style.display = 'block';
    loadRecentWords();
  }

  async function loadRecentWords() {
    loadingWords.style.display = 'block';
    wordList.innerHTML = '';
    
    try {
      const words = await getRecentWords(5);
      loadingWords.style.display = 'none';
      
      if (words.length === 0) {
        wordList.innerHTML = '<li class="loading">Henüz kelime eklenmemiş.</li>';
        return;
      }

      words.forEach(w => {
        const li = document.createElement('li');
        li.className = 'word-item';
        
        const en = document.createElement('div');
        en.className = 'word-en';
        en.textContent = w.english_word;
        
        const tr = document.createElement('div');
        tr.className = 'word-tr';
        tr.textContent = w.turkish_translation || 'Çeviri yok';
        
        li.appendChild(en);
        li.appendChild(tr);

        if (w.example_sentence) {
          const ex = document.createElement('div');
          ex.style.fontSize = '11px';
          ex.style.color = '#94A3B8';
          ex.style.fontStyle = 'italic';
          ex.style.marginTop = '4px';
          ex.textContent = `"${w.example_sentence}"`;
          li.appendChild(ex);
        }

        wordList.appendChild(li);
      });
    } catch (err) {
      loadingWords.style.display = 'none';
      wordList.innerHTML = `<li class="error-msg">Liste alınamadı: ${err.message}</li>`;
    }
  }
});
