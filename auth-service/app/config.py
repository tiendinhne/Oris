from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Đọc cấu hình từ biến môi trường (docker-compose truyền vào)."""

    service_name: str = "auth-service"
    database_url: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 15   # BR-AU2-04
    refresh_token_days: int = 7
    notification_service_url: str = "http://notification-service:3000"
    search_service_url: str = "http://search-service:8000"
    # Gửi mail thật qua SMTP (ví dụ Gmail + mật khẩu ứng dụng). Bỏ trống smtp_host thì chỉ ghi log.
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    feed_service_url: str = "http://feed-service:3000"
    internal_api_key: str = ""
    # TẠM THỜI: có giá trị thì mọi mã OTP đều là mã này (demo khỏi xem log). Bỏ trống = sinh mã 6 số ngẫu nhiên.
    mock_otp: str = ""


settings = Settings()
