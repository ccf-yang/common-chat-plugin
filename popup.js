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

  configs.forEach(config => {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
      <div class="item-info">
        <div class="item-name">${config.name}</div>
        <div class="item-detail">模型: ${config.model}</div>
      </div>
      <div class="item-actions">
        <button class="toggle-btn ${config.enabled ? '' : 'disabled'}" data-id="${config.id}">
          ${config.enabled ? '已启用' : '未启用'}
        </button>
        <button class="delete-btn" data-id="${config.id}">删除</button>
      </div>
    `;

    container.appendChild(item);
  });

  // 使用事件委托绑定按钮事件
  container.onclick = async (e) => {
    const button = e.target.closest('button'); 
    if (!button) return;

    const configId = button.dataset.id;
    if (button.classList.contains('toggle-btn')) {
      await toggleApiConfig(configId);
    } else if (button.classList.contains('delete-btn')) {
      await deleteApiConfig(configId);
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
async function toggleApiConfig(configId) {
  try {
    const { apiConfigs = [] } = await chrome.storage.local.get(['apiConfigs']);
    const updatedConfigs = apiConfigs.map(config => ({
      ...config,
      enabled: config.id === configId ? !config.enabled : false
    }));
    await chrome.storage.local.set({ apiConfigs: updatedConfigs });
    await loadAndDisplayConfigs();
  } catch (error) {
    console.error('切换API配置状态失败:', error);
  }
}

// 删除API配置
async function deleteApiConfig(configId) {
  try {
    const { apiConfigs = [] } = await chrome.storage.local.get(['apiConfigs']);
    const updatedConfigs = apiConfigs.filter(config => config.id !== configId);
    await chrome.storage.local.set({ apiConfigs: updatedConfigs });
    await loadAndDisplayConfigs();
  } catch (error) {
    console.error('删除API配置失败:', error);
  }
}

console.log('popup.js loaded'); // 确保文件加载

function deleteFunction(index) {
    chrome.storage.local.get(['customFunctions'], ({ customFunctions }) => {
          console.log('删除功能2:', index); // index 是功能项的 id
          console.log('customFunctions:', customFunctions);
      
          // 找到该功能项在数组中的索引
          const functionIndex = customFunctions.findIndex(func => func.id === index);
      
          if (functionIndex !== -1) {
            // 如果找到索引，删除该功能项
            customFunctions.splice(functionIndex, 1);
            console.log('customFunctions:', customFunctions);
      
            // 保存修改后的数组
            chrome.storage.local.set({ customFunctions }, () => {
              console.log('功能已删除，存储已更新');
            });
          } else {
            console.error('未找到要删除的功能项');
          }
    //   // 通知background.js更新上下文菜单 , 因为下面用了检测到存储发生变化就通知的功能，所以这里不需要用
    //   chrome.runtime.sendMessage({ 
    //     type: 'UPDATE_CONTEXT_MENUS',
    //     force: true
    //   });
    //   displayCustomFunctions(customFunctions);
    });
}
  
// 监听存储变化
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && (changes.customFunctions || changes.apiConfigs)) {
    console.log('存储发生变化，重新加载配置');
    loadAndDisplayConfigs();
  }
});
  
