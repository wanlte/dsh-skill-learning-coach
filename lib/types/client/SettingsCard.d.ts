import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { Context } from './context-types.ts';
export type SettingsCardProps = PropsLocale<'learning.coach'> & {
    ctx: Context;
    close: () => void;
};
export declare function SettingsCard({ t, ctx, close }: SettingsCardProps): JSX.Element;
