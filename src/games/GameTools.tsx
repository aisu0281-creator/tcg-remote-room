
import { useEffect, useRef, useState } from 'react';
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

  // 最新の状態を、受信イベントからも参照できるようにする
  const gameRef = useRef<Game>(game);
  const myLPRef = useRef(myLP);
  const nameRef = useRef(name);

  gameRef.current = game;
  myLPRef.current = myLP;
  nameRef.current = name;

  function send(message: GameMessage) {
    if (!room.localParticipant) return;

    const bytes = new TextEncoder().encode(
      JSON.stringify(message),
    );

    void room.localParticipant.publishData(bytes, {
      reliable: true,
      topic: TOPIC,
    }).catch((error) => {
      console.error('ゲームデータの送信に失敗しました:', error);
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
      _participant?: RemoteParticipant,
      _kind?: unknown,
      topic?: string,
    ) => {
      // このアプリのゲームデータ以外は無視する
      if (topic !== TOPIC) return;

      try {
        const msg = JSON.parse(
          new TextDecoder().decode(payload),
        ) as GameMessage;

        if (msg.type === 'request-state') {
          // 自分自身の要求には返信しない
          if (msg.requester !== identity) {
            sendCurrentState();
          }
          return;
        }

        if (msg.type === 'game') {
          if (msg.game === 'none' || msg.game === 'yugioh') {
            setGame(msg.game);
          }
          return;
        }

        if (msg.type === 'life') {
          if (
            typeof msg.identity !== 'string' ||
            typeof msg.name !== 'string' ||
            !Number.isInteger(msg.lp) ||
            msg.lp < 0 ||
            msg.lp > 999999
          ) {
            return;
          }

          setLife((old) => ({
            ...old,
            [msg.identity]: {
              name: msg.name,
              lp: msg.lp,
            },
          }));
          return;
        }

        if (msg.type === 'state') {
          if (
            typeof msg.identity !== 'string' ||
            typeof msg.name !== 'string' ||
            !Number.isInteger(msg.lp) ||
            msg.lp < 0 ||
            msg.lp > 999999 ||
            (msg.game !== 'none' && msg.game !== 'yugioh')
          ) {
            return;
          }

          if (msg.identity === identity) return;

          setGame(msg.game);
          setLife((old) => ({
            ...old,
            [msg.identity]: {
              name: msg.name,
              lp: msg.lp,
            },
          }));
        }
      } catch (error) {
        console.error('ゲームデータの受信に失敗しました:', error);
      }
    };

    // 新しい参加者が入室したときにも現在の状態を送信
    const onParticipantConnected = () => {
      sendCurrentState();
    };

    room.on(RoomEvent.DataReceived, onData);
    room.on(RoomEvent.ParticipantConnected, onParticipantConnected);

    // 入室時に、ほかの参加者へ最新状態を要求する
    send({
      type: 'request-state',
      requester: identity,
    });

    // 自分の現在のLPも共有する
    announceLife(myLPRef.current);

    return () => {
      room.off(RoomEvent.DataReceived, onData);
      room.off(
        RoomEvent.ParticipantConnected,
        onParticipantConnected,
      );
    };
    // 接続中にLPが変わっても、受信イベントを登録し直さない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, identity]);

  // 自分のLP変更を参加者へ即時送信
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
      setNotice('ライフポイントは0以上の整数で入力してください。');
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
      [`${name}: ライフを8000 LPにリセット`, ...old].slice(0, 10),
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
