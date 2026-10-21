
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import {
  AccessToken,
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

// 管理者による参加者のマイク強制ミュート
app.post('/api/admin/mute', async (req, res) => {
  try {
    const { adminKey, room, identity } = req.body ?? {};

    const expectedKey = process.env.ROOM_ADMIN_KEY;
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL;

    if (!expectedKey) {
      return res.status(503).json({
        error: '管理者キーがRenderに設定されていません。',
      });
    }

    if (
      typeof adminKey !== 'string' ||
      adminKey.length !== expectedKey.length ||
      adminKey !== expectedKey
    ) {
      return res.status(403).json({
        error: '管理者キーが正しくありません。',
      });
    }

    if (
      typeof room !== 'string' ||
      !/^[a-zA-Z0-9_-]{3,40}$/.test(room) ||
      typeof identity !== 'string' ||
      identity.length < 1 ||
      identity.length > 80
    ) {
      return res.status(400).json({
        error: 'ルーム名または参加者IDが正しくありません。',
      });
    }

    if (!livekitUrl || !apiKey || !apiSecret) {
      return res.status(500).json({
        error: 'LiveKitの環境変数が設定されていません。',
      });
    }

    // LiveKitの管理APIには wss:// ではなく https:// を使用
    const host = livekitUrl
      .replace(/^wss:/, 'https:')
      .replace(/^ws:/, 'http:');

    const livekit = new RoomServiceClient(
      host,
      apiKey,
      apiSecret
    );

    const participant = await livekit.getParticipant(room, identity);

    // TrackSource.MICROPHONE は通常、数値の2
    const microphone = participant.tracks?.find((track) => {
      const source = String(track.source).toUpperCase();

      return source === '2' || source.includes('MICROPHONE');
    });

    if (!microphone) {
      return res.status(409).json({
        error: '対象者のマイクトラックが見つかりません。',
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
    console.error('Admin mute error:', error);
    res.status(500).json({
      error: '強制ミュートに失敗しました。対象者の状態を確認してください。',
    });
  }
});

const port = Number(process.env.PORT || 3001);

app.listen(port, () => {
  console.log(`Token server listening on port ${port}`);
});
