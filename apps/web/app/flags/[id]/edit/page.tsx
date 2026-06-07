'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { api, Flag } from '@/lib/api';
import styles from '../../form.module.css';

export default function EditFlagPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [flag, setFlag] = useState<Flag | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.flags
      .get(id)
      .then(setFlag)
      .catch(() => alert('Failed to load flag'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flag) return;
    setSaving(true);
    try {
      await api.flags.update(id, {
        name: flag.name,
        description: flag.description,
        enabled: flag.enabled,
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
