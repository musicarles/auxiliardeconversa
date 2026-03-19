// ==================== CONFIG ====================
let API_KEY = sessionStorage.getItem('sensei_api_key') || '';
const MODEL = 'gemini-3.1-flash-lite-preview';

// ==================== LOGIN ====================
function verificarClau() {
    const input = document.getElementById('apiKeyInput');
    const clau = input.value.trim();
    const error = document.getElementById('loginError');
    
    if (!clau || !clau.startsWith('AIza')) {
        error.style.display = 'block';
        return;
    }
    
    API_KEY = clau;
    sessionStorage.setItem('sensei_api_key', clau);
    document.getElementById('loginScreen').classList.add('hidden');
}

document.getElementById('apiKeyInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') verificarClau();
});

// Verificar si ja té clau guardada
if (API_KEY) {
    document.getElementById('loginScreen').classList.add('hidden');
}

// ==================== STATE ====================
let carregant = false;
let conversacioIA = JSON.parse(localStorage.getItem("chat")) || [];
let frasesAprendidas = JSON.parse(localStorage.getItem("frases")) || [];

// ==================== SAKURA EFFECT ====================
function crearPetales() {
    const container = document.getElementById('sakura');
    if (!container) return;
    
    const colors = ['#ffb7c5', '#ffd1dc', '#ffe4e8', '#fff0f3'];
    
    for (let i = 0; i < 15; i++) {
        const petal = document.createElement('div');
        petal.className = 'petal';
        petal.style.left = Math.random() * 100 + '%';
        petal.style.animationDuration = (8 + Math.random() * 8) + 's';
        petal.style.animationDelay = Math.random() * 10 + 's';
        petal.style.background = colors[Math.floor(Math.random() * colors.length)];
        petal.style.width = (8 + Math.random() * 8) + 'px';
        petal.style.height = petal.style.width;
        container.appendChild(petal);
    }
}
crearPetales();

// ==================== DOM ELEMENTS ====================
const chat = document.getElementById('chat');
const input = document.getElementById('input');
const mic = document.getElementById('mic');
const status = document.getElementById('status');
const nivell = document.getElementById('nivell');
const velocitat = document.getElementById('velocitat');
const netejar = document.getElementById('netejar');
const exportar = document.getElementById('exportar');
const logout = document.getElementById('logout');
const phrases = document.getElementById('phrases');

// Logout - canvi de clau API
logout.onclick = () => {
    sessionStorage.removeItem('sensei_api_key');
    location.reload();
};

// ==================== UI FUNCTIONS ====================
function afegirMissatge(role, text) {
    const div = document.createElement('div');
    div.className = `message ${role === 'user' ? 'user' : 'sensei'}`;
    
    if (role === 'sensei') {
        div.innerHTML = `<div class="sender">🌸 Sensei</div>${text}`;
    } else {
        div.innerHTML = text;
    }
    
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
    return div;
}

function setStatus(t) {
    status.innerText = t;
}

function crearPhraseCard(frase) {
    const card = document.createElement('div');
    card.className = 'phrase-card';
    card.innerHTML = `
        <div class="phrase-kanji">${frase.kanji}</div>
        <div class="phrase-romaji">${frase.romaji}</div>
        <div class="phrase-translation">${frase.traduccion}</div>
    `;
    
    card.onclick = () => {
        const u = new SpeechSynthesisUtterance(frase.romaji);
        u.lang = "ja-JP";
        u.rate = parseFloat(velocitat.value);
        speechSynthesis.speak(u);
    };
    
    phrases.appendChild(card);
}

// Load saved phrases
frasesAprendidas.forEach(crearPhraseCard);

// ==================== PROMPT ====================
function promptSistema() {
    const nivellVal = nivell.value;
    let txt = "Ets un professor de japonès molt simpàtic i pacient. ";
    txt += "Respostes curtes i clares. Corregeix errors amb tacte. ";
    txt += "Acaba sempre amb una pregunta per mantenir la conversa. ";
    txt += " Quan ensenyis frases noves, posa-les en format: **kanji | romaji | traducció | nota breu** ";
    txt += " AL FINAL, afegeix una línia [VEU] seguida de japonès fluid per llegir en veu alta:";
    
    if (nivellVal === 'principiant') {
        txt += " Utilitza català simple i romaji. Explica el significat.";
    } else if (nivellVal === 'intermedi') {
        txt += " Barreja japonès amb explicacions en català.";
    } else {
        txt += " Principalment japonès natural, mínimes explicacions en català.";
    }
    
    return txt;
}

