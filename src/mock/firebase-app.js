const apps = [];

export function initializeApp(cfg = {}, name = '[DEFAULT]') {
  const existing = apps.find(a => a.name === name);
  if (existing) return existing;
  const app = { name, options: cfg };
  apps.push(app);
  return app;
}

export function getApps() {
  return [...apps];
}

export function getApp(name = '[DEFAULT]') {
  const app = apps.find(a => a.name === name);
  if (!app) throw new Error(`Firebase app named ${name} does not exist.`);
  return app;
}
