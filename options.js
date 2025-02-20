// 初始化
document.addEventListener('DOMContentLoaded', () => {
  console.log('=== 初始化开始 ===');
  bindEvents();
  loadConfigs();
  console.log('=== 初始化完成 ===');
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