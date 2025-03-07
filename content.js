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

  // 创建聊天按钮
  const chatButton = document.createElement('button');
  chatButton.id = 'ai-plugin-chat';
  chatButton.textContent = '对话';
  chatButton.style.cssText = `
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

  // 添加聊天按钮点击事件
  chatButton.addEventListener('click', (e) => {
    e.stopPropagation();
    if (cachedSelection.text) {
      createChatWindow(cachedSelection.text);
    }
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
  container.appendChild(chatButton);
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
    // 有新选区时，更新缓存
    cachedSelection = {
      text: selectedText,
      range: selection.getRangeAt(0).cloneRange()
    };
    
    // 获取选区位置 - 增强版
    let rect;
    
    try {
      // 尝试获取选区的边界矩形
      rect = cachedSelection.range.getBoundingClientRect();
      
      // 检查是否获取到有效的矩形（有些情况下可能是空矩形）
      if (rect.width === 0 && rect.height === 0) {
        throw new Error('Invalid selection rectangle');
      }
    } catch (error) {
      console.log('无法获取选区位置，使用鼠标位置', error);
      // 如果无法获取选区位置，使用鼠标位置
      rect = {
        right: e.clientX,
        top: e.clientY
      };
    }
    
    // 定位容器
    if (container) {
      // 使用 pageX/pageY 或 clientX/clientY + scroll 来计算位置
      const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
      const scrollY = window.pageYOffset || document.documentElement.scrollTop;
      
      // 确保位置在视口内
      const viewportWidth = window.innerWidth;
      const containerWidth = 150; // 估计的容器宽度
      
      // 计算左侧位置，确保不超出右边界
      let leftPos = rect.right + scrollX + 5;
      if (leftPos + containerWidth > viewportWidth + scrollX) {
        leftPos = viewportWidth + scrollX - containerWidth - 5;
      }
      
      container.style.position = 'absolute';
      container.style.left = `${leftPos}px`;
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
      <div class="button-group">
        <button class="stop-btn">停止</button>
        <button class="close-btn">&times;</button>
      </div>
    </div>
    <div class="content">
      <div class="loading-indicator">
        <div class="loading-spinner"></div>
        <div class="loading-text">AI 正在思考中...</div>
      </div>
    </div>
  `;
  
  // 添加加载动画样式
  const style = document.createElement('style');
  if (!document.getElementById('loading-animation-style')) {
    style.id = 'loading-animation-style';
    style.textContent = `
      .loading-indicator {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: #7F95E1;
      }
      .loading-spinner {
        width: 40px;
        height: 40px;
        border: 3px solid rgba(127, 149, 225, 0.2);
        border-radius: 50%;
        border-top-color: #7F95E1;
        animation: spin 1s ease-in-out infinite;
        margin-bottom: 16px;
      }
      .loading-text {
        font-size: 14px;
        color: #666;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }
  
  floatingWindow.style.display = 'block';
  setupCloseButton();
  setupStopButton();
}

// 显示错误
function showError(message) {
  floatingWindow.innerHTML = `
    <div class="title-bar">
      <div class="title">错误</div>
      <div class="button-group">
        <button class="copy-btn">复制</button>
        <button class="close-btn">&times;</button>
      </div>
    </div>
    <div class="content">${message}</div>
  `;
  floatingWindow.style.display = 'block';
  setupCloseButton();
  setupCopyButton(message);
}

// 显示结果
function showResult(content, isComplete) {
  // 将Markdown转换为HTML
  const markdownToHtml = (text) => {
    try {
      // 使用marked库解析markdown
      return marked.parse(text);
    } catch (error) {
      console.error('Markdown解析错误:', error);
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
    }
  };
  
  // 检查浮动窗口是否已经存在
  if (!floatingWindow.querySelector('.title-bar')) {
    // 首次创建完整的窗口结构
    floatingWindow.innerHTML = `
      <div class="title-bar">
        <div class="title">AI 响应</div>
        <div class="button-group">
          <button class="copy-btn">复制</button>
          ${!isComplete ? '<button class="stop-btn">停止</button>' : ''}
          <button class="close-btn">×</button>
        </div>
      </div>
      <div class="content"></div>
    `;
    
    // 设置按钮事件处理
    setupCloseButton();
    setupCopyButton(content);
    if (!isComplete) {
      setupStopButton();
    }
  } else {
    // 窗口已存在，只更新必要的部分
    
    // 更新复制按钮内容 - 确保复制按钮存在
    const buttonGroup = floatingWindow.querySelector('.button-group');
    let copyBtn = buttonGroup.querySelector('.copy-btn');
    
    if (!copyBtn) {
      // 如果复制按钮不存在，创建它
      copyBtn = document.createElement('button');
      copyBtn.className = 'copy-btn';
      copyBtn.textContent = '复制';
      buttonGroup.insertBefore(copyBtn, buttonGroup.firstChild);
    }
    
    // 更新复制按钮事件
    setupCopyButton(content);
    
    // 更新停止按钮状态
    const stopBtn = buttonGroup.querySelector('.stop-btn');
    
    if (isComplete && stopBtn) {
      // 如果生成完成且停止按钮存在，则移除它
      stopBtn.remove();
    } else if (!isComplete && !stopBtn) {
      // 如果未完成且停止按钮不存在，则添加它
      const newStopBtn = document.createElement('button');
      newStopBtn.className = 'stop-btn';
      newStopBtn.textContent = '停止';
      // 在复制按钮之后，关闭按钮之前插入
      buttonGroup.insertBefore(newStopBtn, copyBtn.nextSibling);
      setupStopButton();
    }
  }
  
  // 更新内容区域 - 只更新内容，不重建整个结构
  const contentDiv = floatingWindow.querySelector('.content');
  if (contentDiv) {
    // 判断用户是否已经滚动到接近底部
    const shouldScrollToBottom = (contentDiv.scrollHeight - contentDiv.scrollTop - contentDiv.clientHeight) < 30;
    
    // 更新内容 - 使用Markdown渲染
    const htmlContent = markdownToHtml(content);
    contentDiv.innerHTML = htmlContent;
    
    // 为代码块添加样式
    const codeBlocks = contentDiv.querySelectorAll('pre code');
    if (codeBlocks.length > 0) {
      codeBlocks.forEach(block => {
        block.style.display = 'block';
        block.style.padding = '1em';
        block.style.backgroundColor = '#f5f5f5';
        block.style.borderRadius = '4px';
        block.style.overflowX = 'auto';
        block.style.fontFamily = 'monospace';
      });
    }
    
    // 根据用户滚动位置决定是否自动滚动到底部
    if (shouldScrollToBottom) {
      setTimeout(() => {
        contentDiv.scrollTop = contentDiv.scrollHeight;
      }, 0);
    }
  }
  
  floatingWindow.style.display = 'block';
}

// 设置停止按钮
function setupStopButton() {
  const stopBtn = floatingWindow.querySelector('.stop-btn');
  if (stopBtn) {
    // 移除旧的事件监听器，防止重复绑定
    const oldStopBtn = stopBtn.cloneNode(true);
    stopBtn.parentNode.replaceChild(oldStopBtn, stopBtn);
    
    // 绑定新的事件监听器
    oldStopBtn.addEventListener('click', () => {
      console.log('停止按钮被点击');
      if (controller) {
        controller.abort();
        console.log('请求已中断');
        
        // 更新UI状态
        const contentDiv = floatingWindow.querySelector('.content');
        if (contentDiv) {
          contentDiv.innerHTML += '<p><em>已停止生成</em></p>';
          
          // 滚动到底部
          setTimeout(() => {
            contentDiv.scrollTop = contentDiv.scrollHeight;
          }, 0);
        }
        
        // 移除停止按钮
        oldStopBtn.remove();
      }
    });
  }
}

// 设置复制按钮
function setupCopyButton(content) {
  const copyBtn = floatingWindow.querySelector('.copy-btn');
  if (copyBtn) {
    // 移除旧的事件监听器，防止重复绑定
    const oldCopyBtn = copyBtn.cloneNode(true);
    copyBtn.parentNode.replaceChild(oldCopyBtn, copyBtn);
    
    // 绑定新的事件监听器
    oldCopyBtn.addEventListener('click', async () => {
      try {
        // 使用更可靠的复制方法
        const textArea = document.createElement('textarea');
        textArea.value = content;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
          oldCopyBtn.textContent = '已复制';
          setTimeout(() => {
            oldCopyBtn.textContent = '复制';
          }, 1500);
        } else {
          // 如果execCommand失败，尝试使用Clipboard API
          await navigator.clipboard.writeText(content);
          oldCopyBtn.textContent = '已复制';
          setTimeout(() => {
            oldCopyBtn.textContent = '复制';
          }, 1500);
        }
      } catch (error) {
        console.error('复制失败:', error);
        showError('复制失败: ' + error.message);
      }
    });
  }
}

// 设置关闭按钮
function setupCloseButton() {
  const closeBtn = floatingWindow.querySelector('.close-btn');
  if (closeBtn) {
    // 移除旧的事件监听器，防止重复绑定
    const oldCloseBtn = closeBtn.cloneNode(true);
    closeBtn.parentNode.replaceChild(oldCloseBtn, closeBtn);
    
    // 绑定新的事件监听器
    oldCloseBtn.addEventListener('click', () => {
      floatingWindow.style.display = 'none';
      // 如果有正在进行的请求，中断它
      if (controller) {
        controller.abort();
        controller = null;
      }
    });
  }
}

// 处理API请求
async function processApiRequest(data) {
  try {
    const { text, prompt, api } = data;
    console.log(text, prompt, api);
    
    // 显示加载状态
    showLoading();

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

    // 检查响应状态
    if (!response.ok) {
      let errorMessage;
      try {
        // 尝试解析错误响应的JSON
        const errorData = await response.json();
        errorMessage = errorData.error?.message || errorData.message || `请求失败: ${response.status}, ${errorData.msg}` ||  `请求失败: ${response.status} ${response.statusText}`;
      } catch (e) {
        // 如果无法解析JSON，使用状态码信息
        errorMessage = `请求失败: ${response.status} ${response.statusText}`;
      }
            
      throw new Error(errorMessage);
    }

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
    if (error.name === 'AbortError') {
      console.log('请求被用户中断');
      // 不需要显示错误，因为已经在停止按钮处理中更新了UI
    } else {
      console.error('API请求错误:', error);
      showError(error.message || '请求失败');
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
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    display: none;
    overflow: hidden;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 0.5px solid rgba(127, 149, 225, 0.2);
    resize: both;
    min-width: 300px;
    min-height: 200px;
    max-width: 90vw;
    max-height: 90vh;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    font-feature-settings: "liga", "kern";
  `;

  // 添加拖动功能
  let isDragging = false;
  let offsetX, offsetY;
  let initialTransform = null;

  div.addEventListener('mousedown', (e) => {
    if (e.target.closest('.title-bar')) {
      isDragging = true;
      
      // 保存初始transform值
      initialTransform = div.style.transform;
      
      // 如果窗口还在初始居中状态，先转换为具体坐标
      if (div.style.transform.includes('translate')) {
        const rect = div.getBoundingClientRect();
        div.style.transform = 'none';
        div.style.top = `${rect.top}px`;
        div.style.left = `${rect.left}px`;
      }
      
      // 计算偏移量
      const rect = div.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      
      // 防止文本选择
      e.preventDefault();
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      div.style.left = `${e.clientX - offsetX}px`;
      div.style.top = `${e.clientY - offsetY}px`;
    }
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    initialTransform = null;
  });
  
  // 添加样式
  const style = document.createElement('style');
  style.textContent = `
    #ai-chat-floating-window * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    
    #ai-chat-floating-window .title-bar {
      padding: 5px 17px;
      background: rgba(234, 236, 245, 0.95);
      border-bottom: 0.5px solid rgba(127, 149, 225, 0.2);
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 1;
      cursor: move;
      user-select: none; /* 防止文本选择 */
      height: 40px;
    }
    
    #ai-chat-floating-window .title {
      font-weight: 600;
      font-size: 14px;
      color: #333;
    }
    
    #ai-chat-floating-window .content {
      padding: 16px;
      height: calc(100% - 40px); /* 减去标题栏高度 */
      overflow-y: auto;
      scroll-behavior: smooth; /* 平滑滚动 */
      font-size: 14px;
      line-height: 1.6;
      color: #333;
    }
    
    /* 修复列表样式 */
    #ai-chat-floating-window .content ul,
    #ai-chat-floating-window .content ol {
      padding-left: 24px;
      margin: 12px 0;
    }
    
    #ai-chat-floating-window .content li {
      margin-bottom: 6px;
    }
    
    #ai-chat-floating-window .content li > ul,
    #ai-chat-floating-window .content li > ol {
      margin: 6px 0;
    }
    
    /* 确保嵌套列表正确缩进 */
    #ai-chat-floating-window .content li > p {
      margin: 0;
    }
    
    #ai-chat-floating-window .content p {
      margin-bottom: 12px;
    }
    
    #ai-chat-floating-window .content h1,
    #ai-chat-floating-window .content h2,
    #ai-chat-floating-window .content h3,
    #ai-chat-floating-window .content h4,
    #ai-chat-floating-window .content h5,
    #ai-chat-floating-window .content h6 {
      margin-top: 20px;
      margin-bottom: 10px;
      font-weight: 600;
    }
    
    #ai-chat-floating-window .content code {
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      font-size: 13px;
      background-color: rgba(0, 0, 0, 0.05);
      padding: 2px 4px;
      border-radius: 3px;
    }
    
    #ai-chat-floating-window .content pre {
      margin: 12px 0;
    }
    
    #ai-chat-floating-window .content pre code {
      display: block;
      padding: 12px;
      background-color: #f5f5f5;
      border-radius: 4px;
      overflow-x: auto;
      line-height: 1.45;
    }
    
    #ai-chat-floating-window .content blockquote {
      border-left: 4px solid #ddd;
      padding-left: 16px;
      margin: 12px 0;
      color: #666;
    }
    
    #ai-chat-floating-window .content table {
      border-collapse: collapse;
      width: 100%;
      margin: 12px 0;
    }
    
    #ai-chat-floating-window .content table th,
    #ai-chat-floating-window .content table td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }
    
    #ai-chat-floating-window .content table th {
      background-color: #f5f5f5;
    }
    
    #ai-chat-floating-window button {
      padding: 6px 12px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s ease;
      font-weight: 500;
    }
    
    #ai-chat-floating-window .close-btn {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.5);
      color: #666;
      font-size: 18px;
      border-radius: 50%;
      padding: 0;
      border: 1px solid rgba(0, 0, 0, 0.05);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      line-height: 1;
      text-align: center;
    }
    
    #ai-chat-floating-window .close-btn:hover {
      background: rgba(255, 77, 79, 0.1);
      color: #ff4d4f;
      transform: scale(1.05);
    }
    
    #ai-chat-floating-window .copy-btn {
      background: rgba(127, 149, 225, 0.1);
      color: #7F95E1;
      padding: 6px 14px;
      border-radius: 6px;
      font-weight: 500;
      border: 1px solid rgba(127, 149, 225, 0.2);
    }
    
    #ai-chat-floating-window .copy-btn:hover {
      background: rgba(127, 149, 225, 0.2);
      transform: translateY(-1px);
      box-shadow: 0 2px 5px rgba(127, 149, 225, 0.2);
    }
    
    #ai-chat-floating-window .stop-btn {
      background: rgba(255, 77, 79, 0.1);
      color: #ff4d4f;
      padding: 6px 14px;
      border-radius: 6px;
      font-weight: 500;
      border: 1px solid rgba(255, 77, 79, 0.2);
    }
    
    #ai-chat-floating-window .stop-btn:hover {
      background: rgba(255, 77, 79, 0.2);
      transform: translateY(-1px);
      box-shadow: 0 2px 5px rgba(255, 77, 79, 0.2);
    }
    
    #ai-chat-floating-window .button-group {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    
    #ai-chat-floating-window::after {
      content: '';
      position: absolute;
      right: 0;
      bottom: 0;
      width: 15px;
      height: 15px;
      cursor: nwse-resize;
      background: linear-gradient(135deg, transparent 50%, rgba(127, 149, 225, 0.5) 50%);
      border-bottom-right-radius: 12px;
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(div);
  return div;
}


// 以下是聊天窗口的逻辑代码
// 创建聊天窗口
function createChatWindow(initialText) {
  const chatWindow = document.createElement('div');
  chatWindow.id = 'ai-chat-window';
  chatWindow.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 800px;
    height: 600px;
    background: rgba(244, 245, 250, 0.98);
    border-radius: 12px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
    z-index: 2147483647;
    overflow: hidden;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 0.5px solid rgba(127, 149, 225, 0.2);
    resize: both;
    min-width: 300px;
    min-height: 400px;
    max-width: 90vw;
    max-height: 90vh;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    font-feature-settings: "liga", "kern";
  `;

  chatWindow.innerHTML = `
    <div class="chat-header" style="
      padding: 5px 17px;
      background: rgba(234, 236, 245, 0.95);
      border-bottom: 0.5px solid rgba(127, 149, 225, 0.2);
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: move;
      user-select: none;
      height: 40px;
    ">
      <div class="chat-title" style="
        font-weight: 600;
        font-size: 14px;
        color: #333;
      ">AI 对话</div>
      <div class="chat-actions" style="
        display: flex;
        gap: 8px;
        align-items: center;
      ">
        <button class="stop-btn" style="
          background: rgba(255, 77, 79, 0.1);
          color: #ff4d4f;
          padding: 6px 14px;
          border-radius: 6px;
          font-weight: 500;
          border: 1px solid rgba(255, 77, 79, 0.2);
          cursor: pointer;
          display: none;
          transition: all 0.2s ease;
        ">停止</button>
        <button class="close-btn" style="
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.5);
          color: #666;
          font-size: 18px;
          border-radius: 50%;
          padding: 0;
          border: 1px solid rgba(0, 0, 0, 0.05);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
          line-height: 1;
          cursor: pointer;
          transition: all 0.2s ease;
        ">×</button>
      </div>
    </div>
    <div class="chat-messages" style="
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      scroll-behavior: smooth;
      font-size: 14px;
      line-height: 1.6;
      color: #333;
    "></div>
    <div class="chat-input-container" style="
      padding: 16px;
      border-top: 0.5px solid rgba(127, 149, 225, 0.2);
      display: flex;
      gap: 8px;
      background: rgba(234, 236, 245, 0.95);
    ">
      <div style="
        position: relative;
        flex: 1;
        display: flex;
      ">
        <textarea class="chat-input" style="
          width: 100%;
          padding: 8px 32px 8px 12px;
          border: 1px solid rgba(127, 149, 225, 0.2);
          border-radius: 8px;
          resize: none;
          height: 60px;
          font-size: 14px;
          line-height: 1.5;
          background: rgba(255, 255, 255, 0.9);
          color: #333;
        " placeholder="输入消息，按Enter发送..."></textarea>
        <button class="clear-input-btn" style="
          position: absolute;
          right: 8px;
          top: 8px;
          width: 16px;
          height: 16px;
          border: none;
          background: none;
          padding: 0;
          cursor: pointer;
          color: #999;
          font-size: 16px;
          line-height: 1;
          display: none;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        ">×</button>
      </div>
      <button class="send-btn" style="
        padding: 8px 16px;
        background: rgba(127, 149, 225, 0.1);
        color: #7F95E1;
        border-radius: 6px;
        font-weight: 500;
        border: 1px solid rgba(127, 149, 225, 0.2);
        cursor: pointer;
        height: 60px;
        transition: all 0.2s ease;
      ">发送</button>
    </div>
  `;

  // 添加样式
  const style = document.createElement('style');
  style.textContent += `
    #ai-chat-window .stop-btn:hover {
      background: rgba(255, 77, 79, 0.2);
      transform: translateY(-1px);
      box-shadow: 0 2px 5px rgba(255, 77, 79, 0.2);
    }
    
    #ai-chat-window .close-btn:hover {
      background: rgba(255, 77, 79, 0.1);
      color: #ff4d4f;
      transform: scale(1.05);
    }
    
    #ai-chat-window .send-btn:hover {
      background: rgba(127, 149, 225, 0.2);
      transform: translateY(-1px);
      box-shadow: 0 2px 5px rgba(127, 149, 225, 0.2);
    }
    
    #ai-chat-window::after {
      content: '';
      position: absolute;
      right: 0;
      bottom: 0;
      width: 15px;
      height: 15px;
      cursor: nwse-resize;
      background: linear-gradient(135deg, transparent 50%, rgba(127, 149, 225, 0.5) 50%);
      border-bottom-right-radius: 12px;
    }
    
    #ai-chat-window .clear-input-btn:hover {
      color: #ff4d4f;
      transform: scale(1.1);
    }
  `;
  document.head.appendChild(style);

  // 添加到页面
  document.body.appendChild(chatWindow);

  // 获取必要的元素
  const header = chatWindow.querySelector('.chat-header');
  const messagesContainer = chatWindow.querySelector('.chat-messages');
  const input = chatWindow.querySelector('.chat-input');
  const sendBtn = chatWindow.querySelector('.send-btn');
  const stopBtn = chatWindow.querySelector('.stop-btn');
  const closeBtn = chatWindow.querySelector('.close-btn');

  // 获取清空按钮
  const clearBtn = chatWindow.querySelector('.clear-input-btn');

  // 监听输入框内容变化
  input.addEventListener('input', () => {
    clearBtn.style.display = input.value.length > 0 ? 'flex' : 'none';
  });

  // 添加清空按钮点击事件
  clearBtn.addEventListener('click', () => {
    input.value = '';
    clearBtn.style.display = 'none';
    input.focus();
  });

  // 设置初始输入内容时显示清空按钮
  const initialPrompt = `请按需求处理以下中括号内的文字：[${initialText}],直接输出结果即可\n需求：`;
  input.value = initialPrompt;
  clearBtn.style.display = 'flex';

  // 添加拖动功能
  let isDragging = false;
  let offsetX, offsetY;
  let initialTransform = null;

  header.addEventListener('mousedown', (e) => {
    if (e.target.closest('.chat-header')) {
      isDragging = true;
      
      // 保存初始transform值
      initialTransform = chatWindow.style.transform;
      
      // 如果窗口还在初始居中状态，先转换为具体坐标
      if (chatWindow.style.transform.includes('translate')) {
        const rect = chatWindow.getBoundingClientRect();
        chatWindow.style.transform = 'none';
        chatWindow.style.top = `${rect.top}px`;
        chatWindow.style.left = `${rect.left}px`;
      }
      
      // 计算偏移量
      const rect = chatWindow.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      
      // 防止文本选择
      e.preventDefault();
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      chatWindow.style.left = `${e.clientX - offsetX}px`;
      chatWindow.style.top = `${e.clientY - offsetY}px`;
    }
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    initialTransform = null;
  });

  // 修改关闭按钮功能
  closeBtn.addEventListener('click', () => {
    document.body.removeChild(chatWindow);
  });

  // 初始化聊天上下文
  let chatContext = [];

  // 发送消息函数
  async function sendMessage() {
    const message = input.value.trim();
    if (!message) return;

    // 添加用户消息
    addMessage('user', message);
    input.value = '';

    // 更新上下文并保持最大长度为5轮对话
    chatContext.push({ role: 'user', content: message });
    if (chatContext.length > 10) { // 保持5轮对话（10条消息）
      chatContext = chatContext.slice(-10);
    }

    // 处理对话
    await processChat(chatContext, messagesContainer, stopBtn);
  }

  // 输入框事件处理
  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      await sendMessage();
    }
  });

  // 发送按钮点击事件
  sendBtn.addEventListener('click', sendMessage);

  // 添加停止按钮的点击事件处理
  stopBtn.addEventListener('click', () => {
    if (controller) {
      controller.abort(); // 中断当前请求
      stopBtn.style.display = 'none';
      
      // 添加"已停止"提示
      const stopMessage = document.createElement('div');
      stopMessage.style.cssText = `
        padding: 8px 12px;
        background: #fff2f0;
        color: #ff4d4f;
        border-radius: 4px;
        font-size: 12px;
        margin-top: 8px;
        text-align: center;
      `;
      stopMessage.textContent = '已停止生成';
      
      // 找到最后一个消息容器
      const lastMessage = messagesContainer.lastElementChild;
      if (lastMessage) {
        lastMessage.appendChild(stopMessage);
      }
      
      // 重置控制器
      controller = null;
    }
  });
}

