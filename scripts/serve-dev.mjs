// Keep experiments on a different origin from the stable local app (port 4173).
process.env.WANDERLIGHT_PORT = '4176';
await import('./serve.mjs');
