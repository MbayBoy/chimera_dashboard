/**
 * Preset toggles.
 *
 * Every field on the quote screen except the photo and the price is one of
 * these: one tap, no dropdown, no scrolling list of twelve options. A dropdown
 * costs two taps and a scroll, and at ninety seconds that is most of the budget.
 */
export interface ToggleOption<T> {
  readonly value: T;
  readonly label: string;
}

export function Toggles<T extends string | number>({
  options,
  selected,
  onSelect,
  label,
}: {
  options: readonly ToggleOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
  label: string;
}): JSX.Element {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="toggles" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            className="toggle"
            aria-pressed={option.value === selected}
            onClick={() => onSelect(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
