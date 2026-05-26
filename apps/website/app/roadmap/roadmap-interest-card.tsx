'use client';

import { useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { slackUrl } from '@/lib/links';

export type RoadmapInterestFeature = {
  id: string;
  title: string;
  text: string;
  stage: string;
};

type InterestState = 'idle' | 'expanded' | 'submitting' | 'success' | 'error';

export function RoadmapInterestCard({ feature }: { feature: RoadmapInterestFeature }) {
  const [state, setState] = useState<InterestState>('idle');
  const [note, setNote] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  async function submitInterest() {
    setState('submitting');
    setError('');

    try {
      const response = await fetch('/api/roadmap-interest/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feature_id: feature.id,
          feature_title: feature.title,
          interest_type: 'vote',
          note,
          email,
          source_path: typeof window === 'undefined' ? '/roadmap' : window.location.pathname,
        }),
      });
      const body = await response.json().catch(() => null);

      if (!response.ok || !body?.ok) {
        setError(body?.message ?? body?.error ?? 'Could not record interest. Please try Slack instead.');
        setState('error');
        return;
      }

      setState('success');
    } catch {
      setError('Could not record interest. Please try Slack instead.');
      setState('error');
    }
  }

  const showForm = state === 'expanded' || state === 'submitting' || state === 'error';

  return (
    <article className="roadmap-card">
      <div>
        <span className="roadmap-pill">{feature.stage}</span>
        <h3>{feature.title}</h3>
        <p>{feature.text}</p>
      </div>

      {state === 'success' ? (
        <div className="roadmap-thanks">Thanks, noted. If there is personal context here, Slack is the best place.</div>
      ) : (
        <div className="roadmap-actions">
          {showForm && (
            <div className="roadmap-form">
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Optional: why does this matter for your product?"
                maxLength={1000}
              />
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Optional email, only if you want follow-up"
                type="email"
                maxLength={240}
              />
              {error && <p className="roadmap-error">{error}</p>}
            </div>
          )}
          <div className="roadmap-action-row">
            <button
              type="button"
              className="site-button site-button-primary"
              disabled={state === 'submitting'}
              onClick={() => {
                if (state === 'idle') {
                  setState('expanded');
                  return;
                }
                void submitInterest();
              }}
            >
              <Send size={16} aria-hidden />
              {state === 'submitting' ? 'Saving...' : state === 'idle' ? 'I want this' : 'Submit interest'}
            </button>
            <a className="site-button site-button-secondary" href={slackUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={16} aria-hidden />
              Discuss in Slack
            </a>
          </div>
        </div>
      )}
    </article>
  );
}
