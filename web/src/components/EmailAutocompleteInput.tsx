import { Input } from './ui/input';
import { useContactEmailSuggestion } from '../hooks/useContactEmailSuggestion';
import { cn } from '../lib/utils';

interface Props {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  id?: string;
  name?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
}

/**
 * Email input with inline "ghost text" autocomplete sourced from saved
 * contacts. As the user types, the matching contact's email tail is shown
 * in light grey after the cursor. Press Enter or Tab to accept; Right Arrow
 * also accepts when the cursor is at the end.
 */
export function EmailAutocompleteInput({
  value,
  onChange,
  placeholder,
  id,
  name,
  className,
  inputClassName,
  disabled,
}: Props) {
  const suggestion = useContactEmailSuggestion(value);
  const ghostTail = suggestion ? suggestion.slice(value.length) : '';

  return (
    <div className={cn('relative', className)}>
      {/* Ghost overlay — sits behind the input, padding/font must match Input exactly */}
      {ghostTail && (
        <div className="pointer-events-none absolute inset-0 flex items-center px-3 py-1 text-base md:text-sm whitespace-pre overflow-hidden">
          <span className="invisible">{value}</span>
          <span className="text-slate-400 select-none">{ghostTail}</span>
        </div>
      )}
      <Input
        id={id}
        name={name}
        type="email"
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (!suggestion) return;
          if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            onChange(suggestion);
          } else if (e.key === 'ArrowRight') {
            // Only accept on right-arrow if cursor is at the end of typed text
            const el = e.currentTarget;
            if (el.selectionStart === value.length && el.selectionEnd === value.length) {
              e.preventDefault();
              onChange(suggestion);
            }
          }
        }}
        className={cn('relative bg-transparent', inputClassName)}
      />
    </div>
  );
}
