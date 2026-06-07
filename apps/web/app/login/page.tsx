'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import styles from './login.module.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const res = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });
    if (res?.error) {
      setError('Invalid credentials. Use an email ending with @flagforge.local');
    } else {
      window.location.href = '/flags';
    }
  };

  return (
    <div className={styles.container}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <h1>FlagForge</h1>
        <p className={styles.subtitle}>Sign in to manage feature flags</p>
        {error && <div className={styles.error}>{error}</div>}
        <label className={styles.label}>
          Email
          <input
            type="email"
            className={styles.input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@flagforge.local"
            required
          />
        </label>
        <label className={styles.label}>
          Password
          <input
            type="password"
            className={styles.input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="any password"
            required
          />
        </label>
        <button type="submit" className={styles.button}>
          Sign In
        </button>
      </form>
    </div>
  );
}
