import { StrictMode, useEffect, useRef } from 'react'
import { fireEvent, render } from '@testing-library/react'
import { proxy, ref, useSnapshot } from 'valtio'

const consoleError = console.error
beforeEach(() => {
  console.error = jest.fn((message) => {
    if (
      process.env.NODE_ENV === 'production' &&
      message.startsWith('act(...) is not supported in production')
    ) {
      return
    }
    consoleError(message)
  })
})
afterEach(() => {
  console.error = consoleError
})

it('should trigger re-render setting objects with ref wrapper', async () => {
  const obj = proxy({ nested: ref({ count: 0 }) })

  const Counter = () => {
    const snap = useSnapshot(obj)
    const commitsRef = useRef(1)
    useEffect(() => {
      commitsRef.current += 1
    })
    return (
      <>
        <div>
          count: {snap.nested.count} ({commitsRef.current})
        </div>
        <button onClick={() => (obj.nested = ref({ count: 0 }))}>button</button>
      </>
    )
  }

  const { getByText, findByText } = render(
    <StrictMode>
      <Counter />
    </StrictMode>
  )

  await findByText('count: 0 (1)')

  fireEvent.click(getByText('button'))
  await findByText('count: 0 (2)')
})

it('should not track object wrapped in ref assigned to proxy state', async () => {
  const obj = proxy<{ ui: JSX.Element | null }>({ ui: null })

  const Component = () => {
    const snap = useSnapshot(obj)
    return (
      <>
        {snap.ui || <span>original</span>}
        <button onClick={() => (obj.ui = ref(<span>replace</span>))}>
          button
        </button>
      </>
    )
  }

  const { getByText, findByText } = render(
    <StrictMode>
      <Component />
    </StrictMode>
  )

  await findByText('original')

  fireEvent.click(getByText('button'))
  await findByText('replace')
})

it('should not trigger re-render when mutating object wrapped in ref', async () => {
  const obj = proxy({ nested: ref({ count: 0 }) })

  const Counter = () => {
    const snap = useSnapshot(obj)
    return (
      <>
        <div>count: {snap.nested.count}</div>
        <button onClick={() => ++obj.nested.count}>button</button>
      </>
    )
  }

  const { getByText, findByText } = render(
    <StrictMode>
      <Counter />
    </StrictMode>
  )

  await findByText('count: 0')

  fireEvent.click(getByText('button'))
  await findByText('count: 0')
})
