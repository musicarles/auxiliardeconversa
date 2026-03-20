// ==================== CONFIG ====================
let API_KEY = sessionStorage.getItem('sensei_api_key') || '';
let SELECTED_LANG = sessionStorage.getItem('sensei_lang') || 'ja-JP';
let SELECTED_FLAG = sessionStorage.getItem('sensei_flag') || '🇯🇵 Japonès';
const MODEL = 'gemini-3.1-flash-lite-preview';

// ==================== LANGUAGE DATA ====================
const LANGUAGES = {
    'ja-JP': { name: 'Japonès', flag: '🇯🇵', voice: 'ja-JP' },
    'en-US': { name: 'Anglès', flag: '🇬🇧', voice: 'en-US' },
    'es-ES': { name: 'Castellà', flag: '🇪🇸', voice: 'es-ES' },
    'fr-FR': { name: 'Francès', flag: '🇫🇷', voice: 'fr-FR' },
    'de-DE': { name: 'Alemany', flag: '🇩🇪', voice: 'de-DE' },
    'it-IT': { name: 'Italià', flag: '🇮🇹', voice: 'it-IT' },
    'pt-BR': { name: 'Portugués', flag: '🇧🇷', voice: 'pt-BR' },
    'zh-CN': { name: 'Xinès', flag: '🇨🇳', voice: 'zh-CN' },
    'ko-KR': { name: 'Coreà', flag: '🇰🇷', voice: 'ko-KR' },
    'ru-RU': { name: 'Rus', flag: '🇷🇺', voice: 'ru-RU' }
};

// ==================== LOGIN ====================
function verificarClau() {
    const clauInput = document.getElementById('apiKeyInput');
    const idiomaSelect = document.getElementById('idiomaSelect');
    const error = document.getElementById('loginError');
    
    const clau = clauInput.value.trim();
    const idioma = idiomaSelect.value;
    
    if (!clau || !clau.startsWith('AIza')) {
        error.style.display = 'block';
        return;
    }
    
    API_KEY = clau;
    SELECTED_LANG = idioma;
    SELECTED_FLAG = idiomaSelect.options[idiomaSelect.selectedIndex].text;
    
    sessionStorage.setItem('sensei_api_key', clau);
    sessionStorage.setItem('sensei_lang', idioma);
    sessionStorage.setItem('sensei_flag', SELECTED_FLAG);
    
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('langBadge').textContent = SELECTED_FLAG;
}

document.getElementById('apiKeyInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') verificarClau();
});

if (API_KEY) {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('langBadge').textContent = SELECTED_FLAG;
}

// ==================== STATE ====================
let carregant = false;
let conversacioIA = JSON.parse(localStorage.getItem("chat")) || [];
let frasesAprendidas = JSON.parse(localStorage.getItem("frases")) || [];

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

// ==================== UI FUNCTIONS ====================
function afegirMissatge(role, text) {
    const div = document.createElement('div');
    div.className = `message ${role === 'user' ? 'user' : 'sensei'}`;
    
    if (role === 'sensei') {
        const langData = LANGUAGES[SELECTED_LANG];
        div.innerHTML = `<div class="sender">${langData.flag} ${langData.name} Sensei</div>${text}`;
    } else {
        div.innerHTML = text;
    }
    
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
    return div;
}

function setStatus(t) { status.innerText = t; }

function crearPhraseCard(frase) {
    const card = document.createElement('div');
    card.className = 'phrase-card';
    card.innerHTML = `
        <div class="phrase-original">${frase.original}</div>
        <div class="phrase-translation">${frase.traduccion}</div>
    `;
    
    card.onclick = () => {
        const u = new SpeechSynthesisUtterance(frase.original);
        u.lang = SELECTED_LANG;
        u.rate = parseFloat(velocitat.value);
        speechSynthesis.speak(u);
    };
    
    phrases.appendChild(card);
}

frasesAprendidas.forEach(crearPhraseCard);

