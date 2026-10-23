from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Đọc cấu hình từ biến môi trường (docker-compose truyền vào)."""

    service_name: str = "search-service"
    database_url: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    internal_api_key: str = ""
    post_service_url: str = "http://post-service:8000"


settings = Settings()
