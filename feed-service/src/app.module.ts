import { Controller, Get, Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { ENTITIES } from './entities'

@Controller()
class HealthController {
  constructor(private readonly db: DataSource) {}

  @Get('health')
  async health() {
    await this.db.query('SELECT 1')
    return { service: 'feed-service', database: 'ok' }
  }
}

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: ENTITIES,
      // Giống Notification: tự tạo bảng khi khởi động; chuyển sang migration TypeORM khi cần lịch sử thay đổi
      synchronize: true,
    }),
  ],
  controllers: [HealthController],
})
export class AppModule {}
