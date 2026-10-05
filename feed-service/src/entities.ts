import { Column, Entity, Index, PrimaryColumn, PrimaryGeneratedColumn, Unique } from 'typeorm'

/**
 * Model của Feed Service – khớp ERD feed_db.
 * Toàn bộ dữ liệu ở đây là dữ liệu dựng lại từ sự kiện của Auth và Post (không có khóa ngoại sang service khác).
 */

/** Bảng tin dựng sẵn cho từng người, kiểu "đẩy khi ghi" (fan-out on write) – BR-FE1 */
@Entity('feed_items')
@Unique('uq_feed_items_owner_post', ['ownerId', 'postId']) // BR-FE1-04: mỗi bài chỉ hiện một lần
@Index('ix_feed_items_owner_activity', ['ownerId', 'activityAt'])
export class FeedItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  /** Chủ bảng tin (ref auth_db.users) */
  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId!: string

  /** ref post_db.posts */
  @Column({ name: 'post_id', type: 'uuid' })
  postId!: string

  /** ref auth_db.users */
  @Column({ name: 'author_id', type: 'uuid' })
  authorId!: string

  /** Người đăng lại; null nếu là bài gốc */
  @Column({ name: 'reposter_id', type: 'uuid', nullable: true })
  reposterId!: string | null

  /** Thời điểm đăng hoặc đăng lại, dùng để sắp xếp */
  @Column({ name: 'activity_at', type: 'timestamptz' })
  activityAt!: Date
}

/** Điểm phổ biến cho bảng tin khám phá: thích + trả lời + đăng lại, tính lại mỗi 10 phút – BR-FE2-02 */
@Entity('post_scores')
@Index('ix_post_scores_score', ['score'])
export class PostScore {
  /** ref post_db.posts */
  @PrimaryColumn({ name: 'post_id', type: 'uuid' })
  postId!: string

  @Column({ name: 'author_id', type: 'uuid' })
  authorId!: string

  @Column({ type: 'int', default: 0 })
  score!: number

  @Column({ name: 'post_created_at', type: 'timestamptz' })
  postCreatedAt!: Date

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date
}

/** Bài người dùng đã ẩn khỏi bảng tin – BR-FE3-02 */
@Entity('hidden_posts')
export class HiddenPost {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string

  @PrimaryColumn({ name: 'post_id', type: 'uuid' })
  postId!: string

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date
}

/** Người đã bị "ẩn mọi bài" – BR-FE3-03 */
@Entity('muted_users')
export class MutedUser {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string

  @PrimaryColumn({ name: 'muted_user_id', type: 'uuid' })
  mutedUserId!: string

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date
}

/** Bản sao quan hệ theo dõi, nhận từ sự kiện Followed/Unfollowed của Auth */
@Entity('follow_refs')
@Index('ix_follow_refs_following', ['followingId'])
export class FollowRef {
  @PrimaryColumn({ name: 'follower_id', type: 'uuid' })
  followerId!: string

  @PrimaryColumn({ name: 'following_id', type: 'uuid' })
  followingId!: string
}

export const ENTITIES = [FeedItem, PostScore, HiddenPost, MutedUser, FollowRef]
