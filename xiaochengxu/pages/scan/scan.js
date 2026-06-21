const app = getApp()
Page({
  data: {
    scanType: 'barCode', 
    isScanning: false,
    lastScanResult: '',
    scannedMaterials: [], 
    currentMaterial: null, 
    quickQuantity: 1, 
    scanHistory: [], 
    totalItems: 0,
    isLoading: false
  },
  onLoad() {
    console.log('📷 扫码页面加载')
    this.checkPermission()
    this.loadScanHistory()
  },
  onShow() {
    this.updateStats()
    const cartStats = app.getCartStats()
    if (cartStats.itemCount === 0 && this.data.scannedMaterials.length > 0) {
      console.log('🧹 检测到出库完成，清空本次扫描结果')
      this.setData({ 
        scannedMaterials: [],
        currentMaterial: null
      })
    }
    this.refreshAllStockInfo()
  },
  onHide() {
    this.stopScan()
  },
  onUnload() {
    this.stopScan()
  },
  checkPermission() {
    wx.getSetting({
      success: (res) => {
        if (!res.authSetting['scope.camera']) {
          wx.authorize({
            scope: 'scope.camera',
            success: () => {
              console.log('📷 摄像头权限获取成功')
            },
            fail: () => {
              wx.showModal({
                title: '权限申请',
                content: '需要摄像头权限来扫描条形码，请在设置中开启',
                confirmText: '去设置',
                success: (res) => {
                  if (res.confirm) {
                    wx.openSetting()
                  }
                }
              })
            }
          })
        }
      }
    })
  },
  startScan() {
    console.log('🎯 准备开始扫描')
    wx.scanCode({
      scanType: ['barCode', 'qrCode'],
      success: (res) => {
        console.log('📷 扫码成功:', res.result)
        this.processScanResult(res.result)
      },
      fail: (err) => {
        console.error('📷 扫码失败:', err)
        if (err.errMsg.includes('cancel')) {
          console.log('用户取消扫码')
        } else {
          wx.showToast({
            title: '扫码失败，请重试',
            icon: 'none'
          })
        }
      }
    })
  },
  stopScan() {
    this.setData({ isScanning: false })
    console.log('⏹️ 停止扫描')
  },
  onScanSuccess(e) {
    const barcode = e.detail.result
    console.log('✅ 扫码成功:', barcode, '详细信息:', e.detail)
    wx.vibrateShort() 
    if (barcode === this.data.lastScanResult) {
      console.log('⚠️ 重复扫描，忽略')
      return
    }
    this.setData({ lastScanResult: barcode })
    this.processScanResult(barcode)
  },
  onScanFail(e) {
    console.error('❌ 扫码失败:', e.detail)
    wx.showToast({
      title: '扫码失败，请重试',
      icon: 'none'
    })
  },
  async processScanResult(barcode) {
    if (!barcode || !barcode.trim()) {
      return
    }
    this.setData({ isLoading: true })
    wx.showLoading({ title: '查询中...' })
    try {
      const baseUrl = app.getBaseUrl()
      console.log('🌐 当前服务器地址:', baseUrl)
      console.log('📦 查询条形码:', barcode.trim())
      const result = await app.request({
        url: `/api/materials/${barcode.trim()}`
      })
      const material = result.data
      console.log('📦 查询到物资:', material)
      this.addToScanHistory(material)
      this.setData({ 
        currentMaterial: material,
        isScanning: false 
      })
      this.showMaterialDialog(material)
    } catch (error) {
      console.error('查询物资失败:', error)
      if (error.message && (error.message.includes('连接') || error.message.includes('配置'))) {
        wx.showModal({
          title: '网络连接失败',
          content: '无法连接到服务器，请检查服务器配置。是否前往设置？',
          confirmText: '前往设置',
          cancelText: '重试',
          success: (res) => {
            if (res.confirm) {
              wx.switchTab({
                url: '/pages/settings/settings'
              })
            } else {
              setTimeout(() => {
                this.setData({ isScanning: true })
              }, 1000)
            }
          }
        })
      } else {
        app.showError(error.message || '未找到该物资')
        setTimeout(() => {
          this.setData({ isScanning: true })
        }, 1000)
      }
    } finally {
      this.setData({ isLoading: false })
      wx.hideLoading()
    }
  },
  async showMaterialDialog(material) {
    const that = this
    let latestMaterial = material
    try {
      const result = await app.request({
        url: `/api/materials/${material.barcode}`
      })
      if (result.status === 'success') {
        latestMaterial = result.data
        console.log('📦 获取最新库存:', latestMaterial.stock)
      }
    } catch (error) {
      console.error('获取最新库存失败:', error)
    }
    if (latestMaterial.stock <= 0) {
      wx.showModal({
        title: '库存不足',
        content: `${latestMaterial.name}（${latestMaterial.specification}）\n当前库存：${latestMaterial.stock}${latestMaterial.unit}\n\n无法添加到待出库列表`,
        showCancel: false,
        confirmText: '继续扫描',
        success: () => {
          setTimeout(() => {
            that.setData({ isScanning: true })
          }, 500)
        }
      })
      return
    }
    wx.showModal({
      title: '物资信息',
      content: `名称：${latestMaterial.name}\n规格：${latestMaterial.specification}\n库存：${latestMaterial.stock}${latestMaterial.unit}\n\n是否添加到待出库？`,
      confirmText: '添加',
      cancelText: '继续扫描',
      success: (res) => {
        if (res.confirm) {
          that.addMaterialToCart(latestMaterial)
        } else {
          setTimeout(() => {
            that.setData({ isScanning: true })
          }, 500)
        }
      }
    })
  },
  addMaterialToCart(material, quantity = null) {
    const finalQuantity = quantity || this.data.quickQuantity
    if (material.stock < finalQuantity) {
      app.showError(`库存不足！当前库存：${material.stock}${material.unit}`)
      return
    }
    const materialToAdd = {
      ...material,
      quantity: finalQuantity
    }
    app.addToCart(materialToAdd)
    const scannedMaterials = [...this.data.scannedMaterials]
    const existingIndex = scannedMaterials.findIndex(item => item.barcode === material.barcode)
    if (existingIndex >= 0) {
      scannedMaterials[existingIndex].quantity += finalQuantity
    } else {
      scannedMaterials.unshift(materialToAdd)
    }
    this.setData({ 
      scannedMaterials,
      currentMaterial: null
    })
    this.updateStats()
    wx.showToast({
      title: '已添加到待出库',
      icon: 'success'
    })
    setTimeout(() => {
      this.setData({ isScanning: true })
    }, 1000)
  },
  selectQuickQuantity(e) {
    const quantity = parseInt(e.currentTarget.dataset.quantity)
    this.setData({ quickQuantity: quantity })
  },
  onQuantityInput(e) {
    const quantity = parseInt(e.detail.value) || 1
    this.setData({ quickQuantity: Math.max(1, quantity) })
  },
  removeScannedMaterial(e) {
    const index = e.currentTarget.dataset.index
    const material = this.data.scannedMaterials[index]
    app.removeFromCart(material.barcode)
    const scannedMaterials = [...this.data.scannedMaterials]
    scannedMaterials.splice(index, 1)
    this.setData({ scannedMaterials })
    this.updateStats()
    wx.showToast({
      title: '已从待出库移除',
      icon: 'success'
    })
  },
  updateMaterialQuantity(e) {
    const index = e.currentTarget.dataset.index
    const newQuantity = parseInt(e.detail.value) || 1
    const material = this.data.scannedMaterials[index]
    if (newQuantity > material.stock) {
      wx.showToast({
        title: '数量超出库存',
        icon: 'none'
      })
      return
    }
    app.updateCartQuantity(material.barcode, newQuantity)
    const scannedMaterials = [...this.data.scannedMaterials]
    scannedMaterials[index].quantity = newQuantity
    this.setData({ scannedMaterials })
    this.updateStats()
  },
  addToScanHistory(material) {
    const history = wx.getStorageSync('scanHistory') || []
    const existingIndex = history.findIndex(item => item.barcode === material.barcode)
    const historyItem = {
      ...material,
      scanTime: new Date().toISOString(),
      scanCount: 1
    }
    if (existingIndex >= 0) {
      history[existingIndex].scanTime = historyItem.scanTime
      history[existingIndex].scanCount += 1
    } else {
      history.unshift(historyItem)
    }
    if (history.length > 50) {
      history.splice(50)
    }
    wx.setStorageSync('scanHistory', history)
    const sortedHistory = history.sort((a, b) => {
      if (b.scanCount !== a.scanCount) {
        return b.scanCount - a.scanCount 
      }
      return new Date(b.scanTime) - new Date(a.scanTime) 
    })
    this.setData({ scanHistory: sortedHistory.slice(0, 10) })
  },
  loadScanHistory() {
    const history = wx.getStorageSync('scanHistory') || []
    const sortedHistory = history.sort((a, b) => {
      if (b.scanCount !== a.scanCount) {
        return b.scanCount - a.scanCount 
      }
      return new Date(b.scanTime) - new Date(a.scanTime) 
    })
    this.setData({ scanHistory: sortedHistory.slice(0, 10) })
  },
  async selectFromHistory(e) {
    const index = e.currentTarget.dataset.index
    const material = this.data.scanHistory[index]
    wx.showLoading({ title: '查询最新库存...' })
    try {
      const result = await app.request({
        url: `/api/materials/${material.barcode}`
      })
      let latestMaterial = material
      if (result.status === 'success') {
        latestMaterial = {
          ...material,
          stock: result.data.stock 
        }
      }
      this.setData({ currentMaterial: latestMaterial })
      this.showMaterialDialog(latestMaterial)
    } catch (error) {
      console.error('获取最新库存失败:', error)
      this.setData({ currentMaterial: material })
      this.showMaterialDialog(material)
    } finally {
      wx.hideLoading()
    }
  },
  updateStats() {
    const cartStats = app.getCartStats()
    this.setData({ totalItems: cartStats.totalQuantity })
  },
  clearCurrentScan() {
    wx.showModal({
      title: '确认清空',
      content: '是否清空本次扫描的所有物资？',
      success: (res) => {
        if (res.confirm) {
          this.data.scannedMaterials.forEach(material => {
            app.removeFromCart(material.barcode)
          })
          this.setData({ 
            scannedMaterials: [],
            currentMaterial: null
          })
          this.updateStats()
          wx.showToast({
            title: '已清空',
            icon: 'success'
          })
        }
      }
    })
  },
  goToCart() {
    wx.switchTab({
      url: '/pages/cart/cart'
    })
  },
  async refreshAllStockInfo() {
    await this.refreshScanHistoryStock()
    await this.refreshScannedMaterialsStock()
  },
  async refreshScanHistoryStock() {
    const history = this.data.scanHistory
    if (history.length === 0) return
    try {
      const updatedHistory = []
      for (const item of history) {
        try {
          const result = await app.request({
            url: `/api/materials/${item.barcode}`
          })
          if (result.status === 'success') {
            updatedHistory.push({
              ...item,
              stock: result.data.stock 
            })
          } else {
            updatedHistory.push(item) 
          }
        } catch (error) {
          console.error('刷新历史库存失败:', item.barcode, error)
          updatedHistory.push(item) 
        }
      }
      const sortedHistory = updatedHistory.sort((a, b) => {
        if (b.scanCount !== a.scanCount) {
          return b.scanCount - a.scanCount 
        }
        return new Date(b.scanTime) - new Date(a.scanTime) 
      })
      this.setData({ scanHistory: sortedHistory })
      const fullHistory = wx.getStorageSync('scanHistory') || []
      const updatedFullHistory = fullHistory.map(historyItem => {
        const updated = updatedHistory.find(u => u.barcode === historyItem.barcode)
        return updated ? { ...historyItem, stock: updated.stock } : historyItem
      })
      wx.setStorageSync('scanHistory', updatedFullHistory)
    } catch (error) {
      console.error('批量刷新历史库存失败:', error)
    }
  },
  async refreshScannedMaterialsStock() {
    const scannedMaterials = this.data.scannedMaterials
    if (scannedMaterials.length === 0) return
    try {
      const updatedMaterials = []
      for (const item of scannedMaterials) {
        try {
          const result = await app.request({
            url: `/api/materials/${item.barcode}`
          })
          if (result.status === 'success') {
            updatedMaterials.push({
              ...item,
              stock: result.data.stock 
            })
          } else {
            updatedMaterials.push(item) 
          }
        } catch (error) {
          console.error('刷新扫描库存失败:', item.barcode, error)
          updatedMaterials.push(item) 
        }
      }
      this.setData({ scannedMaterials: updatedMaterials })
    } catch (error) {
      console.error('批量刷新扫描库存失败:', error)
    }
  }
})