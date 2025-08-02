const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const express = require('express');

const app = express();
let ultimoQRCode = '';

const gruposMonitorados = [
    'Anotações Aulas',
    'Plantão - Forquilhinha',
    'Meus Materiais'
];

const padroesNegar = [
    /pass(ei|ou|ando)?\s+(meu|o)?\s*(plant[aã]o)?\s*(do|da|das)?\s*\d{1,2}([h:-]\d{1,2})?\s*(para|pra|pro|com)\s+(@?\w+)/i,
    /pass(ei|ou|ando)?\s+(o|meu)?\s*plant[aã]o\s+(para|pra|pro|com)\s+@?\w+/i,
    /pass(ei|ou|ando)?\s+(na|no|em|a[ií]|l[\u00e1a])/i,
    /\bpegou\b.*(@?\w+)?/i,
    /plant[aã]o.*(ficou|vai|será|pego|pegou)/i,
    /\bficou com\b.*/i,
    /passado para\s+@?\w+/i,
    /\bficou (pra|pro)\b.*/i,
    /\bj[aá] (foi|peguei|pegaram|passaram|vai|vai fazer|vai cobrir)\b/i,
    /algu[eé]m (pegou|vai fazer|ficou com)/i,
    /\bdivid[ií] com\b.*/i,
    /n[oã]o vou poder.*/i,
    /vai fazer o meu.*(plant[aã]o)?/i,
    /@\w+ (vai fazer|ficou|pegou|assumiu)/i,
    /pass(ei|ou|ando)?\s*(plant[aã]o)?\s*(do|dia)?\s*\d{1,2}(\s+)?(para|pra|pro|com)\s+@?\w+/i,
    /pass(ei|ou|ando)?\s+(das|da|do)?\s*\d{1,2}[-h:]\d{1,2}\s+(para|pra|pro|com)\s+(@?\w+)/i
];

const padraoPego = new RegExp([
    'pass(o|ando)?(\\s+(meu|o))?(\\s+plant[aã]o)?(\\s+(hoje|amanh[aã]|dia\\s+\\d{1,2}|noturno|diurno|\\d{1,2}[h:]\\d{2}))?',
    'algu[eé]m\\s+(pode|consegue|quer|topa|dispon[ié]vel|assume)?\\s*(fazer|pegar|cobrir|assumir)\\s*((meu|o)?\\s*plant[aã]o)?\\s*(hoje|amanh[aã]|dia\\s+\\d{1,2}|noturno|diurno|\\d{1,2}[h:]\\d{2})?',
    'algu[eé]m\\s+(dispon[ié]vel|pra|para)?\\s*(fazer|assumir|cobrir)\\s*(plant[aã]o)?\\s*(hoje|amanh[aã]|dia\\s+\\d{1,2}|noturno|diurno)',
    'quem\\s+(pode|consegue|topa)\\s*(fazer|cobrir|pegar|assumir)\\s*(plant[aã]o)?\\s*(hoje|amanh[aã]|dia\\s+\\d{1,2}|noturno|diurno)'
].join('|'), 'i');

const padraoReforco = /\b(refor[cç]o|reforcar|precisa de refor[cç]o|ajuda com refor[cç]o|algu[eé]m pode ajudar|algu[eé]m ajuda|dividir plant[aã]o)\b.*(hoje|amanh[aã]|dia \d{1,2})?/i;

function deveResponder(msg) {
    const texto = msg.toLowerCase();
    const mencaoAlvo = /(para|pra|pro|com)\s+(@?\w+)/i;
    if (texto.includes('passo') && mencaoAlvo.test(texto)) return false;

    if (padraoReforco.test(texto)) {
        if (/(\bprecisa\b|\bdividir\b|\bajuda\b|algu[eé]m.*(ajuda|refor[cç]o)|ajudar|consegue ajudar)/.test(texto)) return 'Posso';
        return false;
    }

    if (padraoPego.test(texto)) {
        for (const padrao of padroesNegar) {
            if (padrao.test(texto)) return false;
        }
        return 'Pego';
    }

    return false;
}

function extrairEColarMensagemOriginal(textoOriginal) {
    const linhas = textoOriginal.split('\n');
    let contagem = 0;
    const resultado = linhas.map(linha => {
        if (/\d{1,2}\/\d{1,2}.*\d{1,2}[-h:]\d{2}h/.test(linha) && contagem < 2) {
            contagem++;
            return linha + ' (Rodrigo)';
        }
        return linha;
    }).join('\n');
    return resultado;
}

function contemPadraoCopiaCola(texto) {
    const padraoCabecalho = /(plant[aõ]es?|escalas?|dispon[ií]veis?).*\b(pa|hospital|upa)?\b/i;
    const padraoLinhaDataHorario = /\d{1,2}\/\d{1,2}.*?(\d{1,2}([h:-]\d{2})|às \d{1,2}h)/i;
    return padraoCabecalho.test(texto) && padraoLinhaDataHorario.test(texto);
}

const client = new Client({
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', async (qr) => {
    ultimoQRCode = await qrcode.toDataURL(qr);
    console.log('QR Code gerado! Acesse /qr para escanear.');
});

client.on('ready', () => {
    console.log('Bot conectado e pronto!');
});

client.on('message', async msg => {
    try {
        const chat = await msg.getChat();
        if (chat.isGroup && gruposMonitorados.includes(chat.name)) {
            const textoMsg = msg.body.toLowerCase();
            if (contemPadraoCopiaCola(textoMsg)) {
                const resposta = extrairEColarMensagemOriginal(msg.body);
                await chat.sendMessage(resposta);
                return;
            }

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
                    console.log('Já houve resposta após a oferta.');
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

app.get('/qr', (req, res) => {
    if (!ultimoQRCode) return res.send('QR ainda não gerado...');
    res.send(`
        <html><body style="text-align:center">
        <h2>Escaneie o QR abaixo com o WhatsApp</h2>
        <img src="${ultimoQRCode}" width="300" height="300"/>
        </body></html>
    `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor web rodando em http://localhost:${PORT}/qr`);
});