// 添加 processChat 函数
async function processChat(context, messagesContainer, stopBtn) {
  try {
    // 获取API配置
    const { apiConfigs = [] } = await chrome.storage.local.get(['apiConfigs']);
    const activeApi = apiConfigs.find(api => api.enabled);
    
    if (!activeApi) {
      throw new Error('请先启用一个API配置');
    }

    // 显示停止按钮
    stopBtn.style.display = 'inline-block';

    // 创建回复消息容器
    const responseDiv = document.createElement('div');
    responseDiv.className = 'chat-message assistant';
    responseDiv.style.cssText = `
      padding: 12px;
      border-radius: 8px;
      max-width: 80%;
      align-self: flex-start;
      background: #f5f5f5;
    `;

    // 创建思考内容容器
    const reasoningDiv = document.createElement('div');
    reasoningDiv.className = 'reasoning-content';
    reasoningDiv.style.display = 'none';
    
    // 创建折叠按钮
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'toggle-reasoning-btn';
    toggleBtn.style.cssText = `
      font-size: 12px;
      padding: 4px 8px;
      margin-bottom: 8px;
      border: none;
      background: rgba(127, 149, 225, 0.1);
      color: #7F95E1;
      border-radius: 4px;
      cursor: pointer;
      display: none;
      transition: all 0.2s ease;
    `;
    toggleBtn.textContent = '显示思考过程';
    
    // 添加折叠按钮点击事件
    toggleBtn.addEventListener('click', () => {
      const isHidden = reasoningDiv.style.display === 'none';
      reasoningDiv.style.display = isHidden ? 'block' : 'none';
      toggleBtn.textContent = isHidden ? '隐藏思考过程' : '显示思考过程';
    });

    responseDiv.appendChild(toggleBtn);
    responseDiv.appendChild(reasoningDiv);
    messagesContainer.appendChild(responseDiv);

    // 创建回复内容容器
    const contentDiv = document.createElement('div');
    contentDiv.className = 'response-content';
    responseDiv.appendChild(contentDiv);

    // 添加自动滚动控制
    let isUserScrolling = false;
    let shouldAutoScroll = true;

    // 监听滚动事件
    const scrollHandler = () => {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
      // 判断是否处于底部
      const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 10;
      
      // 如果用户正在向上滚动，禁用自动滚动
      if (!isAtBottom && !isUserScrolling) {
        shouldAutoScroll = false;
      }
      
      // 如果滚动到底部，重新启用自动滚动
      if (isAtBottom) {
        shouldAutoScroll = true;
      }
    };

    // 监听用户滚动
    const wheelHandler = () => {
      isUserScrolling = true;
      clearTimeout(window.scrollTimeout);
      window.scrollTimeout = setTimeout(() => {
        isUserScrolling = false;
      }, 150);
    };

    messagesContainer.addEventListener('scroll', scrollHandler);
    messagesContainer.addEventListener('wheel', wheelHandler);

    // 自动滚动函数
    const scrollToBottom = () => {
      if (shouldAutoScroll && !isUserScrolling) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    };

    // 初始滚动到底部
    scrollToBottom();

    // 创建AbortController
    controller = new AbortController();

    // 创建请求
    const response = await fetch(activeApi.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activeApi.key}`
      },
      body: JSON.stringify({
        model: activeApi.model,
        messages: context,
        stream: true
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`请求失败: ${response.status} ${response.statusText}`);
    }

    // 处理流式响应
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let result = '';
    let reasoningContent = '';
    let hasReasoning = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim() !== '');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6);
          if (jsonStr === '[DONE]') continue;

          try {
            const data = JSON.parse(jsonStr);
            const content = data.choices[0]?.delta?.content || '';
            const reasoning = data.choices[0]?.delta?.reasoning_content || '';

            if (reasoning) {
              hasReasoning = true;
              reasoningContent += reasoning;
              toggleBtn.style.display = 'inline-block';
              reasoningDiv.innerHTML = marked.parse(reasoningContent);
            }

            if (content) {
              result += content;
              contentDiv.innerHTML = marked.parse(result);
            }

            scrollToBottom();
          } catch (error) {
            console.error('解析响应失败:', error);
          }
        }
      }
    }

    // 清理事件监听器
    messagesContainer.removeEventListener('scroll', scrollHandler);
    messagesContainer.removeEventListener('wheel', wheelHandler);

    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
      .reasoning-content {
        margin: 8px 0;
        padding: 8px 12px;
        background: rgba(127, 149, 225, 0.05);
        border-radius: 4px;
        font-size: 13px;
        color: #666;
      }

      .toggle-reasoning-btn:hover {
        background: rgba(127, 149, 225, 0.2);
        transform: translateY(-1px);
      }
    `;
    document.head.appendChild(style);

    // 添加复制按钮
    const copyButton = document.createElement('button');
    copyButton.className = 'copy-btn';
    copyButton.innerHTML = '复制';
    copyButton.style.cssText = `
      float: right;
      padding: 2px 6px;
      margin-left: 8px;
      border: none;
      border-radius: 4px;
      background: rgba(0, 0, 0, 0.1);
      cursor: pointer;
      font-size: 12px;
      opacity: 0;
      transition: opacity 0.2s;
    `;
    responseDiv.appendChild(copyButton);

    // 复制按钮事件
    responseDiv.addEventListener('mouseenter', () => {
      copyButton.style.opacity = '1';
    });
    responseDiv.addEventListener('mouseleave', () => {
      copyButton.style.opacity = '0';
    });
    copyButton.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(result);
        copyButton.innerHTML = '已复制';
        setTimeout(() => {
          copyButton.innerHTML = '复制';
        }, 1500);
      } catch (err) {
        console.error('复制失败:', err);
      }
    });

    // 更新上下文
    context.push({ role: 'assistant', content: result });

  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('聊天被中断');
    } else {
      console.error('聊天错误:', error);
      const errorDiv = document.createElement('div');
      errorDiv.className = 'chat-message error';
      errorDiv.style.cssText = `
        padding: 12px;
        border-radius: 8px;
        max-width: 80%;
        align-self: flex-start;
        background: #fff2f0;
        color: #ff4d4f;
      `;
      errorDiv.textContent = `错误: ${error.message}`;
      messagesContainer.appendChild(errorDiv);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  } finally {
    stopBtn.style.display = 'none';
    controller = null;
  }
}

