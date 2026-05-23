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

### 1.2 刷新 Token

```
GET /api/auth/refresh
```

**Response:**
```jsonc
{
  "code": 0,
  "data": { "valid": true }
}
```

**Response (失败):**
```jsonc
{
  "code": 401,
  "message": "未登录或登录失效"
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
    "loadedPluginCount": 0
  },
  "message": null
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
    "cpuCurrentFrequency": 3096.049072265625,
    "usedMemoryInMB": 13031,
    "totalMemoryInMB": 15229
  },
  "message": null
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
    "pluginUsages": [
      {
        "id": 0,
        "pid": 27068,
        "pluginName": "主框架",
        "running": true,
        "cpuUsage": 0.5207086756763764,
        "memoryUsage": 42.65625
      }
    ]
  },
  "message": null
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
      "auth": [
        101,
        106
      ]
    },
    {
      "authCode": 10002,
      "enabled": false,
      "pluginId": "启用插件以查看 AppId",
      "pluginName": "Steam视奸机",
      "author": "落花茗",
      "description": "玩啥呢 不叫我",
      "version": "1.0.0",
      "auth": [
        101,
        106,
        161
      ]
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
        20,
        30,
        101,
        103,
        106,
        110,
        120,
        121,
        122,
        123,
        124,
        125,
        126,
        127,
        128,
        130,
        131,
        132,
        140,
        150,
        151,
        160,
        161,
        162,
        180
      ]
    }
  ],
  "message": null
}
```

### 3.2 拉取插件元数据

```
POST /api/plugin/{authCode}/info
```

#### 200

**Response:** 
```json
{
  "code": 0,
  "data": {
    "authCode": 10001,
    "appId": "",
    "loaderType": 0,
    "ret": 1,
    "apiver": 9,
    "name": "水银掷筛机",
    "version": "1.1.3",
    "version_id": 1,
    "author": "落花茗",
    "description": "R!",
    "_event": [
      {
        "id": 1,
        "type": 21,
        "name": "私聊消息处理",
        "function": "_eventPrivateMsg",
        "priority": 10,
        "address": 0
      },
      {
        "id": 2,
        "type": 2,
        "name": "群消息处理",
        "function": "_eventGroupMsg",
        "priority": 10,
        "address": 0
      },
      {
        "id": 1001,
        "type": 1001,
        "name": "酷Q启动事件",
        "function": "_eventStartup",
        "priority": 30000,
        "address": 0
      }
    ],
    "menu": [],
    "status": [],
    "auth": [
      101,
      106
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
    "auth": [
      101,
      106
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
    "auth": [
      101,
      106
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
      20,
      30,
      101,
      103,
      106,
      110,
      120,
      121,
      122,
      123,
      124,
      125,
      126,
      127,
      128,
      130,
      131,
      132,
      140,
      150,
      151,
      160,
      161,
      162,
      180
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
      "auth": [
        101,
        106
      ]
    },
    {
      "authCode": 10005,
      "enabled": false,
      "pluginId": "启用插件以查看 AppId",
      "pluginName": "Steam视奸机",
      "author": "落花茗",
      "description": "玩啥呢 不叫我",
      "version": "1.0.0",
      "auth": [
        101,
        106,
        161
      ]
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
        20,
        30,
        101,
        103,
        106,
        110,
        120,
        121,
        122,
        123,
        124,
        125,
        126,
        127,
        128,
        130,
        131,
        132,
        140,
        150,
        151,
        160,
        161,
        162,
        180
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
  "data": [
    "MiraiAPIHttp",
    "Lagrange.Core",
    "NoConnection",
    "OneBot v11",
    "Satori v1"
  ],
  "message": null
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
    "isConnected": true
  },
  "message": null
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
  "message": null
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
GET /api/log
```

**参数:**

