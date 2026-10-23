import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ENTITIES } from './entities'
import { FeedController } from './feed.controller'

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
  controllers: [FeedController],
})
export class AppModule {}
