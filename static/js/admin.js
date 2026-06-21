/* 水电班仓库管理系统 - 管理员端JavaScript */
/* 兼容性优化版本 */

// 兼容性检查和polyfill
(function() {
    'use strict';
    
    // 检查浏览器基本功能
    var isModernBrowser = (
        'querySelector' in document &&
        'addEventListener' in window &&
        'localStorage' in window
    );
    
    if (!isModernBrowser) {
        console.warn('检测到旧版浏览器，某些功能可能不可用');
    }
    
    // 简单的polyfill
    if (!Array.prototype.forEach) {
        Array.prototype.forEach = function(callback, thisArg) {
            for (var i = 0; i < this.length; i++) {
                callback.call(thisArg, this[i], i, this);
            }
        };
    }
    
    if (!String.prototype.trim) {
        String.prototype.trim = function() {
            return this.replace(/^\s+|\s+$/g, '');
        };
    }
})();

// 全局工具函数
var AdminUtils = {
    // 显示消息
    showMessage: function(message, type) {
        type = type || 'info';
        var alertClass = 'alert-' + (type === 'error' ? 'danger' : type);
        var alertHtml = '<div class="alert ' + alertClass + ' alert-dismissible fade show" role="alert">' +
                       message +
                       '<button type="button" class="btn-close" onclick="this.parentElement.remove()"></button>' +
                       '</div>';
        
        var container = document.querySelector('.main-content') || document.body;
        var firstChild = container.firstChild;
        var alertDiv = document.createElement('div');
        alertDiv.innerHTML = alertHtml;
        container.insertBefore(alertDiv.firstChild, firstChild);
        
        // 自动隐藏
        setTimeout(function() {
            var alert = container.querySelector('.alert');
            if (alert) {
                alert.remove();
            }
        }, 5000);
    },
    
    // 显示加载状态
    showLoading: function(element) {
        if (element) {
            element.disabled = true;
            var originalText = element.textContent || element.innerText;
            element.setAttribute('data-original-text', originalText);
            element.innerHTML = '<span class="loading"></span> 处理中...';
        }
    },
    
    // 隐藏加载状态
    hideLoading: function(element) {
        if (element) {
            element.disabled = false;
            var originalText = element.getAttribute('data-original-text');
            if (originalText) {
                element.textContent = originalText;
                element.removeAttribute('data-original-text');
            }
        }
    },
    
    // AJAX请求封装
    ajax: function(options) {
        var xhr = new XMLHttpRequest();
        var method = options.method || 'GET';
        var url = options.url;
        var data = options.data;
        var success = options.success || function() {};
        var error = options.error || function() {};
        
        xhr.open(method, url, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var response = JSON.parse(xhr.responseText);
                        success(response);
                    } catch (e) {
                        success(xhr.responseText);
                    }
                } else {
                    error(xhr.status, xhr.statusText);
                }
            }
        };
        
        if (data && method !== 'GET') {
            xhr.send(JSON.stringify(data));
        } else {
            xhr.send();
        }
    },
    
    // 格式化时间
    formatTime: function(dateString) {
        try {
            var date = new Date(dateString);
            if (isNaN(date.getTime())) {
                return dateString;
            }
            
            var year = date.getFullYear();
            var month = ('0' + (date.getMonth() + 1)).slice(-2);
            var day = ('0' + date.getDate()).slice(-2);
            var hours = ('0' + date.getHours()).slice(-2);
            var minutes = ('0' + date.getMinutes()).slice(-2);
            var seconds = ('0' + date.getSeconds()).slice(-2);
            
            return year + '-' + month + '-' + day + ' ' + hours + ':' + minutes + ':' + seconds;
        } catch (e) {
            return dateString;
        }
    },
    
    // 更新当前时间显示
    updateCurrentTime: function() {
        var timeElements = document.querySelectorAll('.current-time');
        var now = new Date();
        var timeString = this.formatTime(now);
        
        for (var i = 0; i < timeElements.length; i++) {
            timeElements[i].textContent = timeString;
        }
    }
};

