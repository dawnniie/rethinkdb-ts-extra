import type { RDatabaseExtraConfigs, RExtra } from './types.js'
import type { RBaseConnectionOptions, RServerConnectionOptions } from 'rethinkdb-ts'

type BaseOptionsKeys = 'user' | 'password' | 'discovery' | 'pool' | 'buffer' | 'max' | 'timeout' | 'pingInterval' | 'timeoutError' | 'timeoutGb' | 'maxExponent' | 'silent' | 'log'
export interface ConnectOptions<DefaultDB extends string> extends Pick<RBaseConnectionOptions, BaseOptionsKeys> {
  /**
   * default database to use when unspecified
   * @default 'test'
   */
  db?: DefaultDB,
  /**
   * postgresql-like connection url to locate the server
   * 
   * `[rethinkdb:]//[user[:password]@][host][:port][/db]`
   * 
   * note: only one of url, host & port, server, or servers may be specified
   */
  url?: string,
  /**
   * host to find the rethinkdb server
   * 
   * note: only one of url, host & port, server, or servers may be specified
   * @default 'localhost'
   */
  host?: string,
  /**
   * port to connect to the rethinkdb driver via
   * 
   * note: only one of url, host & port, server, or servers may be specified
   * @default 28015
   */
  port?: number,
  /**
   * note: only one of url, host & port, server, or servers may be specified
   */
  server?: RServerConnectionOptions,
  /**
   * note: only one of url, host & port, server, or servers may be specified
   */
  servers?: RServerConnectionOptions[],
  /**
   * whether to wait for the pool to be healthy before continuing
   * @default true
   */
  waitForHealthy?: boolean
}

export async function connect<_Configs extends RDatabaseExtraConfigs, DefaultDB extends string>(r: RExtra<_Configs, DefaultDB>, options: ConnectOptions<DefaultDB> = {}) {
  const { url = undefined, host = undefined, port = undefined, server = null, servers = undefined, ...otherOptions } = options
  const truthy = [url, host && port, server, servers].map(v => Boolean(v))
  if (truthy.filter(value => value).length > 1) throw new Error('connection options: only one of url, host & port, server, or servers may be specified')
  
  if (url) {
    if (!url.startsWith('rethinkdb://') && !url.startsWith('//')) throw new Error('connection options: invalid url scheme')
    const noScheme = url.startsWith('r') ? url.replace('rethinkdb://', '') : url.replace('//', '')
    const [auth, location] = noScheme.includes('@') ? noScheme.split('@') as [string, string] : [undefined, noScheme]
    let [user, password] = auth?.split(':') ?? [undefined, undefined]
    const host = (!location || location.startsWith(':') || location.startsWith('/')) ? undefined : location.split('/')[0]!.split(':')[0]!
    const port = location.split('/')[0]!.includes(':') ? Number(location.split(':')[1]!.split('/')[0]!) : undefined
    if (port !== undefined && isNaN(port)) throw new Error('connection options: invalid url port')
    let db = location.split('/')[1] || undefined

    if (user && otherOptions.user) throw new Error('connection options: user specified twice (url & options)')
    if (!user) user = otherOptions.user || 'admin'
    if (password && otherOptions.password) throw new Error('connection options: password specified twice (url & options)')
    if (!password) password = otherOptions.password || ''
    if (db && db !== 'test' && db !== otherOptions.db) console.warn('warn: when including a connection db in your url, your typings may be incorrect unless you set the db option too')
    if (!db) db = otherOptions.db || 'test'

    return await r.connectPool({ host: host ?? 'localhost', port: port ?? 28015, ...otherOptions, user, password, db })
  } else if (host || port) {
    return await r.connectPool({ host: host ?? 'localhost', port: port ?? 28015, ...otherOptions })
  } else if (server) {
    return await r.connectPool({ servers: [server], ...otherOptions })
  } else if (servers) {
    return await r.connectPool({ servers, ...otherOptions })
  } else {
    return await r.connectPool({ host: 'localhost', port: 28015, ...otherOptions })
  }
}
