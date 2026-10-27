import { describe, expect, it } from 'vitest'
import { needsHighlighter } from './use-highlighter'

describe('needsHighlighter', () => {
  it.each([
    ['a fenced block that names its language', '```python\nprint("hi")\n```', true],
    ['a tilde fence that names its language', '~~~js\nconst a = 1\n~~~', true],
    ['a fence with a space before the language', '``` sql\nSELECT 1\n```', true],
    ['a code block after a diagram', '```mermaid\ngraph TD\n  A --> B\n```\n\n```bash\nnpm test\n```', true],
    ['a diagram alone, which is drawn instead', '```mermaid\ngraph TD\n  A --> B\n```', false],
    ['a fence that names no language', '```\nplain text\n```', false],
    ['inline code', 'Run `npm test` first.', false],
    ['prose', 'He is available from January 2027.', false],
  ])('%s', (_case, markdown, expected) => {
    expect(needsHighlighter(markdown)).toBe(expected)
  })
})
