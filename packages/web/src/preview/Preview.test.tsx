/**
 * ZDD Atom: Atom-Preview のテスト (React Testing Library)。
 *
 * 検証経路は設計 doc 参照:
 * 50_Mission/zddmission/MarpMaker/Atom-Preview.md "検証経路" セクション
 *
 * NOTE: debounce / cancellation は実 timer (setTimeout) で検証。
 * Vitest の fake timer は React 18 の concurrent rendering と相性が悪く、
 * waitFor が timeout するケースが頻発したため実 timer に切替。
 * 1 ケース当たり最大 ~500ms、合計 ~2-3 秒の test 実行時間に抑える。
 */

import { describe, it, expect, vi } from 'vitest'
import { render as rtlRender, screen, waitFor } from '@testing-library/react'

import { Preview, type RenderFn } from './Preview'

const RENDER_WAIT = 500 // debounce 300ms + render Promise resolve + React flush に十分

// ===== Helpers =====

function makeRenderFn(html = '<html><body>rendered</body></html>'): RenderFn {
  return vi.fn(async () => html)
}

function makeFailingRender(errorMessage = 'render failed'): RenderFn {
  return vi.fn(async () => {
    throw new Error(errorMessage)
  })
}

// ===== Tests =====

describe('Preview - idle state', () => {
  it('shows placeholder when markdown is empty', () => {
    const render = makeRenderFn()
    rtlRender(<Preview markdown="" themePath="/theme.css" render={render} />)

    expect(
      screen.getByText(/Markdown を入力するとプレビュー/)
    ).toBeInTheDocument()
    expect(render).not.toHaveBeenCalled()
  })

  it('shows placeholder when markdown is whitespace only', () => {
    const render = makeRenderFn()
    rtlRender(
      <Preview markdown={'   \n\n  '} themePath="/theme.css" render={render} />
    )

    expect(screen.getByText(/Markdown を入力すると/)).toBeInTheDocument()
    expect(render).not.toHaveBeenCalled()
  })
})

