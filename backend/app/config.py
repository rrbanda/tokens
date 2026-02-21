import os
from pathlib import Path

import yaml
from pydantic import BaseModel, Field


class OptimizerConfig(BaseModel):
    server_url: str = ""
    model: str = ""


class DatabaseConfig(BaseModel):
    url: str = "sqlite+aiosqlite:///./data/promptly.db"
    echo: bool = False


class SecurityConfig(BaseModel):
    ssl_verify: bool | str = True
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173"])
    api_key: str = ""
    rate_limit: str = "10/minute"
    blocked_url_patterns: list[str] = Field(default_factory=lambda: [
        "169.254.", "127.0.0.", "10.", "172.16.", "192.168.", "localhost", "[::1]",
    ])


class AppConfig(BaseModel):
    optimizer: OptimizerConfig = Field(default_factory=OptimizerConfig)
    database: DatabaseConfig = Field(default_factory=DatabaseConfig)
    security: SecurityConfig = Field(default_factory=SecurityConfig)


_config: AppConfig | None = None


def load_config() -> AppConfig:
    global _config
    config_path = Path(os.environ.get("CONFIG_PATH", "config.yaml"))
    if not config_path.exists():
        _config = AppConfig()
    else:
        with open(config_path) as f:
            raw = yaml.safe_load(f) or {}
        _config = AppConfig(**raw)

    db_url_env = os.environ.get("DATABASE_URL")
    if db_url_env:
        _config.database.url = db_url_env

    return _config


def get_config() -> AppConfig:
    if _config is None:
        return load_config()
    return _config
