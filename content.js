console.log("Content script loaded");

// 创建悬浮窗口
const floatingWindow = createFloatingWindow();
let controller = null; // 用于存储AbortController实例
let cachedSelection = { text: '', range: null }; // 用于存储选中文字内容和区域

// 监听来自background的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PROCESS_REQUEST') {
    processApiRequest(message.data);
  } else if (message.type === 'SHOW_ERROR') {
    showError(message.message);
  }
});

// 以下是新增选中文字，弹出功能菜单---------------------------
// 创建功能图标
function createPluginIcon() {
  const container = document.createElement('div');
  container.id = 'ai-plugin-container';
  container.style.cssText = `
    position: fixed;
    display: flex;
    align-items: center;
    gap: 8px;
    z-index: 2147483647;
    display: none;
    padding: 4px;
    background: rgba(234, 236, 245, 0.95);
    border-radius: 16px;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  `;

  // 创建图标
  const icon = document.createElement('div');
  icon.id = 'ai-plugin-icon';
  icon.style.cssText = `
    width: 28px;
    height: 28px;
    background: url('${chrome.runtime.getURL('icon48.png')}') center/16px no-repeat;
    cursor: pointer;
    border-radius: 50%;
    background-color: #7F95E1;
    background-image: 
      url('${chrome.runtime.getURL('icon48.png')}'),
      linear-gradient(135deg, #7F95E1 0%, #B8B3E9 100%);
    border: 0.5px solid rgba(255, 255, 255, 0.3);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    box-shadow: 0 2px 6px rgba(127, 149, 225, 0.2);
    transition: transform 0.2s ease;
    z-index: 2147483647;
    &:hover {
      transform: scale(1.05);
    }
  `;

  // 创建功能按钮
  const button = document.createElement('button');
  button.id = 'ai-plugin-button';
  button.textContent = '功能';
  button.style.cssText = `
    width: 52px;
    height: 28px;
    background: linear-gradient(135deg, #7F95E1 0%, #B8B3E9 100%);
    color: white;
    border: 0.5px solid rgba(255, 255, 255, 0.3);
    border-radius: 14px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    box-shadow: 0 2px 6px rgba(127, 149, 225, 0.2);
    transition: transform 0.2s ease;
    white-space: nowrap;
    z-index: 2147483647;
    &:hover {
      transform: scale(1.05);
    }
  `;

  // 创建功能菜单
  const menu = document.createElement('div');
  menu.id = 'ai-plugin-menu';
  menu.style.cssText = `
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    background: rgba(234, 236, 245, 0.95);
    border: 0.5px solid rgba(127, 149, 225, 0.2);
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(127, 149, 225, 0.15);
    padding: 8px 0;
    display: none;
    flex-direction: column;
    min-width: 120px;
    z-index: 2147483647;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  `;

  // 动态获取功能列表
  chrome.storage.local.get(['customFunctions'], (result) => {
    const functions = result.customFunctions || [];
    
    functions.forEach(func => {
      const item = document.createElement('div');
      item.textContent = func.name;
      item.style.cssText = `
        padding: 8px 16px;
        cursor: pointer;
        border-radius: 4px;
        transition: all 0.2s;
        font-size: 13px;
        color: #374151;
      `;
      item.addEventListener('mouseenter', () => {
        item.style.backgroundColor = '#f3f4f6';
      });
      item.addEventListener('mouseleave', () => {
        item.style.backgroundColor = 'transparent';
      });
      item.addEventListener('click', async (e) => {
        if (!cachedSelection.text) {
          showError('请先选择要处理的文本');
          return;
        }
        // 获取API配置和自定义功能
        const { apiConfigs = [] } = await chrome.storage.local.get(['apiConfigs']);
        
        // 查找启用的API配置
        const activeApi = apiConfigs.find(api => api.enabled);
        if (!activeApi) {
          showError('请先启用一个API配置');
          return;
        }

        // 直接调用processApiRequest
        processApiRequest({
          text: cachedSelection.text,
          prompt: func.prompt,
          api: activeApi
        });
      });
      menu.appendChild(item);
    });
  });

  // 添加点击事件显示菜单
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.style.display = 'flex';
  });

  // 点击其他地方关闭菜单
  document.addEventListener('click', (e) => {
    menu.style.display = 'none';
    console.log('点击其他地方关闭菜单选项');
    if (menu.style.display === 'none' && container.style.display === 'flex' && !container.contains(e.target) && window.getSelection().toString().trim() === '') {
      console.log('点击关闭提示窗口');
      container.style.display = 'none';
    }
  });

  // 组装元素
  container.appendChild(icon);
  container.appendChild(button);
  container.appendChild(menu);
  document.body.appendChild(container);

  return container;
}

