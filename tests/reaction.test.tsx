import { reaction } from 'valtio/utils/reaction'
import { proxy } from 'valtio/vanilla'

describe('reaction', () => {
    it('should re-run for individual proxy updates', async () => {
      const reference = proxy({ value: 'Example' })
  
      const callback = jest.fn()
  
      const r = reaction(callback)
      r.track(() => {
        reference.value // read a value in the proxy
      })
  
      expect(callback).toBeCalledTimes(0)
      reference.value = 'Update'
      await Promise.resolve()
      expect(callback).toBeCalledTimes(1)
    })
  
    it('should re-run for multiple proxy updates', async () => {
      const A = proxy({ value: 'A' })
      const B = proxy({ value: 'B' })
  
      const callback = jest.fn()
  
      const r = reaction(callback)
      r.track(() => {
        A.value
        B.value
      })
  
      expect(callback).toBeCalledTimes(0)
      A.value = 'B'
      await Promise.resolve()
      expect(callback).toBeCalledTimes(1)
      B.value = 'C'
      await Promise.resolve()
      expect(callback).toBeCalledTimes(2)
    })

    it('should handle replacing nested proxies', async () => {
      const reference = proxy({ child: [1,2,3] })
  
      const callback = jest.fn()
  
      const r = reaction(callback)
      r.track(() => {
        reference.child
      })
  
      expect(callback).toBeCalledTimes(0)
      reference.child[0]++;
      await Promise.resolve()
      expect(callback).toBeCalledTimes(1)
      reference.child = [1,2];
      await Promise.resolve()
      expect(callback).toBeCalledTimes(2)
    })

    it('should cleanup when track called', async () => {
      const reference = proxy({ value: 'Example' })
  
      const callback = jest.fn()
      const cleanupCallback = jest.fn()
      const cleanupCallback2 = jest.fn()
  
      const r = reaction(callback)
  
      r.track(() => {
        reference.value
        return () => {
          cleanupCallback()
        }
      })
  
      expect(callback).toBeCalledTimes(0)
      expect(cleanupCallback).toBeCalledTimes(0)
      reference.value = 'Update'
      await Promise.resolve()
      expect(callback).toBeCalledTimes(1)
      expect(cleanupCallback).toBeCalledTimes(0)
      // re-evaluate the tracking function
      r.track(() => {
        reference.value
        return () => {
          cleanupCallback2()
        }
      })
      // old cleanup should have been called, new cleanup
      // has not yet been called, and effect has not updated
      await Promise.resolve()
      expect(callback).toBeCalledTimes(1)
      expect(cleanupCallback).toBeCalledTimes(1)
      expect(cleanupCallback2).toBeCalledTimes(0)
      // dispose of the reaction and observe new cleanup is called
      r.cleanup()
      expect(callback).toBeCalledTimes(1)
      expect(cleanupCallback).toBeCalledTimes(1)
      expect(cleanupCallback2).toBeCalledTimes(1)
    })
  
    it('should cleanup when stopped', () => {
      const reference = proxy({ value: 'Example' })
      const callback = jest.fn()
  
      const cleanupCallback = jest.fn()
  
      const r = reaction(callback)
  
      r.track(() => {
        reference.value
        return () => {
          cleanupCallback()
        }
      })
  
      expect(callback).toBeCalledTimes(0)
      expect(cleanupCallback).toBeCalledTimes(0)
      r.cleanup()
      expect(callback).toBeCalledTimes(0)
      expect(cleanupCallback).toBeCalledTimes(1)
    })
  
    it('should cleanup internal effects when stopped', () => {
      const reference = proxy({ value: 'Example', other: 'Value' })
      const callback = jest.fn()
      const callback2 = jest.fn()
      const cleanupCallback = jest.fn()
  
      const r = reaction(callback)
      r.track(() => {
        const r2 = reaction(callback2)
        reference.value
        r2.track(() => {
          reference.other
          return () => {
            cleanupCallback()
          }
        })
        return r2.cleanup
      })
      expect(callback).toBeCalledTimes(0)
      expect(callback2).toBeCalledTimes(0)
      r.cleanup()
      expect(cleanupCallback).toBeCalledTimes(1)
    })
  
    it('should not loop infinitely with sync (#382)', () => {
      const reference = proxy({ value: 'Example' })
      const callback = jest.fn()
  
      const r = reaction(callback, { sync: true })
      r.track(() => {
        reference.value
      })
  
      reference.value = 'Update'
    })
  })
  