import { proxy, snapshot } from '../src/index'
import { computed } from '../src/utils'

it('simple computed getters', async () => {
  const computeDouble = jest.fn((x) => x * 2)
  const doubledGetter = computed((snap: { count: number }) =>
    computeDouble(snap.count)
  )
  const state = proxy({
    text: '',
    count: 0,
    get doubled() {
      return doubledGetter.apply(this)
    },
  })

  expect(snapshot(state)).toEqual({ text: '', count: 0, doubled: 0 })
  expect(computeDouble).toBeCalledTimes(1)

  state.count += 1
  await Promise.resolve()
  expect(snapshot(state)).toEqual({ text: '', count: 1, doubled: 2 })
  expect(computeDouble).toBeCalledTimes(2)

  state.text = 'a'
  await Promise.resolve()
  expect(snapshot(state)).toEqual({ text: 'a', count: 1, doubled: 2 })
  expect(computeDouble).toBeCalledTimes(2)
})
