import React from 'react'
import { Box, Text } from 'ink'

export function WindowHeader() {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box gap={1}>
        <Text color="#58a6ff">╸◆╺</Text>
        <Text bold color="#e6edf3">TRACELENS</Text>
        <Text color="#6e7681">  claude code monitor</Text>
      </Box>
      <Text color="#21262d">{'─'.repeat(76)}</Text>
    </Box>
  )
}
