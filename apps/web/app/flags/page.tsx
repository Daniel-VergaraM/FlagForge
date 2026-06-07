'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, Flag } from '@/lib/api';
import styles from './flags.module.css';

export default function FlagsPage() {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.flags
      .list()
      .then(setFlags)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = flags.filter(
    (f) =>
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.key.toLowerCase().includes(search.toLowerCase()),
  );

  const toggleFlag = async (id: string, current: boolean) => {
    try {
      await api.flags.update(id, { enabled: !current });
      setFlags((prev) =>
        prev.map((f) => (f.id === id ? { ...f, enabled: !current } : f)),
      );
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) return <div className={styles.loading}>Loading flags...</div>;
  if (error) return <div className={styles.error}>Error: {error}</div>;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Feature Flags</h1>
        <Link href="/flags/new" className={styles.newButton}>
          + New Flag
        </Link>
      </header>

      <input
        type="text"
        placeholder="Search by name or key..."
        className={styles.search}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Key</th>
            <th>Environment</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((flag) => (
            <tr key={flag.id}>
              <td>
                <Link href={`/flags/${flag.id}`} className={styles.link}>
                  {flag.name}
                </Link>
              </td>
              <td>{flag.key}</td>
              <td>{flag.environment}</td>
              <td>
                <button
                  className={`${styles.toggle} ${flag.enabled ? styles.on : styles.off}`}
                  onClick={() => toggleFlag(flag.id, flag.enabled)}
                >
                  {flag.enabled ? 'On' : 'Off'}
                </button>
              </td>
              <td>
                <Link href={`/flags/${flag.id}`} className={styles.action}>
                  View
                </Link>
                <Link href={`/flags/${flag.id}/edit`} className={styles.action}>
                  Edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
