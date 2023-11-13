// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import * as babelModuleImports from '@babel/helper-module-imports'
import * as t from '@babel/types'
import * as plugin from 'aslemammad-vite-plugin-macro'
import * as babelMacro from 'babel-plugin-macros'

const { defineMacro, defineMacroProvider, createMacroPlugin } =
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  ('default' in plugin ? plugin.default : plugin) as typeof plugin

// const {} = plugin.default as typeof import('aslemammad-vite-plugin-macro')
export const valtioMacro = defineMacro(`useProxy`)
  .withSignature(`<T extends object>(proxyObject: T): void`)
  .withHandler((ctx) => {
    const { path, args } = ctx
    const hook = babelModuleImports.addNamed(path, 'useSnapshot', 'valtio')
    const proxy = args[0]?.node

    if (!t.isIdentifier(proxy)) {
      throw new babelMacro.MacroError('no proxy object')
    }

    const snap = t.identifier(`valtio_macro_snap_${proxy.name}`)
    path.parentPath?.replaceWith(
      t.variableDeclaration('const', [
        t.variableDeclarator(snap, t.callExpression(hook, [proxy])),
      ]),
    )

    let inFunction = 0
    path.parentPath?.getFunctionParent()?.traverse({
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

export function provideValtioMacro() {
  if (import.meta.env?.MODE !== 'production') {
    console.warn('[DEPRECATED] Use useProxy hook instead.')
  }
  return defineMacroProvider({
    id: 'valtio/macro',
    exports: {
      'valtio/macro': {
        macros: [valtioMacro],
      },
    },
  })
}

/**
 * @deprecated Use useProxy hook instead.
 */
const macroPlugin = createMacroPlugin({}).use(provideValtioMacro())

export default macroPlugin
