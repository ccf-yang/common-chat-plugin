// 存储API配置和自定义功能
let apiConfigs = [];
let customFunctions = [];

// DOM元素
const apiConfigsList = document.getElementById('apiConfigs');
const customFunctionsList = document.getElementById('customFunctions');
const apiEmptyState = document.getElementById('api-empty-state');
const functionEmptyState = document.getElementById('function-empty-state');

// 模态框元素
const apiModal = document.getElementById('apiModal');
const functionModal = document.getElementById('functionModal');

// 菜单切换逻辑
document.querySelectorAll('.menu-item').forEach(item => {
  item.addEventListener('click', () => {
    // 移除所有活动状态
    document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    
    // 添加当前项的活动状态
    item.classList.add('active');
    const sectionId = item.getAttribute('data-section');
    document.getElementById(sectionId).classList.add('active');
  });
});

// 加载保存的配置
function loadConfigs() {
  chrome.storage.local.get(['apiConfigs', 'customFunctions'], function(result) {
    if (result.apiConfigs) {
      apiConfigs = result.apiConfigs;
      renderApiConfigs();
    }
    
    if (result.customFunctions) {
      customFunctions = result.customFunctions;
      renderCustomFunctions();
    }
  });
}

// 保存配置到Chrome存储
function saveConfigs() {
  chrome.storage.local.set({
    apiConfigs: apiConfigs,
    customFunctions: customFunctions
  }, () => {
    // 保存后立即发送消息通知其他页面
    chrome.runtime.sendMessage({
      type: 'configsUpdated',
      data: {
        apiConfigs: apiConfigs,
        customFunctions: customFunctions
      }
    });

    // 通知 background.js 更新上下文菜单
    chrome.runtime.sendMessage({
      type: 'UPDATE_CONTEXT_MENUS',
      force: true
    });
  });
}

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'configsUpdated') {
    // 重新加载配置
    loadConfigs();
  }
});

// API开关切换时的处理
function setupApiToggleListeners() {
  document.querySelectorAll('.api-toggle').forEach(toggle => {
    toggle.addEventListener('change', function() {
      const index = parseInt(this.getAttribute('data-index'));
      
      // 确保只有一个API被启用
      apiConfigs.forEach((config, i) => {
        if (i === index) {
          // 当前点击的API
          config.enabled = this.checked;
        } else {
          // 其他API都设置为禁用
          config.enabled = false;
          // 更新其他开关的UI状态
          const otherToggle = document.querySelector(`.api-toggle[data-index="${i}"]`);
          if (otherToggle) {
            otherToggle.checked = false;
          }
        }
      });
      
      // 保存配置并通知其他页面
      saveConfigs();
    });
  });
}

