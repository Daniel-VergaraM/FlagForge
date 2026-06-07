'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, Flag } from '@/lib/api';
import styles from './detail.module.css';

export default function FlagDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [flag, setFlag] = useState<Flag | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    api.flags
      .get(id)
      .then(setFlag)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className={styles.center}>Loading...</div>;
  if (error) return <div className={styles.center}>Error: {error}</div>;
  if (!flag) return <div className={styles.center}>Flag not found</div>;

  return (
    <div className={styles.container}>
      <div className={styles.breadcrumb}>
        <Link href="/flags">← Back to flags</Link>
      </div>

      <div className={styles.header}>
        <h1>{flag.name}</h1>
        <span className={`${styles.badge} ${flag.enabled ? styles.on : styles.off}`}>
          {flag.enabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>

      <div className={styles.card}>
        <div className={styles.row}>
          <span className={styles.label}>Key</span>
          <span className={styles.value}>{flag.key}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Environment</span>
          <span className={styles.value}>{flag.environment}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Description</span>
          <span className={styles.value}>{flag.description || '—'}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Created</span>
          <span className={styles.value}>
            {new Date(flag.createdAt).toLocaleString()}
          </span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Updated</span>
          <span className={styles.value}>
            {new Date(flag.updatedAt).toLocaleString()}
          </span>
        </div>
      </div>

      <div className={styles.actions}>
        <Link href={`/flags/${flag.id}/edit`} className={styles.editButton}>
          Edit Flag
        </Link>
        <Link href={`/flags/${flag.id}/audit`} className={styles.auditButton}>
          View Audit History
        </Link>
      </div>
    </div>
  );
}
