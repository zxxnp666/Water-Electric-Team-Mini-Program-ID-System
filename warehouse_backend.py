#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from flask import Flask, request, jsonify
from flask_cors import CORS
import mysql.connector
from mysql.connector import Error, pooling
from datetime import datetime
import sql_queries as sql
import json
import threading
import time
import hashlib
import logging
import signal
import sys
import traceback

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler('warehouse_backend.log', encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

class WarehouseBackend:
    def __init__(self):
        self.db_config = {
            'host': 'localhost',
            'database': 'warehouse_db', 
            'user': 'root',
            'password': '123456',
            'charset': 'utf8mb4',
            'use_unicode': True,
            'autocommit': False,
            'pool_name': 'warehouse_pool',
            'pool_size': 10,
            'pool_reset_session': True,
            'connect_timeout': 10,
            'sql_mode': 'STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO'
        }
        self.init_database_pool()
        
    def init_database_pool(self):
        try:
            self.pool = mysql.connector.pooling.MySQLConnectionPool(**self.db_config)
            logger.info(f"[OK] 数据库连接池创建成功，池大小: {self.db_config['pool_size']}")
            with self.get_db_connection() as conn:
                cursor = conn.cursor(dictionary=True)
                logger.info(f"[OK] 连接到MySQL服务器版本: {conn.server_info}")
                self.create_tables(cursor, conn)
                self.init_default_data(cursor, conn)
            return True
        except Error as e:
            logger.error(f"[ERROR] 数据库连接池初始化失败: {e}")
            return False
        except Exception as e:
            logger.error(f"[ERROR] 未知错误: {e}")
            return False
    
    def get_db_connection(self):
        try:
            return self.pool.get_connection()
        except Error as e:
            logger.error(f"[ERROR] 获取数据库连接失败: {e}")
            self.init_database_pool()
            return self.pool.get_connection()
    
    def create_tables(self, cursor, conn):
        try:
            cursor.execute(sql.CREATE_MATERIALS_TABLE)
            cursor.execute(sql.CREATE_RECORDS_TABLE)
            cursor.execute(sql.CREATE_WORKERS_TABLE)
            conn.commit()
            logger.info("[OK] 数据库表结构检查完成")
        except Error as e:
            logger.error(f"[ERROR] 创建表失败: {e}")
            conn.rollback()
    
    def init_default_data(self, cursor, conn):
        try:
            cursor.execute("SELECT COUNT(*) as count FROM workers")
            result = cursor.fetchone()
            if result['count'] == 0:
                default_workers = [
                    ('W001', self.hash_password('123456'), '张三', '水电班', '班长', '13800138001'),
                    ('W002', self.hash_password('123456'), '李四', '水电班', '工人', '13800138002'),
                    ('W003', self.hash_password('123456'), '王五', '水电班', '工人', '13800138003'),
                    ('W004', self.hash_password('123456'), '赵六', '水电班', '工人', '13800138004'),
                    ('W005', self.hash_password('123456'), '钱七', '水电班', '工人', '13800138005'),
                    ('ADMIN', self.hash_password('admin123'), '系统管理员', '管理部', '系统管理员', '13800138888'),
                    ('WH001', self.hash_password('wh123456'), '仓库管理员', '仓储部', '仓库管理', '13800138999'),
                ]
                for worker in default_workers:
                    cursor.execute(sql.INSERT_DEFAULT_WORKER, worker)
                conn.commit()
                logger.info("[OK] 已初始化默认工人数据")
                logger.info("普通工人: W001~W005 (密码: 123456)")
                logger.info("系统管理员: ADMIN (密码: admin123)")
                logger.info("仓库管理员: WH001 (密码: wh123456)")
        except Error as e:
            logger.error(f"[ERROR] 初始化默认数据失败: {e}")
            conn.rollback()
    
    def hash_password(self, password):
        return hashlib.sha256(password.encode()).hexdigest()

backend = WarehouseBackend()

def handle_exceptions(f):
    def wrapper(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except Error as e:
            logger.error(f"[DB_ERROR] {f.__name__}: {e}")
            logger.error(f"[TRACEBACK] {traceback.format_exc()}")
            return jsonify({
                'status': 'error',
                'message': f'数据库操作失败: {str(e)}'
            }), 500
        except Exception as e:
            logger.error(f"[ERROR] {f.__name__}: {e}")
            logger.error(f"[TRACEBACK] {traceback.format_exc()}")
            return jsonify({
                'status': 'error',
                'message': f'服务器内部错误: {str(e)}'
            }), 500
    wrapper.__name__ = f.__name__
    return wrapper

@app.route('/api/health', methods=['GET'])
@handle_exceptions
def health_check():
    try:
        with backend.get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            cursor.fetchone()
        return jsonify({
            'status': 'success',
            'message': '服务运行正常',
            'data': {
                'service': '水电班仓库管理系统',
                'version': '2.0',
                'features': ['条形码扫描', '批量出库', '实时同步', '工人登录'],
                'server_time': datetime.now().isoformat(),
                'database_status': 'connected'
            }
        })
    except Exception as e:
        logger.error(f"[ERROR] 健康检查失败: {e}")
        return jsonify({
            'status': 'error',
            'message': '服务异常',
            'database_status': 'disconnected'
        }), 500

@app.route('/api/materials/<barcode>', methods=['GET'])
@handle_exceptions
def get_material_by_barcode(barcode):
    with backend.get_db_connection() as conn:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(sql.SELECT_MATERIAL_BY_BARCODE, (barcode,))
        material = cursor.fetchone()
        if material:
            return jsonify({
                'status': 'success',
                'data': material
            })
        else:
            return jsonify({
                'status': 'error',
                'message': '未找到该物资'
            }), 404

@app.route('/api/inventory/checkout', methods=['POST'])
@handle_exceptions
def checkout_inventory():
    data = request.get_json()
    required_fields = ['items', 'user']
    for field in required_fields:
        if field not in data:
            return jsonify({
                'status': 'error',
                'message': f'缺少必需字段: {field}'
            }), 400
    items = data['items']
    user = data['user']
    time_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    if not items:
        return jsonify({
            'status': 'error',
            'message': '出库物资列表不能为空'
        }), 400
    with backend.get_db_connection() as conn:
        cursor = conn.cursor(dictionary=True)
        for item in items:
            cursor.execute(sql.SELECT_MATERIAL_BY_BARCODE, (item['barcode'],))
            material = cursor.fetchone()
            if not material:
                return jsonify({
                    'status': 'error',
                    'message': f'物资不存在: {item["barcode"]}'
                }), 400
            if material['stock'] < item['quantity']:
                return jsonify({
                    'status': 'error',
                    'message': f'库存不足！物资：{material["name"]}，当前库存：{material["stock"]}，申请出库：{item["quantity"]}'
                }), 400
        try:
            for item in items:
                cursor.execute(sql.INSERT_RECORD, 
                    (item['barcode'], -item['quantity'], user, '出库', '处理中'))
                cursor.execute("""
                    UPDATE materials 
                    SET stock = stock - %s, last_update = NOW()
                    WHERE barcode = %s
                """, (item['quantity'], item['barcode']))
            conn.commit()
            logger.info(f"[SUCCESS] 用户 {user} 出库 {len(items)} 种物资")
            return jsonify({
                'status': 'success',
                'message': '出库成功',
                'data': {
                    'user': user,
                    'item_count': len(items),
                    'time': time_str
                }
            })
        except Exception as e:
            conn.rollback()
            logger.error(f"[ERROR] 出库操作失败: {e}")
            raise

@app.route('/api/inventory/checkin', methods=['POST'])
@handle_exceptions
def checkin_inventory():
    data = request.get_json()
    required_fields = ['items', 'user']
    for field in required_fields:
        if field not in data:
            return jsonify({
                'status': 'error',
                'message': f'缺少必需字段: {field}'
            }), 400
    items = data['items']
    user = data['user']
    time_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    if not items:
        return jsonify({
            'status': 'error',
            'message': '入库物资列表不能为空'
        }), 400
    with backend.get_db_connection() as conn:
        cursor = conn.cursor(dictionary=True)
        try:
            for item in items:
                cursor.execute(sql.INSERT_RECORD, 
                    (item['barcode'], item['quantity'], user, '入库', '处理中'))
                cursor.execute("""
                    UPDATE materials 
                    SET stock = stock + %s, last_update = NOW()
                    WHERE barcode = %s
                """, (item['quantity'], item['barcode']))
            conn.commit()
            logger.info(f"[SUCCESS] 用户 {user} 入库 {len(items)} 种物资")
            return jsonify({
                'status': 'success',
                'message': '入库成功',
                'data': {
                    'user': user,
                    'item_count': len(items),
                    'time': time_str
                }
            })
        except Exception as e:
            conn.rollback()
            logger.error(f"[ERROR] 入库操作失败: {e}")
            raise

@app.route('/api/records', methods=['GET'])
@handle_exceptions
def get_records():
    user = request.args.get('user', '').strip()
    start_date = request.args.get('start_date', '').strip()
    end_date = request.args.get('end_date', '').strip()
    limit = request.args.get('limit', 50, type=int)
    with backend.get_db_connection() as conn:
        cursor = conn.cursor(dictionary=True)
        where_conditions = []
        params = []
        if user:
            where_conditions.append("r.user = %s")
            params.append(user)
        if start_date:
            where_conditions.append("DATE(r.time) >= %s")
            params.append(start_date)
        if end_date:
            where_conditions.append("DATE(r.time) <= %s")
            params.append(end_date)
        where_conditions.append("r.quantity < 0")
        where_clause = "WHERE " + " AND ".join(where_conditions) if where_conditions else "WHERE r.quantity < 0"
        query = f"""
        SELECT r.id, r.barcode, r.quantity, r.user, r.type, r.time, r.status,
               m.name, m.specification, m.unit
        FROM records r
        LEFT JOIN materials m ON r.barcode = m.barcode
        {where_clause}
        ORDER BY r.time DESC
        LIMIT %s
        """
        params.append(limit)
        cursor.execute(query, params)
        records = cursor.fetchall()
        grouped_records = {}
        for record in records:
            time_key = record['time'].strftime('%Y-%m-%d %H:%M') if record['time'] else ''
            group_key = f"{record['user']}_{time_key}"
            if group_key not in grouped_records:
                grouped_records[group_key] = {
                    'user': record['user'],
                    'time': record['time'].strftime('%Y-%m-%d %H:%M:%S') if record['time'] else '',
                    'status': record['status'] or '处理中',
                    'materials': [],
                    'totalQuantity': 0,
                    'record_ids': []
                }
            grouped_records[group_key]['materials'].append({
                'barcode': record['barcode'],
                'name': record['name'] or '未知物资',
                'specification': record['specification'] or '',
                'unit': record['unit'] or '个',
                'quantity': abs(record['quantity'])
            })
            grouped_records[group_key]['totalQuantity'] += abs(record['quantity'])
            grouped_records[group_key]['record_ids'].append(record['id'])
        result_list = list(grouped_records.values())
        result_list.sort(key=lambda x: x['time'], reverse=True)
        total_count = len(result_list)
        for i, item in enumerate(result_list):
            item['id'] = total_count - i
            item['itemCount'] = len(item['materials'])
        return jsonify({
            'status': 'success',
            'data': result_list,
            'count': len(result_list)
        })

@app.route('/api/records/<int:record_id>/status', methods=['PUT'])
@handle_exceptions
def update_record_status(record_id):
    data = request.get_json()
    if 'status' not in data:
        return jsonify({
            'status': 'error',
            'message': '缺少状态字段'
        }), 400
    new_status = data['status']
    valid_statuses = ['处理中', '处理完成', '无法处理', '已取消']
    if new_status not in valid_statuses:
        return jsonify({
            'status': 'error',
            'message': f'无效的状态值，支持的状态: {", ".join(valid_statuses)}'
        }), 400
    with backend.get_db_connection() as conn:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, user, time FROM records WHERE id = %s", (record_id,))
        record = cursor.fetchone()
        if not record:
            return jsonify({
                'status': 'error',
                'message': '记录不存在'
            }), 404
        cursor.execute("UPDATE records SET status = %s WHERE id = %s", (new_status, record_id))
        conn.commit()
        logger.info(f"[UPDATE] 记录 {record_id} 状态更新为: {new_status}")
        return jsonify({
            'status': 'success',
            'message': '状态更新成功',
            'data': {
                'record_id': record_id,
                'new_status': new_status
            }
        })

@app.route('/api/records/batch/status', methods=['PUT'])
@handle_exceptions
def update_batch_record_status():
    data = request.get_json()
    if 'record_ids' not in data or 'status' not in data:
        return jsonify({
            'status': 'error',
            'message': '缺少记录ID列表或状态字段'
        }), 400
    record_ids = data['record_ids']
    new_status = data['status']
    valid_statuses = ['处理中', '处理完成', '无法处理', '已取消']
    if new_status not in valid_statuses:
        return jsonify({
            'status': 'error',
            'message': f'无效的状态值，支持的状态: {", ".join(valid_statuses)}'
        }), 400
    if not record_ids or not isinstance(record_ids, list):
        return jsonify({
            'status': 'error',
            'message': '记录ID列表不能为空'
        }), 400
    with backend.get_db_connection() as conn:
        cursor = conn.cursor()
        placeholders = ','.join(['%s'] * len(record_ids))
        update_query = f"UPDATE records SET status = %s WHERE id IN ({placeholders})"
        cursor.execute(update_query, [new_status] + record_ids)
        updated_count = cursor.rowcount
        conn.commit()
        logger.info(f"[BATCH_UPDATE] 批量更新 {updated_count} 条记录状态为: {new_status}")
        return jsonify({
            'status': 'success',
            'message': f'成功更新 {updated_count} 条记录状态',
            'data': {
                'updated_count': updated_count,
                'new_status': new_status
            }
        })

@app.route('/api/worker/login', methods=['POST'])
@handle_exceptions
def worker_login():
    data = request.get_json()
    if 'worker_id' not in data or 'password' not in data:
        return jsonify({
            'status': 'error',
            'message': '请输入工号和密码'
        }), 400
    worker_id = data['worker_id'].strip()
    password = data['password'].strip()
    if not worker_id or not password:
        return jsonify({
            'status': 'error',
            'message': '工号和密码不能为空'
        }), 400
    with backend.get_db_connection() as conn:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(sql.VERIFY_WORKER_LOGIN, (worker_id,))
        worker = cursor.fetchone()
        if not worker:
            return jsonify({
                'status': 'error',
                'message': '工号不存在或已停用'
            }), 401
        password_hash = backend.hash_password(password)
        if worker['password'] != password_hash:
            return jsonify({
                'status': 'error',
                'message': '密码错误'
            }), 401
        cursor.execute(sql.UPDATE_WORKER_LAST_LOGIN, (worker_id,))
        conn.commit()
        logger.info(f"[LOGIN] 工人 {worker['name']} ({worker_id}) 登录成功")
        return jsonify({
            'status': 'success',
            'message': '登录成功',
            'data': {
                'worker_id': worker['worker_id'],
                'name': worker['name'],
                'department': worker['department'],
                'position': worker['position']
            }
        })

@app.route('/api/materials/search', methods=['GET'])
@handle_exceptions
def search_materials():
    keyword = request.args.get('keyword', '').strip()
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 20, type=int)
    offset = (page - 1) * limit
    if not keyword:
        return jsonify({
            'status': 'error',
            'message': '请输入搜索关键词'
        }), 400
    with backend.get_db_connection() as conn:
        cursor = conn.cursor(dictionary=True)
        search_query = """
        SELECT barcode, name, specification, unit, stock 
        FROM materials 
        WHERE name LIKE %s OR barcode LIKE %s OR specification LIKE %s
        ORDER BY name ASC
        LIMIT %s OFFSET %s
        """
        search_pattern = f'%{keyword}%'
        cursor.execute(search_query, (search_pattern, search_pattern, search_pattern, limit, offset))
        results = cursor.fetchall()
        count_query = """
        SELECT COUNT(*) as total 
        FROM materials 
        WHERE name LIKE %s OR barcode LIKE %s OR specification LIKE %s
        """
        cursor.execute(count_query, (search_pattern, search_pattern, search_pattern))
        total = cursor.fetchone()['total']
        return jsonify({
            'status': 'success',
            'data': results,
            'pagination': {
                'page': page,
                'limit': limit,
                'total': total,
                'pages': (total + limit - 1) // limit
            }
        })

@app.route('/api/materials', methods=['GET'])
@handle_exceptions
def get_recent_materials():
    limit = request.args.get('limit', 10, type=int)
    with backend.get_db_connection() as conn:
        cursor = conn.cursor(dictionary=True)
        query = """
        SELECT barcode, name, specification, unit, stock 
        FROM materials 
        WHERE stock > 0
        ORDER BY barcode DESC
        LIMIT %s
        """
        cursor.execute(query, (limit,))
        results = cursor.fetchall()
        return jsonify({
            'status': 'success',
            'data': results
        })

@app.route('/api/materials', methods=['POST'])
@handle_exceptions
def create_material():
    data = request.get_json()
    required_fields = ['barcode', 'name', 'specification', 'unit', 'stock']
    for field in required_fields:
        if field not in data:
            return jsonify({
                'status': 'error',
                'message': f'缺少必需字段: {field}'
            }), 400
    with backend.get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT barcode FROM materials WHERE barcode = %s", (data['barcode'],))
        if cursor.fetchone():
            return jsonify({
                'status': 'error',
                'message': '条形码已存在'
            }), 400
        insert_query = """
        INSERT INTO materials (barcode, name, specification, unit, stock)
        VALUES (%s, %s, %s, %s, %s)
        """
        cursor.execute(insert_query, (
            data['barcode'], data['name'], data['specification'], 
            data['unit'], data['stock']
        ))
        conn.commit()
        logger.info(f"[CREATE] 创建新物资: {data['name']} ({data['barcode']})")
        return jsonify({
            'status': 'success',
            'message': '物资创建成功',
            'data': {
                'barcode': data['barcode'],
                'name': data['name']
            }
        })

@app.route('/api/materials/<barcode>', methods=['PUT'])
@handle_exceptions
def update_material(barcode):
    data = request.get_json()
    with backend.get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT barcode FROM materials WHERE barcode = %s", (barcode,))
        if not cursor.fetchone():
            return jsonify({
                'status': 'error',
                'message': '物资不存在'
            }), 404
        update_fields = []
        update_values = []
        allowed_fields = ['name', 'specification', 'unit', 'stock']
        for field in allowed_fields:
            if field in data:
                update_fields.append(f"{field} = %s")
                update_values.append(data[field])
        if not update_fields:
            return jsonify({
                'status': 'error',
                'message': '没有可更新的字段'
            }), 400
        update_values.append(barcode)
        update_query = f"UPDATE materials SET {', '.join(update_fields)} WHERE barcode = %s"
        cursor.execute(update_query, update_values)
        conn.commit()
        logger.info(f"[UPDATE] 更新物资: {barcode}")
        return jsonify({
            'status': 'success',
            'message': '物资更新成功'
        })

@app.route('/api/materials/<barcode>', methods=['DELETE'])
@handle_exceptions
def delete_material(barcode):
    with backend.get_db_connection() as conn:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT barcode, name FROM materials WHERE barcode = %s", (barcode,))
        material = cursor.fetchone()
        if not material:
            return jsonify({
                'status': 'error',
                'message': '物资不存在'
            }), 404
        cursor.execute("SELECT COUNT(*) as count FROM records WHERE barcode = %s", (barcode,))
        record_count = cursor.fetchone()['count']
        if record_count > 0:
            return jsonify({
                'status': 'error',
                'message': f'无法删除：该物资有 {record_count} 条相关记录'
            }), 400
        cursor.execute("DELETE FROM materials WHERE barcode = %s", (barcode,))
        conn.commit()
        logger.info(f"[DELETE] 删除物资: {material['name']} ({barcode})")
        return jsonify({
            'status': 'success',
            'message': f'物资 "{material["name"]}" 删除成功'
        })

def signal_handler(sig, frame):
    logger.info('[SHUTDOWN] 正在关闭服务器...')
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

def run_server():
    logger.info("[START] 启动水电班仓库管理系统后端服务...")
    logger.info("[INFO] API文档地址: http://localhost:5000/api/health")
    logger.info("[INFO] 小程序可以连接到此服务进行数据交互")
    logger.info("[INFO] 管理端界面将同时运行")
    logger.info("-" * 50)
    try:
        app.run(
            host='0.0.0.0',
            port=5000,
            debug=False,
            threaded=True,
            use_reloader=False
        )
    except Exception as e:
        logger.error(f"[ERROR] 服务器启动失败: {e}")
    finally:
        logger.info("[SHUTDOWN] 服务器已关闭")

if __name__ == '__main__':
    run_server()