// 初始化图标
const pluginIcon = createPluginIcon();

// 增强版选区缓存方法
function cacheSelection() {
  const sel = window.getSelection();
  // 只有新内容才能更新老内容，空不能更新原先选中的内容，这里重要，否则飞书文档逻辑处理不了
  if (sel.rangeCount > 0 && sel.toString().trim() !== '') {
    cachedSelection = {
      text: sel.toString().trim(),
      range: sel.getRangeAt(0).cloneRange() // 克隆选区对象
    };
    
  }
}

// 监听文本选择
document.addEventListener('mouseup', (e) => {
  const container = document.getElementById('ai-plugin-container');
  const menu = document.getElementById('ai-plugin-menu');
  
  // 如果点击在container内部，不做处理
  if (container && container.contains(e.target)) {
    return;
  }
  
  // 获取新的选区
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  
  if (selectedText) {
    // 有新选区时，更新缓存并显示container
    cachedSelection = {
      text: selectedText,
      range: selection.getRangeAt(0).cloneRange()
    };
    
    const rect = cachedSelection.range.getBoundingClientRect();
    if (container) {
      // 使用 pageX/pageY 或 clientX/clientY + scroll 来计算位置
      const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
      const scrollY = window.pageYOffset || document.documentElement.scrollTop;
      
      container.style.position = 'absolute'; // 改为absolute定位
      container.style.left = `${rect.right + scrollX + 5}px`;
      container.style.top = `${rect.top + scrollY}px`;
      container.style.display = 'flex';
      
      // 确保menu是隐藏的
      if (menu) {
        menu.style.display = 'none';
      }
    }
  } else {
    // 没有选区时，检查menu是否显示
    if (menu && menu.style.display === 'none' && container) {
      container.style.display = 'none';
    }
  }
});

//以上是新增选中文字弹出功能-----------------------


// 显示加载中
function showLoading() {
  floatingWindow.innerHTML = `
    <div class="title-bar">
      <div class="title">处理中...</div>
      <button class="close-btn">&times;</button>
    </div>
    <div class="button-container">
      <button class="stop-btn">停止</button>
    </div>
  `;
  floatingWindow.style.display = 'block';
  setupCloseButton();
  setupStopButton();
}

// 显示错误
function showError(message) {
  floatingWindow.innerHTML = `
    <div class="title-bar">
      <div class="title">错误</div>
      <button class="close-btn">&times;</button>
    </div>
    <div class="content">${message}</div>
    <div class="button-container">
      <button class="copy-btn">复制</button>
    </div>
  `;
  floatingWindow.style.display = 'block';
  setupCloseButton();
  setupCopyButton(message);
}

// 显示结果
function showResult(content, isComplete) {
  const safeContent = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
  
  // 自动滚动到底部
  const contentDiv = floatingWindow.querySelector('.content');
  if (contentDiv) {
    // 保存当前滚动位置
    const prevScrollTop = contentDiv.scrollTop;
    const prevScrollHeight = contentDiv.scrollHeight;
    // 更新内容
    contentDiv.innerHTML = safeContent;
    // 恢复滚动位置
    if (prevScrollTop + contentDiv.clientHeight < prevScrollHeight) {
      // 如果用户之前没有滚动到底部，保持原位置
      contentDiv.scrollTop = prevScrollTop + (contentDiv.scrollHeight - prevScrollHeight);
    } else {
      // 如果用户之前滚动到底部，自动滚动到最新内容
      contentDiv.scrollTop = contentDiv.scrollHeight;
    }
    if (isComplete) {
        floatingWindow.innerHTML = `
        <div class="title-bar">
          <div class="title">AI 响应</div>
          <div class="button-group">
            <button class="copy-btn">复制</button>
            <button class="close-btn">&times;</button>
          </div>
        </div>
        <div class="content">${safeContent}</div>
      `;
    }
  }else{
    floatingWindow.innerHTML = `
    <div class="title-bar">
      <div class="title">AI 响应</div>
      <div class="button-group">
        <button class="copy-btn">复制</button>
        <button class="stop-btn">停止</button>
        <button class="close-btn">&times;</button>
      </div>
    </div>
    <div class="content">${safeContent}</div>
  `;
  }
  
  floatingWindow.style.display = 'block';
  setupCloseButton();
  setupCopyButton(content);
  if (!isComplete) {
    setupStopButton();
  }
}

