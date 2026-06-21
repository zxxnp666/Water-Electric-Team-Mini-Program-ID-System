const app = getApp()
Page({
  data: {
    serverConfig: {
      baseUrl: '',
      configured: false
    },
    workerInfo: {
      worker_id: '',
      name: '',
      department: '',
      position: ''
    },
    connectionStatus: 'unknown', 
    systemInfo: {},
    appVersion: '2.0.0',
    isTestingConnection: false,
    showServerDialog: false,
    tempServerUrl: '',
    showLoginDialog: false,
    loginForm: {
      worker_id: '',
      password: ''
    },
    isLoggingIn: false
  },
  onLoad() {
    console.log('⚙️ 设置页面加载')
    this.loadSettings()
  },
  onShow() {
    this.loadSettings()
  },
  loadSettings() {
    const serverConfig = app.globalData.serverConfig || {}
    console.log('🔍 当前服务器配置:', serverConfig)
    console.log('🔍 存储中的配置:', wx.getStorageSync('serverConfig'))
    const workerInfo = app.globalData.workerInfo || {
      worker_id: '',
      name: '',
      department: '',
      position: ''
    }
    const lastLoginId = wx.getStorageSync('lastLoginId') || ''
    wx.getSystemInfo({
      success: (res) => {
        this.setData({
          systemInfo: {
            platform: res.platform,
            system: res.system,
            version: res.version,
            model: res.model,
            brand: res.brand
          }
        })
      }
    })
    this.setData({
      serverConfig,
      workerInfo,
      connectionStatus: app.globalData.isConnected ? 'connected' : 'disconnected',
      'loginForm.worker_id': workerInfo.worker_id || lastLoginId
    })
  },
  showServerConfig() {
    this.setData({
      showServerDialog: true,
      tempServerUrl: this.data.serverConfig.baseUrl || ''
    })
  },
  closeServerDialog() {
    this.setData({
      showServerDialog: false,
      tempServerUrl: ''
    })
  },
  onServerUrlInput(e) {
    this.setData({
      tempServerUrl: e.detail.value.trim()
    })
  },
  async testConnection() {
    const url = this.data.tempServerUrl
    if (!url) {
      wx.showToast({
        title: '请输入服务器地址',
        icon: 'none'
      })
      return
    }
    if (!url.startsWith('http:
      wx.showToast({
        title: '请输入完整的URL地址',
        icon: 'none'
      })
      return
    }
    this.setData({ 
      isTestingConnection: true,
      connectionStatus: 'testing'
    })
    wx.showLoading({ title: '测试连接中...' })
    try {
      const originalConfig = app.globalData.serverConfig
      app.globalData.serverConfig = { baseUrl: url, configured: true }
      const response = await app.request({ url: '/api/health' })
      console.log('✅ 连接测试成功:', response)
      this.setData({ connectionStatus: 'connected' })
      wx.showToast({
        title: '连接成功',
        icon: 'success'
      })
    } catch (error) {
      console.error('❌ 连接测试失败:', error)
      app.globalData.serverConfig = app.globalData.serverConfig
      this.setData({ connectionStatus: 'disconnected' })
      wx.showModal({
        title: '连接失败',
        content: error.message || '无法连接到服务器，请检查地址和网络',
        showCancel: false
      })
    } finally {
      this.setData({ isTestingConnection: false })
      wx.hideLoading()
    }
  },
  saveServerConfig() {
    const url = this.data.tempServerUrl
    if (!url) {
      wx.showToast({
        title: '请输入服务器地址',
        icon: 'none'
      })
      return
    }
    if (!url.startsWith('http:
      wx.showToast({
        title: '请输入完整的URL地址',
        icon: 'none'
      })
      return
    }
    const newConfig = {
      baseUrl: url,
      configured: true
    }
    app.setServerConfig(newConfig)
    this.setData({
      serverConfig: newConfig,
      showServerDialog: false,
      tempServerUrl: ''
    })
    wx.showToast({
      title: '配置已保存',
      icon: 'success'
    })
    setTimeout(() => {
      this.testCurrentConnection()
    }, 1000)
  },
  async testCurrentConnection() {
    if (!this.data.serverConfig.configured) {
      return
    }
    this.setData({ connectionStatus: 'testing' })
    try {
      const connected = await app.checkConnection()
      this.setData({
        connectionStatus: connected ? 'connected' : 'disconnected'
      })
    } catch (error) {
      this.setData({ connectionStatus: 'disconnected' })
    }
  },
  resetServerConfig() {
    wx.showModal({
      title: '确认重置',
      content: '确定要重置服务器配置吗？',
      success: (res) => {
        if (res.confirm) {
          app.setServerConfig({ baseUrl: '', configured: false })
          this.setData({
            serverConfig: { baseUrl: '', configured: false },
            connectionStatus: 'disconnected'
          })
          wx.showToast({
            title: '配置已重置',
            icon: 'success'
          })
        }
      }
    })
  },
  showLoginDialog() {
    const lastLoginId = wx.getStorageSync('lastLoginId') || ''
    this.setData({
      showLoginDialog: true,
      loginForm: {
        worker_id: lastLoginId,  
        password: ''
      }
    })
  },
  closeLoginDialog() {
    this.setData({
      showLoginDialog: false,
      loginForm: {
        worker_id: '',
        password: ''
      },
      isLoggingIn: false
    })
  },
  onWorkerIdInput(e) {
    this.setData({
      'loginForm.worker_id': e.detail.value.trim()
    })
  },
  onPasswordInput(e) {
    this.setData({
      'loginForm.password': e.detail.value
    })
  },
  async submitLogin() {
    const { worker_id, password } = this.data.loginForm
    if (!worker_id) {
      wx.showToast({
        title: '请输入工号',
        icon: 'none'
      })
      return
    }
    if (!password) {
      wx.showToast({
        title: '请输入密码',
        icon: 'none'
      })
      return
    }
    if (!this.data.serverConfig.configured) {
      wx.showModal({
        title: '需要配置服务器',
        content: '登录功能需要先配置服务器地址，是否现在配置？',
        success: (res) => {
          if (res.confirm) {
            this.closeLoginDialog()
            this.showServerConfig()
          }
        }
      })
      return
    }
    this.setData({ isLoggingIn: true })
    wx.showLoading({ title: '登录中...' })
    try {
      const response = await app.request({
        url: '/api/worker/login',
        method: 'POST',
        data: {
          worker_id,
          password
        }
      })
      console.log('✅ 登录成功:', response)
      const workerInfo = response.data
      app.setWorkerInfo(workerInfo)
      app.setUserInfo({ name: workerInfo.name })
      wx.setStorageSync('lastLoginId', worker_id)
      console.log('💾 已保存上次登录账号:', worker_id)
      this.setData({
        workerInfo,
        showLoginDialog: false,
        loginForm: {
          worker_id: '',
          password: ''
        }
      })
      wx.showToast({
        title: `欢迎，${workerInfo.name}！`,
        icon: 'success'
      })
    } catch (error) {
      console.error('❌ 登录失败:', error)
      let errorMessage = error.message || '登录验证失败，请检查工号和密码'
      if (error.message && (error.message.includes('网络') || error.message.includes('连接'))) {
        wx.showModal({
          title: '连接失败',
          content: '无法连接到服务器，请检查服务器地址配置',
          confirmText: '检查配置',
          success: (res) => {
            if (res.confirm) {
              this.closeLoginDialog()
              this.showServerConfig()
            }
          }
        })
      } else {
        wx.showModal({
          title: '登录失败',
          content: errorMessage,
          showCancel: false
        })
      }
    } finally {
      this.setData({ isLoggingIn: false })
      wx.hideLoading()
    }
  },
  logout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          const currentWorkerId = this.data.workerInfo.worker_id
          if (currentWorkerId) {
            wx.setStorageSync('lastLoginId', currentWorkerId)
            console.log('💾 退出时保存上次登录账号:', currentWorkerId)
          }
          app.setWorkerInfo({
            worker_id: '',
            name: '',
            department: '',
            position: ''
          })
          app.setUserInfo({ name: '', department: '水电班' })
          const lastLoginId = wx.getStorageSync('lastLoginId') || ''
          this.setData({
            workerInfo: {
              worker_id: '',
              name: '',
              department: '',
              position: ''
            },
            'loginForm.worker_id': lastLoginId  
          })
          wx.showToast({
            title: '已退出登录',
            icon: 'success'
          })
        }
      }
    })
  },
  resetServerConfig() {
    wx.showModal({
      title: '重置服务器配置',
      content: '这将清除当前的服务器配置，是否继续？',
      confirmText: '重置',
      confirmColor: '#FF9800',
      success: (res) => {
        if (res.confirm) {
          try {
            wx.removeStorageSync('serverConfig')
            app.globalData.serverConfig = { baseUrl: '', configured: false }
            this.loadSettings()
            wx.showToast({
              title: '配置已重置',
              icon: 'success'
            })
            setTimeout(() => {
              this.showServerConfig()
            }, 1000)
          } catch (error) {
            wx.showToast({
              title: '重置失败',
              icon: 'error'
            })
          }
        }
      }
    })
  },
  clearAllData() {
    wx.showModal({
      title: '⚠️ 危险操作',
      content: '确定要清除所有本地数据吗？包括扫描历史、用户设置等',
      confirmText: '确定清除',
      confirmColor: '#BF616A',
      success: (res) => {
        if (res.confirm) {
          try {
            wx.clearStorageSync()
            app.globalData.cart = []
            app.globalData.userInfo = { name: '', department: '水电班' }
            app.globalData.workerInfo = { worker_id: '', name: '', department: '', position: '' }
            app.globalData.serverConfig = { baseUrl: '', configured: false }
            this.loadSettings()
            wx.showToast({
              title: '数据已清除',
              icon: 'success'
            })
          } catch (error) {
            wx.showToast({
              title: '清除失败',
              icon: 'error'
            })
          }
        }
      }
    })
  },
  showConnectionHelp() {
    const helpContent = `📖 连接帮助
🔧 服务器地址格式：
http:
📝 示例：
• http:
• http:
⚠️ 注意事项：
1. 确保手机与管理端电脑在同一局域网
2. 管理端程序必须正在运行
3. 防火墙需要开放5000端口
4. IP地址需要是管理端电脑的实际IP
🔍 如何获取IP地址：
在管理端电脑上运行命令：ipconfig`
    wx.showModal({
      title: '连接帮助',
      content: helpContent,
      showCancel: false,
      confirmText: '我知道了'
    })
  },
  showSystemInfo() {
    const info = this.data.systemInfo
    const content = `📱 设备信息
系统：${info.system || '未知'}
品牌：${info.brand || '未知'}
型号：${info.model || '未知'}
平台：${info.platform || '未知'}
微信版本：${info.version || '未知'}
📱 小程序版本：${this.data.appVersion}`
    wx.showModal({
      title: '系统信息',
      content: content,
      showCancel: false,
      confirmText: '确定'
    })
  },
  submitFeedback() {
    wx.showModal({
      title: '意见反馈',
      editable: true,
      placeholderText: '请描述您遇到的问题或建议...',
      success: (res) => {
        if (res.confirm && res.content.trim()) {
          wx.showToast({
            title: '反馈已提交，谢谢！',
            icon: 'success'
          })
        }
      }
    })
  },
  quickConfig() {
    wx.showToast({
      title: '功能开发中...',
      icon: 'none'
    })
  },
  exportSettings() {
    const settings = {
      serverConfig: this.data.serverConfig,
      userInfo: this.data.userInfo,
      exportTime: new Date().toISOString()
    }
    wx.setClipboardData({
      data: JSON.stringify(settings),
      success: () => {
        wx.showToast({
          title: '设置已复制到剪贴板',
          icon: 'success'
        })
      }
    })
  },
  importSettings() {
    wx.getClipboardData({
      success: (res) => {
        try {
          const settings = JSON.parse(res.data)
          if (settings.serverConfig && settings.userInfo) {
            app.setServerConfig(settings.serverConfig)
            app.setUserInfo(settings.userInfo)
            this.loadSettings()
            wx.showToast({
              title: '设置导入成功',
              icon: 'success'
            })
          } else {
            throw new Error('格式错误')
          }
        } catch (error) {
          wx.showToast({
            title: '导入失败，请检查格式',
            icon: 'none'
          })
        }
      }
    })
  }
})