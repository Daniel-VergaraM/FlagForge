'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, FlagRule } from '@/lib/api';
import styles from '../form.module.css';

export default function NewFlagPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [environment, setEnvironment] = useState('production');
  const [enabled, setEnabled] = useState(false);
  const [rules, setRules] = useState<FlagRule[]>([]);
  const [saving, setSaving] = useState(false);

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
    setSaving(true);
    try {
      const flag = await api.flags.create({
        name,
        key,
        description,
        environment,
        enabled,
        rules: rules.length > 0 ? rules : undefined,
      });
      router.push(`/flags/${flag.id}`);
    } catch (err: any) {
      alert(err.message);
      setSaving(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.breadcrumb}>
        <Link href="/flags">← Back to flags</Link>
      </div>

      <h1>Create New Flag</h1>

      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.field}>
          Name
          <input
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>

        <label className={styles.field}>
          Key
          <input
            className={styles.input}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="e.g. new-feature-2024"
            required
          />
        </label>

        <label className={styles.field}>
          Description
          <textarea
            className={styles.textarea}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </label>

        <label className={styles.field}>
          Environment
          <select
            className={styles.input}
            value={environment}
            onChange={(e) => setEnvironment(e.target.value)}
          >
            <option value="production">Production</option>
            <option value="staging">Staging</option>
            <option value="development">Development</option>
          </select>
        </label>

        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
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
            {saving ? 'Saving...' : 'Create Flag'}
          </button>
          <Link href="/flags" className={styles.cancel}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
