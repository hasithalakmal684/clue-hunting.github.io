// Dev/QA Clue Hunt — Hard Mode logic
// All clue words and logic live here (not in index.html), so View Source won't reveal them.

document.addEventListener('DOMContentLoaded', function () {

  /*********************************************************************
   * Hard-mode: dynamic clues generated at runtime from a seed.        *
   * - HTML contains no clue words.                                    *
   * - Words are derived from a PRNG seeded from a value in            *
   *   sessionStorage or provided via ?seed= query param.              *
   * - CSS grid is populated at runtime with CSS custom properties.    *
   *   Characters appear only when the player toggles --s to 1.        *
   *********************************************************************/

  // Word list used to randomly choose clues
  const WORDS = [
    'ALPHA','BRAVO','CHARLIE','DELTA','ECHO','FOXTROT','GOLF','HOTEL','INDIA','JULIET',
    'KILO','LIMA','MIKE','NOVEMBER','OSCAR','PAPA','QUEBEC','ROMEO','SIERRA','TANGO',
    'UNIFORM','VICTOR','WHISKEY','XRAY','YANKEE','ZULU','PEN','KEY','GOLD','STEEL',
    'BRIDGE','RIVER','JOIN','PLACE','STEEP'
  ];

  // Simple xorshift32 PRNG seeded by an integer
  function xorshift32(seed){
    let x = seed >>> 0;
    return function(){
      x ^= x << 13; x >>>= 0;
      x ^= x >>> 17; x >>>= 0;
      x ^= x << 5;  x >>>= 0;
      return x / 0xFFFFFFFF;
    };
  }

  // Read or create seed
  function getSeed(){
    const p = new URLSearchParams(location.search);
    let s = p.get('seed');
    if (s) {
      sessionStorage.setItem('clue_seed', s);
    }
    s = sessionStorage.getItem('clue_seed');
    if (!s) {
      s = Math.floor(Math.random() * 1e9).toString(36);
      sessionStorage.setItem('clue_seed', s);
    }
    return s;
  }

  const seed = getSeed();
  const seedLabel = document.getElementById('seedLabel');
  if (seedLabel) seedLabel.textContent = seed;

  // Turn ASCII seed into integer for PRNG
  function seedToInt(str){
    let n = 2166136261 >>> 0; // FNV offset basis
    for (let i = 0; i < str.length; i++) {
      n ^= str.charCodeAt(i);
      n += (n<<1) + (n<<4) + (n<<7) + (n<<8) + (n<<24);
      n >>>= 0;
    }
    return n >>> 0;
  }

  const rand = xorshift32(seedToInt(seed));

  // Determine 10 clue words at runtime
  const CLUE_COUNT = 10;
  const clues = [];
  for (let i = 0; i < CLUE_COUNT; i++) {
    const idx = Math.floor(rand() * WORDS.length);
    clues.push(WORDS[idx]);
  }

  // Create the CSS grid cells
  const grid = document.getElementById('cssGrid');
  const totalCells = 8 * 4; // 4 rows x 8
  const cells = [];
  for (let i = 0; i < totalCells; i++) {
    const el = document.createElement('div');
    el.className = 'css-cell';
    grid.appendChild(el);
    cells.push(el);
  }

  // Helper: map character to visible token
  function charToken(ch){
    if (!ch) return '.';
    const c = ch.toUpperCase();
    if (c >= 'A' && c <= 'Z') return c;
    if (c === '-') return '-';
    return '.';
  }

  // Place clues into CSS cells as custom properties (not visible by default)
  const mapping = [];
  for (let wi = 0; wi < clues.length; wi++) {
    const w = clues[wi];
    const chars = w.split('');
    const len = Math.min(chars.length, 6); // max 6 visible chars per word
    const start = Math.floor(rand() * (totalCells - len));
    mapping.push({ word: w, start, len });

    for (let j = 0; j < len; j++) {
      const cell = cells[start + j];
      const token = charToken(chars[j]);
      cell.style.setProperty('--t', '"' + token + '"');
      const colorCode = '#' + ((Math.floor(rand() * 0xFFFFFF)) >>> 0)
        .toString(16).padStart(6, '0');
      cell.style.setProperty('--c', colorCode);
      cell.style.setProperty('background',
        'linear-gradient(90deg,' + colorCode + ' 0%, rgba(0,0,0,0) 100%)');
      cell.style.setProperty('--s', '0'); // hidden; player must set --s:1
    }
  }

  // Console log + helper
  const consoleLog = document.getElementById('consoleLog');
  function clog(msg){
    console.log(msg);
    if (consoleLog) {
      consoleLog.textContent += '\n' + msg;
    }
  }

  // Console helper API (deliberately does not print words)
  window._clueApi = {
    listMapping: function(){
      console.log(
        'Mapping (start,len) for each word — words remain hidden:',
        mapping.map(m => ({ start: m.start, len: m.len }))
      );
    },
    revealWord: function(index){
      if (index < 0 || index >= mapping.length) {
        console.log('index out of range');
        return;
      }
      const m = mapping[index];
      console.log(
        'Hint: word at index',
        index,
        'has length',
        m.len,
        '— try to reveal cells starting at',
        m.start
      );
    },
    seed: seed,
    cluesMasked: function(){
      return mapping.map(m => ({ start: m.start, len: m.len }));
    },
    // Optional XOR helper if you add any XOR-based clue later
    xor: function(hex, key){
      let out = '';
      for (let i = 0; i < hex.length; i += 2) {
        const encByte = parseInt(hex.substr(i, 2), 16);
        const keyByte = key.charCodeAt((i / 2) % key.length);
        out += String.fromCharCode(encByte ^ keyByte);
      }
      console.log('XOR decode:', out);
      return out;
    }
  };

  clog('Dev API: _clueApi.listMapping(), _clueApi.revealWord(index), _clueApi.xor(hex,key).');
  clog('Use Elements → Styles to toggle --s:1 on .css-cell elements to reveal letters.');

  // UI state & validation
  const stepNum   = document.getElementById('stepNum');
  const inst      = document.getElementById('inst');
  const answer    = document.getElementById('answer');
  const submitBtn = document.getElementById('submit');
  const hintBtn   = document.getElementById('hint');
  const regenBtn  = document.getElementById('regen');
  const finalInput = document.getElementById('finalInput');
  const finalBtn   = document.getElementById('finalBtn');
  const finalMsg   = document.getElementById('finalMsg');
  const hintBox    = document.getElementById('hintBox');

  let current = 1;

  function updateUI(){
    if (stepNum) stepNum.textContent = String(current);
    if (inst) {
      inst.textContent =
        'Step ' + current +
        ': Use the grid and _clueApi to find the word at index ' + (current - 1) + '.';
    }
  }

  function norm(s){
    return (s || '')
      .toString()
      .replace(/[^A-Za-z0-9\-]/g, '')
      .toUpperCase();
  }

  updateUI();

  if (submitBtn) {
    submitBtn.addEventListener('click', function(){
      const val = norm(answer.value);
      const expected = norm(clues[current - 1]);

      if (!val) {
        if (hintBox) hintBox.textContent = 'Please enter an answer.';
        return;
      }

      if (val === expected) {
        clog('Correct — ' + clues[current - 1]);
        current++;
        answer.value = '';

        if (current > CLUE_COUNT) {
          if (finalInput) {
            finalInput.disabled = false;
            finalInput.placeholder = 'Enter final passphrase (words hyphen-separated)';
          }
          if (finalBtn) finalBtn.disabled = false;
          if (inst) inst.textContent = 'All clues found. Enter the final passphrase.';
        } else {
          updateUI();
        }
      } else {
        clog('Incorrect. Reveal the correct cells for this step by toggling --s to 1 in the inspector.');
        if (hintBox) {
          hintBox.textContent = 'Incorrect. Use _clueApi.listMapping() and DevTools on the grid.';
        }
      }
    });
  }

  if (hintBtn) {
    hintBtn.addEventListener('click', function(){
      const m = mapping[current - 1];
      if (!m) return;
      const msg =
        'HINT: word #' + (current - 1) +
        ' occupies cells starting at index ' + m.start +
        ' for length ' + m.len +
        '. Use _clueApi.revealWord(' + (current - 1) + ').';
      clog(msg);
      if (hintBox) hintBox.textContent = msg;
    });
  }

  if (regenBtn) {
    regenBtn.addEventListener('click', function(){
      const ns = Math.floor(Math.random() * 1e9).toString(36);
      sessionStorage.setItem('clue_seed', ns);
      clog('New seed set: ' + ns + ' — reloading...');
      location.reload();
    });
  }

  if (finalBtn) {
    finalBtn.addEventListener('click', function(){
      const given = norm(finalInput.value);
      const expected = norm(clues.join('-'));
      if (given === expected) {
        if (finalMsg) {
          finalMsg.style.color = 'lightgreen';
          finalMsg.textContent = '🎉 Congratulations — you solved the Hard Mode!';
        }
        clog('FINAL: success');
      } else {
        if (finalMsg) {
          finalMsg.style.color = '#ffb4b4';
          finalMsg.textContent =
            'Final passphrase incorrect. Combine all 10 words in order (hyphens allowed).';
        }
        clog('FINAL: incorrect');
      }
    });
  }

  // For testing / debugging: reveal all letters
  window._revealCellsForTesting = function(){
    cells.forEach(c => c.style.setProperty('--s', '1'));
    clog('All cells set to --s:1 for testing (letters will appear).');
  };

});
