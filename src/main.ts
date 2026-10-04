import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { getCACertificates, setDefaultCACertificates } from 'node:tls';

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
  const config = new DocumentBuilder()
    .setTitle('Biblioteca API')
    .setDescription('API REST para la gestión de libros de la biblioteca.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
