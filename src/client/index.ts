import type { Context } from './context-types.ts'
import { SettingsCard } from './SettingsCard.tsx'
import { en, zh } from './locales.ts'

export const name = 'dsh-skill-learning-coach-client'

export const inject = ['slots', 'locale', 'sessions']

export const LOCALE_NS = 'learning.coach'

export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(LOCALE_NS, { zh, en }), 'dsh-skill-learning-coach: dictionaries')
  const t = ctx.locale.bind(LOCALE_NS)
  ctx.effect(() => ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
    name: 'settings.plugins.tab',
    id: 'learning-coach',
    order: 30,
    label: () => t('settingsTitle'),
    locale: LOCALE_NS,
    inject: () => ({ ctx }),
  }, SettingsCard)), 'dsh-skill-learning-coach: settings tab')
}
