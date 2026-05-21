# API 文档

## 约定

- **Base URL:** `http://{host}:{port}/api`
- **Content-Type:** `application/json`
- **认证:** 除 `/auth/login` 外所有接口需携带 `Authorization: Bearer {token}` 头
- **响应格式:** 统一包装

```jsonc
// 成功
{
  "code": 0,
  "data": { /* 具体数据 */ }
}

// 失败
{
  "code": -1,          // 或具体错误码
  "message": "错误描述"
}
```

- **分页参数 (Query String):**
  - `page`: 页码，从 1 开始，默认 1
  - `pageSize`: 每页条数，默认 20，最大 100

- **分页响应:**
```jsonc
{
  "code": 0,
  "data": {
    "items": [ /* ... */ ],
    "total": 150,
    "page": 1,
    "pageSize": 20
  }
}
```

---

## 1. 认证

### 1.1 登录

```
POST /api/auth/login
```

**Request:**
```jsonc
{
  "password": "string"
}
```

**Response (成功):**
```jsonc
{
  "code": 0,
  "data": {
    "token": "eyJhbGciOi...",
    "expiresAt": "2026-05-22T00:00:00Z"
  }
}
```

**Response (失败):**
```jsonc
{
  "code": 401,
  "message": "密码错误"
}
```

### 1.2 校验 Token

```
GET /api/auth/check
```

**Response:**
```jsonc
{
  "code": 0,
  "data": { "valid": true }
}
```

---

## 2. 仪表盘

### 2.1 系统概览

```
GET /api/dashboard
```

**Response:**
```jsonc
{
  "code": 0,
  "data": {
    "os": "Microsoft Windows 11",
    "cpuUsage": 23.5,
    "memoryTotalMb": 16384,
    "memoryUsedMb": 8192,
    "pluginCount": 5,
    "enabledPluginCount": 3,
    "version": "2.12.1",
    "startTime": "2026-05-21T10:30:00",
    "currentQQ": 123456789,
    "currentNick": "机器人昵称"
  }
}
```

### 2.2 进程列表

```
GET /api/dashboard/processes
```

**Response:**
```jsonc
{
  "code": 0,
  "data": [
    {
      "appId": "com.example.plugin",
      "pluginName": "示例插件",
      "pid": 12345,
      "enabled": true,
      "cpuUsage": 2.1,
      "memoryMb": 45.3
    }
  ]
}
```

### 2.3 杀进程

```
POST /api/dashboard/processes/{pid}/kill
```

**Response:** `{ "code": 0, "data": null }`

---

## 3. 插件管理

### 3.1 插件列表

```
GET /api/plugins
```

**Response:**
```jsonc
{
  "code": 0,
  "data": [
    {
      "appId": "com.example.plugin",
      "pluginName": "示例插件",
      "enabled": true,
      "hasConnection": true,
      "author": "作者名",
      "version": "1.0.0",
      "description": "插件描述",
      "authCode": 1001,
      "pid": 12345
    }
  ]
}
```

### 3.2 启用插件

```
POST /api/plugins/{appId}/enable
```

**Response:** `{ "code": 0, "data": null }`

### 3.3 禁用插件

```
POST /api/plugins/{appId}/disable
```

**Response:** `{ "code": 0, "data": null }`

### 3.4 重载单个

```
POST /api/plugins/{appId}/reload
```

**Response:** `{ "code": 0, "data": null }`

### 3.5 重载全部

```
POST /api/plugins/reload-all
```

**Response:** `{ "code": 0, "data": null }`

### 3.6 测试群消息

```
POST /api/plugins/{appId}/test/group
```

**Request:**
```jsonc
{
  "groupId": 123456789,
  "qqId": 987654321,
  "message": "测试消息",
  "messageId": 0
}
```

**Response:**
```jsonc
{
  "code": 0,
  "data": { "messageId": 1 }
}
```

### 3.7 测试私聊消息

```
POST /api/plugins/{appId}/test/private
```

**Request:**
```jsonc
{
  "qqId": 987654321,
  "message": "测试消息",
  "messageId": 0
}
```

**Response:**
```jsonc
{
  "code": 0,
  "data": { "messageId": 1 }
}
```

---

## 4. 协议管理

### 4.1 可用协议列表

```
GET /api/protocols
```

**Response:**
```jsonc
{
  "code": 0,
  "data": [
    { "name": "OneBot v11", "isCurrent": true },
    { "name": "MiraiAPIHttp", "isCurrent": false },
    { "name": "Lagrange.Core", "isCurrent": false }
  ]
}
```

