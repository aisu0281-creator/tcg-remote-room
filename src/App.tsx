
import { useState } from 'react';
import {
  LiveKitRoom,
  VideoConference,
  useParticipants,
} from '@livekit/components-react';

const API_URL = 'https://tcg-remote-room.onrender.com';

type Connection = {
  token: string;
  serverUrl: string;
  room: string;
  identity: string;
  name: string;
};

export default function App() {
  const [roomName, setRoomName] = useState('friends-room');
  const [displayName, setDisplayName] = useState('');
  const [connection, setConnection] = useState<Connection | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function joinRoom(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    const safeRoom = roomName.trim();
    const safeName = displayName.trim();

    if (!/^[a-zA-Z0-9_-]{3,40}$/.test(safeRoom)) {
      setError('ルーム名は半角英数字、_、- の3〜40文字にしてください。');
      return;
    }

    if (!safeName || safeName.length > 40) {
      setError('表示名を1〜40文字で入力してください。');
      return;
    }

    setBusy(true);

    try {
      const identity =
        `${safeName}-${crypto.randomUUID().slice(0, 8)}`;

      const response = await fetch(`${API_URL}/api/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room: safeRoom,
          identity,
          name: safeName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '接続に失敗しました。');
      }

      setConnection({
        ...data,
        room: safeRoom,
        identity,
        name: safeName,
      });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : '接続に失敗しました。'
      );
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
            <h1>{connection.room}</h1>
            <p>カメラ映像・音声通話・テキストチャット</p>
          </div>

          <button
            className="secondary-button"
            onClick={() => setConnection(null)}
          >
            退出する
          </button>
        </header>

        {error && <p className="error">{error}</p>}

        <LiveKitRoom
          serverUrl={connection.serverUrl}
          token={connection.token}
          connect={true}
          video={true}
          audio={true}
          options={{ adaptiveStream: true, dynacast: true }}
          onError={(e) => setError(e.message)}
          onDisconnected={() => setConnection(null)}
        >
          <div className="conference-shell">
            <VideoConference />
          </div>

          <MuteParticipants
            room={connection.room}
            identity={connection.identity}
            token={connection.token}
          />
        </LiveKitRoom>
      </main>
    );
  }

  return (
    <main className="landing">
      <section className="hero">
        <div className="eyebrow">PHYSICAL TCG · REMOTE ROOM</div>

        <h1>
          いつものカードで、
          <br />
          <span>どこからでも対戦。</span>
        </h1>

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
            <small>
              参加者全員で同じルーム名を使用してください。
            </small>
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

function MuteParticipants({
  room,
  identity,
  token,
}: {
  room: string;
  identity: string;
  token: string;
}) {
  const participants = useParticipants();
  const [muting, setMuting] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  async function forceMute(
    targetIdentity: string,
    targetName: string
  ) {
    if (targetIdentity === identity || muting !== null) {
      return;
    }

    if (
      !window.confirm(
        `${targetName}さんのマイクを強制ミュートしますか？`
      )
    ) {
      return;
    }

    setMuting(targetIdentity);
    setMessage('');

    try {
      const response = await fetch(`${API_URL}/api/admin/mute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterToken: token,
          room,
          identity: targetIdentity,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '強制ミュートに失敗しました。');
      }

      setMessage(`${targetName}さんを強制ミュートしました。`);
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : '強制ミュートに失敗しました。'
      );
    } finally {
      setMuting(null);
    }
  }

  return (
    <aside className="member-panel">
      <h2>メンバー一覧・強制ミュート</h2>
      <p className="member-count">
        {participants.length}人が参加中
      </p>

      <div className="member-list">
        {participants.map((participant) => (
          <article
            className="member-item"
            key={participant.identity}
          >
            <div className="member-info">
              <strong>
                {participant.name || participant.identity}
                {participant.identity === identity && '（自分）'}
              </strong>

              <span>
                {participant.isCameraEnabled
                  ? '📷 カメラON'
                  : 'カメラOFF'}
                {' · '}
                {participant.isMicrophoneEnabled
                  ? '🎙️ マイクON'
                  : 'マイクOFF'}
              </span>
            </div>

            {participant.identity !== identity && (
              <button
                className="mute-button"
                disabled={muting !== null}
                onClick={() =>
                  forceMute(
                    participant.identity,
                    participant.name || participant.identity
                  )
                }
              >
                {muting === participant.identity
                  ? '処理中…'
                  : '強制ミュート'}
              </button>
            )}
          </article>
        ))}
      </div>

      {message && <p className="status-message">{message}</p>}

      <p className="admin-note">
        同じルームの参加者は、ほかの参加者を強制ミュートできます。
      </p>
    </aside>
  );
}
