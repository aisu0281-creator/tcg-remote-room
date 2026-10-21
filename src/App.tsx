
import { useState } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoTrack,
  useParticipants,
  useTracks,
  useLocalParticipant,
} from '@livekit/components-react';
import { Track } from 'livekit-client';

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
            <p>カメラONの参加者を優先して表示します。</p>
          </div>

          <button
            className="secondary-button"
            onClick={() => setConnection(null)}
          >
            退出する
          </button>
        </header>

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
          <RoomStage
            room={connection.room}
            identity={connection.identity}
            token={connection.token}
          />
          <RoomAudioRenderer />
        </LiveKitRoom>

        {error && <p className="error">{error}</p>}
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
          盤面カメラ・ボイスチャットをひとつのルームに。
          PC、iPhone、Androidから参加できます。
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
      </section>
    </main>
  );
}

function RoomStage({
  room,
  identity,
  token,
}: {
  room: string;
  identity: string;
  token: string;
}) {
  const participants = useParticipants();

  const {
    localParticipant,
    isCameraEnabled,
    isMicrophoneEnabled,
  } = useLocalParticipant();

  const cameraTracks = useTracks([Track.Source.Camera]);

  const visibleTracks = cameraTracks.filter(
    (track) =>
      track.participant.isCameraEnabled &&
      track.publication &&
      !track.publication.isMuted
  );

  const [muting, setMuting] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  async function forceMute(
    targetIdentity: string,
    targetName: string
  ) {
    if (targetIdentity === identity || muting !== null) {
      return;
    }

    const confirmed = window.confirm(
      `${targetName}さんのマイクを強制ミュートしますか？`
    );

    if (!confirmed) return;

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
        throw new Error(data.error || 'ミュートに失敗しました。');
      }

      setMessage(`${targetName}さんを強制ミュートしました。`);
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : 'ミュートに失敗しました。'
      );
    } finally {
      setMuting(null);
    }
  }

  return (
    <>
      <div className="device-controls">
        <button
          className={
            isCameraEnabled
              ? 'device-button active'
              : 'device-button'
          }
          onClick={() =>
            localParticipant.setCameraEnabled(!isCameraEnabled)
          }
        >
          {isCameraEnabled ? '📷 カメラOFF' : '📷 カメラON'}
        </button>

        <button
          className={
            isMicrophoneEnabled
              ? 'device-button active'
              : 'device-button'
          }
          onClick={() =>
            localParticipant.setMicrophoneEnabled(
              !isMicrophoneEnabled
            )
          }
        >
          {isMicrophoneEnabled ? '🎙️ マイクOFF' : '🔇 マイクON'}
        </button>
      </div>

      <div className="room-layout">
        <section className="video-section">
          <div className="section-heading">
            <h2>カメラ映像</h2>
            <span>{visibleTracks.length}人がカメラON</span>
          </div>

          {visibleTracks.length > 0 ? (
            <div className="video-grid">
              {visibleTracks.map((track) => (
                <article
                  className="video-card"
                  key={`${track.participant.identity}-${track.publication?.trackSid}`}
                >
                  <div className="video-frame">
                    <VideoTrack trackRef={track} />
                  </div>

                  <div className="video-name">
                    {track.participant.name ||
                      track.participant.identity}
                    {track.participant.identity === identity &&
                      '（自分）'}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-video">
              カメラをONにしている参加者はいません。
            </div>
          )}

          <p className="video-help">
            カメラOFFの参加者は映像エリアから非表示になります。
            メンバー一覧には残ります。
          </p>
        </section>

        <aside className="member-panel">
          <h2>メンバー一覧</h2>
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

          {message && (
            <p className="status-message">{message}</p>
          )}

          <p className="admin-note">
            同じルームの参加者は、ほかの参加者を強制ミュートできます。
          </p>
        </aside>
      </div>
    </>
  );
}