// 渲染API配置列表
function renderApiConfigs() {
  apiConfigsList.innerHTML = '';
  
  if (apiConfigs.length === 0) {
    apiEmptyState.style.display = 'flex';
  } else {
    apiEmptyState.style.display = 'none';
    
    // 添加表头
    const headerRow = document.createElement('div');
    headerRow.className = 'list-header';
    headerRow.innerHTML = `
      <div class="list-cell">名称</div>
      <div class="list-cell">URL</div>
      <div class="list-cell">API Key</div>
      <div class="list-cell">模型</div>
      <div class="list-cell">状态</div>
      <div class="list-cell actions">操作</div>
    `;
    apiConfigsList.appendChild(headerRow);
    
    apiConfigs.forEach((config, index) => {
      const configItem = document.createElement('div');
      configItem.className = 'list-row';
      configItem.innerHTML = `
        <div class="list-cell">${config.name}</div>
        <div class="list-cell">${config.url}</div>
        <div class="list-cell key-cell">
          <span class="masked-key">${maskApiKey(config.key)}</span>
          <button class="btn btn-icon show-key-btn" title="显示API Key">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          </button>
        </div>
        <div class="list-cell">${config.model || '-'}</div>
        <div class="list-cell">
          <label class="switch">
            <input type="checkbox" class="api-toggle" data-index="${index}" ${config.enabled ? 'checked' : ''}>
            <span class="slider round"></span>
          </label>
        </div>
        <div class="list-cell actions">
          <button class="btn btn-small btn-primary edit-api-btn" data-index="${index}">编辑</button>
          <button class="btn btn-small btn-danger delete-api-btn" data-index="${index}">删除</button>
        </div>
      `;
      
      apiConfigsList.appendChild(configItem);
    });
    
    // 添加API Key显示/隐藏功能
    document.querySelectorAll('.show-key-btn').forEach((btn, index) => {
      btn.addEventListener('click', function() {
        const keyCell = this.parentElement;
        const maskedKey = keyCell.querySelector('.masked-key');
        const isShowing = this.classList.contains('showing');
        
        if (isShowing) {
          maskedKey.textContent = maskApiKey(apiConfigs[index].key);
          this.classList.remove('showing');
          this.title = '显示API Key';
        } else {
          maskedKey.textContent = apiConfigs[index].key;
          this.classList.add('showing');
          this.title = '隐藏API Key';
        }
      });
    });
    
    // 在渲染完成后设置事件监听器
    setupApiToggleListeners();
    
    // 添加编辑和删除事件监听器
    document.querySelectorAll('.edit-api-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const index = parseInt(this.getAttribute('data-index'));
        editApiConfig(index);
      });
    });
    
    document.querySelectorAll('.delete-api-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const index = parseInt(this.getAttribute('data-index'));
        deleteApiConfig(index);
      });
    });
  }
}

// 遮蔽API Key的辅助函数
function maskApiKey(key) {
  if (!key) return '-';
  if (key.length <= 8) return '********';
  return key.substring(0, 4) + '*'.repeat(key.length - 8) + key.substring(key.length - 4);
}

// 渲染自定义功能列表
function renderCustomFunctions() {
  customFunctionsList.innerHTML = '';
  
  if (customFunctions.length === 0) {
    functionEmptyState.style.display = 'flex';
  } else {
    functionEmptyState.style.display = 'none';
    
    // 添加表头
    const headerRow = document.createElement('div');
    headerRow.className = 'list-header';
    headerRow.innerHTML = `
      <div class="list-cell">功能名称</div>
      <div class="list-cell">提示词</div>
      <div class="list-cell actions">操作</div>
    `;
    customFunctionsList.appendChild(headerRow);
    
    customFunctions.forEach((func, index) => {
      const funcItem = document.createElement('div');
      funcItem.className = 'list-row';
      funcItem.innerHTML = `
        <div class="list-cell">${func.name}</div>
        <div class="list-cell prompt-cell" title="${func.prompt}">
          ${func.prompt.length > 50 ? func.prompt.substring(0, 50) + '...' : func.prompt}
        </div>
        <div class="list-cell actions">
          <button class="btn btn-small btn-primary edit-function-btn" data-index="${index}">编辑</button>
          <button class="btn btn-small btn-danger delete-function-btn" data-index="${index}">删除</button>
        </div>
      `;
      
      customFunctionsList.appendChild(funcItem);
    });
    
    // 添加编辑和删除事件监听器
    document.querySelectorAll('.edit-function-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const index = parseInt(this.getAttribute('data-index'));
        editCustomFunction(index);
      });
    });
    
    document.querySelectorAll('.delete-function-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const index = parseInt(this.getAttribute('data-index'));
        deleteCustomFunction(index);
      });
    });
  }
}

// 添加API配置
document.getElementById('addApiConfig').addEventListener('click', function() {
  document.getElementById('apiModalTitle').textContent = '新增 API 配置';
  document.getElementById('configName').value = '';
  document.getElementById('apiUrl').value = '';
  document.getElementById('apiKey').value = '';
  document.getElementById('apiModel').value = '';
  
  // 显示模态框
  apiModal.classList.add('active');
});

// 关闭API模态框
document.getElementById('closeApiModal').addEventListener('click', function() {
  apiModal.classList.remove('active');
});

document.getElementById('cancelApiBtn').addEventListener('click', function() {
  apiModal.classList.remove('active');
});

