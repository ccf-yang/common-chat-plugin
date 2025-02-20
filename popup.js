// popup.js

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  console.log('=== 初始化开始 ===');
  bindEvents();
  loadConfigs();
  console.log('=== 初始化完成 ===');
  document.getElementById('openOptions').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
});

// 绑定事件
function bindEvents() {
  console.log('开始绑定事件');
  
  // 获取所有需要的元素
  const elements = {
    addApiConfig: document.getElementById('addApiConfig'),
    saveApiConfigBtn: document.getElementById('saveApiConfigBtn'),
    addFunctionBtn: document.getElementById('addFunctionBtn'),
    saveFunctionBtn: document.getElementById('saveFunctionBtn'),
    apiForm: document.getElementById('apiForm'),
    functionForm: document.getElementById('functionForm')
  };

  // 检查并打印元素状态
  Object.entries(elements).forEach(([name, element]) => {
    console.log(`${name} 元素:`, element);
  });

  // API配置相关按钮
  if (elements.addApiConfig) {
    elements.addApiConfig.addEventListener('click', () => {
      console.log('点击新增API配置按钮');
      elements.apiForm.style.display = 'block';
    });
  } else {
    console.error('未找到 addApiConfig 按钮');
  }

  if (elements.saveApiConfigBtn) {
    elements.saveApiConfigBtn.addEventListener('click', saveApiConfig);
  } else {
    console.error('未找到 saveApiConfigBtn 按钮');
  }

  // 功能相关按钮
  if (elements.addFunctionBtn) {
    elements.addFunctionBtn.addEventListener('click', () => {
      console.log('点击新增功能按钮');
      elements.functionForm.style.display = 'block';
    });
  } else {
    console.error('未找到 addFunctionBtn 按钮');
  }

  if (elements.saveFunctionBtn) {
    elements.saveFunctionBtn.addEventListener('click', saveFunction);
  } else {
    console.error('未找到 saveFunctionBtn 按钮');
  }

  console.log('事件绑定完成');
}

// 加载配置
async function loadConfigs() {
  console.log('开始加载配置');
  try {
    // 分别获取API配置和功能配置
    const { apiConfigs = [] } = await chrome.storage.local.get(['apiConfigs']);
    const { customFunctions = [] } = await chrome.storage.local.get(['customFunctions']);
    
    refreshApiConfigs(apiConfigs);
    refreshFunctions(customFunctions);
  } catch (error) {
    console.error('加载配置失败:', error);
  }
}

// 保存API配置
async function saveApiConfig() {
  console.log('开始保存API配置');
  try {
    const newConfig = {
      id: `api_${Date.now()}`,
      name: document.getElementById('configName').value.trim(),
      url: document.getElementById('apiUrl').value.trim(),
      key: document.getElementById('apiKey').value.trim(),
      model: document.getElementById('apiModel').value.trim(),
      enabled: false
    };

    // 验证输入
    for (const [key, value] of Object.entries(newConfig)) {
      if (!value && key !== 'enabled') {
        throw new Error(`${key} 不能为空`);
      }
    }

    // 获取现有API配置并添加新配置
    const { apiConfigs = [] } = await chrome.storage.local.get(['apiConfigs']);
    apiConfigs.push(newConfig);

    // 仅更新API配置
    await chrome.storage.local.set({ apiConfigs });
    console.log('API配置保存成功');

    document.getElementById('apiForm').style.display = 'none';
    clearApiForm();
    refreshApiConfigs(apiConfigs);
  } catch (error) {
    console.error('保存API配置失败:', error);
    alert(`保存失败: ${error.message}`);
  }
}

// 保存功能配置
async function saveFunction() {
  console.log('开始保存功能配置');
  try {
    const newFunction = {
      id: `func_${Date.now()}`,
      name: document.getElementById('functionName').value.trim(),
      prompt: document.getElementById('functionPrompt').value.trim()
    };

    // 验证输入
    for (const [key, value] of Object.entries(newFunction)) {
      if (!value) {
        throw new Error(`${key} 不能为空`);
      }
    }

    // 获取现有功能配置并添加新功能
    const { customFunctions = [] } = await chrome.storage.local.get(['customFunctions']);
    customFunctions.push(newFunction);

    // 仅更新功能配置
    await chrome.storage.local.set({ customFunctions });
    console.log('功能配置保存成功');

    document.getElementById('functionForm').style.display = 'none';
    clearFunctionForm();
    refreshFunctions(customFunctions);
  } catch (error) {
    console.error('保存功能配置失败:', error);
    alert(`保存失败: ${error.message}`);
  }
}

