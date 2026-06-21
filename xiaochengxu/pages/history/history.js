const app = getApp()
Page({
  data: {
    historyList: [],
    historyStats: null,
    isLoading: false,
    hasMore: true,
    currentPage: 0,
    pageSize: 20,
    startDate: '',
    endDate: '',
    userRole: 'worker', 
    currentUser: '',
    canViewAllRecords: false,
    canManageStatus: false,  
    showDetailModal: false,
    selectedRecord: null,
    showStatusModal: false,
    statusOptions: [
      { value: '处理中', label: '处理中', color: '#ff9500' },
      { value: '处理完成', label: '处理完成', color: '#34c759' },
      { value: '无法处理', label: '无法处理', color: '#ff3b30' },
      { value: '已取消', label: '已取消', color: '#8e8e93' }
    ]
  },
  onLoad(options) {
    console.log('📊 历史记录页面加载')
    this.initializePage()
  },
  onShow() {
    this.initializePage()
    this.loadHistoryData()
  },
  onPullDownRefresh() {
    this.refreshData()
  },
  onReachBottom() {
    if (this.data.hasMore && !this.data.isLoading) {
      this.loadMore()
    }
  },
  initializePage() {
    const workerInfo = app.globalData.workerInfo || {}
    const currentUser = workerInfo.name || app.getCurrentUserName()
    let userRole = 'worker'  
    let canViewAllRecords = false  
    let canManageStatus = false  
    if (workerInfo.worker_id === 'ADMIN') {
      userRole = 'admin'
      canViewAllRecords = true
      canManageStatus = true
    } else if (workerInfo.worker_id === 'WH001') {
      userRole = 'manager'
      canViewAllRecords = true
      canManageStatus = true
    } else {
      userRole = 'worker'
      canViewAllRecords = false
      canManageStatus = false
    }
    this.setData({
      currentUser,
      userRole,
      canViewAllRecords,
      canManageStatus  
    })
    console.log('🔍 [DEBUG] 历史记录页面权限信息:')
    console.log('  - workerInfo:', JSON.stringify(workerInfo))
    console.log('  - worker_id:', workerInfo.worker_id)
    console.log('  - currentUser:', currentUser)
    console.log('  - userRole:', userRole)
    console.log('  - canViewAllRecords:', canViewAllRecords)
    console.log('  - canManageStatus:', canManageStatus)
  },
  determineUserRole(workerInfo) {
    const position = workerInfo.position || ''
    if (position.includes('管理员') || position.includes('系统管理员')) {
      return 'admin'
    } else if (position.includes('仓库管理') || position.includes('班长')) {
      return 'manager'
    } else {
      return 'worker'
    }
  },
  async loadHistoryData(loadMore = false) {
    if (this.data.isLoading) return
    this.setData({ isLoading: true })
    if (!loadMore) {
      wx.showLoading({ title: '加载中...' })
    }
    try {
      const params = {
        limit: this.data.pageSize,
        offset: loadMore ? this.data.currentPage * this.data.pageSize : 0
      }
      if (!this.data.canViewAllRecords) {
        params.user = this.data.currentUser
      }
      if (this.data.startDate) {
        params.start_date = this.data.startDate
      }
      if (this.data.endDate) {
        params.end_date = this.data.endDate
      }
      const queryString = Object.keys(params)
        .map(key => `${key}=${encodeURIComponent(params[key])}`)
        .join('&')
      const result = await app.request({
        url: `/api/records?${queryString}`
      })
      if (result.status === 'success') {
        const newData = result.data || []
        let historyList
        if (loadMore) {
          historyList = [...this.data.historyList, ...newData]
        } else {
          historyList = newData
        }
        const historyStats = this.calculateStats(historyList)
        this.setData({
          historyList,
          historyStats,
          hasMore: newData.length === this.data.pageSize,
          currentPage: loadMore ? this.data.currentPage + 1 : 1
        })
        console.log('📊 加载历史记录:', historyList.length, '条')
      } else {
        app.showError(result.message || '加载失败')
      }
    } catch (error) {
      console.error('加载历史记录失败:', error)
      app.showError('网络错误，请重试')
    } finally {
      this.setData({ isLoading: false })
      wx.hideLoading()
      wx.stopPullDownRefresh()
    }
  },
  calculateStats(historyList) {
    let totalRecords = historyList.length
    let totalItems = 0
    let totalQuantity = 0
    historyList.forEach(record => {
      totalItems += record.itemCount || 0
      totalQuantity += record.totalQuantity || 0
    })
    return {
      totalRecords,
      totalItems,
      totalQuantity
    }
  },
  refreshData() {
    console.log('🔄 [DEBUG] refreshData 被调用')
    this.setData({
      currentPage: 0,
      hasMore: true,
      historyList: []  
    })
    console.log('🔄 [DEBUG] 重置分页参数，开始加载最新数据')
    this.loadHistoryData()
  },
  loadMore() {
    this.loadHistoryData(true)
  },
  onStartDateChange(e) {
    this.setData({ startDate: e.detail.value })
  },
  onEndDateChange(e) {
    this.setData({ endDate: e.detail.value })
  },
  clearDateFilter() {
    this.setData({
      startDate: '',
      endDate: ''
    })
    this.refreshData()
  },
  applyFilters() {
    this.refreshData()
  },
  viewRecordDetail(e) {
    console.log('👁️ [DEBUG] 查看详情按钮被点击')
    const record = e.currentTarget.dataset.record
    console.log('📋 [DEBUG] 选中的记录:', record)
    this.setData({
      showStatusModal: false,
      selectedRecord: record,
      showDetailModal: true
    })
    console.log('✅ [DEBUG] 详情对话框应该已显示')
  },
  closeDetailModal() {
    this.setData({
      showDetailModal: false,
      selectedRecord: null
    })
  },
  exportRecord(e) {
    const record = e.currentTarget.dataset.record
    let content = `出库记录 #${record.id}\n`
    content += `时间: ${record.time}\n`
    content += `领用人: ${record.user}\n`
    content += `状态: ${record.status === 'success' ? '成功' : '处理中'}\n\n`
    content += `物资清单:\n`
    record.materials.forEach((material, index) => {
      content += `${index + 1}. ${material.name}\n`
      content += `   规格: ${material.specification}\n`
      content += `   数量: ${material.quantity}${material.unit}\n`
      content += `   条码: ${material.barcode}\n\n`
    })
    wx.setClipboardData({
      data: content,
      success: () => {
        wx.showToast({
          title: '已复制到剪贴板',
          icon: 'success'
        })
      }
    })
  },
  showStatusManager(e) {
    console.log('🔧 [DEBUG] 状态管理按钮被点击')
    console.log('  - canManageStatus:', this.data.canManageStatus)
    console.log('  - userRole:', this.data.userRole)
    if (!this.data.canManageStatus) {
      console.log('❌ [ERROR] 无权限操作状态管理')
      wx.showToast({
        title: '无权限操作',
        icon: 'none'
      })
      return
    }
    const record = e.currentTarget.dataset.record
    console.log('📋 [DEBUG] 选中的记录:', record)
    this.setData({
      showDetailModal: false,
      selectedRecord: record,
      showStatusModal: true
    })
    console.log('✅ [DEBUG] 状态管理对话框应该已显示')
  },
  closeStatusModal() {
    this.setData({
      showStatusModal: false,
      selectedRecord: null
    })
  },
  async updateRecordStatus(e) {
    console.log('🔄 [DEBUG] 尝试更新记录状态')
    console.log('  - canManageStatus:', this.data.canManageStatus)
    console.log('  - userRole:', this.data.userRole)
    if (!this.data.canManageStatus) {
      console.log('❌ [ERROR] 无权限更新状态')
      wx.showToast({
        title: '无权限操作',
        icon: 'none'
      })
      return
    }
    const newStatus = e.currentTarget.dataset.status
    const record = this.data.selectedRecord
    console.log('📋 [DEBUG] 更新状态:', newStatus)
    console.log('📋 [DEBUG] 记录信息:', record)
    if (!record || !record.record_ids) {
      wx.showToast({
        title: '记录信息错误',
        icon: 'none'
      })
      return
    }
    wx.showLoading({ title: '更新中...' })
    try {
      await app.request({
        url: '/api/records/batch/status',
        method: 'PUT',
        data: {
          record_ids: record.record_ids,
          status: newStatus
        }
      })
      wx.showToast({
        title: '状态更新成功',
        icon: 'success'
      })
      console.log('✅ [DEBUG] 状态更新成功，立即刷新数据')
      this.closeStatusModal()
      console.log('🔄 [DEBUG] 立即从数据库获取最新状态')
      this.refreshData()
    } catch (error) {
      console.error('更新状态失败:', error)
      wx.showToast({
        title: error.message || '更新失败',
        icon: 'none'
      })
    }
    wx.hideLoading()
  }
})