// 保存API配置
document.getElementById('saveApiConfigBtn').addEventListener('click', function() {
  const name = document.getElementById('configName').value.trim();
  const url = document.getElementById('apiUrl').value.trim();
  const key = document.getElementById('apiKey').value.trim();
  const model = document.getElementById('apiModel').value.trim();
  
  if (!name || !url || !key) {
    alert('请填写必要的字段');
    return;
  }
  
  const editIndex = this.getAttribute('data-edit-index');
  
  if (editIndex !== null) {
    // 编辑现有配置，保持原有的enabled状态
    const enabled = apiConfigs[editIndex].enabled;
    apiConfigs[editIndex] = { name, url, key, model, enabled };
    this.removeAttribute('data-edit-index');
  } else {
    // 添加新配置，默认禁用
    // 如果没有其他API配置，则设置为启用
    const isFirstApi = apiConfigs.length === 0;
    apiConfigs.push({ 
      name, 
      url, 
      key, 
      model, 
      enabled: isFirstApi // 只有第一个API默认启用
    });
  }
  
  saveConfigs();
  renderApiConfigs();
  apiModal.classList.remove('active');
});

// 编辑API配置
function editApiConfig(index) {
  const config = apiConfigs[index];
  
  document.getElementById('apiModalTitle').textContent = '编辑 API 配置';
  document.getElementById('configName').value = config.name;
  document.getElementById('apiUrl').value = config.url;
  document.getElementById('apiKey').value = config.key;
  document.getElementById('apiModel').value = config.model || '';
  
  document.getElementById('saveApiConfigBtn').setAttribute('data-edit-index', index);
  
  apiModal.classList.add('active');
}

// 删除API配置
function deleteApiConfig(index) {
  if (confirm('确定要删除这个API配置吗？')) {
    apiConfigs.splice(index, 1);
    saveConfigs();
    renderApiConfigs();
  }
}

// 添加自定义功能
document.getElementById('addFunctionBtn').addEventListener('click', function() {
  document.getElementById('functionModalTitle').textContent = '新增自定义功能';
  document.getElementById('functionName').value = '';
  document.getElementById('functionPrompt').value = '';
  
  functionModal.classList.add('active');
});

// 关闭功能模态框
document.getElementById('closeFunctionModal').addEventListener('click', function() {
  functionModal.classList.remove('active');
});

document.getElementById('cancelFunctionBtn').addEventListener('click', function() {
  functionModal.classList.remove('active');
});

// 保存自定义功能
document.getElementById('saveFunctionBtn').addEventListener('click', function() {
  const name = document.getElementById('functionName').value.trim();
  const prompt = document.getElementById('functionPrompt').value.trim();
  
  if (!name || !prompt) {
    alert('请填写必要的字段');
    return;
  }
  
  const editIndex = this.getAttribute('data-edit-index');
  
  if (editIndex !== null) {
    // 编辑现有功能，保持原有的id
    const originalId = customFunctions[editIndex].id;
    customFunctions[editIndex] = { 
      id: originalId, // 保持原有id
      name, 
      prompt 
    };
    this.removeAttribute('data-edit-index');
  } else {
    // 添加新功能，生成新的id
    customFunctions.push({ 
      id: `func_${Date.now()}`, // 使用时间戳生成唯一id
      name, 
      prompt 
    });
  }
  
  saveConfigs(); // 这里会触发上下文菜单更新
  renderCustomFunctions();
  functionModal.classList.remove('active');
});

// 编辑自定义功能
function editCustomFunction(index) {
  const func = customFunctions[index];
  
  document.getElementById('functionModalTitle').textContent = '编辑自定义功能';
  document.getElementById('functionName').value = func.name;
  document.getElementById('functionPrompt').value = func.prompt;
  
  document.getElementById('saveFunctionBtn').setAttribute('data-edit-index', index);
  
  functionModal.classList.add('active');
}

// 删除自定义功能
function deleteCustomFunction(index) {
  if (confirm('确定要删除这个自定义功能吗？')) {
    customFunctions.splice(index, 1);
    saveConfigs(); // 这里会触发上下文菜单更新
    renderCustomFunctions();
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', function() {
  loadConfigs();
}); 