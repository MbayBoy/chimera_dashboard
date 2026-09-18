import { translate, type Language } from '../lib/i18n.js';

/**
 * The price keypad.
 *
 * A keypad rather than a text input, for three reasons: a numeric keyboard on a
 * cheap Android tablet covers half the screen and pushes the submit button out
 * of reach; a gloved thumb misses small keys; and a text field invites typing,
 * which is the enemy on this screen.
 */
export function Keypad({
  value,
  onChange,
  language,
}: {
  value: string;
  onChange: (next: string) => void;
  language: Language;
}): JSX.Element {
  const press = (key: string) => {
    if (key === 'del') {
      onChange(value.slice(0, -1));
      return;
    }
    if (key === '.') {
      if (value.includes('.')) return;
      onChange(value === '' ? '0.' : `${value}.`);
      return;
    }
    // A price with more than two decimals is a typo, not an intention.
    const [, decimals] = value.split('.');
    if (decimals !== undefined && decimals.length >= 2) return;
    if (value.length >= 9) return;
    onChange(value === '0' ? key : value + key);
  };

  return (
    <div className="keypad" role="group" aria-label={translate(language, 'quote.price', { currency: '' }).trim()}>
      {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'].map((key) => (
        <button key={key} type="button" onClick={() => press(key)} aria-label={key}>
          {key}
        </button>
      ))}
      <button type="button" onClick={() => press('del')} aria-label="delete">
        ⌫
      </button>
    </div>
  );
}
