- background.js 用来初始化上下文菜单，按钮在哪里
- content.js 用来处理选中的文本，使用固定的提示词调用API，然后替换原文本。
- popup.html 是扩展的配置页面，包含一个输入框用于输入PPinfra API密钥，以及保存按钮。
- popup.js 处理弹出页面的逻辑，保存API密钥到chrome.storage.sync中，并在页面加载时填充已保存的密钥。


background.js，这是Chrome扩展的后台脚本，负责处理安装事件和上下文菜单的创建。当扩展安装时，会创建一个ID为“grompt”的上下文菜单，显示在可编辑区域。当用户点击这个菜单项时，会触发事件监听器，获取存储的API密钥，如果未找到则发送通知，否则向内容脚本发送消息，请求处理文本重构。这里使用chrome.tabs.sendMessage来与内容脚本通信，并处理可能的错误。


content.js，内容脚本负责在页面上执行实际操作。它监听来自后台的消息，当收到“refactorText”动作时，会获取当前焦点元素，提取选中的文本，然后调用PPinfra的API进行优化。使用fetch发送POST请求，处理响应后替换原文本，并将结果复制到剪贴板。同时，这里还有错误处理和响应返回的逻辑，确保与后台的通信正常。

popup.html是扩展的配置页面，包含一个输入框用于输入Groq API密钥，以及保存按钮。样式比较简单，宽度设置为200px以适应弹出窗口的大小。

popup.js处理弹出页面的逻辑，保存API密钥到chrome.storage.sync中，并在页面加载时填充已保存的密钥。这里的事件监听器包括保存按钮的点击和DOM加载完成时的初始化。


当前的background.js创建了一个上下文菜单项，点击后发送消息到content.js，content.js处理选中的文本，使用固定的提示词调用API，然后替换原文本。popup.html和popup.js用于保存Groq的API密钥。
