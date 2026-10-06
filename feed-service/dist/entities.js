"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENTITIES = exports.FollowRef = exports.MutedUser = exports.HiddenPost = exports.PostScore = exports.FeedItem = void 0;
const typeorm_1 = require("typeorm");
/**
 * Model của Feed Service – khớp ERD feed_db.
 * Toàn bộ dữ liệu ở đây là dữ liệu dựng lại từ sự kiện của Auth và Post (không có khóa ngoại sang service khác).
 */
/** Bảng tin dựng sẵn cho từng người, kiểu "đẩy khi ghi" (fan-out on write) – BR-FE1 */
let FeedItem = class FeedItem {
};
exports.FeedItem = FeedItem;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], FeedItem.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'owner_id', type: 'uuid' }),
    __metadata("design:type", String)
], FeedItem.prototype, "ownerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'post_id', type: 'uuid' }),
    __metadata("design:type", String)
], FeedItem.prototype, "postId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'author_id', type: 'uuid' }),
    __metadata("design:type", String)
], FeedItem.prototype, "authorId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'reposter_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], FeedItem.prototype, "reposterId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'activity_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], FeedItem.prototype, "activityAt", void 0);
exports.FeedItem = FeedItem = __decorate([
    (0, typeorm_1.Entity)('feed_items'),
    (0, typeorm_1.Unique)('uq_feed_items_owner_post', ['ownerId', 'postId']) // BR-FE1-04: mỗi bài chỉ hiện một lần
    ,
    (0, typeorm_1.Index)('ix_feed_items_owner_activity', ['ownerId', 'activityAt'])
], FeedItem);
/** Điểm phổ biến cho bảng tin khám phá: thích + trả lời + đăng lại, tính lại mỗi 10 phút – BR-FE2-02 */
let PostScore = class PostScore {
};
exports.PostScore = PostScore;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ name: 'post_id', type: 'uuid' }),
    __metadata("design:type", String)
], PostScore.prototype, "postId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'author_id', type: 'uuid' }),
    __metadata("design:type", String)
], PostScore.prototype, "authorId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], PostScore.prototype, "score", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'post_created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], PostScore.prototype, "postCreatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' }),
    __metadata("design:type", Date)
], PostScore.prototype, "updatedAt", void 0);
exports.PostScore = PostScore = __decorate([
    (0, typeorm_1.Entity)('post_scores'),
    (0, typeorm_1.Index)('ix_post_scores_score', ['score'])
], PostScore);
/** Bài người dùng đã ẩn khỏi bảng tin – BR-FE3-02 */
let HiddenPost = class HiddenPost {
};
exports.HiddenPost = HiddenPost;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ name: 'user_id', type: 'uuid' }),
    __metadata("design:type", String)
], HiddenPost.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.PrimaryColumn)({ name: 'post_id', type: 'uuid' }),
    __metadata("design:type", String)
], HiddenPost.prototype, "postId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'created_at', type: 'timestamptz', default: () => 'now()' }),
    __metadata("design:type", Date)
], HiddenPost.prototype, "createdAt", void 0);
exports.HiddenPost = HiddenPost = __decorate([
    (0, typeorm_1.Entity)('hidden_posts')
], HiddenPost);
/** Người đã bị "ẩn mọi bài" – BR-FE3-03 */
let MutedUser = class MutedUser {
};
exports.MutedUser = MutedUser;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ name: 'user_id', type: 'uuid' }),
    __metadata("design:type", String)
], MutedUser.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.PrimaryColumn)({ name: 'muted_user_id', type: 'uuid' }),
    __metadata("design:type", String)
], MutedUser.prototype, "mutedUserId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'created_at', type: 'timestamptz', default: () => 'now()' }),
    __metadata("design:type", Date)
], MutedUser.prototype, "createdAt", void 0);
exports.MutedUser = MutedUser = __decorate([
    (0, typeorm_1.Entity)('muted_users')
], MutedUser);
/** Bản sao quan hệ theo dõi, nhận từ sự kiện Followed/Unfollowed của Auth */
let FollowRef = class FollowRef {
};
exports.FollowRef = FollowRef;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ name: 'follower_id', type: 'uuid' }),
    __metadata("design:type", String)
], FollowRef.prototype, "followerId", void 0);
__decorate([
    (0, typeorm_1.PrimaryColumn)({ name: 'following_id', type: 'uuid' }),
    __metadata("design:type", String)
], FollowRef.prototype, "followingId", void 0);
exports.FollowRef = FollowRef = __decorate([
    (0, typeorm_1.Entity)('follow_refs'),
    (0, typeorm_1.Index)('ix_follow_refs_following', ['followingId'])
], FollowRef);
exports.ENTITIES = [FeedItem, PostScore, HiddenPost, MutedUser, FollowRef];
//# sourceMappingURL=entities.js.map