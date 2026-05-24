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
    "items": [
      /* ... */
    ],
    "total": 150,
    "page": 1,
    "pageSize": 20,
  },
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
  "password": "string",
}
```

**Response (成功):**

```jsonc
{
  "code": 0,
  "data": {
    "token": "eyJhbGciOi...",
    "expiresAt": "2026-05-22T00:00:00Z",
  },
}
```

**Response (失败):**

```jsonc
{
  "code": 401,
  "message": "密码错误",
}
```

### 1.2 刷新 Token

```
GET /api/auth/refresh
```

**Response:**

```jsonc
{
  "code": 0,
  "data": {
    "token": "eyJhbGciOi...",
    "expiresAt": "2026-05-22T00:00:00Z",
  },
}
```

**Response (失败):**

```jsonc
{
  "code": 401,
  "message": "未登录或登录失效",
}
```

---

## 2. 仪表盘

### 2.1 系统概览

```
GET /api/dashboard/base-information
```

**Response:**

```jsonc
{
  "code": 0,
  "data": {
    "osVersion": "Microsoft Windows 11 家庭版 中文版 64 位 版本 25H2",
    "cpu": "AMD Ryzen 5 PRO 4650U with Radeon Graphics @ 2.10 GHz",
    "totalMemory": 15229,
    "startedTime": "00:00:00:14",
    "version": "2.12.1.0",
    "currentBotQQ": 10001,
    "currentBotNick": "",
    "loadedPluginCount": 0,
    "dotNetRuntimeVersion": ".NET 9.0.12",
    "workingDirectory": "D:\\Code\\Another-Mirai-Native2",
    "diskFreeSpaceInGB": 1024.11,
    "diskTotalSpaceInGB": 2048.22,
  },
  "message": null,
}
```

### 2.2 系统占用

```
GET /api/dashboard/usages
```

**Response:**

```jsonc
{
  "code": 0,
  "data": {
    "cpuUsage": 20.830696,
    "memoryUsage": 85.56701030927834,
    "usedMemoryInMB": 13031,
    "totalMemoryInMB": 15229,
  },
  "message": null,
}
```

### 2.3 插件占用

```
GET /api/dashboard/plugin-usages
```

**Response:**

```jsonc
{
  "code": 0,
  "data": {
    "totalProcessMemory": 42.65625,
    "totalProcessCPU": 0.5207086756763764,
    "processedMessageCount": 111,
    "sentMessageCount": 22,
    "pluginUsages": [
      {
        "id": 0,
        "pid": 27068,
        "pluginName": "主框架",
        "running": true,
        "cpuUsage": 0.5207086756763764,
        "memoryUsage": 42.65625,
      },
    ],
  },
  "message": null,
}
```

> Id = 0 代表框架本身

---

## 3. 插件管理

### 3.1 插件列表

```
GET /api/plugin
```

**Response:**

```jsonc
{
  "code": 0,
  "data": [
    {
      "authCode": 10001,
      "enabled": false,
      "pluginId": "启用插件以查看 AppId",
      "pluginName": "水银掷筛机",
      "author": "落花茗",
      "description": "R!",
      "version": "1.1.3",
      "auth": [101, 106],
    },
    {
      "authCode": 10002,
      "enabled": false,
      "pluginId": "启用插件以查看 AppId",
      "pluginName": "Steam视奸机",
      "author": "落花茗",
      "description": "玩啥呢 不叫我",
      "version": "1.0.0",
      "auth": [101, 106, 161],
    },
    {
      "authCode": 10003,
      "enabled": true,
      "pluginId": "me.cqp.luohuaming.AdvancedDice",
      "pluginName": "水银掷骰机2",
      "author": "落花茗",
      "description": "R!!",
      "version": "2.0.0",
      "auth": [
        20, 30, 101, 103, 106, 110, 120, 121, 122, 123, 124, 125, 126, 127, 128, 130, 131, 132, 140,
        150, 151, 160, 161, 162, 180,
      ],
    },
  ],
  "message": null,
}
```

### 3.2 拉取插件元数据

```
POST /api/plugin/{authCode}/info
```

#### PluginType 枚举

| 枚举 | 值         |
| ---- | ---------- |
| 0    | 酷Q插件    |
| 1    | 小栗子插件 |
| 2    | 原生插件   |

#### Auth 枚举

| 枚举 | 值               |
| ---- | ---------------- |
| 20   | 取Cookies        |
| 30   | 接收语音         |
| 101  | 发送群消息       |
| 103  | 发送讨论组消息   |
| 106  | 发送私聊消息     |
| 110  | 发送赞           |
| 120  | 置群员移除       |
| 121  | 置群员禁言       |
| 122  | 置群管理员       |
| 123  | 置全群禁言       |
| 124  | 置匿名群员禁言   |
| 125  | 置群匿名设置     |
| 126  | 置群成员名片     |
| 127  | 置群退出         |
| 128  | 置群成员专属头衔 |
| 130  | 取群成员信息     |
| 131  | 取陌生人信息     |
| 132  | 取群信息         |
| 140  | 置讨论组退出     |
| 150  | 置好友添加请求   |
| 151  | 置群添加请求     |
| 160  | 取群成员列表     |
| 161  | 取群列表         |
| 162  | 取好友列表       |
| 180  | 撤回消息         |

#### 200

**Response:**

```json
{
  "code": 0,
  "data": {
    "authCode": 10001,
    "enabled": true,
    "pluginId": "me.cqp.luohuaming.Dice",
    "pluginName": "水银掷筛机",
    "version": "1.1.3",
    "author": "落花茗",
    "description": "R!",
    "auth": [101, 106],
    "pluginType": 0
  },
  "message": null
}
```

### 400

```json
{
  "code": 404,
  "data": null,
  "message": "未找到对应 AuthCode 的插件"
}
```

### 3.2 启用插件

```
POST /api/plugin/{authCode}/enable
```

#### 200

**Response:**

```json
{
  "code": 0,
  "data": {
    "authCode": 10001,
    "enabled": true,
    "pluginId": "me.cqp.luohuaming.Dice",
    "pluginName": "水银掷筛机",
    "author": "落花茗",
    "description": "R!",
    "version": "1.1.3",
    "auth": [101, 106]
  },
  "message": null
}
```

### 400

```json
{
  "code": 404,
  "data": null,
  "message": "未找到对应 AuthCode 的插件"
}
```

### 3.3 禁用插件

```
POST /api/plugin/{authCode}/disable
```

#### 200

**Response:**

```json
{
  "code": 0,
  "data": {
    "authCode": 10001,
    "enabled": false,
    "pluginId": "启用插件以查看 AppId",
    "pluginName": "水银掷筛机",
    "author": "落花茗",
    "description": "R!",
    "version": "1.1.3",
    "auth": [101, 106]
  },
  "message": null
}
```

### 400

```json
{
  "code": 404,
  "data": null,
  "message": "未找到对应 AuthCode 的插件"
}
```

### 3.4 重载单个

```
POST /api/plugin/{authCode}/reload
```

#### 200

**Response:**

```json
{
  "code": 0,
  "data": {
    "authCode": 10005,
    "enabled": true,
    "pluginId": "me.cqp.luohuaming.AdvancedDice",
    "pluginName": "水银掷骰机2",
    "author": "落花茗",
    "description": "R!!",
    "version": "2.0.0",
    "auth": [
      20, 30, 101, 103, 106, 110, 120, 121, 122, 123, 124, 125, 126, 127, 128, 130, 131, 132, 140,
      150, 151, 160, 161, 162, 180
    ]
  },
  "message": null
}
```

### 400

```json
{
  "code": 404,
  "data": null,
  "message": "未找到对应 AuthCode 的插件"
}
```

### 3.5 重载全部

```
POST /api/plugin/reload-all
```

#### 200

```json
{
  "code": 0,
  "data": [
    {
      "authCode": 10004,
      "enabled": false,
      "pluginId": "启用插件以查看 AppId",
      "pluginName": "水银掷筛机",
      "author": "落花茗",
      "description": "R!",
      "version": "1.1.3",
      "auth": [101, 106]
    },
    {
      "authCode": 10005,
      "enabled": false,
      "pluginId": "启用插件以查看 AppId",
      "pluginName": "Steam视奸机",
      "author": "落花茗",
      "description": "玩啥呢 不叫我",
      "version": "1.0.0",
      "auth": [101, 106, 161]
    },
    {
      "authCode": 10006,
      "enabled": true,
      "pluginId": "me.cqp.luohuaming.AdvancedDice",
      "pluginName": "水银掷骰机2",
      "author": "落花茗",
      "description": "R!!",
      "version": "2.0.0",
      "auth": [
        20, 30, 101, 103, 106, 110, 120, 121, 122, 123, 124, 125, 126, 127, 128, 130, 131, 132, 140,
        150, 151, 160, 161, 162, 180
      ]
    }
  ],
  "message": null
}
```

---

## 4. 协议管理

### 4.1 可用协议列表

```
GET /api/protocol/list
```

**Response:**

```jsonc
{
  "code": 0,
  "data": ["MiraiAPIHttp", "Lagrange.Core", "NoConnection", "OneBot v11", "Satori v1"],
  "message": null,
}
```

### 4.2 当前协议名称以及连接状态

```
GET /api/protocol/current
```

#### 200

**Response:**

```jsonc
{
  "code": 0,
  "data": {
    "name": "NoConnection",
    "isConnected": true,
  },
  "message": null,
}
```

#### 404

```json
{
  "code": 404,
  "message": "当前没有已连接协议，无法执行断开"
}
```

### 4.3 断开当前协议

```
Get /api/protocol/disconnect
```

#### 200

**Request:**

```jsonc
{
  "code": 0,
  "data": null,
  "message": null,
}
```

#### 400

```json
{
  "code": 400,
  "message": "当前没有已连接协议，无法执行断开"
}
```

```json
{
  "code": 500,
  "message": "断开连接失败"
}
```

```json
{
  "code": 500,
  "message": "由于服务器发生异常，断开连接失败"
}
```

### 4.5 连接到新协议

```
Get /api/protocol/connect/{name}
```

#### 200

**Response:**

```json
{
  "code": 0,
  "data": null,
  "message": null
}
```

#### 400

```json
{
  "code": 400,
  "message": "当前已连接到 {p.Name} 协议，连接到其他协议前请先断开"
}
```

```json
{
  "code": 400,
  "message": "连接到 {name} 协议失败"
}
```

```json
{
  "code": 500,
  "message": "由于服务器发生异常，连接到 {name} 协议失败"
}
```

### 4.6 获取协议配置字典

```
Get /api/protocol/config/{name}
```

#### 200

```json
{
  "code": 0,
  "data": {
    "Ws": "",
    "AuthKey": ""
  },
  "message": null
}
```

#### 404

```json
{
  "code": 404,
  "message": "未找到名称为 {name} 的协议"
}
```

#### 400

```json
{
  "code": 400,
  "message": "由于服务器发生异常，获取协议配置参数失败"
}
```

### 4.7 设置协议配置字典

```
Post /api/protocol/config/{name}
```

Body:

```json
{
  "Ws": "ws://127.0.0.1:11451",
  "AuthKey": "1919810"
}
```

#### 200

```json
{
  "code": 0,
  "data": null,
  "message": null
}
```

#### 404

```json
{
  "code": 404,
  "message": "未找到名称为 {name} 的协议"
}
```

#### 400

```json
{
  "code": 400,
  "message": "由于服务器发生异常，获取协议配置参数失败"
}
```

```json
{
  "code": 400,
  "message": "设置协议连接参数失败，检查传递参数是否缺失键或无效值"
}
```

---

## 5. 聊天（暂不实现，API定义大概率随开发而改动，不要参考）

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
      "unreadCount": 3,
    },
  ],
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
        "time": "2026-05-21T12:00:00",
      },
    ],
    "total": 150,
    "page": 1,
    "pageSize": 20,
  },
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
  "message": "你好世界",
}
```

