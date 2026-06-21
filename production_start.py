#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生产环境启动脚本
用于在服务器上启动所有服务
"""

import os
import sys
import time
import signal
import subprocess
import threading
from datetime import datetime

# 添加UTF-8编码支持
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except:
        pass

class ProductionManager:
    def __init__(self):
        self.processes = {}
        self.running = True
        
    def log(self, message):
        """记录日志"""
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        print(f"[{timestamp}] {message}")
    
    def start_backend_service(self):
        """启动小程序后端服务"""
        self.log("启动小程序后端服务...")
        
        try:
            # 设置环境变量
            env = os.environ.copy()
            env['FLASK_ENV'] = 'production'
            env['PYTHONPATH'] = os.getcwd()
            
            # 启动进程
            process = subprocess.Popen(
                [sys.executable, 'warehouse_backend.py'],
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                universal_newlines=True,
                bufsize=1
            )
            
            self.processes['backend'] = process
            self.log(f"小程序后端服务已启动 (PID: {process.pid})")
            
            # 启动日志监控线程
            threading.Thread(
                target=self.monitor_process_output,
                args=(process, 'backend'),
                daemon=True
            ).start()
            
            return True
            
        except Exception as e:
            self.log(f"启动小程序后端服务失败: {e}")
            return False
    
    def start_admin_service(self):
        """启动管理员PC端服务"""
        self.log("启动管理员PC端服务...")
        
        try:
            # 设置环境变量
            env = os.environ.copy()
            env['FLASK_ENV'] = 'production'
            env['PYTHONPATH'] = os.getcwd()
            
            # 启动进程
            process = subprocess.Popen(
                [sys.executable, 'admin_web_app.py'],
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                universal_newlines=True,
                bufsize=1
            )
            
            self.processes['admin'] = process
            self.log(f"管理员PC端服务已启动 (PID: {process.pid})")
            
            # 启动日志监控线程
            threading.Thread(
                target=self.monitor_process_output,
                args=(process, 'admin'),
                daemon=True
            ).start()
            
            return True
            
        except Exception as e:
            self.log(f"启动管理员PC端服务失败: {e}")
            return False
    
    def monitor_process_output(self, process, service_name):
        """监控进程输出"""
        try:
            for line in iter(process.stdout.readline, ''):
                if line.strip():
                    self.log(f"[{service_name}] {line.strip()}")
        except Exception as e:
            self.log(f"监控 {service_name} 输出时发生错误: {e}")
    
    def check_services_health(self):
        """检查服务健康状态"""
        import requests
        
        services = [
            ('backend', 'http://localhost:5000/api/health', '小程序后端'),
            ('admin', 'http://localhost:8081/login', '管理员PC端')
        ]
        
        all_healthy = True
        
        for service_key, url, name in services:
            try:
                response = requests.get(url, timeout=5)
                if response.status_code == 200:
                    self.log(f"✓ {name} 健康检查通过")
                else:
                    self.log(f"✗ {name} 健康检查失败: HTTP {response.status_code}")
                    all_healthy = False
            except requests.exceptions.RequestException as e:
                self.log(f"✗ {name} 健康检查失败: {e}")
                all_healthy = False
        
        return all_healthy
    
    def wait_for_services(self, timeout=30):
        """等待服务启动"""
        self.log(f"等待服务启动 (最多等待 {timeout} 秒)...")
        
        start_time = time.time()
        while time.time() - start_time < timeout:
            if self.check_services_health():
                self.log("所有服务已成功启动并通过健康检查")
                return True
            
            time.sleep(2)
        
        self.log("服务启动超时或健康检查失败")
        return False
    
    def stop_all_services(self):
        """停止所有服务"""
        self.log("正在停止所有服务...")
        self.running = False
        
        for service_name, process in self.processes.items():
            try:
                self.log(f"停止 {service_name} 服务 (PID: {process.pid})")
                
                # 优雅停止
                process.terminate()
                
                # 等待进程结束
                try:
                    process.wait(timeout=10)
                    self.log(f"{service_name} 服务已停止")
                except subprocess.TimeoutExpired:
                    # 强制杀死进程
                    self.log(f"强制停止 {service_name} 服务")
                    process.kill()
                    process.wait()
                    
            except Exception as e:
                self.log(f"停止 {service_name} 服务时发生错误: {e}")
        
        self.processes.clear()
    
    def signal_handler(self, signum, frame):
        """信号处理器"""
        self.log(f"收到信号 {signum}，正在优雅停止...")
        self.stop_all_services()
        sys.exit(0)
    
    def run_pre_checks(self):
        """运行启动前检查"""
        self.log("运行启动前检查...")
        
        # 检查必要文件
        required_files = [
            'warehouse_backend.py',
            'admin_web_app.py',
            'config_manager.py'
        ]
        
        for file_path in required_files:
            if not os.path.exists(file_path):
                self.log(f"✗ 缺少必要文件: {file_path}")
                return False
        
        # 检查Python依赖
        try:
            import flask
            import mysql.connector
            self.log("✓ Python依赖检查通过")
        except ImportError as e:
            self.log(f"✗ Python依赖检查失败: {e}")
            return False
        
        # 检查数据库连接
        try:
            from config_manager import DATABASE_CONFIG
            import mysql.connector
            
            conn = mysql.connector.connect(**DATABASE_CONFIG)
            conn.close()
            self.log("✓ 数据库连接检查通过")
        except Exception as e:
            self.log(f"✗ 数据库连接检查失败: {e}")
            return False
        
        return True
    
    def start_all_services(self):
        """启动所有服务"""
        self.log("="*60)
        self.log("水电班仓库管理系统 - 生产环境启动")
        self.log("="*60)
        
        # 注册信号处理器
        signal.signal(signal.SIGINT, self.signal_handler)
        signal.signal(signal.SIGTERM, self.signal_handler)
        
        # 运行启动前检查
        if not self.run_pre_checks():
            self.log("启动前检查失败，退出")
            return False
        
        # 启动服务
        success = True
        
        if not self.start_backend_service():
            success = False
        
        time.sleep(2)  # 等待后端服务启动
        
        if not self.start_admin_service():
            success = False
        
        if not success:
            self.log("部分服务启动失败，停止所有服务")
            self.stop_all_services()
            return False
        
        # 等待服务完全启动
        if not self.wait_for_services():
            self.log("服务健康检查失败，停止所有服务")
            self.stop_all_services()
            return False
        
        self.log("="*60)
        self.log("🎉 所有服务启动成功！")
        self.log("小程序后端API: http://localhost:5000")
        self.log("管理员PC端: http://localhost:8081")
        self.log("按 Ctrl+C 停止所有服务")
        self.log("="*60)
        
        # 保持运行状态
        try:
            while self.running:
                # 定期检查进程状态
                for service_name, process in list(self.processes.items()):
                    if process.poll() is not None:
                        self.log(f"⚠️ 检测到 {service_name} 服务异常退出 (退出码: {process.returncode})")
                        self.running = False
                        break
                
                if self.running:
                    time.sleep(5)
                    
        except KeyboardInterrupt:
            pass
        
        self.stop_all_services()
        return True

def main():
    """主函数"""
    manager = ProductionManager()
    
    try:
        success = manager.start_all_services()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"启动过程中发生错误: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()















