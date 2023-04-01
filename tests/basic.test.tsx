import { StrictMode, useEffect, useRef, useState } from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { proxy, useSnapshot } from 'valtio'

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

  const { getByText, findByText } = render(
    <StrictMode>
      <Counter />
    </StrictMode>
  )

  await findByText('count: 0')

  fireEvent.click(getByText('button'))
  await findByText('count: 1')
})

it('no extra re-renders (commits)', async () => {
  const obj = proxy({ count: 0, count2: 0 })

  const Counter = () => {
    const snap = useSnapshot(obj)
    const commitsRef = useRef(1)
    useEffect(() => {
      commitsRef.current += 1
    })
    return (
      <>
        <div>
          count: {snap.count} ({commitsRef.current})
        </div>
        <button onClick={() => ++obj.count}>button</button>
      </>
    )
  }

  const Counter2 = () => {
    const snap = useSnapshot(obj)
    const commitsRef = useRef(1)
    useEffect(() => {
      commitsRef.current += 1
    })
    return (
      <>
        <div>
          count2: {snap.count2} ({commitsRef.current})
        </div>
        <button onClick={() => ++obj.count2}>button2</button>
      </>
    )
  }

  const { getByText } = render(
    <>
      <Counter />
      <Counter2 />
    </>
  )

  await waitFor(() => {
    getByText('count: 0 (1)')
    getByText('count2: 0 (1)')
  })

  fireEvent.click(getByText('button'))
  await waitFor(() => {
    getByText('count: 1 (2)')
    getByText('count2: 0 (1)')
  })

  fireEvent.click(getByText('button2'))
  await waitFor(() => {
    getByText('count: 1 (2)')
    getByText('count2: 1 (2)')
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

  const { getByText } = render(
    <>
      <Counter />
      <Counter2 />
    </>
  )

  await waitFor(() => {
    getByText('count: 0')
    getByText('count2: 0')
  })
  expect(renderFn).toBeCalledTimes(1)
  expect(renderFn).lastCalledWith(0)
  expect(renderFn2).toBeCalledTimes(1)
  expect(renderFn2).lastCalledWith(0)

  fireEvent.click(getByText('button'))
  await waitFor(() => {
    getByText('count: 1')
    getByText('count2: 0')
  })
  expect(renderFn).toBeCalledTimes(2)
  expect(renderFn).lastCalledWith(1)
  expect(renderFn2).toBeCalledTimes(1)
  expect(renderFn2).lastCalledWith(0)

  fireEvent.click(getByText('button2'))
  await waitFor(() => {
    getByText('count: 1')
    getByText('count2: 1')
  })
  expect(renderFn).toBeCalledTimes(2)
  expect(renderFn).lastCalledWith(1)
  expect(renderFn2).toBeCalledTimes(2)
  expect(renderFn2).lastCalledWith(1)

  fireEvent.click(getByText('button2'))
  await waitFor(() => {
    getByText('count: 1')
    getByText('count2: 2')
  })
  expect(renderFn).toBeCalledTimes(2)
  expect(renderFn).lastCalledWith(1)
  expect(renderFn2).toBeCalledTimes(3)
  expect(renderFn2).lastCalledWith(2)

  fireEvent.click(getByText('button'))
  await waitFor(() => {
    getByText('count: 2')
    getByText('count2: 2')
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

  const { getByText, findByText } = render(
    <StrictMode>
      <Counter />
    </StrictMode>
  )

  await findByText('count: 0')

  fireEvent.click(getByText('button'))
  await findByText('count: 1')
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

  const { getByText, findByText } = render(
    <StrictMode>
      <Counter />
    </StrictMode>
  )

  await findByText('counts: 0,1,2')

  fireEvent.click(getByText('button'))
  await findByText('counts: 0,1,2,3')
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

  const { getByText, findByText } = render(
    <StrictMode>
      <Counter />
    </StrictMode>
  )

  await findByText('counts: 0,1,2')

  fireEvent.click(getByText('button'))
  await findByText('counts: 0,1')

  fireEvent.click(getByText('button2'))
  await findByText('counts: 0,10,11,1')
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
          onClick={() => (obj.counts[obj.counts.length] = obj.counts.length)}>
          increment
        </button>
        <button
          onClick={() =>
            (obj.counts[obj.counts.length + 5] = obj.counts.length + 5)
          }>
          jump
        </button>
      </>
    )
  }

  const { getByText, findByText } = render(
    <StrictMode>
      <Counter />
    </StrictMode>
  )

  await findByText('counts: 0,1,2')

  fireEvent.click(getByText('increment'))
  await findByText('counts: 0,1,2,3')

  fireEvent.click(getByText('jump'))
  await findByText('counts: 0,1,2,3,,,,,,9')
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

  const { getByText, findByText } = render(
    <StrictMode>
      <Counter />
    </StrictMode>
  )

  await findByText('count: 1')

  fireEvent.click(getByText('button'))
  await findByText('count: none')
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

  const { getByText, findByText } = render(
    <StrictMode>
      <Counter />
    </StrictMode>
  )

  await findByText('count: 0')

  fireEvent.click(getByText('button'))
  await findByText('count: 1')
})

it('circular object with non-proxy object (#375)', async () => {
  const initialObject = { count: 0 }
  const state: any = proxy(initialObject)
  state.obj = initialObject

  const Counter = () => {
    const snap = useSnapshot(state)
    return <div>count: {snap.obj ? 1 : snap.count}</div>
  }

  const { findByText } = render(
    <StrictMode>
      <Counter />
    </StrictMode>
  )

  await findByText('count: 1')
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

  const { getByText, findByText } = render(
    <StrictMode>
      <Counter />
    </StrictMode>
  )

  await findByText('anotherCount: 0')

  fireEvent.click(getByText('button'))
  fireEvent.click(getByText('toggle'))
  await findByText('count: 1')
})

it('counter with sync option', async () => {
  const obj = proxy({ count: 0 })

  const Counter = () => {
    const snap = useSnapshot(obj, { sync: true })
    const commitsRef = useRef(1)
    useEffect(() => {
      commitsRef.current += 1
    })
    return (
      <>
        <div>
          count: {snap.count} ({commitsRef.current})
        </div>
        <button onClick={() => ++obj.count}>button</button>
      </>
    )
  }

  const { getByText, findByText } = render(
    <>
      <Counter />
    </>
  )

  await findByText('count: 0 (1)')

  fireEvent.click(getByText('button'))
  await findByText('count: 1 (2)')

  fireEvent.click(getByText('button'))
  await findByText('count: 2 (3)')
})

it('support undefined property (#439)', async () => {
  const obj = proxy({ prop: undefined })

  expect('prop' in obj).toBe(true)

  const Component = () => {
    const snap = useSnapshot(obj)
    return <div>has prop: {JSON.stringify('prop' in snap)}</div>
  }

  const { findByText } = render(
    <StrictMode>
      <Component />
    </StrictMode>
  )

  await findByText('has prop: true')
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

  const { getByText } = render(
    <StrictMode>
      <Parent />
    </StrictMode>
  )

  await waitFor(() => {
    getByText('Parent: value1')
    getByText('Child: value1')
  })

  fireEvent.click(getByText('button'))
  await waitFor(() => {
    getByText('Parent: value2')
    getByText('Child: value2')
  })
})
