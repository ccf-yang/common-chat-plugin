// popup.js

// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', async () => {
  console.log('=== 初始化弹出窗口 ===');
  await loadAndDisplayConfigs();
});

// 加载并显示配置
async function loadAndDisplayConfigs() {
  try {
    const { apiConfigs = [], customFunctions = [] } = await chrome.storage.local.get(['apiConfigs', 'customFunctions']);
    console.log('加载的API配置:', apiConfigs);
    console.log('加载的自定义功能:', customFunctions);

    // 显示API配置
    displayApiConfigs(apiConfigs);
    // 显示自定义功能
    displayCustomFunctions(customFunctions);

    // 绑定打开配置页面按钮
    const openOptionsBtn = document.getElementById('openOptions');
    if (openOptionsBtn) {
      openOptionsBtn.onclick = () => chrome.runtime.openOptionsPage();  // 打开配置页面,内置函数，默认打开options.html
    }
  } catch (error) {
    console.error('加载配置失败:', error);
  }
}

// 显示API配置
function displayApiConfigs(configs) {
  const container = document.getElementById('apiConfigs');
  if (!container) return;

  container.innerHTML = '';
  if (configs.length === 0) {
    container.innerHTML = '<div class="list-item">暂无API配置</div>';
    return;
  }

  configs.forEach((config, index) => {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
      <div class="item-info">
        <div class="item-name">${config.name}</div>
        <div class="item-detail">模型: ${config.model}</div>
      </div>
      <div class="item-actions">
        <button class="toggle-btn ${config.enabled ? '' : 'disabled'}" data-index="${index}">
          ${config.enabled ? '已启用' : '未启用'}
        </button>
        <button class="delete-btn" data-index="${index}">删除</button>
      </div>
    `;

    container.appendChild(item);
  });

  // 使用事件委托绑定按钮事件
  container.onclick = async (e) => {
    const button = e.target.closest('button');
    if (!button) return;

    const index = parseInt(button.dataset.index); // 使用 index 而不是 id
    if (button.classList.contains('toggle-btn')) {
      await toggleApiConfig(index);
    } else if (button.classList.contains('delete-btn')) {
      await deleteApiConfig(index);
    }
  };
}

// 显示自定义功能
function displayCustomFunctions(functions) {
  const container = document.getElementById('customFunctions');
  if (!container) return;

  container.innerHTML = '';
  if (functions.length === 0) {
    container.innerHTML = '<div class="list-item">暂无自定义功能</div>';
    return;
  }

  functions.forEach(func => {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
      <div class="item-info">
        <div class="item-name">${func.name}</div>
        <div class="item-detail">${func.prompt}</div>
      </div>
      <div class="item-actions">
        <button class="delete-btn" data-id="${func.id}">删除</button>
      </div>
    `;

    container.appendChild(item);
  });

  // 使用事件委托绑定删除按钮事件
  container.onclick = async (e) => {
    const deleteBtn = e.target.closest('.delete-btn');
    if (!deleteBtn) return;

    const functionId = deleteBtn.dataset.id;
    await deleteFunction(functionId);
  };
}

// 切换API配置启用状态
async function toggleApiConfig(index) {
  try {
    const { apiConfigs = [] } = await chrome.storage.local.get(['apiConfigs']);
    const updatedConfigs = apiConfigs.map((config, i) => ({
      ...config,
      enabled: i === index ? !config.enabled : false
    }));
    
    await chrome.storage.local.set({ apiConfigs: updatedConfigs });
    
    // 发送消息通知其他页面
    chrome.runtime.sendMessage({
      type: 'configsUpdated',
      data: {
        apiConfigs: updatedConfigs
      }
    });
    
    await loadAndDisplayConfigs();
  } catch (error) {
    console.error('切换API配置状态失败:', error);
  }
}

// 删除API配置
async function deleteApiConfig(index) {
  try {
    const { apiConfigs = [] } = await chrome.storage.local.get(['apiConfigs']);
    const updatedConfigs = apiConfigs.filter((config, i) => i !== index);
    await chrome.storage.local.set({ apiConfigs: updatedConfigs });
    await loadAndDisplayConfigs();
  } catch (error) {
    console.error('删除API配置失败:', error);
  }
}

