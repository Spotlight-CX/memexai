'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { GitCommit } from 'lucide-react'

export function DiffWidget() {
  const [showRev5, setShowRev5] = useState(false)

  return (
    <div className="mx-diff-widget">
      <div className="mx-diff-header">
        <span className="mx-diff-path">
          <GitCommit size={14} aria-hidden style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
          user/profile.md
        </span>
        <span className="mx-diff-rev">
          {showRev5 ? 'Rev 4 → Rev 5' : 'Rev 4 (current)'}
        </span>
      </div>

      <div className="mx-diff-body">
        {showRev5 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <span className="mx-diff-line mx-diff-unchanged">
              <span className="mx-diff-marker"> </span>name: Priya Sharma
            </span>
            <span className="mx-diff-line mx-diff-removed">
              <span className="mx-diff-marker">−</span>location: Bangalore
            </span>
            <span className="mx-diff-line mx-diff-added">
              <span className="mx-diff-marker">+</span>location: Mumbai
            </span>
            <span className="mx-diff-line mx-diff-removed">
              <span className="mx-diff-marker">−</span>moved_from: null
            </span>
            <span className="mx-diff-line mx-diff-added">
              <span className="mx-diff-marker">+</span>moved_from: Bangalore
            </span>
            <span className="mx-diff-line mx-diff-unchanged">
              <span className="mx-diff-marker"> </span>prefers: dark mode, concise replies
            </span>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <span className="mx-diff-line mx-diff-unchanged">
              <span className="mx-diff-marker"> </span>name: Priya Sharma
            </span>
            <span className="mx-diff-line mx-diff-unchanged">
              <span className="mx-diff-marker"> </span>location: Bangalore
            </span>
            <span className="mx-diff-line mx-diff-unchanged">
              <span className="mx-diff-marker"> </span>moved_from: null
            </span>
            <span className="mx-diff-line mx-diff-unchanged">
              <span className="mx-diff-marker"> </span>prefers: dark mode, concise replies
            </span>
          </motion.div>
        )}
      </div>

      <div style={{ padding: '0 20px 16px' }}>
        <button
          onClick={() => setShowRev5(!showRev5)}
          style={{
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: 8,
            padding: '8px 16px',
            background: 'rgba(16, 185, 129, 0.08)',
            color: '#10b981',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background 0.15s ease',
          }}
        >
          {showRev5 ? 'Show Rev 4 (before)' : 'Show correction (Rev 4 → 5)'}
        </button>
      </div>

      <div className="mx-access-log">
        <div className="mx-access-log-title">Access Log</div>
        <div className="mx-access-log-entry">
          <span className="time">14:22:01</span>
          <span className="op-read">READ</span>
          <span className="path">user/profile.md</span>
          <span className="reason">tool_call_id: tc_a83f</span>
        </div>
        <div className="mx-access-log-entry">
          <span className="time">14:22:03</span>
          <span className="op-write">WRITE</span>
          <span className="path">user/profile.md</span>
          <span className="reason">reason: &quot;user corrected location&quot;</span>
        </div>
      </div>
    </div>
  )
}