**Response:**

```jsonc
{
  "code": 0,
  "data": { "messageId": 5002 },
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
  "message": "你好",
}
```

**Response:**

```jsonc
{
  "code": 0,
  "data": { "messageId": 5003 },
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
  "data": { "nick": "好友昵称" },
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
  "data": { "name": "群名称" },
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
  "data": { "nick": "群名片或昵称" },
}
```

---

## 6. 日志

### 6.1 查询日志

```
GET /api/log
```

**参数:**

| 参数        | 类型     | 说明                   |
| ----------- | -------- | ---------------------- |
| `priority`  | int      | 最小日志等级           |
| `pageIndex` | int      | 页码数                 |
| `pageSize`  | int      | 每页条数               |
| `search`    | string   | 来源，模糊匹配（可选） |
| `asc`       | bool     | 按时间升序（可选）     |
| `start`     | datetime | 开始时间（可选）       |
| `end`       | datetime | 结束时间（可选）       |

**Response:**

```json
{
  "code": 0,
  "data": {
    "items": [
      {
        "id": 267,
        "time": "2026-05-23T14:16:32+08:00",
        "priority": 11,
        "source": "AMN框架",
        "status": "",
        "name": "加载插件",
        "detail": "配置中启动启用插件为 1 个，开始加载..."
      },
      {
        "id": 268,
        "time": "2026-05-23T14:16:32+08:00",
        "priority": 11,
        "source": "AMN框架",
        "status": "",
        "name": "加载插件",
        "detail": "水银掷筛机 插件信息读取成功"
      },
      {
        "id": 269,
        "time": "2026-05-23T14:16:32+08:00",
        "priority": 11,
        "source": "AMN框架",
        "status": "",
        "name": "加载插件",
        "detail": "Steam视奸机 插件信息读取成功"
      },
      {
        "id": 270,
        "time": "2026-05-23T14:16:32+08:00",
        "priority": 11,
        "source": "AMN框架",
        "status": "",
        "name": "加载插件",
        "detail": "将使用主程序加载"
      },
      {
        "id": 271,
        "time": "2026-05-23T14:16:32+08:00",
        "priority": 11,
        "source": "AMN框架",
        "status": "",
        "name": "加载插件",
        "detail": "水银掷骰机2 插件信息读取成功"
      },
      {
        "id": 272,
        "time": "2026-05-23T14:16:32+08:00",
        "priority": 11,
        "source": "AMN框架",
        "status": "√ 91 ms",
        "name": "加载插件",
        "detail": "加载完成，启用插件..."
      },
      {
        "id": 273,
        "time": "2026-05-23T14:16:34+08:00",
        "priority": 11,
        "source": "AMN框架",
        "status": "√ 1361 ms",
        "name": "启用插件",
        "detail": "插件启用完成，共加载了 1 个插件，开始调用启动事件..."
      },
      {
        "id": 274,
        "time": "2026-05-23T14:16:34+08:00",
        "priority": 11,
        "source": "AMN框架",
        "status": "",
        "name": "加载 C# 插件",
        "detail": "水银掷骰机2, 加载成功"
      },
      {
        "id": 275,
        "time": "2026-05-23T14:16:34+08:00",
        "priority": 10,
        "source": "水银掷骰机2",
        "status": "",
        "name": "水银掷骰机2",
        "detail": "插件已启用"
      },
      {
        "id": 276,
        "time": "2026-05-23T14:16:34+08:00",
        "priority": 11,
        "source": "AMN框架",
        "status": "√ 39 ms",
        "name": "启用插件",
        "detail": "插件启动完成，开始处理消息逻辑"
      }
    ],
    "totalCount": 276,
    "totalPage": 28
  },
  "message": null
}
```