| 参数 | 类型 | 说明 |
|---|---|---|
| `priority` | int | 最小日志等级 |
| `pageIndex` | int | 页码数 |
| `pageSize` | int | 每页条数 |
| `search` | string | 来源，模糊匹配（可选） |
| `asc` | bool | 按时间升序（可选） |
| `start` | datetime | 开始时间（可选） |
| `end` | datetime | 结束时间（可选） |

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
      "value": true
    },
    "AutoProtocol": {
      "title": "自动连接协议",
      "description": "选择启动时自动连接的协议",
      "type": "String",
      "value": "NoConnection"
    },
    "ReconnectTime": {
      "title": "重新连接间隔时间",
      "description": "协议失去连接时每次重新连接的间隔时间",
      "type": "Int32",
      "value": 5000
    },
    "PluginExitWhenCoreExit": {
      "title": "框架退出时插件自动退出",
      "description": "主程序退出时自动关闭所有插件",
      "type": "Boolean",
      "value": true
    },
    "RestartPluginIfDead": {
      "title": "插件崩溃时自动重启",
      "description": "插件发生异常时自动重新启动",
      "type": "Boolean",
      "value": false
    },
    "HeartBeatInterval": {
      "title": "心跳间隔时间",
      "description": "核心与插件之间的心跳检测间隔",
      "type": "Int32",
      "value": 30000
    },
    "PluginInvokeTimeout": {
      "title": "插件方法调用超时",
      "description": "",
      "type": "Int32",
      "value": 120000
    },
    "LoadTimeout": {
      "title": "插件载入超时",
      "description": "",
      "type": "Int32",
      "value": 10000
    },
    "UseDatabase": {
      "title": "日志使用数据库",
      "description": "是否将日志存储到数据库",
      "type": "Boolean",
      "value": true
    },
    "MessageCacheSize": {
      "title": "消息缓存数量",
      "description": "内存中缓存的消息数量限制",
      "type": "Int32",
      "value": 4096
    },
    "EnableChatImageCacheMaxSizeControl": {
      "title": "启用最大缓存图片体积控制",
      "description": "缓存文件夹超出体积时，会从最久的图片开始删除",
      "type": "Boolean",
      "value": false
    },
    "MaxChatImageCacheFolderSize": {
      "title": "缓存文件夹最大大小",
      "description": "",
      "type": "Int64",
      "value": 1024
    },
    "EnableChatImageCacheExpireTimeControl": {
      "title": "启用缓存图片最大储存时限控制",
      "description": "图片最大保留一定天数后，会从最久的图片开始删除",
      "type": "Boolean",
      "value": false
    },
    "ChatImageCacheExpireTime": {
      "title": "缓存图片最大储存时限",
      "description": "",
      "type": "Int64",
      "value": 30
    },
    "DebugMode": {
      "title": "调试模式",
      "description": "启用调试模式输出详细信息",
      "type": "Boolean",
      "value": false
    },
    "ActionAfterOfflineSeconds": {
      "title": "离线操作等待时间",
      "description": "离线后执行操作的等待时间",
      "type": "Int32",
      "value": 120
    },
    "OfflineActionSendEmail": {
      "title": "启用离线后邮件发送",
      "description": "",
      "type": "Boolean",
      "value": false
    },
    "OfflineActionEmail_SMTPServer": {
      "title": "SMTP服务器",
      "description": "",
      "type": "String",
      "value": "smtp.qq.com"
    },
    "OfflineActionEmail_SMTPPort": {
      "title": "SMTP服务器端口",
      "description": "",
      "type": "UInt16",
      "value": 587
    },
    "OfflineActionEmail_SMTPUsername": {
      "title": "SMTP用户名",
      "description": "",
      "type": "String",
      "value": ""
    },
    "OfflineActionEmail_SMTPPassport": {
      "title": "SMTP授权码",
      "description": "",
      "type": "String",
      "value": ""
    },
    "OfflineActionEmail_SMTPSenderEmail": {
      "title": "邮件发送方邮箱",
      "description": "",
      "type": "String",
      "value": ""
    },
    "OfflineActionEmail_SMTPReceiveEmail": {
      "title": "邮件接收方邮箱",
      "description": "",
      "type": "String",
      "value": ""
    },
    "OfflineActionRunCommand": {
      "title": "启用离线后执行终端指令",
      "description": "",
      "type": "Boolean",
      "value": false
    },
    "OfflineActionCommands": {
      "title": "离线后执行终端指令",
      "description": "",
      "type": "List`1",
      "value": []
    }
  },
  "message": null
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
  "value": 1024
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
  "value": false
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
