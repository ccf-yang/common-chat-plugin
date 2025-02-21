console.log("Content script loaded");

// 创建悬浮窗口
const floatingWindow = createFloatingWindow();
let controller = null; // 用于存储AbortController实例

// 监听来自background的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'PROCESS_REQUEST') {
      processApiRequest(message.data);
    } else if (message.type === 'SHOW_ERROR') {
      showError(message.message);
    }
  });

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

// // 显示通知
// function showNotification(message) {
//   const notification = document.createElement("div");
//   notification.style.cssText = `
//     position: fixed;
//     bottom: 20px;
//     left: 50%;
//     transform: translateX(-50%);
//     background: rgba(0, 0, 0, 0.8);
//     color: white;
//     padding: 10px 20px;
//     border-radius: 4px;
//     z-index: 10000;
//   `;
//   notification.textContent = message;
//   document.body.appendChild(notification);
//   setTimeout(() => notification.remove(), 2000);
// }

// 处理API请求
async function processApiRequest(data) {
  try {
    const { text, prompt, api } = data;
    
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
    height: 500px; /* 固定高度 */
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
    z-index: 10000;
    font-family: Arial, sans-serif;
    display: none;
    overflow: hidden; /* 防止内容溢出 */
  `;
  
  // 添加样式
  const style = document.createElement('style');
  style.textContent = `
    .title-bar {
      padding: 12px 16px;
      background: #f5f5f5;
      border-bottom: 1px solid #eee;
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
      height: calc(100% - 120px); /* 减去标题栏和按钮区域高度 */
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
      font-size: 20px;
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