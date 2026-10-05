import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {
  if (!process.env.DATABASE_URL) throw new Error('Thiếu biến môi trường DATABASE_URL')
  const app = await NestFactory.create(AppModule)
  await app.listen(3000, '0.0.0.0')
}
bootstrap()
