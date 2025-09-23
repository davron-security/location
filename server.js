// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const fetch = global.fetch || require('node-fetch'); // node18 da global.fetch bor

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID  = process.env.CHAT_ID;

if (!BOT_TOKEN || !CHAT_ID) {
  console.error('Iltimos .env ga BOT_TOKEN va CHAT_ID qo\'ying');
  process.exit(1);
}

app.post('/api/location', async (req, res) => {
  try {
    const { latitude, longitude, consent, timestamp } = req.body;
    if (!consent) return res.status(400).json({ error: 'No consent' });
    const lat = Number(latitude), lon = Number(longitude);
    if (!isFinite(lat) || !isFinite(lon)) return res.status(400).json({ error: 'Invalid coordinates' });

    // 1) Telegram sendLocation (map pin)
    const sendLocationUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendLocation`;
    const locParams = new URLSearchParams({ chat_id: CHAT_ID, latitude: String(lat), longitude: String(lon) });
    const locResp = await fetch(sendLocationUrl, { method: 'POST', body: locParams });
    const locJson = await locResp.json();

    if (!locJson.ok) {
      console.error('Telegram sendLocation error:', locJson);
      return res.status(500).json({ error: 'Telegram sendLocation failed', details: locJson });
    }

    // 2) Telegram sendMessage — Google Maps link + info
    const mapsLink = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
    const text = `New location received:\n${mapsLink}\nTimestamp: ${timestamp || new Date().toISOString()}`;
    const sendMsgUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const msgParams = new URLSearchParams({ chat_id: CHAT_ID, text });
    const msgResp = await fetch(sendMsgUrl, { method: 'POST', body: msgParams });
    const msgJson = await msgResp.json();

    if (!msgJson.ok) {
      console.error('Telegram sendMessage error:', msgJson);
      // lekin avvalgi sendLocation muvaffaqiyatli bo'lsa, bu faqat logga tushadi
    }

    // (ixtiyoriy) minimal server log — real loyihada ma'lumotlarni muhofaza qiling va uzoq saqlamang
    console.log('Location -> Telegram:', lat, lon);

    res.json({ ok: true, telegramLocation: locJson.result ? true : false, telegramMessage: msgJson.ok ? true : false });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error', message: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server ${PORT} portda ishlayapti`));
