App({
  onLaunch() {
    console.log('🚀 水电班仓库管理系统启动')
    this.initializeApp()
  },
  initializeApp() {
    const serverConfig = wx.getStorageSync('serverConfig')
    if (!serverConfig) {
      console.log('⚙️ 首次启动，需要配置服务器地址')
    } else {
      console.log('✅ 服务器配置已存在:', serverConfig.baseUrl)
    }
    this.globalData = {
      serverConfig: serverConfig || {
        baseUrl: 'http://127.0.0.1:5000',
        configured: true
      },
      userInfo: {
        name: wx.getStorageSync('userName') || '',
        department: '水电班'
      },
      workerInfo: (() => {
        const saved = wx.getStorageSync('workerInfo') || {}
        return {
          worker_id: saved.worker_id || '',
          name: saved.name || '',
          department: saved.department || '',
          position: saved.position || ''
        }
      })(),
      cart: [],
      isConnected: false,
      version: '2.0.0'
    }
  },
  getBaseUrl() {
    return this.globalData.serverConfig.baseUrl || ''
  },
  setServerConfig(config) {
    this.globalData.serverConfig = config
    wx.setStorageSync('serverConfig', config)
    console.log('💾 服务器配置已保存:', config)
  },
  setUserInfo(userInfo) {
    this.globalData.userInfo = { ...this.globalData.userInfo, ...userInfo }
    if (userInfo.name) {
      wx.setStorageSync('userName', userInfo.name)
    }
  },
  setWorkerInfo(workerInfo) {
    this.globalData.workerInfo = { ...this.globalData.workerInfo, ...workerInfo }
    wx.setStorageSync('workerInfo', this.globalData.workerInfo)
    console.log('💾 工人信息已保存:', workerInfo)
  },
  getCurrentUserName() {
    return this.globalData.workerInfo.name || this.globalData.userInfo.name || ''
  },
  getWorkerInfo() {
    return this.globalData.workerInfo || null
  },
  clearWorkerInfo() {
    this.globalData.workerInfo = {}
    try {
      wx.removeStorageSync('workerInfo')
      console.log('工人信息已清除')
    } catch (error) {
      console.error('清除工人信息失败:', error)
    }
  },
  addToCart(material) {
    const cart = this.globalData.cart
    const existingIndex = cart.findIndex(item => item.barcode === material.barcode)
    if (existingIndex >= 0) {
      cart[existingIndex].quantity += (material.quantity || 1)
    } else {
      cart.push({
        ...material,
        quantity: material.quantity || 1,
        addTime: new Date().toISOString()
      })
    }
    console.log('🛒 添加到购物车:', material.name, '数量:', material.quantity || 1)
    return cart.length
  },
  removeFromCart(barcode) {
    const cart = this.globalData.cart
    const index = cart.findIndex(item => item.barcode === barcode)
    if (index >= 0) {
      const removed = cart.splice(index, 1)[0]
      console.log('🗑️ 从购物车移除:', removed.name)
      return true
    }
    return false
  },
  updateCartQuantity(barcode, quantity) {
    const cart = this.globalData.cart
    const item = cart.find(item => item.barcode === barcode)
    if (item) {
      if (quantity <= 0) {
        this.removeFromCart(barcode)
      } else {
        item.quantity = quantity
        console.log('📝 更新购物车数量:', item.name, '数量:', quantity)
      }
      return true
    }
    return false
  },
  clearCart() {
    this.globalData.cart = []
    console.log('🧹 购物车已清空')
  },
  getCartStats() {
    const cart = this.globalData.cart
    return {
      itemCount: cart.length,
      totalQuantity: cart.reduce((sum, item) => sum + item.quantity, 0)
    }
  },
  request(options) {
    const baseUrl = this.getBaseUrl()
    if (!baseUrl) {
      return Promise.reject(new Error('服务器地址未配置'))
    }
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${baseUrl}${options.url}`,
        method: options.method || 'GET',
        data: options.data || {},
        header: {
          'Content-Type': 'application/json',
          ...options.header
        },
        success: (res) => {
          if (res.statusCode === 200) {
            if (res.data.status === 'success') {
              resolve(res.data)
            } else {
              reject(new Error(res.data.message || '请求失败'))
            }
          } else {
            if (res.data && res.data.message) {
              reject(new Error(res.data.message))
            } else {
              reject(new Error(`服务器错误: ${res.statusCode}`))
            }
          }
        },
        fail: (err) => {
          console.error('❌ 请求失败:', err)
          reject(new Error('网络连接失败'))
        }
      })
    })
  },
  showError(message, title = '错误') {
    wx.showModal({
      title: title,
      content: message,
      showCancel: false,
      confirmText: '确定'
    })
  },
  showSuccess(message) {
    wx.showToast({
      title: message,
      icon: 'success',
      duration: 2000
    })
  },
  showLoading(message = '加载中...') {
    wx.showLoading({
      title: message,
      mask: true
    })
  },
  hideLoading() {
    wx.hideLoading()
  },
  async checkConnection() {
    try {
      await this.request({ url: '/api/health' })
      this.globalData.isConnected = true
      return true
    } catch (error) {
      this.globalData.isConnected = false
      console.error('🔌 服务器连接失败:', error.message)
      return false
    }
  },
  globalData: {}
})
