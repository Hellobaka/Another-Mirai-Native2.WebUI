# Another-Mirai-Native2.WebUI

AMN2 的 Web 管理面板，提供聊天管理、插件管理、日志查看、修改配置等功能。

## 技术栈

| 层        | 技术      |
| --------- | --------- |
| 框架      | Vue 3     |
| UI 组件库 | Vuetify 4 |
| 实时通信  | SignalR   |
| 构建工具  | Vite      |

## 构建

```bash
npm install
npm run build
```

产物输出到 `dist/` 目录。

## 使用方式

### 方式一：使用公用面板

直接访问 **[amn2-panel.hellobaka.moe](https://amn2-panel.hellobaka.moe)**，点击右上角齿轮图标，将后端地址配置为你的 AMN2 服务器地址（例如 `http://你的服务器IP:5000`）并保存。

> 页面本身是纯前端静态资源，所有数据存储在浏览器本地，不会经过公用服务器。

如果你的后端使用Nginx反代，可以参考以下配置：
```nginx
server {
  listen 8080;
  listen [::]:8080;
  http2 on;
  server_name example.com;

  location / {
    # App server url
    proxy_pass http://127.0.0.1:8081;

    # Configuration for WebSockets
    proxy_set_header Upgrade "upgrade";
    proxy_set_header Connection $connection_upgrade;
    proxy_cache off;
    # WebSockets were implemented after http/1.0
    proxy_http_version 1.1;

    # Configuration for ServerSentEvents
    proxy_buffering off;

    # Configuration for LongPolling or if your KeepAliveInterval is longer than 60 seconds
    proxy_read_timeout 300s;
    proxy_send_timeout  300s;
    send_timeout        300s;

    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
  location /realtime {
    proxy_pass http://127.0.0.1:8081;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
    send_timeout 3600s;
    proxy_cache off;
    proxy_buffering off;
  }
}
```

### 方式二：AMN2 内置托管

在 AMN2 根目录下新建 `wwwroot` 文件夹，将 `dist/` 目录中的所有文件复制进去：

```
Another-Mirai-Native2/
├── wwwroot/          ← 新建此文件夹
│   ├── index.html
│   ├── favicon.svg
│   └── assets/
├── Another-Mirai-Native.exe
├── conf/
├── data/
└── ...
```

启动 AMN2 后，面板自动从 `wwwroot/` 提供服务，浏览器访问 `http://localhost:5000` 即可使用。

### 方式三：自行部署

将 `dist/` 部署到任意静态文件服务器（Nginx、Caddy、IIS 等），配置反向代理将部分请求转发到 AMN2 后端，并需要配置IP转发头`X-Forwarded-For`与`X-Forwarded-Proto`
```nginx
server {
    listen 8080;
    listen [::]:8080;

    root D:/Code/Another-Mirai-Native2.WebUI/dist;

    location / {
        try_files $uri $uri/ /index.html;
    }
    location /api/ {
        proxy_pass http://127.0.0.1:8081;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location /external/ {
        proxy_pass http://127.0.0.1:8081;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location /realtime {
        proxy_pass http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        send_timeout 3600s;
        proxy_cache off;
        proxy_buffering off; 
    }
}
```
