'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Folder, FileText, Lock, Globe } from 'lucide-react'

interface MemoryFile {
  name: string
  path: string
  scope: 'private' | 'shared'
  content: string
  meta: string
}

const files: MemoryFile[] = [
  {
    name: 'profile.md',
    path: 'user/profile.md',
    scope: 'private',
    content: `name: Priya Sharma\nlocation: Mumbai\nprefers: dark mode, concise replies\ntimezone: IST\nlast_topic: apartment search in Andheri`,
    meta: 'Private · Writable · 3 revisions',
  },
  {
    name: 'preferences.md',
    path: 'user/preferences.md',
    scope: 'private',
    content: `response_style: concise\nformat: markdown\nlanguage: en\navoid: jargon, filler phrases\nremember: budget constraints`,
    meta: 'Private · Writable · 1 revision',
  },
  {
    name: 'policy.md',
    path: 'shared/policy.md',
    scope: 'shared',
    content: `# Agent Policy\n\n- Never share user data across tenants\n- Always cite sources for factual claims\n- Escalate billing questions to humans\n- Use metric units unless user prefers imperial`,
    meta: 'Global · Read-only · 2 revisions',
  },
  {
    name: 'style-guide.md',
    path: 'shared/style-guide.md',
    scope: 'shared',
    content: `# Response Style Guide\n\n- Keep replies under 200 words\n- Use bullet points for lists\n- Bold key terms on first mention\n- End with a follow-up question`,
    meta: 'Global · Read-only · 1 revision',
  },
]

export function FileBrowser() {
  const [selected, setSelected] = useState(0)
  const file = files[selected]

  return (
    <div className="mx-file-browser">
      <div className="mx-file-tree">
        <div className="mx-file-tree-header">Memory Files</div>
        <div className="mx-file-tree-dir">
          <Folder size={14} aria-hidden /> user/
        </div>
        {files.filter(f => f.scope === 'private').map((f) => {
          const idx = files.indexOf(f)
          return (
            <button
              key={f.path}
              className={`mx-file-tree-item ${idx === selected ? 'active' : ''}`}
              onClick={() => setSelected(idx)}
              style={{ paddingLeft: 32 }}
            >
              <FileText size={13} aria-hidden />
              {f.name}
            </button>
          )
        })}
        <div className="mx-file-tree-dir">
          <Folder size={14} aria-hidden /> shared/
        </div>
        {files.filter(f => f.scope === 'shared').map((f) => {
          const idx = files.indexOf(f)
          return (
            <button
              key={f.path}
              className={`mx-file-tree-item ${idx === selected ? 'active' : ''}`}
              onClick={() => setSelected(idx)}
              style={{ paddingLeft: 32 }}
            >
              <FileText size={13} aria-hidden />
              {f.name}
            </button>
          )
        })}
      </div>

      <div className="mx-file-preview">
        <AnimatePresence mode="wait">
          <motion.div
            key={file.path}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <div className="mx-file-preview-header">
              <span>{file.path}</span>
              {file.scope === 'private' ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#fbbf24' }}>
                  <Lock size={12} aria-hidden /> Private
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#60a5fa' }}>
                  <Globe size={12} aria-hidden /> Global
                </span>
              )}
            </div>
            {file.content.split('\n').map((line, i) => (
              <div key={i}>
                {line.startsWith('#') ? (
                  <span className="heading">{line}</span>
                ) : line.includes(':') && !line.startsWith('-') ? (
                  <>
                    <span className="key">{line.split(':')[0]}:</span>
                    <span className="val">{line.split(':').slice(1).join(':')}</span>
                  </>
                ) : (
                  <span>{line}</span>
                )}
              </div>
            ))}
            <div className="mx-file-preview-meta">
              {file.meta}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
