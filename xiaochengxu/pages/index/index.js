const app = getApp()
Page({
  data: {
    userInfo: {},
    cartStats: {
      itemCount: 0,
      totalQuantity: 0
    },
    recentMaterials: [],
    systemStats: {
      todayCheckout: 0,
      totalItems: 0
    },
    isLoading: false
  },
  onLoad() {
    console.log('📱 首页加载')
    this.initializePage()
  },
  onShow() {
    this.updatePageData()
    this.loadRecentMaterials()
  },
  onPullDownRefresh() {
    this.refreshData()
  },
  async initializePage() {
    this.setData({ isLoading: true })
    this.setData({
      userInfo: app.globalData.workerInfo.name ? {
        name: app.globalData.workerInfo.name,
        department: app.globalData.workerInfo.department
      } : app.globalData.userInfo
    })
    await this.loadDashboardData()
    this.setData({ isLoading: false })
    wx.stopPullDownRefresh()
  },
  updatePageData() {
    const cartStats = app.getCartStats()
    this.setData({ cartStats })
    this.setData({
      userInfo: app.globalData.workerInfo.name ? {
        name: app.globalData.workerInfo.name,
        department: app.globalData.workerInfo.department
      } : app.globalData.userInfo
    })
  },
  async loadDashboardData() {
    try {
      const promises = [
        this.loadRecentMaterials(),
        this.loadSystemStats()
      ]
      await Promise.allSettled(promises)
    } catch (error) {
      console.error('加载仪表板数据失败:', error)
    }
  },
  async loadRecentMaterials() {
    try {
      const result = await app.request({
        url: '/api/materials',
        data: { limit: 5 }
      })
      this.setData({
        recentMaterials: result.data.slice(0, 5)
      })
    } catch (error) {
      console.error('加载最近物资失败:', error)
    }
  },
  async loadSystemStats() {
    try {
      const currentUser = app.getCurrentUserName()
      if (!currentUser) {
        console.log('用户未登录，跳过统计加载')
        return
      }
      const today = new Date().toISOString().split('T')[0] 
      const queryParams = [
        `user=${encodeURIComponent(currentUser)}`,
        `start_date=${encodeURIComponent(today)}`,
        `end_date=${encodeURIComponent(today)}`,
        `limit=100`
      ].join('&')
      const result = await app.request({
        url: `/api/records?${queryParams}`
      })
      if (result.status === 'success') {
        let todayCheckout = 0
        result.data.forEach(record => {
          todayCheckout += record.totalQuantity || 0
        })
        this.setData({
          systemStats: {
            todayCheckout: todayCheckout,
            totalItems: result.count || 0
          }
        })
        console.log(`📊 ${currentUser} 今日出库统计: ${todayCheckout}件`)
      } else {
        console.error('获取统计数据失败:', result.message)
      }
    } catch (error) {
      console.error('加载系统统计失败:', error)
      this.setData({
        systemStats: {
          todayCheckout: 0,
          totalItems: 0
        }
      })
    }
  },
  async refreshData() {
    await this.initializePage()
  },
  quickScan() {
    wx.switchTab({
      url: '/pages/scan/scan'
    })
  },
  viewCart() {
    wx.switchTab({
      url: '/pages/cart/cart'
    })
  },
  viewMaterials() {
    wx.navigateTo({
      url: '/pages/materials/materials'
    })
  },
  viewHistory() {
    wx.switchTab({
      url: '/pages/history/history'
    })
  },
  navigateToSettings() {
    wx.switchTab({
      url: '/pages/settings/settings'
    })
  },
  selectRecentMaterial(e) {
    const index = e.currentTarget.dataset.index
    const material = this.data.recentMaterials[index]
    if (material) {
      if (material.stock <= 0) {
        wx.showModal({
          title: '库存不足',
          content: `${material.name}（${material.specification}）\n当前库存：${material.stock}${material.unit}\n\n无法添加到待出库列表`,
          showCancel: false,
          confirmText: '确定'
        })
        return
      }
      app.addToCart(material)
      this.updatePageData()
      wx.showToast({
        title: '已添加到待出库',
        icon: 'success'
      })
    }
  },
  viewMaterials() {
    wx.navigateTo({
      url: '/pages/materials/materials'
    })
  },
})