console.log('popup.js loaded'); // 确保文件加载

async function deleteFunction(functionId) {
  try {
    const { customFunctions = [] } = await chrome.storage.local.get(['customFunctions']);
    
    // 找到要删除的功能的索引
    const updatedFunctions = customFunctions.filter(func => func.id !== functionId);
    
    // 保存更新后的数组
    await chrome.storage.local.set({ customFunctions: updatedFunctions });
    
    // 发送消息通知其他页面
    chrome.runtime.sendMessage({
      type: 'configsUpdated',
      data: {
        customFunctions: updatedFunctions
      }
    });

    // 通知 background.js 更新上下文菜单
    chrome.runtime.sendMessage({
      type: 'UPDATE_CONTEXT_MENUS',
      force: true
    });
    
    // 重新加载显示
    await loadAndDisplayConfigs();
    
  } catch (error) {
    console.error('删除功能失败:', error);
  }
}
  
// 监听存储变化
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.apiConfigs) {
    loadAndDisplayConfigs();
  }
});
  
// 监听来自 options 页面的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'configsUpdated') {
    loadAndDisplayConfigs();
  }
});

// 加载并更新配置
function loadAndUpdateConfigs() {
  chrome.storage.local.get(['apiConfigs', 'customFunctions'], function(result) {
    if (result) {
      updatePopupWithNewConfigs(result);
    }
  });
}

// 更新popup页面配置的函数
function updatePopupWithNewConfigs(data) {
  if (data.apiConfigs) {
    const activeApi = data.apiConfigs.find(config => config.active);
    
    // 更新API选择器
    const apiSelector = document.getElementById('apiSelector');
    if (apiSelector) {
      apiSelector.innerHTML = '';
      data.apiConfigs.forEach(config => {
        const option = document.createElement('option');
        option.value = config.name;
        option.textContent = config.name;
        option.selected = config.active;
        apiSelector.appendChild(option);
      });
    }
    
    // 更新API状态显示
    updateUIWithActiveApi(activeApi);
  }
}

// 更新UI以反映当前激活的API
function updateUIWithActiveApi(activeApi) {
  // 更新API状态显示（如果有）
  const apiStatus = document.getElementById('apiStatus');
  if (apiStatus) {
    apiStatus.textContent = activeApi ? `当前使用: ${activeApi.name}` : '未选择API';
  }
  
  // 更新其他依赖于API配置的UI元素
  // ...根据你的具体UI结构添加更多更新逻辑
}

// 更新自定义功能列表
function updateCustomFunctions(functions) {
  const functionsList = document.getElementById('functionsList');
  if (functionsList) {
    functionsList.innerHTML = '';
    functions.forEach(func => {
      const functionItem = document.createElement('div');
      functionItem.className = 'function-item';
      // 根据你的UI结构创建功能项
      functionItem.innerHTML = `
        <span>${func.name}</span>
        <button class="use-function" data-prompt="${func.prompt}">使用</button>
      `;
      functionsList.appendChild(functionItem);
    });
  }
}

// 当API选择改变时
document.getElementById('apiSelector')?.addEventListener('change', function() {
  const selectedName = this.value;
  
  chrome.storage.local.get(['apiConfigs'], function(result) {
    if (result.apiConfigs) {
      // 更新配置
      const updatedConfigs = result.apiConfigs.map(config => ({
        ...config,
        active: config.name === selectedName
      }));
      
      // 保存更新后的配置
      chrome.storage.local.set({ apiConfigs: updatedConfigs }, function() {
        // 通知其他页面配置已更新
        chrome.runtime.sendMessage({
          type: 'configsUpdated',
          data: {
            apiConfigs: updatedConfigs
          }
        });
      });
    }
  });
});

// 初始化时加载配置
document.addEventListener('DOMContentLoaded', function() {
  loadAndUpdateConfigs();
});
  
