import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { ErrorFilter } from './errors'

async function bootstrap() {
  for (const k of ['DATABASE_URL', 'JWT_SECRET']) if (!process.env[k]) throw new Error(`Thiếu biến môi trường ${k}`)
  const app = await NestFactory.create(AppModule)
  app.useGlobalFilters(new ErrorFilter())
  await app.listen(3000, '0.0.0.0')
}
bootstrap()
