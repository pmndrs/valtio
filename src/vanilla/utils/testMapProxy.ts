const loggingProxyHandler = {
  get(target, name /*, receiver*/) {
    let ret = Reflect.get(target, name)
    // console.log(`get(${name}=${ret})`)
    if (typeof ret === 'function') {
      // ***
      ret = ret.bind(target) // ***
    } // ***
    return ret
  },

  set(target, name, value /*, receiver*/) {
    // console.log(`set(${name}=${value})`)
    return Reflect.set(target, name, value)
  },
}

function onRunTest() {
  const m1 = new Map()
  const p1 = new Proxy(m1, loggingProxyHandler)
  const obj = {}
  p1.set('a', 'aval')
  p1.set(obj, 'aval2')
  console.log(p1.get('a')) // "aval"
  console.log(p1.get(obj))
  console.log(p1.size) // 1
}

onRunTest()