---

## 7. 配置

### 7.1 获取核心配置

```
GET /api/config/core
```

**Response:**

```jsonc
{
  "code": 0,
  "data": {
    "AutoConnect": {
      "title": "协议自动连接",
      "description": "",
      "type": "Boolean",
      "value": true,
    },
    "AutoProtocol": {
      "title": "自动连接协议",
      "description": "选择启动时自动连接的协议",
      "type": "String",
      "value": "NoConnection",
    },
    "ReconnectTime": {
      "title": "重新连接间隔时间",
      "description": "协议失去连接时每次重新连接的间隔时间",
      "type": "Int32",
      "value": 5000,
    },
    "PluginExitWhenCoreExit": {
      "title": "框架退出时插件自动退出",
      "description": "主程序退出时自动关闭所有插件",
      "type": "Boolean",
      "value": true,
    },
    "RestartPluginIfDead": {
      "title": "插件崩溃时自动重启",
      "description": "插件发生异常时自动重新启动",
      "type": "Boolean",
      "value": false,
    },
    "HeartBeatInterval": {
      "title": "心跳间隔时间",
      "description": "核心与插件之间的心跳检测间隔",
      "type": "Int32",
      "value": 30000,
    },
    "PluginInvokeTimeout": {
      "title": "插件方法调用超时",
      "description": "",
      "type": "Int32",
      "value": 120000,
    },
    "LoadTimeout": {
      "title": "插件载入超时",
      "description": "",
      "type": "Int32",
      "value": 10000,
    },
    "UseDatabase": {
      "title": "日志使用数据库",
      "description": "是否将日志存储到数据库",
      "type": "Boolean",
      "value": true,
    },
    "MessageCacheSize": {
      "title": "消息缓存数量",
      "description": "内存中缓存的消息数量限制",
      "type": "Int32",
      "value": 4096,
    },
    "EnableChatImageCacheMaxSizeControl": {
      "title": "启用最大缓存图片体积控制",
      "description": "缓存文件夹超出体积时，会从最久的图片开始删除",
      "type": "Boolean",
      "value": false,
    },
    "MaxChatImageCacheFolderSize": {
      "title": "缓存文件夹最大大小",
      "description": "",
      "type": "Int64",
      "value": 1024,
    },
    "EnableChatImageCacheExpireTimeControl": {
      "title": "启用缓存图片最大储存时限控制",
      "description": "图片最大保留一定天数后，会从最久的图片开始删除",
      "type": "Boolean",
      "value": false,
    },
    "ChatImageCacheExpireTime": {
      "title": "缓存图片最大储存时限",
      "description": "",
      "type": "Int64",
      "value": 30,
    },
    "DebugMode": {
      "title": "调试模式",
      "description": "启用调试模式输出详细信息",
      "type": "Boolean",
      "value": false,
    },
    "ActionAfterOfflineSeconds": {
      "title": "离线操作等待时间",
      "description": "离线后执行操作的等待时间",
      "type": "Int32",
      "value": 120,
    },
    "OfflineActionSendEmail": {
      "title": "启用离线后邮件发送",
      "description": "",
      "type": "Boolean",
      "value": false,
    },
    "OfflineActionEmail_SMTPServer": {
      "title": "SMTP服务器",
      "description": "",
      "type": "String",
      "value": "smtp.qq.com",
    },
    "OfflineActionEmail_SMTPPort": {
      "title": "SMTP服务器端口",
      "description": "",
      "type": "UInt16",
      "value": 587,
    },
    "OfflineActionEmail_SMTPUsername": {
      "title": "SMTP用户名",
      "description": "",
      "type": "String",
      "value": "",
    },
    "OfflineActionEmail_SMTPPassport": {
      "title": "SMTP授权码",
      "description": "",
      "type": "String",
      "value": "",
    },
    "OfflineActionEmail_SMTPSenderEmail": {
      "title": "邮件发送方邮箱",
      "description": "",
      "type": "String",
      "value": "",
    },
    "OfflineActionEmail_SMTPReceiveEmail": {
      "title": "邮件接收方邮箱",
      "description": "",
      "type": "String",
      "value": "",
    },
    "OfflineActionRunCommand": {
      "title": "启用离线后执行终端指令",
      "description": "",
      "type": "Boolean",
      "value": false,
    },
    "OfflineActionCommands": {
      "title": "离线后执行终端指令",
      "description": "",
      "type": "List`1",
      "value": [],
    },
  },
  "message": null,
}
```

### 7.2 更新配置项

```
Post /api/config/core
```

**Request:**

```jsonc
{
  "key": "MessageCacheSize",
  "value": 1024,
}
```

#### 200

**Response:** `{ "code": 0, "data": null }`

#### 404

```json
{
  "code": 404,
  "data": null,
  "message": "未能找到名称为 MessageCacheSize1 的配置项"
}
```

#### 400

```json
{
  "code": 400,
  "data": null,
  "message": "无效的数值转换，检查写入值是否与配置类型匹配"
}
```

### 7.3 获取协议配置项

```
Get /api/config/protocol/{name}
```

#### 200

```json
{
  "code": 0,
  "data": {
    "WebSocketURL": {
      "title": "正向 WebSocket 服务器 Url",
      "description": "",
      "type": "String",
      "value": "1"
    },
    "AuthKey": {
      "title": "鉴权 Token",
      "description": "",
      "type": "String",
      "value": "null"
    },
    "QQ": {
      "title": "目标 QQ",
      "description": "",
      "type": "Int64",
      "value": 3
    },
    "FullMemberInfo": {
      "title": "详细群成员信息",
      "description": "调用更详细的群成员信息接口 但是可能大幅度加长调用时长",
      "type": "Boolean",
      "value": false
    }
  },
  "message": null
}
```

#### 404

```json
{
  "code": 404,
  "data": null,
  "message": "未能找到名称为 MiraiAPIHttp1 的协议配置"
}
```

### 7.4 更新配置项

```
Post /api/config/protocol/{name}
```

**Request:**

```jsonc
{
  "key": "FullMemberInfo",
  "value": false,
}
```

#### 200

**Response:** `{ "code": 0, "data": null }`

#### 404

```json
{
  "code": 404,
  "data": null,
  "message": "未能找到名称为 MessageCacheSize1 的配置项"
}
```

#### 400

```json
{
  "code": 400,
  "data": null,
  "message": "无效的数值转换，检查写入值是否与配置类型匹配"
}
```

---

### 7.4 获取 WebUI 配置

```
GET /api/config/webui
```

获取 WebUI 自身的配置项（监听地址、端口、HTTPS、证书路径等），每项含标题、描述和当前值。

**Response:**

```json
{
  "code": 0,
  "data": {
    "ListenIP": {
      "title": "监听 IP",
      "description": "WebUI 服务监听的 IP 地址，* 表示监听所有地址",
      "type": "String",
      "value": "127.0.0.1"
    },
    "ListenPort": {
      "title": "监听端口",
      "description": "WebUI 服务监听的端口号",
      "type": "Int32",
      "value": 5000
    },
    "EnableHTTPS": {
      "title": "启用 HTTPS",
      "description": "是否启用 HTTPS 加密连接",
      "type": "Boolean",
      "value": false
    },
    "CertificatePath": {
      "title": "HTTPS 证书路径",
      "description": "HTTPS 证书文件（PEM 或 PFX）的存放路径",
      "type": "String",
      "value": ""
    },
    "CertificateKeyPath": {
      "title": "证书密钥路径",
      "description": "HTTPS 证书密钥文件的存放路径",
      "type": "String",
      "value": ""
    }
  },
  "message": null
}
```

### 7.5 修改 WebUI 配置

```
POST /api/config/webui
```

修改 WebUI 监听地址、端口、HTTPS 证书路径及管理密码。修改后需重启 WebUI 生效。

**Request:**

| 参数 | 类型 | 说明 |
|------|------|------|
| `Key` | string | 配置项名：ListenIP、ListenPort、EnableHTTPS、Password、CertificatePath、CertificateKeyPath |
| `Value` | any | 新值，类型自动适配 |

```json
{
  "key": "ListenPort",
  "value": 8080
}
```

**Response (200):**

```json
{
  "code": 0,
  "data": null,
  "message": null
}
```

**Response (400):**

```json
{
  "code": 400,
  "data": null,
  "message": "端口号需在 0 ~ 65535 之间"
}
```

**Response (404):**

```json
{
  "code": 404,
  "data": null,
  "message": "未能找到名称为 xxx 的 WebUI 配置项"
}
```

---

## 8. 图片

### 8.1 获取缓存文件

```
GET /file/{type}/{file}
```

- `type`是指文件的类型，目前有三种可选`image`（图片）、`record`（音频）、`video`（视频）
- `file`是指文件名，有两种选项：1. 缓存哈希 2. 文件名

**Response:** 301重定向至文件的原生url

---

# SignalR Hub

## 连接

```
GET /realtime?access_token={token}
```

通过 Query String 传递 JWT。

## 事件 (服务端 → 客户端)

### OnGroupMsg — 群消息

```jsonc
{
  "msgId": 5001,
  "group": 123456789,
  "qq": 987654321,
  "msg": "消息文本 (含 CQ 码)",
  "time": "2026-05-21T12:00:00"
}
```

### OnPrivateMsg — 私聊消息

```jsonc
{
  "msgId": 5002,
  "qq": 987654321,
  "msg": "消息文本",
  "time": "2026-05-21T12:00:00"
}
```

### OnGroupAdded — 群成员增加

```jsonc
{
  "group": 123456789,
  "qq": 987654321
}
```

### OnGroupLeft — 群成员退出

```jsonc
{
  "group": 123456789,
  "qq": 987654321
}
```

### OnGroupBan — 群禁言

```jsonc
{
  "group": 123456789,
  "qq": 987654321,
  "operatedQQ": 111111,
  "time": "2026-05-21T12:00:00"
}
```

### OnGroupMsgRecall — 群消息撤回

```jsonc
{
  "msgId": 5001,
  "qq": 987654321,
  "msg": "消息内容"
}
```

### OnPrivateMsgRecall — 私聊消息撤回

```jsonc
{
  "msgId": 5002,
  "qq": 987654321,
  "msg": "消息内容"
}
```

### OnGroupMessageSend — 群消息发送回执

```jsonc
{
  "msgId": 5003,
  "group": 123456789,
  "msg": "消息内容",
  "plugin": { /* PluginDto */ }
}
```

### OnPrivateMessageSend — 私聊消息发送回执

```jsonc
{
  "msgId": 5004,
  "qq": 987654321,
  "msg": "消息内容",
  "plugin": { /* PluginDto */ }
}
```

### PluginEnableChanged — 插件启用/禁用

```jsonc
{
  "plugin": { /* PluginDto */ }
}
```

### PluginAdded — 新插件加载

```jsonc
{
  "plugin": { /* PluginDto */ }
}
```

### PluginRemoved — 插件卸载

```jsonc
{
  "plugin": { /* PluginDto */ }
}
```

### PluginConnectStatusChanged — 插件连接状态变更

```jsonc
{
  "plugin": { /* PluginDto */ }
}
```

### ProtocolOnline — 协议上线

```jsonc
{
  "name": "OneBot v11"
}
```

### ProtocolOffline — 协议下线

```jsonc
{
  "name": "OneBot v11"
}
```

### CurrentBotInfoChanged — Bot 信息变更

```jsonc
{
  "nick": "机器人昵称",
  "qq": 123456789
}
```

### LogAdded — 新日志

```jsonc
{
  "logId": 1,
  "log": { /* LogDto */ }
}
```

### LogStatusUpdated — 日志状态更新

```jsonc
{
  "logId": 1,
  "status": "read"
}
```

### UsageUpdated — 系统资源占用更新（每秒）

```jsonc
{
  "cpuUsage": 23.5,
  "memoryUsage": 45.2,
  "cpuCurrentFrequency": 3600.0,
  "usedMemoryInMB": 8192,
  "totalMemoryInMB": 16384
}
```

### PluginUsageUpdated — 进程资源占用更新（每秒）

```jsonc
{
  "totalProcessMemory": 512.5,
  "totalProcessCPU": 12.3,
  "processedMessageCount": 1000,
  "sentMessageCount": 500,
  "pluginUsages": [
    { /* DashboardPluginItem */ }
  ]
}
```
