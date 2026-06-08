'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'

interface Tab {
  label: string
  content: React.ReactNode
}

const tabs: Tab[] = [
  {
    label: 'Docker Service',
    content: (
      <>
        <div><span className="comment"># Start Postgres + MemexAI service</span></div>
        <div><span className="func">docker compose</span> up -d</div>
        <br />
        <div><span className="comment"># In your agent code:</span></div>
        <div><span className="keyword">const</span> memex = <span className="func">MemexAI</span>({'{'}</div>
        <div>  url: <span className="string">'http://localhost:8080'</span>,</div>
        <div>  apiKey: <span className="string">'dev-agent-key'</span></div>
        <div>{'}'})</div>
        <div><span className="keyword">const</span> memory = memex.<span className="func">memory</span>(<span className="string">'user-123'</span>)</div>
        <div><span className="keyword">const</span> tools = memory.<span className="func">createMemorySubagentToolset</span>()</div>
      </>
    ),
  },
  {
    label: 'Direct Postgres',
    content: (
      <>
        <div><span className="keyword">import</span> {'{'} <span className="func">createMemex</span> {'}'} <span className="keyword">from</span> <span className="string">'@memexai/core'</span></div>
        <br />
        <div><span className="keyword">const</span> memex = <span className="func">createMemex</span>(process.env.DATABASE_URL)</div>
        <div><span className="keyword">await</span> memex.<span className="func">migrate</span>() <span className="comment">// run once</span></div>
        <br />
        <div><span className="keyword">const</span> memory = memex.<span className="func">memory</span>(<span className="string">'user-123'</span>)</div>
        <div><span className="keyword">const</span> tools = memory.<span className="func">createMemorySubagentToolset</span>()</div>
        <div><span className="keyword">const</span> prompt = <span className="keyword">await</span> memory.<span className="func">getSystemPrompt</span>()</div>
      </>
    ),
  },
  {
    label: 'MCP',
    content: (
      <>
        <div><span className="comment"># Add to your MCP client config:</span></div>
        <div>{'{'}</div>
        <div>  <span className="string">"memexai"</span>: {'{'}</div>
        <div>    <span className="string">"command"</span>: <span className="string">"npx"</span>,</div>
        <div>    <span className="string">"args"</span>: [<span className="string">"@memexai/mcp"</span>],</div>
        <div>    <span className="string">"env"</span>: {'{'}</div>
        <div>      <span className="string">"MEMEX_URL"</span>: <span className="string">"http://localhost:8080"</span>,</div>
        <div>      <span className="string">"MEMEX_API_KEY"</span>: <span className="string">"dev-agent-key"</span></div>
        <div>    {'}'}</div>
        <div>  {'}'}</div>
        <div>{'}'}</div>
      </>
    ),
  },
]

export function CodeSwitcher() {
  const [active, setActive] = useState(0)

  return (
    <div className="mx-code-switcher">
      <div className="mx-code-tabs">
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            className={`mx-code-tab ${i === active ? 'active' : ''}`}
            onClick={() => setActive(i)}
          >
            {tab.label}
            {i === active && (
              <motion.div
                className="mx-code-tab-indicator"
                layoutId="code-tab-indicator"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>
      <div className="mx-code-body">
        {tabs[active].content}
      </div>
    </div>
  )
}
