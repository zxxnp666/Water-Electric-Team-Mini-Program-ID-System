#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
部署配置文件
用于服务器部署时的配置管理
"""

import os

# 部署环境配置
DEPLOY_ENV = os.getenv('DEPLOY_ENV', 'production')  # development, production

# 数据库配置（生产环境）
PRODUCTION_DATABASE_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),          # 服务器IP地址
    'port': int(os.getenv('DB_PORT', 3306)),            # MySQL端口
    'user': os.getenv('DB_USER', 'warehouse_user'),     # 数据库用户名
    'password': os.getenv('DB_PASSWORD', 'your_password'),  # 数据库密码
    'database': os.getenv('DB_NAME', 'warehouse_db'),    # 数据库名
    'charset': 'utf8mb4',
    'autocommit': True,
    'pool_size': 10,
    'pool_recycle': 3600
}

# 开发环境数据库配置
DEVELOPMENT_DATABASE_CONFIG = {
    'host': 'localhost',
    'port': 3306,
    'user': 'root',
    'password': 'root',
    'database': 'warehouse_db',
    'charset': 'utf8mb4',
    'autocommit': True
}

# 服务器配置
SERVER_CONFIG = {
    # 小程序后端服务
    'backend_host': os.getenv('BACKEND_HOST', '0.0.0.0'),
    'backend_port': int(os.getenv('BACKEND_PORT', 5000)),
    'backend_debug': DEPLOY_ENV == 'development',
    
    # 管理员PC端服务
    'admin_host': os.getenv('ADMIN_HOST', '0.0.0.0'),
    'admin_port': int(os.getenv('ADMIN_PORT', 8081)),
    'admin_debug': DEPLOY_ENV == 'development',
}

# 小程序配置
WECHAT_CONFIG = {
    # 服务器地址（需要根据部署环境修改）
    'base_url': os.getenv('WECHAT_BASE_URL', 'https://your-domain.com:5000'),
    # 或者使用 'http://服务器IP:5000'
}

# 安全配置
SECURITY_CONFIG = {
    # 管理员默认密码（部署后必须修改）
    'admin_password': os.getenv('ADMIN_PASSWORD', 'admin123'),
    'wh001_password': os.getenv('WH001_PASSWORD', 'wh123456'),
    
    # 会话密钥（生产环境必须修改）
    'secret_key': os.getenv('SECRET_KEY', 'your-secret-key-here'),
    
    # JWT配置
    'jwt_secret': os.getenv('JWT_SECRET', 'your-jwt-secret-here'),
    'jwt_expiration': 24 * 3600,  # 24小时
}

# 日志配置
LOGGING_CONFIG = {
    'level': os.getenv('LOG_LEVEL', 'INFO'),
    'file': os.getenv('LOG_FILE', '/var/log/warehouse/app.log'),
    'max_size': 10 * 1024 * 1024,  # 10MB
    'backup_count': 5,
}

# SSL配置（HTTPS）
SSL_CONFIG = {
    'enabled': os.getenv('SSL_ENABLED', 'false').lower() == 'true',
    'cert_file': os.getenv('SSL_CERT', '/etc/ssl/certs/warehouse.crt'),
    'key_file': os.getenv('SSL_KEY', '/etc/ssl/private/warehouse.key'),
}

def get_database_config():
    """获取数据库配置"""
    if DEPLOY_ENV == 'production':
        return PRODUCTION_DATABASE_CONFIG
    else:
        return DEVELOPMENT_DATABASE_CONFIG

def get_server_config():
    """获取服务器配置"""
    return SERVER_CONFIG

def get_wechat_config():
    """获取微信小程序配置"""
    return WECHAT_CONFIG

def get_security_config():
    """获取安全配置"""
    return SECURITY_CONFIG

# 部署检查函数
def check_deployment_config():
    """检查部署配置是否完整"""
    issues = []
    
    # 检查数据库配置
    db_config = get_database_config()
    if db_config['password'] in ['root', 'your_password']:
        issues.append("数据库密码使用默认值，请修改")
    
    # 检查安全配置
    security_config = get_security_config()
    if security_config['secret_key'] == 'your-secret-key-here':
        issues.append("Flask密钥使用默认值，请修改")
    
    if security_config['admin_password'] == 'admin123':
        issues.append("管理员密码使用默认值，请修改")
    
    # 检查小程序配置
    wechat_config = get_wechat_config()
    if 'your-domain.com' in wechat_config['base_url']:
        issues.append("小程序服务器地址使用默认值，请修改")
    
    return issues

if __name__ == "__main__":
    print("部署配置检查:")
    issues = check_deployment_config()
    if issues:
        print("发现以下配置问题:")
        for issue in issues:
            print(f"  - {issue}")
    else:
        print("配置检查通过")















