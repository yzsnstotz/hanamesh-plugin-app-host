// Test-only diagnostic plugin inserted through the profile's user patch: copies every Cordis log message (and the
// buffer collected before it loaded) to a file. Token-shaped values are redacted. Not part of any product path.
import fs from 'node:fs'; import { format } from 'node:util';
export const name = 'p02-log-tap';
export function apply(ctx, config) {
  const write = m => fs.appendFileSync(config.file, JSON.stringify({ at:new Date().toISOString(), type:m.type, name:m.name,
    text:format(...(m.args ?? [])).replace(/token=[A-Za-z0-9_-]+/g, 'token=<redacted>').slice(0, 4000) }) + '\n');
  for (const m of ctx.logger.buffer ?? []) write(m);
  ctx.logger.exporter({ colors:0, levels:{ default:3 }, export:write });
}
