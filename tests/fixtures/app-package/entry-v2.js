import { readFile } from 'node:fs/promises';
export const name = '@hanamesh/app-example';
export async function apply(ctx, config = {}) {
  if (Object.keys(config).length) throw new Error('Application bundle does not accept config.');
  const definition = JSON.parse(await readFile(new URL('./app.json', import.meta.url), 'utf8'));
  ctx.inject(['hanameshApps'], scoped => {
    const apps = scoped.get('hanameshApps');
    const { appId, registrationId } = apps.register(definition);
    return () => apps.unregister(appId, registrationId);
  });
}
