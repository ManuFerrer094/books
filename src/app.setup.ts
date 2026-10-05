import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function configureApp(
  app: INestApplication,
  env: { VERCEL?: string } = process.env,
) {
  // Vercel Services preserve the public path, including /api.
  // Standalone Nest development keeps the existing /books and /docs URLs.
  if (env.VERCEL === '1') app.setGlobalPrefix('api');

  const config = new DocumentBuilder()
    .setTitle('Biblioteca API')
    .setDescription('API REST para la gestión de libros de la biblioteca.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config), {
    useGlobalPrefix: true,
  });
}
