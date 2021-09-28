import { StrictMode, useEffect, useRef } from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { proxy, useSnapshot } from 'valtio'

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

  const { getByText, findByText } = render(
    <StrictMode>
      <Counter />
    </StrictMode>
  )

  await findByText('count: 0')

  fireEvent.click(getByText('button'))
  await findByText('count: 1')
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
    const commitsRef = useRef(0)
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
    const commitsRef = useRef(0)
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
    <StrictMode>
      <Counter />
      <Counter2 />
    </StrictMode>
  )

  await waitFor(() => {
    getByText('count: 0 (0)')
    getByText('count2: 0 (0)')
  })

  fireEvent.click(getByText('button'))
  await waitFor(() => {
    getByText('count: 1 (1)')
    getByText('count2: 0 (0)')
  })

  fireEvent.click(getByText('button2'))
  await waitFor(() => {
    getByText('count: 1 (1)')
    getByText('count2: 1 (1)')
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

  const { getByText, findByText } = render(
    <StrictMode>
      <Counter />
    </StrictMode>
  )

  await findByText('count: 0')

  fireEvent.click(getByText('button'))
  await findByText('count: 1')
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
    const commitsRef = useRef(0)
    useEffect(() => {
      commitsRef.current += 1
    })
    return (
      <>
        <div>
          doubled: {snap.doubled()} ({commitsRef.current})
        </div>
        <button onClick={() => ++obj.count}>button</button>
      </>
    )
  }

  const Counter2 = () => {
    const snap = useSnapshot(obj)
    const commitsRef = useRef(0)
    useEffect(() => {
      commitsRef.current += 1
    })
    return (
      <div>
        count: {snap.count} ({commitsRef.current})
      </div>
    )
  }

  const { getByText } = render(
    <StrictMode>
      <Counter />
      <Counter2 />
    </StrictMode>
  )

  await waitFor(() => {
    getByText('doubled: 0 (0)')
    getByText('count: 0 (0)')
  })

  fireEvent.click(getByText('button'))
  await waitFor(() => {
    getByText('doubled: 2 (1)')
    getByText('count: 1 (1)')
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
    const commitsRef = useRef(0)
    useEffect(() => {
      commitsRef.current += 1
    })
    return (
      <>
        <div>
          doubled: {snap.doubled()} ({commitsRef.current})
        </div>
        <button onClick={() => ++obj.count}>button</button>
      </>
    )
  }

  const Counter2 = () => {
    const snap = useSnapshot(obj)
    const commitsRef = useRef(0)
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
    <StrictMode>
      <Counter />
      <Counter2 />
    </StrictMode>
  )

  await waitFor(() => {
    getByText('doubled: 0 (0)')
    getByText('count2: 0 (0)')
  })

  fireEvent.click(getByText('button'))
  await waitFor(() => {
    getByText('doubled: 2 (1)')
    getByText('count2: 0 (0)')
  })

  fireEvent.click(getByText('button2'))
  await waitFor(() => {
    getByText('doubled: 2 (1)')
    getByText('count2: 1 (1)')
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
    const commitsRef = useRef(0)
    useEffect(() => {
      commitsRef.current += 1
    })
    return (
      <>
        <div>
          count: {snap.count1} ({commitsRef.current})
        </div>
        <button onClick={() => ++obj.count}>button</button>
      </>
    )
  }

  const Counter2 = () => {
    const snap = useSnapshot(obj)
    const commitsRef = useRef(0)
    useEffect(() => {
      commitsRef.current += 1
    })
    return (
      <>
        <div>
          sum: {snap.sum} ({commitsRef.current})
        </div>
        <button onClick={() => ++obj.count2}>button2</button>
      </>
    )
  }

  const { getByText } = render(
    <StrictMode>
      <Counter />
      <Counter2 />
    </StrictMode>
  )

  await waitFor(() => {
    getByText('count: 0 (0)')
    getByText('sum: 0 (0)')
  })

  fireEvent.click(getByText('button'))
  await waitFor(() => {
    getByText('count: 1 (1)')
    getByText('sum: 1 (1)')
  })

  fireEvent.click(getByText('button2'))
  await waitFor(() => {
    getByText('count: 1 (1)')
    getByText('sum: 2 (2)')
  })
})
