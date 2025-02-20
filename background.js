let currentApiConfig = null;



// 监听API配置变化
chrome.storage.onChanged.addListener((changes) => {
  if (changes.apiConfigs) {
    updateCurrentApiConfig(changes.apiConfigs.newValue);
  }
});

function updateCurrentApiConfig(configs) {
  currentApiConfig = configs?.find(c => c.enabled);
}

// 初始化上下文菜单
chrome.runtime.onInstalled.addListener(() => {
  // 创建父菜单
  chrome.contextMenus.create({
    id: 'aiChatParent',
    title: 'AI Chat',
    contexts: ['selection']
  });
  
  refreshContextMenus();
  chrome.storage.sync.get(['apiConfigs', 'customFunctions'], ({ apiConfigs, customFunctions }) => {
    updateCurrentApiConfig(apiConfigs);
    if (!currentApiConfig) {
      console.warn('没有可用的API配置');
    }
  });
});

// 监听存储变化，更新菜单
chrome.storage.onChanged.addListener((changes) => {
  if (changes.customFunctions) {
    refreshContextMenus();
  }
});

// 刷新上下文菜单
async function refreshContextMenus() {
  // 清除所有子菜单
  const { customFunctions = [] } = await chrome.storage.local.get(['customFunctions']);
  
  // 为每个功能创建子菜单项
  customFunctions.forEach(func => {
    chrome.contextMenus.create({
      id: func.id,
      parentId: 'aiChatParent',
      title: func.name,
      contexts: ['selection']
    });
  });
}

// 处理菜单点击
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!info.selectionText) return;

  // 获取功能配置和API配置
  const { customFunctions = [], apiConfigs = [] } = await chrome.storage.local.get(['customFunctions', 'apiConfigs']);
  
  // 查找选中的功能
  const selectedFunction = customFunctions.find(f => f.id === info.menuItemId);
  if (!selectedFunction) return;

  // 查找启用的API配置
  const activeApi = apiConfigs.find(api => api.enabled);
  if (!activeApi) {
    chrome.tabs.sendMessage(tab.id, {
      type: 'SHOW_ERROR',
      message: '请先启用一个API配置'
    });
    return;
  }

  // 发送消息到content script处理请求
  chrome.tabs.sendMessage(tab.id, {
    type: 'PROCESS_REQUEST',
    data: {
      text: info.selectionText,
      prompt: selectedFunction.prompt,
      api: activeApi
    }
  });
});

// 接收来自内容脚本的新功能请求
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "addNewFunction") {
    chrome.storage.sync.get(['customFunctions'], ({ customFunctions = [] }) => {
      const newFunctions = [...customFunctions, {
        id: `custom_${Date.now()}`,
        name: request.name,
        prompt: request.prompt
      }];
      chrome.storage.sync.set({ customFunctions: newFunctions }, () => {
        refreshContextMenus();
        sendResponse({ success: true });
      });
    });
    return true;
  }
});
