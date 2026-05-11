export function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="10" height="10" viewBox="0 0 10 10" fill="none"
      style={{
        transform: expanded ? "rotate(90deg)" : "none",
        transition: "transform 100ms ease",
        flexShrink: 0,
        color: "var(--mantine-color-gray-5)",
      }}
    >
      <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function FolderIcon({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path
        d="M1.5 4.5A1 1 0 012.5 3.5H6L7.5 5H13.5A1 1 0 0114.5 6V12.5A1 1 0 0113.5 13.5H2.5A1 1 0 011.5 12.5V4.5Z"
        fill={open ? "#f0b429" : "#de9b23"}
      />
    </svg>
  )
}

export function FileDocIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M2 1.5A1 1 0 013 0.5H9L13.5 5V14.5A1 1 0 0112.5 15.5H3A1 1 0 012 14.5V1.5Z" fill="#c0cdd8" />
      <path d="M9 0.5V4.5H13.5" fill="#dce6ed" />
      <path d="M9 0.5V4.5H13.5" stroke="#b0c0cc" strokeWidth="0.75" fill="none" />
    </svg>
  )
}

export function DotsHorizontalIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="2.5" cy="8" r="1.5" />
      <circle cx="8" cy="8" r="1.5" />
      <circle cx="13.5" cy="8" r="1.5" />
    </svg>
  )
}

export function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 15 15" fill="none">
      <path d="M11.5 1.5l2 2-9 9H2.5v-2l9-9z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M9.5 3.5l2 2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

export function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
