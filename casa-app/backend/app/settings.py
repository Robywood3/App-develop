"""Runtime settings, read from environment variables (backend/.env)."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


def _bool(value: str | None, default: bool) -> bool:
    if value is None or value == "":
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass
class Settings:
    ha_url: str = ""
    ha_token: str = ""
    database_url: str = ""
    config_dir: Path = Path(__file__).resolve().parents[2] / "config"
    frigate_url: str = ""
    go2rtc_url: str = ""
    mqtt_host: str = ""
    mqtt_port: int = 1883
    mqtt_user: str = ""
    mqtt_password: str = ""
    cookie_secure: bool = True
    history_min_interval: float = 10.0
    bootstrap_user: str = ""
    bootstrap_password: str = ""
    session_days_home: int = 365
    session_days_mobile: int = 30
    extra: dict = field(default_factory=dict)

    @classmethod
    def from_env(cls) -> "Settings":
        env = os.environ
        return cls(
            ha_url=env.get("HA_URL", ""),
            ha_token=env.get("HA_TOKEN", ""),
            database_url=env.get("DATABASE_URL", ""),
            config_dir=Path(env.get("CONFIG_DIR", str(cls.config_dir))),
            frigate_url=env.get("FRIGATE_URL", "").rstrip("/"),
            go2rtc_url=env.get("GO2RTC_URL", "").rstrip("/"),
            mqtt_host=env.get("MQTT_HOST", ""),
            mqtt_port=int(env.get("MQTT_PORT", "1883")),
            mqtt_user=env.get("MQTT_USER", ""),
            mqtt_password=env.get("MQTT_PASSWORD", ""),
            cookie_secure=_bool(env.get("COOKIE_SECURE"), True),
            history_min_interval=float(env.get("HISTORY_MIN_INTERVAL", "10")),
            bootstrap_user=env.get("BOOTSTRAP_ADMIN", ""),
            bootstrap_password=env.get("BOOTSTRAP_PASSWORD", ""),
        )