// 刷新API配置列表
function refreshApiConfigs(apiConfigs = []) {
  console.log('刷新API配置列表');
  const container = document.getElementById('apiConfigs');
  container.innerHTML = '';

  apiConfigs.forEach((config) => {
    const item = document.createElement('div');
    item.className = 'config-item';
    item.innerHTML = `
      <div>
        <strong>${config.name}</strong>
        <input type="checkbox" ${config.enabled ? 'checked' : ''}>
      </div>
      <button class="delete-btn">删除</button>
    `;

    // 绑定启用/禁用事件
    const checkbox = item.querySelector('input');
    checkbox.addEventListener('change', () => toggleApiConfig(config.id));

    // 绑定删除事件
    const deleteBtn = item.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', () => deleteApiConfig(config.id));

    container.appendChild(item);
  });
}

// 刷新功能列表
function refreshFunctions(functions = []) {
  console.log('刷新功能列表');
  const container = document.getElementById('customFunctions');
  container.innerHTML = '';

  functions.forEach((func) => {
    const item = document.createElement('div');
    item.className = 'function-item';
    item.innerHTML = `
      <div>
        <strong>${func.name}</strong>
        <small>${func.prompt}</small>
      </div>
      <button class="delete-btn">删除</button>
    `;

    // 绑定删除事件
    const deleteBtn = item.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', () => deleteFunction(func.id));

    container.appendChild(item);
  });
}

// 切换API配置启用状态
async function toggleApiConfig(configId) {
  console.log('切换API配置状态:', configId);
  try {
    const { apiConfigs = [] } = await chrome.storage.local.get(['apiConfigs']);
    
    const updatedConfigs = apiConfigs.map(item => ({
      ...item,
      enabled: item.id === configId ? !item.enabled : false
    }));

    await chrome.storage.local.set({ apiConfigs: updatedConfigs });
    refreshApiConfigs(updatedConfigs);
  } catch (error) {
    console.error('切换API配置状态失败:', error);
  }
}

// 删除API配置
async function deleteApiConfig(configId) {
  console.log('删除API配置:', configId);
  try {
    const { apiConfigs = [] } = await chrome.storage.local.get(['apiConfigs']);
    const updatedConfigs = apiConfigs.filter(item => item.id !== configId);
    await chrome.storage.local.set({ apiConfigs: updatedConfigs });
    refreshApiConfigs(updatedConfigs);
  } catch (error) {
    console.error('删除API配置失败:', error);
  }
}

// 删除功能
async function deleteFunction(functionId) {
  console.log('删除功能:', functionId);
  try {
    const { customFunctions = [] } = await chrome.storage.local.get(['customFunctions']);
    const updatedFunctions = customFunctions.filter(item => item.id !== functionId);
    await chrome.storage.local.set({ customFunctions: updatedFunctions });
    refreshFunctions(updatedFunctions);
  } catch (error) {
    console.error('删除功能失败:', error);
  }
}

// 清空API配置表单
function clearApiForm() {
  document.getElementById('configName').value = '';
  document.getElementById('apiUrl').value = '';
  document.getElementById('apiKey').value = '';
  document.getElementById('apiModel').value = '';
}

// 清空功能表单
function clearFunctionForm() {
  document.getElementById('functionName').value = '';
  document.getElementById('functionPrompt').value = '';
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
      funcItem.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
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
  if (confirm('确定要删除此功能吗？')) {
    chrome.storage.local.get(['customFunctions'], ({ customFunctions }) => {
      customFunctions.splice(index, 1);
      chrome.storage.local.set({ customFunctions }, refreshFunctions);
    });
  }
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
  