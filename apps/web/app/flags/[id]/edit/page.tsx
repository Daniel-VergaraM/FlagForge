'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { api, Flag, FlagRule } from '@/lib/api';
import styles from '../../form.module.css';

export default function EditFlagPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [flag, setFlag] = useState<Flag | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState<FlagRule[]>([]);

  useEffect(() => {
    if (!id) return;
    api.flags
      .get(id)
      .then((f) => {
        setFlag(f);
        setRules((f.rules as FlagRule[]) ?? []);
      })
      .catch(() => alert('Failed to load flag'))
      .finally(() => setLoading(false));
  }, [id]);

  const addRule = () => {
    setRules((prev) => [
      ...prev,
      { attribute: '', operator: 'eq', value: '' },
    ]);
  };

  const removeRule = (index: number) => {
    setRules((prev) => prev.filter((_, i) => i !== index));
  };

  const updateRule = (index: number, field: keyof FlagRule, value: unknown) => {
    setRules((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flag) return;
    setSaving(true);
    try {
      await api.flags.update(id, {
        name: flag.name,
        description: flag.description,
        enabled: flag.enabled,
        rules: rules.length > 0 ? rules : undefined,
      });
      router.push(`/flags/${id}`);
    } catch (err: any) {
      alert(err.message);
      setSaving(false);
    }
  };

  if (loading) return <div className={styles.container}>Loading...</div>;
  if (!flag) return <div className={styles.container}>Flag not found</div>;

  return (
    <div className={styles.container}>
      <div className={styles.breadcrumb}>
        <Link href={`/flags/${id}`}>← Back to flag</Link>
      </div>

      <h1>Edit Flag</h1>

      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.field}>
          Name
          <input
            className={styles.input}
            value={flag.name}
            onChange={(e) => setFlag({ ...flag, name: e.target.value })}
            required
          />
        </label>

        <label className={styles.field}>
          Key (read-only)
          <input className={styles.input} value={flag.key} readOnly disabled />
        </label>

        <label className={styles.field}>
          Description
          <textarea
            className={styles.textarea}
            value={flag.description || ''}
            onChange={(e) => setFlag({ ...flag, description: e.target.value })}
            rows={3}
          />
        </label>

        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={flag.enabled}
            onChange={(e) => setFlag({ ...flag, enabled: e.target.checked })}
          />
          Enabled
        </label>

        <div className={styles.rulesSection}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', color: '#1a1a2e' }}>
            Rules
          </h3>
          {rules.map((rule, index) => (
            <div
              key={index}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 120px 1fr auto',
                gap: '0.5rem',
                alignItems: 'center',
                marginBottom: '0.75rem',
                padding: '0.75rem',
                background: '#f8f9fa',
                borderRadius: '8px',
              }}
            >
              <input
                className={styles.input}
                placeholder="Attribute"
                value={rule.attribute}
                onChange={(e) => updateRule(index, 'attribute', e.target.value)}
                required
              />
              <select
                className={styles.input}
                value={rule.operator}
                onChange={(e) => updateRule(index, 'operator', e.target.value)}
              >
                <option value="eq">eq</option>
                <option value="neq">neq</option>
                <option value="gt">gt</option>
                <option value="lt">lt</option>
                <option value="contains">contains</option>
                <option value="in">in</option>
              </select>
              <input
                className={styles.input}
                placeholder="Value"
                value={String(rule.value ?? '')}
                onChange={(e) => updateRule(index, 'value', e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => removeRule(index)}
                style={{
                  background: '#fee2e2',
                  color: '#991b1b',
                  border: 'none',
                  padding: '0.4rem 0.6rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addRule}
            style={{
              background: '#eef2ff',
              color: '#4338ca',
              border: '1px solid #c7d2fe',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '0.9rem',
            }}
          >
            + Add Rule
          </button>
        </div>

        <div className={styles.actions}>
          <button type="submit" className={styles.save} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <Link href={`/flags/${id}`} className={styles.cancel}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