describe('Preview - rendering / ready', () => {
  it('shows rendering status immediately, then ready iframe after render', async () => {
    const render = makeRenderFn('<html>HELLO</html>')
    rtlRender(<Preview markdown="# Hello" themePath="/theme.css" render={render} />)

    // debounce 前: rendering 状態 (setStatus('rendering') が即座)
    expect(screen.getByRole('status')).toBeInTheDocument()

    // debounce + render 完了を待つ
    await waitFor(
      () => {
        expect(screen.getByTitle('Marp プレビュー')).toBeInTheDocument()
      },
      { timeout: RENDER_WAIT }
    )

    // dogfood-fix 1: 第 4 引数 template が渡される（default mode='document' → 'bare'）
    expect(render).toHaveBeenCalledWith(
      '# Hello',
      '/theme.css',
      expect.any(AbortSignal),
      'bare'
    )

    const iframe = screen.getByTitle('Marp プレビュー')
    expect(iframe).toHaveAttribute('sandbox', 'allow-same-origin')
    expect(iframe).toHaveAttribute('srcDoc', '<html>HELLO</html>')

    // 完了後は status overlay が消える
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('debounces rapid markdown changes - only last value renders', async () => {
    const render = makeRenderFn('<html>final</html>')
    const { rerender } = rtlRender(
      <Preview markdown="A" themePath="/theme.css" render={render} />
    )

    // 連続変更 (debounce 300ms 以内)
    rerender(<Preview markdown="AB" themePath="/theme.css" render={render} />)
    rerender(<Preview markdown="ABC" themePath="/theme.css" render={render} />)

    // render 完了まで待つ
    await waitFor(
      () => {
        expect(screen.getByTitle('Marp プレビュー')).toBeInTheDocument()
      },
      { timeout: RENDER_WAIT }
    )

    // 最終的に呼ばれた回数は 1 回、最後の値 (ABC) のみ
    expect(render).toHaveBeenCalledTimes(1)
    // dogfood-fix 1: template 引数を含む（default 'bare'）
    expect(render).toHaveBeenCalledWith(
      'ABC',
      '/theme.css',
      expect.any(AbortSignal),
      'bare'
    )
  })
})

describe('Preview - error state', () => {
  it('shows error overlay when render rejects', async () => {
    const render = makeFailingRender('marp-cli failed')
    rtlRender(<Preview markdown="# X" themePath="/theme.css" render={render} />)

    await waitFor(
      () => {
        expect(screen.getByRole('alert')).toBeInTheDocument()
      },
      { timeout: RENDER_WAIT }
    )

    expect(screen.getByText('marp-cli failed')).toBeInTheDocument()
    expect(screen.getByText(/レンダリングに失敗/)).toBeInTheDocument()
  })

  it('fires onError callback when render rejects', async () => {
    const render = makeFailingRender('API down')
    const onError = vi.fn()
    rtlRender(
      <Preview
        markdown="# X"
        themePath="/theme.css"
        render={render}
        onError={onError}
      />
    )

    await waitFor(
      () => {
        expect(onError).toHaveBeenCalled()
      },
      { timeout: RENDER_WAIT }
    )

    expect(onError).toHaveBeenCalledTimes(1)
    const errorArg = onError.mock.calls[0]?.[0] as Error
    expect(errorArg).toBeInstanceOf(Error)
    expect(errorArg.message).toBe('API down')
  })
})

describe('Preview - zoom (presentation mode only)', () => {
  // dogfood-fix 1: zoom は presentation mode の iframeWrap にのみ適用
  // document mode では iframeWrap の transform は使用しない（縦スクロール）
  it('applies zoom via CSS transform in presentation mode', () => {
    const render = makeRenderFn()
    rtlRender(
      <Preview
        markdown=""
        themePath="/theme.css"
        render={render}
        mode="presentation"
        zoom={1.5}
      />
    )

    const container = screen.getByTestId('preview-container')
    // iframeWrap は toolbar の次の div
    const allDivs = container.querySelectorAll('div')
    const wrap = Array.from(allDivs).find(
      (d) => d.style.transform && d.style.transform.includes('scale')
    )
    expect(wrap?.style.transform).toContain('scale(1.5)')
  })

  it('does not apply transform in document mode', () => {
    const render = makeRenderFn()
    rtlRender(
      <Preview
        markdown=""
        themePath="/theme.css"
        render={render}
        mode="document"
        zoom={1.5}
      />
    )

    const container = screen.getByTestId('preview-container')
    const allDivs = container.querySelectorAll('div')
    const wrap = Array.from(allDivs).find(
      (d) => d.style.transform && d.style.transform.includes('scale')
    )
    expect(wrap).toBeUndefined()
  })
})

describe('Preview - mode toggle (dogfood-fix 1)', () => {
  it('renders toolbar with mode radio buttons', () => {
    const render = makeRenderFn()
    rtlRender(<Preview markdown="" themePath="/theme.css" render={render} />)

    expect(screen.getByTestId('preview-mode-document')).toBeInTheDocument()
    expect(screen.getByTestId('preview-mode-presentation')).toBeInTheDocument()
  })

  it('defaults mode to document', () => {
    const render = makeRenderFn()
    rtlRender(<Preview markdown="" themePath="/theme.css" render={render} />)

    const docBtn = screen.getByTestId('preview-mode-document')
    expect(docBtn).toHaveAttribute('aria-checked', 'true')
  })

  it('reflects mode prop value in radio button state', () => {
    const render = makeRenderFn()
    rtlRender(
      <Preview
        markdown=""
        themePath="/theme.css"
        render={render}
        mode="presentation"
      />
    )

    expect(screen.getByTestId('preview-mode-presentation')).toHaveAttribute(
      'aria-checked',
      'true'
    )
    expect(screen.getByTestId('preview-mode-document')).toHaveAttribute(
      'aria-checked',
      'false'
    )
  })

  it('calls onModeChange when toggling to presentation', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    const render = makeRenderFn()
    const onModeChange = vi.fn()
    rtlRender(
      <Preview
        markdown=""
        themePath="/theme.css"
        render={render}
        mode="document"
        onModeChange={onModeChange}
      />
    )

    await user.click(screen.getByTestId('preview-mode-presentation'))

    expect(onModeChange).toHaveBeenCalledTimes(1)
    expect(onModeChange).toHaveBeenCalledWith('presentation')
  })

  it('passes "bare" template when mode is document', async () => {
    const render = makeRenderFn('<html>doc</html>')
    rtlRender(
      <Preview
        markdown="# X"
        themePath="/theme.css"
        render={render}
        mode="document"
      />
    )

    await waitFor(
      () => expect(screen.getByTitle('Marp プレビュー')).toBeInTheDocument(),
      { timeout: RENDER_WAIT }
    )

    expect(render).toHaveBeenCalledWith(
      '# X',
      '/theme.css',
      expect.any(AbortSignal),
      'bare'
    )
  })

  it('passes "bespoke" template when mode is presentation', async () => {
    const render = makeRenderFn('<html>slide</html>')
    rtlRender(
      <Preview
        markdown="# X"
        themePath="/theme.css"
        render={render}
        mode="presentation"
      />
    )

    await waitFor(
      () => expect(screen.getByTitle('Marp プレビュー')).toBeInTheDocument(),
      { timeout: RENDER_WAIT }
    )

    expect(render).toHaveBeenCalledWith(
      '# X',
      '/theme.css',
      expect.any(AbortSignal),
      'bespoke'
    )
  })
})

describe('Preview - sandbox security', () => {
  it('iframe sandbox attribute is allow-same-origin only (no scripts)', async () => {
    const render = makeRenderFn('<html></html>')
    rtlRender(<Preview markdown="# X" themePath="/theme.css" render={render} />)

    const iframe = await screen.findByTitle(
      'Marp プレビュー',
      undefined,
      { timeout: RENDER_WAIT }
    )

    // script 実行は禁止 (allow-scripts なし)
    expect(iframe.getAttribute('sandbox')).toBe('allow-same-origin')
  })
})
