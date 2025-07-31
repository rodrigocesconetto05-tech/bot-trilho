const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode');

const gruposMonitorados = [
    'Anotações Aulas',
    'Plantão - Forquilhinha',
    'Meus Materiais'
];

const padroesNegar = [/*... (mesmos que você já usa, pode colar aqui) ...*/];

const padraoPego = new RegExp([
    'pass(o|ando)?(\\s+(meu|o))?(\\s+plant[aã]o)?(\\s+(hoje|amanh[aã]|dia\\s+\\d{1,2}|noturno|diurno|\\d{1,2}[h:]\\d{2}))?',
    'algu[eé]m\\s+(pode|consegue|quer|topa|dispon[ié]vel|assume)?\\s*(fazer|pegar|cobrir|assumir)\\s*((meu|o)?\\s*plant[aã]o)?\\s*(hoje|amanh[aã]|dia\\s+\\d{1,2}|noturno|diurno|\\d{1,2}[h:]\\d{2})?',
    'algu[eé]m\\s+(dispon[ié]vel|pra|para)?\\s*(fazer|assumir|cobrir)\\s*(plant[aã]o)?\\s*(hoje|amanh[aã]|dia\\s+\\d{1,2}|noturno|diurno)',
    'quem\\s+(pode|consegue|topa)\\s*(fazer|cobrir|pegar|assumir)\\s*(plant[aã]o)?\\s*(hoje|amanh[aã]|dia\\s+\\d{1,2}|noturno|diurno)'
].join('|'), 'i');

const padraoReforco = /refor[cç]o|reforcar|algu[éé]m pode ajudar|precisa de ajuda|procura refor[cç]o|dividir plant[aã]o|algu[éé]m ajuda|precisa de refor[cç]o/i;

function deveResponder(msg) {
    const texto = msg.toLowerCase();
    const mencaoAlvo = /(para|pra|pro|com)\s+(@?\w+)/i;
    if (texto.includes('passo') && mencaoAlvo.test(texto)) return false;

    if (padraoReforco.test(texto)) return 'Posso';

    if (padraoPego.test(texto)) {
        for (const padrao of padroesNegar) {
            if (padrao.test(texto)) return false;
        }
        return 'Pego';
    }
    return false;
}

const client = new Client({
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', (qr) => {
    qrcode.toString(qr, { type: 'terminal' }, (err, url) => {
        console.log('QR Code para login:\n', url);
    });
});

client.on('ready', () => {
    console.log('Bot conectado e pronto!');
});

client.on('message', async msg => {
    try {
        const chat = await msg.getChat();
        if (chat.isGroup && gruposMonitorados.includes(chat.name)) {
            const resposta = deveResponder(msg.body);
            if (resposta === 'Pego') {
                const mensagens = await chat.fetchMessages({ limit: 50 });
                let ultimaOferta = -1;

                for (let i = mensagens.length - 1; i >= 0; i--) {
                    if (padraoPego.test(mensagens[i].body.toLowerCase())) {
                        ultimaOferta = i;
                        break;
                    }
                }

                if (ultimaOferta === -1) return;

                const depois = mensagens.slice(ultimaOferta + 1);
                const padraoJaResponderam = /\b(pego|peguei|assumo|vou|eu faço|eu pego|eu vou|eu)\b/i;

                if (depois.some(m => padraoJaResponderam.test(m.body))) {
                    console.log('Já responderam após a oferta.');
                    return;
                }
            }

            if (resposta) {
                await chat.sendMessage(resposta);
                console.log(`Resposta enviada no grupo "${chat.name}": ${resposta}`);
            }
        }
    } catch (err) {
        console.error('Erro ao processar mensagem:', err);
    }
});

client.initialize();

