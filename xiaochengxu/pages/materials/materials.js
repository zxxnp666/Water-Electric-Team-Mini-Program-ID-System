const app = getApp()
Page({
  data: {
    searchKeyword: '',
    materialsList: [],
    isLoading: false,
    hasMore: true,
    currentPage: 1,
    pageSize: 20,
    totalCount: 0,
    currentUser: '',
    userRole: 'worker', 
    canManage: false,
    showEditDialog: false,
    editingMaterial: null,
    isAddMode: false,
    formData: {
      barcode: '',
      name: '',
      specification: '',
      unit: '',
      stock: 0
    },
    showDeleteConfirm: false,
    deletingMaterial: null
  },
  onLoad() {
    this.initializePage()
  },
  onShow() {
    if (this.data.searchKeyword) {
      this.searchMaterials()
    }
  },
  onPullDownRefresh() {
    this.refreshData()
  },
  onReachBottom() {
    if (this.data.hasMore && !this.data.isLoading) {
      this.loadMore()
    }
  },
  async initializePage() {
    try {
      const workerInfo = app.getWorkerInfo()
      if (!workerInfo) {
        wx.showToast({
          title: '请先登录',
          icon: 'none'
        })
        setTimeout(() => {
          wx.switchTab({
            url: '/pages/settings/settings'
          })
        }, 1500)
        return
      }
      const currentUser = workerInfo.name || workerInfo.worker_id
      const userRole = this.determineUserRole(workerInfo)
      const canManage = userRole === 'admin' || userRole === 'manager'
      this.setData({
        currentUser,
        userRole,
        canManage
      })
      console.log(`👤 用户权限: ${currentUser} (${userRole}) - 管理权限: ${canManage}`)
    } catch (error) {
      console.error('初始化页面失败:', error)
      wx.showToast({
        title: '初始化失败',
        icon: 'none'
      })
    }
  },
  determineUserRole(workerInfo) {
    if (!workerInfo || !workerInfo.position) {
      return 'worker'
    }
    const position = workerInfo.position.toLowerCase()
    if (position.includes('管理员') || position.includes('admin')) {
      return 'admin'
    } else if (position.includes('仓库管理') || position.includes('manager')) {
      return 'manager'
    } else {
      return 'worker'
    }
  },
  onSearchInput(e) {
    this.setData({
      searchKeyword: e.detail.value
    })
  },
  onSearchConfirm() {
    const keyword = this.data.searchKeyword.trim()
    if (!keyword) {
      wx.showToast({
        title: '请输入搜索关键词',
        icon: 'none'
      })
      return
    }
    this.searchMaterials()
  },
  clearSearch() {
    this.setData({
      searchKeyword: '',
      materialsList: [],
      currentPage: 1,
      hasMore: true,
      totalCount: 0
    })
  },
  async searchMaterials(loadMore = false) {
    const keyword = this.data.searchKeyword.trim()
    if (!keyword) {
      return
    }
    if (!loadMore) {
      this.setData({
        isLoading: true,
        currentPage: 1,
        materialsList: [],
        hasMore: true
      })
    } else {
      this.setData({ isLoading: true })
    }
    try {
      const page = loadMore ? this.data.currentPage + 1 : 1
      const queryParams = [
        `keyword=${encodeURIComponent(keyword)}`,
        `page=${page}`,
        `limit=${this.data.pageSize}`
      ].join('&')
      const result = await app.request({
        url: `/api/materials/search?${queryParams}`
      })
      if (result.status === 'success') {
        const newMaterials = result.data || []
        const pagination = result.pagination || {}
        this.setData({
          materialsList: loadMore ? [...this.data.materialsList, ...newMaterials] : newMaterials,
          currentPage: page,
          hasMore: page < pagination.pages,
          totalCount: pagination.total || 0,
          isLoading: false
        })
        console.log(`🔍 搜索结果: 找到 ${pagination.total} 个物资，当前页 ${page}/${pagination.pages}`)
        if (newMaterials.length === 0 && !loadMore) {
          wx.showToast({
            title: '未找到相关物资',
            icon: 'none'
          })
        }
      } else {
        throw new Error(result.message || '搜索失败')
      }
    } catch (error) {
      console.error('搜索物资失败:', error)
      wx.showToast({
        title: error.message || '搜索失败',
        icon: 'none'
      })
      this.setData({
        isLoading: false,
        hasMore: false
      })
    }
    wx.stopPullDownRefresh()
  },
  refreshData() {
    if (this.data.searchKeyword) {
      this.searchMaterials()
    } else {
      wx.stopPullDownRefresh()
    }
  },
  loadMore() {
    if (this.data.searchKeyword) {
      this.searchMaterials(true)
    }
  },
  addToCart(e) {
    const index = e.currentTarget.dataset.index
    const material = this.data.materialsList[index]
    if (!material) return
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
    wx.showToast({
      title: '已添加到待出库',
      icon: 'success'
    })
  },
  editMaterial(e) {
    if (!this.data.canManage) {
      wx.showToast({
        title: '无权限操作',
        icon: 'none'
      })
      return
    }
    const index = e.currentTarget.dataset.index
    const material = this.data.materialsList[index]
    if (!material) return
    this.setData({
      showEditDialog: true,
      editingMaterial: material,
      isAddMode: false,
      formData: {
        barcode: material.barcode,
        name: material.name,
        specification: material.specification,
        unit: material.unit,
        stock: material.stock
      }
    })
  },
  addMaterial() {
    if (!this.data.canManage) {
      wx.showToast({
        title: '无权限操作',
        icon: 'none'
      })
      return
    }
    this.setData({
      showEditDialog: true,
      editingMaterial: null,
      isAddMode: true,
      formData: {
        barcode: '',
        name: '',
        specification: '',
        unit: '',
        stock: 0
      }
    })
  },
  deleteMaterial(e) {
    if (!this.data.canManage) {
      wx.showToast({
        title: '无权限操作',
        icon: 'none'
      })
      return
    }
    const index = e.currentTarget.dataset.index
    const material = this.data.materialsList[index]
    if (!material) return
    this.setData({
      showDeleteConfirm: true,
      deletingMaterial: material
    })
  },
  onFormInput(e) {
    const field = e.currentTarget.dataset.field
    const value = e.detail.value
    this.setData({
      [`formData.${field}`]: field === 'stock' ? Number(value) || 0 : value
    })
  },
  closeEditDialog() {
    this.setData({
      showEditDialog: false,
      editingMaterial: null,
      isAddMode: false
    })
  },
  async saveMaterial() {
    const { formData, isAddMode, editingMaterial } = this.data
    if (!formData.barcode || !formData.name || !formData.specification || !formData.unit) {
      wx.showToast({
        title: '请填写完整信息',
        icon: 'none'
      })
      return
    }
    if (formData.stock < 0) {
      wx.showToast({
        title: '库存不能为负数',
        icon: 'none'
      })
      return
    }
    wx.showLoading({ title: isAddMode ? '创建中...' : '更新中...' })
    try {
      if (isAddMode) {
        await app.request({
          url: '/api/materials',
          method: 'POST',
          data: formData
        })
        wx.showToast({
          title: '创建成功',
          icon: 'success'
        })
      } else {
        await app.request({
          url: `/api/materials/${editingMaterial.barcode}`,
          method: 'PUT',
          data: formData
        })
        wx.showToast({
          title: '更新成功',
          icon: 'success'
        })
      }
      this.closeEditDialog()
      if (this.data.searchKeyword) {
        setTimeout(() => {
          this.searchMaterials()
        }, 500)
      }
    } catch (error) {
      console.error('保存物资失败:', error)
      wx.showToast({
        title: error.message || '保存失败',
        icon: 'none'
      })
    }
    wx.hideLoading()
  },
  closeDeleteConfirm() {
    this.setData({
      showDeleteConfirm: false,
      deletingMaterial: null
    })
  },
  async confirmDelete() {
    const material = this.data.deletingMaterial
    if (!material) return
    wx.showLoading({ title: '删除中...' })
    try {
      await app.request({
        url: `/api/materials/${material.barcode}`,
        method: 'DELETE'
      })
      wx.showToast({
        title: '删除成功',
        icon: 'success'
      })
      this.closeDeleteConfirm()
      if (this.data.searchKeyword) {
        setTimeout(() => {
          this.searchMaterials()
        }, 500)
      }
    } catch (error) {
      console.error('删除物资失败:', error)
      wx.showToast({
        title: error.message || '删除失败',
        icon: 'none'
      })
    }
    wx.hideLoading()
  }
})