### 4.2 当前协议详情

```
GET /api/protocols/current
```

**Response:**
```jsonc
{
  "code": 0,
  "data": {
    "name": "OneBot v11",
    "isConnected": true,
    "config": {
      "Host": "127.0.0.1",
      "Port": "6700",
      "AccessToken": ""
    }
  }
}
```

### 4.3 切换协议

```
POST /api/protocols/switch
```

**Request:**
```jsonc
{
  "name": "Lagrange.Core",
  "config": {
    "Key1": "Value1"
  }
}
```

**Response:**
```jsonc
{
  "code": 0,
  "data": { "name": "Lagrange.Core", "isConnected": true }
}
```

### 4.4 断开协议

```
POST /api/protocols/disconnect
```

**Response:** `{ "code": 0, "data": null }`

---

## 5. 聊天

### 5.1 会话列表

```
GET /api/chat/categories
```

**Response:**
```jsonc
{
  "code": 0,
  "data": [
    {
      "id": 123456789,
      "type": "group",
      "name": "群名称",
      "lastMessage": "最近一条消息...",
      "lastMessageTime": "2026-05-21T12:00:00",
      "unreadCount": 3
    }
  ]
}
```

### 5.2 分页聊天记录

```
GET /api/chat/histories/{type}/{targetId}?page=1&pageSize=20
```

- `type`: `group` | `private`

**Response:**
```jsonc
{
  "code": 0,
  "data": {
    "items": [
      {
        "id": 1,
        "type": "group",
        "targetId": 123456789,
        "senderId": 987654321,
        "senderName": "发送者昵称",
        "message": "[CQ:at,qq=10001] 你好",
        "messageId": 5001,
        "isRecalled": false,
        "time": "2026-05-21T12:00:00"
      }
    ],
    "total": 150,
    "page": 1,
    "pageSize": 20
  }
}
```

### 5.3 定位消息

```
GET /api/chat/histories/around/{msgId}?type=group
```

- `type`: `group` | `private`

**Response:** 同 5.2 分页格式，返回包含该消息及前后各约 10 条

### 5.4 发送群消息

```
POST /api/chat/send/group
```

**Request:**
```jsonc
{
  "groupId": 123456789,
  "message": "你好世界"
}
```

**Response:**
```jsonc
{
  "code": 0,
  "data": { "messageId": 5002 }
}
```

### 5.5 发送私聊消息

```
POST /api/chat/send/private
```

**Request:**
```jsonc
{
  "qqId": 987654321,
  "message": "你好"
}
```

**Response:**
```jsonc
{
  "code": 0,
  "data": { "messageId": 5003 }
}
```

### 5.6 撤回消息

```
POST /api/chat/recall/{msgId}
```

**Response:** `{ "code": 0, "data": null }`

### 5.7 好友昵称

```
GET /api/chat/friends/{qqId}/nick
```

**Response:**
```jsonc
{
  "code": 0,
  "data": { "nick": "好友昵称" }
}
```

### 5.8 群名称

```
GET /api/chat/groups/{groupId}/name
```

**Response:**
```jsonc
{
  "code": 0,
  "data": { "name": "群名称" }
}
```

### 5.9 群成员昵称

```
GET /api/chat/groups/{groupId}/members/{qqId}/nick
```

**Response:**
```jsonc
{
  "code": 0,
  "data": { "nick": "群名片或昵称" }
}
```

---

## 6. 日志

### 6.1 查询日志

```
GET /api/logs?page=1&pageSize=20&level=warning&source=Plugin&keyword=错误&startTime=2026-05-01&endTime=2026-05-21
```

**参数 (全部可选):**

| 参数 | 类型 | 说明 |
|---|---|---|
| `page` | int | 页码 |
| `pageSize` | int | 每页条数 |
| `level` | string | `debug` / `info` / `infosend` / `warning` / `error` / `fatal` |
| `source` | string | 来源，模糊匹配 |
| `keyword` | string | 关键词，模糊搜索详情 |
| `startTime` | datetime | 开始时间 |
| `endTime` | datetime | 结束时间 |

**Response:**
```jsonc
{
  "code": 0,
  "data": {
    "items": [
      {
        "id": 1,
        "time": "2026-05-21T12:00:00",
        "level": "warning",
        "source": "Another-Mirai-Native",
        "name": "初始化",
        "detail": "连接协议失败",
        "status": "unread"
      }
    ],
    "total": 150,
    "page": 1,
    "pageSize": 20
  }
}
```

