'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiKey } from '@/lib/api';
import styles from './api-keys.module.css';

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newEnvironment, setNewEnvironment] = useState('production');
  const [generating, setGenerating] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<ApiKey | null>(null);

  const loadKeys = async () => {
    try {
      const data = await api.apiKeys.list();
      setKeys(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKeys();
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    try {
      const key = await api.apiKeys.create({
        environmentId: newEnvironment,
        name: newKeyName || undefined,
      });
      setGeneratedKey(key);
      setKeys((prev) => [key, ...prev]);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this API key?')) return;
    try {
      await api.apiKeys.revoke(id);
      setKeys((prev) => prev.filter((k) => k.id !== id));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setGeneratedKey(null);
    setNewKeyName('');
  };

  return (
    <div className={styles.container}>
      <div className={styles.breadcrumb}>
        <Link href="/flags">← Back to flags</Link>
      </div>

      <div className={styles.header}>
        <h1>API Keys</h1>
        <button
          className={styles.newButton}
          onClick={() => setShowModal(true)}
          disabled={showModal}
        >
          + Generate Key
        </button>
      </div>

      {loading && <div className={styles.loading}>Loading keys...</div>}
      {error && <div className={styles.error}>Error: {error}</div>}
      {!loading && !error && keys.length === 0 && (
        <div className={styles.empty}>No API keys found. Generate one to get started.</div>
      )}

      {!loading && !error && keys.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Key</th>
              <th>Environment</th>
              <th>Last Used</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => (
              <tr key={key.id}>
                <td>{key.name || '—'}</td>
                <td>
                  <span className={styles.keyCell}>
                    {key.key.slice(0, 12)}…
                    <button
                      className={styles.copyButton}
                      onClick={() => copyToClipboard(key.key)}
                      title="Copy to clipboard"
                    >
                      Copy
                    </button>
                  </span>
                </td>
                <td>{key.environmentId}</td>
                <td>
                  {key.lastUsedAt
                    ? new Date(key.lastUsedAt).toLocaleString()
                    : 'Never'}
                </td>
                <td>{new Date(key.createdAt).toLocaleString()}</td>
                <td>
                  <button
                    className={styles.revokeButton}
                    onClick={() => handleRevoke(key.id)}
                  >
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showModal && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            {!generatedKey ? (
              <form onSubmit={handleGenerate}>
                <h2>Generate New API Key</h2>
                <label className={styles.modalField}>
                  Name (optional)
                  <input
                    className={styles.modalInput}
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="e.g. CI/CD Pipeline"
                  />
                </label>
                <label className={styles.modalField}>
                  Environment
                  <select
                    className={styles.modalInput}
                    value={newEnvironment}
                    onChange={(e) => setNewEnvironment(e.target.value)}
                  >
                    <option value="production">Production</option>
                    <option value="staging">Staging</option>
                    <option value="development">Development</option>
                  </select>
                </label>
                <div className={styles.modalActions}>
                  <button
                    type="submit"
                    className={styles.modalSave}
                    disabled={generating}
                  >
                    {generating ? 'Generating...' : 'Generate'}
                  </button>
                  <button
                    type="button"
                    className={styles.modalCancel}
                    onClick={closeModal}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <h2>API Key Generated</h2>
                <div className={styles.generatedKey}>
                  <div className={styles.generatedKeyLabel}>Your new API key</div>
                  <div className={styles.generatedKeyValue}>{generatedKey.key}</div>
                  <div className={styles.generatedKeyHint}>
                    Copy this key now — it won&apos;t be shown again.
                  </div>
                </div>
                <div className={styles.modalActions}>
                  <button
                    className={styles.modalSave}
                    onClick={() => copyToClipboard(generatedKey.key)}
                  >
                    Copy to Clipboard
                  </button>
                  <button
                    type="button"
                    className={styles.modalCancel}
                    onClick={closeModal}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
