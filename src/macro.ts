import type { NodePath } from '@babel/traverse'
import * as t from '@babel/types'
import { createMacro, MacroError } from 'babel-plugin-macros'
// @ts-ignore
import { addNamed } from '@babel/helper-module-imports'

const macro = ({ references }: any) => {
  references.useProxy?.forEach((path: NodePath) => {
    const hook = addNamed(path, 'useSnapshot', 'valtio')
    const proxy = (path.parentPath.get('arguments.0') as any).node
    if (!t.isIdentifier(proxy)) throw new MacroError('no proxy object')
    const snap = t.identifier(`valtio_macro_snap_${proxy.name}`)
    path.parentPath.parentPath.replaceWith(
      t.variableDeclaration('const', [
        t.variableDeclarator(snap, t.callExpression(hook, [proxy])),
      ])
    )
    let inFunction = 0
    path.parentPath.getFunctionParent()?.traverse({
      Identifier(p) {
        if (
          inFunction === 0 && // in render
          p.node !== proxy &&
          p.node.name === proxy.name
        ) {
          p.node.name = snap.name
        }
      },
      Function: {
        enter() {
          ++inFunction
        },
        exit() {
          --inFunction
        },
      },
    })
  })
}

export declare function useProxy<T extends object>(proxyObject: T): void

export default createMacro(macro, { configName: 'valtio' })
