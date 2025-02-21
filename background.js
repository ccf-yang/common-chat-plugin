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
  refreshContextMenus();
});

// 监听存储变化，更新菜单
chrome.storage.onChanged.addListener((changes) => {
  if (changes.customFunctions) {
    refreshContextMenus();
  }
});

// 监听消息，这里只是示例，实际并没有使用，配合popup.js里面的chrome.runtime.sendMessage({ type: 'UPDATE_CONTEXT_MENUS' });
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === 'UPDATE_CONTEXT_MENUS') {
    console.log('收到更新菜单请求');
    await refreshContextMenus();
  }
});

// 刷新右键的上下文菜单
async function refreshContextMenus() {
  try {
    // 先移除所有现有菜单
    await chrome.contextMenus.removeAll()
    .then(() => {
        console.log('所有菜单项已删除');
    })
    .catch((error) => {
        console.error('删除菜单项失败:', error);
    });
    
    // 创建父菜单
    await chrome.contextMenus.create({
      id: 'aiChatParent',
      title: 'AI Chat',
      contexts: ['selection']
    });

    // 获取自定义功能
    const { customFunctions = [] } = await chrome.storage.local.get(['customFunctions']);
    console.log('当前功能列表:', customFunctions);

    // 为每个功能创建子菜单
    customFunctions.forEach(func => {
      chrome.contextMenus.create({
        id: func.id,
        parentId: 'aiChatParent',
        title: func.name,
        contexts: ['selection']
      });
    });

    console.log('菜单刷新完成');
  } catch (error) {
    console.error('刷新菜单失败:', error);
  }
}

// 监听菜单点击事件
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!info.selectionText) return;

  // 获取功能配置和API配置
  const { customFunctions = [], apiConfigs = [] } = await chrome.storage.local.get(['customFunctions', 'apiConfigs']);
  
  // 查找选中的功能
  const selectedFunction = customFunctions.find(f => f.id === info.menuItemId);
  if (!selectedFunction) {
    console.error('未找到对应的功能:', info.menuItemId);
    return;
  }

  // 查找启用的API配置
  const activeApi = apiConfigs.find(api => api.enabled);
  if (!activeApi) {
    console.error('没有启用的API配置');
    chrome.tabs.sendMessage(tab.id, {
      type: 'SHOW_ERROR',
      message: '请先启用一个API配置'
    });
    return;
  }

  console.log('准备发送请求:', {
    text: info.selectionText,
    prompt: selectedFunction.prompt,
    api: activeApi
  });

  // 发送消息到content script处理请求
  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'PROCESS_REQUEST',
      data: {
        text: info.selectionText,
        prompt: selectedFunction.prompt,
        api: activeApi
      }
    });
    console.log('收到content script响应:', response);
  } catch (error) {
    console.error('发送消息到content script失败:', error);
  }
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
