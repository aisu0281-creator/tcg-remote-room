
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import {
  AccessToken,
  TokenVerifier,
  RoomServiceClient,
} from 'livekit-server-sdk';

const app = express();

app.use(cors());
app.use(express.json({ limit: '20kb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    message: 'TCG room token server is running',
  });
});

// 通常のルーム参加トークン
app.post('/api/token', async (req, res) => {
  try {
    const { room, identity, name } = req.body ?? {};

    if (
      typeof room !== 'string' ||
      !/^[a-zA-Z0-9_-]{3,40}$/.test(room) ||
      typeof identity !== 'string' ||
      identity.length < 1 ||
      identity.length > 80 ||
      typeof name !== 'string' ||
      name.length < 1 ||
      name.length > 40
    ) {
      return res.status(400).json({
        error: 'ルーム名・ユーザーID・表示名を確認してください。',
      });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL;

    if (!livekitUrl || !apiKey || !apiSecret) {
      return res.status(500).json({
        error: 'LiveKitの環境変数が設定されていません。',
      });
    }

    const token = new AccessToken(apiKey, apiSecret, {
      identity,
      name,
      ttl: '2h',
    });

    token.addGrant({
      roomJoin: true,
      room,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    res.json({
      token: await token.toJwt(),
      serverUrl: livekitUrl,
    });
  } catch (error) {
    console.error('Token generation error:', error);
    res.status(500).json({
      error: '接続トークンを作成できませんでした。',
    });
  }
});

// 同じルームに接続中の参加者によるマイク強制ミュート
app.post('/api/admin/mute', async (req, res) => {
  try {
    const { requesterToken, room, identity } = req.body ?? {};

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL;

    if (!livekitUrl || !apiKey || !apiSecret) {
      return res.status(500).json({
        error: 'LiveKitの環境変数が設定されていません。',
      });
    }

    if (
      typeof requesterToken !== 'string' ||
      requesterToken.length > 10000 ||
      typeof room !== 'string' ||
      !/^[a-zA-Z0-9_-]{3,40}$/.test(room) ||
      typeof identity !== 'string' ||
      identity.length < 1 ||
      identity.length > 80
    ) {
      return res.status(400).json({
        error: 'リクエストの内容が正しくありません。',
      });
    }

    // 送信された参加トークンの署名と有効期限を検証
    const verifier = new TokenVerifier(apiKey, apiSecret);
    const claims = await verifier.verify(requesterToken);

    const requesterIdentity = claims.sub;
    const tokenRoom = claims.video?.room;

    if (
      typeof requesterIdentity !== 'string' ||
      !requesterIdentity ||
      tokenRoom !== room
    ) {
      return res.status(403).json({
        error: 'このルームからの操作として確認できません。',
      });
    }

    // 自分自身は強制ミュートできない
    if (requesterIdentity === identity) {
      return res.status(400).json({
        error: '自分自身を強制ミュートすることはできません。',
      });
    }

    // LiveKit管理APIの接続先は https:// または http://
    const host = livekitUrl
      .replace(/^wss:/, 'https:')
      .replace(/^ws:/, 'http:');

    const livekit = new RoomServiceClient(
      host,
      apiKey,
      apiSecret
    );

    // 操作者が実際にそのルームへ接続中か確認
    await livekit.getParticipant(room, requesterIdentity);

    // 対象者がそのルームに接続中か確認
    const participant = await livekit.getParticipant(
      room,
      identity
    );

    // マイクのトラックを探す
    const microphone = participant.tracks?.find((track) => {
      const source = String(track.source).toUpperCase();
      return source === '2' || source.includes('MICROPHONE');
    });

    if (!microphone) {
      return res.status(409).json({
        error: '対象者のマイクトラックが見つかりません。マイクがOFFの可能性があります。',
      });
    }

    await livekit.mutePublishedTrack(
      room,
      identity,
      microphone.sid,
      true
    );

    res.json({
      ok: true,
      message: '参加者を強制ミュートしました。',
    });
  } catch (error) {
    // トークンが無効な場合などは操作を拒否
    console.error('Mute request failed:', error);
    res.status(403).json({
      error: '強制ミュートできませんでした。ルームへの接続状態を確認してください。',
    });
  }
});

const port = Number(process.env.PORT || 3001);

app.listen(port, () => {
  console.log(`Token server listening on port ${port}`);
});
