
import { useState } from 'react';
import {
  LiveKitRoom,
  VideoConference,
  useParticipants,
} from '@livekit/components-react';
import GameTools from './games/GameTools';

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
  const [showExitConfirm, setShowExitConfirm] = useState(false);

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
      const identity = `${safeName}-${crypto.randomUUID().slice(0, 8)}`;

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
        e instanceof Error ? e.message : '接続に失敗しました。',
      );
    } finally {
      setBusy(false);
    }
  }

  function cancelExit() {
    setShowExitConfirm(false);
  }

  function confirmExit() {
    setShowExitConfirm(false);
    setConnection(null);
    setError('');
  }

  if (connection) {
    return (
      <main className="room-page">
        <header className="room-header">
          <div>
            <div className="eyebrow">TCG REMOTE PLAY</div>
            <h1>{connection.room}</h1>
            <p>ゲーム選択・対戦管理・音声通話・チャット</p>
          </div>

          <button
            className="secondary-button"
            onClick={() => setShowExitConfirm(true)}
          >
            退出する
          </button>
        </header>

        {error && <p className="error">{error}</p>}

        <LiveKitRoom
          serverUrl={connection.serverUrl}
          token={connection.token}
          connect={true}
          video={false}
          audio={true}
          options={{ adaptiveStream: true, dynacast: true }}
          onError={(e) => setError(e.message)}
          onDisconnected={() => setConnection(null)}
        >
          <GameTools
            identity={connection.identity}
            name={connection.name}
          />

          <div className="conference-shell">
            <VideoConference />
          </div>

          <MuteParticipants
            room={connection.room}
            identity={connection.identity}
            token={connection.token}
          />
        </LiveKitRoom>

        {showExitConfirm && (
          <div
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                cancelExit();
              }
            }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
              background: 'rgba(0, 0, 0, 0.72)',
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="exit-dialog-title"
              style={{
                width: '100%',
                maxWidth: '420px',
                padding: '24px',
                border: '1px solid #35435d',
                borderRadius: '16px',
                background: '#151c2e',
                color: '#f5f7ff',
                boxShadow: '0 20px 70px rgba(0,0,0,.5)',
              }}
            >
              <h2
                id="exit-dialog-title"
                style={{ marginTop: 0 }}
              >
                ルームから退出しますか？
              </h2>

              <p style={{ color: '#b9c1d3', lineHeight: 1.8 }}>
                退出すると、現在の対戦ルームから切断されます。
                本当に退出してもよろしいですか？
              </p>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  flexWrap: 'wrap',
                  gap: '10px',
                  marginTop: '24px',
                }}
              >
                <button
                  className="secondary-button"
                  onClick={cancelExit}
                  autoFocus
                >
                  キャンセル
                </button>

                <button
                  onClick={confirmExit}
                  style={{
                    padding: '10px 16px',
                    border: '1px solid #e46b7d',
                    borderRadius: '10px',
                    background: '#8b3043',
                    color: '#fff',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  退出する
                </button>
              </div>
            </section>
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="landing">
      <section className="hero">
        <div className="eyebrow">
          PHYSICAL TCG · REMOTE ROOM
        </div>

        <h1>
          いつものカードで、
          <br />
          <span>どこからでも対戦。</span>
        </h1>

        <p className="intro">
          ルームに参加して、遊ぶカードゲームを選択。
          PC、iPhone、Androidのブラウザから利用できます。
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
          <span>● ゲーム別UI</span>
          <span>● 双方向ボイス</span>
          <span>● テキストチャット</span>
        </div>
      </section>

      <footer>ver.0.0.5</footer>
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
    targetName: string,
  ) {
    if (targetIdentity === identity || muting !== null) {
      return;
    }

    if (
      !window.confirm(
        `${targetName}さんのマイクを強制ミュートしますか？`,
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
        throw new Error(
          data.error || '強制ミュートに失敗しました。',
        );
      }

      setMessage(`${targetName}さんを強制ミュートしました。`);
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : '強制ミュートに失敗しました。',
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
                    participant.name || participant.identity,
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
