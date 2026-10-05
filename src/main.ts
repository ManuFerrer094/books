import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { getCACertificates, setDefaultCACertificates } from 'node:tls';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { INestApplication } from '@nestjs/common';

async function bootstrap() {
  // Include the OS trust store (e.g. Windows enterprise/proxy certificates),
  // preserving Node's default roots and normal HTTPS certificate verification.
  if (
    typeof getCACertificates === 'function' &&
    typeof setDefaultCACertificates === 'function'
  ) {
    setDefaultCACertificates([
      ...getCACertificates('default'),
      ...getCACertificates('system'),
    ]);
  }
  const app = await NestFactory.create(AppModule);
  console.log('Nest Vercel check: before configuration');
  try { configureApp(app); } catch (error) { console.error('Nest configuration failed:', error); throw error; }
  console.log('Nest Vercel check: before initialization');
  await app.init();
  console.log('Nest Vercel check: initialized');
  return app;
}

let ready: Promise<INestApplication> | undefined;
function getApp() {
  return (ready ??= bootstrap());
}

// Export an explicit function so Vercel waits for Nest initialization instead
// of relying on detecting a listen() call during a potentially slow cold start.
export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  const app = await getApp();
  app.getHttpAdapter().getInstance()(req, res);
}

if (process.env.VERCEL !== '1') {
  void getApp().then((app) => app.listen(process.env.PORT ?? 3000));
}
