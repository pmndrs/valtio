import { StrictMode, useEffect, useRef, useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { proxy, snapshot, useSnapshot } from 'valtio'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

const useCommitCount = () => {
  const commitCountRef = useRef(1)
  useEffect(() => {
    commitCountRef.current += 1
  })
  return commitCountRef.current
}

it('simple counter', async () => {
  const obj = proxy({ count: 0 })

  const Counter = () => {
    const snap = useSnapshot(obj)
    return (
      <>
        <div>count: {snap.count}</div>
        <button onClick={() => ++obj.count}>button</button>
      </>
    )
  }

  const { unmount } = render(
    <StrictMode>
      <Counter />
    </StrictMode>,
  )

  await vi.waitFor(async () =>
    expect(screen.getByText('count: 0')).toBeInTheDocument(),
  )

  fireEvent.click(screen.getByText('button'))
  await vi.waitFor(async () =>
    expect(screen.getByText('count: 1')).toBeInTheDocument(),
  )
  unmount()
})

it('no extra re-renders (commits)', async () => {
  const obj = proxy({ count: 0, count2: 0 })

  const Counter = () => {
    const snap = useSnapshot(obj)
    return (
      <>
        <div>
          count: {snap.count} ({useCommitCount()})
        </div>
        <button onClick={() => ++obj.count}>button</button>
      </>
    )
  }

  const Counter2 = () => {
    const snap = useSnapshot(obj)
    return (
      <>
        <div>
          count2: {snap.count2} ({useCommitCount()})
        </div>
        <button onClick={() => ++obj.count2}>button2</button>
      </>
    )
  }

  render(
    <>
      <Counter />
      <Counter2 />
    </>,
  )

  await vi.waitFor(() => {
    expect(screen.getByText('count: 0 (1)')).toBeInTheDocument()
    expect(screen.getByText('count2: 0 (1)')).toBeInTheDocument()
  })

  fireEvent.click(screen.getByText('button'))
  await vi.waitFor(() => {
    expect(screen.getByText('count: 1 (2)')).toBeInTheDocument()
    expect(screen.getByText('count2: 0 (1)')).toBeInTheDocument()
  })

  fireEvent.click(screen.getByText('button2'))
  await vi.waitFor(() => {
    expect(screen.getByText('count: 1 (2)')).toBeInTheDocument()
    expect(screen.getByText('count2: 1 (2)')).toBeInTheDocument()
  })
})

it('no extra re-renders (render func calls in non strict mode)', async () => {
  const obj = proxy({ count: 0, count2: 0 })

  const renderFn = vi.fn()
  const Counter = () => {
    const snap = useSnapshot(obj)
    renderFn(snap.count)
    return (
      <>
        <div>count: {snap.count}</div>
        <button onClick={() => ++obj.count}>button</button>
      </>
    )
  }

  const renderFn2 = vi.fn()
  const Counter2 = () => {
    const snap = useSnapshot(obj)
    renderFn2(snap.count2)
    return (
      <>
        <div>count2: {snap.count2}</div>
        <button onClick={() => ++obj.count2}>button2</button>
      </>
    )
  }

  render(
    <>
      <Counter />
      <Counter2 />
    </>,
  )

  await vi.waitFor(() => {
    expect(screen.getByText('count: 0')).toBeInTheDocument()
    expect(screen.getByText('count2: 0')).toBeInTheDocument()
  })
  expect(renderFn).toBeCalledTimes(1)
  expect(renderFn).lastCalledWith(0)
  expect(renderFn2).toBeCalledTimes(1)
  expect(renderFn2).lastCalledWith(0)

  fireEvent.click(screen.getByText('button'))
  await vi.waitFor(() => {
    expect(screen.getByText('count: 1')).toBeInTheDocument()
    expect(screen.getByText('count2: 0')).toBeInTheDocument()
  })
  expect(renderFn).toBeCalledTimes(2)
  expect(renderFn).lastCalledWith(1)
  expect(renderFn2).toBeCalledTimes(1)
  expect(renderFn2).lastCalledWith(0)

  fireEvent.click(screen.getByText('button2'))
  await vi.waitFor(() => {
    expect(screen.getByText('count: 1')).toBeInTheDocument()
    expect(screen.getByText('count2: 1')).toBeInTheDocument()
  })
  expect(renderFn).toBeCalledTimes(2)
  expect(renderFn).lastCalledWith(1)
  expect(renderFn2).toBeCalledTimes(2)
  expect(renderFn2).lastCalledWith(1)

  fireEvent.click(screen.getByText('button2'))
  await vi.waitFor(() => {
    expect(screen.getByText('count: 1')).toBeInTheDocument()
    expect(screen.getByText('count2: 2')).toBeInTheDocument()
  })
  expect(renderFn).toBeCalledTimes(2)
  expect(renderFn).lastCalledWith(1)
  expect(renderFn2).toBeCalledTimes(3)
  expect(renderFn2).lastCalledWith(2)

  fireEvent.click(screen.getByText('button'))
  await vi.waitFor(() => {
    expect(screen.getByText('count: 2')).toBeInTheDocument()
    expect(screen.getByText('count2: 2')).toBeInTheDocument()
  })
  expect(renderFn).toBeCalledTimes(3)
  expect(renderFn).lastCalledWith(2)
  expect(renderFn2).toBeCalledTimes(3)
  expect(renderFn2).lastCalledWith(2)
})

it('object in object', async () => {
  const obj = proxy({ object: { count: 0 } })

  const Counter = () => {
    const snap = useSnapshot(obj)
    return (
      <>
        <div>count: {snap.object.count}</div>
        <button onClick={() => ++obj.object.count}>button</button>
      </>
    )
  }

  render(
    <StrictMode>
      <Counter />
    </StrictMode>,
  )

  await vi.waitFor(() =>
    expect(screen.getByText('count: 0')).toBeInTheDocument(),
  )

  fireEvent.click(screen.getByText('button'))
  await vi.waitFor(() =>
    expect(screen.getByText('count: 1')).toBeInTheDocument(),
  )
})

it('array in object', async () => {
  const obj = proxy({ counts: [0, 1, 2] })

  const Counter = () => {
    const snap = useSnapshot(obj)
    return (
      <>
        <div>counts: {snap.counts.join(',')}</div>
        <button onClick={() => obj.counts.push(obj.counts.length)}>
          button
        </button>
      </>
    )
  }

  render(
    <StrictMode>
      <Counter />
    </StrictMode>,
  )

  await vi.waitFor(() =>
    expect(screen.getByText('counts: 0,1,2')).toBeInTheDocument(),
  )

  fireEvent.click(screen.getByText('button'))
  await vi.waitFor(() =>
    expect(screen.getByText('counts: 0,1,2,3')).toBeInTheDocument(),
  )
})

it('array pop and splice', async () => {
  const arr = proxy([0, 1, 2])

  const Counter = () => {
    const snap = useSnapshot(arr)
    return (
      <>
        <div>counts: {snap.join(',')}</div>
        <button onClick={() => arr.pop()}>button</button>
        <button onClick={() => arr.splice(1, 0, 10, 11)}>button2</button>
      </>
    )
  }

  render(
    <StrictMode>
      <Counter />
    </StrictMode>,
  )

  await vi.waitFor(() =>
    expect(screen.getByText('counts: 0,1,2')).toBeInTheDocument(),
  )

  fireEvent.click(screen.getByText('button'))
  await vi.waitFor(() =>
    expect(screen.getByText('counts: 0,1')).toBeInTheDocument(),
  )

  fireEvent.click(screen.getByText('button2'))
  await vi.waitFor(() =>
    expect(screen.getByText('counts: 0,10,11,1')).toBeInTheDocument(),
  )
})

it('array length after direct assignment', async () => {
  const obj = proxy({ counts: [0, 1, 2] })

  const Counter = () => {
    const snap = useSnapshot(obj)
    return (
      <>
        <div>counts: {snap.counts.join(',')}</div>
        <div>length: {snap.counts.length}</div>
        <button
          onClick={() => (obj.counts[obj.counts.length] = obj.counts.length)}
        >
          increment
        </button>
        <button
          onClick={() =>
            (obj.counts[obj.counts.length + 5] = obj.counts.length + 5)
          }
        >
          jump
        </button>
      </>
    )
  }

  render(
    <StrictMode>
      <Counter />
    </StrictMode>,
  )

  await vi.waitFor(() =>
    expect(screen.getByText('counts: 0,1,2')).toBeInTheDocument(),
  )

  fireEvent.click(screen.getByText('increment'))
  await vi.waitFor(() =>
    expect(screen.getByText('counts: 0,1,2,3')).toBeInTheDocument(),
  )

  fireEvent.click(screen.getByText('jump'))
  await vi.waitFor(() =>
    expect(screen.getByText('counts: 0,1,2,3,,,,,,9')).toBeInTheDocument(),
  )
})

it('deleting property', async () => {
  const obj = proxy<{ count?: number }>({ count: 1 })

  const Counter = () => {
    const snap = useSnapshot(obj)
    return (
      <>
        <div>count: {snap.count ?? 'none'}</div>
        <button onClick={() => delete obj.count}>button</button>
      </>
    )
  }

  render(
    <StrictMode>
      <Counter />
    </StrictMode>,
  )

  await vi.waitFor(() =>
    expect(screen.getByText('count: 1')).toBeInTheDocument(),
  )

  fireEvent.click(screen.getByText('button'))
  await vi.waitFor(() =>
    expect(screen.getByText('count: none')).toBeInTheDocument(),
  )
})

it('circular object', async () => {
  const obj = proxy<any>({ object: {} })
  obj.object = obj
  obj.object.count = 0

  const Counter = () => {
    const snap = useSnapshot(obj) as any
    return (
      <>
        <div>count: {snap.count}</div>
        <button onClick={() => ++obj.count}>button</button>
      </>
    )
  }

  render(
    <StrictMode>
      <Counter />
    </StrictMode>,
  )

  await vi.waitFor(() => {
    expect(screen.getByText('count: 0')).toBeInTheDocument()
  })

  fireEvent.click(screen.getByText('button'))
  await vi.waitFor(() => {
    expect(screen.getByText('count: 1')).toBeInTheDocument()
  })
})

it('circular object with non-proxy object (#375)', async () => {
  const initialObject = { count: 0 }
  const state: any = proxy(initialObject)
  state.obj = initialObject

  const Counter = () => {
    const snap = useSnapshot(state)
    return <div>count: {snap.obj ? 1 : snap.count}</div>
  }

  render(
    <StrictMode>
      <Counter />
    </StrictMode>,
  )

  await vi.waitFor(() =>
    expect(screen.getByText('count: 1')).toBeInTheDocument(),
  )
})

it('render from outside', async () => {
  const obj = proxy({ count: 0, anotherCount: 0 })

  const Counter = () => {
    const [show, setShow] = useState(false)
    const snap = useSnapshot(obj)
    return (
      <>
        {show ? (
          <div>count: {snap.count}</div>
        ) : (
          <div>anotherCount: {snap.anotherCount}</div>
        )}
        <button onClick={() => ++obj.count}>button</button>
        <button onClick={() => setShow((x) => !x)}>toggle</button>
      </>
    )
  }

  render(
    <StrictMode>
      <Counter />
    </StrictMode>,
  )

  await vi.waitFor(() =>
    expect(screen.getByText('anotherCount: 0')).toBeInTheDocument(),
  )

  fireEvent.click(screen.getByText('button'))
  fireEvent.click(screen.getByText('toggle'))
  await vi.waitFor(() =>
    expect(screen.getByText('count: 1')).toBeInTheDocument(),
  )
})

it('counter with sync option', async () => {
  const obj = proxy({ count: 0 })

  const Counter = () => {
    const snap = useSnapshot(obj, { sync: true })
    return (
      <>
        <div>
          count: {snap.count} ({useCommitCount()})
        </div>
        <button onClick={() => ++obj.count}>button</button>
      </>
    )
  }

  render(
    <>
      <Counter />
    </>,
  )

  await vi.waitFor(() =>
    expect(screen.getByText('count: 0 (1)')).toBeInTheDocument(),
  )

  fireEvent.click(screen.getByText('button'))
  await vi.waitFor(() =>
    expect(screen.getByText('count: 1 (2)')).toBeInTheDocument(),
  )

  fireEvent.click(screen.getByText('button'))
  await vi.waitFor(() =>
    expect(screen.getByText('count: 2 (3)')).toBeInTheDocument(),
  )
})

it('support undefined property (#439)', async () => {
  const obj = proxy({ prop: undefined })

  expect('prop' in obj).toBe(true)

  const Component = () => {
    const snap = useSnapshot(obj)
    return <div>has prop: {JSON.stringify('prop' in snap)}</div>
  }

  render(
    <StrictMode>
      <Component />
    </StrictMode>,
  )

  await vi.waitFor(() =>
    expect(screen.getByText('has prop: true')).toBeInTheDocument(),
  )
})

it('sync snapshot between nested components (#460)', async () => {
  const obj = proxy<{
    id: 'prop1' | 'prop2'
    prop1: string
    prop2?: string
  }>({ id: 'prop1', prop1: 'value1' })

  const Child = ({ id }: { id: 'prop1' | 'prop2' }) => {
    const snap = useSnapshot(obj)
    return <div>Child: {snap[id]}</div>
  }

  const handleClick = () => {
    obj.prop2 = 'value2'
    obj.id = 'prop2'
  }

  const Parent = () => {
    const snap = useSnapshot(obj)
    return (
      <>
        <div>Parent: {snap[snap.id]}</div>
        <Child id={snap.id} />
        <button onClick={handleClick}>button</button>
      </>
    )
  }

  render(
    <StrictMode>
      <Parent />
    </StrictMode>,
  )

  await vi.waitFor(() => {
    expect(screen.getByText('Parent: value1')).toBeInTheDocument()
    expect(screen.getByText('Child: value1')).toBeInTheDocument()
  })

  fireEvent.click(screen.getByText('button'))
  await vi.waitFor(() => {
    expect(screen.getByText('Parent: value2')).toBeInTheDocument()
    expect(screen.getByText('Child: value2')).toBeInTheDocument()
  })
})

it('respects property enumerability (#726)', async () => {
  const x = proxy(Object.defineProperty({ a: 1 }, 'b', { value: 2 }))
  expect(Object.keys(snapshot(x))).toEqual(Object.keys(x))
})

it('stable snapshot object (#985)', async () => {
  const state = proxy({ count: 0, obj: {} })

  let effectCount = 0

  const TestComponent = () => {
    const { count, obj } = useSnapshot(state)
    useEffect(() => {
      ++effectCount
    }, [obj])
    return (
      <>
        <div>count: {count}</div>
        <button onClick={() => ++state.count}>button</button>
      </>
    )
  }

  render(<TestComponent />)

  await vi.waitFor(() =>
    expect(screen.getByText('count: 0')).toBeInTheDocument(),
  )
  expect(effectCount).toBe(1)

  fireEvent.click(screen.getByText('button'))
  await vi.waitFor(() =>
    expect(screen.getByText('count: 1')).toBeInTheDocument(),
  )
  expect(effectCount).toBe(1)

  fireEvent.click(screen.getByText('button'))
  await vi.waitFor(() =>
    expect(screen.getByText('count: 2')).toBeInTheDocument(),
  )
  expect(effectCount).toBe(1)
})
