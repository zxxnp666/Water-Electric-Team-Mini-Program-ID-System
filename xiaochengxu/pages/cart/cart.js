const app = getApp()
Page({
  data: {
    cartItems: [],
    totalQuantity: 0,
    totalItems: 0,
    userName: '',
    isSubmitting: false,
    showConfirmDialog: false,
    confirmData: {},
    selectedItems: [], 
    selectMode: false 
  },
  onLoad() {
    console.log('🛒 购物车页面加载')
  },
  onShow() {
    this.loadCartData()
    this.setData({
      userName: app.getCurrentUserName() || ''
    })
  },
  onPullDownRefresh() {
    this.loadCartData()
    wx.stopPullDownRefresh()
  },
  loadCartData() {
    const cartItems = app.globalData.cart || []
    const stats = app.getCartStats()
    const itemsWithSelection = cartItems.map(item => ({
      ...item,
      selected: false
    }))
    this.setData({
      cartItems: itemsWithSelection,
      totalQuantity: stats.totalQuantity,
      totalItems: stats.itemCount
    })
    console.log('🛒 购物车数据:', { items: cartItems.length, totalQuantity: stats.totalQuantity })
  },
  updateQuantity(e) {
    const index = e.currentTarget.dataset.index
    const newQuantity = parseInt(e.detail.value) || 1
    const item = this.data.cartItems[index]
    if (newQuantity <= 0) {
      this.removeItem(index)
      return
    }
    if (newQuantity > item.stock) {
      wx.showToast({
        title: `最大库存：${item.stock}`,
        icon: 'none'
      })
      return
    }
    app.updateCartQuantity(item.barcode, newQuantity)
    const cartItems = [...this.data.cartItems]
    cartItems[index].quantity = newQuantity
    this.setData({ cartItems })
    this.updateStats()
    console.log('📝 更新数量:', item.name, '数量:', newQuantity)
  },
  adjustQuantity(e) {
    const index = e.currentTarget.dataset.index
    const operation = e.currentTarget.dataset.operation 
    const item = this.data.cartItems[index]
    let newQuantity = item.quantity
    if (operation === 'increase') {
      newQuantity = Math.min(item.quantity + 1, item.stock)
    } else {
      newQuantity = Math.max(item.quantity - 1, 1)
    }
    if (newQuantity !== item.quantity) {
      app.updateCartQuantity(item.barcode, newQuantity)
      const cartItems = [...this.data.cartItems]
      cartItems[index].quantity = newQuantity
      this.setData({ cartItems })
      this.updateStats()
    }
  },
  removeItem(index) {
    const item = this.data.cartItems[index]
    wx.showModal({
      title: '确认移除',
      content: `确定要移除"${item.name}"吗？`,
      success: (res) => {
        if (res.confirm) {
          app.removeFromCart(item.barcode)
          this.loadCartData()
          wx.showToast({
            title: '已移除',
            icon: 'success'
          })
        }
      }
    })
  },
  toggleSelectMode() {
    this.setData({
      selectMode: !this.data.selectMode,
      selectedItems: []
    })
  },
  toggleItemSelection(e) {
    const index = e.currentTarget.dataset.index
    const cartItems = [...this.data.cartItems]
    const item = cartItems[index]
    item.selected = !item.selected
    const selectedItems = cartItems.filter(item => item.selected)
    this.setData({ 
      cartItems,
      selectedItems 
    })
  },
  toggleSelectAll() {
    const allSelected = this.data.selectedItems.length === this.data.cartItems.length
    const cartItems = [...this.data.cartItems]
    cartItems.forEach(item => {
      item.selected = !allSelected
    })
    const selectedItems = cartItems.filter(item => item.selected)
    this.setData({ 
      cartItems,
      selectedItems 
    })
  },
  removeSelectedItems() {
    if (this.data.selectedItems.length === 0) {
      wx.showToast({
        title: '请先选择物资',
        icon: 'none'
      })
      return
    }
    wx.showModal({
      title: '确认移除',
      content: `确定要移除选中的${this.data.selectedItems.length}项物资吗？`,
      success: (res) => {
        if (res.confirm) {
          this.data.selectedItems.forEach(item => {
            app.removeFromCart(item.barcode)
          })
          this.setData({
            selectedItems: [],
            selectMode: false
          })
          this.loadCartData()
          wx.showToast({
            title: '已移除选中项',
            icon: 'success'
          })
        }
      }
    })
  },
  clearCart() {
    if (this.data.cartItems.length === 0) {
      return
    }
    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有待出库物资吗？',
      success: (res) => {
        if (res.confirm) {
          app.clearCart()
          this.loadCartData()
          wx.showToast({
            title: '购物车已清空',
            icon: 'success'
          })
        }
      }
    })
  },
  setUserName() {
    wx.showModal({
      title: '设置领用人',
      editable: true,
      placeholderText: '请输入领用人姓名',
      success: (res) => {
        if (res.confirm && res.content.trim()) {
          const name = res.content.trim()
          app.setUserInfo({ name })
          this.setData({ userName: name })
        }
      }
    })
  },
  onUserNameInput(e) {
    const userName = e.detail.value.trim()
    this.setData({ userName })
    if (userName) {
      app.setUserInfo({ name: userName })
    }
  },
  confirmCheckout() {
    if (this.data.cartItems.length === 0) {
      wx.showToast({
        title: '购物车为空',
        icon: 'none'
      })
      return
    }
    if (!this.data.userName.trim()) {
      wx.showModal({
        title: '提示',
        content: '请输入领用人姓名',
        success: (res) => {
          if (res.confirm) {
            this.setUserName()
          }
        }
      })
      return
    }
    const confirmData = {
      items: this.data.cartItems,
      user: this.data.userName.trim(),
      totalQuantity: this.data.totalQuantity,
      totalItems: this.data.totalItems,
      time: new Date().toLocaleString()
    }
    this.setData({
      confirmData,
      showConfirmDialog: true
    })
  },
  closeConfirmDialog() {
    this.setData({ showConfirmDialog: false })
  },
  async executeCheckout() {
    this.setData({ 
      isSubmitting: true,
      showConfirmDialog: false 
    })
    wx.showLoading({ title: '正在出库...' })
    try {
      const requestData = {
        items: this.data.cartItems.map(item => ({
          barcode: item.barcode,
          quantity: item.quantity
        })),
        user: this.data.userName.trim()
      }
      console.log('📤 提交出库请求:', requestData)
      const result = await app.request({
        url: '/api/inventory/checkout',
        method: 'POST',
        data: requestData
      })
      console.log('✅ 出库成功:', result)
      app.clearCart()
      this.loadCartData()
      wx.showModal({
        title: '✅ 出库成功',
        content: `领用人：${result.data.user}\n物资种类：${result.data.item_count}种\n操作时间：${result.data.time}`,
        showCancel: false,
        confirmText: '确定',
        success: () => {
          wx.switchTab({
            url: '/pages/history/history'
          })
        }
      })
    } catch (error) {
      console.error('❌ 出库失败:', error)
      wx.showModal({
        title: '出库失败',
        content: error.message || '网络错误，请重试',
        showCancel: false
      })
    } finally {
      this.setData({ isSubmitting: false })
      wx.hideLoading()
    }
  },
  updateStats() {
    const stats = app.getCartStats()
    this.setData({
      totalQuantity: stats.totalQuantity,
      totalItems: stats.itemCount
    })
  },
  continueScan() {
    wx.switchTab({
      url: '/pages/scan/scan'
    })
  },
  viewMaterialDetail(e) {
    const index = e.currentTarget.dataset.index
    const material = this.data.cartItems[index]
    wx.showModal({
      title: '物资详情',
      content: `名称：${material.name}\n规格：${material.specification}\n单位：${material.unit}\n当前库存：${material.stock}\n待出库数量：${material.quantity}`,
      showCancel: false
    })
  }
})