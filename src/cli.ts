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
    --all         Incluye sesiones de las últimas 24h
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

// Filtro --project
const projectFilter = cli.flags.project
  ? (cwd: string) => cwd === cli.flags.project || cwd.startsWith(cli.flags.project! + '/')
  : undefined

// Nota: --all requiere escanear JSONL históricos. Implementación futura.
if (cli.flags.all) {
  process.stderr.write('--all aún no implementado; mostrando solo sesiones activas.\n')
}

const { unmount } = render(React.createElement(App, { projectFilter }))

if (cli.flags.snapshot) {
  // Esperar a que los providers lean los archivos y el render loop dispare al menos una vez
  setTimeout(() => { unmount(); process.exit(0) }, 1500)
}
