"use client";

import { AirportPicker } from "./AirportPicker";
import { MAX_TAGS } from "@/lib/threads";

/** Pick up to 5 airports to tag a thread with. Each chosen airport shows as a chip you can remove. */
export function AirportTags({ value, onChange }: { value: string[]; onChange: (codes: string[]) => void }) {
  return (
    <div className="tag-picker">
      {value.length > 0 && (
        <div className="chips-row" aria-label="Tagged airports">
          {value.map((code) => (
            <button key={code} type="button" className="tag mono tag-remove" onClick={() => onChange(value.filter((c) => c !== code))} aria-label={`Remove ${code}`}>
              {code} ✕
            </button>
          ))}
        </div>
      )}
      {value.length < MAX_TAGS ? (
        <AirportPicker label="Tag airports" optional value="" onPick={(code) => code && !value.includes(code) && onChange([...value, code])} />
      ) : (
        <p className="form-hint">You can tag up to {MAX_TAGS} airports. Remove one to add another.</p>
      )}
    </div>
  );
}