// 页面初始化
document.addEventListener('DOMContentLoaded', function() {
    // 更新时间显示
    AdminUtils.updateCurrentTime();
    setInterval(function() {
        AdminUtils.updateCurrentTime();
    }, 1000);
    
    // 自动隐藏alert消息
    setTimeout(function() {
        var alerts = document.querySelectorAll('.alert');
        for (var i = 0; i < alerts.length; i++) {
            alerts[i].remove();
        }
    }, 5000);
    
    // 表单提交处理
    var forms = document.querySelectorAll('form');
    for (var i = 0; i < forms.length; i++) {
        forms[i].addEventListener('submit', function(e) {
            var submitBtn = this.querySelector('button[type="submit"]');
            if (submitBtn) {
                AdminUtils.showLoading(submitBtn);
            }
        });
    }
    
    // 回车键提交表单（仅登录页面）
    if (window.location.pathname.indexOf('login') !== -1) {
        document.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' || e.keyCode === 13) {
                var form = document.querySelector('form');
                if (form) {
                    form.submit();
                }
            }
        });
    }
});

// 材料管理相关功能
var MaterialManager = {
    // 更新材料信息
    updateMaterial: function(barcode, field, value, element) {
        AdminUtils.showLoading(element);
        
        AdminUtils.ajax({
            method: 'POST',
            url: '/api/update_material',
            data: {
                barcode: barcode,
                field: field,
                value: value
            },
            success: function(response) {
                AdminUtils.hideLoading(element);
                if (response.success) {
                    AdminUtils.showMessage(response.message, 'success');
                } else {
                    AdminUtils.showMessage(response.message, 'error');
                }
            },
            error: function(status, statusText) {
                AdminUtils.hideLoading(element);
                AdminUtils.showMessage('更新失败: ' + statusText, 'error');
            }
        });
    },
    
    // 删除材料
    deleteMaterial: function(barcode, name, callback) {
        if (!confirm('确定要删除材料 "' + name + '" (' + barcode + ') 吗？\n\n注意：删除后无法恢复！')) {
            return;
        }
        
        AdminUtils.ajax({
            method: 'POST',
            url: '/api/delete_material',
            data: {
                barcode: barcode
            },
            success: function(response) {
                if (response.success) {
                    AdminUtils.showMessage(response.message, 'success');
                    if (callback) callback(true);
                } else {
                    AdminUtils.showMessage(response.message, 'error');
                    if (callback) callback(false);
                }
            },
            error: function(status, statusText) {
                AdminUtils.showMessage('删除失败: ' + statusText, 'error');
                if (callback) callback(false);
            }
        });
    },
    
    // 批量添加材料
    addMaterialsBatch: function(materials, callback) {
        AdminUtils.ajax({
            method: 'POST',
            url: '/api/add_materials_batch',
            data: {
                materials: materials
            },
            success: function(response) {
                if (callback) callback(response);
            },
            error: function(status, statusText) {
                if (callback) callback({
                    success: false,
                    message: '请求失败: ' + statusText
                });
            }
        });
    }
};

// 记录管理相关功能
var RecordManager = {
    // 更新记录状态
    updateStatus: function(recordId, status, element) {
        AdminUtils.showLoading(element);
        
        AdminUtils.ajax({
            method: 'POST',
            url: '/api/update_record_status',
            data: {
                record_id: recordId,
                status: status
            },
            success: function(response) {
                AdminUtils.hideLoading(element);
                if (response.success) {
                    AdminUtils.showMessage(response.message, 'success');
                    // 更新页面显示
                    setTimeout(function() {
                        window.location.reload();
                    }, 1000);
                } else {
                    AdminUtils.showMessage(response.message, 'error');
                }
            },
            error: function(status, statusText) {
                AdminUtils.hideLoading(element);
                AdminUtils.showMessage('更新失败: ' + statusText, 'error');
            }
        });
    }
};

// 工人管理相关功能
var WorkerManager = {
    // 注册新员工
    registerWorker: function(workerData, callback) {
        AdminUtils.ajax({
            method: 'POST',
            url: '/api/register_worker',
            data: workerData,
            success: function(response) {
                if (response.success) {
                    AdminUtils.showMessage(response.message, 'success');
                    if (callback) callback(true, response);
                } else {
                    AdminUtils.showMessage(response.message, 'error');
                    if (callback) callback(false, response);
                }
            },
            error: function(status, statusText) {
                AdminUtils.showMessage('注册失败: ' + statusText, 'error');
                if (callback) callback(false, null);
            }
        });
    },
    
    // 切换工人状态
    toggleStatus: function(workerId, element) {
        AdminUtils.showLoading(element);
        
        AdminUtils.ajax({
            method: 'POST',
            url: '/api/toggle_worker_status',
            data: {
                worker_id: workerId
            },
            success: function(response) {
                AdminUtils.hideLoading(element);
                if (response.success) {
                    AdminUtils.showMessage(response.message, 'success');
                    // 更新按钮文本和样式
                    if (response.new_status === 'active') {
                        element.textContent = '禁用';
                        element.className = 'btn btn-warning btn-sm';
                    } else {
                        element.textContent = '启用';
                        element.className = 'btn btn-success btn-sm';
                    }
                } else {
                    AdminUtils.showMessage(response.message, 'error');
                }
            },
            error: function(status, statusText) {
                AdminUtils.hideLoading(element);
                AdminUtils.showMessage('操作失败: ' + statusText, 'error');
            }
        });
    }
};

