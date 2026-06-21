#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from flask import Flask, render_template, request, jsonify, session, redirect, url_for, flash
import mysql.connector
from mysql.connector import Error
import hashlib
import logging
from datetime import datetime, timedelta
import json
import os

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler('admin_web.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.secret_key = 'warehouse_admin_secret_key_2025'

class AdminWebApp:
    def __init__(self):
        self.db_config = {
            'host': 'localhost',
            'port': 3306,
            'database': 'warehouse_db',
            'user': 'root',
            'password': '123456',
            'charset': 'utf8mb4',
            'use_unicode': True
        }
        logger.info("[INIT] 管理员Web应用初始化完成")
        logger.info(f"[CONFIG] 数据库配置: {self.db_config['host']}:{self.db_config['port']}/{self.db_config['database']}")
    
    def get_db_connection(self):
        return mysql.connector.connect(**self.db_config)
    
    def hash_password(self, password):
        return hashlib.sha256(password.encode()).hexdigest()
    
    def verify_admin(self, worker_id, password):
        try:
            with self.get_db_connection() as conn:
                cursor = conn.cursor(dictionary=True)
                cursor.execute("""
                    SELECT worker_id, name, password, position 
                    FROM workers 
                    WHERE worker_id = %s AND (worker_id = 'ADMIN' OR worker_id = 'WH001')
                """, (worker_id,))
                worker = cursor.fetchone()
                if not worker:
                    return None
                password_hash = self.hash_password(password)
                if worker['password'] != password_hash:
                    return None
                return {
                    'worker_id': worker['worker_id'],
                    'name': worker['name'],
                    'position': worker['position']
                }
        except Error as e:
            logger.error(f"[ERROR] 验证管理员失败: {e}")
            return None
    
    def get_dashboard_stats(self):
        try:
            with self.get_db_connection() as conn:
                cursor = conn.cursor(dictionary=True)
                stats = {}
                cursor.execute("SELECT COUNT(*) as total FROM materials")
                stats['total_materials'] = cursor.fetchone()['total']
                cursor.execute("SELECT COUNT(*) as low_stock FROM materials WHERE stock < 10")
                stats['low_stock_materials'] = cursor.fetchone()['low_stock']
                today = datetime.now().strftime('%Y-%m-%d')
                cursor.execute("""
                    SELECT COUNT(*) as today_records 
                    FROM records 
                    WHERE DATE(time) = %s AND type = '出库'
                """, (today,))
                stats['today_records'] = cursor.fetchone()['today_records']
                cursor.execute("""
                    SELECT COUNT(*) as pending_records 
                    FROM records 
                    WHERE status = '处理中'
                """, ())
                stats['pending_records'] = cursor.fetchone()['pending_records']
                cursor.execute("SELECT COUNT(*) as total_workers FROM workers")
                stats['total_workers'] = cursor.fetchone()['total_workers']
                return stats
        except Error as e:
            logger.error(f"[ERROR] 获取统计数据失败: {e}")
            return {}

admin_app = AdminWebApp()

def login_required(f):
    def decorated_function(*args, **kwargs):
        if 'admin_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function

@app.route('/')
def index():
    if 'admin_id' in session:
        return redirect(url_for('dashboard'))
    return redirect(url_for('login'))

@app.route('/network-test')
def network_test():
    return render_template('network_test.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        worker_id = request.form.get('worker_id', '').strip()
        password = request.form.get('password', '').strip()
        if not worker_id or not password:
            flash('请输入工号和密码', 'error')
            return render_template('login.html')
        admin = admin_app.verify_admin(worker_id, password)
        if admin:
            session['admin_id'] = admin['worker_id']
            session['admin_name'] = admin['name']
            session['admin_position'] = admin['position']
            logger.info(f"[LOGIN] 管理员 {admin['name']} ({worker_id}) 登录成功")
            flash(f'欢迎，{admin["name"]}！', 'success')
            return redirect(url_for('dashboard'))
        else:
            flash('工号或密码错误，或您不是管理员', 'error')
            logger.warning(f"[LOGIN] 登录失败: {worker_id}")
    return render_template('login.html')

@app.route('/logout')
def logout():
    admin_name = session.get('admin_name', '未知')
    session.clear()
    flash(f'再见，{admin_name}！', 'info')
    return redirect(url_for('login'))

@app.route('/dashboard')
@login_required
def dashboard():
    stats = admin_app.get_dashboard_stats()
    return render_template('dashboard.html', stats=stats)

@app.route('/materials')
@login_required
def materials():
    try:
        with admin_app.get_db_connection() as conn:
            cursor = conn.cursor(dictionary=True)
            search = request.args.get('search', '').strip()
            page = int(request.args.get('page', 1))
            per_page = 20
            offset = (page - 1) * per_page
            where_clause = ""
            params = []
            if search:
                where_clause = "WHERE name LIKE %s OR barcode LIKE %s OR specification LIKE %s"
                search_param = f"%{search}%"
                params = [search_param, search_param, search_param]
            query = f"""
                SELECT barcode, name, specification, unit, stock, brand
                FROM materials 
                {where_clause}
                ORDER BY name
                LIMIT %s OFFSET %s
            """
            cursor.execute(query, params + [per_page, offset])
            materials_list = cursor.fetchall()
            count_query = f"SELECT COUNT(*) as total FROM materials {where_clause}"
            cursor.execute(count_query, params)
            total = cursor.fetchone()['total']
            total_pages = (total + per_page - 1) // per_page
            return render_template('materials.html', 
                                 materials=materials_list,
                                 search=search,
                                 page=page,
                                 total_pages=total_pages,
                                 total=total)
    except Error as e:
        logger.error(f"[ERROR] 获取材料列表失败: {e}")
        flash('获取材料列表失败', 'error')
        return render_template('materials.html', materials=[], search='', page=1, total_pages=1, total=0)

@app.route('/add_materials')
@login_required
def add_materials():
    return render_template('add_materials.html')

@app.route('/workers')
@login_required
def workers():
    try:
        with admin_app.get_db_connection() as conn:
            cursor = conn.cursor(dictionary=True)
            cursor.execute("""
                SELECT worker_id, name, department, position, phone, 
                       last_login, created_at, status
                FROM workers 
                ORDER BY worker_id
            """)
            workers_list = cursor.fetchall()
            return render_template('workers.html', workers=workers_list)
    except Error as e:
        logger.error(f"[ERROR] 获取工人列表失败: {e}")
        flash('获取工人列表失败', 'error')
        return render_template('workers.html', workers=[])

@app.route('/records')
@login_required
def records():
    try:
        with admin_app.get_db_connection() as conn:
            cursor = conn.cursor(dictionary=True)
            status_filter = request.args.get('status', '')
            user_filter = request.args.get('user', '')
            material_filter = request.args.get('material', '')
            barcode_filter = request.args.get('barcode', '')
            start_date_filter = request.args.get('start_date', '')
            end_date_filter = request.args.get('end_date', '')
            page = int(request.args.get('page', 1))
            per_page = 20
            offset = (page - 1) * per_page
            where_conditions = []
            params = []
            if status_filter:
                where_conditions.append("r.status = %s")
                params.append(status_filter)
            if user_filter:
                where_conditions.append("r.user LIKE %s")
                params.append(f"%{user_filter}%")
            if material_filter:
                where_conditions.append("m.name LIKE %s")
                params.append(f"%{material_filter}%")
            if barcode_filter:
                where_conditions.append("r.barcode LIKE %s")
                params.append(f"%{barcode_filter}%")
            if start_date_filter:
                where_conditions.append("DATE(r.time) >= %s")
                params.append(start_date_filter)
            if end_date_filter:
                where_conditions.append("DATE(r.time) <= %s")
                params.append(end_date_filter)
            where_clause = ""
            if where_conditions:
                where_clause = "WHERE " + " AND ".join(where_conditions)
            query = f"""
                SELECT r.id, r.barcode, r.quantity, r.user, r.type, r.time, r.status,
                       m.name, m.specification, m.unit
                FROM records r
                LEFT JOIN materials m ON r.barcode = m.barcode
                {where_clause}
                ORDER BY r.time DESC
                LIMIT %s OFFSET %s
            """
            cursor.execute(query, params + [per_page, offset])
            records_list = cursor.fetchall()
            count_query = f"""
                SELECT COUNT(*) as total 
                FROM records r
                LEFT JOIN materials m ON r.barcode = m.barcode
                {where_clause}
            """
            cursor.execute(count_query, params)
            total = cursor.fetchone()['total']
            total_pages = (total + per_page - 1) // per_page
            status_options = ['处理中', '处理完成', '无法处理', '已取消']
            return render_template('records.html',
                                 records=records_list,
                                 status_filter=status_filter,
                                 user_filter=user_filter,
                                 material_filter=material_filter,
                                 barcode_filter=barcode_filter,
                                 start_date_filter=start_date_filter,
                                 end_date_filter=end_date_filter,
                                 page=page,
                                 total_pages=total_pages,
                                 total=total,
                                 status_options=status_options)
    except Error as e:
        logger.error(f"[ERROR] 获取记录列表失败: {e}")
        flash('获取记录列表失败', 'error')
        return render_template('records.html', records=[], page=1, total_pages=1, total=0, status_options=[])

@app.route('/api/update_record_status', methods=['POST'])
@login_required
def update_record_status():
    try:
        data = request.get_json()
        record_id = data.get('record_id')
        new_status = data.get('status')
        if not record_id or not new_status:
            return jsonify({'success': False, 'message': '缺少必要参数'})
        valid_statuses = ['处理中', '处理完成', '无法处理', '已取消']
        if new_status not in valid_statuses:
            return jsonify({'success': False, 'message': '无效的状态值'})
        with admin_app.get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE records 
                SET status = %s 
                WHERE id = %s
            """, (new_status, record_id))
            if cursor.rowcount == 0:
                return jsonify({'success': False, 'message': '记录不存在'})
            conn.commit()
            logger.info(f"[UPDATE] 管理员更新记录 {record_id} 状态为: {new_status}")
            return jsonify({'success': True, 'message': '状态更新成功'})
    except Error as e:
        logger.error(f"[ERROR] 更新记录状态失败: {e}")
        return jsonify({'success': False, 'message': '数据库错误'})
    except Exception as e:
        logger.error(f"[ERROR] 更新记录状态异常: {e}")
        return jsonify({'success': False, 'message': '系统错误'})

@app.route('/api/update_material', methods=['POST'])
@login_required
def update_material():
    try:
        data = request.get_json()
        barcode = data.get('barcode')
        field = data.get('field')
        value = data.get('value')
        if not barcode or not field:
            return jsonify({'success': False, 'message': '参数不完整'})
        allowed_fields = ['name', 'specification', 'unit', 'stock', 'brand']
        if field not in allowed_fields:
            return jsonify({'success': False, 'message': '不允许更新此字段'})
        if field == 'stock':
            try:
                value = int(value)
                if value < 0:
                    return jsonify({'success': False, 'message': '库存数量不能为负数'})
            except ValueError:
                return jsonify({'success': False, 'message': '库存数量必须为数字'})
        elif field in ['name', 'specification', 'unit', 'brand']:
            if not value or not value.strip():
                if field == 'name':
                    return jsonify({'success': False, 'message': '材料名称不能为空'})
        with admin_app.get_db_connection() as conn:
            cursor = conn.cursor()
            try:
                query = f"UPDATE materials SET {field} = %s WHERE barcode = %s"
                cursor.execute(query, (value, barcode))
                conn.commit()
                if cursor.rowcount > 0:
                    logger.info(f"[UPDATE] 管理员 {session['admin_name']} 更新材料 {barcode} 的 {field} 为 {value}")
                    return jsonify({'success': True, 'message': '更新成功'})
                else:
                    return jsonify({'success': False, 'message': '材料不存在'})
            except Exception as e:
                conn.rollback()
                raise
    except Error as e:
        logger.error(f"[ERROR] 更新材料失败: {e}")
        return jsonify({'success': False, 'message': '更新失败'})

@app.route('/api/delete_material', methods=['POST'])
@login_required
def delete_material():
    try:
        data = request.get_json()
        barcode = data.get('barcode')
        if not barcode:
            return jsonify({'success': False, 'message': '参数不完整'})
        with admin_app.get_db_connection() as conn:
            cursor = conn.cursor(dictionary=True)
            try:
                cursor.execute("SELECT name, stock FROM materials WHERE barcode = %s", (barcode,))
                material = cursor.fetchone()
                if not material:
                    return jsonify({'success': False, 'message': '材料不存在'})
                cursor.execute("SELECT COUNT(*) as count FROM records WHERE barcode = %s", (barcode,))
                record_count = cursor.fetchone()['count']
                if record_count > 0:
                    return jsonify({
                        'success': False, 
                        'message': f'无法删除：该材料有 {record_count} 条相关记录，请先处理相关记录'
                    })
                cursor.execute("DELETE FROM materials WHERE barcode = %s", (barcode,))
                conn.commit()
                if cursor.rowcount > 0:
                    logger.info(f"[DELETE] 管理员 {session['admin_name']} 删除材料: {material['name']} ({barcode})")
                    return jsonify({'success': True, 'message': '材料删除成功'})
                else:
                    return jsonify({'success': False, 'message': '删除失败'})
            except Exception as e:
                conn.rollback()
                raise
    except Error as e:
        logger.error(f"[ERROR] 删除材料失败: {e}")
        return jsonify({'success': False, 'message': '删除失败'})

@app.route('/api/add_materials_batch', methods=['POST'])
@login_required
def add_materials_batch():
    try:
        data = request.get_json()
        materials = data.get('materials', [])
        if not materials:
            return jsonify({'success': False, 'message': '材料列表不能为空'})
        results = []
        with admin_app.get_db_connection() as conn:
            cursor = conn.cursor(dictionary=True)
            for material in materials:
                name = material.get('name', '').strip()
                specification = material.get('specification', '').strip()
                unit = material.get('unit', '').strip()
                brand = material.get('brand', '').strip()
                quantity = material.get('quantity', 0)
                if not name or not specification or quantity <= 0:
                    results.append({
                        'name': name or '未知材料',
                        'success': False,
                        'message': '材料名称和规格型号不能为空，数量必须大于0'
                    })
                    continue
                try:
                    cursor.execute("""
                        SELECT barcode, stock FROM materials 
                        WHERE name = %s AND specification = %s AND unit = %s
                        LIMIT 1
                    """, (name, specification, unit))
                    existing = cursor.fetchone()
                    if existing:
                        new_stock = existing['stock'] + quantity
                        cursor.execute("""
                            UPDATE materials 
                            SET stock = %s, brand = %s
                            WHERE barcode = %s
                        """, (new_stock, brand, existing['barcode']))
                        results.append({
                            'name': name,
                            'barcode': existing['barcode'],
                            'action': 'updated',
                            'old_stock': existing['stock'],
                            'new_stock': new_stock,
                            'added_quantity': quantity,
                            'success': True,
                            'message': f'库存已更新：{existing["stock"]} + {quantity} = {new_stock}'
                        })
                        logger.info(f"[UPDATE] 管理员更新材料库存: {name} ({existing['barcode']}) {existing['stock']} -> {new_stock}")
                    else:
                        import time
                        import random
                        timestamp = str(int(time.time()))[-6:]
                        random_num = str(random.randint(100, 999))
                        new_barcode = f"WH{timestamp}{random_num}"
                        cursor.execute("SELECT COUNT(*) as count FROM materials WHERE barcode = %s", (new_barcode,))
                        while cursor.fetchone()['count'] > 0:
                            random_num = str(random.randint(100, 999))
                            new_barcode = f"WH{timestamp}{random_num}"
                            cursor.execute("SELECT COUNT(*) as count FROM materials WHERE barcode = %s", (new_barcode,))
                        cursor.execute("""
                            INSERT INTO materials (barcode, name, specification, unit, stock, brand)
                            VALUES (%s, %s, %s, %s, %s, %s)
                        """, (new_barcode, name, specification, unit, quantity, brand))
                        results.append({
                            'name': name,
                            'barcode': new_barcode,
                            'action': 'created',
                            'stock': quantity,
                            'success': True,
                            'message': f'新材料已创建，库存：{quantity}'
                        })
                        logger.info(f"[CREATE] 管理员创建新材料: {name} ({new_barcode}) 库存: {quantity}")
                except Exception as e:
                    results.append({
                        'name': name,
                        'success': False,
                        'message': f'处理失败: {str(e)}'
                    })
                    logger.error(f"[ERROR] 处理材料失败 {name}: {e}")
            conn.commit()
            success_count = sum(1 for r in results if r['success'])
            total_count = len(results)
            return jsonify({
                'success': True,
                'message': f'批量处理完成：成功 {success_count}/{total_count}',
                'results': results,
                'summary': {
                    'total': total_count,
                    'success': success_count,
                    'failed': total_count - success_count,
                    'updated': sum(1 for r in results if r.get('action') == 'updated'),
                    'created': sum(1 for r in results if r.get('action') == 'created')
                }
            })
    except Error as e:
        logger.error(f"[ERROR] 批量补充材料失败: {e}")
        return jsonify({'success': False, 'message': f'数据库错误: {str(e)}'})
    except Exception as e:
        logger.error(f"[ERROR] 批量补充材料异常: {e}")
        return jsonify({'success': False, 'message': f'系统错误: {str(e)}'})

@app.route('/api/toggle_worker_status', methods=['POST'])
@login_required
def toggle_worker_status():
    try:
        data = request.get_json()
        worker_id = data.get('worker_id')
        if not worker_id:
            return jsonify({'success': False, 'message': '参数不完整'})
        if worker_id in ['ADMIN', 'WH001']:
            return jsonify({'success': False, 'message': '不能禁用管理员账号'})
        with admin_app.get_db_connection() as conn:
            cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT status FROM workers WHERE worker_id = %s", (worker_id,))
            worker = cursor.fetchone()
            if not worker:
                return jsonify({'success': False, 'message': '工人不存在'})
            new_status = 'inactive' if worker['status'] == 'active' else 'active'
            cursor.execute("UPDATE workers SET status = %s WHERE worker_id = %s", (new_status, worker_id))
            conn.commit()
            status_text = '启用' if new_status == 'active' else '禁用'
            logger.info(f"[UPDATE] 管理员 {session['admin_name']} {status_text}工人 {worker_id}")
            return jsonify({'success': True, 'message': f'工人已{status_text}', 'new_status': new_status})
    except Error as e:
        logger.error(f"[ERROR] 切换工人状态失败: {e}")
        return jsonify({'success': False, 'message': '操作失败'})

@app.route('/api/register_worker', methods=['POST'])
@login_required
def register_worker():
    try:
        data = request.get_json()
        worker_id = data.get('worker_id', '').strip()
        name = data.get('name', '').strip()
        department = data.get('department', '').strip()
        position = data.get('position', '').strip()
        phone = data.get('phone', '').strip()
        password = data.get('password', '').strip()
        if not worker_id or not name or not password:
            return jsonify({'success': False, 'message': '工号、姓名和密码不能为空'})
        if len(worker_id) < 3:
            return jsonify({'success': False, 'message': '工号长度至少3位'})
        if len(password) < 6:
            return jsonify({'success': False, 'message': '密码长度至少6位'})
        if not worker_id.replace('_', '').replace('-', '').isalnum():
            return jsonify({'success': False, 'message': '工号只能包含字母、数字、下划线和连字符'})
        if phone and (len(phone) != 11 or not phone.isdigit()):
            return jsonify({'success': False, 'message': '请输入正确的11位手机号'})
        with admin_app.get_db_connection() as conn:
            cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT worker_id FROM workers WHERE worker_id = %s", (worker_id,))
            if cursor.fetchone():
                return jsonify({'success': False, 'message': '工号已存在，请使用其他工号'})
            if phone:
                cursor.execute("SELECT worker_id FROM workers WHERE phone = %s", (phone,))
                if cursor.fetchone():
                    return jsonify({'success': False, 'message': '手机号已被其他员工使用'})
            password_hash = admin_app.hash_password(password)
            cursor.execute("""
                INSERT INTO workers (worker_id, name, department, position, phone, password, status, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, 'active', NOW())
            """, (worker_id, name, department, position, phone, password_hash))
            conn.commit()
            logger.info(f"[REGISTER] 管理员 {session['admin_name']} 注册新员工: {name} ({worker_id})")
            return jsonify({
                'success': True, 
                'message': f'员工 {name} ({worker_id}) 注册成功',
                'worker': {
                    'worker_id': worker_id,
                    'name': name,
                    'department': department,
                    'position': position,
                    'phone': phone
                }
            })
    except Error as e:
        logger.error(f"[ERROR] 注册员工失败: {e}")
        return jsonify({'success': False, 'message': '注册失败，请稍后重试'})

if __name__ == '__main__':
    template_dir = 'templates'
    if not os.path.exists(template_dir):
        os.makedirs(template_dir)
        logger.info(f"[INIT] 创建模板目录: {template_dir}")
    static_dir = 'static'
    if not os.path.exists(static_dir):
        os.makedirs(static_dir)
        logger.info(f"[INIT] 创建静态文件目录: {static_dir}")
    logger.info("[START] 启动管理员Web应用...")
    logger.info("[INFO] 访问地址: http://localhost:8081")
    logger.info("[INFO] 管理员账号: ADMIN (密码: admin123) 或 WH001 (密码: wh123456)")
    logger.info("-" * 60)
    app.run(host='0.0.0.0', port=8081, debug=True)