// ==================== PROMPT ====================
function promptSistema() {
    const nivellVal = nivell.value;
    const langData = LANGUAGES[SELECTED_LANG];
    
    let txt = `Ets un professor de ${langData.name} molt simpàtic i pacient. `;
    txt += "Respostes curtes i clares. Corregeix errors amb tacte. ";
    txt += "Acaba sempre amb una pregunta per mantenir la conversa. ";
    txt += " Quan ensenyis frases noves, posa-les en format: **frase original | traducció català | nota breu** ";
    txt += " AL FINAL, afegeix una línia [VEU] seguida de text en l'idioma que es pugui llegir en veu alta:";
    
    if (nivellVal === 'principiant') {
        txt += ` Utilitza català simple i ${langData.name} bàsic. Explica el significat.`;
    } else if (nivellVal === 'intermedi') {
        txt += ` Barreja ${langData.name} amb explicacions en català.`;
    } else {
        txt += ` Principalment ${langData.name} natural, mínimes explicacions en català.`;
    }
    
    return txt;
}

// ==================== AI ====================
async function obtenirResposta() {
    if (carregant) return;
    carregant = true;

    const bubble = afegirMissatge('sensei', 'Pensant...');
    bubble.classList.add('thinking');
    setStatus("Conectant...");

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
            const langData = LANGUAGES[SELECTED_LANG];
            bubble.innerHTML = `<div class="sender">${langData.flag} ${langData.name} Sensei</div>Masses peticions! Esperem... 😅`;
            setStatus("Quota excedida");
            carregant = false;
            return;
        }

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No sé què respondre... 😅";

        const linies = text.split('\n');
        const perMostrar = linies.filter(l => !l.startsWith('[VEU]')).join('\n');
        const perVoz = linies.find(l => l.startsWith('[VEU]'))?.replace('[VEU]', '').trim() || perMostrar;

        const langData = LANGUAGES[SELECTED_LANG];
        bubble.innerHTML = `<div class="sender">${langData.flag} ${langData.name} Sensei</div>${perMostrar}`;

        conversacioIA.push({ role: "model", parts: [{ text: perMostrar }] });
        localStorage.setItem("chat", JSON.stringify(conversacioIA));

        parlar(perVoz);
        extraerFrases(perMostrar);
        setStatus("✨");

    } catch(e) {
        console.error(e);
        const langData = LANGUAGES[SELECTED_LANG];
        bubble.innerHTML = `<div class="sender">${langData.flag} ${langData.name} Sensei</div>Oh no! Error de connexió 😢`;
        setStatus("Error");
    }

    carregant = false;
}

// ==================== VOICE ====================
function parlar(text) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = SELECTED_LANG;
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
                original: parts[0] || '',
                traduccion: parts[1] || '',
                explicacion: parts[2] || ''
            };
            
            if (!frasesAprendidas.some(f => f.original === frase.original)) {
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

input.addEventListener("keydown", function(e) {
    if (e.key === "Enter") {
        const text = this.value.trim();
        if (text) {
            enviar(text);
            this.value = "";
        }
    }
});

document.querySelectorAll('[data-tema]').forEach(btn => {
    btn.onclick = () => enviar(`Parlem sobre ${btn.dataset.tema}`);
});

// Mic
let escoltant = false;
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.lang = SELECTED_LANG;

mic.onclick = () => {
    if (escoltant) return;
    recognition.lang = SELECTED_LANG;
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

// Logout
logout.onclick = () => {
    sessionStorage.removeItem('sensei_api_key');
    sessionStorage.removeItem('sensei_lang');
    sessionStorage.removeItem('sensei_flag');
    location.reload();
};

// Export PDF
exportar.onclick = () => {
    const langData = LANGUAGES[SELECTED_LANG];
    
    let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 50px; max-width: 800px; margin: 0 auto; }
                h1 { text-align: center; color: #6c5ce7; border-bottom: 2px solid #a29bfe; padding-bottom: 20px; margin-bottom: 30px; }
                .frase { margin-bottom: 25px; padding: 20px; background: #f8f9fa; border-radius: 12px; border-left: 4px solid #6c5ce7; }
                .original { font-size: 22px; margin-bottom: 8px; color: #2d3436; }
                .traduccion { color: #636e72; margin-bottom: 5px; }
                .explicacion { color: #999; font-size: 12px; font-style: italic; }
                .fecha { text-align: center; color: #999; margin-top: 40px; font-size: 14px; }
            </style>
        </head>
        <body>
            <h1>🌐 Les Meves Frases en ${langData.name}</h1>
            <p class="fecha">Generat per Lingua Sensei - ${new Date().toLocaleDateString('ca-ES')}</p>
    `;
    
    frasesAprendidas.forEach(f => {
        html += `
            <div class="frase">
                <div class="original">${f.original}</div>
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