// 设置关闭按钮
function setupCloseButton() {
  const closeBtn = floatingWindow.querySelector('.close-btn');
  if (closeBtn) {
    closeBtn.onclick = () => {
      floatingWindow.style.display = 'none';
    };
  }
}

// 设置复制按钮
function setupCopyButton(content) {
  const copyBtn = floatingWindow.querySelector('.copy-btn');
  if (copyBtn) {
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(content);
        copyBtn.textContent = '已复制';
        setTimeout(() => {
          copyBtn.textContent = '复制';
        }, 1500);
      } catch (error) {
        showError('复制失败');
      }
    };
  }
}

// 设置停止按钮
function setupStopButton() {
  const stopBtn = floatingWindow.querySelector('.stop-btn');
  if (stopBtn) {
    stopBtn.onclick = () => {
      if (controller) {
        controller.abort();
      }
    };
  }
}



// 处理API请求
async function processApiRequest(data) {
  try {
    const { text, prompt, api } = data;
    console.log(text, prompt, api);
    
    // 显示加载状态
    showLoading(true);

    // 创建AbortController
    controller = new AbortController();

    // 创建请求参数（强制使用流式）
    const requestBody = {
      model: api.model,
      messages: [
        {
          role: 'system',
          content: prompt
        },
        {
          role: 'user',
          content: text
        }
      ],
      stream: true  // 强制启用流式响应
    };

    // 发送请求
    const response = await fetch(api.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${api.key}`
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    // 处理流式响应
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let result = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // 解码并处理数据
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim() !== '');
      
      lines.forEach(line => {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6);
          if (jsonStr === '[DONE]') return;
          
          try {
            const data = JSON.parse(jsonStr);
            const content = data.choices[0]?.delta?.content || '';
            result += content;
            
            // 更新悬浮窗口内容
            showResult(result, false);
          } catch (error) {
            console.error('解析JSON失败:', error);
          }
        }
      });
    }

    // 处理完成
    showResult(result, true);
  } catch (error) {
    if (error.name !== 'AbortError') {
      showError(error.message);
    }
  } finally {
    controller = null;
  }
}

// 创建悬浮窗口
function createFloatingWindow() {
  const div = document.createElement('div');
  div.id = 'ai-chat-floating-window';
  div.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 500px;
    height: 500px;
    background: rgba(244, 245, 250, 0.98);
    border-radius: 12px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
    z-index: 2147483646;
    font-family: Arial, sans-serif;
    display: none;
    overflow: hidden;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 0.5px solid rgba(127, 149, 225, 0.2);
  `;

  // 添加拖动功能
  let isDragging = false;
  let offsetX, offsetY;

  div.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('title-bar')) {
      isDragging = true;
      offsetX = e.clientX - div.offsetLeft;
      offsetY = e.clientY - div.offsetTop;
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      div.style.left = `${e.clientX - offsetX}px`;
      div.style.top = `${e.clientY - offsetY}px`;
      div.style.transform = 'none'; // 移除初始的居中transform
    }
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
  });
  
  // 添加样式
  const style = document.createElement('style');
  style.textContent = `
    .title-bar {
      padding: 12px 16px;
      background: rgba(234, 236, 245, 0.95);
      border-bottom: 0.5px solid rgba(127, 149, 225, 0.2);
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 1;
    }
    .title {
      font-weight: bold;
    }
    .content {
      padding: 16px;
      height: calc(85%); /* 减去标题栏和按钮区域高度 */
      overflow-y: auto;
      scroll-behavior: smooth; /* 平滑滚动 */
    }
    .button-container {
      padding: 12px 16px;
      background: #f5f5f5;
      border-top: 1px solid #eee;
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      position: sticky;
      bottom: 0;
      z-index: 1;
    }
    button {
      padding: 6px 12px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }
    .close-btn {
      background: none;
      font-size: 30px;
      padding: 0 4px;
      color: #666;
    }
    .copy-btn {
      background: #4CAF50;
      color: white;
    }
    .stop-btn {
      background: #f44336;
      color: white;
    }
    button:hover {
      opacity: 0.9;
    }
    .button-group {
      display: flex;
      gap: 8px;
      align-items: center;
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(div);
  return div;
}