### 6.2 更新日志状态

```
POST /api/logs/{id}/status
```

**Request:**
```jsonc
{
  "status": "read"
}
```

**Response:** `{ "code": 0, "data": null }`

---

## 7. 配置

### 7.1 获取配置

```
GET /api/config
```

**Response:**
```jsonc
{
  "code": 0,
  "data": {
    "autoProtocol": "OneBot v11",
    "autoConnect": true,
    "enableChat": true,
    "debugMode": false,
    "showTaskBar": false,
    "autoEnablePlugins": ["插件A", "插件B"],
    "testingAuthCode": 1001,
    "serverType": 1
  }
}
```

### 7.2 更新配置项

```
PUT /api/config
```

**Request:**
```jsonc
{
  "key": "autoProtocol",
  "value": "Lagrange.Core"
}
```

**Response:** `{ "code": 0, "data": null }`

### 7.3 测试授权码

```
GET /api/config/testing-authcode
```

**Response:**
```jsonc
{
  "code": 0,
  "data": { "authCode": 1001 }
}
```

---

## 8. 图片

### 8.1 获取缓存图片

```
GET /api/images/{hash}
```

`hash`: 图片缓存 hash（从 CQ 码 `[CQ:image,hash=xxx]` 提取）

**Response:** 图片二进制，`Content-Type: image/jpeg` 或 `image/png`

---

# SignalR Hub

## 连接

```
GET /hub/amn?access_token={token}
```

通过 Query String 传递 JWT。

## 事件 (服务端 → 客户端)

### OnGroupMessage — 群消息

**载荷:**
```jsonc
{
  "pluginAppId": "com.example.plugin",
  "type": 1,
  "subType": 0,
  "groupId": 123456789,
  "qqId": 987654321,
  "message": "消息文本 (含 CQ 码)",
  "rawMessage": "原始消息",
  "messageId": 5001
}
```

### OnPrivateMessage — 私聊消息

```jsonc
{
  "pluginAppId": "com.example.plugin",
  "type": 1,
  "subType": 0,
  "qqId": 987654321,
  "message": "消息文本",
  "messageId": 5002
}
```

### OnGroupBan — 群禁言

```jsonc
{
  "pluginAppId": "com.example.plugin",
  "groupId": 123456789,
  "qqId": 987654321,
  "duration": 600
}
```

### OnGroupMemberAdded — 群成员增加

```jsonc
{
  "pluginAppId": "com.example.plugin",
  "groupId": 123456789,
  "qqId": 987654321
}
```

### OnGroupMemberLeft — 群成员退出

```jsonc
{
  "pluginAppId": "com.example.plugin",
  "groupId": 123456789,
  "qqId": 987654321
}
```

### OnFriendAdded — 新增好友

```jsonc
{
  "pluginAppId": "com.example.plugin",
  "qqId": 987654321
}
```

### OnMessageRecall — 消息撤回

```jsonc
{
  "type": "group",
  "targetId": 123456789,
  "messageId": 5001
}
```

### OnMessageSent — 消息发送回执 (CQP 回调)

```jsonc
{
  "type": "group",
  "targetId": 123456789,
  "qqId": 987654321,
  "message": "消息内容",
  "messageId": 5003
}
```

### OnPluginStatusChanged — 插件状态变更

```jsonc
{
  "appId": "com.example.plugin",
  "enabled": true,
  "hasConnection": true
}
```

### OnPluginAdded — 新插件

```jsonc
{
  "appId": "com.example.plugin",
  "pluginName": "插件名",
  "author": "作者",
  "version": "1.0.0",
  "description": "描述",
  "authCode": 1001,
  "pid": 12346
}
```

### OnLogAdded — 新日志

```jsonc
{
  "id": 1,
  "time": "2026-05-21T12:00:00",
  "level": "warning",
  "source": "Another-Mirai-Native",
  "name": "初始化",
  "detail": "详细信息",
  "status": "unread"
}
```

### OnLogStatusUpdated — 日志状态更新

```jsonc
{
  "id": 1,
  "status": "read"
}
```

### OnQRCodeDisplay — 登录二维码

```jsonc
{
  "url": "https://...",
  "imageBase64": "iVBORw0..."
}
```

### OnQRCodeFinished — 扫码完成

(无载荷)

### OnTestInvoked — 插件测试事件

```jsonc
{
  "pluginAppId": "com.example.plugin",
  "message": "测试消息",
  "response": "插件返回的消息"
}
```