// ==================== AI ====================
async function obtenirResposta() {
    if (carregant) return;
    carregant = true;

    const bubble = afegirMissatge('sensei', 'Pensant...');
    bubble.classList.add('thinking');
    setStatus("Conectant amb Sakura...");

    try {
        const history = conversacioIA.slice(-6, -1)
            .map(m => `${m.role === 'user' ? 'Tu' : 'Sensei'}: ${m.parts[0].text}`)
            .join('\n');
        
        const ultim = conversacioIA[conversacioIA.length - 1];
        const promptText = `${promptSistema()}\n\n${history}\n\nTu: ${ultim.parts[0].text}`;

        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: promptText }] }],
                    generationConfig: { temperature: 0.7, maxOutputTokens: 256 }
                })
            }
        );

        if (res.status === 429) {
            bubble.innerHTML = '<div class="sender">🌸 Sensei</div>Masses peticions! Esperem una estona... 😅';
            setStatus("Quota excedida");
            carregant = false;
            return;
        }

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No sé què respondre... 😅";

        const linies = text.split('\n');
        const perMostrar = linies.filter(l => !l.startsWith('[VEU]')).join('\n');
        const perVoz = linies.find(l => l.startsWith('[VEU]'))?.replace('[VEU]', '').trim() || perMostrar;

        bubble.innerHTML = `<div class="sender">🌸 Sensei</div>${perMostrar}`;

        conversacioIA.push({ role: "model", parts: [{ text: perMostrar }] });
        localStorage.setItem("chat", JSON.stringify(conversacioIA));

        parlar(perVoz);
        extraerFrases(perMostrar);
        setStatus("✨");

    } catch(e) {
        console.error(e);
        bubble.innerHTML = '<div class="sender">🌸 Sensei</div>Oh no! Error de connexió 😢';
        setStatus("Error");
    }

    carregant = false;
}

// ==================== VOICE ====================
function parlar(text) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ja-JP";
    u.rate = parseFloat(velocitat.value);
    speechSynthesis.speak(u);
}

function extraerFrases(text) {
    const regex = /\*\*([^*]+)\*\*/g;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
        const parts = match[1].split('|').map(p => p.trim());
        
        if (parts.length >= 2) {
            const frase = {
                kanji: parts[0] || '',
                romaji: parts[1] || '',
                traduccion: parts[2] || '',
                explicacion: parts[3] || ''
            };
            
            if (!frasesAprendidas.some(f => f.kanji === frase.kanji)) {
                frasesAprendidas.push(frase);
                crearPhraseCard(frase);
                localStorage.setItem("frases", JSON.stringify(frasesAprendidas));
            }
        }
    }
}

// ==================== INPUT ====================
function enviar(text) {
    if (!text || carregant) return;

    afegirMissatge('user', text);
    conversacioIA.push({ role: "user", parts: [{ text }] });
    localStorage.setItem("chat", JSON.stringify(conversacioIA));

    obtenirResposta();
}

// Enter to send
input.addEventListener("keydown", function(e) {
    if (e.key === "Enter") {
        const text = this.value.trim();
        if (text) {
            enviar(text);
            this.value = "";
        }
    }
});

// Topic buttons
document.querySelectorAll('[data-tema]').forEach(btn => {
    btn.onclick = () => enviar(`Parlem sobre ${btn.dataset.tema}`);
});

// Mic
let escoltant = false;
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.lang = "ja-JP";

mic.onclick = () => {
    if (escoltant) return;
    recognition.start();
    escoltant = true;
    mic.classList.add('active');
};

recognition.onresult = e => enviar(e.results[0][0].transcript);
recognition.onend = () => {
    escoltant = false;
    mic.classList.remove('active');
};

// Clear
netejar.onclick = () => {
    conversacioIA = [];
    frasesAprendidas = [];
    localStorage.removeItem("chat");
    localStorage.removeItem("frases");
    chat.innerHTML = '';
    phrases.innerHTML = '';
};

// Export PDF
exportar.onclick = () => {
    let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { 
                    font-family: 'Hiragino Mincho ProN', 'Yu Mincho', serif; 
                    padding: 50px; 
                    max-width: 800px;
                    margin: 0 auto;
                }
                h1 { 
                    text-align: center; 
                    color: #d4a574; 
                    border-bottom: 2px solid #ffb7c5;
                    padding-bottom: 20px;
                    margin-bottom: 30px;
                }
                .frase { 
                    margin-bottom: 30px; 
                    padding: 20px;
                    background: #faf8f5;
                    border-radius: 12px;
                    border-left: 4px solid #ffb7c5;
                }
                .kanji { 
                    font-size: 28px; 
                    margin-bottom: 8px;
                }
                .romaji { 
                    color: #d4a574;
                    font-style: italic;
                    margin-bottom: 5px;
                }
                .traduccion { 
                    color: #666;
                    margin-bottom: 5px;
                }
                .explicacion { 
                    color: #999; 
                    font-size: 12px;
                }
                .fecha {
                    text-align: center;
                    color: #999;
                    margin-top: 40px;
                }
            </style>
        </head>
        <body>
            <h1>🌸 Les Meves Frases Japoneses</h1>
            <p class="fecha">Generat per Sensei IA - ${new Date().toLocaleDateString('ca-ES')}</p>
    `;
    
    frasesAprendidas.forEach(f => {
        html += `
            <div class="frase">
                <div class="kanji">${f.kanji}</div>
                <div class="romaji">${f.romaji}</div>
                <div class="traduccion">${f.traduccion}</div>
                ${f.explicacion ? `<div class="explicacion">${f.explicacion}</div>` : ''}
            </div>
        `;
    });
    
    if (frasesAprendidas.length === 0) {
        html += '<p style="text-align:center;color:#999;">Encara no has après cap frase! 😢</p>';
    }
    
    html += '</body></html>';
    
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.print();
};
