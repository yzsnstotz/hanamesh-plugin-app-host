// These two orderings are used by the production manager AND the real SIGKILL tests.
// Keep fault injection as a trusted constructor dependency, never a browser option.
export async function reserveBeforeLaunch(publish, launch, checkpoint = async () => {}) {
  await publish(); // ORDER:RESERVE
  await checkpoint('reservation-durable');
  return await launch(); // ORDER:LAUNCH
}
export async function stopBeforePublish(stop, publish, checkpoint = async () => {}) {
  await stop(); // ORDER:STOP
  await checkpoint('runtime-stopped');
  return await publish(); // ORDER:STOPPED-PUBLISH
}
