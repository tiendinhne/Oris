from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Đọc cấu hình từ biến môi trường (docker-compose truyền vào)."""

    service_name: str = "post-service"
    database_url: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    auth_service_url: str = "http://auth-service:8000"
    notification_service_url: str = "http://notification-service:3000"
    search_service_url: str = "http://search-service:8000"
    feed_service_url: str = "http://feed-service:3000"
    internal_api_key: str = ""


settings = Settings()
