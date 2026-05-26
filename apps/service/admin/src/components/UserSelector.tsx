import {
  Box,
  Combobox,
  Group,
  Loader,
  Text,
  TextInput,
  useCombobox,
} from "@mantine/core"
import { useDebouncedValue } from "@mantine/hooks"
import { useEffect, useMemo, useState } from "react"
import { useAdminUsersQuery } from "../playground-api"
import type { AdminUser } from "../types"
import { relativeTime } from "../utils"

export function UserSelector({
  secret,
  value,
  onChange,
  compact = false,
  dropdownWidth,
}: {
  secret: string
  value: string
  onChange: (userId: string) => void
  compact?: boolean
  dropdownWidth?: number | string
}) {
  const [search, setSearch] = useState(value)
  const [debouncedSearch] = useDebouncedValue(search, 180)
  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
  })
  const { data, isFetching } = useAdminUsersQuery({
    secret,
    q: debouncedSearch,
    limit: 50,
  })
  const users = data?.users ?? []
  const hasExactMatch = users.some((user) => user.userId === search.trim())

  useEffect(() => {
    setSearch(value)
  }, [value])

  const options = useMemo(() => users.map((user) => (
    <Combobox.Option value={user.userId} key={user.userId}>
      <UserOption user={user} />
    </Combobox.Option>
  )), [users])

  return (
    <Combobox
      store={combobox}
      withinPortal
      width={dropdownWidth}
      onOptionSubmit={(nextValue) => {
        onChange(nextValue)
        setSearch(nextValue)
        combobox.closeDropdown()
      }}
    >
      <Combobox.Target>
        <TextInput
          aria-label="User ID"
          label={compact ? undefined : "User"}
          value={search}
          onChange={(event) => {
            const nextValue = event.currentTarget.value
            setSearch(nextValue)
            onChange(nextValue)
            combobox.openDropdown()
          }}
          onFocus={() => combobox.openDropdown()}
          onBlur={() => {
            onChange(search.trim())
            combobox.closeDropdown()
          }}
          placeholder="Search or enter a userId..."
          size={compact ? "xs" : "sm"}
          rightSection={isFetching ? <Loader size={14} /> : <Combobox.Chevron />}
          styles={{
            input: {
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontSize: compact ? 11 : 12,
            },
            label: {
              color: "var(--mantine-color-gray-6)",
              fontSize: 12,
              fontWeight: 700,
              marginBottom: 6,
            },
          }}
        />
      </Combobox.Target>
      <Combobox.Dropdown>
        <Combobox.Options mah={280} style={{ overflowY: "auto" }}>
          {options}
          {search.trim() && !hasExactMatch && (
            <Combobox.Option value={search.trim()}>
              <Group gap="xs" wrap="nowrap">
                <Text size="sm" ff="monospace" truncate>{search.trim()}</Text>
                <Text size="xs" c="dimmed">Use new user ID</Text>
              </Group>
            </Combobox.Option>
          )}
          {!users.length && !search.trim() && (
            <Combobox.Empty>Type to search users.</Combobox.Empty>
          )}
          {!users.length && search.trim() && hasExactMatch && (
            <Combobox.Empty>No users found.</Combobox.Empty>
          )}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  )
}

function UserOption({ user }: { user: AdminUser }) {
  return (
    <Group justify="space-between" wrap="nowrap" gap="md">
      <Box style={{ minWidth: 0 }}>
        <Text size="sm" ff="monospace" truncate>{user.userId}</Text>
        <Text size="xs" c="dimmed">{user.fileCount} files</Text>
      </Box>
      <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
        {user.lastWriteAt ? relativeTime(user.lastWriteAt) : "No writes"}
      </Text>
    </Group>
  )
}
