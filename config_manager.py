#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import os
from typing import Dict, Optional

DATABASE_CONFIG = {
    'host': 'localhost',
    'port': 3306,
    'user': 'warehouse_user',
    'password': 'your_secure_password',
    'database': 'warehouse_db',
    'charset': 'utf8mb4',
    'autocommit': True
}

class ConfigManager:
    def __init__(self, config_file: str = "worker_config.json"):
        self.config_file = config_file
        self.default_config = {
            "database": {
                "host": "localhost",
                "port": 3306,
                "database": "warehouse_db",
                "user": "root",
                "password": "123456"
            },
            "connection": {
                "auto_connect": False,
                "last_connected": False
            },
            "ui": {
                "remember_window_size": True,
                "window_geometry": "1000x700"
            }
        }
    
    def load_config(self) -> Dict:
        if not os.path.exists(self.config_file):
            return self.default_config.copy()
        try:
            with open(self.config_file, 'r', encoding='utf-8') as f:
                config = json.load(f)
                return self._merge_config(self.default_config, config)
        except (json.JSONDecodeError, FileNotFoundError) as e:
            print(f"配置文件读取失败: {e}")
            return self.default_config.copy()
    
    def save_config(self, config: Dict) -> bool:
        try:
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(config, f, ensure_ascii=False, indent=4)
            return True
        except Exception as e:
            print(f"配置文件保存失败: {e}")
            return False
    
    def get_db_config(self) -> Dict:
        config = self.load_config()
        return config.get("database", self.default_config["database"])
    
    def set_db_config(self, host: str, port: int = 3306, 
                     database: str = "warehouse_db", 
                     user: str = "root", 
                     password: str = "123456") -> bool:
        config = self.load_config()
        config["database"] = {
            "host": host,
            "port": port,
            "database": database,
            "user": user,
            "password": password
        }
        return self.save_config(config)
    
    def is_configured(self) -> bool:
        config = self.load_config()
        db_config = config.get("database", {})
        return bool(db_config.get("host", "").strip())
    
    def set_auto_connect(self, auto_connect: bool) -> bool:
        config = self.load_config()
        config["connection"]["auto_connect"] = auto_connect
        return self.save_config(config)
    
    def get_auto_connect(self) -> bool:
        config = self.load_config()
        return config.get("connection", {}).get("auto_connect", False)
    
    def set_last_connected(self, connected: bool) -> bool:
        config = self.load_config()
        config["connection"]["last_connected"] = connected
        return self.save_config(config)
    
    def get_last_connected(self) -> bool:
        config = self.load_config()
        return config.get("connection", {}).get("last_connected", False)
    
    def _merge_config(self, default: Dict, user: Dict) -> Dict:
        result = default.copy()
        for key, value in user.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = self._merge_config(result[key], value)
            else:
                result[key] = value
        return result
    
    def reset_config(self) -> bool:
        return self.save_config(self.default_config.copy())
