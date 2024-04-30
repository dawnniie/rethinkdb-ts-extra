import { attachConfigurations, configure } from './index.js'

interface BroadStructure {
  id: string
  str: string
  num: number
  list: string[]
}

const tableConfig = {
  test: configure<BroadStructure>('rdb-ts-extra-test', 'data')({
    str: {},
    list: { multi: true },
    compound: { compound: ['id', 'num', 'list'] },
    custom_multi: { custom: row => [row('id'), row('str')], multi: true },
    custom_multi_compound: { custom: row => [[row('id'), row('str')], [row('id'), row('num')]] as const, multi: true },
    custom: { custom: row => row('num').add(1) },
    custom_compound: { custom: row => [row('id'), row('str')] as const }
  })
}

const { r, upgrade } = attachConfigurations(tableConfig)

await r.connectPool()
await upgrade({ db: 'rdb-ts-extra-test' })

await r.test.getAll('test', { index: 'str' }).run()
await r.test.getAll('test', { index: 'list' }).run()
await r.test.getAll(['test', 3, ['hello']], { index: 'compound' }).run()
await r.test.getAll('test', { index: 'custom_multi' }).run()
await r.test.getAll(['test', 'hello'], { index: 'custom_multi_compound' }).run()
await r.test.getAll(['test', 2], { index: 'custom_multi_compound' }).run()
await r.test.getAll(4, { index: 'custom' }).run()
await r.test.getAll(['test', 'hello'], { index: 'custom_compound' }).run()

await r.getPoolMaster()?.drain()
