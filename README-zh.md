<img src="logo.svg" alt="valtio">
<br />
<br />

<code>npm install valtio</code> 使代理状态变得简单

[![Build Status](https://img.shields.io/github/actions/workflow/status/pmndrs/valtio/test.yml?branch=main&style=flat&colorA=000000&colorB=000000)](https://github.com/pmndrs/valtio/actions/workflows/test.yml?query=branch%3Amain)
[![Build Size](https://img.shields.io/bundlephobia/minzip/valtio?label=bundle%20size&style=flat&colorA=000000&colorB=000000)](https://bundlephobia.com/result?p=valtio)
[![Version](https://img.shields.io/npm/v/valtio?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/valtio)
[![Downloads](https://img.shields.io/npm/dt/valtio.svg?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/valtio)
[![Discord Shield](https://img.shields.io/discord/740090768164651008?style=flat&colorA=000000&colorB=000000&label=discord&logo=discord&logoColor=ffffff)](https://discord.gg/poimandres)

# Valtio

Valtio 使代理状态变得简单。

## 特性

- 🪶 **极简 API**：只有 1kb
- 🎯 **透明代理**：自动追踪状态变化
- 🔄 **响应式更新**：只重新渲染变化的部分
- 📦 **零依赖**
- 🎨 **支持 React 和 Vanilla JS**
- 🔌 **可扩展**：支持自定义扩展

## 安装

```bash
npm install valtio
```

## 快速开始

### 包装你的状态对象

Valtio 将你传递的对象转换为自感知的代理。

```jsx
import { proxy, useSnapshot } from 'valtio'

const state = proxy({ count: 0, text: 'hello' })
```

### 从任何地方修改

你可以像修改普通 JS 对象一样修改它。

```jsx
setInterval(() => {
  ++state.count
}, 1000)
```

### 通过 useSnapshot 响应式更新

创建一个本地快照来捕获变化。经验法则：在渲染函数中从快照读取，否则使用源对象。组件只会在快照变化时重新渲染。

```jsx
function Counter() {
  const snapshot = useSnapshot(state)
  return (
    <div>
      <h1>{snapshot.count}</h1>
      <button onClick={() => ++state.count}>+1</button>
    </div>
  )
}
```

## API

### proxy

创建一个代理对象。

```jsx
import { proxy } from 'valtio'

const state = proxy({ count: 0 })
```

### useSnapshot

创建一个快照，用于在 React 组件中响应式地读取状态。

```jsx
import { useSnapshot } from 'valtio'

function Counter() {
  const snapshot = useSnapshot(state)
  return <div>{snapshot.count}</div>
}
```

### subscribe

订阅状态变化。

```jsx
import { subscribe } from 'valtio'

subscribe(state, () => {
  console.log('state changed')
})
```

### snapshot

创建一个快照。

```jsx
import { snapshot } from 'valtio'

const snap = snapshot(state)
console.log(snap.count)
```

### ref

创建一个引用，不会被代理。

```jsx
import { ref } from 'valtio'

const state = proxy({
  count: 0,
  ref: ref({ nested: { value: 1 } }),
})
```

## 高级用法

### 派生状态

```jsx
import { proxy, useSnapshot } from 'valtio'

const state = proxy({
  count: 0,
  get double() {
    return this.count * 2
  },
})

function Counter() {
  const snapshot = useSnapshot(state)
  return (
    <div>
      <h1>Count: {snapshot.count}</h1>
      <h1>Double: {snapshot.double}</h1>
    </div>
  )
}
```

### 异步操作

```jsx
import { proxy, useSnapshot } from 'valtio'

const state = proxy({
  users: [],
  loading: false,
  async fetchUsers() {
    this.loading = true
    const response = await fetch('/api/users')
    this.users = await response.json()
    this.loading = false
  },
})

function Users() {
  const snapshot = useSnapshot(state)
  return (
    <div>
      {snapshot.loading ? (
        <div>Loading...</div>
      ) : (
        <ul>
          {snapshot.users.map(user => (
            <li key={user.id}>{user.name}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

### 持久化

```jsx
import { proxy, subscribe } from 'valtio'

const state = proxy({ count: 0 })

// 从 localStorage 加载
const saved = localStorage.getItem('state')
if (saved) {
  Object.assign(state, JSON.parse(saved))
}

// 保存到 localStorage
subscribe(state, () => {
  localStorage.setItem('state', JSON.stringify(state))
})
```

### DevTools

```jsx
import { proxy } from 'valtio'
import { devtools } from 'valtio/utils'

const state = proxy({ count: 0 })
devtools(state, { name: 'counter' })
```

## 与其他库的比较

### 与 Redux 的比较

| 特性 | Valtio | Redux |
|------|--------|-------|
| API 复杂度 | 简单 | 复杂 |
| 包大小 | 1kb | 11kb |
| 学习曲线 | 低 | 中等 |
| 可变性 | 可变 | 不可变 |
| TypeScript 支持 | 优秀 | 良好 |

### 与 Zustand 的比较

| 特性 | Valtio | Zustand |
|------|--------|---------|
| API 复杂度 | 简单 | 简单 |
| 包大小 | 1kb | 2kb |
| 状态管理 | 代理 | 原子 |
| 可变性 | 可变 | 不可变 |
| 持久化 | 有 | 有 |

### 与 Jotai 的比较

| 特性 | Valtio | Jotai |
|------|--------|-------|
| API 复杂度 | 简单 | 简单 |
| 包大小 | 1kb | 2kb |
| 状态管理 | 代理 | 原子 |
| 可变性 | 可变 | 不可变 |
| 派生状态 | 有 | 有 |

## 示例

- [演示](https://valtio-demo.pmnd.rs/)
- [示例代码](./examples)

## 文档

访问 [valtio.pmnd.rs](https://valtio.pmnd.rs/) 查看完整文档。

## 贡献

欢迎贡献！请阅读 [贡献指南](./CONTRIBUTING.md) 了解如何参与。

## 许可证

MIT