// 补充材料页面功能
var AddMaterialsPage = {
    materials: [],
    
    // 添加材料到列表
    addMaterial: function() {
        var name = document.getElementById('materialName');
        var spec = document.getElementById('materialSpec');
        var unit = document.getElementById('materialUnit');
        var brand = document.getElementById('materialBrand');
        var quantity = document.getElementById('materialQuantity');
        
        if (!name.value.trim() || !spec.value.trim() || !quantity.value || quantity.value <= 0) {
            AdminUtils.showMessage('请填写完整的材料信息，数量必须大于0', 'error');
            return;
        }
        
        var material = {
            name: name.value.trim(),
            specification: spec.value.trim(),
            unit: unit.value.trim() || '个',
            brand: brand.value.trim() || '',
            quantity: parseInt(quantity.value)
        };
        
        this.materials.push(material);
        this.updateMaterialsList();
        this.clearForm();
    },
    
    // 更新材料列表显示
    updateMaterialsList: function() {
        var tbody = document.getElementById('materialsTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        for (var i = 0; i < this.materials.length; i++) {
            var material = this.materials[i];
            var row = document.createElement('tr');
            row.innerHTML = 
                '<td>' + material.name + '</td>' +
                '<td>' + material.specification + '</td>' +
                '<td>' + material.unit + '</td>' +
                '<td>' + material.brand + '</td>' +
                '<td>' + material.quantity + '</td>' +
                '<td><button type="button" class="btn btn-danger btn-sm" onclick="AddMaterialsPage.removeMaterial(' + i + ')">删除</button></td>';
            tbody.appendChild(row);
        }
        
        // 更新提交按钮状态
        var submitBtn = document.getElementById('submitMaterials');
        if (submitBtn) {
            submitBtn.disabled = this.materials.length === 0;
        }
    },
    
    // 删除材料
    removeMaterial: function(index) {
        this.materials.splice(index, 1);
        this.updateMaterialsList();
    },
    
    // 清空表单
    clearForm: function() {
        var fields = ['materialName', 'materialSpec', 'materialUnit', 'materialBrand', 'materialQuantity'];
        for (var i = 0; i < fields.length; i++) {
            var field = document.getElementById(fields[i]);
            if (field) {
                field.value = '';
            }
        }
    },
    
    // 提交材料
    submitMaterials: function() {
        if (this.materials.length === 0) {
            AdminUtils.showMessage('请先添加材料', 'error');
            return;
        }
        
        var submitBtn = document.getElementById('submitMaterials');
        AdminUtils.showLoading(submitBtn);
        
        MaterialManager.addMaterialsBatch(this.materials, function(response) {
            AdminUtils.hideLoading(submitBtn);
            
            if (response.success) {
                AdminUtils.showMessage(response.message, 'success');
                
                // 显示详细结果
                if (response.results && response.results.length > 0) {
                    var resultHtml = '<div class="mt-3"><h6>处理结果:</h6><ul>';
                    for (var i = 0; i < response.results.length; i++) {
                        var result = response.results[i];
                        var statusClass = result.success ? 'text-success' : 'text-danger';
                        resultHtml += '<li class="' + statusClass + '">' + result.name + ': ' + result.message + '</li>';
                    }
                    resultHtml += '</ul></div>';
                    
                    var container = document.querySelector('.card-body');
                    if (container) {
                        var resultDiv = document.createElement('div');
                        resultDiv.innerHTML = resultHtml;
                        container.appendChild(resultDiv);
                    }
                }
                
                // 清空列表
                AddMaterialsPage.materials = [];
                AddMaterialsPage.updateMaterialsList();
            } else {
                AdminUtils.showMessage(response.message, 'error');
            }
        });
    }
};

// 导出到全局作用域
window.AdminUtils = AdminUtils;
window.MaterialManager = MaterialManager;
window.RecordManager = RecordManager;
window.WorkerManager = WorkerManager;
window.AddMaterialsPage = AddMaterialsPage;
