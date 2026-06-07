'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, AuditEntry } from '@/lib/api';
import styles from './audit.module.css';

export default function AuditPage() {
  const params = useParams();
  const id = params.id as string;
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    api.audit
      .byFlag(id)
      .then(setEntries)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className={styles.center}>Loading audit history...</div>;
  if (error) return <div className={styles.center}>Error: {error}</div>;

  return (
    <div className={styles.container}>
      <div className={styles.breadcrumb}>
        <Link href={`/flags/${id}`}>← Back to flag</Link>
      </div>

      <h1>Audit History</h1>

      {entries.length === 0 ? (
        <p className={styles.empty}>No audit entries found.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Action</th>
              <th>Actor</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.action}</td>
                <td>{entry.actorId}</td>
                <td>{new Date(entry.timestamp).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
