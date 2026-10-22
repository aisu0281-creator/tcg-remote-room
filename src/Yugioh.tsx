
type Opponent = {
  identity: string;
  name: string;
  lp: number;
};

type YugiohProps = {
  name: string;
  myLP: number;
  amount: string;
  history: string[];
  notice: string;
  opponents: Opponent[];
  onAmountChange: (value: string) => void;
  onChangeLP: (delta: number) => void;
  onSetExactLP: () => void;
  onResetLP: () => void;
};

export default function Yugioh({
  name,
  myLP,
  amount,
  history,
  notice,
  opponents,
  onAmountChange,
  onChangeLP,
  onSetExactLP,
  onResetLP,
}: YugiohProps) {
  return (
    <div className="yugioh-panel">
      <div className="yugioh-heading">
        <div>
          <div className="eyebrow">YU-GI-OH! · DUEL TOOLS</div>
          <h2>ライフポイント</h2>
        </div>
        <button className="secondary-button" onClick={onResetLP}>
          自分のLPをリセット
        </button>
      </div>

      <div className="life-grid">
        {opponents.map((opponent) => (
          <article
            className="life-card opponent-life"
            key={opponent.identity}
          >
            <span className="life-label">
              対戦相手 · {opponent.name}
            </span>
            <div className="life-value">
              {opponent.lp}<small> LP</small>
            </div>
            <p className="life-help">
              ライフ操作は本人側で行います
            </p>
          </article>
        ))}

        <article className="life-card my-life">
          <span className="life-label">自分 · {name}</span>
          <div className="life-value">
            {myLP}<small> LP</small>
          </div>

          <div className="life-actions">
            <button onClick={() => onChangeLP(-1000)}>−1000</button>
            <button onClick={() => onChangeLP(-100)}>−100</button>
            <button onClick={() => onChangeLP(100)}>＋100</button>
            <button onClick={() => onChangeLP(1000)}>＋1000</button>
          </div>

          <div className="life-custom">
            <input
              type="number"
              min="0"
              max="999999"
              step="1"
              value={amount}
              onChange={(event) => onAmountChange(event.target.value)}
              aria-label="変更後のライフポイント"
            />
            <button onClick={onSetExactLP}>LPを直接設定</button>
          </div>
        </article>
      </div>

      {notice && <p className="status-message">{notice}</p>}

      <details className="life-history">
        <summary>ライフポイントの変更履歴</summary>
        {history.length === 0 ? (
          <p>まだ変更履歴はありません。</p>
        ) : (
          <ul>
            {history.map((line, index) => (
              <li key={`${line}-${index}`}>{line}</li>
            ))}
          </ul>
        )}
      </details>
    </div>
  );
}
