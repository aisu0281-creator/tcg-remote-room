import { useState } from 'react';
import {
  LiveKitRoom,
  VideoConference
} from '@livekit/components-react';

type Connection = { token: string; serverUrl: string };

export default function App() {
  const [roomName, setRoomName] = useState('friends-room');
  const [displayName, setDisplayName] = useState('');
  const [connection, setConnection] = useState<Connection | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function joinRoom(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);

    const safeRoom = roomName.trim();
    const safeName = displayName.trim();
    if (!safeName) {
      setError('表示名を入力してください。');
      setBusy(false);
      return;
    }

    try {
      const response = await fetch('https://tcg-remote-room.onrender.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room: safeRoom,
          identity: `${safeName}-${crypto.randomUUID().slice(0, 8)}`,
          name: safeName
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '接続に失敗しました。');
      setConnection(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '接続に失敗しました。');
    } finally {
      setBusy(false);
    }
  }

  if (connection) {
    return (
      <main className="room-page">
        <header className="room-header">
          <div>
            <div className="eyebrow">TCG REMOTE PLAY</div>
            <h1>{roomName}</h1>
            <p>カメラを盤面の真上に固定すると、カードが見やすくなります。</p>
          </div>
          <button className="secondary-button" onClick={() => setConnection(null)}>
            退出する
          </button>
        </header>
        <div className="notice">
          初回はブラウザのカメラ・マイク使用許可が必要です。映像が出ない場合は、下の設定ボタンからカメラを選択してください。
        </div>
        <LiveKitRoom
          serverUrl={connection.serverUrl}
          token={connection.token}
          connect={true}
          video={true}
          audio={true}
          options={{ adaptiveStream: true, dynacast: true }}
          onError={(e) => setError(e.message)}
        >
          <div className="conference-shell">
            <VideoConference />
          </div>
        </LiveKitRoom>
        {error && <p className="error">{error}</p>}
      </main>
    );
  }

  return (
    <main className="landing">
      <section className="hero">
        <div className="eyebrow">PHYSICAL TCG · REMOTE ROOM</div>
        <h1>いつものカードで、<br /><span>どこからでも対戦。</span></h1>
        <p className="intro">
          盤面カメラ・ボイスチャット・テキストチャットをひとつのルームに。
          PC、iPhone、Androidのブラウザから参加できます。
        </p>
        <form className="join-card" onSubmit={joinRoom}>
          <label>
            ルーム名
            <input
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              minLength={3}
              maxLength={40}
              pattern="[a-zA-Z0-9_-]+"
              required
            />
            <small>友達にも同じルーム名を伝えてください（英数字、-、_）。</small>
          </label>
          <label>
            表示名
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="例：プレイヤーA"
              maxLength={40}
              required
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="primary-button" disabled={busy}>
            {busy ? '接続準備中…' : 'ルームに参加する'}
          </button>
        </form>
        <div className="features">
          <span>● カメラ映像</span>
          <span>● 双方向ボイス</span>
          <span>● テキストチャット</span>
        </div>
      </section>
      <footer>試作版 · 友達とのテスト用</footer>
    </main>
  );
}
