from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Đọc cấu hình từ biến môi trường (docker-compose truyền vào)."""

    service_name: str = "auth-service"
    database_url: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 15   # BR-AU2-04
    refresh_token_days: int = 7


settings = Settings()
