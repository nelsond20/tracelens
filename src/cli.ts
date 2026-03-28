#!/usr/bin/env node
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import meow from 'meow'
import { render } from 'ink'
import React from 'react'
import { App } from './ui/App.js'
import { loadCustomPricing } from './models/pricing.js'

const configPath = path.join(os.homedir(), '.tracelens.json')
if (fs.existsSync(configPath)) {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
    if (config.pricing) loadCustomPricing(config.pricing)
  } catch { /* ignorar config malformado */ }
}

const cli = meow(`
  Usage
    $ tracelens [options]

  Options
    --snapshot    Imprime el árbol una vez y sale
    --all         Muestra todas las sesiones, incluyendo las inactivas
    --project     Filtra por directorio de proyecto

  Examples
    $ tracelens
    $ tracelens --snapshot
    $ tracelens --project ~/workspace/myapp
`, {
  importMeta: import.meta,
  flags: {
    snapshot: { type: 'boolean', default: false },
    all: { type: 'boolean', default: false },
    project: { type: 'string' },
  },
})

function enterFullscreen() {
  process.stdout.write('\x1b[?1049h')
  process.stdout.write('\x1b[?25l')
}

let cleanedUp = false
function cleanup() {
  if (cleanedUp) return
  cleanedUp = true
  process.stdout.write('\x1b[?25h')
  process.stdout.write('\x1b[?1049l')
}

let doUnmount: (() => void) | undefined

if (!cli.flags.snapshot) {
  enterFullscreen()
  process.on('SIGINT', () => { doUnmount?.(); cleanup(); process.exit(0) })
  process.on('SIGTERM', () => { doUnmount?.(); cleanup(); process.exit(0) })
  process.on('exit', cleanup)
  process.on('uncaughtException', (err) => { cleanup(); process.stderr.write((err.stack ?? String(err)) + '\n'); process.exit(1) })
}

const projectFilter = cli.flags.project
  ? (cwd: string) => cwd === cli.flags.project || cwd.startsWith(cli.flags.project! + '/')
  : undefined


const CLEAR_TERMINAL = '\x1b[2J\x1b[3J\x1b[H'

const stdout = !cli.flags.snapshot
  ? new Proxy(process.stdout, {
      get(target, prop, receiver) {
        if (prop === 'rows') return 0
        if (prop === 'write') {
          return (chunk: Buffer | string) => {
            const str = typeof chunk === 'string' ? chunk : chunk.toString('utf8')
            if (str.startsWith(CLEAR_TERMINAL)) {
              return process.stdout.write('\x1b[H' + str.slice(CLEAR_TERMINAL.length) + '\x1b[J')
            }
            return target.write(chunk)
          }
        }
        const val = Reflect.get(target, prop, receiver)
        return typeof val === 'function' ? val.bind(target) : val
      },
    }) as NodeJS.WriteStream
  : process.stdout

const { unmount } = render(React.createElement(App, { projectFilter, showInactive: cli.flags.all }), { stdout })
doUnmount = unmount

if (cli.flags.snapshot) {
  setTimeout(() => { unmount(); process.exit(0) }, 1500)
}
