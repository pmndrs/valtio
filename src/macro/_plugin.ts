/*
  MIT License

  Copyright (c) 2021 unbyte <i@shangyes.net>

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all
  copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.
*/

import { FSWatcher, Plugin, WatchOptions } from "vite";
import { MacroProvider } from "@typed-macro/core";
import {
  createRuntime,
  FilterOptions,
  Runtime,
  TransformerOptions,
} from "@typed-macro/runtime";
import { EnvContext } from "@typed-macro/core";
import { getPackageManager, getProjectPath } from "@typed-macro/shared";
import chokidar from "chokidar";

import { Modules } from "@typed-macro/core";
import { isString } from "@typed-macro/shared";
import { ModuleNode, ViteDevServer } from "vite";

/** @internal */
export type InternalModules = Modules & {
  __setServer: (server: ViteDevServer) => void;
};

export function createModules(_server?: ViteDevServer): InternalModules {
  const container: Map<string, string> = new Map();
  const queryByTag = (pattern: RegExp | string) => {
    const result: string[] = [];
    const checker = isString(pattern)
      ? (tag: string, id: string) => pattern === tag && result.push(id)
      : (tag: string, id: string) => pattern.test(tag) && result.push(id);
    container.forEach(checker);
    return result;
  };
  const invalidateByTag = (pattern: RegExp | string) => {
    const invalidatedFiles: string[] = [];
    const seen: Set<ModuleNode> = new Set();
    for (const file of queryByTag(pattern)) {
      const module = _server?.moduleGraph.getModuleById(file);
      if (module) {
        invalidatedFiles.push(file);
        _server?.moduleGraph.invalidateModule(module, seen);
      } else {
        container.delete(file);
      }
    }
    return invalidatedFiles;
  };

  return {
    getTag(id) {
      return container.get(id);
    },
    setTag(id, tag) {
      container.set(id, tag);
    },
    unsetTag(id) {
      container.delete(id);
    },
    queryByTag,
    invalidateByTag,
    __setServer: (server) => (_server = server),
  };
}

export function createEnvContext(
  dev: boolean,
  ssr: boolean,
  watcherOptions?: WatchOptions
): EnvContext {
  const projectPath = getProjectPath();
  const packageManager =
    projectPath.length > 0
      // @ts-ignore
      ? getPackageManager(projectPath[0])
      : /* istanbul ignore next */ "unknown";

  const watcher = dev
    ? (new chokidar.FSWatcher({
        ignoreInitial: true,
        ignorePermissionErrors: true,
        ...watcherOptions,
      }) as FSWatcher)
    : undefined;

  const modules = dev ? createModules() : undefined;

  // @ts-ignore
  return {
    host: "vite",
    projectPath,
    packageManager,
    dev,
    ssr,
    watcher,
    modules,
  };
}
import { join } from "path";

export type MacroPlugin = Plugin & {
  /**
   * Register macro providers to this macro manager so that
   * all macros in providers and plugins share the same runtime.
   *
   * For macro plugins:
   *  > Some options like `maxTraversals` or `typesPath` will be overridden by
   *  > manager's, `parserPlugins` will be merged with the manager's one.
   *  >
   *  > After registered, the original macro plugin will be attached to the manager,
   *  > which means no need to add the plugin to Vite/Rollup 's plugins array again.
   * @param sources macro providers or plugins.
   */
  use(...sources: MacroProvider[]): MacroPlugin;
};

export type MacroPluginOptions = FilterOptions &
  TransformerOptions & {
    /**
     * The path of the automatically generated type declaration file.
     *
     * @default '<projectDir>/macros.d.ts'
     */
    typesPath?: string;

    /**
     * Is in dev mode.
     *
     * @default mode !== 'production'
     * @see https://vitejs.dev/guide/env-and-mode.html#modes
     */
    dev?: boolean;

    /**
     * Is in SSR mode.
     *
     * @default whether there is an SSR configuration
     * @see https://vitejs.dev/guide/ssr.html
     */
    ssr?: boolean;

    /**
     * Configure chokidar FSWatcher.
     *
     * @see https://github.com/paulmillr/chokidar#api
     */
    watcherOptions?: WatchOptions;
  };

/**
 * Create macro plugin.
 *
 * For example,
 * ```typescript
 * // vite.config.ts
 *
 * export default defineConfig({
 *   plugins: [
 *     createMacroPlugin({ ... })
 *       .use(provideSomeMacros({ ... }))
 *   ],
 * })
 * ```
 */
export function createMacroPlugin(
  /* istanbul ignore next */
  options: MacroPluginOptions = {}
): MacroPlugin {
  const {
    exclude,
    include,
    maxTraversals,
    typesPath,
    dev,
    ssr,
    watcherOptions,
    parserPlugins,
  } = options;

  const uninstantiatedProviders: MacroProvider[] = [];

  let runtime: Runtime | undefined;

  const plugin: MacroPlugin = {
    use(...sources) {
      uninstantiatedProviders.push(...sources);
      return plugin;
    },
    name: "vite-plugin-macro",
    enforce: "pre",
    configResolved: async (config) => {
      // create env
      const env = createEnvContext(
        dev ?? !config.isProduction,
        ssr ?? !!config.build.ssr,
        watcherOptions
      );

      // init runtime
      runtime = createRuntime(env, {
        // @ts-ignore
        filter: { exclude, include },
        // @ts-ignore
        transformer: { maxTraversals, parserPlugins },
      });

      // add providers
      uninstantiatedProviders.forEach((provider) => {
        runtime!.appendProvider(provider);
      });

      // call onStart hook and render types
      await Promise.all([
        runtime!.start(),
        runtime!.renderTypes(
          /* @ts-ignore istanbul ignore next */
          typesPath || join(env.projectPath[0], "macros.d.ts")
        ),
      ]);
    },
    configureServer: async (server) => {
      // @ts-ignore
      (runtime!.internal.env.modules as InternalModules).__setServer(server);
    },
    resolveId: (id) => runtime?.resolveId(id),
    load: (id) => runtime?.load(id),
    transform: async (code, id) => {
      if (!(await runtime?.filter(id))) return;
      const result = await runtime?.transform(code, id);
      return result && { code: result, map: null };
    },
    buildEnd: async () => {
      await runtime!.stop();
    },
  };

  return plugin;
}