// 修改 addMessage 函数
function addMessage(role, content) {
  const messagesContainer = document.querySelector('.chat-messages');
  if (!messagesContainer) return;

  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${role}`;
  messageDiv.style.cssText = `
    padding: 12px;
    border-radius: 8px;
    max-width: 80%;
    ${role === 'user' ? 'align-self: flex-end; background: #e6f0ff;' : 'align-self: flex-start; background: #f5f5f5;'}
  `;

  // 添加消息内容（使用 marked 渲染 Markdown）
  messageDiv.innerHTML = marked.parse(content);

  // 添加 Markdown 样式
  const markdownStyles = document.createElement('style');
  markdownStyles.textContent = `
    .chat-message {
      font-size: 14px;
      line-height: 1.6;
    }
    
    .chat-message p {
      margin: 0 0 10px 0;
    }
    
    .chat-message p:last-child {
      margin-bottom: 0;
    }
    
    .chat-message ul,
    .chat-message ol {
      margin: 0;
      padding-left: 20px;
    }
    
    .chat-message li {
      margin: 0;
    }
    
    .chat-message pre {
      margin: 10px 0;
      padding: 12px;
      background: rgba(0, 0, 0, 0.05);
      border-radius: 4px;
      overflow-x: auto;
    }
    
    .chat-message code {
      font-family: monospace;
      padding: 2px 4px;
      background: rgba(0, 0, 0, 0.05);
      border-radius: 3px;
      font-size: 0.9em;
    }
    
    .chat-message pre code {
      padding: 0;
      background: none;
    }
    
    .chat-message blockquote {
      margin: 10px 0;
      padding-left: 12px;
      border-left: 3px solid #ddd;
      color: #666;
    }
    
    .chat-message h1,
    .chat-message h2,
    .chat-message h3,
    .chat-message h4,
    .chat-message h5,
    .chat-message h6 {
      margin: 15px 0 10px 0;
      line-height: 1.4;
    }
    
    .chat-message h1:first-child,
    .chat-message h2:first-child,
    .chat-message h3:first-child,
    .chat-message h4:first-child,
    .chat-message h5:first-child,
    .chat-message h6:first-child {
      margin-top: 0;
    }
    
    .chat-message table {
      border-collapse: collapse;
      margin: 10px 0;
      width: 100%;
    }
    
    .chat-message table th,
    .chat-message table td {
      border: 1px solid #ddd;
      padding: 6px 8px;
      text-align: left;
    }
    
    .chat-message table th {
      background: rgba(0, 0, 0, 0.05);
    }
  `;
  document.head.appendChild(markdownStyles);

  // 如果是用户消息，不需要复制按钮
  if (role === 'assistant') {
    // 添加复制按钮
    const copyButton = document.createElement('button');
    copyButton.className = 'copy-btn';
    copyButton.innerHTML = '复制';
    copyButton.style.cssText = `
      float: right;
      padding: 2px 6px;
      margin-left: 8px;
      border: none;
      border-radius: 4px;
      background: rgba(0, 0, 0, 0.1);
      cursor: pointer;
      font-size: 12px;
      opacity: 0;
      transition: opacity 0.2s;
    `;

    // 显示/隐藏复制按钮
    messageDiv.addEventListener('mouseenter', () => {
      copyButton.style.opacity = '1';
    });
    messageDiv.addEventListener('mouseleave', () => {
      copyButton.style.opacity = '0';
    });

    // 复制功能
    copyButton.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(content);
        copyButton.innerHTML = '已复制';
        setTimeout(() => {
          copyButton.innerHTML = '复制';
        }, 1500);
      } catch (err) {
        console.error('复制失败:', err);
      }
    });

    messageDiv.appendChild(copyButton);
  }

  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}
// 以上是聊天窗口的逻辑代码
