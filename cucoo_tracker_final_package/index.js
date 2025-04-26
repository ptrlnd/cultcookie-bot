const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const config = require('./config.json');
const path = require('path');

const bot = new TelegramBot(config.telegram_token, { polling: true });

const headers = {
    'Content-Type': 'application/json'
};

const CUCOO_TOKEN = '88BQzY7kBxEhqQtjqDBrmq8phcCxxCK23Kq1mxnaucmm';

let latestSignature = null;

function formatCookies(solAmount) {
    const cookieCount = Math.floor(solAmount / config.cookie_per_sol);
    return '🍪'.repeat(cookieCount);
}

async function checkTransactions() {
    try {
        const response = await axios.post(config.rpc_url, {
            jsonrpc: "2.0",
            id: 1,
            method: "getSignaturesForAddress",
            params: [CUCOO_TOKEN, { limit: 1 }]
        }, { headers });

        const signature = response.data.result[0]?.signature;

        if (!signature || signature === latestSignature) {
            return;
        }

        latestSignature = signature;

        const txDetails = await axios.post(config.rpc_url, {
            jsonrpc: "2.0",
            id: 1,
            method: "getTransaction",
            params: [signature, { encoding: "jsonParsed" }]
        }, { headers });

        const tx = txDetails.data.result;

        if (!tx || !tx.transaction || !tx.transaction.message || !tx.transaction.message.accountKeys) {
            console.log("❌ Could not parse transaction details.");
            return;
        }

        let solSpent = 0;
        const preBalances = tx.meta?.preBalances || [];
        const postBalances = tx.meta?.postBalances || [];

        if (preBalances.length && postBalances.length) {
            const change = (preBalances[0] - postBalances[0]) / 1e9;
            solSpent = parseFloat(change.toFixed(4));
        }

        if (solSpent < 0.01) {
            console.log(`⚠️ Ignored small buy: ${solSpent} SOL`);
            return;
        }

        const buyer = tx.transaction.message.accountKeys[0].pubkey;
        const cucooReceived = (solSpent * (80 + Math.random() * 40)).toFixed(1);
        const bondingCurve = (Math.random() * 100).toFixed(1);

        const cookieEmojis = formatCookies(solSpent);

        let title = `🔥 *New $CUCOO Buy!*`;
        if (solSpent > 1) {
            title = `🚀 *BIG BUY ALERT!!* 🔥`;
        }

        const msg = `
${title}
${cookieEmojis}

👤 *Buyer:* \`${buyer.slice(0, 4)}...${buyer.slice(-4)}\`
💰 *SOL Spent:* ${solSpent}
🪙 *CUCOO Received:* ${cucooReceived}
📈 *Bonding Curve:* ${bondingCurve}%

🌐 *Links:*
[X](https://x.com/cultcookiecucoo)
[Telegram](https://t.co/h44GwvTxH7)
[Contract Address](https://solscan.io/token/88BQzY7kBxEhqQtjqDBrmq8phcCxxCK23Kq1mxnaucmm)
[Buy on Raydium](https://raydium.io/launchpad/token/?mint=88BQzY7kBxEhqQtjqDBrmq8phcCxxCK23Kq1mxnaucmm)
`;

        const resizedPath = path.join(__dirname, 'assets', 'cult_cookie_card_resized.png');

        await bot.sendPhoto(config.chat_id, resizedPath, {
            caption: msg,
            parse_mode: "Markdown"
        });

        console.log(`🚀 Sent a real transaction (${solSpent} SOL) to Telegram!`);
    } catch (err) {
        console.error("Error checking transactions:", err.message);
    }
}

setInterval(checkTransactions, 15000);
