import { StrictMode, useEffect, useRef } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { it } from 'vitest'
import { proxy, useSnapshot } from 'valtio'

const useCommitCount = () => {
  const commitCountRef = useRef(0)
  useEffect(() => {
    commitCountRef.current += 1
  })
  // eslint-disable-next-line react-compiler/react-compiler
  return commitCountRef.current
}

it('simple class without methods', async () => {
  class CountClass {
    public count: number
    constructor() {
      this.count = 0
    }
  }

  const obj = proxy(new CountClass())

  const Counter = () => {
    const snap = useSnapshot(obj)
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

  await screen.findByText('count: 0')

  fireEvent.click(screen.getByText('button'))
  await screen.findByText('count: 1')
})

it('no extra re-renders with class', async () => {
  class CountClass {
    public count: number
    public count2: number
    constructor() {
      this.count = 0
      this.count2 = 0
    }
  }

  const obj = proxy(new CountClass())

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

  await waitFor(() => {
    screen.getByText('count: 0 (0)')
    screen.getByText('count2: 0 (0)')
  })

  fireEvent.click(screen.getByText('button'))
  await waitFor(() => {
    screen.getByText('count: 1 (1)')
    screen.getByText('count2: 0 (0)')
  })

  fireEvent.click(screen.getByText('button2'))
  await waitFor(() => {
    screen.getByText('count: 1 (1)')
    screen.getByText('count2: 1 (1)')
  })
})

it('inherited class without methods', async () => {
  class BaseClass {
    public count: number
    constructor() {
      this.count = 0
    }
  }
  class CountClass extends BaseClass {
    public count2: number
    constructor() {
      super()
      this.count2 = 0
    }
  }

  const obj = proxy(new CountClass())

  const Counter = () => {
    const snap = useSnapshot(obj)
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

  await screen.findByText('count: 0')

  fireEvent.click(screen.getByText('button'))
  await screen.findByText('count: 1')
})

it('class with a method', async () => {
  class CountClass {
    public count: number
    constructor() {
      this.count = 0
    }
    public doubled() {
      return this.count * 2
    }
  }

  const obj = proxy(new CountClass())

  const Counter = () => {
    const snap = useSnapshot(obj)
    return (
      <>
        <div>
          doubled: {snap.doubled()} ({useCommitCount()})
        </div>
        <button onClick={() => ++obj.count}>button</button>
      </>
    )
  }

  const Counter2 = () => {
    const snap = useSnapshot(obj)
    return (
      <div>
        count: {snap.count} ({useCommitCount()})
      </div>
    )
  }

  render(
    <>
      <Counter />
      <Counter2 />
    </>,
  )

  await waitFor(() => {
    screen.getByText('doubled: 0 (0)')
    screen.getByText('count: 0 (0)')
  })

  fireEvent.click(screen.getByText('button'))
  await waitFor(() => {
    screen.getByText('doubled: 2 (1)')
    screen.getByText('count: 1 (1)')
  })
})

it('inherited class with a method', async () => {
  class BaseClass {
    public count: number
    constructor() {
      this.count = 0
    }
    public doubled() {
      return this.count * 2
    }
  }
  class CountClass extends BaseClass {
    public count2: number
    constructor() {
      super()
      this.count2 = 0
    }
  }

  const obj = proxy(new CountClass())

  const Counter = () => {
    const snap = useSnapshot(obj)
    return (
      <>
        <div>
          doubled: {snap.doubled()} ({useCommitCount()})
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

  await waitFor(() => {
    screen.getByText('doubled: 0 (0)')
    screen.getByText('count2: 0 (0)')
  })

  fireEvent.click(screen.getByText('button'))
  await waitFor(() => {
    screen.getByText('doubled: 2 (1)')
    screen.getByText('count2: 0 (0)')
  })

  fireEvent.click(screen.getByText('button2'))
  await waitFor(() => {
    screen.getByText('doubled: 2 (1)')
    screen.getByText('count2: 1 (1)')
  })
})

it('no extra re-renders with getters', async () => {
  class CountClass {
    public count: number
    public count2: number
    constructor() {
      this.count = 0
      this.count2 = 0
    }
    get count1() {
      return this.count
    }
    get sum() {
      return this.count + this.count2
    }
  }

  const obj = proxy(new CountClass())

  const Counter = () => {
    const snap = useSnapshot(obj)
    return (
      <>
        <div>
          count: {snap.count1} ({useCommitCount()})
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
          sum: {snap.sum} ({useCommitCount()})
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

  await waitFor(() => {
    screen.getByText('count: 0 (0)')
    screen.getByText('sum: 0 (0)')
  })

  fireEvent.click(screen.getByText('button'))
  await waitFor(() => {
    screen.getByText('count: 1 (1)')
    screen.getByText('sum: 1 (1)')
  })

  fireEvent.click(screen.getByText('button2'))
  await waitFor(() => {
    screen.getByText('count: 1 (1)')
    screen.getByText('sum: 2 (2)')
  })
})
