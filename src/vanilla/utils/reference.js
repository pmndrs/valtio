//anonyco
if (
  typeof Map === 'undefined' ||
  !(/*window.*/ Map.prototype.keys) ||
  typeof Set === 'undefined' ||
  !(/*window.*/ Set.prototype.keys)
) {
  ;(function () {
    'use-strict'
    let keycur,
      i,
      len,
      k,
      v,
      iterable,
      Mapproto = {
        //length: 0,
        delete: function (key) {
          keycur = NaNsearch(this.k, key) // k is for keys
          if (!~keycur) return false
          this.k.splice(keycur, 1)
          this.v.splice(keycur, 1)
          --this.size
          return true
        },
        get: function (key) {
          return this.v[NaNsearch(this.k, key)] // automagicly returns undefined if it doesn't exist
        },
        set: function (key, value) {
          keycur = NaNsearch(this.k, key)
          if (!~keycur) {
            // if (keycur === -1)
            this.k[(keycur = this.size++)] = key
          }
          this.v[keycur] = value
          return this
        },
        has: function (key) {
          return NaNsearch(this.k, key) > -1
        },
        clear: function () {
          this.k.length = this.v.length = this.size = 0
          //return undefined
        },
        forEach: function (Func, thisArg) {
          if (thisArg) Func = Func.bind(thisArg)
          let i = -1,
            len = this.size
          while (++i !== len) Func(this.v[i], this.k[i], this)
        },
        entries: function () {
          let nextIndex = 0,
            that = this
          return {
            next: function () {
              return nextIndex !== that.size
                ? {
                    value: [that.k[nextIndex++], that.v[nextIndex]],
                    done: false,
                  }
                : { done: true }
            },
          }
        },
        keys: function () {
          let nextIndex = 0,
            that = this
          return {
            next: function () {
              return nextIndex !== that.size
                ? { value: that.k[nextIndex++], done: false }
                : { done: true }
            },
          }
        },
        values: function () {
          let nextIndex = 0,
            that = this
          return {
            next: function () {
              return nextIndex !== that.size
                ? { value: that.v[nextIndex++], done: false }
                : { done: true }
            },
          }
        },
        toString: function () {
          return '[object Map]'
        },
      }
    function NaNsearch(arr, val) {
      // search that compensates for NaN indexs
      if (val === val) {
        // if val is not NaN
        return arr.indexOf(val)
      }
      ;(i = 0), (len = arr.length)
      // Check for the first index that is not itself (i.e. NaN)
      while (arr[i] === arr[i] && ++i !== len); // do nothing
      return i
    }

    // Map & WeakMap polyfill
    /*window.*/ WeakMap = /*window.*/ Map = function (raw) {
      k = this.k = []
      v = this.v = []
      len = 0
      if (raw !== undefined && raw !== null) {
        iterable = Object(raw)
        // split up the data into two useable streams: one for keys (k), and one for values (v)
        i = +iterable.length
        if (i != i) {
          // if i is NaN
          throw new TypeError(
            '(' + (raw.toString || iterable.toString)() + ') is not iterable',
          )
        }

        while (i--) {
          if (iterable[i] instanceof Object) {
            if (!~NaNsearch(k, iterable[i][0])) {
              // if current is not already in the array
              ;(k[len] = iterable[i][0]), (v[len++] = iterable[i][1])
            } // len++ increments len, but returns value before increment
          } else {
            throw new TypeError(
              'Iterator value ' + iterable[i] + ' is not an entry object',
            )
          }
        }
        k.reverse()
        v.reverse()
      }
      this.size = len
    }
    /*window.*/ Map.prototype = Mapproto
    /*if (typeof Symbol === 'function'){
			Map.prototype[Symbol.iterator] = Map.prototype.values;
			Map.prototype[Symbol.toStringTag] = 'Map';
		}*/

    // Set & WeakSet polyfill
    /*window.*/ WeakSet = /*window.*/ Set = function (raw) {
      k = this.k = this.v = []
      len = 0
      if (raw !== undefined && raw !== null) {
        iterable = Object(raw)
        // split up the data into two useable streams: one for keys (k), and one for values (v)
        i = +iterable.length
        if (i != i) {
          // if i is NaN
          throw new TypeError(
            '(' + (raw.toString || iterable.toString)() + ') is not iterable',
          )
        }

        while (i--) {
          if (!~NaNsearch(k, iterable[i])) {
            // if current is not already in the array
            k[len++] = iterable[i]
          }
        } // len++ increments len, but returns value before increment
        k.reverse()
      }
      this.size = len
    }
    /*window.*/ Set.prototype = {
      //length: 0,
      delete: function (value) {
        keycur = NaNsearch(this.k, value) // k is for keys
        if (!~keycur) return false
        this.k.splice(keycur, 1)
        --this.size
        return true
      },
      add: function (value) {
        keycur = NaNsearch(this.k, value)
        if (!~keycur) keycur = this.size++
        this.k[keycur] = value
        return this
      },
      has: Mapproto.has,
      clear: Mapproto.clear,
      forEach: Mapproto.forEach,
      entries: Mapproto.entries,
      keys: Mapproto.keys,
      values: Mapproto.keys,
      toString: function () {
        return '[object Set]'
      },
    }
    /*if (typeof Symbol === 'function'){
			Set.prototype[Symbol.iterator] = Set.prototype.values;
			Set.prototype[Symbol.toStringTag] = 'Set';
			Set.prototype[Symbol.toPrimitive] = function(){return this.k};
		}*/
  })()
}
