console.log("Content script loaded");

let floatingWindow = null;

// 监听来自background的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'PROCESS_REQUEST') {
    handleRequest(request.data);
  } else if (request.type === 'SHOW_ERROR') {
    showError(request.message);
  }
});

// 处理API请求
async function handleRequest({ text, prompt, api }) {
  try {
    showLoading();
    
    const response = await fetch(api.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${api.key}`
      },
      body: JSON.stringify({
        model: api.model,
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: text }
        ]
      })
    });

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message);
    }

    const result = data.choices[0].message.content;
    showResult(result);
  } catch (error) {
    showError(error.message);
  }
}

// 显示加载中
function showLoading() {
  showFloatingWindow('处理中...', 'loading');
}

// 显示错误
function showError(message) {
  showFloatingWindow(`错误: ${message}`, 'error');
}

// 显示结果
function showResult(content) {
  showFloatingWindow(content, 'success');
}

// 显示浮动窗口
function showFloatingWindow(content, type = 'default') {
  // 移除现有窗口
  if (floatingWindow) {
    floatingWindow.remove();
  }

  // 创建新窗口
  floatingWindow = document.createElement('div');
  floatingWindow.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 500px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
    z-index: 10000;
    font-family: Arial, sans-serif;
  `;

  // 创建标题栏
  const titleBar = document.createElement('div');
  titleBar.style.cssText = `
    padding: 12px 16px;
    background: #f5f5f5;
    border-radius: 8px 8px 0 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #eee;
  `;

  const title = document.createElement('div');
  title.textContent = type === 'loading' ? '处理中' : 
                     type === 'error' ? '错误' : 'AI 响应';
  title.style.fontWeight = 'bold';

  const closeButton = document.createElement('button');
  closeButton.innerHTML = '&times;';
  closeButton.style.cssText = `
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    padding: 0 4px;
    color: #666;
  `;
  closeButton.onclick = () => floatingWindow.remove();

  titleBar.appendChild(title);
  titleBar.appendChild(closeButton);

  // 创建内容容器
  const contentContainer = document.createElement('div');
  contentContainer.style.cssText = `
    padding: 16px;
    max-height: 60vh;
    overflow-y: auto;
    line-height: 1.5;
    color: #333;
  `;
  contentContainer.textContent = content;

  // 创建按钮容器
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = `
    padding: 12px 16px;
    background: #f5f5f5;
    border-top: 1px solid #eee;
    border-radius: 0 0 8px 8px;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  `;

  // 添加复制按钮
  if (type === 'success') {
    const copyButton = document.createElement('button');
    copyButton.textContent = '复制';
    copyButton.style.cssText = `
      padding: 6px 12px;
      background: #4CAF50;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    `;
    copyButton.onmouseover = () => {
      copyButton.style.background = '#45a049';
    };
    copyButton.onmouseout = () => {
      copyButton.style.background = '#4CAF50';
    };
    copyButton.onclick = () => {
      navigator.clipboard.writeText(content)
        .then(() => {
          copyButton.textContent = '已复制';
          setTimeout(() => {
            copyButton.textContent = '复制';
          }, 1500);
        })
        .catch(() => alert('复制失败'));
    };
    buttonContainer.appendChild(copyButton);
  }

  // 组装窗口
  floatingWindow.appendChild(titleBar);
  floatingWindow.appendChild(contentContainer);
  if (type === 'success') {
    floatingWindow.appendChild(buttonContainer);
  }

  // 添加到页面
  document.body.appendChild(floatingWindow);

  // 添加拖动功能
  let isDragging = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;

  titleBar.style.cursor = 'move';
  titleBar.addEventListener('mousedown', dragStart);

  function dragStart(e) {
    initialX = e.clientX - floatingWindow.offsetLeft;
    initialY = e.clientY - floatingWindow.offsetTop;
    
    if (e.target === titleBar) {
      isDragging = true;
    }
  }

  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', dragEnd);

  function drag(e) {
    if (isDragging) {
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;
      
      floatingWindow.style.left = currentX + 'px';
      floatingWindow.style.top = currentY + 'px';
      floatingWindow.style.transform = 'none';
    }
  }

  function dragEnd(e) {
    initialX = currentX;
    initialY = currentY;
    isDragging = false;
  }
}

function getSelectedText() {
  return window.getSelection().toString().trim();
}

// 复制到剪贴板
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showNotification('复制成功');
  } catch (error) {
    showNotification('复制失败');
  }
}

// 显示通知
function showNotification(message) {
  const notification = document.createElement("div");
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 10px 20px;
    border-radius: 4px;
    z-index: 10000;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 2000);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Message received in content script:", message);

    if (message.action === "refactorText") {
        const activeElement = document.activeElement;

        if (!activeElement) {
            console.log("No active element");
            sendResponse({ error: "No active element" });
            return;
        }

        let selectedText = null;
        if (activeElement.isContentEditable) {
            selectedText = window.getSelection().toString() || activeElement.innerText;
        } else if (activeElement.value) {
            selectedText = activeElement.value.substring(activeElement.selectionStart, activeElement.selectionEnd) || activeElement.value;
        }

        if (!selectedText) {
            console.log("No text input element focused or no text selected");
            sendResponse({ error: "No text input element focused or no text selected" });
            return;
        }

        console.log("Selected text:", selectedText);

        const url = 'https://api.ppinfra.com/v3/openai/chat/completions';
        console.log("Fetching URL:", url);

        fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${message.apiKey}`
            },
            body: JSON.stringify({
                model: "deepseek/deepseek-v3",
                messages: [
                    {role: "system", content: "You are a professional prompt engineer. Your task is to optimize the user's prompt by making it clearer, more concise, and more effective. Only output the improved prompt without adding any commentary or labels. If the original prompt is already optimized, return it unchanged."},
                    {role: "user", content: `${selectedText}`}
                ],
                max_tokens: 512,
                temperature: 0.9
            })
        })
        
        .then(response => {
            console.log("Fetch response:", response);
            if (!response.ok) {
                throw new Error(response.statusText);
            }
            return response.json();
        })
        .then(result => {
            console.log("Result:", result);
            if (result.choices && result.choices[0] && result.choices[0].message) {
                let rephrased = result.choices[0].message.content.trim();
                
                // Remove surrounding quotes if present
                if ((rephrased.startsWith('"') && rephrased.endsWith('"')) || (rephrased.startsWith("'") && rephrased.endsWith("'"))) {
                    rephrased = rephrased.slice(1, -1);
                }
                
                if (activeElement.isContentEditable) {
                    activeElement.innerText = rephrased;
                } else {
                    activeElement.value = rephrased;
                }
                copyToClipboard(rephrased);
                sendResponse({ success: true, rephrased: rephrased });
            } else {
                sendResponse({ success: false, error: "Failed to rephrase the text" });
            }
        })
        
        .catch(error => {
            console.error("Error during fetch:", error);
            sendResponse({ success: false, error: error.message });
        });

        return true; // keep the messaging channel open for sendResponse
    }
});