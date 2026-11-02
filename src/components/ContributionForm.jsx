import { useId, useState } from 'react';
import Icon from './Icon.jsx';
import { validateForm } from '@/lib/contributionForms.js';
import { getEntry } from '@/lib/catalog.js';
import { useAuth } from '@/hooks/useAuth.jsx';
import { submitContribution } from '@/lib/staffApi.js';

function Field({ field, value, error, onChange, formId }) {
  const id = `${formId}-${field.name}`;
  const describedBy = [error ? `${id}-err` : null, field.help ? `${id}-help` : null].filter(Boolean).join(' ') || undefined;
  const common = { id, name: field.name, value: value ?? '', 'aria-invalid': error ? 'true' : undefined, 'aria-describedby': describedBy, onChange: (e) => onChange(field.name, e.target.value) };
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <label htmlFor={id}>{field.label}{field.required ? <span className="field__req" aria-hidden="true"> *</span> : <span className="field__opt"> (optional)</span>}</label>
      {field.type === 'textarea' ? <textarea rows={field.rows ?? 3} {...common} />
        : field.type === 'select' ? (
          <div className="select-wrap">
            <select {...common}><option value="">Choose…</option>{field.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
            <Icon name="chevronDown" size={16} className="select-wrap__chev" />
          </div>
        ) : <input type={field.type === 'number' ? 'number' : field.type === 'url' ? 'url' : 'text'} min={field.min} placeholder={field.placeholder} {...common} />}
      {field.help ? <p className="field__help" id={`${id}-help`}>{field.help}</p> : null}
      {error ? <p className="field__error" id={`${id}-err`} role="alert">{error}</p> : null}
    </div>
  );
}

export default function ContributionForm({ category }) {
  const formId = useId();
  const fields = category.fields();
  const { user, backendConfigured, signIn } = useAuth();
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle'); // idle | submitting | done
  const [result, setResult] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [copied, setCopied] = useState(false);

  const onChange = (name, value) => {
    setValues((v) => ({ ...v, [name]: value }));
    if (errors[name]) setErrors((e) => { const n = { ...e }; delete n[name]; return n; });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const found = validateForm(fields, values, { entryExists: (id) => Boolean(getEntry(id)) });
    setErrors(found);
    if (Object.keys(found).length) {
      const first = fields.find((f) => found[f.name]);
      document.getElementById(`${formId}-${first.name}`)?.focus();
      return;
    }
    // Signed in with a configured backend: submit for real. The server
    // re-validates everything, applies rate limits, and returns a number.
    if (user && backendConfigured) {
      setStatus('submitting');
      setSubmitError(null);
      try {
        const res = await submitContribution({
          type: category.id,
          title: suggestionTitle(category, values),
          entryId: typeof values.entryId === 'string' && values.entryId.trim() ? values.entryId.trim() : null,
          payload: values,
          honeypot: values.company ?? null,
        });
        setResult({ number: res.number, submitted: true });
        setStatus('done');
        return;
      } catch (err) {
        setSubmitError(err);
        setStatus('idle');  // input values are preserved for the user to retry
        if (err.fieldErrors) setErrors(err.fieldErrors);
        return;
      }
    }
    // No backend yet: produce the same draft as before.
    setResult({ payload: { category: category.id, contributedAt: new Date().toISOString().slice(0, 10), fields: values }, reference: `draft-${category.id}-${Date.now().toString(36)}` });
    setStatus('done');
  };

  const json = result ? JSON.stringify(result.payload, null, 2) : '';
  const copy = async () => {
    try { await navigator.clipboard.writeText(json); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { setCopied(false); }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `${result.reference}.json` });
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };
  const again = () => { setValues({}); setErrors({}); setResult(null); setStatus('idle'); };

  if (status === 'done' && result) {
    if (result.submitted) {
      return (
        <div className="submission-result" role="status">
          <span className="submission-result__icon"><Icon name="check" size={24} /></span>
          <h3>Submitted — thank you!</h3>
          <p>Your contribution is number <strong className="mono">#{result.number}</strong>. It is now
            pending review by a checker. You can follow its status any time in{' '}
            <a href="/account">My contributions</a>.</p>
          <div className="btn-row">
            <button type="button" className="btn btn--ghost" onClick={again}>Submit another</button>
          </div>
        </div>
      );
    }
    return (
      <div className="submission-result" role="status">
        <span className="submission-result__icon"><Icon name="check" size={24} /></span>
        <h3>Your draft is ready</h3>
        <p><strong>Nothing was saved or sent.</strong> Copy the draft below or download it as a file, then pass it to a maintainer for review. Every accepted change is recorded in the archive's change log.</p>
        <p className="muted small">Draft reference: <span className="mono">{result.reference}</span></p>
        <pre className="submission-result__json" tabIndex={0} aria-label="Submission draft as JSON">{json}</pre>
        <div className="btn-row">
          <button type="button" className="btn btn--primary" onClick={copy}><Icon name="copy" size={16} /> {copied ? 'Copied' : 'Copy draft'}</button>
          <button type="button" className="btn btn--ghost" onClick={download}><Icon name="download" size={16} /> Download .json</button>
          <button type="button" className="btn btn--ghost" onClick={again}>Start another</button>
        </div>
      </div>
    );
  }

  return (
    <form className="contribution-form" onSubmit={onSubmit} noValidate>
      {backendConfigured && !user ? (
        <p className="notice">Sign in with Discord to submit this contribution — it takes a moment and
          helps us keep the archive accountable. Without an account you can still prepare a draft below.</p>
      ) : null}
      {submitError ? (
        <p className="form-summary" role="alert">
          {submitError.status === 429 || submitError.status === 409
            ? submitError.message
            : `The submission failed: ${submitError.message} Your input is preserved — try again.`}
        </p>
      ) : null}
      {Object.keys(errors).length ? <p className="form-summary" role="alert">Please fix {Object.keys(errors).length === 1 ? '1 field' : `${Object.keys(errors).length} fields`} below.</p> : null}
      {/* Honeypot: real users never see or fill this. */}
      <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true"
        style={{ position: 'absolute', left: '-9999px' }} value={values.company ?? ''} onChange={(e) => onChange('company', e.target.value)} />
      <div className="contribution-form__grid">
        {fields.map((f) => (
          <div key={f.name} className={f.type === 'textarea' ? 'span-2' : ''}>
            <Field field={f} value={values[f.name]} error={errors[f.name]} onChange={onChange} formId={formId} />
          </div>
        ))}
      </div>
      <div className="btn-row">
        <button type="submit" className="btn btn--primary" disabled={status === 'submitting'}>
          {status === 'submitting' ? 'Submitting…' : user && backendConfigured ? 'Submit contribution' : 'Create the draft'}
        </button>
        <button type="button" className="btn btn--ghost" onClick={again}>Reset form</button>
      </div>
    </form>
  );
}

/** Human title for the submission, used in lists and notifications. */
function suggestionTitle(category, values) {
  const pick = (...keys) => {
    for (const key of keys) {
      const v = values[key];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return null;
  };
  const what = pick('title', 'nameEn', 'field', 'problem');
  const entry = pick('entryId', 'characterId', 'gadgetId');
  const bits = [category.label, what].filter(Boolean);
  return (entry ? `${bits.join(' — ')} (${entry})` : bits.join(' — ')).slice(0, 200) || category.label;
}
