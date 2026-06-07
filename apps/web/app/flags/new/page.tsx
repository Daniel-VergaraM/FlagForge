'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import styles from '../form.module.css';

export default function NewFlagPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [environment, setEnvironment] = useState('production');
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

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
