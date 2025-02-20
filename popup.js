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
      openOptionsBtn.onclick = () => chrome.runtime.openOptionsPage();
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

// 删除功能
async function deleteFunction(functionId) {
  try {
    console.log('删除功能:', functionId);
    const { customFunctions = [] } = await chrome.storage.local.get(['customFunctions']);
    const updatedFunctions = customFunctions.filter(func => func.id !== functionId);
    await chrome.storage.local.set({ customFunctions: updatedFunctions });
    
    // 通知background.js更新上下文菜单
    chrome.runtime.sendMessage({ 
      type: 'UPDATE_CONTEXT_MENUS',
      force: true
    });
    
    // 立即更新显示
    displayCustomFunctions(updatedFunctions);
  } catch (error) {
    console.error('删除功能失败:', error);
  }
}

console.log('popup.js loaded'); // 确保文件加载

document.getElementById('addApiConfig').addEventListener('click', () => {
    document.getElementById('apiForm').style.display = 'block';
    document.getElementById('addApiConfig').style.display = 'none';
});

function validateApiConfig(name, url, key) {
    if (!name) {
        alert('配置名称不能为空');
        return false;
    }
    if (!url.startsWith('https://')) {
        alert('请输入有效的HTTPS地址');
        return false;
    }
    if (!key) {
        alert('API密钥不能为空');
        return false;
    }
    return true;
}

function cancelApiConfig() {
    document.getElementById('apiForm').style.display = 'none';
}

function clearForm() {
    document.getElementById('apiForm').style.display = 'none';
    document.getElementById('addApiConfig').style.display = 'block';
    document.getElementById('configName').value = '';
    document.getElementById('apiUrl').value = '';
    document.getElementById('apiKey').value = '';
    document.getElementById('apiModel').value = '';
}
  
// 修改后的refreshConfigs函数
function refreshConfigs() {
    chrome.storage.local.get(['apiConfigs'], ({ apiConfigs = [] }) => {
        const list = document.getElementById('configList');
        list.innerHTML = apiConfigs.length === 0 ? 
            '<div class="empty-tip">暂无配置，点击上方按钮添加</div>' : '';

        apiConfigs.forEach((config, index) => {
            const configItem = document.createElement('div');
            configItem.className = 'api-config';
            configItem.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h4>${config.name}</h4>
                        <div style="font-size: 0.9em; color: #666;">
                            ${config.model} | ${shortenUrl(config.url)}
                        </div>
                    </div>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <button class="delete-btn" data-index="${index}">删除</button>
                        <div class="toggle-btn" data-index="${index}">
                            ${config.enabled ? '✅ 已启用' : '❌ 未启用'}
                        </div>
                    </div>
                </div>
            `;
            configItem.querySelector('.toggle-btn').onclick = () => toggleConfig(index);
            configItem.querySelector('.delete-btn').onclick = () => deleteConfig(index);
            list.appendChild(configItem);
        });
    });
}

function shortenUrl(url) {
    return url.replace(/^https?:\/\/(www\.)?/,'').slice(0, 20) + '...';
}

function toggleConfig(index) {
chrome.storage.local.get(['apiConfigs'], ({ apiConfigs }) => {
    apiConfigs = apiConfigs.map((c, i) => ({
    ...c,
    enabled: i === index ? !c.enabled : false
    }));
    chrome.storage.local.set({ apiConfigs }, refreshConfigs);
});
}

function deleteConfig(index) {
    if (confirm('确定要删除此配置吗？')) {
        chrome.storage.local.get(['apiConfigs'], ({ apiConfigs }) => {
            apiConfigs.splice(index, 1);
            chrome.storage.local.set({ apiConfigs }, refreshConfigs);
        });
    }
}

// 新增功能管理
function refreshFunctions() {
  chrome.storage.local.get(['customFunctions'], ({ customFunctions = [] }) => {
    const list = document.getElementById('functionList');
    list.innerHTML = customFunctions.length === 0 ? 
      '<div class="empty-tip">暂无功能，点击下方按钮添加</div>' : '';

    customFunctions.forEach((func, index) => {
      const funcItem = document.createElement('div');
      funcItem.className = 'function-item';
      funcItem.innerHTML = `        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div class="function-name">${func.name}</div>
            <div class="function-prompt">${func.prompt}</div>
          </div>
          <div class="delete-function" data-index="${index}">删除</div>
        </div>
      `;
      funcItem.querySelector('.delete-function').onclick = () => deleteFunction(index);
      list.appendChild(funcItem);
    });
  });
}

function deleteFunction(index) {
    chrome.storage.local.get(['customFunctions'], ({ customFunctions }) => {
          console.log('删除功能:', index); // index 是功能项的 id
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
      chrome.storage.local.set({ customFunctions }, refreshFunctions);
    });
}

// 自定义功能管理
document.getElementById('addFunction').addEventListener('click', () => {
    const name = prompt('功能名称:');
    if (!name) return;

    const promptText = prompt('提示词模板:');
    if (!promptText) return;

    chrome.runtime.sendMessage({
        action: "addNewFunction",
        name,
        prompt: promptText
    }, () => {
        showNotification('功能添加成功');
        location.reload();
    });
});
  
// 监听存储变化
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && (changes.customFunctions || changes.apiConfigs)) {
    console.log('存储发生变化，重新加载配置');
    loadAndDisplayConfigs();
  }
});
  
