import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { AccessToken } from 'livekit-server-sdk';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, message: 'TCG room token server is running' });
});

app.post('/api/token', async (req, res) => {
  try {
    const { room, identity, name } = req.body ?? {};

    // 入力チェック：空のルーム名などを拒否
    if (
      typeof room !== 'string' || !/^[a-zA-Z0-9_-]{3,40}$/.test(room) ||
      typeof identity !== 'string' || identity.length < 1 || identity.length > 80 ||
      typeof name !== 'string' || name.length < 1 || name.length > 40
    ) {
      return res.status(400).json({ error: 'ルーム名・ユーザーID・表示名を確認してください。' });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    if (!process.env.LIVEKIT_URL || !apiKey || !apiSecret) {
      return res.status(500).json({ error: '.envにLiveKitの接続情報を設定してください。' });
    }

    const token = new AccessToken(apiKey, apiSecret, {
      identity,
      name,
      ttl: '2h'
    });

    // 試作版：参加者は全員、映像・音声を送受信できます。
    // 公開運用では、ルームのパスワードや招待コード等の認証を追加してください。
    token.addGrant({
      roomJoin: true,
      room,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true
    });

    res.json({ token: await token.toJwt(), serverUrl: process.env.LIVEKIT_URL });
  } catch (error) {
    console.error('Token generation error:', error);
    res.status(500).json({ error: '接続トークンを作成できませんでした。' });
  }
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  console.log(`Token server: http://localhost:${port}`);
});
