// SECTION 02 — Archive documentation progress. Counts are computed live from
// the record (see lib/episodeFields.js): episode-level fields and the selected
// segment's fields are separate groups. Green chips are documented, yellow
// partially documented, grey missing; clicking a chip scrolls to the section
// that shows the field.

import Icon from '../Icon.jsx';
import { episodeFieldChecklist } from '@/lib/episodeFields.js';

const scrollToSection = (id) => {
  document.getElementById(id)?.scrollIntoView({ block: 'start' });
};

function FieldChip({ f }) {
  const cls = f.state === 'done' ? 'is-done' : f.state === 'partial' ? 'is-partial' : 'is-missing';
  return (
    <button type="button" className={`ev-field ${cls}`}
      onClick={() => scrollToSection(f.section)}
      aria-label={`${f.label}: ${f.state === 'done' ? 'documented' : f.state === 'partial' ? 'partially documented' : 'not documented'} — go to the section`}>
      <span className="ev-field__dot" aria-hidden="true" />
      {f.label}
      <Icon name={f.state === 'done' ? 'check' : f.state === 'partial' ? 'alert' : 'plus'} size={11} />
    </button>
  );
}

export default function ArchiveCompleteness({ record, segment, segmentIndex, entry }) {
  const segmentNumber = segment?.segmentNumber ?? segmentIndex + 1;
  const segmentCount = record.segments?.length ?? 1;
  const checklist = episodeFieldChecklist(record, segment, segmentNumber, segmentCount);
  if (!checklist.total) return null;

  return (
    <section className="detail-section ev-section" id="completeness" aria-labelledby="completeness-title">
      <header className="detail-section__head">
        <h2 className="ev-section-title" id="completeness-title">Archive completeness</h2>
        <span className="ev-completeness__figure mono">
          {checklist.done} of {checklist.total} fields documented — {checklist.percent}%
        </span>
      </header>
      <div className="ev-completeness">
        <div className="completeness__bar ev-completeness__bar" aria-hidden="true">
          <span style={{ width: `${checklist.percent}%` }} />
        </div>
        <div className="ev-completeness__groups">
          {checklist.groups.map((group) => (
            <div key={group.id} className="ev-completeness__group">
              <p className="ev-completeness__label mono">{group.label}</p>
              <div className="ev-completeness__chips">
                {group.fields.map((f) => <FieldChip key={f.label} f={f} />)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
