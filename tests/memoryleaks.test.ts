import { exec } from 'child_process'
import { describe, expect, it } from 'vitest'

describe('no memory leaks with proxy', () => {
  const runTest = async (code: string) => {
    const testCode = `
      const { proxy } = require("./dist/vanilla.js");
      ${code}
      const registry = new FinalizationRegistry(() => {
        console.log("state is garbage collected");
      });
      registry.register(state, undefined);
      state = null;
      setImmediate(() => {
        global.gc();
      });
    `
    const output = await new Promise((resolve) => {
      exec(`node --expose-gc --eval '${testCode}'`, (err, stdout) => {
        resolve(err || stdout)
      })
    })
    expect(output).toMatch('state is garbage collected')
  }

  it('empty object', async () => {
    await runTest(`
      let state = proxy({});
    `)
  })

  it('child object', async () => {
    await runTest(`
      let state = proxy({ child: {} });
    `)
  })

  it('global child object', async () => {
    await runTest(`
      const child = {};
      let state = proxy({ child });
    `)
  })

  it('global child proxy', async () => {
    await runTest(`
      const child = proxy({});
      let state = proxy({ child });
    `)
  })
})
