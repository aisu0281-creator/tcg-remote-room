
import { useEffect, useRef, useState } from 'react';
import {
  useParticipants,
  useRoomContext,
} from '@livekit/components-react';
import {
  ConnectionState,
  RoomEvent,
  type RemoteParticipant,
} from 'livekit-client';
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

type LifeEntry = {
  name: string;
  lp: number;
};

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

  const gameRef = useRef<Game>(game);
  const myLPRef = useRef(myLP);
  const nameRef = useRef(name);

  gameRef.current = game;
  myLPRef.current = myLP;
  nameRef.current = name;

  function send(message: GameMessage) {
    if (room.state !== ConnectionState.Connected) {
      console.warn('[LP同期] 未接続のため送信できません', {
        state: room.state,
        message,
      });
      return;
    }

    const bytes = new TextEncoder().encode(
      JSON.stringify(message),
    );

    console.log('[LP同期] データ送信', message);

    void room.localParticipant
      .publishData(bytes, {
        reliable: true,
        topic: TOPIC,
      })
      .catch((error) => {
        console.error('[LP同期] データ送信失敗', {
          state: room.state,
          message,
          error,
        });
      });
  }

  function sendCurrentState() {
    send({
      type: 'state',
      game: gameRef.current,
      identity,
      name: nameRef.current,
      lp: myLPRef.current,
    });
  }

  function announceLife(lp: number) {
    send({
      type: 'life',
      identity,
      name: nameRef.current,
      lp,
    });
  }

  useEffect(() => {
    const onData = (
      payload: Uint8Array,
      participant?: RemoteParticipant,
      _kind?: unknown,
      topic?: string,
    ) => {
      const raw = new TextDecoder().decode(payload);

      console.log('[LP同期] データ受信イベント', {
        topic,
        expectedTopic: TOPIC,
        from: participant?.identity,
        payload: raw,
      });

      if (topic !== TOPIC) {
        console.warn('[LP同期] topicが一致しません', topic);
        return;
      }

      try {
        const msg = JSON.parse(raw) as GameMessage;

        if (
          !msg ||
          typeof msg !== 'object' ||
          !('type' in msg)
        ) {
          console.warn('[LP同期] 不明なメッセージ', msg);
          return;
        }

        if (msg.type === 'request-state') {
          console.log('[LP同期] 状態要求を受信', msg);

          if (msg.requester !== identity) {
            sendCurrentState();
          }

          return;
        }

        if (msg.type === 'game') {
          if (
            msg.game === 'none' ||
            msg.game === 'yugioh'
          ) {
            console.log('[LP同期] ゲーム選択を受信', msg.game);
            setGame(msg.game);
          }

          return;
        }

        if (msg.type === 'life' || msg.type === 'state') {
          if (
            typeof msg.identity !== 'string' ||
            typeof msg.name !== 'string' ||
            !Number.isInteger(msg.lp) ||
            msg.lp < 0 ||
            msg.lp > 999999
          ) {
            console.warn('[LP同期] 不正なLPデータ', msg);
            return;
          }

          if (msg.identity === identity) {
            console.log(
              '[LP同期] 自分自身のデータなので表示更新を省略',
            );
            return;
          }

          console.log('[LP同期] LPデータを受信', msg);

          setLife((old) => ({
            ...old,
            [msg.identity]: {
              name: msg.name,
              lp: msg.lp,
            },
          }));

          if (msg.type === 'state') {
            if (
              msg.game === 'none' ||
              msg.game === 'yugioh'
            ) {
              setGame(msg.game);
            }
          }
        }
      } catch (error) {
        console.error('[LP同期] データ解析失敗', error, raw);
      }
    };

    const onParticipantConnected = (
      participant: RemoteParticipant,
    ) => {
      console.log(
        '[LP同期] 新しい参加者が入室しました',
        participant.identity,
      );

      sendCurrentState();
    };

    const sendInitialData = () => {
      console.log('[LP同期] 接続状態を確認', {
        state: room.state,
        room: room.name,
        identity,
      });

      if (room.state !== ConnectionState.Connected) {
        console.warn(
          '[LP同期] 接続が完了していないため初期送信を中止',
        );
        return;
      }

      send({
        type: 'request-state',
        requester: identity,
      });

      announceLife(myLPRef.current);
    };

    room.on(RoomEvent.DataReceived, onData);
    room.on(
      RoomEvent.ParticipantConnected,
      onParticipantConnected,
    );
    room.on(RoomEvent.Connected, sendInitialData);
    room.on(RoomEvent.Reconnected, sendInitialData);

    console.log('[LP同期] 受信イベントを登録しました', {
      identity,
      room: room.name,
      state: room.state,
    });

    if (room.state === ConnectionState.Connected) {
      sendInitialData();
    }

    return () => {
      room.off(RoomEvent.DataReceived, onData);
      room.off(
        RoomEvent.ParticipantConnected,
        onParticipantConnected,
      );
      room.off(RoomEvent.Connected, sendInitialData);
      room.off(RoomEvent.Reconnected, sendInitialData);

      console.log('[LP同期] 受信イベントを解除しました');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, identity]);

  useEffect(() => {
    setLife((old) => ({
      ...old,
      [identity]: {
        name,
        lp: myLP,
      },
    }));

    announceLife(myLP);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myLP, identity, name]);

  function chooseGame(next: Game) {
    setGame(next);
    send({ type: 'game', game: next });

    setNotice(
      next === 'yugioh'
        ? '遊戯王の対戦画面を選択しました。'
        : '',
    );
  }

  function changeLP(delta: number) {
    const next = Math.max(
      0,
      Math.min(999999, myLP + delta),
    );

    setMyLP(next);

    setHistory((old) =>
      [`${name}: ${myLP} → ${next} LP`, ...old].slice(0, 10),
    );
  }

  function setExactLP() {
    const value = Number(amount);

    if (
      amount.trim() === '' ||
      !Number.isFinite(value) ||
      !Number.isInteger(value) ||
      value < 0
    ) {
      setNotice(
        'ライフポイントは0以上の整数で入力してください。',
      );
      return;
    }

    const next = Math.min(value, 999999);

    setMyLP(next);

    setHistory((old) =>
      [`${name}: ${myLP} → ${next} LP`, ...old].slice(0, 10),
    );

    setNotice('');
  }

  function resetLP() {
    if (
      !window.confirm(
        '自分のライフポイントを8000に戻しますか？',
      )
    ) {
      return;
    }

    setMyLP(8000);

    setHistory((old) =>
      [
        `${name}: ライフを8000 LPにリセット`,
        ...old,
      ].slice(0, 10),
    );

    setNotice('自分のライフポイントを8000に戻しました。');
  }

  const opponents = participants
    .filter((participant) => participant.identity !== identity)
    .map((participant) => ({
      identity: participant.identity,
      name:
        life[participant.identity]?.name ||
        participant.name ||
        participant.identity,
      lp: life[participant.identity]?.lp ?? 8000,
    }));

  return (
    <section className="game-tools">
      <div className="game-select">
        <div>
          <div className="eyebrow">GAME MODE</div>
          <h2>対戦ゲームを選択</h2>
          <p>
            選択したゲームは同じルームの参加者に共有されます。
          </p>
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
          <p>
            まずは遊戯王のライフポイント管理から対応します。
          </p>
        </div>
      )}
    </section>
  );
}
