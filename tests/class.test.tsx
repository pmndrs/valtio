import React, { StrictMode, useRef, useEffect } from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { proxy, useProxy } from '../src/index'

it('simple class without methods', async () => {
  class CountClass {
    public count: number
    constructor() {
      this.count = 0
    }
  }

  const obj = proxy(new CountClass())

  const Counter: React.FC = () => {
    const snapshot = useProxy(obj)
    return (
      <>
        <div>count: {snapshot.count}</div>
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

  const Counter: React.FC = () => {
    const snapshot = useProxy(obj)
    const commitsRef = useRef(0)
    useEffect(() => {
      commitsRef.current += 1
    })
    return (
      <>
        <div>
          count: {snapshot.count} ({commitsRef.current})
        </div>
        <button onClick={() => ++obj.count}>button</button>
      </>
    )
  }

  const Counter2: React.FC = () => {
    const snapshot = useProxy(obj)
    const commitsRef = useRef(0)
    useEffect(() => {
      commitsRef.current += 1
    })
    return (
      <>
        <div>
          count2: {snapshot.count2} ({commitsRef.current})
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

  const Counter: React.FC = () => {
    const snapshot = useProxy(obj)
    return (
      <>
        <div>count: {snapshot.count}</div>
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

  const Counter: React.FC = () => {
    const snapshot = useProxy(obj)
    return (
      <>
        <div>count: {snapshot.count}</div>
        <div>doubled: {snapshot.doubled()}</div>
        <button onClick={() => ++obj.count}>button</button>
      </>
    )
  }

  const { getByText } = render(
    <StrictMode>
      <Counter />
    </StrictMode>
  )

  await waitFor(() => {
    getByText('count: 0')
    getByText('doubled: 0')
  })

  fireEvent.click(getByText('button'))
  await waitFor(() => {
    getByText('count: 1')
    getByText('doubled: 2')
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

  const Counter: React.FC = () => {
    const snapshot = useProxy(obj)
    return (
      <>
        <div>count: {snapshot.count}</div>
        <div>doubled: {snapshot.doubled()}</div>
        <button onClick={() => ++obj.count}>button</button>
      </>
    )
  }

  const { getByText } = render(
    <StrictMode>
      <Counter />
    </StrictMode>
  )

  await waitFor(() => {
    getByText('count: 0')
    getByText('doubled: 0')
  })

  fireEvent.click(getByText('button'))
  await waitFor(() => {
    getByText('count: 1')
    getByText('doubled: 2')
  })
})
