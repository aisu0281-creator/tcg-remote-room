
import { useEffect, useState } from 'react';
import {
  useParticipants,
  useRoomContext,
} from '@livekit/components-react';
import { RoomEvent, type RemoteParticipant } from 'livekit-client';
import Yugioh from './Yugioh';

const TOPIC = 'tcg-game-state';

type Game = 'none' | 'yugioh';

type GameMessage =
  | { type: 'request-state'; requester: string }
  | { type: 'game'; game: Game }
  | { type: 'life'; identity: string; name: string; lp: number }
  | {
      type: 'state';
      game: Game;
      identity: string;
      name: string;
      lp: number;
    };

type LifeEntry = { name: string; lp: number };

type GameToolsProps = {
  identity: string;
  name: string;
};

export default function GameTools({
  identity,
  name,
}: GameToolsProps) {
  const room = useRoomContext();
  const participants = useParticipants();

  const [game, setGame] = useState<Game>('none');
  const [myLP, setMyLP] = useState(8000);
  const [life, setLife] = useState<Record<string, LifeEntry>>({});
  const [amount, setAmount] = useState('100');
  const [history, setHistory] = useState<string[]>([]);
  const [notice, setNotice] = useState('');

  function send(message: GameMessage) {
    const bytes = new TextEncoder().encode(JSON.stringify(message));
    void room.localParticipant.publishData(bytes, {
      reliable: true,
      topic: TOPIC,
    });
  }

  function announceLife(lp: number) {
    send({ type: 'life', identity, name, lp });
  }

  useEffect(() => {
    const onData = (
      payload: Uint8Array,
      _participant?: RemoteParticipant,
      _kind?: unknown,
      topic?: string,
    ) => {
      if (topic && topic !== TOPIC) return;

      try {
        const msg = JSON.parse(
          new TextDecoder().decode(payload),
        ) as GameMessage;

        if (msg.type === 'request-state') {
          if (msg.requester !== identity) {
            send({ type: 'state', game, identity, name, lp: myLP });
          }
        } else if (msg.type === 'game') {
          setGame(msg.game);
        } else if (msg.type === 'life') {
          setLife((old) => ({
            ...old,
            [msg.identity]: { name: msg.name, lp: msg.lp },
          }));
        } else if (msg.type === 'state') {
          setGame(msg.game);
          setLife((old) => ({
            ...old,
            [msg.identity]: { name: msg.name, lp: msg.lp },
          }));
        }
      } catch {
        // このアプリ以外のデータは無視します
      }
    };

    room.on(RoomEvent.DataReceived, onData);
    send({ type: 'request-state', requester: identity });
    announceLife(myLP);

    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
    // 初回接続時に同期要求を送ります
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, identity]);

  useEffect(() => {
    setLife((old) => ({
      ...old,
      [identity]: { name, lp: myLP },
    }));
  }, [identity, name, myLP]);

  function chooseGame(next: Game) {
    setGame(next);
    send({ type: 'game', game: next });
    setNotice(
      next === 'yugioh' ? '遊戯王の対戦画面を選択しました。' : '',
    );
  }

  function changeLP(delta: number) {
    const next = Math.max(0, myLP + delta);
    setMyLP(next);
    announceLife(next);

    const line = `${name}: ${myLP} → ${next} LP`;
    setHistory((old) => [line, ...old].slice(0, 10));
  }

  function setExactLP() {
    const value = Number(amount);

    if (
      amount.trim() === '' ||
      !Number.isFinite(value) ||
      !Number.isInteger(value) ||
      value < 0
    ) {
      setNotice('ライフポイントは0以上の整数で入力してください。');
      return;
    }

    const next = Math.min(value, 999999);
    setMyLP(next);
    announceLife(next);
    setHistory((old) =>
      [`${name}: ${myLP} → ${next} LP`, ...old].slice(0, 10),
    );
    setNotice('');
  }

  function resetLP() {
    if (!window.confirm('自分のライフポイントを8000に戻しますか？')) {
      return;
    }

    setMyLP(8000);
    announceLife(8000);
    setHistory((old) =>
      [`${name}: ライフを8000 LPにリセット`, ...old].slice(0, 10),
    );
    setNotice('自分のライフポイントを8000に戻しました。');
  }

  const opponents = participants
    .filter((participant) => participant.identity !== identity)
    .map((participant) => ({
      identity: participant.identity,
      name: life[participant.identity]?.name
        || participant.name
        || participant.identity,
      lp: life[participant.identity]?.lp ?? 8000,
    }));

  return (
    <section className="game-tools">
      <div className="game-select">
        <div>
          <div className="eyebrow">GAME MODE</div>
          <h2>対戦ゲームを選択</h2>
          <p>選択したゲームは同じルームの参加者に共有されます。</p>
        </div>

        <div className="game-buttons">
          <button
            className={
              game === 'yugioh'
                ? 'game-choice selected'
                : 'game-choice'
            }
            onClick={() => chooseGame('yugioh')}
          >
            遊戯王
          </button>

          <button
            className={
              game === 'none'
                ? 'game-choice selected'
                : 'game-choice'
            }
            onClick={() => chooseGame('none')}
          >
            ゲーム未選択
          </button>
        </div>
      </div>

      {game === 'yugioh' && (
        <Yugioh
          name={name}
          myLP={myLP}
          amount={amount}
          history={history}
          notice={notice}
          opponents={opponents}
          onAmountChange={setAmount}
          onChangeLP={changeLP}
          onSetExactLP={setExactLP}
          onResetLP={resetLP}
        />
      )}

      {game === 'none' && (
        <div className="game-placeholder">
          <h3>遊ぶカードゲームを選んでください</h3>
          <p>まずは遊戯王のライフポイント管理から対応します。</p>
        </div>
      )}
    </section>
  );
}
