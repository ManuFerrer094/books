import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { configureApp } from './app.setup.js';

describe.each([
  { name: 'standalone Nest', env: {}, prefix: '' },
  { name: 'Vercel Services', env: { VERCEL: '1' }, prefix: '/api' },
])('$name routing', ({ env, prefix }) => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();
    app = module.createNestApplication();
    configureApp(app, env);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves API endpoints and Swagger under the same prefix', async () => {
    await request(app.getHttpServer())
      .get(prefix || '/')
      .expect(200)
      .expect('Hello World!');
    await request(app.getHttpServer())
      .get(`${prefix}/docs/`)
      .expect(200)
      .expect('Content-Type', /html/);
    const schema = await request(app.getHttpServer())
      .get(`${prefix}/docs-json`)
      .expect(200);
    expect(schema.body.paths).toHaveProperty(prefix || '/');
  });

  if (prefix) {
    it('does not accidentally expose unprefixed backend routes', async () => {
      await request(app.getHttpServer()).get('/').expect(404);
      await request(app.getHttpServer()).get('/docs').expect(404);
    });
  }
});
