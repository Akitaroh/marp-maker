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

    expect(render).toHaveBeenCalledWith(
      '# Hello',
      '/theme.css',
      expect.any(AbortSignal)
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
    expect(render).toHaveBeenCalledWith(
      'ABC',
      '/theme.css',
      expect.any(AbortSignal)
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

describe('Preview - zoom', () => {
  it('applies zoom via CSS transform', () => {
    const render = makeRenderFn()
    rtlRender(
      <Preview
        markdown=""
        themePath="/theme.css"
        render={render}
        zoom={1.5}
      />
    )

    const container = screen.getByTestId('preview-container')
    const wrap = container.querySelector('div')
    expect(wrap?.style.transform).toContain('scale(1.5)')
  })

  it('defaults zoom to 1.0', () => {
    const render = makeRenderFn()
    rtlRender(<Preview markdown="" themePath="/theme.css" render={render} />)

    const container = screen.getByTestId('preview-container')
    const wrap = container.querySelector('div')
    expect(wrap?.style.transform).toContain('scale(1)')
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
