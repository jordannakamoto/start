import { useEffect } from 'react'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { debounce } from 'lodash-es'
import { EditorState } from 'lexical'

interface DebouncedStatePluginProps {
  onStateChange: (editorState: EditorState) => void
  debounceMs?: number
}

export function DebouncedStatePlugin({
  onStateChange,
  debounceMs = 200,
}: DebouncedStatePluginProps) {

  const debouncedOnChange = debounce((editorState: EditorState) => {
    onStateChange(editorState)
  }, debounceMs)

  useEffect(() => {
    return () => {
      debouncedOnChange.cancel()
    }
  }, [debouncedOnChange])

  return (
    <OnChangePlugin
      onChange={debouncedOnChange}
      ignoreHistoryMergeTagChange={true}
      ignoreSelectionChange={true}
    />
  )
}