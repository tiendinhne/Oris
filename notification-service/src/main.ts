import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module'
import { ErrorFilter, validationError } from './errors'

async function bootstrap() {
  for (const k of ['DATABASE_URL', 'JWT_SECRET']) if (!process.env[k]) throw new Error(`Thiếu biến môi trường ${k}`)
  const app = await NestFactory.create(AppModule)
  app.useGlobalFilters(new ErrorFilter())
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    // Lỗi dữ liệu trả 422 kèm danh sách trường lỗi, giống Auth/Post
    exceptionFactory: (errors) => validationError(
      errors.map((e) => ({ field: e.property, message: Object.values(e.constraints ?? {})[0] }))),
  }))
  await app.listen(3000, '0.0.0.0')
}
bootstrap()
