import ChatGPT from './api'
import { Context, Logger, Schema, SessionError } from 'koishi'

const logger = new Logger('chatgpt')

export interface Config extends ChatGPT.Config {
  appellation: boolean
  prefix: string[]
}

export const Config: Schema<Config> = Schema.intersect([
  ChatGPT.Config,
  Schema.object({
    appellation: Schema.boolean().description('是否使用称呼触发对话。').default(true),
    prefix: Schema.union([
      Schema.array(String),
      Schema.transform(String, (prefix) => [prefix]),
    ] as const).description('使用特定前缀触发对话。').default(['!', '！']),
  }),
])

export function apply(ctx: Context, config: Config) {
  ctx.i18n.define('zh', require('./locales/zh-CN'))

  const api = new ChatGPT(ctx, config)

  ctx.middleware(async (session, next) => {
    if (session.parsed?.appel) {
      return session.execute('chatgpt ' + session.parsed.content)
    }
    for (const prefix of config.prefix) {
      if (!prefix || !session.content.startsWith(prefix)) continue
      return session.execute('chatgpt ' + session.content.slice(config.prefix.length))
    }
    return next()
  })

  ctx.command('chatgpt')
    .action(async ({ session }, input) => {
      try {
        // ensure the API is properly authenticated (optional)
        await api.ensureAuth()
      } catch (err) {
        return session.text('.invalid-token')
      }

      try {
        // send a message and wait for the response
        const response = await api.sendMessage(input)
        return response
      } catch (error) {
        logger.warn(error)
        throw new SessionError('commands.chatgpt.messages.unknown-error')
      }
    })
}
