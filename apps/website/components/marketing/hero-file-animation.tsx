'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, GitCommit, Eye, Clock } from 'lucide-react'

const fileLines = [
  { key: 'name', text: 'name: Alex Chen' },
  { key: 'loc', text: 'location: London' },
  { key: 'pref', text: 'prefers: dark mode, concise replies' },
  { key: 'tz', text: 'timezone: GMT' },
  { key: 'topic', text: 'last_topic: apartment search in Shoreditch' },
  { key: 'blank', text: '' },
  { key: 'heading', text: '## History', className: 'heading' },
  { key: 'h1', text: '- Moved from New York (corrected Rev 2→3)', className: 'corrected' },
  { key: 'h2', text: '- Prefers 2-bedroom, budget £600k', className: 'history' },
]

export function HeroFileAnimation() {
  const [visibleCount, setVisibleCount] = useState(0)
  const [revision, setRevision] = useState(1)
  const [timeAgo, setTimeAgo] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setVisibleCount((c) => {
        if (c < fileLines.length) return c + 1
        return c
      })
    }, 280)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (visibleCount < fileLines.length) return
    // After all lines visible, increment revision periodically
    const revTimer = setInterval(() => {
      setRevision((r) => {
        if (r < 3) return r + 1
        return r
      })
    }, 2000)
    return () => clearInterval(revTimer)
  }, [visibleCount])

  useEffect(() => {
    const tick = setInterval(() => {
      setTimeAgo((t) => t + 1)
    }, 1000)
    return () => clearInterval(tick)
  }, [])

  const formatTime = (s: number) => {
    if (s < 60) return `${s}s ago`
    return `${Math.floor(s / 60)}m ago`
  }

  return (
    <div className="mx-living-file">
      <div className="mx-living-file-header">
        <span className="mx-living-file-path">
          <FileText size={14} aria-hidden />
          user/profile.md
        </span>
        <motion.span
          className="mx-living-file-rev"
          key={revision}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          Rev {revision} · {formatTime(timeAgo)}
        </motion.span>
      </div>

      <div className="mx-living-file-body">
        <AnimatePresence>
          {fileLines.slice(0, visibleCount).map((line, i) => (
            <motion.div
              key={line.key}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className={line.className || ''}
            >
              {line.text ? (
                line.text.includes(':') && !line.text.startsWith('#') && !line.text.startsWith('-') ? (
                  <>
                    <span className="key">{line.text.split(':')[0]}:</span>
                    <span className="val">{line.text.split(':').slice(1).join(':')}</span>
                  </>
                ) : (
                  line.text
                )
              ) : (
                <br />
              )}
              {i === visibleCount - 1 && visibleCount < fileLines.length && (
                <span className="mx-cursor" />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="mx-living-file-footer">
        <span><GitCommit size={12} aria-hidden /> {revision} revisions</span>
        <span><Eye size={12} aria-hidden /> 7 reads</span>
        <span><Clock size={12} aria-hidden /> last write {formatTime(timeAgo)}</span>
      </div>
    </div>
  )
}
